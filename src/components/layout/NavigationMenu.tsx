import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Key, 
  X, 
  Heart, 
  FileText, 
  Cookie, 
  ScrollText 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import kloakLogo from '@/assets/kloak-logo.svg';

const menuCategories = [
  {
    title: "Company",
    links: [
      { label: "Philosophy", href: "/philosophy", icon: Heart },
    ]
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of Service", href: "/terms", icon: ScrollText },
      { label: "Privacy Policy", href: "/privacy", icon: FileText },
      { label: "Cookie Policy", href: "/cookies", icon: Cookie },
    ]
  }
];

export const NavigationMenu = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      {/* Navigation Bar */}
      <nav className="w-full py-6 px-6 border-b border-border/20">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/">
            <img src={kloakLogo} alt="Kloak" className="h-7" />
          </Link>
          <button 
            onClick={() => setMenuOpen(true)}
            className="p-2 -mr-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Open menu"
          >
            <div className="flex flex-col gap-1.5">
              <div className="w-5 h-0.5 bg-current" />
              <div className="w-5 h-0.5 bg-current" />
            </div>
          </button>
        </div>
      </nav>

      {/* Menu Sidebar */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
            />
            
            {/* Sidebar */}
            <motion.div
              className="fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-card border-l border-border/30 z-50 flex flex-col"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              {/* Sidebar Header */}
              <div className="flex items-center justify-between p-6 border-b border-border/20">
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Menu</span>
                <button 
                  onClick={() => setMenuOpen(false)}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Sidebar Content */}
              <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                <Link to="/auth" onClick={() => setMenuOpen(false)}>
                  <Button className="w-full">
                    <Key className="h-4 w-4" />
                    Create Account
                  </Button>
                </Link>

                <div className="h-px bg-border/30" />

                {menuCategories.map((category) => (
                  <div key={category.title}>
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                      {category.title}
                    </h3>
                    <div className="space-y-1">
                      {category.links.map((link) => (
                        <Link
                          key={link.href}
                          to={link.href}
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-foreground/80 hover:bg-muted/50 hover:text-foreground transition-colors"
                        >
                          <link.icon className="h-4 w-4" />
                          <span className="text-sm">{link.label}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              </div>

              {/* Sidebar Footer */}
              <div className="p-6 border-t border-border/20">
                <Link to="/auth" onClick={() => setMenuOpen(false)}>
                  <Button className="w-full">
                    Get Started
                  </Button>
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
