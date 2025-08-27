import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Target, Plus, X, RotateCcw } from 'lucide-react';
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
  const [twoLetterList, setTwoLetterList] = useState<{ combo: string; count: number }[]>([]);

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

  // Calculate remaining counts for two-letter combos
  const remainingTwoLetterCounts = useMemo(() => {
    return twoLetterList.map(({ combo, count }) => {
      const foundWordsWithCombo = Array.from(foundWords).filter(word =>
        word.length >= 2 && word.substring(0, 2) === combo
      ).length;
      
      return {
        combo,
        originalCount: count,
        remainingCount: Math.max(0, count - foundWordsWithCombo)
      };
    });
  }, [twoLetterList, foundWords]);

  const handleHintsLoaded = (newHintsData: HintsData, totalWords: number, newTwoLetterList: { combo: string; count: number }[]) => {
    setHintsData(newHintsData);
    setTotalPossibleWords(totalWords);
    setTwoLetterList(newTwoLetterList);
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
    setHintsData({});
    setTotalPossibleWords(0);
    setTwoLetterList([]);
    setHasLoadedHints(false);
  };

  const removeWord = (wordToRemove: string) => {
    setFoundWords(prev => {
      const updated = new Set(prev);
      updated.delete(wordToRemove);
      return updated;
    });
  };

  const progressPercentage = totalPossibleWords > 0 
    ? Math.round((foundWords.size / totalPossibleWords) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      <div className="container max-w-4xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6 sm:mb-8 text-center">
          <div className="inline-flex items-center gap-2 sm:gap-3 mb-4">
            <div className="p-2 sm:p-3 rounded-full bg-gradient-to-br from-blue-600 to-purple-600">
              <Target className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-white to-blue-300 bg-clip-text text-transparent">
              Spelling Bee Tracker
            </h1>
          </div>
          <p className="text-sm sm:text-lg text-slate-300 mb-4 sm:mb-6 px-4">
            Load today's hints and track your progress with image uploads
          </p>
          
          {hasLoadedHints && (
            <Card className="inline-flex items-center gap-3 sm:gap-6 p-3 sm:p-4 bg-slate-800/80 border-slate-700/50 backdrop-blur-sm mx-4 sm:mx-0">
              <div className="text-center">
                <div className="text-lg sm:text-2xl font-bold text-white">{foundWords.size}</div>
                <div className="text-xs sm:text-sm text-slate-400">Words Found</div>
              </div>
              <div className="h-6 sm:h-8 w-px bg-slate-600"></div>
              <div className="text-center">
                <div className="text-lg sm:text-2xl font-bold text-slate-300">{totalPossibleWords - foundWords.size}</div>
                <div className="text-xs sm:text-sm text-slate-400">Remaining</div>
              </div>
              <div className="h-6 sm:h-8 w-px bg-slate-600"></div>
              <div className="text-center">
                <div className="text-lg sm:text-2xl font-bold text-blue-400">{progressPercentage}%</div>
                <div className="text-xs sm:text-sm text-slate-400">Complete</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={resetProgress}
                className="ml-2 sm:ml-4 border-slate-600 bg-slate-700 text-slate-200 hover:bg-slate-600 hover:border-slate-500 text-xs sm:text-sm"
              >
                <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Reset
              </Button>
            </Card>
          )}
        </div>

        {/* Hints Fetcher - Show this first if no hints loaded */}
        {!hasLoadedHints && (
          <div className="mb-6 sm:mb-8">
            <HintsFetcher onHintsLoaded={handleHintsLoaded} />
          </div>
        )}

        {/* Main Content */}
        {hasLoadedHints && (
          <>
            {/* Image Upload - Compact version above table */}
            <div className="mb-4 sm:mb-6">
              <ImageUpload onWordsExtracted={handleWordsFound} />
            </div>

            <div className="space-y-6">
              {/* Hints Grid */}
              <div>
                <HintsGrid hintsData={remainingHintsData} foundWords={foundWords} />

                {/* Two Letter List */}
                {twoLetterList.length > 0 && (
                  <Card className="mt-4 sm:mt-6 p-3 sm:p-4 bg-slate-800/60 border-slate-700/50">
                    <h3 className="font-semibold text-white mb-3 text-sm sm:text-base">
                      Two Letter Combos ({remainingTwoLetterCounts.reduce((sum, item) => sum + item.remainingCount, 0)} remaining)
                    </h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                      {remainingTwoLetterCounts.map(({ combo, originalCount, remainingCount }, index) => (
                        <div 
                          key={index} 
                          className={`bg-slate-700/60 text-slate-200 px-2 py-1 rounded text-center text-xs sm:text-sm border border-slate-600/50 ${
                            remainingCount === 0 ? 'opacity-50 line-through' : ''
                          }`}
                        >
                          <div className="font-mono font-semibold">{combo}</div>
                          {originalCount > 0 && (
                            <div className="text-xs text-slate-400">
                              {remainingCount}/{originalCount}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Manual Word Input */}
                <Card className="mt-4 sm:mt-6 p-3 sm:p-4 bg-slate-800/60 border-slate-700/50">
                  <h3 className="font-semibold text-white mb-3 text-sm sm:text-base">Add Word Manually</h3>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Enter a word you found..."
                      value={manualWord}
                      onChange={(e) => setManualWord(e.target.value)}
                      onKeyPress={handleManualWordKeyPress}
                      className="flex-1 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-blue-500 text-sm sm:text-base"
                    />
                    <Button
                      onClick={addManualWord}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                  </div>
                </Card>

                {/* Found Words Display */}
                {foundWords.size > 0 && (
                  <Card className="mt-4 sm:mt-6 p-3 sm:p-4 bg-slate-800/60 border-slate-700/50">
                    <h3 className="font-semibold text-white mb-3 text-sm sm:text-base">Found Words ({foundWords.size})</h3>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(foundWords).sort().map(word => (
                        <div 
                          key={word} 
                          className="flex items-center gap-1 bg-slate-700/60 text-slate-200 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm border border-slate-600/50"
                        >
                          <span>{word}</span>
                          <button
                            onClick={() => removeWord(word)}
                            className="ml-1 p-0.5 hover:bg-red-600/50 rounded-full transition-colors"
                          >
                            <X className="h-2 w-2 sm:h-3 sm:w-3 text-slate-400 hover:text-red-300" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <Card className="mt-6 sm:mt-8 p-4 sm:p-6 bg-slate-800/60 border-slate-700/50">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-white text-sm sm:text-base">Overall Progress</h3>
                <span className="text-xs sm:text-sm text-slate-400">{foundWords.size} of {totalPossibleWords} words</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2 sm:h-3">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 sm:h-3 rounded-full transition-all duration-500 ease-out"
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