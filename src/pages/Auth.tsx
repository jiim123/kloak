import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/integrations/supabase/client';
import { markWelcomeSeen } from '@/lib/storage';
import { Key, Copy, Check, AlertCircle, Eye, EyeOff, Loader2, CheckCircle2, XCircle, UserPlus, Shield } from 'lucide-react';
import kloakLogo from '@/assets/kloak-logo.svg';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { WelcomeModal } from '@/components/modals/WelcomeModal';
import { GrainGradient } from '@paper-design/shaders-react';

type AuthStep = 'form' | 'key-display';

const Auth = () => {
  const navigate = useNavigate();
  const { user, isLoading, error, createAccount, login, setError } = useAuthStore();
  const { toast } = useToast();

  // Tab state
  const [activeTab, setActiveTab] = useState<'create' | 'login'>('create');

  // Create account state
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
  const [authStep, setAuthStep] = useState<AuthStep>('form');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [showGeneratedKey, setShowGeneratedKey] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [keyConfirmed, setKeyConfirmed] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Login state
  const [secretKey, setSecretKey] = useState('');
  const [showSecretKey, setShowSecretKey] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/app');
    }
  }, [user, navigate]);

  // Reset state when switching tabs
  useEffect(() => {
    setError(null);
    setUsernameError(null);
    setUsername('');
    setSecretKey('');
    setAuthStep('form');
    setGeneratedKey(null);
    setKeyCopied(false);
    setKeyConfirmed(false);
    setIsUsernameAvailable(null);
  }, [activeTab, setError]);

  // Validate username format
  const validateUsername = useCallback((value: string): string | null => {
    if (!value) return null;
    if (value.length < 3) return 'Username must be at least 3 characters';
    if (value.length > 20) return 'Username must be 20 characters or less';
    if (!/^[a-zA-Z0-9_]+$/.test(value)) return 'Only letters, numbers, and underscores allowed';
    return null;
  }, []);

  // Check username availability with debounce
  useEffect(() => {
    const validation = validateUsername(username);
    setUsernameError(validation);

    if (validation || !username) {
      setIsUsernameAvailable(null);
      return;
    }

    setIsCheckingUsername(true);
    setIsUsernameAvailable(null);

    const timeoutId = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id')
          .eq('username', username.toLowerCase())
          .maybeSingle();

        if (error) throw error;
        setIsUsernameAvailable(data === null);
      } catch (err) {
        console.error('Username check failed:', err);
        setIsUsernameAvailable(null);
      } finally {
        setIsCheckingUsername(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [username, validateUsername]);

  // Handle create account
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = validateUsername(username);
    if (validation) {
      setUsernameError(validation);
      return;
    }

    if (isUsernameAvailable === false) {
      setUsernameError('Username is already taken');
      return;
    }

    const result = await createAccount(username.trim().toLowerCase());
    if (result) {
      setGeneratedKey(result.secretKey);
      setAuthStep('key-display');
      // Show welcome modal for newly created accounts
      setShowWelcomeModal(true);
    }
  };

  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedKey = secretKey.trim();
    
    if (!trimmedKey) {
      setError('Secret key is required');
      return;
    }

    if (!/^[a-fA-F0-9]{64}$/.test(trimmedKey)) {
      setError('Invalid key format. Must be 64 hexadecimal characters.');
      return;
    }

    const success = await login(trimmedKey);
    if (success) {
      toast({
        title: 'Welcome back!',
        description: 'Successfully logged in.',
      });
    }
  };

  // Handle key paste - auto-trim whitespace
  const handleKeyPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text').trim();
    setSecretKey(pastedText);
  };

  // Copy key to clipboard
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

  // Continue to app after confirming key saved
  const continueToApp = () => {
    navigate('/app');
  };

  // Handle welcome modal close
  const handleWelcomeClose = () => {
    if (user) {
      markWelcomeSeen(user.id);
    }
    setShowWelcomeModal(false);
  };

  // Render username input status icon
  const renderUsernameStatus = () => {
    if (!username) return null;
    if (usernameError) return <XCircle className="w-4 h-4 text-destructive" />;
    if (isCheckingUsername) return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;
    if (isUsernameAvailable === true) return <CheckCircle2 className="w-4 h-4 text-[hsl(var(--nomo-success))]" />;
    if (isUsernameAvailable === false) return <XCircle className="w-4 h-4 text-destructive" />;
    return null;
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background shader */}
      <div className="absolute inset-0 z-0">
        <GrainGradient
          style={{ width: '100%', height: '100%' }}
          colors={["#6b6557", "#8a8274", "#a39e8c"]}
          colorBack="#0d0d0c"
          softness={0.76}
          intensity={0.08}
          noise={0.5}
          shape="wave"
          speed={1}
          scale={1.68}
          rotation={304}
          offsetX={-0.06}
        />
      </div>
      <div className="w-full max-w-md relative z-10">
        {/* Logo and branding */}
        <div className="text-center mb-8">
          <img src={kloakLogo} alt="Kloak" className="h-12 mx-auto mb-4" />
          <p className="text-white mt-1 font-medium">Privacy-first messaging</p>
        </div>

        {/* Auth card */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-xl">
          {authStep === 'form' ? (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'create' | 'login')}>
              <TabsList className="w-full grid grid-cols-2 mb-6">
                <TabsTrigger value="create">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Create Account
                </TabsTrigger>
                <TabsTrigger value="login">
                  <Key className="w-4 h-4 mr-2" />
                  I Have a Key
                </TabsTrigger>
              </TabsList>

              {/* Error display */}
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {/* Create Account Tab */}
              <TabsContent value="create" className="mt-0">
                <form onSubmit={handleCreateAccount} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <div className="relative">
                      <Input
                        id="username"
                        placeholder="your_username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        maxLength={20}
                        disabled={isLoading}
                        className={cn(
                          'pr-10',
                          usernameError && 'border-destructive focus-visible:ring-destructive',
                          isUsernameAvailable === true && 'border-[hsl(var(--nomo-success))] focus-visible:ring-[hsl(var(--nomo-success))]'
                        )}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {renderUsernameStatus()}
                      </div>
                    </div>
                    {usernameError && (
                      <p className="text-xs text-destructive">{usernameError}</p>
                    )}
                    {!usernameError && isUsernameAvailable === false && (
                      <p className="text-xs text-destructive">Username is already taken</p>
                    )}
                    {!usernameError && isUsernameAvailable === true && (
                      <p className="text-xs text-[hsl(var(--nomo-success))]">Username is available!</p>
                    )}
                    {!usernameError && isUsernameAvailable === null && username && !isCheckingUsername && (
                      <p className="text-xs text-muted-foreground">
                        3-20 characters. Letters, numbers, and underscores only.
                      </p>
                    )}
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading || !!usernameError || isUsernameAvailable !== true}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Key className="w-4 h-4 mr-2" />
                    )}
                    Create Account
                  </Button>
                  
                  <p className="text-center text-xs text-muted-foreground mt-4">
                    No email. No password. No tracking.
                  </p>
                </form>
              </TabsContent>

              {/* Login Tab */}
              <TabsContent value="login" className="mt-0">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="secretKey">Secret Key</Label>
                    <div className="relative">
                      <Input
                        id="secretKey"
                        type={showSecretKey ? 'text' : 'password'}
                        placeholder="Paste your 64-character secret key"
                        value={secretKey}
                        onChange={(e) => setSecretKey(e.target.value)}
                        onPaste={handleKeyPaste}
                        className="font-mono text-sm pr-10"
                        disabled={isLoading}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                        onClick={() => setShowSecretKey(!showSecretKey)}
                      >
                        {showSecretKey ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Your 64-character hexadecimal key
                    </p>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading || !secretKey}>
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Login
                  </Button>
                  
                  <p className="text-center text-xs text-muted-foreground mt-4">
                    No email. No password. No tracking.
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          ) : (
            /* Secret Key Display Screen */
            <div className="space-y-6">
              {/* Warning banner */}
              <div className="p-4 rounded-lg bg-[hsl(var(--nomo-warning))/0.15] border border-[hsl(var(--nomo-warning))/0.3]">
                <div className="flex items-start gap-3">
                  <Shield className="w-6 h-6 text-[hsl(var(--nomo-warning))] flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold tracking-tight text-foreground">Save Your Secret Key</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      This is the <span className="font-medium text-foreground">only way</span> to access your account. 
                      We cannot recover it. Store it safely — in a password manager or written down securely.
                    </p>
                  </div>
                </div>
              </div>

              {/* Key display */}
              <div className="space-y-2">
                <Label>Your Secret Key</Label>
                <div className="relative">
                  <div className="bg-secondary/50 rounded-lg p-4 font-mono text-sm break-all border border-border">
                    {showGeneratedKey ? generatedKey : '•'.repeat(64)}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-2 h-7 w-7 p-0"
                    onClick={() => setShowGeneratedKey(!showGeneratedKey)}
                  >
                    {showGeneratedKey ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Copy button */}
              <Button
                variant={keyCopied ? 'secondary' : 'outline'}
                className="w-full"
                onClick={copyKey}
              >
                {keyCopied ? (
                  <>
                    <Check className="w-4 h-4 mr-2 text-[hsl(var(--nomo-success))]" />
                    Copied to Clipboard
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy to Clipboard
                  </>
                )}
              </Button>

              {/* Confirmation checkbox */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30">
                <Checkbox
                  id="confirm-saved"
                  checked={keyConfirmed}
                  onCheckedChange={(checked) => setKeyConfirmed(checked === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="confirm-saved" className="text-sm cursor-pointer leading-relaxed">
                  I have saved my secret key somewhere safe. I understand I cannot recover my account without it.
                </Label>
              </div>

              {/* Continue button */}
              <Button
                className="w-full"
                disabled={!keyConfirmed}
                onClick={continueToApp}
              >
                Continue to App
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Welcome Modal for new users */}
      <WelcomeModal open={showWelcomeModal} onClose={handleWelcomeClose} />
    </div>
  );
};

export default Auth;
