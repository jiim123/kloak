import { cn } from "@/lib/utils";

interface BotTagProps {
  className?: string;
}

export const BotTag = ({ className }: BotTagProps) => {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md bg-[#5865F2] text-white",
        "text-[10px] font-bold uppercase tracking-wide leading-none",
        "px-1.5 py-0.5",
        className,
      )}
    >
      BOT
    </span>
  );
};

