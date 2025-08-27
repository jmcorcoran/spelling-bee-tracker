import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Globe, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface HintsData {
  [letter: string]: {
    [length: number]: number;
  };
}

interface HintsFetcherProps {
  onHintsLoaded: (hintsData: HintsData, totalWords: number) => void;
}

const HintsFetcher = ({ onHintsLoaded }: HintsFetcherProps) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const { toast } = useToast();

  // Parse hints data from page text (expects rows like "A 3 2 1 ...")
  const parseHintsFromContent = (
    content: string
  ): { hintsData: HintsData; totalWords: number } | null => {
    try {
      const hintsData: HintsData = {};
      let totalWords = 0;

      const lines = content.split("\n").map((l) => l.trim());

      for (const raw of lines) {
        const line = raw.replace(/\u00A0/g, " ").toUpperCase();
        // Match: single letter then a series of numbers (separated by spaces, commas, pipes, etc.)
        const letterMatch = line.match(/^([A-Z])[:\s|\-]+([0-9\s,|/]+)/i);
        if (letterMatch) {
          const letter = letterMatch[1].toUpperCase();
          const numbers = (letterMatch[2].match(/\d+/g) || []).map(Number);
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

      if (Object.keys(hintsData).length === 0) {
        return null; // don't fabricate data; signal parse failure
      }

      return { hintsData, totalWords };
    } catch (error) {
      console.error("Error parsing hints data:", error);
      return null;
    }
  };

  // CORS-safe fetch via Jina AI Reader proxy
  const fetchTextViaProxy = async (rawUrl: string): Promise<string> => {
    const proxied = 'https://r.jina.ai/http://' + rawUrl.replace(/^https?:\/\//, '');
    const res = await fetch(proxied, { headers: { Accept: 'text/plain' } });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    return await res.text();
  };

  // If user pastes a NYTimes forum URL with a date, derive the matching nytbee.com date page
  const deriveNytbeeUrl = (nytimesUrl: string): string | null => {
    const m = nytimesUrl.match(/nytimes\.com\/(\d{4})\/(\d{2})\/(\d{2})\/crosswords\/spelling-bee-forum/i);
    if (!m) return null;
    const [, y, mm, dd] = m;
    return `https://nytbee.com/${y}/${mm}/${dd}`;
  };
  const fetchHints = async () => {
    if (!url.trim()) {
      toast({
        title: "URL Required",
        description: "Please enter the URL for today's hints page.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const inputUrl = url.trim();
      const candidates: string[] = [];

      const derived = deriveNytbeeUrl(inputUrl);
      if (derived) candidates.push(derived);
      candidates.push(inputUrl);

      let parsed: { hintsData: HintsData; totalWords: number } | null = null;
      let sourceUsed = "";

      for (const src of candidates) {
        try {
          const text = await fetchTextViaProxy(src);
          parsed = parseHintsFromContent(text);
          if (parsed) {
            sourceUsed = src;
            break;
          }
        } catch (e) {
          console.warn("Fetch/parse failed for", src, e);
        }
      }

      if (!parsed) {
        toast({
          title: "Could not parse hints",
          description:
            "We couldn't find a recognizable hints grid on that page. Try a nytbee.com daily page for full counts.",
          variant: "destructive",
        });
        return;
      }

      onHintsLoaded(parsed.hintsData, parsed.totalWords);
      setLastFetched(new Date().toLocaleString());
      toast({
        title: "Hints Loaded!",
        description: `Loaded ${parsed.totalWords} total words from ${sourceUsed.includes("nytbee.com") ? "nytbee.com" : "the provided URL"}.`,
      });
    } catch (error) {
      console.error("Error fetching hints:", error);
      toast({
        title: "Error Loading Hints",
        description: "Could not fetch hints data. Please check the URL and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  const loadTodaysHints = () => {
    // Generate today's likely URL pattern
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    // Common patterns for hints pages
    const possibleUrl = `https://nytbee.com/${year}/${month}/${day}`;
    setUrl(possibleUrl);
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-honeycomb/5 to-wax/30 border-honeycomb/20">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
          <Globe className="h-6 w-6 text-honeycomb" />
          Load Hints Data
        </h2>
        <p className="text-muted-foreground">
          Enter the URL for today's NYT Spelling Bee hints page
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="https://nytbee.com/2024/01/15 or similar hints page URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1"
          />
          <Button
            variant="outline"
            onClick={loadTodaysHints}
            className="border-honeycomb/50 hover:bg-honeycomb/10"
          >
            Today
          </Button>
        </div>

        <Button
          onClick={fetchHints}
          disabled={isLoading || !url.trim()}
          className="w-full bg-honeycomb hover:bg-honeycomb-dark text-foreground"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-foreground border-t-transparent mr-2"></div>
              Loading Hints...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Load Hints Data
            </>
          )}
        </Button>

        {lastFetched && (
          <div className="flex items-center gap-2 p-3 bg-honeycomb/10 rounded-lg border border-honeycomb/20">
            <CheckCircle className="h-4 w-4 text-honeycomb-dark" />
            <span className="text-sm text-foreground">
              Last updated: {lastFetched}
            </span>
          </div>
        )}

        <div className="p-3 bg-muted/50 rounded-lg border border-border/50">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">Supported Hints Pages:</p>
              <ul className="text-xs space-y-1">
                <li>• nytbee.com daily pages</li>
                <li>• sbhints.com pages</li>
                <li>• Any page with structured hints data</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default HintsFetcher;