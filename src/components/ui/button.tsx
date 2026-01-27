import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap text-[13px] sm:text-[15px] font-semibold tracking-[0.01em] ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-3.5 sm:[&_svg]:size-4 [&_svg]:shrink-0 select-none",
  {
    variants: {
      variant: {
        // Primary - Main action button (silver-grey, black text)
        primary: "rounded-[4px] bg-brand-600 text-black hover:bg-brand-700 active:bg-brand-800 active:scale-[0.98]",

        // Secondary - Supporting action (subtle fill)
        secondary: "rounded-[4px] bg-neutral-200 text-neutral-900 hover:bg-neutral-300 active:bg-neutral-400/80",

        // Tertiary - Subtle/ghost action
        tertiary: "rounded-[4px] bg-transparent text-neutral-800 hover:bg-neutral-200 active:bg-neutral-300",

        // Outline - Bordered button (silver-grey border)
        outline:
          "rounded-[4px] border border-neutral-300 bg-transparent text-neutral-800 hover:bg-neutral-100 hover:border-neutral-400 active:bg-neutral-200",

        // Error/Destructive - Dangerous actions
        error: "rounded-[4px] bg-red-600 text-white hover:bg-red-700 active:bg-red-800",

        // Warning - Caution actions
        warning: "rounded-[4px] bg-amber-500 text-black hover:bg-amber-400 active:bg-amber-600",

        // Success - Positive actions
        success: "rounded-[4px] bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800",

        // Ghost - Minimal presence
        ghost:
          "rounded-[4px] bg-transparent text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 active:bg-neutral-200",

        // Link - Text-only button
        link: "rounded-[4px] text-brand-600 hover:text-brand-700 underline-offset-4 hover:underline p-0 h-auto font-medium",

        // Legacy default (maps to primary)
        default: "rounded-[4px] bg-brand-600 text-black hover:bg-brand-700 active:bg-brand-800 active:scale-[0.98]",

        // Legacy destructive (maps to error)
        destructive: "rounded-[4px] bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
      },
      size: {
        default: "h-9 sm:h-10 px-3 sm:px-4 py-2",
        sm: "h-7 sm:h-8 px-2.5 sm:px-3 text-[12px] sm:text-[13px]",
        lg: "h-11 sm:h-12 px-5 sm:px-6 text-[14px] sm:text-[16px]",
        xl: "h-12 sm:h-14 px-6 sm:px-8 text-[15px] sm:text-[17px]",
        icon: "h-9 w-9 sm:h-10 sm:w-10 p-0",
        "icon-sm": "h-7 w-7 sm:h-8 sm:w-8 p-0",
      },
      rounded: {
        default: "",
        full: "!rounded-full",
        md: "!rounded-md",
        lg: "!rounded-lg",
        xl: "!rounded-xl",
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
