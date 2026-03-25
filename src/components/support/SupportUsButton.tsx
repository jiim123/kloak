import { useState, useRef, useEffect, useCallback } from "react";
import { Heart, Coffee, ExternalLink, Copy, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const EthIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 1.75l-6.25 10.5L12 16l6.25-3.75L12 1.75z" opacity="0.6" />
    <path d="M12 16l-6.25-3.75L12 22.25l6.25-10L12 16z" />
  </svg>
);

const BtcIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M14.24 10.56c-.31 1.24-2.24.73-2.88.58l.53-2.15c.64.16 2.68.47 2.35 1.57zm-2.59 3.04c-.74-.18-3.22-.78-2.86-2.2l.56-2.25c.72.18 3.54.9 3.15 2.35l-.85 2.1zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm3.93 9.11c-.2 1.49-1.42 2.02-2.48 2.17.87.44 1.48 1.2 1.15 2.73-.41 1.9-2.12 2.13-4.07 1.65l-.42 1.7-.86-.21.42-1.67c-.22-.06-.45-.12-.69-.19l-.42 1.68-.86-.22.42-1.7c-.18-.05-.37-.1-.55-.15l-1.12-.28.55-1.04s.64.16.63.15c.35.09.52-.14.58-.29l.68-2.72.1.03c-.03-.01-.07-.02-.11-.03l.48-1.94c.02-.28-.08-.63-.56-.75.01-.01-.63-.16-.63-.16l.27-.99 1.19.3v-.01c.17.04.34.08.52.12l.42-1.67.86.22-.4 1.63c.23.05.46.11.69.16l.4-1.61.86.22-.42 1.67c1.59.46 2.63 1.08 2.43 2.55z" />
  </svg>
);

const SolIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M6.34 6.09h14.1a.52.52 0 01.37.89l-2.96 2.96H3.56a.52.52 0 01-.37-.89l3.15-2.96z" opacity="0.8" />
    <path d="M6.34 14.06l3.15-2.96h14.1a.52.52 0 01.37.89l-2.96 2.96H6.71a.52.52 0 01-.37-.89z" opacity="0.6" />
    <path d="M17.85 17.91H3.56a.52.52 0 01-.37-.89l3.15-2.96h14.29a.52.52 0 01.37.89l-3.15 2.96z" />
  </svg>
);

interface SupportItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  type: "link" | "crypto";
  url?: string;
  address?: string;
}

const items: SupportItem[] = [
  {
    id: "coffee",
    label: "Buy Me a Coffee",
    icon: Coffee,
    color: "text-yellow-400",
    type: "link",
    url: "https://buymeacoffee.com/kloak",
  },
  {
    id: "eth",
    label: "Ethereum",
    icon: EthIcon,
    color: "text-indigo-400",
    type: "crypto",
    address: "0xc53451af26Ad3c27C8fb8dB3780537d563BCA403",
  },
  {
    id: "btc",
    label: "Bitcoin",
    icon: BtcIcon,
    color: "text-orange-400",
    type: "crypto",
    address: "bc1qexyqeyqxg3qwwn2tjs3lpjag6jj8jwlq7sgppw",
  },
  {
    id: "sol",
    label: "Solana",
    icon: SolIcon,
    color: "text-purple-400",
    type: "crypto",
    address: "CowdHnqjoWj92HKCKCaAw4vfjYJNVEnhsxaerR5yiGUe",
  },
];

function CopyButton({
  address,
  colorClass,
}: {
  address: string;
  colorClass: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = address;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "p-1.5 rounded-md transition-colors hover:bg-secondary/80 flex-shrink-0",
        colorClass
      )}
      aria-label="Copy address"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

function SupportRow({ item }: { item: SupportItem }) {
  const Icon = item.icon;
  const isCrypto = item.type === "crypto";

  return (
    <div
      onClick={() => !isCrypto && item.url && window.open(item.url, "_blank")}
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border/50 transition-colors",
        isCrypto
          ? "p-2.5 sm:p-3"
          : "p-2.5 sm:p-3 cursor-pointer hover:bg-secondary/50"
      )}
    >
      {/* Label row */}
      <div className="flex items-center gap-2">
        <div className={cn("w-5 h-5 flex-shrink-0", item.color)}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-sm font-medium text-foreground">
          {item.label}
        </span>
        {!isCrypto && (
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground ml-auto flex-shrink-0" />
        )}
      </div>

      {/* Address row for crypto */}
      {isCrypto && item.address && (
        <div className="flex items-center gap-2 bg-secondary/50 rounded-md px-2.5 py-1.5">
          <span className="text-xs text-muted-foreground font-mono truncate flex-1">
            {item.address}
          </span>
          <CopyButton address={item.address} colorClass={item.color} />
        </div>
      )}
    </div>
  );
}

interface SupportUsButtonProps {
  tooltipsEnabled?: boolean;
  variant?: "default" | "overlay";
}

export const SupportUsButton = ({
  tooltipsEnabled = true,
  variant = "default",
}: SupportUsButtonProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 640 : false
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const handleMouseLeave = () => {
    if (isMobile) return;
    timeoutRef.current = setTimeout(() => setOpen(false), 250);
  };

  const handleMouseEnter = () => {
    if (isMobile) return;
    clearTimeout(timeoutRef.current);
  };

  // Outside click / touch
  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [close]);

  // Lock body scroll on mobile sheet
  useEffect(() => {
    if (isMobile && open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isMobile, open]);

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn("relative", variant === "overlay" && "w-full h-full")}
    >
      {/* Trigger button */}
      {variant === "overlay" ? (
        <button
          onClick={() => setOpen((p) => !p)}
          aria-label="Support Us"
          className="w-full h-full absolute inset-0 cursor-pointer"
        />
      ) : (
        <Tooltip delayDuration={300} open={tooltipsEnabled && !open ? undefined : false}>
          <TooltipTrigger asChild>
            <button
              onClick={() => setOpen((p) => !p)}
              aria-label="Support Us"
              className={cn(
                "w-10 h-10 inline-flex items-center justify-center rounded-[4px] transition-all duration-200 text-emerald-400",
                "hover:bg-emerald-500/10 hover:text-emerald-300",
                open && "bg-emerald-500/10"
              )}
            >
              <Heart className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="font-medium">
            Support Kloak
          </TooltipContent>
        </Tooltip>
      )}

      {/* MOBILE: bottom sheet */}
      {isMobile && (
        <>
          {/* Backdrop */}
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={close}
                className="fixed inset-0 z-[99] bg-black/50"
              />
            )}
          </AnimatePresence>

          {/* Sheet */}
          <div
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "fixed bottom-0 left-0 right-0 z-[100] bg-background border-t border-border/50 rounded-t-2xl transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] max-h-[85vh] overflow-y-auto",
              open ? "translate-y-0" : "translate-y-full"
            )}
            style={{
              paddingBottom:
                "calc(16px + env(safe-area-inset-bottom, 0px))",
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-3">
              <h3 className="text-base font-medium text-foreground">
                Support Kloak
              </h3>
              <button onClick={close} className="p-1.5 rounded-md hover:bg-secondary/80">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Items */}
            <div className="px-4 space-y-2">
              {items.map((item) => (
                <SupportRow key={item.id} item={item} />
              ))}
            </div>
          </div>
        </>
      )}

      {/* DESKTOP: dropdown */}
      {!isMobile && (
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full right-0 mt-2 w-80 bg-popover border border-border/50 rounded-xl shadow-xl p-3 space-y-2 z-50"
            >
              <h3 className="text-sm font-medium text-foreground px-1 pb-1">
                Support Kloak
              </h3>
              <div className="space-y-2">
                {items.map((item) => (
                  <SupportRow key={item.id} item={item} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
};
