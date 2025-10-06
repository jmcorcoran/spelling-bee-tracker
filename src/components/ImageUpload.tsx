import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createWorker } from 'tesseract.js';

interface HintsData {
  [letter: string]: {
    [length: number]: number;
  };
}

interface ImageUploadProps {
  onHintsLoaded: (hintsData: HintsData, totalWords: number, twoLetterList: { combo: string; count: number }[], pangrams: number, allowedLetters: string[]) => void;
}

const ImageUpload = ({ onHintsLoaded }: ImageUploadProps) => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const parseTwoLetterList = (text: string): { combo: string; count: number }[] => {
    if (!text.trim()) return [];
    
    const results: { combo: string; count: number }[] = [];
    const lines = text.split('\n').map(line => line.trim());
    
    for (const line of lines) {
      const matches = [...line.matchAll(/([A-Z]{2})[:\s\-]+(\d+)/gi)];
      
      if (matches.length > 0) {
        matches.forEach(match => {
          const combo = match[1].toUpperCase();
          const count = parseInt(match[2], 10);
          if (combo.length === 2 && count > 0) {
            const existingIndex = results.findIndex(r => r.combo === combo);
            if (existingIndex >= 0) {
              results[existingIndex].count += count;
            } else {
              results.push({ combo, count });
            }
          }
        });
      }
    }
    
    return results.sort((a, b) => a.combo.localeCompare(b.combo));
  };

  const parseHintsFromContent = (
    content: string
  ): { hintsData: HintsData; totalWords: number; pangrams: number; allowedLetters: string[] } | null => {
    try {
      const hintsData: HintsData = {};
      let totalWords = 0;
      let pangrams = 0;
      let allowedLetters: string[] = [];

      const lines = content.split("\n").map((l) => l.trim()).filter(l => l.length > 0);

      // First line should contain the allowed letters
      if (lines.length > 0) {
        const firstLine = lines[0];
        if (/^[a-z]\s+[a-z]/.test(firstLine)) {
          allowedLetters = firstLine.split(/\s+/).map(letter => letter.toUpperCase()).filter(l => /^[A-Z]$/.test(l));
        }
      }

      for (const raw of lines) {
        const line = raw.replace(/\u00A0/g, " ");
        
        const pangramMatch = line.match(/PANGRAMS?:\s*(\d+)/i);
        if (pangramMatch) {
          pangrams = parseInt(pangramMatch[1], 10);
          continue;
        }
        
        const letterMatch = line.match(/^([a-z]):\s*(.+)$/i);
        if (letterMatch) {
          const letter = letterMatch[1].toUpperCase();
          
          if (letter === 'Σ') continue;
          
          const values = letterMatch[2].split(/\s+/).slice(0, -1);
          
          if (values.length > 0) {
            hintsData[letter] = {};
            values.forEach((value, idx) => {
              const count = value === '-' ? 0 : parseInt(value, 10);
              if (!isNaN(count) && count > 0) {
                const length = 4 + idx;
                hintsData[letter][length] = count;
                totalWords += count;
              }
            });
          }
        }
      }

      if (Object.keys(hintsData).length === 0) {
        return null;
      }

      return { hintsData, totalWords, pangrams, allowedLetters };
    } catch (error) {
      console.error("Error parsing hints data:", error);
      return null;
    }
  };

  const separateContent = (text: string): { hintsText: string; twoLetterText: string } => {
    const lines = text.split('\n').map(line => line.trim());
    const hintsLines: string[] = [];
    const twoLetterLines: string[] = [];
    
    for (const line of lines) {
      if (/^[a-z]\s+[a-z]/.test(line)) {
        hintsLines.push(line);
      }
      else if (/^[a-z]:\s*[\d\-\s]+$/i.test(line) || /PANGRAMS?:\s*\d+/i.test(line) || /WORDS:\s*\d+/i.test(line) || /^\d+\s+\d+/.test(line)) {
        hintsLines.push(line);
      }
      else if (/([A-Z]{2})[:\s\-]+\d+/i.test(line) || /^[A-Z]{2}(\s+[A-Z]{2})*$/i.test(line)) {
        twoLetterLines.push(line);
      }
      else if (line.length > 0) {
        hintsLines.push(line);
      }
    }
    
    return {
      hintsText: hintsLines.join('\n'),
      twoLetterText: twoLetterLines.join('\n')
    };
  };

  const handleFileUpload = useCallback((files: FileList | null) => {
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

    setUploadedFile(file);
    processImageWithOCR(file);
  }, [toast]);

  const processImageWithOCR = async (file: File) => {
    setIsProcessing(true);

    try {
      toast({
        title: "Processing image...",
        description: "Extracting text from the image. This may take a moment.",
      });

      const worker = await createWorker('eng');
      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();

      console.log('Extracted text:', text);

      // Separate content into hints and two-letter sections
      const { hintsText, twoLetterText } = separateContent(text);
      
      console.log('Hints text:', hintsText);
      console.log('Two-letter text:', twoLetterText);

      // Parse hints data
      const parsed = parseHintsFromContent(hintsText);
      const twoLetterList = parseTwoLetterList(twoLetterText);

      if (!parsed) {
        toast({
          title: "Could not parse hints",
          description: "We couldn't find a recognizable hints grid in the image. Make sure the image shows the full hints table.",
          variant: "destructive"
        });
        return;
      }

      onHintsLoaded(parsed.hintsData, parsed.totalWords, twoLetterList, parsed.pangrams, parsed.allowedLetters);
      
      toast({
        title: "Hints loaded!",
        description: `Loaded ${parsed.totalWords} total words${twoLetterList.length > 0 ? ` and ${twoLetterList.length} two-letter combos` : ''} from the image.`,
      });
    } catch (error) {
      console.error('OCR processing error:', error);
      toast({
        title: "Processing failed",
        description: "Error extracting text from image. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFileUpload(e.dataTransfer.files);
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <Card className="p-4 bg-slate-900/90 border-slate-700/50 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Upload Hints Image</h3>
          <p className="text-sm text-slate-400">Extract hints from a screenshot</p>
        </div>
        <Badge variant="secondary" className="bg-slate-800 text-slate-300">
          {uploadedFile ? '1 file' : 'No file'}
        </Badge>
      </div>

      <div
        className="border-2 border-dashed border-slate-600/60 rounded-lg p-4 text-center hover:border-slate-500/80 transition-colors duration-300 bg-slate-800/50"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <div className="flex items-center justify-center gap-3">
          <div className="p-2 rounded-full bg-slate-700/50">
            <Upload className="h-5 w-5 text-slate-300" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-slate-200">Drop images or click to browse</p>
            <p className="text-xs text-slate-400">PNG, JPG, GIF up to 10MB</p>
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleFileUpload(e.target.files)}
            className="hidden"
            id="file-upload"
          />
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => document.getElementById('file-upload')?.click()}
            className="border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:border-slate-500"
          >
            Browse
          </Button>
        </div>
      </div>

      {uploadedFile && (
        <div className="mt-4">
          <div className="relative group flex items-center gap-2 bg-slate-800/60 rounded-lg p-2 border border-slate-700/50">
            <ImageIcon className="h-4 w-4 text-slate-400" />
            <span className="text-xs text-slate-300 max-w-48 truncate">{uploadedFile.name}</span>
            <button
              onClick={removeFile}
              className="p-1 bg-red-900/50 text-red-300 rounded-full hover:bg-red-800/60 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="mt-4 p-3 bg-slate-800/60 rounded-lg border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-400 border-t-transparent"></div>
            <span className="text-slate-200 text-sm font-medium">Processing images...</span>
          </div>
        </div>
      )}
    </Card>
  );
};

export default ImageUpload;