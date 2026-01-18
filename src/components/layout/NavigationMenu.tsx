import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useOnClickOutside } from "usehooks-ts";
import { cn } from "@/lib/utils";
import { Heart, FileText, Cookie, ScrollText, Sparkles, Menu, X, Key, Home, LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import kloakLogo from "@/assets/kloak-logo.svg";

interface NavItem {
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

type NavTabItem = NavItem | Separator;

const navTabs: NavTabItem[] = [
  { title: "Home", icon: Home, href: "/" },
  { title: "Philosophy", icon: Heart, href: "/philosophy" },
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
  animate: (isSelected: boolean) => ({
    gap: isSelected ? ".5rem" : 0,
    paddingLeft: isSelected ? "1rem" : ".5rem",
    paddingRight: isSelected ? "1rem" : ".5rem",
  }),
};

const spanVariants = {
  initial: { width: 0, opacity: 0 },
  animate: { width: "auto", opacity: 1 },
  exit: { width: 0, opacity: 0 },
};

const transition = { delay: 0.1, type: "spring", bounce: 0, duration: 0.6 };

export const NavigationMenu = () => {
  const [selected, setSelected] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navRef = useRef(null);

  useOnClickOutside(navRef, () => {
    setSelected(null);
  });

  // Lock body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const NavSeparator = () => <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />;

  return (
    <>
      {/* Navigation Bar */}
      <div className="fixed top-0 left-0 right-0 z-40 flex justify-center px-4 pt-4">
        <motion.nav
          ref={navRef}
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", bounce: 0, duration: 0.8 }}
          className="flex items-center gap-2 rounded-2xl border border-border/50 bg-background/70 backdrop-blur-xl p-1.5 shadow-lg shadow-black/5"
        >
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center justify-center rounded-xl px-3 py-2 hover:bg-muted/50 transition-colors"
          >
            <img src={kloakLogo} alt="Kloak" className="h-5" />
          </Link>

          <NavSeparator />

          {/* Nav Items */}
          {navTabs.map((tab, index) => {
            if (tab.type === "separator") {
              return <NavSeparator key={`separator-${index}`} />;
            }

            const Icon = tab.icon;
            const isActive = location.pathname === tab.href;
            const isSelected = selected === index;

            return (
              <motion.div
                key={tab.title}
                variants={buttonVariants}
                initial={false}
                animate="animate"
                custom={isSelected || isActive}
                transition={transition}
              >
                <Link
                  to={tab.href}
                  onClick={() => setSelected(index)}
                  className={cn(
                    "relative flex items-center rounded-xl px-2 py-2 text-sm font-medium transition-colors duration-300",
                    isSelected || isActive
                      ? "bg-muted text-primary"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  <Icon size={18} />
                  <AnimatePresence initial={false}>
                    {(isSelected || isActive) && (
                      <motion.span
                        variants={spanVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={transition}
                        className="overflow-hidden whitespace-nowrap"
                      >
                        {tab.title}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Link>
              </motion.div>
            );
          })}

          <NavSeparator />

          {/* CTA Button */}
          <Link to="/app">
            <Button size="sm" className="rounded-xl h-9 px-4">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Use Kloak</span>
            </Button>
          </Link>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMenuOpen(true)}
            className="flex md:hidden items-center justify-center rounded-xl p-2 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            aria-label="Open menu"
          >
            <Menu size={18} />
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
                  {/* Primary CTA */}
                  <Link to="/app" onClick={() => setMenuOpen(false)}>
                    <Button className="w-full h-12 text-base">
                      <Key className="h-4 w-4" />
                      Create Account
                    </Button>
                  </Link>

                  <div className="h-px bg-border/30" />

                  {/* Nav Links */}
                  <div className="space-y-1">
                    {navTabs
                      .filter((tab): tab is NavItem => tab.type !== "separator")
                      .map((link) => (
                        <Link
                          key={link.href}
                          to={link.href}
                          onClick={() => setMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-150 group",
                            location.pathname === link.href
                              ? "bg-muted text-primary"
                              : "text-foreground/80 hover:bg-muted/50 hover:text-foreground",
                          )}
                        >
                          <div
                            className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                              location.pathname === link.href ? "bg-primary/10" : "bg-muted/50 group-hover:bg-muted",
                            )}
                          >
                            <link.icon className="h-5 w-5" />
                          </div>
                          <span className="text-base font-medium">{link.title}</span>
                        </Link>
                      ))}
                  </div>
                </div>
              </div>

              {/* Sidebar Footer */}
              <div className="p-6 border-t border-border/20">
                <Link to="/app" onClick={() => setMenuOpen(false)}>
                  <Button className="w-full h-12 text-base">
                    <Sparkles className="h-4 w-4" />
                    Get Started
                  </Button>
                </Link>
                <p className="text-center text-xs text-muted-foreground mt-3">Free forever. No credit card required.</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
