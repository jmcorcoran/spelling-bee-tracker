import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import HintsImageUpload from './HintsImageUpload';

interface HintsData {
  [letter: string]: {
    [length: number]: number;
  };
}

interface HintsFetcherProps {
  onHintsLoaded: (hintsData: HintsData, totalWords: number, twoLetterList: { combo: string; count: number }[], pangrams: number, allowedLetters: string[]) => void;
}

const HintsFetcher = ({ onHintsLoaded }: HintsFetcherProps) => {
  const [combinedText, setCombinedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const { toast } = useToast();

  const parseTwoLetterList = (text: string): { combo: string; count: number }[] => {
    if (!text.trim()) return [];
    
    const results: { combo: string; count: number }[] = [];
    const lines = text.split('\n').map(line => line.trim());
    
    for (const line of lines) {
      // First try to find ALL patterns like "AB: 5" or "AB 5" or "AB-5" in the line
      const matches = [...line.matchAll(/([A-Z]{2})[:\s\-]+(\d+)/gi)];
      
      if (matches.length > 0) {
        matches.forEach(match => {
          const combo = match[1].toUpperCase();
          const count = parseInt(match[2], 10);
          if (combo.length === 2 && count > 0) {
            // Check if this combo already exists, if so, update the count
            const existingIndex = results.findIndex(r => r.combo === combo);
            if (existingIndex >= 0) {
              results[existingIndex].count += count;
            } else {
              results.push({ combo, count });
            }
          }
        });
      } else {
        // Fallback: extract ALL 2-letter combos from the line
        const words = line.split(/[\s,;|]+/)
          .map(word => word.replace(/[^A-Za-z]/g, '').toUpperCase())
          .filter(word => word.length === 2 && /^[A-Z]+$/.test(word));
        
        words.forEach(combo => {
          if (!results.find(r => r.combo === combo)) {
            results.push({ combo, count: 0 }); // No count available
          }
        });
      }
    }
    
    return results.sort((a, b) => a.combo.localeCompare(b.combo));
  };
  // Parse hints data from page text (expects rows like "a: 2 4 2 - - - - 8")
  const parseHintsFromContent = (
    content: string
  ): { hintsData: HintsData; totalWords: number; pangrams: number; allowedLetters: string[] } | null => {
    try {
      const hintsData: HintsData = {};
      let totalWords = 0;
      let pangrams = 0;
      let allowedLetters: string[] = [];

      const lines = content.split("\n").map((l) => l.trim()).filter(l => l.length > 0);

      // First line should contain the allowed letters (e.g., "k c d e n o u")
      if (lines.length > 0) {
        const firstLine = lines[0];
        // Check if first line looks like space-separated letters
        if (/^[a-z]\s+[a-z]/.test(firstLine)) {
          allowedLetters = firstLine.split(/\s+/).map(letter => letter.toUpperCase()).filter(l => /^[A-Z]$/.test(l));
        }
      }

      for (const raw of lines) {
        const line = raw.replace(/\u00A0/g, " ");
        
        // Parse pangram count from "WORDS: 50, POINTS: 238, PANGRAMS: 1"
        const pangramMatch = line.match(/PANGRAMS?:\s*(\d+)/i);
        if (pangramMatch) {
          pangrams = parseInt(pangramMatch[1], 10);
          continue;
        }
        
        // Match: single letter followed by colon, then tab/space separated values
        // Example: "a:	2	4	2	-	-	-	-	8"
        const letterMatch = line.match(/^([a-z]):\s*(.+)$/i);
        if (letterMatch) {
          const letter = letterMatch[1].toUpperCase();
          
          // Skip the totals row (Σ)
          if (letter === 'Σ') continue;
          
          // Split by tabs or multiple spaces, filter out the final total (Σ column)
          const values = letterMatch[2].split(/\s+/).slice(0, -1); // Remove last element (row total)
          
          if (values.length > 0) {
            hintsData[letter] = {};
            values.forEach((value, idx) => {
              const count = value === '-' ? 0 : parseInt(value, 10);
              if (!isNaN(count) && count > 0) {
                const length = 4 + idx; // columns start at 4 letters
                hintsData[letter][length] = count;
                totalWords += count;
              }
            });
          }
        }
      }

      if (Object.keys(hintsData).length === 0) {
        return null; // don't fabricate data; signal parse failure
      }

      return { hintsData, totalWords, pangrams, allowedLetters };
    } catch (error) {
      console.error("Error parsing hints data:", error);
      return null;
    }
  };

  // Function to separate combined text into hints and two-letter data
  const separateContent = (text: string): { hintsText: string; twoLetterText: string } => {
    const lines = text.split('\n').map(line => line.trim());
    const hintsLines: string[] = [];
    const twoLetterLines: string[] = [];
    
    for (const line of lines) {
      // Check if line looks like allowed letters (first line with space-separated letters)
      if (/^[a-z]\s+[a-z]/.test(line)) {
        hintsLines.push(line);
      }
      // Check if line looks like a hints table row (starts with letter followed by colon)
      else if (/^[a-z]:\s*[\d\-\s]+$/i.test(line) || /PANGRAMS?:\s*\d+/i.test(line) || /WORDS:\s*\d+/i.test(line) || /^\d+\s+\d+/.test(line)) {
        hintsLines.push(line);
      }
      // Check if line contains two-letter patterns
      else if (/([A-Z]{2})[:\s\-]+\d+/i.test(line) || /^[A-Z]{2}(\s+[A-Z]{2})*$/i.test(line)) {
        twoLetterLines.push(line);
      }
      // If it's not empty and doesn't match either pattern, add to hints as fallback
      else if (line.length > 0) {
        hintsLines.push(line);
      }
    }
    
    return {
      hintsText: hintsLines.join('\n'),
      twoLetterText: twoLetterLines.join('\n')
    };
  };

  const parseHints = async () => {
    if (!combinedText.trim()) {
      toast({
        title: "Text Required", 
        description: "Please paste the hints table and optional two-letter data.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { hintsText, twoLetterText } = separateContent(combinedText.trim());
      const parsed = parseHintsFromContent(hintsText);
      const twoLetterList = parseTwoLetterList(twoLetterText);

      if (!parsed) {
        toast({
          title: "Could not parse hints",
          description: "We couldn't find a recognizable hints grid in the pasted text. Make sure it includes letter rows with word counts.",
          variant: "destructive",
        });
        return;
      }

      onHintsLoaded(parsed.hintsData, parsed.totalWords, twoLetterList, parsed.pangrams, parsed.allowedLetters);
      setLastFetched(new Date().toLocaleString());
      toast({
        title: "Hints Loaded!",
        description: `Loaded ${parsed.totalWords} total words${twoLetterList.length > 0 ? ` and ${twoLetterList.length} two-letter combos` : ''} from the pasted text.`,
      });
    } catch (error) {
      console.error("Error parsing hints:", error);
      toast({
        title: "Error Loading Hints",
        description: "Could not parse hints data. Please check the format and try again.",
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
          Paste the hints table from the NYT Spelling Bee forum page
        </p>
      </div>

      <div className="space-y-4">
        {/* Image Upload for Screenshots */}
  <HintsImageUpload onHintsLoaded={onHintsLoaded} />
  
  {/* Divider */}
  <div className="relative">
    <div className="absolute inset-0 flex items-center">
      <div className="w-full border-t border-slate-600"></div>
    </div>
    <div className="relative flex justify-center text-sm">
      <span className="px-2 bg-slate-800 text-slate-400">or paste text manually</span>
    </div>
  </div>

  <div>
    <label className="block text-sm font-medium text-slate-200 mb-2">
      Combined Hints & Two-Letter Data
    </label>

        <Button
          onClick={parseHints}
          disabled={isLoading || !combinedText.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
              Parsing Hints...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Parse Hints Data
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
