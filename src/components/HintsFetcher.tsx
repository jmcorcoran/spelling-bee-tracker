import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, AlertCircle, CheckCircle, Upload, Image as ImageIcon, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createWorker } from 'tesseract.js';

interface HintsData {
  [letter: string]: {
    [length: number]: number;
  };
}

interface HintsFetcherProps {
  onHintsLoaded: (hintsData: HintsData, totalWords: number, twoLetterList: { combo: string; count: number }[]) => void;
}

const HintsFetcher = ({ onHintsLoaded }: HintsFetcherProps) => {
  const [hintsImage, setHintsImage] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const { toast } = useToast();

  const processImageWithOCR = async (file: File): Promise<string> => {
    const worker = await createWorker('eng');
    try {
      const { data: { text } } = await worker.recognize(file);
      return text;
    } finally {
      await worker.terminate();
    }
  };

  const parseTwoLetterList = (text: string): { combo: string; count: number }[] => {
    if (!text.trim()) return [];
    
    const results: { combo: string; count: number }[] = [];
    
    // Split by both newlines and common separators
    const allText = text.replace(/[\n\r]+/g, ' ');
    
    // Look for patterns like "AB: 5", "AB 5", "AB-5", "AB(5)", or just "AB"
    const patterns = [
      /([A-Z]{2})[:\s\-\(]+(\d+)[\)]*(?:\s|$|,)/gi,  // AB: 5, AB 5, AB-5, AB(5)
      /([A-Z]{2})(?:\s|$|,)/gi  // Just AB (fallback)
    ];
    
    // Try the first pattern (with numbers)
    let match;
    const regex1 = /([A-Z]{2})[:\s\-\(]+(\d+)[\)]*(?:\s|$|,)/gi;
    while ((match = regex1.exec(allText)) !== null) {
      const combo = match[1].toUpperCase();
      const count = parseInt(match[2], 10);
      if (combo.length === 2 && count > 0) {
        results.push({ combo, count });
      }
    }
    
    // If no matches with numbers, try just extracting 2-letter combos
    if (results.length === 0) {
      const regex2 = /([A-Z]{2})(?:\s|$|,)/gi;
      while ((match = regex2.exec(allText)) !== null) {
        const combo = match[1].toUpperCase();
        if (combo.length === 2 && !results.find(r => r.combo === combo)) {
          results.push({ combo, count: 1 }); // Default count
        }
      }
    }
    
    console.log('Parsed 2-letter combos:', results); // Debug log
    return results.sort((a, b) => a.combo.localeCompare(b.combo));
  };
  // Parse hints data from page text (expects rows like "A 3 2 1 ...")
  const parseHintsFromContent = (
    content: string
  ): { hintsData: HintsData; totalWords: number } | null => {
    try {
      const hintsData: HintsData = {};
      let totalWords = 0;

      // Split and clean lines
      const lines = content
        .split("\n")
        .map((l) => l.replace(/\u00A0/g, ' ').trim())
        .filter(Boolean);

      console.log('All OCR lines:', lines);

      // Find the header row with column lengths
      let columnLengths: number[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Look for a line that starts with "LETTER" or just contains numbers 4-12
        if (/^LETTER/i.test(line)) {
          const nums = (line.match(/\d+/g) || []).map(Number).filter(n => n >= 4 && n <= 12);
          if (nums.length >= 2) {
            columnLengths = nums;
            console.log('Found header with LETTER:', columnLengths);
            break;
          }
        }
        
        // Or look for a line that's just numbers (like "4 5 6 7 8 9 10")
        const tokens = line.split(/\s+/);
        if (tokens.length >= 3 && tokens.every(t => /^\d+$/.test(t))) {
          const nums = tokens.map(Number).filter(n => n >= 4 && n <= 12);
          if (nums.length >= 2) {
            columnLengths = nums;
            console.log('Found numeric header:', columnLengths);
            break;
          }
        }
      }

      // If no header found, make an educated guess
      if (columnLengths.length === 0) {
        console.log('No header found, using default columns');
        columnLengths = [4, 5, 6, 7, 8, 9, 10, 11, 12];
      }

      // Parse letter rows
      for (const line of lines) {
        // Skip header, total, or empty lines - be more aggressive about total detection
        if (/^LETTER/i.test(line) || 
            /^TOTAL/i.test(line) || 
            /^\s*TOTAL/i.test(line) ||
            /TOTAL\s*$/i.test(line) ||
            !/^[A-Z]/.test(line)) {
          console.log(`Skipping line: "${line}"`);
          continue;
        }

        // Must start with a single letter
        const firstChar = line.charAt(0).toUpperCase();
        if (!/[A-Z]/.test(firstChar)) {
          console.log(`Skipping non-letter line: "${line}"`);
          continue;
        }

        // Get the rest of the line and extract all numbers
        const restOfLine = line.slice(1).trim();
        const numbers = (restOfLine.match(/\d+/g) || []).map(Number);
        
        console.log(`Letter ${firstChar}: found numbers [${numbers.join(', ')}]`);

        if (numbers.length === 0) continue;

        // Remove the last number if it looks like a row total
        let counts = numbers;
        if (numbers.length > 1) {
          const possibleTotal = numbers[numbers.length - 1];
          const sumOfRest = numbers.slice(0, -1).reduce((sum, n) => sum + n, 0);
          if (possibleTotal === sumOfRest) {
            counts = numbers.slice(0, -1); // Remove the total
            console.log(`  Removed row total ${possibleTotal}, using [${counts.join(', ')}]`);
          }
        }

        // Map counts to ALL column lengths (don't limit to just a few)
        hintsData[firstChar] = {};
        for (let idx = 0; idx < Math.min(counts.length, columnLengths.length); idx++) {
          const count = counts[idx];
          const length = columnLengths[idx];
          if (count > 0) {
            hintsData[firstChar][length] = count;
            totalWords += count;
            console.log(`  Mapped ${count} words of length ${length}`);
          }
        }
        
        // Warn if we have more counts than columns
        if (counts.length > columnLengths.length) {
          console.log(`  Warning: Row ${firstChar} has ${counts.length} counts but only ${columnLengths.length} columns defined`);
        }
      }

      console.log('Final parsed data:', hintsData);
      console.log('Total words:', totalWords);

      if (Object.keys(hintsData).length === 0) {
        return null;
      }

      return { hintsData, totalWords };
    } catch (error) {
      console.error('Error parsing hints data:', error);
      return null;
    }
  };

  const parseHints = async () => {
    if (!hintsImage) {
      toast({
        title: "Image Required",
        description: "Please upload an image containing the hints table and 2-letter list.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      console.log('Processing image with OCR...');
      const ocrText = await processImageWithOCR(hintsImage);
      console.log('OCR result:', ocrText);

      // Parse both hints table and 2-letter list from the same text
      const parsed = parseHintsFromContent(ocrText);
      const twoLetterList = parseTwoLetterList(ocrText);

      if (!parsed) {
        toast({
          title: "Could not parse hints",
          description: "We couldn't find a recognizable hints grid. Make sure the image shows a clear table with letters and numbers.",
          variant: "destructive",
        });
        return;
      }

      onHintsLoaded(parsed.hintsData, parsed.totalWords, twoLetterList);
      setLastFetched(new Date().toLocaleString());
      toast({
        title: "Hints Loaded!",
        description: `Loaded ${parsed.totalWords} total words${twoLetterList.length > 0 ? ` and ${twoLetterList.length} two-letter combos` : ''} from the image.`,
      });
    } catch (error) {
      console.error("Error parsing hints:", error);
      toast({
        title: "Error Loading Hints",
        description: "Could not process the image. Please check the image quality and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-6 bg-slate-800/80 border-slate-700/50 backdrop-blur-sm">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <FileText className="h-6 w-6 text-blue-400" />
          Load Hints Data
        </h2>
        <p className="text-slate-300">
          Upload an image containing both the hints table and 2-letter list
        </p>
      </div>

      <div className="space-y-4">
        {/* Single Image Upload */}
        <div className="border-2 border-dashed border-slate-600/60 rounded-lg p-6 text-center hover:border-slate-500/80 transition-colors duration-300 bg-slate-800/50">
          <div className="flex flex-col items-center gap-4">
            <div className="p-3 rounded-full bg-slate-700/50">
              <Upload className="h-8 w-8 text-slate-300" />
            </div>
            <div>
              <p className="text-lg font-medium text-slate-200">Upload Hints Image</p>
              <p className="text-sm text-slate-400">Should include both the hints table and 2-letter word list</p>
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setHintsImage(e.target.files?.[0] || null)}
              className="hidden"
              id="hints-image-upload"
            />
            <Button 
              variant="outline" 
              onClick={() => document.getElementById('hints-image-upload')?.click()}
              className="border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:border-slate-500"
            >
              Choose Image
            </Button>
          </div>
          {hintsImage && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-300 bg-slate-700/30 rounded-lg p-3">
              <ImageIcon className="h-4 w-4" />
              <span>{hintsImage.name}</span>
              <button
                onClick={() => setHintsImage(null)}
                className="p-1 bg-red-900/50 text-red-300 rounded-full hover:bg-red-800/60 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <Button
          onClick={parseHints}
          disabled={isLoading || !hintsImage}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
              Processing Image...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Process Image
            </>
          )}
        </Button>

        {lastFetched && (
          <div className="flex items-center gap-2 p-3 bg-blue-900/30 rounded-lg border border-blue-700/50">
            <CheckCircle className="h-4 w-4 text-blue-400" />
            <span className="text-sm text-slate-200">
              Last updated: {lastFetched}
            </span>
          </div>
        )}

        <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600/50">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-slate-400 mt-0.5" />
            <div className="text-sm text-slate-300">
              <p className="font-medium mb-1">Expected Format:</p>
              <ul className="text-xs space-y-1 text-slate-400">
                <li>• Each line should start with a letter (A, B, C, etc.)</li>
                <li>• Followed by word counts for different lengths</li>
                <li>• Example: "A 3 2 1" means 3 four-letter words, 2 five-letter words, 1 six-letter word</li>
                <li>• Two-letter list format: "AB: 5" or "AB 5" (combo followed by count)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default HintsFetcher;