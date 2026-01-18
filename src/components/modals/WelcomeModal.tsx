import { useState } from "react";
import { Shield, Key, Settings, HelpCircle, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

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
        className="max-w-lg"
        onPointerDownOutside={(e) => !termsAccepted && e.preventDefault()}
        onEscapeKeyDown={(e) => !termsAccepted && e.preventDefault()}
      >
        <DialogHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center">
              <Shield className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <DialogTitle className="text-2xl font-bold tracking-tight">Welcome to Kloak!</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Your privacy-first messaging experience starts here.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6 py-4">
            {/* Secret Key Importance */}
            <div className="p-4 rounded-lg bg-[hsl(var(--kloak-warning))/0.15] border border-[hsl(var(--kloak-warning))/0.3]">
              <div className="flex items-start gap-3">
                <Key className="w-5 h-5 text-[hsl(var(--kloak-warning))] flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <h3 className="font-semibold tracking-tight text-foreground">Your Secret Key is Everything</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Unlike traditional apps, Kloak uses a{" "}
                    <span className="font-medium text-foreground">secret key</span> instead of email and password. This
                    key is the <span className="font-medium text-foreground">only way</span> to access your account — we
                    cannot recover it for you.
                  </p>
                </div>
              </div>
            </div>

            {/* Store Your Key */}
            <div className="space-y-3">
              <h4 className="font-semibold tracking-tight flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">
                  1
                </span>
                Store Your Key Safely
              </h4>
              <ul className="text-sm text-muted-foreground space-y-2 ml-8">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Save it in a password manager (recommended)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Write it down and keep it somewhere secure
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Never share it with anyone
                </li>
              </ul>
            </div>

            {/* Find Your Key */}
            <div className="space-y-3">
              <h4 className="font-semibold tracking-tight flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">
                  2
                </span>
                Finding Your Key Later
              </h4>
              <div className="text-sm text-muted-foreground ml-8 p-3 rounded-lg bg-secondary/50 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Settings className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">User Settings → Account → View Secret Key</span>
                </div>
                <p>
                  You can view your secret key anytime while logged in. We recommend copying it immediately after
                  creating your account.
                </p>
              </div>
            </div>

            {/* FAQ Link */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border">
              <HelpCircle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <div className="text-sm">
                <span className="text-muted-foreground">Have questions? Check out our </span>
                <button
                  className="text-primary hover:underline font-medium"
                  onClick={() => {
                    // FAQ page not built yet - just a placeholder
                  }}
                >
                  FAQ page
                </button>
                <span className="text-muted-foreground"> for answers about the platform.</span>
              </div>
            </div>

            {/* Terms and Conditions Checkbox */}
            <div className="p-4 rounded-lg bg-secondary/50 border border-border space-y-3">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p className="mb-2">By using Kloak, you agree to our Terms and Conditions. You understand that:</p>
                  <ul className="space-y-1 ml-4">
                    <li>• Your secret key is your sole responsibility</li>
                    <li>• We cannot recover lost keys or accounts</li>
                    <li>• You will use the platform responsibly</li>
                  </ul>
                </div>
              </div>

              <div className="flex items-start gap-3 pt-2 border-t border-border">
                <Checkbox
                  id="terms-accept"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="terms-accept" className="text-sm cursor-pointer leading-relaxed font-medium">
                  I have read and agree to the Terms and Conditions
                </Label>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="pt-2">
          <Button className="w-full" disabled={!termsAccepted} onClick={handleClose}>
            Get Started
          </Button>
          {!termsAccepted && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Please accept the Terms and Conditions to continue
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
