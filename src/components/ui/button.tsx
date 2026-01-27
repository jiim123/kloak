import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-[15px] font-semibold tracking-[0.005em] ring-offset-background transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
        // Primary - Main action button (silver-grey with black text)
        primary: "rounded-[3px] bg-brand-600 text-black hover:bg-brand-700 active:bg-brand-800",

        // Secondary - Supporting action (darker grey)
        secondary: "rounded-[3px] bg-brand-400 text-white hover:bg-brand-500 active:bg-brand-400/80",

        // Tertiary - Subtle/ghost action
        tertiary: "rounded-[3px] bg-transparent text-foreground hover:bg-brand-600/10 active:bg-brand-600/20",

        // Outline - Bordered button (silver-grey border)
        outline:
          "rounded-[3px] border border-brand-600 bg-transparent text-foreground hover:bg-brand-600/10 hover:border-brand-700 active:bg-brand-600/20",

        // Error/Destructive - Dangerous actions
        error: "rounded-[3px] bg-red-600 text-white hover:bg-red-700 active:bg-red-800",

        // Warning - Caution actions
        warning: "rounded-[3px] bg-amber-500 text-black hover:bg-amber-400 active:bg-amber-600",

        // Ghost - Minimal presence
        ghost:
          "rounded-[3px] bg-transparent text-neutral-500 hover:text-foreground hover:bg-brand-600/10 active:bg-brand-600/15",
        // Link - Text-only button
        link: "rounded-[3px] text-primary underline-offset-4 hover:underline p-0 h-auto",
        // Legacy default (maps to primary)
        default: "rounded-[3px] bg-primary text-primary-foreground hover:bg-primary/85 active:bg-primary/75",
        // Legacy destructive (maps to error)
        destructive:
          "rounded-[3px] bg-destructive text-destructive-foreground hover:bg-destructive/85 active:bg-destructive/75",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-[13px]",
        lg: "h-12 px-6 text-[16px]",
        icon: "h-10 w-10 p-0",
      },
      rounded: {
        default: "",
        full: "!rounded-full",
        md: "!rounded-md",
        lg: "!rounded-lg",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
      rounded: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      rounded,
      asChild = false,
      loading = false,
      iconLeft,
      iconRight,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const isDisabled = disabled || loading;

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, rounded, className }))}
        ref={ref}
        disabled={isDisabled}
        {...props}
      >
        {loading && <Loader2 className="animate-spin" />}
        {!loading && iconLeft}
        {children}
        {!loading && iconRight}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
