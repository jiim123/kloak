"use client";

import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Heart,
  FileText,
  Cookie,
  ScrollText,
  Menu,
  X,
  CircleUserRound,
  HelpCircle,
  LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import kloakLogo from "@/assets/kloak-logo.svg";

// Custom hook to handle clicks outside an element
function useOnClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  React.useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler();
    };

    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);

    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
}

interface Tab {
  title: string;
  icon: LucideIcon;
  href: string;
  type?: never;
}

interface Separator {
  type: "separator";
  title?: never;
  icon?: never;
  href?: never;
}

type TabItem = Tab | Separator;

const tabs: TabItem[] = [
  { title: "Philosophy", icon: Heart, href: "/philosophy" },
  { title: "FAQ", icon: HelpCircle, href: "/faq" },
  { type: "separator" },
  { title: "Terms", icon: ScrollText, href: "/terms" },
  { title: "Privacy", icon: FileText, href: "/privacy" },
  { title: "Cookies", icon: Cookie, href: "/cookies" },
];

const buttonVariants = {
  initial: {
    gap: 0,
    paddingLeft: ".5rem",
    paddingRight: ".5rem",
  },
  animate: (isExpanded: boolean) => ({
    gap: isExpanded ? ".5rem" : 0,
    paddingLeft: isExpanded ? "1rem" : ".5rem",
    paddingRight: isExpanded ? "1rem" : ".5rem",
  }),
};

const spanVariants = {
  initial: { width: 0, opacity: 0 },
  animate: { width: "auto", opacity: 1 },
  exit: { width: 0, opacity: 0 },
};

const transition = { delay: 0.1, type: "spring" as const, bounce: 0, duration: 0.6 };

export const NavigationMenu = () => {
  const [hovered, setHovered] = React.useState<number | null>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const location = useLocation();
  const outsideClickRef = React.useRef(null);

  useOnClickOutside(outsideClickRef, () => {
    setHovered(null);
  });

  // Lock body scroll when menu is open
  React.useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const Separator = () => <div className="mx-1 h-[24px] w-[1.2px] bg-border" aria-hidden="true" />;

  return (
    <>
      {/* Navigation Bar */}
      <div className="fixed top-0 left-0 right-0 z-40 flex justify-center px-4 pt-4">
        <motion.nav
          ref={outsideClickRef}
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", bounce: 0, duration: 0.8 }}
          className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/50 bg-background/70 backdrop-blur-xl p-1 shadow-lg shadow-black/5"
        >
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center justify-center rounded-xl px-3 py-2 hover:bg-muted/50 transition-colors duration-300"
          >
            <img src={kloakLogo} alt="Kloak" className="h-5" />
          </Link>

          <Separator />

          {/* Desktop Nav Items */}
          <div className="hidden md:flex items-center gap-2">
            {tabs.map((tab, index) => {
              if (tab.type === "separator") {
                return <Separator key={`separator-${index}`} />;
              }

              const tabItem = tab as Tab;
              const Icon = tabItem.icon;
              const isActive = location.pathname === tabItem.href;
              const isHovered = hovered === index;
              const isExpanded = isActive || isHovered;

              return (
                <Link
                  key={tabItem.title}
                  to={tabItem.href}
                  onMouseEnter={() => setHovered(index)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <motion.div
                    variants={buttonVariants}
                    initial={false}
                    animate="animate"
                    custom={isExpanded}
                    transition={transition}
                    className={cn(
                      "relative flex items-center rounded-xl px-4 py-2 landing-nav-link transition-colors duration-300",
                      isActive
                        ? "bg-muted text-primary"
                        : isHovered
                          ? "bg-muted/70 text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon size={20} />
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.span
                          variants={spanVariants}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          transition={transition}
                          className="overflow-hidden whitespace-nowrap"
                        >
                          {tabItem.title}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </Link>
              );
            })}

            <Separator />
          </div>

          {/* Mobile CTA - visible only on mobile */}
          <Link to="/app" className="md:hidden">
            <Button size="sm" className="rounded-xl uppercase font-semibold tracking-wider">
              Open Kloak
            </Button>
          </Link>

          {/* Desktop CTA Button */}
          <Link to="/app" className="hidden md:block">
            <Button size="sm" className="rounded-xl uppercase font-semibold tracking-wider">
              <CircleUserRound className="h-4 w-4" />
              Login
            </Button>
          </Link>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMenuOpen(true)}
            className="flex md:hidden items-center justify-center rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors duration-300"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
        </motion.nav>
      </div>

      {/* Mobile Menu Sidebar */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMenuOpen(false)}
            />

            {/* Sidebar */}
            <motion.div
              className="fixed top-0 right-0 h-full w-full max-w-sm bg-card border-l border-border/30 z-50 flex flex-col shadow-2xl"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
            >
              {/* Sidebar Header */}
              <div className="flex items-center justify-between p-6 border-b border-border/20">
                <Link to="/" onClick={() => setMenuOpen(false)} className="flex items-center">
                  <img src={kloakLogo} alt="Kloak" className="h-5" />
                </Link>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="p-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl transition-all duration-150"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" strokeWidth={2.5} />
                </button>
              </div>

              {/* Sidebar Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">
                  {/* Join Kloak CTA Box */}
                  <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
                    <h3 className="landing-card-title text-foreground mb-3 text-sm">Join Kloak</h3>
                    <div className="flex gap-3">
                      <Link to="/app" onClick={() => setMenuOpen(false)} className="flex-1">
                        <Button variant="outline" className="w-full uppercase font-semibold tracking-wider text-xs">
                          Create Account
                        </Button>
                      </Link>
                      <Link to="/app" onClick={() => setMenuOpen(false)} className="flex-1">
                        <Button className="w-full uppercase font-semibold tracking-wider text-xs">
                          Open Kloak
                        </Button>
                      </Link>
                    </div>
                  </div>

                  <div className="h-px bg-border/30" />

                  {/* Menu Links */}
                  <div className="space-y-0.5">
                    {tabs
                      .filter((tab): tab is Tab => tab.type !== "separator")
                      .map((link) => (
                        <Link
                          key={link.href}
                          to={link.href}
                          onClick={() => setMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group",
                            location.pathname === link.href
                              ? "bg-muted text-primary"
                              : "text-foreground/80 hover:bg-muted/50 hover:text-foreground",
                          )}
                        >
                          <div
                            className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                              location.pathname === link.href ? "bg-primary/10" : "bg-muted/50 group-hover:bg-muted",
                            )}
                          >
                            <link.icon className="h-4 w-4" />
                          </div>
                          <span className="landing-nav-link">{link.title}</span>
                        </Link>
                      ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
