'use client';
import React from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Link } from 'react-router-dom';
import KloakLogo from '@/assets/kloak-logo.svg';

interface FooterLink {
  title: string;
  href: string;
}

interface FooterSection {
  label: string;
  links: FooterLink[];
}

const footerLinks: FooterSection[] = [
  {
    label: 'Legal',
    links: [
      { title: 'Terms of Service', href: '/terms' },
      { title: 'Privacy Policy', href: '/privacy' },
      { title: 'Cookies', href: '/cookies' },
    ],
  },
  {
    label: 'About',
    links: [
      { title: 'Our Philosophy', href: '/philosophy' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative w-full bg-card/80 backdrop-blur-sm border-t border-border/30">
      <div className="bg-foreground/10 absolute top-0 right-1/2 left-1/2 h-px w-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full blur" />
      <div className="max-w-4xl mx-auto flex flex-col items-center justify-center px-6 py-8">
        <div className="flex w-full flex-col md:flex-row items-center md:items-start justify-between gap-8">
          <AnimatedContainer className="flex flex-col items-center md:items-start gap-3">
            <img src={KloakLogo} alt="Kloak" className="h-6 opacity-60" />
            <p className="text-muted-foreground text-xs">
              © {new Date().getFullYear()} Kloak. All rights reserved.
            </p>
          </AnimatedContainer>

          <div className="flex gap-12">
            {footerLinks.map((section, index) => (
              <AnimatedContainer key={section.label} delay={0.1 + index * 0.1}>
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground/80 uppercase tracking-wider mb-3">
                    {section.label}
                  </h3>
                  <ul className="space-y-2">
                    {section.links.map((link) => (
                      <li key={link.title}>
                        <Link
                          to={link.href}
                          className="text-muted-foreground hover:text-foreground text-sm transition-colors duration-200"
                        >
                          {link.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </AnimatedContainer>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

type ViewAnimationProps = {
  delay?: number;
  className?: ComponentProps<typeof motion.div>['className'];
  children: ReactNode;
};

function AnimatedContainer({ className, delay = 0.1, children }: ViewAnimationProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ filter: 'blur(4px)', translateY: -8, opacity: 0 }}
      whileInView={{ filter: 'blur(0px)', translateY: 0, opacity: 1 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.8 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
