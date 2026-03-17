import { useState } from "react";
import {
  Copy,
  Check,
  Eye,
  EyeOff,
  ChevronRight,
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
import { useToast } from "@/hooks/use-toast";
import { CheckmarkAnimation } from "@/components/ui/checkmark-animation";

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

  const copyKey = async () => {
    if (!secretKey) return;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
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
        try { document.execCommand("copy"); } finally { document.body.removeChild(textArea); }
      }
      setKeyCopied(true);
      toast({ title: "Copied!", description: "Secret key copied to clipboard." });
    } catch (err) {
      console.error("Copy failed:", err);
      toast({ variant: "destructive", title: "Copy failed", description: "Please manually select and copy the key." });
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="w-[calc(100vw-1rem)] sm:w-auto sm:max-w-lg max-h-[90vh] p-0 bg-background border-border rounded-xl shadow-xl overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        hideCloseButton
      >
        <div
          className="overflow-y-auto overscroll-contain touch-pan-y max-h-[90vh] w-full"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="p-5 sm:p-6 w-full">
            {/* Step indicator */}
            <div className="flex items-center gap-1.5 mb-5">
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    step <= currentStep ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>

            {/* Step 1: Platform Rules */}
            {currentStep === 1 && (
              <>
                <DialogHeader className="text-left pb-4">
                  <DialogTitle className="text-lg font-semibold">
                    Platform Rules
                  </DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground">
                    Before you get started, here's what you need to know.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-2.5 text-sm text-muted-foreground">
                    <p>
                      Kloak is built on privacy. No email, no password — just a
                      secret key that only you control.
                    </p>
                    <ul className="space-y-1.5 list-disc list-inside">
                      <li>Your secret key is your sole responsibility</li>
                      <li>We cannot recover lost keys or accounts</li>
                      <li>Use the platform responsibly</li>
                    </ul>
                  </div>

                  <div className="flex gap-3 text-sm">
                    <a
                      href="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Terms & Conditions
                    </a>
                    <a
                      href="/faq"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      FAQ
                    </a>
                  </div>

                  <div className="flex items-start gap-3 pt-2 border-t border-border">
                    <Checkbox
                      id="terms-accept"
                      checked={termsAccepted}
                      onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                      className="mt-0.5 rounded-md"
                    />
                    <Label
                      htmlFor="terms-accept"
                      className="text-sm cursor-pointer leading-relaxed"
                    >
                      I accept the Terms and Conditions
                    </Label>
                  </div>
                </div>

                <div className="pt-5">
                  <Button
                    className="w-full rounded-lg"
                    disabled={!termsAccepted}
                    onClick={handleNext}
                  >
                    Continue
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </>
            )}

            {/* Step 2: Secret Key */}
            {currentStep === 2 && (
              <>
                <DialogHeader className="text-left pb-4">
                  <DialogTitle className="text-lg font-semibold">
                    Your Secret Key
                  </DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground">
                    This is the only way to access your account. Save it now.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Key display */}
                  <div className="relative">
                    <div className="bg-secondary/50 rounded-lg p-3.5 font-mono text-xs sm:text-sm break-all border border-border pr-10">
                      {showKey && secretKey ? secretKey : "•".repeat(secretKey?.length || 64)}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-2 h-7 w-7 p-0"
                      onClick={() => setShowKey(!showKey)}
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>

                  <Button
                    variant={keyCopied ? "secondary" : "outline"}
                    className="w-full"
                    onClick={copyKey}
                    disabled={!secretKey}
                  >
                    {keyCopied ? (
                      <><Check className="w-4 h-4 mr-2 text-[hsl(var(--kloak-success))]" /> Copied</>
                    ) : (
                      <><Copy className="w-4 h-4 mr-2" /> Copy to Clipboard</>
                    )}
                  </Button>

                  <div className="space-y-1.5 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Keep it safe</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>Use a password manager (recommended)</li>
                      <li>Write it down somewhere secure</li>
                      <li>Never share it with anyone</li>
                    </ul>
                    <p className="pt-1.5 text-xs">
                      This is the only time your key will be displayed.{" "}
                      <span className="text-foreground font-medium">
                        Save it now — it cannot be recovered later.
                      </span>
                    </p>
                  </div>

                  <div className="flex items-start gap-3 pt-2 border-t border-border">
                    <Checkbox
                      id="key-stored"
                      checked={keyStoredAccepted}
                      onCheckedChange={(checked) => setKeyStoredAccepted(checked === true)}
                      className="mt-0.5 rounded-md"
                    />
                    <Label
                      htmlFor="key-stored"
                      className="text-sm cursor-pointer leading-relaxed"
                    >
                      I have stored my secret key somewhere safe
                    </Label>
                  </div>
                </div>

                <div className="pt-5">
                  <Button
                    className="w-full rounded-lg"
                    disabled={!keyStoredAccepted}
                    onClick={handleNext}
                  >
                    Continue
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </>
            )}

            {/* Step 3: Welcome */}
            {currentStep === 3 && (
              <>
                <div className="flex justify-center mb-2">
                  <CheckmarkAnimation size={120} />
                </div>

                <DialogHeader className="text-left pb-4">
                  <DialogTitle className="text-lg font-semibold">
                    You're all set
                  </DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground">
                    Welcome to Kloak. Start messaging, join servers, and connect
                    with others — all while keeping your privacy intact.
                  </DialogDescription>
                </DialogHeader>

                <div className="pt-2">
                  <Button className="w-full rounded-lg" onClick={onClose}>
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
