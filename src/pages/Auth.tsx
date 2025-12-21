import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Shield, Key, Copy, Check, ArrowLeft, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'login';
  
  const { user, isLoading, error, createAccount, login, setError } = useAuthStore();
  const { toast } = useToast();

  // Registration state
  const [username, setUsername] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [keyConfirmed, setKeyConfirmed] = useState(false);

  // Login state
  const [secretKey, setSecretKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/app');
    }
  }, [user, navigate]);

  useEffect(() => {
    setError(null);
    setGeneratedKey(null);
    setKeyCopied(false);
    setKeyConfirmed(false);
    setSecretKey('');
    setUsername('');
  }, [mode, setError]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    if (username.length > 20) {
      setError('Username must be 20 characters or less');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('Username can only contain letters, numbers, and underscores');
      return;
    }

    const result = await createAccount(username.trim());
    if (result) {
      setGeneratedKey(result.secretKey);
      toast({
        title: 'Account created!',
        description: 'Make sure to save your secret key securely.',
      });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!secretKey.trim()) {
      setError('Secret key is required');
      return;
    }

    if (secretKey.length !== 64) {
      setError('Invalid secret key format');
      return;
    }

    const success = await login(secretKey.trim());
    if (success) {
      toast({
        title: 'Welcome back!',
        description: 'Successfully logged in.',
      });
    }
  };

  const copyKey = async () => {
    if (generatedKey) {
      await navigator.clipboard.writeText(generatedKey);
      setKeyCopied(true);
      toast({
        title: 'Copied!',
        description: 'Secret key copied to clipboard.',
      });
    }
  };

  const confirmAndContinue = () => {
    setKeyConfirmed(true);
    navigate('/app');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back button */}
        <Button 
          variant="ghost" 
          className="mb-4"
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Card className="border-border">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center">
                <Shield className="w-7 h-7 text-primary-foreground" />
              </div>
            </div>
            <CardTitle className="text-2xl">
              {mode === 'register' 
                ? (generatedKey ? 'Save Your Key' : 'Create Account')
                : 'Welcome Back'
              }
            </CardTitle>
            <CardDescription>
              {mode === 'register'
                ? (generatedKey 
                    ? 'This is your only way to access your account'
                    : 'Choose a username to get started'
                  )
                : 'Enter your secret key to login'
              }
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {mode === 'register' && !generatedKey && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="your_username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    maxLength={20}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Letters, numbers, and underscores only. Max 20 characters.
                  </p>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                  ) : (
                    <>
                      <Key className="w-4 h-4 mr-2" />
                      Generate Secret Key
                    </>
                  )}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Already have a key?{' '}
                  <Button 
                    variant="link" 
                    className="p-0 h-auto"
                    onClick={() => navigate('/auth?mode=login')}
                  >
                    Login
                  </Button>
                </p>
              </form>
            )}

            {mode === 'register' && generatedKey && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm font-medium text-destructive mb-2">
                    ⚠️ Critical: Save this key securely!
                  </p>
                  <p className="text-xs text-muted-foreground">
                    This is your ONLY way to access your account. There is no recovery option. 
                    Store it in a password manager or write it down safely.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Your Secret Key</Label>
                  <div className="relative">
                    <Input
                      readOnly
                      value={generatedKey}
                      className="font-mono text-xs pr-12"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2"
                      onClick={copyKey}
                    >
                      {keyCopied ? (
                        <Check className="w-4 h-4 text-nomo-success" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <Button 
                  className="w-full" 
                  disabled={!keyCopied}
                  onClick={confirmAndContinue}
                >
                  {keyCopied ? "I've Saved My Key — Continue" : "Copy Your Key First"}
                </Button>
              </div>
            )}

            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="secretKey">Secret Key</Label>
                  <div className="relative">
                    <Input
                      id="secretKey"
                      type={showKey ? 'text' : 'password'}
                      placeholder="Enter your 64-character secret key"
                      value={secretKey}
                      onChange={(e) => setSecretKey(e.target.value)}
                      className="font-mono pr-12"
                      disabled={isLoading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2"
                      onClick={() => setShowKey(!showKey)}
                    >
                      {showKey ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                  ) : (
                    'Login'
                  )}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Don't have an account?{' '}
                  <Button 
                    variant="link" 
                    className="p-0 h-auto"
                    onClick={() => navigate('/auth?mode=register')}
                  >
                    Create one
                  </Button>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;