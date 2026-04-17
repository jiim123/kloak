import { useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";

const DISMISSED_KEY = "kloak-alpha-notice-dismissed";

export const AlphaNoticeBanner = () => {
  const [isExpanded, setIsExpanded] = useState(() => {
    return localStorage.getItem(DISMISSED_KEY) !== "true";
  });

  const toggle = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    if (!next) localStorage.setItem(DISMISSED_KEY, "true");
    else localStorage.removeItem(DISMISSED_KEY);
  };

  return (
    <div className="shrink-0 border-b border-border/50 bg-muted/60">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        <span>Kloak Alpha Notice</span>
        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {isExpanded && (
        <div className="overflow-hidden">
          <div className="px-6 pb-3 text-xs text-muted-foreground leading-relaxed space-y-2 max-w-4xl mx-auto text-center">
            <p>
              Kloak is currently in very early alpha. Things are being built, broken, and improved daily — you may encounter incomplete features, unexpected behavior, or the odd bugs along the way. We appreciate your patience and your feedback!
            </p>
            <p>
              As a reminder, please don't share personal information such as your real name, address, phone number, email, or financial details in any server or chat. Alpha platforms are not yet hardened for sensitive data, and the safest information is the kind that was never shared in the first place. Stay smart, stay private.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
