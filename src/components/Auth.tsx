import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, LogOut, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AuthProps {
  user: any;
  onAuthChange: () => void;
}

const Auth = ({ user, onAuthChange }: AuthProps) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const { toast } = useToast();

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/spelling-bee-tracker/`,
        },
      });

      if (error) throw error;

      setLinkSent(true);
      toast({
        title: "Magic Link Sent!",
        description: "Check your email for the login link.",
      });
    } catch (error: any) {
      console.error('Magic link error:', error);
      toast({
        title: "Error",
        description: error.message || "Could not send magic link. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      onAuthChange();
      toast({
        title: "Signed Out",
        description: "You've been signed out successfully.",
      });
    } catch (error: any) {
      console.error('Sign out error:', error);
      toast({
        title: "Error",
        description: "Could not sign out. Please try again.",
        variant: "destructive",
      });
    }
  };

  // If user is logged in, show their email and sign out button
  if (user && user.email) {
    return (
      <Card className="p-4 bg-slate-800/60 border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-blue-600/20">
              <Mail className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">{user.email}</p>
              <p className="text-xs text-slate-400">Synced across devices</p>
            </div>
          </div>
          <Button
            onClick={handleSignOut}
            variant="outline"
            size="sm"
            className="border-slate-600 bg-slate-700 text-slate-300 hover:bg-slate-600"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </Card>
    );
  }

  // If link was sent, show confirmation
  if (linkSent) {
    return (
      <Card className="p-6 bg-slate-800/60 border-slate-700/50">
        <div className="text-center">
          <div className="inline-flex p-3 rounded-full bg-green-600/20 mb-4">
            <CheckCircle className="h-8 w-8 text-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Check Your Email</h3>
          <p className="text-slate-300 mb-4">
            We sent a magic link to <strong>{email}</strong>
          </p>
          <p className="text-sm text-slate-400 mb-4">
            Click the link in your email to sign in. You can close this page.
          </p>
          <Button
            onClick={() => {
              setLinkSent(false);
              setEmail('');
            }}
            variant="outline"
            size="sm"
            className="border-slate-600 bg-slate-700 text-slate-300 hover:bg-slate-600"
          >
            Try Different Email
          </Button>
        </div>
      </Card>
    );
  }

  // Show login form
  return (
    <Card className="p-6 bg-slate-800/60 border-slate-700/50">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white mb-2">Sign In to Sync</h3>
        <p className="text-sm text-slate-300">
          Access your progress from any device with a magic link
        </p>
      </div>

      <form onSubmit={handleMagicLink} className="space-y-4">
        <div>
          <Input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-400"
            disabled={isLoading}
          />
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
              Sending Magic Link...
            </>
          ) : (
            <>
              <Mail className="h-4 w-4 mr-2" />
              Send Magic Link
            </>
          )}
        </Button>

        <p className="text-xs text-slate-400 text-center">
          No password needed. We'll email you a secure login link.
        </p>
      </form>
    </Card>
  );
};

export default Auth;
