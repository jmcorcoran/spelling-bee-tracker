import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface HintsData {
  [letter: string]: {
    [length: number]: number;
  };
}

interface HintsFetcherProps {
  onHintsLoaded: (hintsData: HintsData, totalWords: number, twoLetterList: { combo: string; count: number }[]) => void;
}

const HintsFetcher = ({ onHintsLoaded }: HintsFetcherProps) => {
  const [hintsText, setHintsText] = useState('');
  const [twoLetterText, setTwoLetterText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const { toast } = useToast();

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

      const lines = content.split("\n").map((l) => l.trim());
      
      console.log('Parsing hints from lines:', lines); // Debug log

      for (const raw of lines) {
        const line = raw.replace(/\u00A0/g, " ").toUpperCase();
        // Match: single letter then a series of numbers (separated by spaces, commas, pipes, etc.)
        const letterMatch = line.match(/^([A-Z])[:\s|\-]+([0-9\s,|/]+)/i);
        if (letterMatch) {
          const letter = letterMatch[1].toUpperCase();
          const numbers = (letterMatch[2].match(/\d+/g) || []).map(Number);
          console.log(`Letter ${letter} found numbers:`, numbers); // Debug log
          
          if (numbers.length) {
            hintsData[letter] = {};
            numbers.forEach((count, idx) => {
              const length = 4 + idx; // columns usually start at 4 letters
              if (count > 0) {
                hintsData[letter][length] = count;
                totalWords += count;
              }
            });
          }
        }
      }
      
      console.log('Final hints data:', hintsData); // Debug log
      console.log('Total words calculated:', totalWords); // Debug log

      if (Object.keys(hintsData).length === 0) {
        return null; // don't fabricate data; signal parse failure
      }

      return { hintsData, totalWords };
    } catch (error) {
      console.error("Error parsing hints data:", error);
      return null;
    }
  };

  const parseHints = async () => {
    if (!hintsText.trim()) {
      toast({
        title: "Text Required",
        description: "Please paste the hints table text.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const parsed = parseHintsFromContent(hintsText.trim());
      const twoLetterList = parseTwoLetterList(twoLetterText.trim());

      if (!parsed) {
        toast({
          title: "Could not parse hints",
          description: "We couldn't find a recognizable hints grid in the pasted text. Make sure it includes letter rows with word counts.",
          variant: "destructive",
        });
        return;
      }

      onHintsLoaded(parsed.hintsData, parsed.totalWords, twoLetterList);
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
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Main Hints Table (4+ letters)
            </label>
            <Textarea
              placeholder="Paste main hints table here (e.g., A 3 2 1...)"
              value={hintsText}
              onChange={(e) => setHintsText(e.target.value)}
              className="min-h-[120px] font-mono text-sm bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-400"
              rows={6}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Two Letter List (optional)
            </label>
            <Textarea
              placeholder="Paste 2-letter word list here (e.g., AL: 2, AN: 4, AV: 2 or AL 2 AN 4 AV 2)"
              value={twoLetterText}
              onChange={(e) => setTwoLetterText(e.target.value)}
              className="min-h-[120px] font-mono text-sm bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-400"
              rows={6}
            />
          </div>
        </div>

        <Button
          onClick={parseHints}
          disabled={isLoading || !hintsText.trim()}
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