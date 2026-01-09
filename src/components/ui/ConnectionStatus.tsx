import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wifi, WifiOff, Loader2, Signal, SignalLow, SignalMedium, SignalHigh, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConnectionStatus } from "@/hooks/useConnectionStatus";
import { useSyncStore } from "@/stores/syncStore";

interface ConnectionStatusProps {
  className?: string;
  showLatency?: boolean;
  compact?: boolean;
}

export function ConnectionStatus({ className, showLatency = false, compact = false }: ConnectionStatusProps) {
  const { status, isConnected, isReconnecting, latency, quality, reconnectAttempts } = useConnectionStatus();
  const { sync } = useSyncStore();
  const [showBanner, setShowBanner] = useState(false);

  // Show banner on disconnection, hide after reconnection
  useEffect(() => {
    if (!isConnected || isReconnecting) {
      setShowBanner(true);
    } else if (isConnected && showBanner) {
      // Keep showing "Connected" briefly
      const timer = setTimeout(() => setShowBanner(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, isReconnecting, showBanner]);

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
            className={cn(
              "flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-full shadow-lg backdrop-blur-sm",
              !isConnected && !isReconnecting && "bg-destructive/90 text-destructive-foreground",
              isReconnecting && "bg-[hsl(var(--kloak-warning))]/90 text-white",
              isConnected && "bg-[hsl(var(--kloak-success))]/90 text-white",
            )}
          >
            {!isConnected && !isReconnecting && (
              <>
                <WifiOff className="w-4 h-4" />
                <span>You're offline</span>
              </>
            )}
            {isReconnecting && (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Reconnecting{reconnectAttempts > 1 ? ` (attempt ${reconnectAttempts})` : ""}...</span>
              </>
            )}
            {isConnected && showBanner && (
              <>
                <Wifi className="w-4 h-4" />
                <span>Connected</span>
                {sync.pendingOperations > 0 && (
                  <span className="text-xs opacity-75">
                    • Syncing {sync.pendingOperations} item{sync.pendingOperations > 1 ? "s" : ""}
                  </span>
                )}
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
