'use client';
import React from 'react';
import { Link } from 'react-router-dom';
import KloakLogo from '@/assets/kloak-logo.svg';

const footerLinks = [
  { title: 'Philosophy', href: '/philosophy' },
  { title: 'Terms', href: '/terms' },
  { title: 'Privacy', href: '/privacy' },
  { title: 'Cookies', href: '/cookies' },
];

export function Footer() {
  return (
    <footer className="w-full border-t border-border/20 bg-background/50 backdrop-blur-sm">
      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={KloakLogo} alt="Kloak" className="h-5 opacity-50" />
            <span className="text-muted-foreground/60 text-xs">
              © {new Date().getFullYear()}
            </span>
          </div>

          <nav className="flex items-center gap-6">
            {footerLinks.map((link) => (
              <Link
                key={link.title}
                to={link.href}
                className="text-muted-foreground/70 hover:text-foreground text-xs transition-colors"
              >
                {link.title}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
