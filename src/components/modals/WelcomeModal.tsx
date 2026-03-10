import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { DotLottiePlayer } from "@dotlottie/react-player";
import { Link } from "react-router-dom";
import checkmarkLottie from "@/assets/checkmark.lottie";

interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
}

export const WelcomeModal = ({ open, onClose }: WelcomeModalProps) => {
  const [step, setStep] = useState(1);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [keyStored, setKeyStored] = useState(false);

  const handleClose = () => {
    if (step === 3) {
      onClose();
    }
  };

  const handleFinish = () => {
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent
        className="sm:max-w-md max-w-[calc(100vw-2rem)] bg-background/95 backdrop-blur-xl border-border/50 rounded-2xl p-0"
        onPointerDownOutside={(e) => step !== 3 && e.preventDefault()}
        onEscapeKeyDown={(e) => step !== 3 && e.preventDefault()}
      >
        <div className="p-4 sm:p-6">
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-5">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  s <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>

          {/* Step 1: Platform Rules */}
          {step === 1 && (
            <div className="space-y-4">
              <DialogHeader className="text-left pb-0">
                <DialogTitle className="text-lg font-medium tracking-tight">
                  Platform Rules
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Before getting started, please review our guidelines.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="p-3 rounded-xl bg-secondary/30 border border-border/30 space-y-2">
                  <p className="font-medium text-foreground text-sm">By using Kloak, you agree to:</p>
                  <ul className="space-y-1.5">
                    <li className="flex items-start gap-2">
                      <span className="text-muted-foreground/70 mt-0.5">•</span>
                      <span>Treat others with respect</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-muted-foreground/70 mt-0.5">•</span>
                      <span>Not share illegal or harmful content</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-muted-foreground/70 mt-0.5">•</span>
                      <span>Use the platform responsibly</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-muted-foreground/70 mt-0.5">•</span>
                      <span>Take responsibility for your account security</span>
                    </li>
                  </ul>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">Read our full </span>
                  <Link to="/terms" className="text-primary hover:underline font-medium" onClick={() => window.open('/terms', '_blank')}>
                    Terms
                  </Link>
                  <span className="text-muted-foreground">and</span>
                  <Link to="/faq" className="text-primary hover:underline font-medium" onClick={() => window.open('/faq', '_blank')}>
                    FAQ
                  </Link>
                </div>

                <div className="flex items-start gap-3 pt-3 border-t border-border/30">
                  <Checkbox
                    id="terms-accept"
                    checked={termsAccepted}
                    onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                    className="mt-0.5 rounded-md"
                  />
                  <Label
                    htmlFor="terms-accept"
                    className="text-sm cursor-pointer leading-relaxed font-medium text-foreground"
                  >
                    I accept the Terms and Conditions
                  </Label>
                </div>
              </div>

              <Button
                className="w-full h-10 rounded-xl font-medium"
                disabled={!termsAccepted}
                onClick={() => setStep(2)}
              >
                Continue
              </Button>
            </div>
          )}

          {/* Step 2: Secret Key */}
          {step === 2 && (
            <div className="space-y-4">
              <DialogHeader className="text-left pb-0">
                <DialogTitle className="text-lg font-medium tracking-tight">
                  Your Secret Key
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Kloak uses a secret key instead of a password. This is the only way to access your account.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-secondary/30 border border-border/30 space-y-2">
                  <p className="font-medium text-foreground text-sm">Keep it safe</p>
                  <ul className="text-sm text-muted-foreground space-y-1.5">
                    <li className="flex items-start gap-2">
                      <span className="text-muted-foreground/70 mt-0.5">•</span>
                      <span>Save it in a password manager</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-muted-foreground/70 mt-0.5">•</span>
                      <span>Write it down somewhere secure</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-muted-foreground/70 mt-0.5">•</span>
                      <span>Never share it with anyone</span>
                    </li>
                  </ul>
                </div>

                <div className="p-3 rounded-xl bg-secondary/30 border border-border/30 space-y-2">
                  <p className="font-medium text-foreground text-sm">Find it later</p>
                  <p className="text-sm text-muted-foreground">
                    Settings → Account → View Secret Key
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-muted-foreground">
                    If you lose your key, <span className="font-medium text-foreground">we cannot recover it</span>. Your account will be permanently inaccessible.
                  </p>
                </div>

                <div className="flex items-start gap-3 pt-3 border-t border-border/30">
                  <Checkbox
                    id="key-stored"
                    checked={keyStored}
                    onCheckedChange={(checked) => setKeyStored(checked === true)}
                    className="mt-0.5 rounded-md"
                  />
                  <Label
                    htmlFor="key-stored"
                    className="text-sm cursor-pointer leading-relaxed font-medium text-foreground"
                  >
                    I have stored my secret key
                  </Label>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1 h-10 rounded-xl font-medium"
                  onClick={() => setStep(1)}
                >
                  Back
                </Button>
                <Button
                  className="flex-1 h-10 rounded-xl font-medium"
                  disabled={!keyStored}
                  onClick={() => setStep(3)}
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Welcome */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <DotLottiePlayer
                  src={checkmarkLottie}
                  autoplay
                  style={{ width: 120, height: 120 }}
                />
              </div>

              <div className="text-center space-y-2">
                <h2 className="text-xl font-medium tracking-tight text-foreground">
                  You're all set!
                </h2>
                <p className="text-sm text-muted-foreground">
                  Welcome to Kloak. Your privacy-first messaging experience starts now.
                </p>
              </div>

              <Button
                className="w-full h-10 rounded-xl font-medium"
                onClick={handleFinish}
              >
                Start using Kloak
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
