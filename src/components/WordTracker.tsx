import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RotateCcw, Target, Plus } from 'lucide-react';
import HintsGrid from './HintsGrid';
import ImageUpload from './ImageUpload';
import HintsFetcher from './HintsFetcher';

interface HintsData {
  [letter: string]: {
    [length: number]: number;
  };
}

const WordTracker = () => {
  const [foundWords, setFoundWords] = useState<Set<string>>(new Set());
  const [hintsData, setHintsData] = useState<HintsData>({});
  const [totalPossibleWords, setTotalPossibleWords] = useState(0);
  const [hasLoadedHints, setHasLoadedHints] = useState(false);
  const [manualWord, setManualWord] = useState('');

  const remainingHintsData: HintsData = useMemo(() => {
    const remaining: HintsData = {};
    
    Object.entries(hintsData).forEach(([letter, lengthData]) => {
      Object.entries(lengthData).forEach(([length, count]) => {
        // For now, we'll just reduce counts based on found words
        // In a real implementation, you'd match actual words to their letters/lengths
        const foundWordsForLetterLength = Array.from(foundWords).filter(word => 
          word.startsWith(letter) && word.length === parseInt(length)
        ).length;
        
        const remainingCount = Math.max(0, count - foundWordsForLetterLength);
        
        if (remainingCount > 0) {
          if (!remaining[letter]) remaining[letter] = {};
          remaining[letter][parseInt(length)] = remainingCount;
        }
      });
    });
    
    return remaining;
  }, [hintsData, foundWords]);

  const handleHintsLoaded = (newHintsData: HintsData, totalWords: number) => {
    setHintsData(newHintsData);
    setTotalPossibleWords(totalWords);
    setHasLoadedHints(true);
    setFoundWords(new Set()); // Reset found words when loading new hints
  };

  const handleWordsFound = (newWords: string[]) => {
    setFoundWords(prev => {
      const updated = new Set(prev);
      newWords.forEach(word => updated.add(word.toUpperCase()));
      return updated;
    });
  };

  const addManualWord = () => {
    if (manualWord.trim()) {
      handleWordsFound([manualWord.trim()]);
      setManualWord('');
    }
  };

  const handleManualWordKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addManualWord();
    }
  };

  const resetProgress = () => {
    setFoundWords(new Set());
  };

  const progressPercentage = totalPossibleWords > 0 
    ? Math.round((foundWords.size / totalPossibleWords) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-wax/20 to-honeycomb/10">
      <div className="container max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="p-3 rounded-full bg-gradient-to-br from-honeycomb to-pollen">
              <Target className="h-6 w-6 text-foreground" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-honeycomb-dark bg-clip-text text-transparent">
              Spelling Bee Tracker
            </h1>
          </div>
          <p className="text-lg text-muted-foreground mb-6">
            Load today's hints and track your progress with image uploads
          </p>
          
          {hasLoadedHints && (
            <Card className="inline-flex items-center gap-6 p-4 bg-gradient-to-r from-honeycomb/10 to-pollen/10 border-honeycomb/30">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">{foundWords.size}</div>
                <div className="text-sm text-muted-foreground">Words Found</div>
              </div>
              <div className="h-8 w-px bg-border"></div>
              <div className="text-center">
                <div className="text-2xl font-bold text-muted-foreground">{totalPossibleWords - foundWords.size}</div>
                <div className="text-sm text-muted-foreground">Remaining</div>
              </div>
              <div className="h-8 w-px bg-border"></div>
              <div className="text-center">
                <div className="text-2xl font-bold text-honeycomb-dark">{progressPercentage}%</div>
                <div className="text-sm text-muted-foreground">Complete</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={resetProgress}
                className="ml-4 border-honeycomb/50 hover:bg-honeycomb/10"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </Card>
          )}
        </div>

        {/* Hints Fetcher - Show this first if no hints loaded */}
        {!hasLoadedHints && (
          <div className="mb-8">
            <HintsFetcher onHintsLoaded={handleHintsLoaded} />
          </div>
        )}

        {/* Main Content Grid */}
        {hasLoadedHints && (
          <>
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Image Upload */}
              <div>
                <ImageUpload onWordsExtracted={handleWordsFound} />
              </div>

              {/* Hints Grid */}
              <div>
                <HintsGrid hintsData={remainingHintsData} foundWords={foundWords} />
                
                {/* Option to reload hints */}
                <Card className="mt-6 p-4 bg-muted/30 border-border/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-foreground">Hints Data</h3>
                      <p className="text-sm text-muted-foreground">
                        Loaded {totalPossibleWords} total words
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHasLoadedHints(false)}
                      className="border-honeycomb/50 hover:bg-honeycomb/10"
                    >
                      Load Different Hints
                    </Button>
                  </div>
                </Card>

                {/* Manual Word Input */}
                <Card className="mt-6 p-4 bg-background border-honeycomb/20">
                  <h3 className="font-semibold text-foreground mb-3">Add Word Manually</h3>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Enter a word you found..."
                      value={manualWord}
                      onChange={(e) => setManualWord(e.target.value)}
                      onKeyPress={handleManualWordKeyPress}
                      className="flex-1 border-honeycomb/30 focus:border-honeycomb/50"
                    />
                    <Button
                      onClick={addManualWord}
                      size="sm"
                      className="bg-honeycomb hover:bg-honeycomb-dark text-foreground"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>

                {/* Found Words Display */}
                {foundWords.size > 0 && (
                  <Card className="mt-6 p-4 bg-background border-honeycomb/20">
                    <h3 className="font-semibold text-foreground mb-3">Found Words ({foundWords.size})</h3>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(foundWords).sort().map(word => (
                        <Badge 
                          key={word} 
                          variant="secondary"
                          className="bg-honeycomb/20 text-foreground hover:bg-honeycomb/30"
                        >
                          {word}
                        </Badge>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <Card className="mt-8 p-6 bg-gradient-to-r from-background to-wax/30 border-honeycomb/20">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-foreground">Overall Progress</h3>
                <span className="text-sm text-muted-foreground">{foundWords.size} of {totalPossibleWords} words</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-honeycomb to-pollen h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default WordTracker;