"use client";

import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import kloakLogo from "@/assets/kloak-logo.svg";

const navLinks = [
  { title: "Philosophy", href: "/philosophy" },
  { title: "Privacy", href: "/privacy" },
  { title: "Terms", href: "/terms" },
];

export const LandingNav = () => {
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const location = useLocation();

  // Handle scroll for background reveal
  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock body scroll when menu is open
  React.useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <>
      {/* Navigation Bar */}
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
          isScrolled
            ? "bg-background/80 backdrop-blur-xl border-b border-border/20"
            : "bg-transparent"
        )}
      >
        <nav className="max-w-[1920px] mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img src={kloakLogo} alt="Kloak" className="h-5" />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-12">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  "text-[11px] font-medium tracking-[0.2em] uppercase transition-opacity duration-300",
                  location.pathname === link.href
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {link.title}
              </Link>
            ))}
          </div>

          {/* Desktop CTA */}
          <Link to="/app" className="hidden md:block">
            <button className="text-[11px] font-medium tracking-[0.2em] uppercase text-foreground border border-border/50 px-6 py-2.5 transition-all duration-300 hover:bg-foreground hover:text-background hover:border-foreground">
              Open App
            </button>
          </Link>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMenuOpen(true)}
            className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
        </nav>
      </motion.header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setMenuOpen(false)}
            />

            {/* Menu content */}
            <motion.div
              className="fixed inset-0 z-50 flex flex-col"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6">
                <Link to="/" onClick={() => setMenuOpen(false)}>
                  <img src={kloakLogo} alt="Kloak" className="h-5" />
                </Link>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Close menu"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Nav links */}
              <div className="flex-1 flex flex-col items-center justify-center gap-8">
                {navLinks.map((link, index) => (
                  <motion.div
                    key={link.href}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Link
                      to={link.href}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "text-2xl font-medium tracking-[0.1em] uppercase transition-colors",
                        location.pathname === link.href
                          ? "text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {link.title}
                    </Link>
                  </motion.div>
                ))}

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-8"
                >
                  <Link to="/app" onClick={() => setMenuOpen(false)}>
                    <button className="text-sm font-medium tracking-[0.2em] uppercase bg-foreground text-background px-8 py-4 transition-all duration-300 hover:bg-primary">
                      Open App
                    </button>
                  </Link>
                </motion.div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default LandingNav;
