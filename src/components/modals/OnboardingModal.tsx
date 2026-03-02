import { useState } from "react";
import {
  Shield,
  Key,
  HelpCircle,
  Sparkles,
  Copy,
  Check,
  Eye,
  EyeOff,
  ChevronRight,
  PartyPopper,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
  secretKey: string | null;
}

type OnboardingStep = 1 | 2 | 3;

export const OnboardingModal = ({
  open,
  onClose,
  secretKey,
}: OnboardingModalProps) => {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [keyStoredAccepted, setKeyStoredAccepted] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep((prev) => (prev + 1) as OnboardingStep);
    }
  };

  const handleFinish = () => {
    onClose();
  };

  // Copy key to clipboard with iOS Safari fallback
  const copyKey = async () => {
    if (!secretKey) return;

    try {
      if (
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === "function"
      ) {
        await navigator.clipboard.writeText(secretKey);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = secretKey;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
          document.execCommand("copy");
        } finally {
          document.body.removeChild(textArea);
        }
      }

      setKeyCopied(true);
      toast({
        title: "Copied!",
        description: "Secret key copied to clipboard.",
      });
    } catch (err) {
      console.error("Copy failed:", err);
      toast({
        variant: "destructive",
        title: "Copy failed",
        description: "Please manually select and copy the key.",
      });
    }
  };

  const progressValue = (currentStep / 3) * 100;

  const canProceedStep1 = termsAccepted;
  const canProceedStep2 = keyStoredAccepted;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="w-[calc(100vw-1rem)] sm:w-auto sm:max-w-xl md:max-w-2xl max-h-[90vh] p-0 bg-background/95 backdrop-blur-xl border-border/50 rounded-2xl shadow-xl overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        hideCloseButton
      >
        <div
          className="overflow-y-auto overscroll-contain touch-pan-y max-h-[90vh] w-full"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="p-4 sm:p-6 w-full">
            {/* Progress indicator */}
            <div className="mb-6">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <span>Step {currentStep} of 3</span>
                <span>{Math.round(progressValue)}%</span>
              </div>
              <Progress value={progressValue} className="h-1.5" />
            </div>

            {/* Step 1: Terms and Welcome */}
            {currentStep === 1 && (
              <>
                <DialogHeader className="text-center pb-4">
                  <div className="flex justify-center mb-4">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary/15 backdrop-blur-sm flex items-center justify-center">
                      <Shield className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
                    </div>
                  </div>
                  <DialogTitle className="text-xl sm:text-2xl font-medium tracking-tight">
                    Welcome to Kloak!
                  </DialogTitle>
                  <DialogDescription className="text-sm sm:text-base text-muted-foreground">
                    Your privacy-first messaging experience starts here.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 sm:space-y-5">
                  {/* Privacy Info Card */}
                  <div className="p-3 sm:p-4 rounded-xl bg-secondary/30 border border-border/30 backdrop-blur-sm">
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Kloak is built on a foundation of{" "}
                        <span className="font-medium text-foreground">
                          absolute privacy
                        </span>
                        . No email, no password, no phone number — just a secret
                        key that only you possess.
                      </p>
                      <ul className="text-xs sm:text-sm text-muted-foreground space-y-1.5">
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          <span>No tracking, no data selling</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          <span>Your conversations stay private</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          <span>You control your digital identity</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Terms Agreement */}
                  <div className="p-3 sm:p-4 rounded-xl bg-[hsl(var(--kloak-warning))]/10 border border-[hsl(var(--kloak-warning))]/20 backdrop-blur-sm space-y-3">
                    <div className="text-xs sm:text-sm text-muted-foreground">
                      <p className="mb-2 font-medium text-foreground">
                        By using Kloak, you agree to our Terms and Conditions.
                        You understand that:
                      </p>
                      <ul className="space-y-1.5">
                        <li className="flex items-start gap-2">
                          <span className="text-[hsl(var(--kloak-warning))] mt-0.5">
                            •
                          </span>
                          <span>Your secret key is your sole responsibility</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-[hsl(var(--kloak-warning))] mt-0.5">
                            •
                          </span>
                          <span>We cannot recover lost keys or accounts</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-[hsl(var(--kloak-warning))] mt-0.5">
                            •
                          </span>
                          <span>You will use the platform responsibly</span>
                        </li>
                      </ul>
                    </div>

                    <div className="flex items-start gap-3 pt-3 border-t border-[hsl(var(--kloak-warning))]/20">
                      <Checkbox
                        id="terms-accept"
                        checked={termsAccepted}
                        onCheckedChange={(checked) =>
                          setTermsAccepted(checked === true)
                        }
                        className="mt-0.5 rounded-md"
                      />
                      <Label
                        htmlFor="terms-accept"
                        className="text-xs sm:text-sm cursor-pointer leading-relaxed font-medium"
                      >
                        I have read and agree to the Terms and Conditions
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="pt-4 sm:pt-5">
                  <Button
                    className="w-full h-10 sm:h-11 rounded-xl font-medium"
                    disabled={!canProceedStep1}
                    onClick={handleNext}
                  >
                    Continue
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </>
            )}

            {/* Step 2: Secret Key */}
            {currentStep === 2 && (
              <>
                <DialogHeader className="text-center pb-4">
                  <div className="flex justify-center mb-4">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[hsl(var(--kloak-warning))]/15 backdrop-blur-sm flex items-center justify-center">
                      <Key className="w-7 h-7 sm:w-8 sm:h-8 text-[hsl(var(--kloak-warning))]" />
                    </div>
                  </div>
                  <DialogTitle className="text-xl sm:text-2xl font-medium tracking-tight">
                    Your Secret Key is Everything
                  </DialogTitle>
                  <DialogDescription className="text-sm sm:text-base text-muted-foreground">
                    This is the only way to access your account.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 sm:space-y-5">
                  {/* Warning */}
                  <div className="p-3 sm:p-4 rounded-xl bg-[hsl(var(--kloak-warning))]/10 border border-[hsl(var(--kloak-warning))]/20 backdrop-blur-sm">
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      Unlike traditional apps, Kloak uses a{" "}
                      <span className="font-medium text-foreground">
                        secret key
                      </span>{" "}
                      instead of email and password. This key is the{" "}
                      <span className="font-medium text-foreground">
                        only way
                      </span>{" "}
                      to access your account — we cannot recover it for you.
                    </p>
                  </div>

                  {/* Key Display */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Your Secret Key</Label>
                    <div className="relative">
                      <div className="bg-secondary/50 rounded-lg p-4 font-mono text-xs sm:text-sm break-all border border-border pr-10">
                        {showKey ? secretKey : "•".repeat(64)}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-2 h-7 w-7 p-0"
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

                  {/* Copy Button */}
                  <Button
                    variant={keyCopied ? "secondary" : "outline"}
                    className="w-full"
                    onClick={copyKey}
                  >
                    {keyCopied ? (
                      <>
                        <Check className="w-4 h-4 mr-2 text-[hsl(var(--kloak-success))]" />
                        Copied to Clipboard
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy to Clipboard
                      </>
                    )}
                  </Button>

                  {/* Storage Instructions */}
                  <div className="p-3 sm:p-4 rounded-xl bg-secondary/30 border border-border/30 backdrop-blur-sm">
                    <h4 className="font-medium tracking-tight text-sm sm:text-base mb-2">
                      Store it safely:
                    </h4>
                    <ul className="text-xs sm:text-sm text-muted-foreground space-y-1.5">
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        <span>Save it in a password manager (recommended)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        <span>Write it down and keep it somewhere secure</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        <span>Never share it with anyone</span>
                      </li>
                    </ul>
                  </div>

                  {/* Confirmation Checkbox */}
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-secondary/30 border border-border/30">
                    <Checkbox
                      id="key-stored"
                      checked={keyStoredAccepted}
                      onCheckedChange={(checked) =>
                        setKeyStoredAccepted(checked === true)
                      }
                      className="mt-0.5 rounded-md"
                    />
                    <Label
                      htmlFor="key-stored"
                      className="text-xs sm:text-sm cursor-pointer leading-relaxed font-medium"
                    >
                      I have stored my key somewhere safe and understand it is my
                      sole responsibility
                    </Label>
                  </div>
                </div>

                <div className="pt-4 sm:pt-5">
                  <Button
                    className="w-full h-10 sm:h-11 rounded-xl font-medium"
                    disabled={!canProceedStep2}
                    onClick={handleNext}
                  >
                    Continue
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </>
            )}

            {/* Step 3: Final Welcome */}
            {currentStep === 3 && (
              <>
                <DialogHeader className="text-center pb-4">
                  <div className="flex justify-center mb-4">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary/15 backdrop-blur-sm flex items-center justify-center">
                      <PartyPopper className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
                    </div>
                  </div>
                  <DialogTitle className="text-xl sm:text-2xl font-medium tracking-tight">
                    You're All Set!
                  </DialogTitle>
                  <DialogDescription className="text-sm sm:text-base text-muted-foreground">
                    Welcome to the Kloak community.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 sm:space-y-5">
                  {/* Success Message */}
                  <div className="p-3 sm:p-4 rounded-xl bg-[hsl(var(--kloak-success))]/10 border border-[hsl(var(--kloak-success))]/20 backdrop-blur-sm text-center">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Your account is ready. You can now start messaging, join
                      servers, and connect with others —{" "}
                      <span className="font-medium text-foreground">
                        all while keeping your privacy intact
                      </span>
                      .
                    </p>
                  </div>

                  {/* FAQ Reminder */}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/20 border border-border/20">
                    <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center flex-shrink-0">
                      <HelpCircle className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="text-xs sm:text-sm min-w-0">
                      <span className="text-muted-foreground">
                        Have questions? Check out our{" "}
                      </span>
                      <button
                        className="text-primary hover:underline font-medium"
                        onClick={() => {
                          // FAQ page not built yet
                        }}
                      >
                        FAQ page
                      </button>
                      <span className="text-muted-foreground"> for answers.</span>
                    </div>
                  </div>

                  {/* Find Key Later */}
                  <div className="p-3 sm:p-4 rounded-xl bg-secondary/30 border border-border/30 backdrop-blur-sm">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                        <Key className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        <p className="font-medium text-foreground mb-1">
                          Finding Your Key Later
                        </p>
                        <p>
                          You can view your secret key anytime in{" "}
                          <span className="font-medium text-foreground">
                            User Settings → Account → View Secret Key
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 sm:pt-5">
                  <Button
                    className="w-full h-10 sm:h-11 rounded-xl font-medium"
                    onClick={handleFinish}
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Start Using Kloak
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
