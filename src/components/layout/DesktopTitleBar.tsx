import { ChevronLeft, ChevronRight, Minus, Square, X } from "lucide-react";
import { isTauri } from "@/lib/tauriRuntime";
import { useLocation, useNavigate } from "react-router-dom";

async function withCurrentWindow<T>(fn: (w: { minimize(): Promise<void>; toggleMaximize(): Promise<void>; close(): Promise<void> }) => Promise<T>) {
  if (!isTauri()) return undefined as T;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const w = getCurrentWindow();
  return await fn(w);
}

export function DesktopTitleBar({ title }: { title?: string }) {
  if (!isTauri()) return null;

  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="hidden md:flex h-9 w-full select-none items-stretch border-b border-white/5 bg-layout-sidebar text-foreground">
      {/* Left nav controls (Discord-like) */}
      <div className="flex items-center gap-1 px-2">
        <button
          type="button"
          aria-label="Back"
          className="h-7 w-7 rounded hover:bg-white/10 active:bg-white/15"
          onClick={() => navigate(-1)}
        >
          <ChevronLeft className="mx-auto h-4 w-4 opacity-90" />
        </button>
        <button
          type="button"
          aria-label="Forward"
          className="h-7 w-7 rounded hover:bg-white/10 active:bg-white/15"
          onClick={() => navigate(1)}
        >
          <ChevronRight className="mx-auto h-4 w-4 opacity-90" />
        </button>
      </div>

      {/* Drag region + title */}
      <div
        className="flex min-w-0 flex-1 items-center justify-center px-3 text-sm"
        data-tauri-drag-region
        onDoubleClick={() => void withCurrentWindow((w) => w.toggleMaximize())}
        title={title ?? "Kloak"}
      >
        <div className="min-w-0 max-w-[60%] truncate opacity-90">
          {title ?? (location.pathname.startsWith("/app") ? "Kloak" : "Kloak")}
        </div>
      </div>

      <div className="flex items-stretch">
        <button
          type="button"
          aria-label="Minimize"
          className="w-12 hover:bg-white/10 active:bg-white/15"
          onClick={() => void withCurrentWindow((w) => w.minimize())}
        >
          <Minus className="mx-auto h-4 w-4 opacity-90" />
        </button>
        <button
          type="button"
          aria-label="Maximize"
          className="w-12 hover:bg-white/10 active:bg-white/15"
          onClick={() => void withCurrentWindow((w) => w.toggleMaximize())}
        >
          <Square className="mx-auto h-3.5 w-3.5 opacity-90" />
        </button>
        <button
          type="button"
          aria-label="Close"
          className="w-12 hover:bg-red-500/80 active:bg-red-500"
          onClick={() => void withCurrentWindow((w) => w.close())}
        >
          <X className="mx-auto h-4 w-4 opacity-90" />
        </button>
      </div>
    </div>
  );
}

