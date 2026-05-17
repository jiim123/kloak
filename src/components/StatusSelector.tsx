import { useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import type { UserStatus } from "@/types";

interface StatusOption {
  value: UserStatus;
  label: string;
  dotClassName: string;
  description: string;
}

const statusOptions: StatusOption[] = [
  {
    value: "online",
    label: "Online",
    dotClassName: "bg-[#57F287]",
    description: "",
  },
  {
    value: "idle",
    label: "Idle",
    dotClassName: "bg-[#F0B232]",
    description: "",
  },
  {
    value: "dnd",
    label: "Do not disturb",
    dotClassName: "bg-[#ED4245]",
    description: "You will not receive any desktop notifications",
  },
  {
    value: "offline",
    label: "Invisible",
    dotClassName: "bg-[#B5BAC1]",
    description: "You will not appear online to others",
  },
];

interface StatusSelectorProps {
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}

export const StatusSelector = ({ children, side = "right", align = "start" }: StatusSelectorProps) => {
  const { user, updateStatus } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);

  const handleStatusChange = async (status: UserStatus) => {
    await updateStatus(status, { source: "manual" });
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent
        side={side}
        align={align}
        sideOffset={10}
        className="w-[19.5rem] rounded-[14px] border border-[#666B79] bg-[#585B68] p-0 text-[#F2F3F5] shadow-[0_18px_40px_rgba(0,0,0,0.35)]"
      >
        <div>
          {statusOptions.map((option, index) => (
            <div key={option.value}>
              {index > 0 && <DropdownMenuSeparator className="mx-4 bg-[#686D79]" />}
              <DropdownMenuItem
                onClick={() => void handleStatusChange(option.value)}
                className={cn(
                  "min-h-[42px] cursor-pointer gap-0 px-4 py-2 hover:bg-white/[0.03] focus:bg-white/[0.05]",
                  option.description ? "items-start" : "items-center",
                  user?.status === option.value && "bg-white/[0.04]",
                )}
              >
                <span
                  className={cn(
                    "mr-3 h-3 w-3 shrink-0 rounded-full",
                    option.dotClassName,
                    option.description && "mt-1.5",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold leading-tight text-[#F2F3F5]">
                    {option.label}
                  </p>
                  {option.description ? (
                    <p className="mt-0.5 max-w-[228px] text-[11px] leading-[1.25] text-[#C6C9D2]">
                      {option.description}
                    </p>
                  ) : null}
                </div>
              </DropdownMenuItem>
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
