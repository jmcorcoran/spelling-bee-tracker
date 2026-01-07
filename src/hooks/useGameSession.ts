import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface HintsData {
  [letter: string]: {
    [length: number]: number;
  };
}

interface GameSessionData {
  sessionId: string | null;
  allowedLetters: string[];
  targetWords: number;
  targetPoints: number;
  targetPangrams: number;
  twoLetterList: { combo: string; count: number }[];
  hintsData: HintsData;
  foundWords: string[];
  invalidWords: string[];
  createdAt: string | null;
}

export const useGameSession = () => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Initialize anonymous session
  useEffect(() => {
    const initSession = async () => {
      try {
        // Check for existing session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          setUserId(session.user.id);
        } else {
          // Sign in anonymously
          const { data, error } = await supabase.auth.signInAnonymously();
          if (error) throw error;
          setUserId(data.user?.id || null);
        }
      } catch (error) {
        console.error('Error initializing session:', error);
        toast({
          title: "Session Error",
          description: "Could not initialize user session. Data won't be saved.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    initSession();
  }, [toast]);

  // Load existing game session
  const loadGameSession = async (): Promise<GameSessionData | null> => {
    if (!userId) return null;

    try {
      // Get the most recent session
      const { data: sessions, error: sessionError } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (sessionError) throw sessionError;

      if (!sessions || sessions.length === 0) {
        return null;
      }

      const session = sessions[0];
      setSessionId(session.id);

      // Load found words
      const { data: words, error: wordsError } = await supabase
        .from('found_words')
        .select('*')
        .eq('session_id', session.id);

      if (wordsError) throw wordsError;

      const validWords = words?.filter(w => w.is_valid).map(w => w.word) || [];
      const invalidWordsData = words?.filter(w => !w.is_valid).map(w => w.word) || [];

      return {
        sessionId: session.id,
        allowedLetters: session.allowed_letters.split('').map((l: string) => l.toUpperCase()),
        targetWords: session.target_words,
        targetPoints: session.target_points,
        targetPangrams: session.target_pangrams,
        twoLetterList: (session.two_letter_list as { combo: string; count: number }[]) || [],
        hintsData: (session.hints_data as HintsData) || {},
        foundWords: validWords,
        invalidWords: invalidWordsData,
        createdAt: session.created_at,
      };
    } catch (error) {
      console.error('Error loading game session:', error);
      return null;
    }
  };

  // Save or update game session
  const saveGameSession = async (
    allowedLetters: string[],
    targetWords: number,
    targetPangrams: number,
    twoLetterList: { combo: string; count: number }[],
    hintsData: HintsData
  ): Promise<string | null> => {
    if (!userId) return null;

    try {
      const sessionData = {
        user_id: userId,
        allowed_letters: allowedLetters.join(''),
        target_words: targetWords,
        target_points: 0, // Not tracking points currently
        target_pangrams: targetPangrams,
        two_letter_list: twoLetterList,
        hints_data: hintsData,
      };

      if (sessionId) {
        // Update existing session
        const { error } = await supabase
          .from('game_sessions')
          .update(sessionData)
          .eq('id', sessionId);

        if (error) throw error;
        return sessionId;
      } else {
        // Create new session
        const { data, error } = await supabase
          .from('game_sessions')
          .insert(sessionData)
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setSessionId(data.id);
          return data.id;
        }
      }
    } catch (error) {
      console.error('Error saving game session:', error);
      toast({
        title: "Save Error",
        description: "Could not save game session",
        variant: "destructive",
      });
    }
    return null;
  };

  // Add found word
  const addFoundWord = async (word: string, isValid: boolean): Promise<void> => {
    if (!sessionId || !userId) return;

    try {
      await supabase
        .from('found_words')
        .insert({
          session_id: sessionId,
          word: word.toUpperCase(),
          is_valid: isValid,
        });
    } catch (error: any) {
      // Ignore duplicate key errors (word already exists)
      if (!error?.message?.includes('duplicate')) {
        console.error('Error adding found word:', error);
      }
    }
  };

  // Remove found word
  const removeFoundWord = async (word: string): Promise<void> => {
    if (!sessionId) return;

    try {
      await supabase
        .from('found_words')
        .delete()
        .eq('session_id', sessionId)
        .eq('word', word.toUpperCase());
    } catch (error) {
      console.error('Error removing found word:', error);
    }
  };

  // Clear all words (for reset)
  const clearAllWords = async (): Promise<void> => {
    if (!sessionId) return;

    try {
      await supabase
        .from('found_words')
        .delete()
        .eq('session_id', sessionId);
    } catch (error) {
      console.error('Error clearing words:', error);
    }
  };

  // Delete session
  const deleteSession = async (): Promise<void> => {
    if (!sessionId) return;

    try {
      await supabase
        .from('game_sessions')
        .delete()
        .eq('id', sessionId);
      
      setSessionId(null);
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  return {
    isLoading,
    userId,
    sessionId,
    loadGameSession,
    saveGameSession,
    addFoundWord,
    removeFoundWord,
    clearAllWords,
    deleteSession,
  };
};
