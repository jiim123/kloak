import { Circle, Eye, MinusCircle, Moon } from "lucide-react";
import { useState } from "react";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import type { UserStatus } from "@/types";

interface StatusOption {
  value: UserStatus;
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

const statusOptions: StatusOption[] = [
  {
    value: "online",
    label: "Online",
    icon: <Circle className="h-3 w-3 fill-current" />,
    color: "text-green-500",
    description: "You are available",
  },
  {
    value: "idle",
    label: "Idle",
    icon: <Moon className="h-3 w-3 fill-current" />,
    color: "text-yellow-500",
    description: "You may be away",
  },
  {
    value: "dnd",
    label: "Do Not Disturb",
    icon: <MinusCircle className="h-3 w-3" />,
    color: "text-red-500",
    description: "You will not receive notifications",
  },
  {
    value: "offline",
    label: "Invisible",
    icon: <Eye className="h-3 w-3" />,
    color: "text-gray-500",
    description: "You will appear offline",
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

  const currentStatus = statusOptions.find((s) => s.value === user?.status) || statusOptions[0];

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent side={side} align={align} className="w-72">
        <div className="border-b border-border px-3 py-2">
          <div className="flex items-center gap-2">
            <AvatarWithDecoration user={user} className="h-10 w-10" active={false} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">{user?.display_name || user?.username}</p>
              <span className={cn("inline-flex items-center gap-1 text-xs", currentStatus.color)}>
                {currentStatus.icon}
                {currentStatus.label}
              </span>
            </div>
          </div>
        </div>

        <div className="py-1">
          {statusOptions.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => void handleStatusChange(option.value)}
              className={cn("cursor-pointer px-3 py-2", user?.status === option.value && "bg-secondary")}
            >
              <span className={cn("mr-3 shrink-0", option.color)}>{option.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{option.label}</p>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </div>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
