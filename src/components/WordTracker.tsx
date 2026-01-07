import Auth from './Auth';
import { useState, useMemo, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Target, Plus, X, RotateCcw, RefreshCw } from 'lucide-react';
import HintsGrid from './HintsGrid';
import ImageUpload from './ImageUpload';
import HintsFetcher from './HintsFetcher';
import { useGameSession } from '@/hooks/useGameSession';
import { useToast } from '@/hooks/use-toast';
import { isToday, parseISO } from 'date-fns';
import { calculateTotalPoints } from '@/utils/pointsCalculator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface HintsData {
  [letter: string]: {
    [length: number]: number;
  };
}

const WordTracker = () => {
  const [foundWords, setFoundWords] = useState<Set<string>>(new Set());
  const [invalidWords, setInvalidWords] = useState<Set<string>>(new Set());
  const [foundPangrams, setFoundPangrams] = useState<Set<string>>(new Set());
  const [allowedLetters, setAllowedLetters] = useState<Set<string>>(new Set());
  const [hintsData, setHintsData] = useState<HintsData>({});
  const [totalPossibleWords, setTotalPossibleWords] = useState(0);
  const [hasLoadedHints, setHasLoadedHints] = useState(false);
  const [manualWord, setManualWord] = useState('');
  const [twoLetterList, setTwoLetterList] = useState<{ combo: string; count: number }[]>([]);
  const [pangrams, setPangrams] = useState(0);
  const [showNewDayDialog, setShowNewDayDialog] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);
  
  const { toast } = useToast();
  const {
    isLoading: sessionLoading,
    user,
    loadGameSession,
    saveGameSession,
    addFoundWord,
    removeFoundWord,
    clearAllWords,
    deleteSession,
  } = useGameSession();

  // Load existing session on mount
  useEffect(() => {
    const loadExistingSession = async () => {
      if (sessionLoading) return;

      const sessionData = await loadGameSession();
      if (sessionData) {
        setAllowedLetters(new Set(sessionData.allowedLetters));
        setTotalPossibleWords(sessionData.targetWords);
        setPangrams(sessionData.targetPangrams);
        setTwoLetterList(sessionData.twoLetterList);
        setFoundWords(new Set(sessionData.foundWords));
        setInvalidWords(new Set(sessionData.invalidWords));
        setHintsData(sessionData.hintsData || {});
        
        // Calculate pangrams from found words
        const loadedPangrams = sessionData.foundWords.filter(word => {
          const wordLetters = new Set(word.toUpperCase().split(''));
          return sessionData.allowedLetters.length === 
            sessionData.allowedLetters.filter(letter => wordLetters.has(letter)).length;
        });
        setFoundPangrams(new Set(loadedPangrams));
        
        setHasLoadedHints(sessionData.targetWords > 0 && Object.keys(sessionData.hintsData || {}).length > 0);
        
        // Check if session is from a previous day
        if (sessionData.createdAt) {
          const sessionDate = parseISO(sessionData.createdAt);
          if (!isToday(sessionDate)) {
            setShowNewDayDialog(true);
          }
        }
        
        toast({
          title: "Session Restored",
          description: `Loaded ${sessionData.foundWords.length} words from your previous session`,
        });
      }
    };

    loadExistingSession();
  }, [sessionLoading]);

  // Calculate total points whenever found words or pangrams change
useEffect(() => {
  const points = calculateTotalPoints(Array.from(foundWords), foundPangrams);
  setTotalPoints(points);
}, [foundWords, foundPangrams]);

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

  // Validation function to check if word contains only allowed letters
  const isValidWord = (word: string): boolean => {
    if (allowedLetters.size === 0) return true; // No restrictions set
    const wordLetters = new Set(word.toUpperCase().split(''));
    const isValid = [...wordLetters].every(letter => allowedLetters.has(letter));
  
  // Debug logging
  if (!isValid) {
    const invalidLetters = [...wordLetters].filter(letter => !allowedLetters.has(letter));
    console.log(`Invalid word "${word}": contains letters not in allowed set:`, invalidLetters);
    console.log('Allowed letters:', Array.from(allowedLetters));
  }
  
  return isValid;
};

  // Check if a word is a pangram (uses all allowed letters)
  const isPangram = (word: string): boolean => {
    if (allowedLetters.size === 0) return false; // No letters set
    const wordLetters = new Set(word.toUpperCase().split(''));
    return allowedLetters.size === [...allowedLetters].filter(letter => wordLetters.has(letter)).length;
  };

  const handleHintsLoaded = async (newHintsData: HintsData, totalWords: number, newTwoLetterList: { combo: string; count: number }[], pangramCount: number, allowedLettersList: string[]) => {
    setHintsData(newHintsData);
    setTotalPossibleWords(totalWords);
    setTwoLetterList(newTwoLetterList);
    setPangrams(pangramCount);
    setAllowedLetters(new Set(allowedLettersList));
    setHasLoadedHints(true);
    
    // Clear local state
    setFoundWords(new Set());
    setInvalidWords(new Set());
    setFoundPangrams(new Set());
    
    // Clear database and save new session
    await clearAllWords();
    await saveGameSession(allowedLettersList, totalWords, pangramCount, newTwoLetterList, newHintsData);
  };

  const handleWordsFound = async (newWords: string[]) => {
    const validWords: string[] = [];
    const invalidWordsData: string[] = [];
    const newPangrams: string[] = [];
    
    newWords.forEach(word => {
      const upperWord = word.toUpperCase();
      if (isValidWord(upperWord)) {
        validWords.push(upperWord);
        if (isPangram(upperWord)) {
          newPangrams.push(upperWord);
        }
      } else {
        invalidWordsData.push(upperWord);
      }
    });

    if (validWords.length > 0) {
      setFoundWords(prev => {
        const updated = new Set(prev);
        validWords.forEach(word => {
          if (!prev.has(word)) {
            updated.add(word);
            addFoundWord(word, true); // Save to database
          }
        });
        return updated;
      });
    }

    if (newPangrams.length > 0) {
      setFoundPangrams(prev => {
        const updated = new Set(prev);
        newPangrams.forEach(word => updated.add(word));
        return updated;
      });
    }

    if (invalidWordsData.length > 0) {
      setInvalidWords(prev => {
        const updated = new Set(prev);
        invalidWordsData.forEach(word => {
          if (!prev.has(word)) {
            updated.add(word);
            addFoundWord(word, false); // Save to database as invalid
          }
        });
        return updated;
      });
    }
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

  const resetProgress = async () => {
    setFoundWords(new Set());
    setInvalidWords(new Set());
    setFoundPangrams(new Set());
    setHintsData({});
    setTotalPossibleWords(0);
    setTwoLetterList([]);
    setPangrams(0);
    setHasLoadedHints(false);
    
    // Clear database
    await deleteSession();
  };

  const removeWord = async (wordToRemove: string) => {
    setFoundWords(prev => {
      const updated = new Set(prev);
      updated.delete(wordToRemove);
      return updated;
    });
    setFoundPangrams(prev => {
      const updated = new Set(prev);
      updated.delete(wordToRemove);
      return updated;
    });
    
    // Remove from database
    await removeFoundWord(wordToRemove);
  };

  const removeInvalidWord = async (wordToRemove: string) => {
    setInvalidWords(prev => {
      const updated = new Set(prev);
      updated.delete(wordToRemove);
      return updated;
    });
    
    // Remove from database
    await removeFoundWord(wordToRemove);
  };

  const removeAllValidWords = async () => {
    const wordsToRemove = Array.from(foundWords);
    setFoundWords(new Set());
    setFoundPangrams(new Set());
    
    // Remove from database
    for (const word of wordsToRemove) {
      await removeFoundWord(word);
    }
  };

  const removeAllInvalidWords = async () => {
    const wordsToRemove = Array.from(invalidWords);
    setInvalidWords(new Set());
    
    // Remove from database
    for (const word of wordsToRemove) {
      await removeFoundWord(word);
    }
  };

  const progressPercentage = totalPossibleWords > 0 
    ? Math.round((foundWords.size / totalPossibleWords) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      <AlertDialog open={showNewDayDialog} onOpenChange={setShowNewDayDialog}>
        <AlertDialogContent className="bg-slate-800 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">New Puzzle Available!</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300">
              Your saved session is from a previous day. Would you like to clear it and start today's puzzle?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-700 text-slate-300 hover:bg-slate-600 border-slate-600">
              Keep Old Puzzle
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={resetProgress}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              Start Fresh
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
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

          <div className="mb-4">
            <Auth user={user} onAuthChange={() => window.location.reload()} />
          </div>
          
          <p className="text-sm sm:text-lg text-slate-300 mb-4 sm:mb-6 px-4">
            Load today's hints and track your progress with image uploads
          </p>
          
          {hasLoadedHints && (
            <div className="space-y-4">
              <Card className="inline-flex items-center gap-3 sm:gap-6 p-3 sm:p-4 bg-slate-800/80 border-slate-700/50 backdrop-blur-sm mx-4 sm:mx-0">
                <div className="text-center">
                  <div className="text-lg sm:text-2xl font-bold text-white">{foundWords.size}</div>
                  <div className="text-xs sm:text-sm text-slate-400">Words Found</div>
                </div>
                <div className="h-6 sm:h-8 w-px bg-slate-600"></div>
                <div className="text-center">
                  <div className="text-lg sm:text-2xl font-bold text-slate-300">{totalPoints}</div>
                  <div className="text-xs sm:text-sm text-slate-400">Points</div>
                </div>
                <div className="h-6 sm:h-8 w-px bg-slate-600"></div>
                <div className="text-center">
                  <div className="text-lg sm:text-2xl font-bold text-yellow-400">{foundPangrams.size}/{pangrams}</div>
                  <div className="text-xs sm:text-sm text-slate-400">Pangrams</div>
                </div>
                <div className="h-6 sm:h-8 w-px bg-slate-600"></div>
                <div className="text-center">
                  <div className="text-lg sm:text-2xl font-bold text-blue-400">{progressPercentage}%</div>
                  <div className="text-xs sm:text-sm text-slate-400">Complete</div>
                </div>
              </Card>
              <div className="text-center">
                <Button
                  onClick={resetProgress}
                  variant="outline"
                  size="sm"
                  className="border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:border-slate-500"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Start New Puzzle
                </Button>
              </div>
            </div>
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
                      Two Letter Combos ({twoLetterList.length})
                    </h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                      {remainingTwoLetterCounts.map(({ combo, originalCount, remainingCount }, index) => (
                        <div 
                          key={index} 
                          className={`bg-slate-700/60 text-slate-200 px-2 py-1 rounded text-center text-xs sm:text-sm border border-slate-600/50 ${
                            remainingCount === 0 ? 'opacity-50 line-through' : ''
                          }`}
                        >
                          <div className="font-mono">{combo}</div>
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

                {/* Allowed Letters Display */}
                {allowedLetters.size > 0 && (
                  <Card className="mt-4 sm:mt-6 p-3 sm:p-4 bg-slate-800/60 border-slate-700/50">
                    <h3 className="font-semibold text-white mb-3 text-sm sm:text-base">Allowed Letters</h3>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {Array.from(allowedLetters).sort().map(letter => (
                        <div 
                          key={letter} 
                          className="bg-blue-900/40 text-blue-200 px-3 py-1 rounded-full text-sm border border-blue-600/50"
                        >
                          {letter}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400">
                      Words containing letters outside this set will be marked as invalid.
                    </p>
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
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-white text-sm sm:text-base">Valid Words ({foundWords.size})</h3>
                      <Button
                        onClick={removeAllValidWords}
                        size="sm"
                        variant="outline"
                        className="text-xs border-slate-600 bg-slate-700 text-slate-300 hover:bg-slate-600 hover:border-slate-500"
                      >
                        Remove All
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(foundWords).sort().map(word => {
                        const isWordPangram = foundPangrams.has(word);
                        return (
                          <div 
                            key={word} 
                            className={`flex items-center gap-1 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm border ${
                              isWordPangram 
                                ? 'bg-yellow-900/40 text-yellow-200 border-yellow-600/50' 
                                : 'bg-slate-700/60 text-slate-200 border-slate-600/50'
                            }`}
                          >
                            <span>{word}</span>
                            {isWordPangram && <span className="text-yellow-400 text-xs">★</span>}
                            <button
                              onClick={() => removeWord(word)}
                              className="ml-1 p-0.5 hover:bg-red-600/50 rounded-full transition-colors"
                            >
                              <X className="h-2 w-2 sm:h-3 sm:w-3 text-slate-400 hover:text-red-300" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}

                {/* Invalid Words Display */}
                {invalidWords.size > 0 && (
                  <Card className="mt-4 sm:mt-6 p-3 sm:p-4 bg-red-900/20 border-red-700/50">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-red-300 text-sm sm:text-base">Invalid Words ({invalidWords.size})</h3>
                      <Button
                        onClick={removeAllInvalidWords}
                        size="sm"
                        variant="outline"
                        className="text-xs border-red-600 bg-red-900/40 text-red-300 hover:bg-red-800/40 hover:border-red-500"
                      >
                        Remove All
                      </Button>
                    </div>
                    <p className="text-xs text-red-400 mb-3">These words contain letters not in the allowed set:</p>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(invalidWords).sort().map(word => (
                        <div 
                          key={word} 
                          className="flex items-center gap-1 bg-red-900/40 text-red-200 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm border border-red-600/50"
                        >
                          <span>{word}</span>
                          <button
                            onClick={() => removeInvalidWord(word)}
                            className="ml-1 p-0.5 hover:bg-red-600/50 rounded-full transition-colors"
                          >
                            <X className="h-2 w-2 sm:h-3 sm:w-3 text-red-400 hover:text-red-300" />
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
