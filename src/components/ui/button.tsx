import { CircleNotch, Link as LinkIcon } from "@phosphor-icons/react";
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
 "inline-flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap text-[13px] sm:text-[15px] font-normal tracking-[0.01em] ring-offset-background transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-3.5 sm:[&_svg]:size-4 [&_svg]:shrink-0 select-none",
 {
 variants: {
 variant: {
 // Primary - Main action button (solid foreground, pill shape)
 primary:
 "rounded-full bg-foreground text-background hover:bg-foreground/90 active:bg-foreground/80 border-0 tracking-wide",

 // Secondary - Supporting action (ghost, pill shape)
 secondary:
 "rounded-full bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted active:bg-muted/80 tracking-wide",

 // Tertiary - Subtle/ghost action
 tertiary:
 "rounded-[4px] bg-transparent text-tertiary-foreground hover:bg-tertiary-hover active:bg-tertiary-active",

 // Outline - Bordered button
 outline:
 "rounded-[4px] border border-border bg-transparent text-foreground hover:bg-secondary hover:border-neutral-400 active:bg-secondary-hover",

 // Error/Destructive - Dangerous actions
 error:
 "rounded-[4px] bg-destructive text-destructive-foreground hover:bg-destructive-hover hover:shadow-[0_4px_12px_hsl(var(--destructive)/0.3)] active:bg-destructive-active",

 // Warning - Caution actions
 warning:
 "rounded-[4px] bg-warning text-warning-foreground hover:bg-warning-hover hover:shadow-[0_4px_12px_hsl(var(--warning)/0.3)] active:bg-warning-active",

 // Success - Positive actions
 success:
 "rounded-[4px] bg-success text-success-foreground hover:bg-success-hover hover:shadow-[0_4px_12px_hsl(var(--success)/0.3)] active:bg-success-active",

 // Ghost - Minimal presence
 ghost:
 "rounded-[4px] bg-transparent text-muted-foreground hover:text-foreground hover:bg-secondary active:bg-secondary-hover",

 // Link - Text-only button
 link: "rounded-[4px] text-primary hover:text-primary-hover underline-offset-4 hover:underline p-0 h-auto font-medium",

 // Legacy default (maps to primary)
 default:
 "rounded-full bg-foreground text-background hover:bg-foreground/90 active:bg-foreground/80 border-0 tracking-wide",

 // Legacy destructive (maps to error)
 destructive:
 "rounded-[4px] bg-destructive text-destructive-foreground hover:bg-destructive-hover hover:shadow-[0_4px_12px_hsl(var(--destructive)/0.3)] active:bg-destructive-active",
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
 {loading && <CircleNotch className="animate-spin" />}
 {!loading && iconLeft}
 {children}
 {!loading && iconRight}
 </Comp>
 );
 },
);
Button.displayName = "Button";

export { Button, buttonVariants };
