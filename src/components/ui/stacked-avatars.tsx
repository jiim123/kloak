import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User } from "@/types";

interface StackedAvatarsProps {
  users: (User | null | undefined)[];
  size?: "sm" | "md" | "lg";
  className?: string;
  maxAvatars?: number;
}

const sizeClasses = {
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-12 h-12",
};

const offsetClasses = {
  sm: "-ml-2",
  md: "-ml-3",
  lg: "-ml-4",
};

const textClasses = {
  sm: "text-[10px]",
  md: "text-xs",
  lg: "text-base",
};

export const StackedAvatars = ({
  users,
  size = "md",
  className,
  maxAvatars = 3,
}: StackedAvatarsProps) => {
  // Filter out null/undefined users and limit to maxAvatars
  const validUsers = users.filter((u): u is User => u != null).slice(0, maxAvatars);

  if (validUsers.length === 0) {
    return (
      <div className={cn("relative flex items-center", className)}>
        <Avatar className={cn(sizeClasses[size], "border-2 border-background")}>
          <AvatarFallback className={cn("bg-secondary", textClasses[size])}>
            ?
          </AvatarFallback>
        </Avatar>
      </div>
    );
  }

  return (
    <div className={cn("relative flex items-center", className)}>
      {validUsers.map((user, index) => (
        <Avatar
          key={user.id}
          className={cn(
            sizeClasses[size],
            "border-2 border-background",
            index > 0 && offsetClasses[size]
          )}
          style={{ zIndex: validUsers.length - index }}
        >
          {user.avatar_url ? (
            <AvatarImage
              src={user.avatar_url}
              alt={user.display_name || user.username || "User"}
            />
          ) : null}
          <AvatarFallback
            className={cn("bg-secondary", textClasses[size])}
            style={{ backgroundColor: user.banner_color || "#5865F2" }}
          >
            {(user.display_name?.[0] || user.username?.[0] || "?").toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ))}
    </div>
  );
};
