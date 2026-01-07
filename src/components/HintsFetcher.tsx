import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Download, AlertCircle, CheckCircle, Link as LinkIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
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
      } else {
        const words = line.split(/[\s,;|]+/)
          .map(word => word.replace(/[^A-Za-z]/g, '').toUpperCase())
          .filter(word => word.length === 2 && /^[A-Z]+$/.test(word));
        
        words.forEach(combo => {
          if (!results.find(r => r.combo === combo)) {
            results.push({ combo, count: 0 });
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

  const fetchFromUrl = async () => {
    if (!url.trim()) {
      toast({
        title: "URL Required",
        description: "Please enter the NYT Spelling Bee forum URL.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Use a CORS proxy to fetch the page
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }

      const html = await response.text();
      
      // Parse HTML to extract hints table
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Try to find the hints table - adjust selectors based on actual page structure
      let hintsText = '';
      
      // Look for pre-formatted text or code blocks that might contain the hints
      const preElements = doc.querySelectorAll('pre, code, .highlight, .code-block');
      for (const pre of preElements) {
        const text = pre.textContent || '';
        if (text.includes(':') && /[a-z]:\s*[\d-]/.test(text)) {
          hintsText = text;
          break;
        }
      }
      
      // If not found in pre/code, look in paragraphs or divs
      if (!hintsText) {
        const textElements = doc.querySelectorAll('p, div, article');
        for (const elem of textElements) {
          const text = elem.textContent || '';
          if (text.includes(':') && /[a-z]:\s*[\d-]/.test(text) && text.length > 50) {
            hintsText = text;
            break;
          }
        }
      }

      if (!hintsText) {
        toast({
          title: "Could not find hints",
          description: "Unable to locate the hints table on this page. Try copying and pasting instead.",
          variant: "destructive",
        });
        return;
      }

      // Process the extracted text
      const { hintsText: processedHints, twoLetterText } = separateContent(hintsText);
      const parsed = parseHintsFromContent(processedHints);
      const twoLetterList = parseTwoLetterList(twoLetterText);

      if (!parsed) {
        toast({
          title: "Could not parse hints",
          description: "The page structure might have changed. Try copying and pasting instead.",
          variant: "destructive",
        });
        return;
      }

      onHintsLoaded(parsed.hintsData, parsed.totalWords, twoLetterList, parsed.pangrams, parsed.allowedLetters);
      setLastFetched(new Date().toLocaleString());
      toast({
        title: "Hints Loaded!",
        description: `Loaded ${parsed.totalWords} total words${twoLetterList.length > 0 ? ` and ${twoLetterList.length} two-letter combos` : ''} from URL.`,
      });
    } catch (error) {
      console.error("Error fetching from URL:", error);
      toast({
        title: "Error Loading URL",
        description: "Could not fetch the page. The site might block requests or the URL is invalid.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
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
          Load hints from a URL or paste the text directly
        </p>
      </div>

      <Tabs defaultValue="url" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-slate-700/50">
          <TabsTrigger value="url" className="data-[state=active]:bg-slate-600">
            <LinkIcon className="h-4 w-4 mr-2" />
            From URL
          </TabsTrigger>
          <TabsTrigger value="paste" className="data-[state=active]:bg-slate-600">
            <FileText className="h-4 w-4 mr-2" />
            Paste Text
          </TabsTrigger>
        </TabsList>

        <TabsContent value="url" className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              NYT Forum URL
            </label>
            <Input
              placeholder="https://www.nytimes.com/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-400"
            />
          </div>

          <Button
            onClick={fetchFromUrl}
            disabled={isLoading || !url.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                Fetching from URL...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Load from URL
              </>
            )}
          </Button>
        </TabsContent>

        <TabsContent value="paste" className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Combined Hints & Two-Letter Data
            </label>
            <Textarea
              placeholder="Paste both hints table and two-letter data here..."
              value={combinedText}
              onChange={(e) => setCombinedText(e.target.value)}
              className="min-h-[200px] font-mono text-sm bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-400"
              rows={10}
            />
          </div>

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
        </TabsContent>
      </Tabs>

      {lastFetched && (
        <div className="flex items-center gap-2 p-3 bg-blue-900/30 rounded-lg border border-blue-700/50 mt-4">
          <CheckCircle className="h-4 w-4 text-blue-400" />
          <span className="text-sm text-slate-200">
            Last updated: {lastFetched}
          </span>
        </div>
      )}

      <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600/50 mt-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-slate-400 mt-0.5" />
          <div className="text-sm text-slate-300">
            <p className="font-medium mb-1">Tips:</p>
            <ul className="text-xs space-y-1 text-slate-400">
              <li>• URL method works with NYT forum pages that have hints</li>
              <li>• If URL doesn't work, copy/paste the hints table directly</li>
              <li>• Include both the letter grid and two-letter combos if available</li>
            </ul>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default HintsFetcher;
