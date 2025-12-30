import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[3px] text-sm font-medium tracking-tight ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

{
  /* Jump to present button */
}
{
  showJumpToPresent && (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="absolute bottom-4 right-4 z-10"
    >
      <Button
        onClick={scrollToBottom}
        className="relative overflow-hidden rounded-full shadow-xl backdrop-blur-md bg-background/80 border-2 border-primary/30 hover:bg-background/90 hover:border-primary/50 transition-all px-4 py-2 h-auto"
        size="sm"
      >
        {/* Animated border pulse */}
        <span className="absolute inset-0 rounded-full border-2 border-primary/50 animate-pulse-border" />

        {/* Content */}
        <div className="relative flex items-center gap-2">
          <ChevronDown className="w-4 h-4" />
          <span className="text-sm font-medium">
            {newMessageCount > 0 ? `${newMessageCount} new` : "Jump to present"}
          </span>
        </div>
      </Button>
    </motion.div>
  );
}
Button.displayName = "Button";

export { Button, buttonVariants };
