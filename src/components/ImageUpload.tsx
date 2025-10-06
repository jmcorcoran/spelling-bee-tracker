import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Upload, X, Image as ImageIcon, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createWorker } from 'tesseract.js';
import { supabase } from '@/integrations/supabase/client';

interface HintsData {
  [letter: string]: {
    [length: number]: number;
  };
}

interface ImageUploadProps {
  onHintsLoaded: (hintsData: HintsData, totalWords: number, twoLetterList: { combo: string; count: number }[], pangrams: number, allowedLetters: string[]) => void;
  onWordsExtracted?: (words: string[]) => void;
}

const ImageUpload = ({ onHintsLoaded, onWordsExtracted }: ImageUploadProps) => {
  const [progressFile, setProgressFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedText, setExtractedText] = useState<string>('');
  const { toast } = useToast();

  const handleProgressFileUpload = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file only.",
        variant: "destructive"
      });
      return;
    }

    setProgressFile(file);
  }, [toast]);

  const extractWordsFromProgress = (text: string): string[] => {
    // Extract words that are likely spelling bee words (4+ letters, all caps or mixed case)
    const words = text
      .split(/\s+/)
      .map(word => word.replace(/[^A-Za-z]/g, '').toUpperCase())
      .filter(word => word.length >= 4 && /^[A-Z]+$/.test(word));
    
    return Array.from(new Set(words));
  };

  const processProgressImage = async () => {
    if (!progressFile) {
      toast({
        title: "Progress image required",
        description: "Please upload the progress image to continue.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);

    try {
      const worker = await createWorker('eng');
      
      toast({
        title: "Processing progress...",
        description: "Extracting your found words from the progress image.",
      });

      const { data: { text: progressText } } = await worker.recognize(progressFile);
      console.log('Progress text:', progressText);
      const extractedWords = extractWordsFromProgress(progressText);

      await worker.terminate();
      
      if (extractedWords.length > 0 && onWordsExtracted) {
        onWordsExtracted(extractedWords);
      }
      
      toast({
        title: "Progress processed!",
        description: `Loaded ${extractedWords.length} found words.`,
      });
    } catch (error) {
      console.error('OCR processing error:', error);
      toast({
        title: "Processing failed",
        description: "Error extracting text from image. Check console for details.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const removeProgressFile = () => {
    setProgressFile(null);
  };

  const processTextWithAI = async () => {
    if (!pastedText.trim()) {
      toast({
        title: "Text required",
        description: "Please paste the hints text to continue.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setExtractedText('');

    try {
      toast({
        title: "Processing with AI...",
        description: "Claude is analyzing your hints text.",
      });

      const { data, error } = await supabase.functions.invoke('parse-hints', {
        body: { text: pastedText }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Failed to parse hints");
      }

      const parsed = data.data;
      setExtractedText(JSON.stringify(parsed, null, 2));

      // Convert the parsed data to our format
      const hintsData: HintsData = parsed.hintsGrid || {};
      const totalWords = parsed.totalWords || 0;
      const twoLetterList = parsed.twoLetterList || [];
      const pangrams = parsed.pangrams || 0;
      const allowedLetters = parsed.allowedLetters || [];

      if (Object.keys(hintsData).length === 0) {
        throw new Error("No hints grid found in the text");
      }

      // Load hints data
      onHintsLoaded(hintsData, totalWords, twoLetterList, pangrams, allowedLetters);

      toast({
        title: "Text parsed successfully!",
        description: `Loaded ${totalWords} total words${twoLetterList.length > 0 ? `, ${twoLetterList.length} two-letter combos` : ''}.`,
      });
    } catch (error) {
      console.error('AI parsing error:', error);
      toast({
        title: "Processing failed",
        description: error instanceof Error ? error.message : "Failed to parse hints text",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="p-4 bg-slate-900/90 border-slate-700/50 backdrop-blur-sm">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-100 mb-1">Load Hints</h3>
        <p className="text-sm text-slate-400">Paste hints text from the forum</p>
      </div>

      {/* Hints Text Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-200 mb-2">
          Paste Hints Table
        </label>
        <Textarea
          value={pastedText}
          onChange={(e) => setPastedText(e.target.value)}
          placeholder="Paste the full hints table from the NYT forum here..."
          className="min-h-[200px] bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-blue-500"
          maxLength={10000}
        />
        <p className="text-xs text-slate-400 mt-1">
          Include the full table with letters, numbers, and any pangram/word count info
        </p>
      </div>

      <Button
        onClick={processTextWithAI}
        disabled={isProcessing || !pastedText.trim()}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white mb-6"
      >
        {isProcessing ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
            Processing with AI...
          </>
        ) : (
          <>
            <ArrowRight className="h-4 w-4 mr-2" />
            Process Hints with AI
          </>
        )}
      </Button>

      {/* Progress Image Upload */}
      <div className="border-t border-slate-700/50 pt-4">
        <h3 className="text-lg font-semibold text-slate-100 mb-1">Load Progress (Optional)</h3>
        <p className="text-sm text-slate-400 mb-3">Upload a screenshot of your found words</p>
        
        <div
          className="border-2 border-dashed border-slate-600/60 rounded-lg p-3 text-center hover:border-slate-500/80 transition-colors duration-300 bg-slate-800/50 mb-3"
          onDrop={(e) => { e.preventDefault(); handleProgressFileUpload(e.dataTransfer.files); }}
          onDragOver={(e) => e.preventDefault()}
        >
          <div className="flex items-center justify-center gap-2">
            <div className="p-2 rounded-full bg-slate-700/50">
              <Upload className="h-4 w-4 text-slate-300" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-slate-200">Drop progress image or click</p>
              <p className="text-xs text-slate-400">PNG, JPG, GIF</p>
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleProgressFileUpload(e.target.files)}
              className="hidden"
              id="progress-upload"
            />
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => document.getElementById('progress-upload')?.click()}
              className="border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:border-slate-500"
            >
              Browse
            </Button>
          </div>
        </div>
        
        {progressFile && (
          <div className="mb-3 relative group flex items-center gap-2 bg-slate-800/60 rounded-lg p-2 border border-slate-700/50">
            <ImageIcon className="h-4 w-4 text-slate-400" />
            <span className="text-xs text-slate-300 max-w-48 truncate">{progressFile.name}</span>
            <button
              onClick={removeProgressFile}
              className="p-1 bg-red-900/50 text-red-300 rounded-full hover:bg-red-800/60 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        <Button
          onClick={processProgressImage}
          disabled={isProcessing || !progressFile}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isProcessing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
              Processing Progress...
            </>
          ) : (
            <>
              <ArrowRight className="h-4 w-4 mr-2" />
              Extract Found Words
            </>
          )}
        </Button>
      </div>

      {/* Debug Output */}
      {extractedText && (
        <div className="mt-4 p-3 bg-slate-800/60 rounded-lg border border-slate-700/50">
          <div className="mb-2">
            <span className="text-sm font-semibold text-slate-200">Parsed Data</span>
            <p className="text-xs text-slate-400 mt-1">
              This is what AI extracted from your hints text
            </p>
          </div>
          <pre className="text-xs text-slate-300 whitespace-pre-wrap max-h-60 overflow-y-auto bg-slate-900/50 p-2 rounded">
            {extractedText}
          </pre>
        </div>
      )}
    </Card>
  );
};

export default ImageUpload;
