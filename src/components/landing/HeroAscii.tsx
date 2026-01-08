'use client';

import { Link } from 'react-router-dom';
import NetworkShaderBackground from './NetworkShaderBackground';

export default function HeroAscii() {
  return (
    <section className="relative min-h-[100dvh] flex items-center justify-center overflow-hidden bg-background">
      {/* WebGL Shader Background */}
      <div className="absolute inset-0 z-0">
        <NetworkShaderBackground />
      </div>

      {/* Overlay content with mix-blend-mode for text inversion */}
      <div className="relative z-10 w-full min-h-[100dvh] flex flex-col mix-blend-difference">
        {/* Top Header */}
        <div className="absolute top-6 left-6 right-6 flex justify-between items-start z-20">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-white tracking-widest">
                KLOAK
              </span>
              <div className="w-px h-3 bg-white/50" />
              <span className="text-xs font-mono text-white/70">EST. 2025</span>
            </div>
            
            <div className="flex items-center gap-2 text-[10px] font-mono text-white/60">
              <span>NO.EMAIL</span>
              <div className="w-1 h-1 rounded-full bg-white/50" />
              <span>NO.PASSWORD</span>
              <div className="w-1 h-1 rounded-full bg-white/50" />
              <span>NO.TRACKING</span>
            </div>
          </div>
        </div>

        {/* Corner Frame Accents */}
        <div className="absolute top-4 left-4 w-8 h-8 border-l border-t border-white/30" />
        <div className="absolute top-4 right-4 w-8 h-8 border-r border-t border-white/30" />
        <div className="absolute bottom-4 left-4 w-8 h-8 border-l border-b border-white/30" />
        <div className="absolute bottom-4 right-4 w-8 h-8 border-r border-b border-white/30" />

        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center w-full max-w-7xl mx-auto px-6">
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            {/* Top decorative line */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-px bg-gradient-to-r from-transparent via-white to-transparent md:via-white md:to-transparent" />
              <span className="text-xs font-mono text-white/70">001</span>
              <div className="w-12 h-px bg-gradient-to-r from-white via-transparent to-transparent" />
            </div>

            {/* Title */}
            <div className="flex items-start gap-6 mb-8">
              <div className="hidden md:block w-px h-24 bg-gradient-to-b from-white/50 to-transparent" />
              <div>
                <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-semibold text-white leading-[0.95] tracking-tight">
                  YOUR CHAT.
                </h1>
                <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-semibold text-white leading-[0.95] tracking-tight">
                  YOUR KEY.
                </h1>
              </div>
            </div>

            {/* Decorative dots pattern - desktop only */}
            <div className="hidden md:grid grid-cols-10 gap-1 mb-8">
              {Array.from({ length: 40 }).map((_, i) => (
                <div
                  key={i}
                  className="w-1 h-1 rounded-full bg-white/20"
                />
              ))}
            </div>

            {/* Description */}
            <div className="relative max-w-lg mb-10">
              <p className="text-lg text-white/80 leading-relaxed">
                One cryptographic key. That's it. No accounts, no data harvesting, no corporate surveillance. Just you and your conversations.
              </p>
              
              {/* Technical corner accent - desktop only */}
              <div className="hidden md:block absolute -right-8 top-0 text-[8px] font-mono text-white/40">
                <div className="border-l border-white/20 pl-2">
                  ◇
                </div>
              </div>
            </div>

            {/* Buttons - outside blend mode for proper colors */}
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end z-20">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-white/70 hidden sm:inline">SYSTEM.ACTIVE</span>
              <span className="text-[10px] font-mono text-white/70 sm:hidden">SYS.ACT</span>
              <div className="flex gap-0.5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1 h-3 bg-white/30"
                    style={{ opacity: 0.3 + (i * 0.1) }}
                  />
                ))}
              </div>
              <span className="text-[10px] font-mono text-white/50">V1.0.0</span>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-white/50">◐ SECURE</span>
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-white/50 animate-pulse" />
                <div className="w-2 h-2 rounded-full bg-white/30" />
                <div className="w-2 h-2 rounded-full bg-white/20" />
              </div>
              <span className="text-[10px] font-mono text-white/50">FRAME: ∞</span>
            </div>
          </div>
        </div>
      </div>

      {/* Buttons outside blend mode for proper interactivity and colors */}
      <div className="absolute z-20 left-6 right-6 md:left-auto md:right-auto md:w-full md:max-w-7xl md:px-6" style={{ top: '60%' }}>
        <div className="flex flex-col sm:flex-row gap-4 items-center md:items-start md:pl-[calc(1px+1.5rem)]">
          <Link to="/app">
            <button className="group relative px-8 py-3 bg-primary text-primary-foreground font-medium transition-all duration-300 hover:bg-primary/90">
              <span className="absolute -top-px -left-px w-2 h-2 border-l border-t border-primary-foreground/30" />
              <span className="absolute -top-px -right-px w-2 h-2 border-r border-t border-primary-foreground/30" />
              GET STARTED
            </button>
          </Link>
          <Link to="/philosophy">
            <button className="px-8 py-3 border border-border text-foreground font-medium transition-all duration-300 hover:bg-muted hover:border-primary/50">
              LEARN MORE
            </button>
          </Link>
        </div>
      </div>

      {/* Subtle gradient overlay for depth */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-background/30 via-transparent to-background/20 z-[5]" />
    </section>
  );
}
