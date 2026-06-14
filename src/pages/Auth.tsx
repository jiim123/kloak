import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { useAuthStore, initializeAuth } from "@/stores/authStore";
import { supabase } from "@/integrations/supabase/client";
import { markWelcomeSeen } from "@/lib/storage";
import {
  Key,
  AlertCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  XCircle,
  CircleUserRound,
  Sparkles,
  Info,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { OnboardingModal } from "@/components/modals/OnboardingModal";
import { NavigationMenu } from "@/components/layout/NavigationMenu";
import { Footer } from "@/components/ui/footer-section";
import { resizeWindowForApp } from "@/lib/tauriRuntime";
import { SEO } from "@/components/seo";
import { SEO_CONFIG } from "@/lib/seo";
import kloakLogo from "@/assets/kloak-logo.svg";
import {
  validateUsernameComprehensive,
  generateUsernameSuggestions,
  checkRegistrationRateLimit,
  recordRegistrationAttempt,
  logBlockedUsernameAttempt,
} from "@/utils/blockedUsernames";

import { MAINTENANCE_MODE, REGISTRATION_DISABLED } from "@/lib/maintenance";

const tabContentVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 20 : -20,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 20 : -20,
    opacity: 0,
  }),
};

type AuthProps = {
  formOnly?: boolean;
};

const Auth = ({ formOnly = false }: AuthProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading, error, createAccount, login, verifyLoginMfa, setError } = useAuthStore();
  

  const redirectParam = useMemo(() => new URLSearchParams(location.search).get("redirect"), [location.search]);

  const redirectTo = useMemo(() => {
    if (!redirectParam) return null;

    // Prevent open redirects. Only allow in-app absolute paths.
    if (!redirectParam.startsWith("/") || redirectParam.startsWith("//")) return null;

    return redirectParam;
  }, [redirectParam]);

  // Tab state
  const [activeTab, setActiveTab] = useState<"create" | "login">("create");

  // Create account state
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameErrorType, setUsernameErrorType] = useState<string | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const [rateLimitCooldown, setRateLimitCooldown] = useState<number | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha | null>(null);
  const hcaptchaSiteKey = import.meta.env.VITE_HCAPTCHA_SITE_KEY as string | undefined;

  // Login state
  const [secretKey, setSecretKey] = useState("");
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState("");

  // Check for saved session on mount
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Check if user is already authenticated
      const currentState = useAuthStore.getState();
      if (currentState.user && currentState.isAuthenticated) {
        // Already logged in, resize window and redirect
        if (!cancelled) {
          await resizeWindowForApp();
          navigate(redirectTo || "/app", { replace: true });
        }
        return;
      }

      // Check if there's a saved secret key in localStorage
      if (currentState.secretKey) {
        // Try to restore session using saved key
        await initializeAuth();
        if (!cancelled) {
          const { user: restoredUser, isAuthenticated } = useAuthStore.getState();
          if (restoredUser && isAuthenticated) {
            // Session restored, resize window and redirect to app
            await resizeWindowForApp();
            navigate(redirectTo || "/app", { replace: true });
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, redirectTo]);

  // Redirect if already logged in (but not during onboarding)
  useEffect(() => {
    if (user && !showWelcomeModal) {
      // Use a small delay to ensure iOS Safari has completed any pending state updates
      const timeoutId = setTimeout(() => {
        navigate(redirectTo || "/app", { replace: true });
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [user, navigate, redirectTo, showWelcomeModal]);

  // Reset state when switching tabs
  useEffect(() => {
    setError(null);
    setUsernameError(null);
    setUsernameErrorType(null);
    setUsername("");
    setSecretKey("");
    setMfaRequired(false);
    setMfaCode("");
    setGeneratedKey(null);
    setUsernameSuggestions([]);
    setIsUsernameAvailable(false);
    setCaptchaToken(null);
    setCaptchaError(null);
    captchaRef.current?.resetCaptcha();
  }, [activeTab, setError]);

  // Rate limit cooldown countdown
  useEffect(() => {
    if (rateLimitCooldown === null || rateLimitCooldown <= 0) return;

    const interval = setInterval(() => {
      setRateLimitCooldown((prev) => {
        if (prev === null || prev <= 1) {
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [rateLimitCooldown]);

  // Validate username with comprehensive checks + debounced availability check
  useEffect(() => {
    // Run comprehensive validation immediately
    if (!username) {
      setUsernameError(null);
      setUsernameErrorType(null);
      setUsernameSuggestions([]);
      setIsUsernameAvailable(false);
      setIsCheckingUsername(false);
      return;
    }

    const validation = validateUsernameComprehensive(username);

    if (!validation.isValid) {
      setUsernameError(validation.error || "Invalid username");
      setUsernameErrorType(validation.errorType || null);
      setIsUsernameAvailable(false);
      setIsCheckingUsername(false);

      // Log blocked username attempts for security monitoring
      if (validation.errorType === "reserved" || validation.errorType === "contains_restricted") {
        logBlockedUsernameAttempt(username, validation.errorType);
        // Generate suggestions for blocked usernames
        const suggestions = generateUsernameSuggestions(username, 4);
        setUsernameSuggestions(suggestions);
      } else {
        setUsernameSuggestions([]);
      }
      return;
    }

    // Clear error and suggestions if validation passed, start checking availability
    setUsernameError(null);
    setUsernameErrorType(null);
    setUsernameSuggestions([]);
    setIsUsernameAvailable(false);
    setIsCheckingUsername(true);

    // Debounced availability check
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc("check_username_available", {
          _username: username.trim().toLowerCase(),
        });

        // Only update if username hasn't changed during the async call
        if (username === username) {
          if (error) {
            console.error("Username availability check failed:", error);
            setIsCheckingUsername(false);
            // Don't block registration on availability check failure
            setIsUsernameAvailable(true);
            return;
          }

          if (data === true) {
            setIsUsernameAvailable(true);
            setUsernameError(null);
          } else {
            setIsUsernameAvailable(false);
            setUsernameError("Username is already taken");
            setUsernameErrorType("format");
          }
          setIsCheckingUsername(false);
        }
      } catch {
        setIsCheckingUsername(false);
        setIsUsernameAvailable(true); // Don't block on network errors
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username]);

  // Handle create account
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();

    if (MAINTENANCE_MODE || REGISTRATION_DISABLED) return;

    // Check rate limit
    const rateLimit = checkRegistrationRateLimit();
    if (!rateLimit.allowed) {
      setRateLimitCooldown(rateLimit.remainingSeconds || 30);
      toast.error("Too many attempts", {
        description: `Please wait ${rateLimit.remainingSeconds} seconds before trying again.`,
      });
      return;
    }

    const validation = validateUsernameComprehensive(username);
    if (!validation.isValid) {
      setUsernameError(validation.error || "Invalid username");
      setUsernameErrorType(validation.errorType || null);
      recordRegistrationAttempt();
      return;
    }

    if (!hcaptchaSiteKey) {
      setError("Registration is not configured. Missing VITE_HCAPTCHA_SITE_KEY.");
      return;
    }

    if (!captchaToken) {
      setCaptchaError("Please complete the captcha challenge.");
      return;
    }

    try {
      recordRegistrationAttempt();

      // Set modal flag BEFORE createAccount so the redirect useEffect
      // won't navigate away when the user is set in the store.
      setShowWelcomeModal(true);
      const result = await createAccount(username.trim().toLowerCase(), captchaToken);
      if (result) {
        setGeneratedKey(result.secretKey);
      } else {
        setShowWelcomeModal(false);
        setCaptchaToken(null);
        setCaptchaError(null);
        captchaRef.current?.resetCaptcha();
      }
    } catch (err) {
      console.error("Account creation error:", err);
      setShowWelcomeModal(false);
      setCaptchaToken(null);
      setCaptchaError(null);
      captchaRef.current?.resetCaptcha();
      toast.error("Account creation failed", {
        description: "Please try again. If the problem persists, check your internet connection.",
      });
    }
  };

  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (MAINTENANCE_MODE) return;

    const trimmedKey = secretKey.trim();

    if (!trimmedKey) {
      setError("Secret key is required");
      return;
    }

    if (!/^[a-fA-F0-9]{64}$/.test(trimmedKey)) {
      setError("Invalid key format. Must be 64 hexadecimal characters.");
      return;
    }

    const success = await login(trimmedKey);
    if (success === "mfa_required") {
      setMfaRequired(true);
      setMfaCode("");
      return;
    }

    if (success) {
      toast.success("Welcome back!", {
        description: "Successfully logged in.",
      });

      // Resize Tauri window to app size, then navigate
      await resizeWindowForApp();
      // Use replace to prevent back navigation to auth page after login
      navigate(redirectTo || "/app", { replace: true });
    }
  };

  const handleMfaLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (MAINTENANCE_MODE) return;

    const success = await verifyLoginMfa(mfaCode);
    if (success) {
      toast.success("Welcome back!", {
        description: "Successfully verified 2FA.",
      });

      await resizeWindowForApp();
      navigate(redirectTo || "/app", { replace: true });
    }
  };

  const renderMfaLoginForm = () => (
    <form onSubmit={handleMfaLogin} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="mfaCode" className="block text-center">
          Two-factor code
        </Label>
        <InputOTP
          id="mfaCode"
          maxLength={6}
          value={mfaCode}
          onChange={setMfaCode}
          disabled={MAINTENANCE_MODE || isLoading}
          containerClassName="justify-center"
        >
          <InputOTPGroup className="gap-1">
            {Array.from({ length: 6 }).map((_, index) => (
              <InputOTPSlot key={index} index={index} className="rounded-md border" />
            ))}
          </InputOTPGroup>
        </InputOTP>
        <p className="text-center text-xs text-muted-foreground">Enter the 6-digit code from your authenticator app.</p>
      </div>

      <Button type="submit" className="w-full" disabled={MAINTENANCE_MODE || isLoading || mfaCode.length !== 6}>
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Verify and Login
      </Button>

      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={() => {
          setMfaRequired(false);
          setMfaCode("");
          setError(null);
        }}
        disabled={isLoading}
      >
        Use a different secret key
      </Button>
    </form>
  );

  // Handle key paste - auto-trim whitespace
  const handleKeyPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text").trim();
    setSecretKey(pastedText);
  };

  // Handle onboarding modal close - navigate to app
  const handleOnboardingClose = async () => {
    if (user) {
      markWelcomeSeen(user.id);
    }
    // Clear secretKey from memory — it should never persist beyond onboarding
    useAuthStore.getState().setSecretKey(null);
    setShowWelcomeModal(false);
    // Resize Tauri window to app size, then navigate
    await resizeWindowForApp();
    navigate(redirectTo || "/app", { replace: true });
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    setUsername(suggestion);
    setUsernameSuggestions([]);
  };

  // Render username input status icon
  const renderUsernameStatus = () => {
    if (!username) return null;
    if (usernameError) return <XCircle className="w-4 h-4 text-destructive" />;
    if (isCheckingUsername) return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;
    if (isUsernameAvailable) return <CheckCircle2 className="w-4 h-4 text-[hsl(var(--kloak-success))]" />;
    return null;
  };

  // Get input className based on state - only use border color, not ring
  const getInputClassName = () => {
    if (usernameError) {
      return "pr-10 border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30 bg-destructive/5";
    }
    if (isUsernameAvailable) {
      return "pr-10 border-[hsl(var(--kloak-success))] focus-visible:border-[hsl(var(--kloak-success))] focus-visible:ring-[hsl(var(--kloak-success))]/30 bg-[hsl(var(--kloak-success))]/5";
    }
    return "pr-10";
  };

  // Render username suggestions
  const renderUsernameSuggestions = () => {
    if (usernameSuggestions.length === 0) return null;

    return (
      <div className="mt-2 p-3 rounded-lg bg-muted/50 border border-border">
        <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground">
          <Sparkles className="w-3 h-3" />
          <span>Try these instead:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {usernameSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => handleSuggestionClick(suggestion)}
              className="px-2.5 py-1 text-xs font-medium rounded-md bg-background border border-border hover:bg-accent hover:border-primary/30 transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    );
  };

  // Render username field helper text
  const renderUsernameHelperText = () => {
    if (usernameError) {
      return <p className="text-xs text-destructive">{usernameError}</p>;
    }
    if (isCheckingUsername && username) {
      return <p className="text-xs text-muted-foreground">Checking availability...</p>;
    }
    if (isUsernameAvailable && username && !isCheckingUsername) {
      return <p className="text-xs text-[hsl(var(--kloak-success))]">Username is available!</p>;
    }
    return null;
  };

  // Compact auth-only layout (used by DesktopAuth route)
  const useFormOnlyLayout = formOnly;

  const maintenanceBanner = MAINTENANCE_MODE ? (
    <div className="w-full py-2.5 px-4 bg-amber-500/20 border-b border-amber-500/30 flex items-center justify-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-medium shrink-0">
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      We're currently under maintenance. New sign-ups and login are temporarily unavailable.
    </div>
  ) : null;

  if (useFormOnlyLayout) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {maintenanceBanner}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            {/* Auth card */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-xl">
              <div className="flex items-center justify-center mb-6">
                <img src={kloakLogo} alt="Kloak" className="h-7" />
              </div>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "create" | "login")}>
                <TabsList className="w-full grid grid-cols-2 mb-6 h-auto p-1.5 bg-muted/50 rounded-2xl border border-border/50">
                  <TabsTrigger
                    value="create"
                    className="rounded-xl py-2.5 px-4 text-sm font-normal transition-all duration-200 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground"
                  >
                    <CircleUserRound className="w-4 h-4 mr-2" />
                    Create Account
                  </TabsTrigger>
                  <TabsTrigger
                    value="login"
                    className="rounded-xl py-2.5 px-4 text-sm font-normal transition-all duration-200 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground"
                  >
                    <Key className="w-4 h-4 mr-2" />
                    Login with Key
                  </TabsTrigger>
                </TabsList>

                {/* Maintenance notice */}
                {MAINTENANCE_MODE && (
                  <div className="mb-4 p-4 rounded-lg bg-slate-700 border border-slate-600 text-sm leading-relaxed text-slate-300">
                    We are currently experiencing high traffic volumes and are scaling our systems to keep up. Login and
                    Registration are temporarily disabled to ensure stability for active sessions. We'll be back
                    shortly!
                  </div>
                )}

                {/* Rate limit warning */}
                {rateLimitCooldown !== null && rateLimitCooldown > 0 && (
                  <div className="mb-4 p-3 rounded-lg bg-[hsl(var(--kloak-warning))]/10 border border-[hsl(var(--kloak-warning))]/20 flex items-center gap-2 text-[hsl(var(--kloak-warning))]">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <p className="text-sm">Too many attempts. Try again in {rateLimitCooldown}s</p>
                  </div>
                )}

                {/* Error display */}
                {error && (
                  <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <p className="text-sm">{error}</p>
                  </div>
                )}

                {/* Animated Tab Content */}
                <div className="relative overflow-hidden">
                  <AnimatePresence mode="wait" initial={false} custom={activeTab === "login" ? 1 : -1}>
                    {activeTab === "create" && (
                      <motion.div
                        key="create"
                        custom={-1}
                        variants={tabContentVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                      >
                        {REGISTRATION_DISABLED ? (
                          <div className="space-y-4">
                            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm leading-relaxed text-amber-400">
                              <div className="flex items-center gap-2 mb-2 font-medium">
                                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                Registration Temporarily Disabled
                              </div>
                              <p className="text-muted-foreground">
                                New account registrations are currently paused. If you already have an account, please
                                use the <strong className="text-foreground">Login with Key</strong> tab to sign in.
                                Check back later for updates.
                              </p>
                            </div>
                            <Button className="w-full" disabled>
                              <Key className="w-4 h-4 mr-2" />
                              Create Account
                            </Button>
                          </div>
                        ) : (
                          <form onSubmit={handleCreateAccount} className="space-y-4">
                            <div className="space-y-2">
                              <div className="flex items-center gap-1.5">
                                <Label htmlFor="username">Username</Label>
                                <TooltipProvider delayDuration={0}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        className="text-muted-foreground hover:text-foreground transition-colors"
                                      >
                                        <Info className="w-3.5 h-3.5" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-[220px] text-xs">
                                      <p>
                                        4-16 characters. Letters, numbers, underscores, and hyphens only. No offensive
                                        or impersonating names.
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              <div className="relative">
                                <Input
                                  id="username"
                                  placeholder="your_username"
                                  value={username}
                                  onChange={(e) => setUsername(e.target.value)}
                                  maxLength={16}
                                  disabled={
                                    MAINTENANCE_MODE ||
                                    isLoading ||
                                    (rateLimitCooldown !== null && rateLimitCooldown > 0)
                                  }
                                  className={cn(getInputClassName())}
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                  {renderUsernameStatus()}
                                </div>
                              </div>
                              {renderUsernameHelperText()}
                              {renderUsernameSuggestions()}
                            </div>
                            <div className="space-y-2">
                              {!hcaptchaSiteKey ? (
                                <p className="text-xs text-destructive">
                                  Registration captcha is not configured. Missing `VITE_HCAPTCHA_SITE_KEY`.
                                </p>
                              ) : (
                                <>
                                  <HCaptcha
                                    ref={captchaRef}
                                    sitekey={hcaptchaSiteKey}
                                    onVerify={(token) => {
                                      setCaptchaToken(token);
                                      setCaptchaError(null);
                                      setError(null);
                                    }}
                                    onExpire={() => {
                                      setCaptchaToken(null);
                                      setCaptchaError("Captcha expired. Please verify again.");
                                    }}
                                    onError={() => {
                                      setCaptchaToken(null);
                                      setCaptchaError("Captcha failed to load. Please retry.");
                                    }}
                                  />
                                  {captchaError ? <p className="text-xs text-destructive">{captchaError}</p> : null}
                                </>
                              )}
                            </div>

                            <Button
                              type="submit"
                              className="w-full"
                              disabled={
                                MAINTENANCE_MODE ||
                                isLoading ||
                                !!usernameError ||
                                !isUsernameAvailable ||
                                isCheckingUsername ||
                                !hcaptchaSiteKey ||
                                !captchaToken ||
                                (rateLimitCooldown !== null && rateLimitCooldown > 0)
                              }
                            >
                              {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              ) : (
                                <Key className="w-4 h-4 mr-2" />
                              )}
                              Create Account
                            </Button>

                            <p className="text-center text-xs text-muted-foreground mt-3">
                              By creating an account, you agree to our{" "}
                              <Link to="/terms" className="text-foreground hover:underline">
                                Terms of Service
                              </Link>{" "}
                              and{" "}
                              <Link to="/privacy" className="text-foreground hover:underline">
                                Privacy Policy
                              </Link>
                            </p>
                          </form>
                        )}
                      </motion.div>
                    )}

                    {activeTab === "login" && (
                      <motion.div
                        key="login"
                        custom={1}
                        variants={tabContentVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                      >
                        {mfaRequired ? renderMfaLoginForm() : (
                        <form onSubmit={handleLogin} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="secretKey">Secret Key</Label>
                            <div className="relative">
                              <Input
                                id="secretKey"
                                type={showSecretKey ? "text" : "password"}
                                placeholder="Paste your 64-character secret key"
                                value={secretKey}
                                onChange={(e) => setSecretKey(e.target.value)}
                                onPaste={handleKeyPaste}
                                className="font-normal text-sm pr-10"
                                disabled={MAINTENANCE_MODE || isLoading}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                                onClick={() => setShowSecretKey(!showSecretKey)}
                              >
                                {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </Button>
                            </div>
                          </div>

                          <Button
                            type="submit"
                            className="w-full"
                            disabled={MAINTENANCE_MODE || isLoading || !secretKey}
                          >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Login
                          </Button>

                          <p className="text-xs text-muted-foreground">
                            Keep your secret key saved.
                          </p>
                        </form>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Tabs>
            </div>
          </div>
          {/* Onboarding Modal for new users */}
          <OnboardingModal open={showWelcomeModal} onClose={handleOnboardingClose} secretKey={generatedKey} />
        </div>
      </div>
    );
  }

  // Browser version with navigation and footer
  return (
    <div className="min-h-screen bg-background flex flex-col landing-typography">
      <SEO {...SEO_CONFIG.auth} noIndex />
      {/* Navigation */}
      <NavigationMenu />
      {maintenanceBanner}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Auth card */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-xl">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "create" | "login")}>
              <TabsList className="w-full grid grid-cols-2 mb-6 h-auto p-1.5 bg-muted/50 rounded-2xl border border-border/50">
                <TabsTrigger
                  value="create"
                  className="rounded-xl py-2.5 px-4 text-sm font-normal transition-all duration-200 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground"
                >
                  <CircleUserRound className="w-4 h-4 mr-2" />
                  Create Account
                </TabsTrigger>
                <TabsTrigger
                  value="login"
                  className="rounded-xl py-2.5 px-4 text-sm font-normal transition-all duration-200 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground"
                >
                  <Key className="w-4 h-4 mr-2" />
                  Login with Key
                </TabsTrigger>
              </TabsList>

              {/* Maintenance notice */}
              {MAINTENANCE_MODE && (
                <div className="mb-4 p-4 rounded-lg bg-slate-700 border border-slate-600 text-sm leading-relaxed text-slate-300">
                  We are currently experiencing high traffic volumes and are scaling our systems to keep up. Login and
                  Registration are temporarily disabled to ensure stability for active sessions. We'll be back shortly!
                </div>
              )}

              {/* Rate limit warning */}
              {rateLimitCooldown !== null && rateLimitCooldown > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-[hsl(var(--kloak-warning))]/10 border border-[hsl(var(--kloak-warning))]/20 flex items-center gap-2 text-[hsl(var(--kloak-warning))]">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <p className="text-sm">Too many attempts. Try again in {rateLimitCooldown}s</p>
                </div>
              )}

              {/* Error display */}
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {/* Animated Tab Content */}
              <div className="relative overflow-hidden">
                <AnimatePresence mode="wait" initial={false} custom={activeTab === "login" ? 1 : -1}>
                  {activeTab === "create" && (
                    <motion.div
                      key="create"
                      custom={-1}
                      variants={tabContentVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                    >
                      {REGISTRATION_DISABLED ? (
                        <div className="space-y-4">
                          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm leading-relaxed text-amber-400">
                            <div className="flex items-center gap-2 mb-2 font-medium">
                              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                              Registration Temporarily Disabled
                            </div>
                            <p className="text-muted-foreground">
                              New account registrations are currently paused. If you already have an account, please use
                              the <strong className="text-foreground">Login with Key</strong> tab to sign in. Check back
                              later for updates.
                            </p>
                          </div>
                          <Button className="w-full" disabled>
                            <Key className="w-4 h-4 mr-2" />
                            Create Account
                          </Button>
                        </div>
                      ) : (
                        <form onSubmit={handleCreateAccount} className="space-y-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5">
                              <Label htmlFor="username">Username</Label>
                              <TooltipProvider delayDuration={0}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className="text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                      <Info className="w-3.5 h-3.5" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[220px] text-xs">
                                    <p>
                                      4-16 characters. Letters, numbers, underscores, and hyphens only. No offensive or
                                      impersonating names.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <div className="relative">
                              <Input
                                id="username"
                                placeholder="your_username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                maxLength={16}
                                disabled={
                                  MAINTENANCE_MODE || isLoading || (rateLimitCooldown !== null && rateLimitCooldown > 0)
                                }
                                className={cn(getInputClassName())}
                              />
                              <div className="absolute right-3 top-1/2 -translate-y-1/2">{renderUsernameStatus()}</div>
                            </div>
                            {renderUsernameHelperText()}
                            {renderUsernameSuggestions()}
                          </div>
                          <div className="space-y-2">
                            {!hcaptchaSiteKey ? (
                              <p className="text-xs text-destructive">
                                Registration captcha is not configured. Missing `VITE_HCAPTCHA_SITE_KEY`.
                              </p>
                            ) : (
                              <>
                                <HCaptcha
                                  ref={captchaRef}
                                  sitekey={hcaptchaSiteKey}
                                  onVerify={(token) => {
                                    setCaptchaToken(token);
                                    setCaptchaError(null);
                                    setError(null);
                                  }}
                                  onExpire={() => {
                                    setCaptchaToken(null);
                                    setCaptchaError("Captcha expired. Please verify again.");
                                  }}
                                  onError={() => {
                                    setCaptchaToken(null);
                                    setCaptchaError("Captcha failed to load. Please retry.");
                                  }}
                                />
                                {captchaError ? <p className="text-xs text-destructive">{captchaError}</p> : null}
                              </>
                            )}
                          </div>

                          <Button
                            type="submit"
                            className="w-full"
                            disabled={
                              MAINTENANCE_MODE ||
                              isLoading ||
                              !!usernameError ||
                              !hcaptchaSiteKey ||
                              !captchaToken ||
                              (rateLimitCooldown !== null && rateLimitCooldown > 0)
                            }
                          >
                            {isLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                              <Key className="w-4 h-4 mr-2" />
                            )}
                            Create Account
                          </Button>

                          <p className="text-center text-xs text-muted-foreground mt-3">
                            By creating an account, you agree to our{" "}
                            <Link to="/terms" className="text-foreground hover:underline">
                              Terms of Service
                            </Link>{" "}
                            and{" "}
                            <Link to="/privacy" className="text-foreground hover:underline">
                              Privacy Policy
                            </Link>
                          </p>
                        </form>
                      )}
                    </motion.div>
                  )}

                  {activeTab === "login" && (
                    <motion.div
                      key="login"
                      custom={1}
                      variants={tabContentVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                    >
                      {mfaRequired ? renderMfaLoginForm() : (
                      <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="secretKey">Secret Key</Label>
                          <div className="relative">
                            <Input
                              id="secretKey"
                              type={showSecretKey ? "text" : "password"}
                              placeholder="Paste your 64-character secret key"
                              value={secretKey}
                              onChange={(e) => setSecretKey(e.target.value)}
                              onPaste={handleKeyPaste}
                              className="font-normal text-sm pr-10"
                              disabled={MAINTENANCE_MODE || isLoading}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                              onClick={() => setShowSecretKey(!showSecretKey)}
                            >
                              {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                          </div>
                        </div>

                        <Button type="submit" className="w-full" disabled={MAINTENANCE_MODE || isLoading || !secretKey}>
                          {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                          Login
                        </Button>

                        <p className="text-xs text-muted-foreground">
                          Keep your secret key saved.
                        </p>
                      </form>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
      {/* Onboarding Modal for new users */}
      <OnboardingModal open={showWelcomeModal} onClose={handleOnboardingClose} secretKey={generatedKey} />
    </div>
  );
};

export default Auth;
