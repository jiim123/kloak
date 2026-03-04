import { ChevronDown } from "lucide-react";

interface JumpToPresentProps {
  visible: boolean;
  newMessageCount: number;
  onClick: () => void;
}

export const JumpToPresent = ({ visible, newMessageCount, onClick }: JumpToPresentProps) => {
  if (!visible) return null;

  return (
    <div className="absolute bottom-4 right-4 z-10">
      <button
        onClick={onClick}
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-md hover:opacity-90 transition-opacity duration-150"
      >
        <ChevronDown className="w-4 h-4" />
        {newMessageCount > 0 ? `${newMessageCount} new` : "Jump to present"}
      </button>
    </div>
  );
};
