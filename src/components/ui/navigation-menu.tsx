import { CaretDown, Envelope, FileText, House, Lightning, List, Sparkle, Stack, Users, X } from "@phosphor-icons/react";
import * as React from "react";
import * as NavigationMenuPrimitive from "@radix-ui/react-navigation-menu";
import { cva } from "class-variance-authority";


import { cn } from "@/lib/utils";

/* ============ SCROLL HOOK ============ */
function useScrolled(threshold = 20) {
 const [scrolled, setScrolled] = React.useState(false);

 React.useEffect(() => {
 const handleScroll = () => setScrolled(window.scrollY > threshold);
 window.addEventListener("scroll", handleScroll, { passive: true });
 return () => window.removeEventListener("scroll", handleScroll);
 }, [threshold]);

 return scrolled;
}

/* ============ NAVBAR WRAPPER ============ */
const NavbarWrapper = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { scrolled?: boolean }>(
 ({ className, scrolled, children, ...props }, ref) => (
 <div
 ref={ref}
 className={cn(
 "fixed top-0 left-0 right-0 z-40 transition-all duration-200",
 scrolled ? "px-4 pt-3" : "px-0 pt-0",
 className,
 )}
 {...props}
 >
 <div
 className={cn(
 "mx-auto transition-all duration-200",
 scrolled
 ? "max-w-2xl bg-white/70 backdrop-blur-xl shadow-lg shadow-slate-900/10 border border-white/50 rounded-2xl"
 : "max-w-full bg-white/0",
 )}
 >
 <div
 className={cn(
 "flex items-center justify-between transition-all duration-200",
 scrolled ? "h-14 px-4" : "h-20 px-4 max-w-6xl mx-auto",
 )}
 >
 {children}
 </div>
 </div>
 </div>
 ),
);
NavbarWrapper.displayName = "NavbarWrapper";

/* ============ LOGO ============ */
const NavbarLogo = React.forwardRef<
 HTMLAnchorElement,
 React.AnchorHTMLAttributes<HTMLAnchorElement> & { scrolled?: boolean }
>(({ className, scrolled, ...props }, ref) => (
 <a ref={ref} className={cn("flex items-center gap-2.5 group", className)} {...props}>
 <div
 className={cn(
 "bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:shadow-indigo-500/40 group-hover:scale-105 transition-all duration-200",
 scrolled ? "w-9 h-9" : "w-11 h-11",
 )}
 >
 <Lightning className={cn("text-white transition-all duration-200", scrolled ? "w-5 h-5" : "w-6 h-6")} fill="white" />
 </div>
 <span
 className={cn(
 "font-bold text-slate-900 tracking-tight transition-all duration-200",
 scrolled ? "text-xl" : "text-2xl",
 )}
 >
 Acme<span className="text-indigo-500">.</span>
 </span>
 </a>
));
NavbarLogo.displayName = "NavbarLogo";

/* ============ CTA BUTTON ============ */
const NavbarCTA = React.forwardRef<
 HTMLButtonElement,
 React.ButtonHTMLAttributes<HTMLButtonElement> & { scrolled?: boolean }
>(({ className, scrolled, children, ...props }, ref) => (
 <button
 ref={ref}
 className={cn(
 "hidden sm:flex items-center gap-2 bg-slate-900 text-white font-semibold hover:bg-slate-800 shadow-lg shadow-slate-900/25 hover:shadow-xl hover:shadow-slate-900/30 hover:-translate-y-0.5 transition-all duration-150",
 scrolled ? "px-4 py-2 rounded-xl text-sm" : "px-6 py-3 rounded-xl",
 className,
 )}
 {...props}
 >
 <Sparkle className={cn("transition-all duration-150", scrolled ? "w-3.5 h-3.5" : "w-4 h-4")} />
 <span>{children}</span>
 </button>
));
NavbarCTA.displayName = "NavbarCTA";

/* ============ MENU BUTTON ============ */
const NavbarMenuButton = React.forwardRef<
 HTMLButtonElement,
 React.ButtonHTMLAttributes<HTMLButtonElement> & { scrolled?: boolean }
>(({ className, scrolled, ...props }, ref) => (
 <button
 ref={ref}
 className={cn(
 "text-slate-600 hover:text-slate-900 hover:bg-slate-900/5 rounded-xl transition-all duration-150",
 scrolled ? "p-2" : "p-3",
 className,
 )}
 aria-label="Open menu"
 {...props}
 >
 <List className={cn("transition-all duration-150", scrolled ? "w-5 h-5" : "w-6 h-6")} />
 </button>
));
NavbarMenuButton.displayName = "NavbarMenuButton";

/* ============ NAVIGATION MENU (RADIX) ============ */
const NavigationMenu = React.forwardRef<
 React.ElementRef<typeof NavigationMenuPrimitive.Root>,
 React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Root> & { scrolled?: boolean }
>(({ className, children, scrolled, ...props }, ref) => (
 <NavigationMenuPrimitive.Root
 ref={ref}
 className={cn("hidden lg:flex relative z-10 max-w-max flex-1 items-center justify-center", className)}
 {...props}
 >
 {children}
 <NavigationMenuViewport />
 </NavigationMenuPrimitive.Root>
));
NavigationMenu.displayName = NavigationMenuPrimitive.Root.displayName;

const NavigationMenuList = React.forwardRef<
 React.ElementRef<typeof NavigationMenuPrimitive.List>,
 React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.List>
>(({ className, ...props }, ref) => (
 <NavigationMenuPrimitive.List
 ref={ref}
 className={cn("group flex flex-1 list-none items-center justify-center gap-1", className)}
 {...props}
 />
));
NavigationMenuList.displayName = NavigationMenuPrimitive.List.displayName;

const NavigationMenuItem = NavigationMenuPrimitive.Item;

const navigationMenuTriggerStyle = cva(
 "group inline-flex h-auto w-max items-center justify-center rounded-xl bg-transparent px-4 py-2 text-sm font-medium text-slate-600 transition-all duration-150 hover:bg-slate-900/5 hover:text-slate-900 focus:bg-slate-900/5 focus:text-slate-900 focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-slate-900/5 data-[state=open]:bg-slate-900/5",
);

const NavigationMenuTrigger = React.forwardRef<
 React.ElementRef<typeof NavigationMenuPrimitive.Trigger>,
 React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
 <NavigationMenuPrimitive.Trigger
 ref={ref}
 className={cn(navigationMenuTriggerStyle(), "group", className)}
 {...props}
 >
 {children}{" "}
 <CaretDown
 className="relative top-[1px] ml-1 h-3 w-3 transition-transform duration-200 group-data-[state=open]:rotate-180"
 aria-hidden="true"
 />
 </NavigationMenuPrimitive.Trigger>
));
NavigationMenuTrigger.displayName = NavigationMenuPrimitive.Trigger.displayName;

const NavigationMenuContent = React.forwardRef<
 React.ElementRef<typeof NavigationMenuPrimitive.Content>,
 React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Content>
>(({ className, ...props }, ref) => (
 <NavigationMenuPrimitive.Content
 ref={ref}
 className={cn(
 "left-0 top-0 w-full data-[motion^=from-]:animate-in data-[motion^=to-]:animate-out data-[motion^=from-]:fade-in data-[motion^=to-]:fade-out data-[motion=from-end]:slide-in-from-right-52 data-[motion=from-start]:slide-in-from-left-52 data-[motion=to-end]:slide-out-to-right-52 data-[motion=to-start]:slide-out-to-left-52 md:absolute md:w-auto",
 className,
 )}
 {...props}
 />
));
NavigationMenuContent.displayName = NavigationMenuPrimitive.Content.displayName;

const NavigationMenuLink = NavigationMenuPrimitive.Link;

const NavigationMenuViewport = React.forwardRef<
 React.ElementRef<typeof NavigationMenuPrimitive.Viewport>,
 React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Viewport>
>(({ className, ...props }, ref) => (
 <div className={cn("absolute left-0 top-full flex justify-center")}>
 <NavigationMenuPrimitive.Viewport
 className={cn(
 "origin-top-center relative mt-3 h-[var(--radix-navigation-menu-viewport-height)] w-full overflow-hidden rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-xl text-slate-900 shadow-xl shadow-slate-900/10 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-90 md:w-[var(--radix-navigation-menu-viewport-width)]",
 className,
 )}
 ref={ref}
 {...props}
 />
 </div>
));
NavigationMenuViewport.displayName = NavigationMenuPrimitive.Viewport.displayName;

const NavigationMenuIndicator = React.forwardRef<
 React.ElementRef<typeof NavigationMenuPrimitive.Indicator>,
 React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Indicator>
>(({ className, ...props }, ref) => (
 <NavigationMenuPrimitive.Indicator
 ref={ref}
 className={cn(
 "top-full z-[1] flex h-1.5 items-end justify-center overflow-hidden data-[state=visible]:animate-in data-[state=hidden]:animate-out data-[state=hidden]:fade-out data-[state=visible]:fade-in",
 className,
 )}
 {...props}
 >
 <div className="relative top-[60%] h-2 w-2 rotate-45 rounded-tl-sm bg-slate-200 shadow-md" />
 </NavigationMenuPrimitive.Indicator>
));
NavigationMenuIndicator.displayName = NavigationMenuPrimitive.Indicator.displayName;

/* ============ SIDEBAR ============ */
interface SidebarProps {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 items?: { icon: React.ElementType; label: string; href: string }[];
}

const Sidebar = ({ open, onOpenChange, items }: SidebarProps) => {
 const defaultItems = [
 { icon: House, label: "House", href: "#" },
 { icon: Stack, label: "Features", href: "#features" },
 { icon: FileText, label: "Pricing", href: "#pricing" },
 { icon: Users, label: "About", href: "#about" },
 { icon: Envelope, label: "Contact", href: "#contact" },
 ];

 const navItems = items || defaultItems;

 React.useEffect(() => {
 document.body.style.overflow = open ? "hidden" : "";
 return () => {
 document.body.style.overflow = "";
 };
 }, [open]);

 return (
 <>
 {/* Backdrop */}
 <div
 className={cn(
 "fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300",
 open ? "opacity-100" : "opacity-0 pointer-events-none",
 )}
 onClick={() => onOpenChange(false)}
 />

 {/* Panel */}
 <div
 className={cn(
 "fixed top-0 right-0 z-50 h-full w-full max-w-sm bg-white shadow-2xl transition-transform duration-300 ease-out",
 open ? "translate-x-0" : "translate-x-full",
 )}
 >
 <div className="flex flex-col h-full">
 {/* Header */}
 <div className="flex items-center justify-between p-6 border-b border-slate-100">
 <a href="#" className="flex items-center gap-2.5">
 <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-xl flex items-center justify-center">
 <Lightning className="w-5 h-5 text-white" fill="white" />
 </div>
 <span className="text-xl font-bold text-slate-900">
 Acme<span className="text-indigo-500">.</span>
 </span>
 </a>
 <button
 onClick={() => onOpenChange(false)}
 className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all duration-150"
 aria-label="Close menu"
 >
 <X className="w-5 h-5" weight="bold" />
 </button>
 </div>

 {/* Navigation */}
 <nav className="flex-1 overflow-y-auto p-6">
 <div className="space-y-2">
 {navItems.map((item) => {
 const Icon = item.icon;
 return (
 <a
 key={item.label}
 href={item.href}
 onClick={() => onOpenChange(false)}
 className="flex items-center gap-4 px-5 py-4 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-2xl font-medium transition-all duration-150 group"
 >
 <div className="w-10 h-10 bg-slate-100 group-hover:bg-slate-200 rounded-xl flex items-center justify-center transition-colors">
 <Icon className="w-5 h-5" />
 </div>
 <span className="text-lg">{item.label}</span>
 </a>
 );
 })}
 </div>
 </nav>

 {/* Footer */}
 <div className="p-6 border-t border-slate-100 space-y-4">
 <button className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white rounded-2xl font-semibold shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all duration-200">
 <Sparkle className="w-5 h-5" />
 Get Started Free
 </button>
 <p className="text-center text-sm text-slate-400">No credit card required</p>
 </div>
 </div>
 </div>
 </>
 );
};
Sidebar.displayName = "Sidebar";

/* ============ EXPORTS ============ */
export {
 useScrolled,
 NavbarWrapper,
 NavbarLogo,
 NavbarCTA,
 NavbarMenuButton,
 Sidebar,
 navigationMenuTriggerStyle,
 NavigationMenu,
 NavigationMenuList,
 NavigationMenuItem,
 NavigationMenuContent,
 NavigationMenuTrigger,
 NavigationMenuLink,
 NavigationMenuIndicator,
 NavigationMenuViewport,
};
