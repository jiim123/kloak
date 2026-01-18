import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Key, X, Heart, FileText, Cookie, ScrollText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import kloakLogo from "@/assets/kloak-logo.svg";

const menuCategories = [
  {
    title: "Company",
    links: [{ label: "Philosophy", href: "/philosophy", icon: Heart }],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of Service", href: "/terms", icon: ScrollText },
      { label: "Privacy Policy", href: "/privacy", icon: FileText },
      { label: "Cookie Policy", href: "/cookies", icon: Cookie },
    ],
  },
];

export const NavigationMenu = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  // Initialize with correct state based on current scroll position
  const [scrolled, setScrolled] = useState(() => {
    if (typeof window !== "undefined") {
      return window.scrollY > 20;
    }
    return false;
  });

  // Scroll listener
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <>
      {/* Navigation Bar */}
      <div
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-200 ${
          scrolled ? "px-4 pt-3" : "px-0 pt-0"
        }`}
      >
        <nav
          className={`mx-auto transition-all duration-200 ${
            scrolled
              ? "max-w-2xl bg-background/70 backdrop-blur-xl shadow-lg shadow-black/5 border border-border/50 rounded-2xl"
              : "max-w-full bg-transparent border-b border-border/20"
          }`}
        >
          <div
            className={`flex items-center justify-between transition-all duration-200 ${
              scrolled ? "h-14 px-4" : "h-20 px-6 max-w-6xl mx-auto"
            }`}
          >
            {/* Logo */}
            <Link to="/" className="group">
              <img
                src={kloakLogo}
                alt="Kloak"
                className={`transition-all duration-200 group-hover:opacity-80 ${scrolled ? "h-5" : "h-7"}`}
              />
            </Link>

            {/* Right Section */}
            <div className="flex items-center gap-3">
              {/* CTA Button */}
              <Link to="/app" className="hidden sm:block">
                <Button
                  size={scrolled ? "sm" : "default"}
                  className={`transition-all duration-200 ${scrolled ? "h-9 px-4 text-sm" : ""}`}
                >
                  <Sparkles className={`transition-all duration-200 ${scrolled ? "h-3.5 w-3.5" : "h-4 w-4"}`} />
                  Use Kloak
                </Button>
              </Link>

              {/* Menu Button */}
              <button
                onClick={() => setMenuOpen(true)}
                className={`text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl transition-all duration-150 ${
                  scrolled ? "p-2" : "p-2.5"
                }`}
                aria-label="Open menu"
              >
                <div className="flex flex-col gap-1.5">
                  <div className={`bg-current transition-all duration-200 ${scrolled ? "w-4 h-0.5" : "w-5 h-0.5"}`} />
                  <div className={`bg-current transition-all duration-200 ${scrolled ? "w-4 h-0.5" : "w-5 h-0.5"}`} />
                </div>
              </button>
            </div>
          </div>
        </nav>
      </div>

      {/* Menu Sidebar */}
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

                  {/* Menu Categories */}
                  {menuCategories.map((category) => (
                    <div key={category.title}>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-3">
                        {category.title}
                      </h3>
                      <div className="space-y-1">
                        {category.links.map((link) => (
                          <Link
                            key={link.href}
                            to={link.href}
                            onClick={() => setMenuOpen(false)}
                            className="flex items-center gap-4 px-4 py-3.5 rounded-xl text-foreground/80 hover:bg-muted/50 hover:text-foreground transition-all duration-150 group"
                          >
                            <div className="w-10 h-10 bg-muted/50 group-hover:bg-muted rounded-xl flex items-center justify-center transition-colors">
                              <link.icon className="h-5 w-5" />
                            </div>
                            <span className="text-base font-medium">{link.label}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
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
