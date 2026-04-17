import { memo } from "react";
import { ChevronDown } from "lucide-react";

interface JumpToPresentProps {
  visible: boolean;
  newMessageCount: number;
  onClick: () => void;
}

export const JumpToPresent = memo(({ visible, newMessageCount, onClick }: JumpToPresentProps) => {
  return (
    <div
      className="absolute bottom-4 right-4 z-10"
      style={{
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        transition: "opacity 120ms ease-out",
        willChange: "opacity",
      }}
    >
      <button
        onClick={onClick}
        tabIndex={visible ? 0 : -1}
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-md"
      >
        <ChevronDown className="w-4 h-4" />
        {newMessageCount > 0 ? `${newMessageCount} new` : "Jump to present"}
      </button>
    </div>
  );
});

JumpToPresent.displayName = "JumpToPresent";
