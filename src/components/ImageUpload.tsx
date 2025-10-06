import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, X, Image as ImageIcon, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createWorker } from 'tesseract.js';

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
  const [hintsFile, setHintsFile] = useState<File | null>(null);
  const [progressFile, setProgressFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedText, setExtractedText] = useState<string>('');
  const [showDebug, setShowDebug] = useState(false);
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

      console.log("Parsing hints from lines:", lines);

      // First line should contain the allowed letters - be more flexible
      if (lines.length > 0) {
        const firstLine = lines[0];
        // Try multiple patterns for allowed letters
        if (/^[a-z]\s+[a-z]/i.test(firstLine) || /^[a-z][,\s]+[a-z]/i.test(firstLine)) {
          allowedLetters = firstLine.split(/[,\s]+/).map(letter => letter.toUpperCase()).filter(l => /^[A-Z]$/.test(l));
          console.log("Found allowed letters:", allowedLetters);
        }
      }

      for (const raw of lines) {
        const line = raw.replace(/\u00A0/g, " ").trim();
        
        // Parse pangram count - more flexible pattern
        const pangramMatch = line.match(/PANGRAMS?[:\s]+(\d+)/i);
        if (pangramMatch) {
          pangrams = parseInt(pangramMatch[1], 10);
          console.log("Found pangrams:", pangrams);
          continue;
        }
        
        // Match letter rows - be more flexible with separators
        // Allow: "a: 2 4 2 - - - - 8" or "a 2 4 2 - - - - 8" or "a:2 4 2"
        const letterMatch = line.match(/^([a-z])[:\s]+(.+)$/i);
        if (letterMatch) {
          const letter = letterMatch[1].toUpperCase();
          
          // Skip the totals row (Σ or sum)
          if (letter === 'Σ' || line.toLowerCase().includes('sum')) continue;
          
          // Split by any whitespace, remove the final total if present
          const values = letterMatch[2].split(/\s+/).filter(v => v && v !== '|');
          
          console.log(`Processing letter ${letter} with values:`, values);
          
          // Remove last element if it looks like a row total (number > 20 usually)
          const cleanValues = values.slice();
          if (cleanValues.length > 1) {
            const lastVal = cleanValues[cleanValues.length - 1];
            if (lastVal !== '-' && !isNaN(parseInt(lastVal)) && parseInt(lastVal) > 15) {
              cleanValues.pop(); // Remove row total
            }
          }
          
          if (cleanValues.length > 0) {
            hintsData[letter] = {};
            cleanValues.forEach((value, idx) => {
              const count = value === '-' || value === '—' ? 0 : parseInt(value, 10);
              if (!isNaN(count) && count > 0) {
                const length = 4 + idx; // columns start at 4 letters
                hintsData[letter][length] = count;
                totalWords += count;
              }
            });
          }
        }
      }

      console.log("Final parsed hintsData:", hintsData);
      console.log("Total words:", totalWords);

      if (Object.keys(hintsData).length === 0) {
        console.error("No hints data found in content");
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

  const handleHintsFileUpload = useCallback((files: FileList | null) => {
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

    setHintsFile(file);
  }, [toast]);

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

  const processImages = async () => {
    if (!hintsFile) {
      toast({
        title: "Hints image required",
        description: "Please upload the hints image to continue.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setExtractedText('');

    try {
      const worker = await createWorker('eng');
      
      // Process hints image
      toast({
        title: "Processing hints...",
        description: "Extracting hints data from the image. This may take 30-60 seconds.",
      });

      const { data: { text: hintsText } } = await worker.recognize(hintsFile);
      setExtractedText(hintsText);
      console.log('=== EXTRACTED HINTS TEXT ===');
      console.log(hintsText);
      console.log('=== END EXTRACTED TEXT ===');

      // Separate content into hints and two-letter sections
      const { hintsText: parsedHintsText, twoLetterText } = separateContent(hintsText);
      
      console.log('Separated hints text:', parsedHintsText);
      console.log('Separated two-letter text:', twoLetterText);
      
      // Parse hints data
      const parsed = parseHintsFromContent(parsedHintsText);
      const twoLetterList = parseTwoLetterList(twoLetterText);

      if (!parsed) {
        await worker.terminate();
        setShowDebug(true);
        toast({
          title: "Could not parse hints",
          description: "Check the debug info below to see what text was extracted. The image quality or format might be the issue.",
          variant: "destructive"
        });
        setIsProcessing(false);
        return;
      }

      // Process progress image if provided
      let extractedWords: string[] = [];
      if (progressFile) {
        toast({
          title: "Processing progress...",
          description: "Extracting your found words from the progress image.",
        });

        const { data: { text: progressText } } = await worker.recognize(progressFile);
        console.log('Progress text:', progressText);
        extractedWords = extractWordsFromProgress(progressText);
      }

      await worker.terminate();

      // Load hints data
      onHintsLoaded(parsed.hintsData, parsed.totalWords, twoLetterList, parsed.pangrams, parsed.allowedLetters);
      
      // Load found words if any
      if (extractedWords.length > 0 && onWordsExtracted) {
        onWordsExtracted(extractedWords);
      }
      
      setShowDebug(false);
      toast({
        title: "Images processed!",
        description: `Loaded ${parsed.totalWords} total words${twoLetterList.length > 0 ? `, ${twoLetterList.length} two-letter combos` : ''}${extractedWords.length > 0 ? `, and ${extractedWords.length} found words` : ''}.`,
      });
    } catch (error) {
      console.error('OCR processing error:', error);
      setShowDebug(true);
      toast({
        title: "Processing failed",
        description: "Error extracting text from images. Check console for details.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const removeHintsFile = () => {
    setHintsFile(null);
  };

  const removeProgressFile = () => {
    setProgressFile(null);
  };

  return (
    <Card className="p-4 bg-slate-900/90 border-slate-700/50 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Upload Images</h3>
          <p className="text-sm text-slate-400">Upload hints and progress screenshots</p>
        </div>
        <Badge variant="secondary" className="bg-slate-800 text-slate-300">
          {[hintsFile, progressFile].filter(Boolean).length} / 2 files
        </Badge>
      </div>

      {/* Hints Image Upload */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-200 mb-2">
          Hints Image (Required)
        </label>
        <div
          className="border-2 border-dashed border-slate-600/60 rounded-lg p-3 text-center hover:border-slate-500/80 transition-colors duration-300 bg-slate-800/50"
          onDrop={(e) => { e.preventDefault(); handleHintsFileUpload(e.dataTransfer.files); }}
          onDragOver={(e) => e.preventDefault()}
        >
          <div className="flex items-center justify-center gap-2">
            <div className="p-2 rounded-full bg-slate-700/50">
              <Upload className="h-4 w-4 text-slate-300" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-slate-200">Drop hints image or click</p>
              <p className="text-xs text-slate-400">PNG, JPG, GIF</p>
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleHintsFileUpload(e.target.files)}
              className="hidden"
              id="hints-upload"
            />
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => document.getElementById('hints-upload')?.click()}
              className="border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:border-slate-500"
            >
              Browse
            </Button>
          </div>
        </div>
        
        {hintsFile && (
          <div className="mt-2 relative group flex items-center gap-2 bg-slate-800/60 rounded-lg p-2 border border-slate-700/50">
            <ImageIcon className="h-4 w-4 text-slate-400" />
            <span className="text-xs text-slate-300 max-w-48 truncate">{hintsFile.name}</span>
            <button
              onClick={removeHintsFile}
              className="p-1 bg-red-900/50 text-red-300 rounded-full hover:bg-red-800/60 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Progress Image Upload */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-200 mb-2">
          Progress Image (Optional)
        </label>
        <div
          className="border-2 border-dashed border-slate-600/60 rounded-lg p-3 text-center hover:border-slate-500/80 transition-colors duration-300 bg-slate-800/50"
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
          <div className="mt-2 relative group flex items-center gap-2 bg-slate-800/60 rounded-lg p-2 border border-slate-700/50">
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
      </div>

      {/* Process Button */}
      <Button
        onClick={processImages}
        disabled={isProcessing || !hintsFile}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
      >
        {isProcessing ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
            Processing Images...
          </>
        ) : (
          <>
            <ArrowRight className="h-4 w-4 mr-2" />
            Process Images
          </>
        )}
      </Button>

      {isProcessing && (
        <div className="mt-4 p-3 bg-slate-800/60 rounded-lg border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-400 border-t-transparent"></div>
            <span className="text-slate-200 text-sm font-medium">Extracting text from images...</span>
          </div>
        </div>
      )}

      {/* Debug Output */}
      {extractedText && (
        <div className="mt-4 p-3 bg-slate-800/60 rounded-lg border border-slate-700/50">
          <div className="mb-2">
            <span className="text-sm font-semibold text-slate-200">Extracted Text from OCR</span>
            <p className="text-xs text-slate-400 mt-1">
              This is what was extracted from your image. Check if the grid structure is visible.
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