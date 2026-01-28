import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(function ToastViewport({ className, ...props }, ref) {
  return (
    <ToastPrimitives.Viewport
      ref={ref}
      className={cn(
        "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",
        className,
      )}
      {...props}
    />
  );
});

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-xl border p-4 pr-8 shadow-lg transition-all duration-300 ease-out data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-toast-slide-in data-[state=closed]:animate-toast-slide-out",
  {
    variants: {
      variant: {
        default: "border-border bg-popover text-popover-foreground",
        destructive: "destructive group border-red-500/30 bg-red-500/10 text-red-400",
        success: "success group border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
        warning: "warning group border-amber-500/30 bg-amber-500/10 text-amber-400",
        info: "info group border-blue-500/30 bg-blue-500/10 text-blue-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Toast = React.forwardRef
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & VariantProps<typeof toastVariants>
>(function Toast({ className, variant, ...props }, ref) {
  return <ToastPrimitives.Root ref={ref} className={cn(toastVariants({ variant }), className)} {...props} />;
});

const ToastAction = React.forwardRef
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(function ToastAction({ className, ...props }, ref) {
  return (
    <ToastPrimitives.Action
      ref={ref}
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center rounded-lg border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-red-500/40 group-[.destructive]:hover:border-red-500/60 group-[.destructive]:hover:bg-red-500/20 group-[.destructive]:focus:ring-red-500 group-[.success]:border-emerald-500/40 group-[.success]:hover:border-emerald-500/60 group-[.success]:hover:bg-emerald-500/20 group-[.success]:focus:ring-emerald-500 group-[.warning]:border-amber-500/40 group-[.warning]:hover:border-amber-500/60 group-[.warning]:hover:bg-amber-500/20 group-[.warning]:focus:ring-amber-500 group-[.info]:border-blue-500/40 group-[.info]:hover:border-blue-500/60 group-[.info]:hover:bg-blue-500/20 group-[.info]:focus:ring-blue-500",
        className,
      )}
      {...props}
    />
  );
});

const ToastClose = React.forwardRef
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(function ToastClose({ className, ...props }, ref) {
  return (
    <ToastPrimitives.Close
      ref={ref}
      className={cn(
        "absolute right-2 top-2 rounded-lg p-1.5 text-foreground/50 opacity-0 transition-all group-hover:opacity-100 hover:text-foreground hover:bg-white/10 focus:opacity-100 focus:outline-none focus:ring-2 group-[.destructive]:text-red-400/70 group-[.destructive]:hover:text-red-300 group-[.destructive]:hover:bg-red-500/20 group-[.destructive]:focus:ring-red-500 group-[.success]:text-emerald-400/70 group-[.success]:hover:text-emerald-300 group-[.success]:hover:bg-emerald-500/20 group-[.success]:focus:ring-emerald-500 group-[.warning]:text-amber-400/70 group-[.warning]:hover:text-amber-300 group-[.warning]:hover:bg-amber-500/20 group-[.warning]:focus:ring-amber-500 group-[.info]:text-blue-400/70 group-[.info]:hover:text-blue-300 group-[.info]:hover:bg-blue-500/20 group-[.info]:focus:ring-blue-500",
        className,
      )}
      toast-close=""
      {...props}
    >
      <X className="h-4 w-4" />
    </ToastPrimitives.Close>
  );
});

const ToastTitle = React.forwardRef
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(function ToastTitle({ className, ...props }, ref) {
  return <ToastPrimitives.Title ref={ref} className={cn("text-sm font-semibold", className)} {...props} />;
});

const ToastDescription = React.forwardRef
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(function ToastDescription({ className, ...props }, ref) {
  return <ToastPrimitives.Description ref={ref} className={cn("text-sm opacity-80", className)} {...props} />;
});

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;
type ToastActionElement = React.ReactElement<typeof ToastAction>;

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};