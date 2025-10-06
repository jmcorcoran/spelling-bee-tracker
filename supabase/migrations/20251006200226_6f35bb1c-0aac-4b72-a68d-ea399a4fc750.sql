-- Create game sessions table to store spelling bee game state
CREATE TABLE public.game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  allowed_letters TEXT NOT NULL,
  target_words INTEGER NOT NULL DEFAULT 0,
  target_points INTEGER NOT NULL DEFAULT 0,
  target_pangrams INTEGER NOT NULL DEFAULT 0,
  two_letter_list JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create found words table to track user progress
CREATE TABLE public.found_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.game_sessions(id) ON DELETE CASCADE NOT NULL,
  word TEXT NOT NULL,
  is_valid BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(session_id, word)
);

-- Enable RLS
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.found_words ENABLE ROW LEVEL SECURITY;

-- Policies for game_sessions (allow anonymous users to manage their own sessions)
CREATE POLICY "Users can view their own sessions"
  ON public.game_sessions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own sessions"
  ON public.game_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own sessions"
  ON public.game_sessions FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own sessions"
  ON public.game_sessions FOR DELETE
  USING (user_id = auth.uid());

-- Policies for found_words
CREATE POLICY "Users can view words from their sessions"
  ON public.found_words FOR SELECT
  USING (session_id IN (
    SELECT id FROM public.game_sessions WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can add words to their sessions"
  ON public.found_words FOR INSERT
  WITH CHECK (session_id IN (
    SELECT id FROM public.game_sessions WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete words from their sessions"
  ON public.found_words FOR DELETE
  USING (session_id IN (
    SELECT id FROM public.game_sessions WHERE user_id = auth.uid()
  ));

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_game_sessions_updated_at
  BEFORE UPDATE ON public.game_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();