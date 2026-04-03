import { Toaster as Sonner, toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { CheckCircle2, XCircle, AlertTriangle, X } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const isMobile = useIsMobile();

  return (
    <Sonner
      theme="dark"
      position={isMobile ? "top-center" : "bottom-right"}
      visibleToasts={3}
      closeButton
      gap={8}
      className="toaster group"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "kloak-toast w-full flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.3)] font-sans text-sm max-w-[420px]",
          success:
            "bg-emerald-950 border-emerald-500/20 text-emerald-200",
          error:
            "bg-red-950 border-red-500/20 text-red-200",
          warning:
            "bg-amber-950 border-amber-500/20 text-amber-200",
          info:
            "bg-amber-950 border-amber-500/20 text-amber-200",
          title: "text-[14px] font-medium leading-snug",
          description: "text-[13px] opacity-70 mt-0.5 leading-snug",
          closeButton:
            "!bg-transparent !border-0 !text-current opacity-50 hover:opacity-100 transition-opacity",
        },
      }}
      icons={{
        success: (
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/15 shrink-0 mt-0.5 kloak-toast-icon-fade">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </span>
        ),
        error: (
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-500/15 shrink-0 mt-0.5 kloak-toast-icon-fade">
            <XCircle className="w-3.5 h-3.5 text-red-400" />
          </span>
        ),
        warning: (
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/15 shrink-0 mt-0.5 kloak-toast-icon-fade">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          </span>
        ),
        info: (
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/15 shrink-0 mt-0.5 kloak-toast-icon-fade">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          </span>
        ),
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
