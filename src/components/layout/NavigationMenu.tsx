import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import kloakLogo from "@/assets/kloak-logo.svg";

const mainLinks = [
  { title: "Philosophy", href: "/philosophy" },
  { title: "Join Us", href: "/join" },
  { title: "FAQ", href: "/faq" },
];

const legalLinks = [
  { title: "Terms", href: "/terms" },
  { title: "Privacy", href: "/privacy" },
  { title: "Cookies", href: "/cookies" },
];

export const NavigationMenu = () => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const location = useLocation();

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
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-border/30 bg-background/80 backdrop-blur-xl">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo */}
            <Link to="/" className="flex-shrink-0">
              <img src={kloakLogo} alt="Kloak" className="h-5" />
            </Link>

            {/* Center: Navigation Links (Desktop) */}
            <div className="hidden md:flex items-center gap-1">
              {/* Main Links */}
              {mainLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={cn(
                    "px-4 py-2 text-sm font-medium transition-colors",
                    location.pathname === link.href ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {link.title}
                </Link>
              ))}

              {/* Separator */}
              <div className="w-px h-4 bg-border mx-2" />

              {/* Legal Links */}
              {legalLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={cn(
                    "px-4 py-2 text-sm font-medium transition-colors",
                    location.pathname === link.href ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {link.title}
                </Link>
              ))}
            </div>

            {/* Right: CTA + Mobile Menu */}
            <div className="flex items-center gap-3">
              {/* Desktop CTA */}
              <Link to="/app" className="hidden sm:block">
                <Button size="sm" rounded="lg">
                  Open Kloak
                </Button>
              </Link>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMenuOpen(true)}
                className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </nav>
      </header>

      {/* Mobile Menu Backdrop */}
      {menuOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40" 
          onClick={() => setMenuOpen(false)} 
        />
      )}

      {/* Mobile Menu Sidebar */}
      {menuOpen && (
        <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-background border-l border-border/30 z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-border/30">
            <Link to="/" onClick={() => setMenuOpen(false)}>
              <img src={kloakLogo} alt="Kloak" className="h-5" />
            </Link>
            <button
              onClick={() => setMenuOpen(false)}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* CTA Buttons */}
            <div className="flex flex-col mb-6">
              <Link to="/app" onClick={() => setMenuOpen(false)} className="block">
                <Button variant="outline" className="w-full h-16 text-lg font-semibold justify-center rounded-none rounded-t-xl">
                  Create Account
                </Button>
              </Link>
              <Link to="/app" onClick={() => setMenuOpen(false)} className="block">
                <Button className="w-full h-16 text-lg font-semibold justify-center rounded-none rounded-b-xl">
                  Open Kloak
                </Button>
              </Link>
            </div>

            <div className="h-px bg-border/30 mb-6" />

            {/* Links */}
            <div className="space-y-2">
              {[...mainLinks, ...legalLinks].map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "flex items-center w-full h-14 px-4 text-base font-medium rounded-xl transition-colors",
                    location.pathname === link.href
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  )}
                >
                  {link.title}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
