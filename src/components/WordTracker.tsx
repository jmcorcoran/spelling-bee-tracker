import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RotateCcw, Target } from 'lucide-react';
import HintsGrid from './HintsGrid';
import ImageUpload from './ImageUpload';

// Sample data representing a typical spelling bee puzzle
const SAMPLE_PUZZLE_DATA = {
  centerLetter: 'E',
  outerLetters: ['B', 'H', 'L', 'N', 'O', 'W'],
  allWords: [
    // 4 letters
    'BOWL', 'BLOW', 'BONE', 'HONE', 'HOLE', 'WELL', 'BELL', 'BOON',
    'HEEL', 'BEEN', 'BELOW', 'WHEN', 'WHEEL', 'WHERE',
    // 5 letters  
    'HELLO', 'BELOW', 'WHEEL', 'ELBOW', 'WHOLE', 'NOBLE',
    // 6 letters
    'HOLLOW', 'BELLOW', 'ENHOW', 'BEEHOL',
    // 7+ letters
    'BELLHOP', 'LOWBELLOW', 'HONEYBEE'
  ]
};

interface HintsData {
  [letter: string]: {
    [length: number]: number;
  };
}

const WordTracker = () => {
  const [foundWords, setFoundWords] = useState<Set<string>>(new Set());
  const [totalPossibleWords] = useState(SAMPLE_PUZZLE_DATA.allWords.length);

  const hintsData: HintsData = useMemo(() => {
    const data: HintsData = {};
    
    SAMPLE_PUZZLE_DATA.allWords.forEach(word => {
      if (foundWords.has(word)) return; // Skip found words
      
      const firstLetter = word[0];
      const length = word.length;
      
      if (!data[firstLetter]) {
        data[firstLetter] = {};
      }
      
      data[firstLetter][length] = (data[firstLetter][length] || 0) + 1;
    });
    
    return data;
  }, [foundWords]);

  const handleWordsFound = (newWords: string[]) => {
    const validWords = newWords.filter(word => 
      SAMPLE_PUZZLE_DATA.allWords.includes(word.toUpperCase())
    );
    
    setFoundWords(prev => {
      const updated = new Set(prev);
      validWords.forEach(word => updated.add(word.toUpperCase()));
      return updated;
    });
  };

  const resetProgress = () => {
    setFoundWords(new Set());
  };

  const progressPercentage = Math.round((foundWords.size / totalPossibleWords) * 100);

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
            Upload images of words you've found to track your progress
          </p>
          
          {/* Progress Stats */}
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
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Image Upload */}
          <div>
            <ImageUpload onWordsExtracted={handleWordsFound} />
            
            {foundWords.size > 0 && (
              <Card className="mt-6 p-4 bg-background border-honeycomb/20">
                <h3 className="font-semibold text-foreground mb-3">Found Words ({foundWords.size})</h3>
                <div className="flex flex-wrap gap-2">
                  {Array.from(foundWords).map(word => (
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

          {/* Hints Grid */}
          <div>
            <HintsGrid hintsData={hintsData} foundWords={foundWords} />
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
      </div>
    </div>
  );
};

export default WordTracker;