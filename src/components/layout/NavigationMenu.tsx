import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MenuToggleIcon } from "@/components/ui/menu-toggle-icon";
import { useScroll } from "@/hooks/use-scroll";
import kloakLogo from "@/assets/kloak-logo.svg";

const mainLinks = [
  { label: "About", href: "/about" },
  { label: "Join Us", href: "/join" },
  { label: "FAQ", href: "/faq" },
];

export const NavigationMenu = () => {
  const [open, setOpen] = React.useState(false);
  const scrolled = useScroll(10);
  const location = useLocation();

  React.useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close mobile menu on route change
  React.useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-40 w-full transition-all duration-300",
        scrolled ? "py-2 px-3 sm:px-4" : "py-0 px-0"
      )}
    >
      <div
        className={cn(
          "mx-auto transition-all duration-300",
          scrolled
            ? "max-w-3xl border border-white/10 bg-black/80 backdrop-blur-xl rounded-2xl shadow-lg shadow-black/30"
            : "max-w-full border-b border-white/10 bg-black/65 backdrop-blur-xl"
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between transition-all duration-300",
            scrolled
              ? "h-14 px-4 sm:px-5"
              : "h-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
          )}
        >
          {/* Logo */}
          <Link to="/" className="flex-shrink-0">
            <img src={kloakLogo} alt="Kloak" className="h-5" />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {mainLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                  location.pathname === link.href
                    ? "text-white"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                {link.label}
              </Link>
            ))}

          </div>

          {/* Mobile Menu Toggle */}
          <button onClick={() => setOpen(!open)} className="md:hidden p-1">
            <MenuToggleIcon
              open={open}
              className="w-7 h-7 text-white"
            />
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black text-white transition-all duration-500 md:hidden flex flex-col",
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
      >
        {/* Mobile Header */}
        <div className="flex items-center justify-between h-16 px-4 sm:px-6">
          <Link to="/" onClick={() => setOpen(false)} className="flex-shrink-0">
            <img src={kloakLogo} alt="Kloak" className="h-5" />
          </Link>
          <button onClick={() => setOpen(false)} className="p-1">
            <MenuToggleIcon
              open={open}
              className="w-7 h-7 text-white"
            />
          </button>
        </div>

        {/* Mobile Content */}
        <div className="flex-1 flex flex-col justify-between px-6 pb-8 pt-4 overflow-y-auto">
          {/* Links */}
          <div className="space-y-1">
            {mainLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center w-full h-14 px-4 text-lg font-medium rounded-xl transition-colors",
                  location.pathname === link.href
                    ? "bg-white/10 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col gap-3 mt-8">
            <Link to="/app" onClick={() => setOpen(false)} className="block">
              <Button variant="outline" className="w-full h-12 border-white/15 bg-white/5 text-base font-medium text-white hover:bg-white/10" rounded="xl">
                Create Account
              </Button>
            </Link>
            <Link to="/app" onClick={() => setOpen(false)} className="block">
              <Button className="w-full h-12 text-base font-medium" rounded="xl">
                Open Kloak
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};


