import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, X, Image as ImageIcon, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createWorker } from 'tesseract.js';

interface HintsData {
  [letter: string]: {
    [length: number]: number;
  };
}

interface HintsImageUploadProps {
  onHintsLoaded: (
    hintsData: HintsData,
    totalWords: number,
    twoLetterList: { combo: string; count: number }[],
    pangrams: number,
    allowedLetters: string[]
  ) => void;
}

const HintsImageUpload = ({ onHintsLoaded }: HintsImageUploadProps) => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const parseHintsFromText = (text: string): {
    hintsData: HintsData;
    totalWords: number;
    pangrams: number;
    allowedLetters: string[];
  } | null => {
    try {
      const hintsData: HintsData = {};
      let totalWords = 0;
      let pangrams = 0;
      let allowedLetters: string[] = [];

      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

      if (lines.length > 0) {
  const firstLine = lines[0];
  // Handle both spaced (D E L M N P U) and concatenated (PUDELMN) formats
  if (/^[a-z\s]+$/i.test(firstLine) && firstLine.length >= 7) {
    // If it has spaces, split by spaces
    if (firstLine.includes(' ')) {
      allowedLetters = firstLine.split(/\s+/).map(letter => letter.toUpperCase()).filter(l => /^[A-Z]$/.test(l));
    } else {
      // If concatenated, split into individual characters
      allowedLetters = firstLine.split('').map(l => l.toUpperCase()).filter(l => /^[A-Z]$/.test(l));
    }
    
    // Ensure we have exactly 7 letters
    if (allowedLetters.length === 7) {
      console.log('Parsed allowed letters:', allowedLetters);
    } else {
      allowedLetters = [];
    }
  }
}

      for (const raw of lines) {
        const line = raw.replace(/\u00A0/g, ' ');

        const pangramMatch = line.match(/PANGRAMS?:\s*(\d+)/i);
        if (pangramMatch) {
          pangrams = parseInt(pangramMatch[1], 10);
          continue;
        }

const letterMatch = line.match(/^([a-z])[:\s]+(.+)$/i);
if (letterMatch) {
  const letter = letterMatch[1].toUpperCase();

  // Skip non-letter characters and totals row
  // Only process if it's a single letter from the allowed letters list
  if (!/^[A-Z]$/.test(letter) || !allowedLetters.includes(letter)) {
    console.log(`Skipping row with letter "${letter}" - not in allowed letters`);
    continue;
  }

          const values = letterMatch[2]
            .split(/[\s|,;]+/)
            .map(v => v.trim())
            .filter(v => v.length > 0)
            .slice(0, -1);

          if (values.length > 0) {
            hintsData[letter] = {};
            values.forEach((value, idx) => {
              const count = (value === '-' || value === 'O' || value === '0') ? 0 : parseInt(value, 10);
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
      console.error('Error parsing hints:', error);
      return null;
    }
  };

  const parseTwoLetterList = (text: string): { combo: string; count: number }[] => {
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

  const handleFileUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const file = files[0];

      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Invalid file type',
          description: 'Please upload an image file.',
          variant: 'destructive',
        });
        return;
      }

      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setUploadedFile(file);

      await processImage(file);
    },
    [toast]
  );

  const processImage = async (file: File) => {
    setIsProcessing(true);

    try {
      const worker = await createWorker('eng');

      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789:- ΣΣ',
      });

      const {
        data: { text },
      } = await worker.recognize(file);

      await worker.terminate();

      console.log('OCR Text:', text);

      const hintsResult = parseHintsFromText(text);
      const twoLetterList = parseTwoLetterList(text);

      if (!hintsResult) {
        toast({
          title: 'Could not parse hints',
          description: 'Unable to extract hints grid from the image. Try adjusting the image or using paste method.',
          variant: 'destructive',
        });
        return;
      }

      onHintsLoaded(
        hintsResult.hintsData,
        hintsResult.totalWords,
        twoLetterList,
        hintsResult.pangrams,
        hintsResult.allowedLetters
      );

      toast({
        title: 'Hints Loaded!',
        description: `Extracted ${hintsResult.totalWords} total words${
          twoLetterList.length > 0 ? ` and ${twoLetterList.length} two-letter combos` : ''
        } from image.`,
      });

      setTimeout(() => {
        setUploadedFile(null);
        setPreviewUrl(null);
      }, 2000);
    } catch (error) {
      console.error('OCR processing error:', error);
      toast({
        title: 'Processing failed',
        description: 'Error extracting hints from image. Please try again or use paste method.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const removeFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setUploadedFile(null);
    setPreviewUrl(null);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleFileUpload(e.dataTransfer.files);
    },
    [handleFileUpload]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <Card className="p-4 sm:p-6 bg-slate-800/80 border-slate-700/50 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-400" />
            Quick Load from Screenshot
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Upload a screenshot of the hints grid
          </p>
        </div>
      </div>

      {!uploadedFile && (
        <div
          className="border-2 border-dashed border-slate-600/60 rounded-lg p-6 text-center hover:border-slate-500/80 transition-colors duration-300 bg-slate-800/50 cursor-pointer"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => document.getElementById('hints-file-upload')?.click()}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 rounded-full bg-slate-700/50">
              <Upload className="h-6 w-6 text-slate-300" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">
                Drop hints screenshot or click to browse
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Works best with clear screenshots of the full hints grid
              </p>
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileUpload(e.target.files)}
              className="hidden"
              id="hints-file-upload"
            />
          </div>
        </div>
      )}

      {uploadedFile && previewUrl && (
        <div className="space-y-3">
          <div className="relative">
            <img
              src={previewUrl}
              alt="Hints preview"
              className="w-full max-h-60 object-contain rounded-lg border border-slate-600"
            />
            {!isProcessing && (
              <button
                onClick={removeFile}
                className="absolute top-2 right-2 p-2 bg-red-900/80 text-red-300 rounded-full hover:bg-red-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {isProcessing && (
            <div className="p-4 bg-slate-800/60 rounded-lg border border-slate-700/50">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-400 border-t-transparent"></div>
                <div className="flex-1">
                  <p className="text-slate-200 text-sm font-medium">
                    Extracting hints from image...
                  </p>
                  <p className="text-slate-400 text-xs mt-1">
                    This may take 10-20 seconds
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-900/20 rounded-lg border border-blue-700/50">
        <p className="text-xs text-blue-300">
          <strong>Tips for best results:</strong> Take a clear screenshot of the entire
          hints grid. Make sure the text is readable and not blurry.
        </p>
      </div>
    </Card>
  );
};

export default HintsImageUpload;
