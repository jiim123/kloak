import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, Signal, SignalLow, SignalMedium, SignalHigh, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConnectionStatus } from "@/hooks/useConnectionStatus";

interface ConnectionStatusProps {
  className?: string;
  showLatency?: boolean;
  compact?: boolean;
}

export function ConnectionStatus({ className, showLatency = false, compact = false }: ConnectionStatusProps) {
  const { status, isConnected, isReconnecting, latency, quality } = useConnectionStatus();
  const [showBanner, setShowBanner] = useState(false);

  // Only show banner when truly disconnected (not reconnecting)
  useEffect(() => {
    setShowBanner(!isConnected && !isReconnecting);
  }, [isConnected, isReconnecting]);

  // Compact indicator (for sidebar/header)
  if (compact) {
    const QualityIcon =
      quality === "excellent"
        ? SignalHigh
        : quality === "good"
          ? SignalMedium
          : quality === "poor"
            ? SignalLow
            : Signal;

    return (
      <div className={cn("flex items-center gap-1", className)}>
        {isReconnecting ? (
          <Loader2 className="w-3 h-3 animate-spin text-[hsl(var(--kloak-warning))]" />
        ) : !isConnected ? (
          <WifiOff className="w-3 h-3 text-destructive" />
        ) : (
          <QualityIcon
            className={cn(
              "w-3 h-3",
              quality === "excellent" && "text-[hsl(var(--kloak-success))]",
              quality === "good" && "text-primary",
              quality === "poor" && "text-[hsl(var(--kloak-warning))]",
            )}
          />
        )}
        {showLatency && latency && latency > 0 && (
          <span className="text-[10px] text-muted-foreground">{latency}ms</span>
        )}
      </div>
    );
  }

  // Floating banner
  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 30,
          }}
          className={cn("fixed top-4 left-1/2 -translate-x-1/2 z-50", className)}
        >
          <div
            className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-full shadow-lg backdrop-blur-sm bg-destructive/90 text-destructive-foreground"
          >
            <WifiOff className="w-4 h-4" />
            <span>You're offline</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
