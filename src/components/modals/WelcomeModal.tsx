import { useState } from "react";
import { Shield, Key, Settings, HelpCircle, FileText, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
}

export const WelcomeModal = ({ open, onClose }: WelcomeModalProps) => {
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleClose = () => {
    if (termsAccepted) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent
        className="max-w-lg max-w-[calc(100vw-2rem)] max-h-[90vh] p-0 bg-background/95 backdrop-blur-xl border-border/50 rounded-2xl shadow-xl overflow-hidden"
        onPointerDownOutside={(e) => !termsAccepted && e.preventDefault()}
        onEscapeKeyDown={(e) => !termsAccepted && e.preventDefault()}
      >
        {/* Scrollable content area with native scroll for mobile touch support */}
        <div
          className="overflow-y-auto overscroll-contain touch-pan-y max-h-[90vh]"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="p-4 sm:p-6">
            {/* Header */}
            <DialogHeader className="text-center pb-4">
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary/15 backdrop-blur-sm flex items-center justify-center">
                  <Shield className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
                </div>
              </div>
              <DialogTitle className="text-xl sm:text-2xl font-medium tracking-tight">Welcome to Kloak!</DialogTitle>
              <DialogDescription className="text-sm sm:text-base text-muted-foreground">
                Your privacy-first messaging experience starts here.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 sm:space-y-5">
              {/* Secret Key Importance - Warning Card */}
              <div className="p-3 sm:p-4 rounded-xl bg-[hsl(var(--kloak-warning))]/10 border border-[hsl(var(--kloak-warning))]/20 backdrop-blur-sm">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[hsl(var(--kloak-warning))]/20 flex items-center justify-center flex-shrink-0">
                    <Key className="w-4 h-4 sm:w-5 sm:h-5 text-[hsl(var(--kloak-warning))]" />
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <h3 className="font-medium tracking-tight text-foreground text-sm sm:text-base">
                      Your Secret Key is Everything
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      Unlike traditional apps, Kloak uses a{" "}
                      <span className="font-medium text-foreground">secret key</span> instead of email and password.
                      This key is the <span className="font-medium text-foreground">only way</span> to access your
                      account — we cannot recover it for you.
                    </p>
                  </div>
                </div>
              </div>

              {/* Store Your Key - Section Card */}
              <div className="p-3 sm:p-4 rounded-xl bg-secondary/30 border border-border/30 backdrop-blur-sm">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs sm:text-sm font-medium text-primary">1</span>
                  </div>
                  <div className="space-y-2 min-w-0">
                    <h4 className="font-medium tracking-tight text-sm sm:text-base">Store Your Key Safely</h4>
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
                </div>
              </div>

              {/* Find Your Key - Section Card */}
              <div className="p-3 sm:p-4 rounded-xl bg-secondary/30 border border-border/30 backdrop-blur-sm">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs sm:text-sm font-medium text-primary">2</span>
                  </div>
                  <div className="space-y-2 min-w-0">
                    <h4 className="font-medium tracking-tight text-sm sm:text-base">Finding Your Key Later</h4>
                    <div className="text-xs sm:text-sm text-muted-foreground p-2.5 sm:p-3 rounded-lg bg-secondary/50 border border-border/20">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
                        <span className="font-medium text-foreground text-xs sm:text-sm">
                          User Settings → Account → View Secret Key
                        </span>
                      </div>
                      <p className="leading-relaxed">
                        You can view your secret key anytime while logged in. We recommend copying it immediately after
                        creating your account.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* FAQ Link - Subtle Card */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/20 border border-border/20">
                <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center flex-shrink-0">
                  <HelpCircle className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="text-xs sm:text-sm min-w-0">
                  <span className="text-muted-foreground">Have questions? Check out our </span>
                  <button
                    className="text-primary hover:underline font-medium"
                    onClick={() => {
                      // FAQ page not built yet - just a placeholder
                    }}
                  >
                    FAQ page
                  </button>
                  <span className="text-muted-foreground"> for answers.</span>
                </div>
              </div>

              {/* Terms and Conditions - Section Card */}
              <div className="p-3 sm:p-4 rounded-xl bg-secondary/30 border border-border/30 backdrop-blur-sm space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-secondary/50 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-muted-foreground" />
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground min-w-0">
                    <p className="mb-2">By using Kloak, you agree to our Terms and Conditions. You understand that:</p>
                    <ul className="space-y-1">
                      <li className="flex items-start gap-2">
                        <span className="text-muted-foreground/70 mt-0.5">•</span>
                        <span>Your secret key is your sole responsibility</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-muted-foreground/70 mt-0.5">•</span>
                        <span>We cannot recover lost keys or accounts</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-muted-foreground/70 mt-0.5">•</span>
                        <span>You will use the platform responsibly</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Checkbox */}
                <div className="flex items-start gap-3 pt-3 border-t border-border/30">
                  <Checkbox
                    id="terms-accept"
                    checked={termsAccepted}
                    onCheckedChange={(checked) => setTermsAccepted(checked === true)}
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

            {/* Footer */}
            <div className="pt-4 sm:pt-5 space-y-2">
              <Button
                className="w-full h-10 sm:h-11 rounded-xl font-medium"
                disabled={!termsAccepted}
                onClick={handleClose}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Get Started
              </Button>
              {!termsAccepted && (
                <p className="text-[11px] sm:text-xs text-muted-foreground text-center">
                  Please accept the Terms and Conditions to continue
                </p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
