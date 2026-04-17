import { X } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";


export interface FeatureDetail {
 icon: Icon;
 title: string;
 tagline: string;
 description: string;
 controversial: string;
}

interface FeatureDetailModalProps {
 feature: FeatureDetail | null;
 open: boolean;
 onClose: () => void;
}

export function FeatureDetailModal({ feature, open, onClose }: FeatureDetailModalProps) {
 if (!feature) return null;
 const Icon = feature.icon;

 return (
 <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
 <DialogContent
 hideCloseButton
 className="terminal-card max-w-2xl w-[calc(100%-2rem)] p-0 gap-0 bg-background border-muted-foreground/20 rounded-[4px] overflow-hidden max-h-[85vh] flex flex-col"
 >
 {/* Header row: icon | title | close — 3 columns */}
 <div className="flex border-b border-muted-foreground/20 shrink-0">
 <div className="w-[60px] flex items-center justify-center border-r border-muted-foreground/20 p-4">
 <Icon className="w-5 h-5 text-foreground" />
 </div>
 <div className="flex-1 flex items-center p-4">
 <DialogTitle className="text-[14px] uppercase tracking-widest text-foreground font-medium m-0">
 {feature.title}
 </DialogTitle>
 </div>
 <button
 onClick={onClose}
 className="w-[60px] flex items-center justify-center border-l border-muted-foreground/20 p-4 transition-colors duration-300 hover:bg-foreground group"
 >
 <X className="w-4 h-4 text-foreground transition-colors duration-300 group-hover:text-background" />
 </button>
 </div>

 {/* Scrollable body */}
 <div className="overflow-y-auto flex-1 min-h-0">
 {/* Tagline row */}
 <div className="border-b border-muted-foreground/20 p-6">
 <p className="text-base md:text-lg text-foreground font-light leading-relaxed">
 {feature.tagline}
 </p>
 </div>

 {/* Overview */}
 <div className="border-b border-muted-foreground/20 p-6">
 <div className="flex border-b border-muted-foreground/20 mb-4 pb-2">
 <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Overview</span>
 </div>
 <p className="text-[14px] text-muted-foreground leading-[1.8]">
 {feature.description}
 </p>
 </div>

 {/* Why It's Different */}
 <div className="p-6">
 <div className="flex border-b border-muted-foreground/20 mb-4 pb-2">
 <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Why It's Different</span>
 </div>
 <p className="text-[14px] text-muted-foreground leading-[1.8]">
 {feature.controversial}
 </p>
 </div>
 </div>
 </DialogContent>
 </Dialog>
 );
}
