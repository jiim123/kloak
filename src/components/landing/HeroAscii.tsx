'use client';

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MeshGradient } from '@paper-design/shaders-react';

export default function HeroAscii() {
  useEffect(() => {
    const embedScript = document.createElement('script');
    embedScript.type = 'text/javascript';
    embedScript.textContent = `
      !function(){
        if(!window.UnicornStudio){
          window.UnicornStudio={isInitialized:!1};
          var i=document.createElement("script");
          i.src="https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v1.4.33/dist/unicornStudio.umd.js";
          i.onload=function(){
            window.UnicornStudio.isInitialized||(UnicornStudio.init(),window.UnicornStudio.isInitialized=!0)
          };
          (document.head || document.body).appendChild(i)
        }
      }();
    `;
    document.head.appendChild(embedScript);

    // Add CSS to hide branding elements and crop canvas
    const style = document.createElement('style');
    style.textContent = `
      [data-us-project] {
        position: relative !important;
        overflow: hidden !important;
      }
      
      [data-us-project] canvas {
        clip-path: inset(0 0 10% 0) !important;
      }
      
      [data-us-project] * {
        pointer-events: none !important;
      }
      [data-us-project] a[href*="unicorn"],
      [data-us-project] button[title*="unicorn"],
      [data-us-project] div[title*="Made with"],
      [data-us-project] .unicorn-brand,
      [data-us-project] [class*="brand"],
      [data-us-project] [class*="credit"],
      [data-us-project] [class*="watermark"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        position: absolute !important;
        left: -9999px !important;
        top: -9999px !important;
      }
    `;
    document.head.appendChild(style);

    // Function to aggressively hide branding
    const hideBranding = () => {
      const projectDiv = document.querySelector('[data-us-project]');
      if (projectDiv) {
        const allElements = projectDiv.querySelectorAll('*');
        allElements.forEach(el => {
          const text = (el.textContent || '').toLowerCase();
          if (text.includes('made with') || text.includes('unicorn')) {
            el.remove();
          }
        });
      }
    };

    hideBranding();
    const interval = setInterval(hideBranding, 100);
    
    setTimeout(hideBranding, 1000);
    setTimeout(hideBranding, 3000);
    setTimeout(hideBranding, 5000);

    return () => {
      clearInterval(interval);
      if (embedScript.parentNode) {
        embedScript.parentNode.removeChild(embedScript);
      }
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    };
  }, []);

  return (
    <section className="relative min-h-[100dvh] flex items-center justify-center overflow-hidden bg-background">
      {/* Mesh Gradient Background */}
      <div className="absolute inset-0 z-0 opacity-40">
        <MeshGradient
          style={{ width: '100%', height: '100%' }}
          colors={["#0a0a0a", "#1a1a2e", "#16213e", "#0f3460", "#1a1a1a"]}
          distortion={0.6}
          swirl={0.15}
          grainMixer={0}
          grainOverlay={0}
          speed={0.3}
        />
      </div>

      {/* Animated background - hidden on mobile */}
      <div className="hidden md:block absolute inset-0 z-[1]">
        <div
          data-us-project="kloak-ascii"
          data-us-scale="1"
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      {/* Top Header */}
      <div className="absolute top-6 left-6 right-6 flex justify-between items-start z-20">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-primary tracking-widest">
              KLOAK
            </span>
            <div className="w-px h-3 bg-border" />
            <span className="text-xs font-mono text-muted-foreground">EST. 2025</span>
          </div>
          
          <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground/60">
            <span>NO.EMAIL</span>
            <div className="w-1 h-1 rounded-full bg-primary/50" />
            <span>NO.PASSWORD</span>
            <div className="w-1 h-1 rounded-full bg-primary/50" />
            <span>NO.TRACKING</span>
          </div>
        </div>
      </div>

      {/* Corner Frame Accents */}
      <div className="absolute top-4 left-4 w-8 h-8 border-l border-t border-primary/30" />
      <div className="absolute top-4 right-4 w-8 h-8 border-r border-t border-primary/30" />
      <div className="absolute bottom-4 left-4 w-8 h-8 border-l border-b border-primary/30" />
      <div className="absolute bottom-4 right-4 w-8 h-8 border-r border-b border-primary/30" />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6">
        <div className="flex flex-col items-center md:items-start text-center md:text-left">
          {/* Top decorative line */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-px bg-gradient-to-r from-transparent via-primary to-transparent md:via-primary md:to-transparent" />
            <span className="text-xs font-mono text-primary/70">001</span>
            <div className="w-12 h-px bg-gradient-to-r from-primary via-transparent to-transparent" />
          </div>

          {/* Title */}
          <div className="flex items-start gap-6 mb-8">
            <div className="hidden md:block w-px h-24 bg-gradient-to-b from-primary/50 to-transparent" />
            <div>
              <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-semibold text-foreground leading-[0.95] tracking-tight">
                Your Chat.
              </h1>
              <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-semibold leading-[0.95] tracking-tight">
                <span className="text-primary">Your Key.</span>
              </h1>
            </div>
          </div>

          {/* Decorative dots pattern - desktop only */}
          <div className="hidden md:grid grid-cols-10 gap-1 mb-8">
            {Array.from({ length: 40 }).map((_, i) => (
              <div
                key={i}
                className="w-1 h-1 rounded-full bg-primary/20"
              />
            ))}
          </div>

          {/* Description */}
          <div className="relative max-w-lg mb-10">
            <p className="text-lg text-muted-foreground leading-relaxed">
              One cryptographic key. That's it. No accounts, no data harvesting, no corporate surveillance. Just you and your conversations.
            </p>
            
            {/* Technical corner accent - desktop only */}
            <div className="hidden md:block absolute -right-8 top-0 text-[8px] font-mono text-primary/40">
              <div className="border-l border-primary/20 pl-2">
                ◇
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Link to="/app">
              <button className="group relative px-8 py-3 bg-primary text-primary-foreground font-medium transition-all duration-300 hover:bg-primary/90">
                <span className="absolute -top-px -left-px w-2 h-2 border-l border-t border-primary-foreground/30" />
                <span className="absolute -top-px -right-px w-2 h-2 border-r border-t border-primary-foreground/30" />
                Get Started
              </button>
            </Link>
            <Link to="/philosophy">
              <button className="px-8 py-3 border border-border text-foreground font-medium transition-all duration-300 hover:bg-muted hover:border-primary/50">
                Learn More
              </button>
            </Link>
          </div>

          {/* Bottom technical notation - desktop only */}
          <div className="hidden md:flex items-center gap-4 mt-12 text-xs font-mono text-muted-foreground/50">
            <span>∞</span>
            <div className="w-16 h-px bg-gradient-to-r from-primary/30 to-transparent" />
            <span>ZERO.KNOWLEDGE</span>
          </div>
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end z-20">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-primary/70 hidden sm:inline">SYSTEM.ACTIVE</span>
            <span className="text-[10px] font-mono text-primary/70 sm:hidden">SYS.ACT</span>
            <div className="flex gap-0.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="w-1 h-3 bg-primary/30"
                  style={{ opacity: 0.3 + (i * 0.1) }}
                />
              ))}
            </div>
            <span className="text-[10px] font-mono text-muted-foreground/50">V1.0.0</span>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-muted-foreground/50">◐ SECURE</span>
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-primary/50 animate-pulse" />
              <div className="w-2 h-2 rounded-full bg-primary/30" />
              <div className="w-2 h-2 rounded-full bg-primary/20" />
            </div>
            <span className="text-[10px] font-mono text-muted-foreground/50">FRAME: ∞</span>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-background via-transparent to-background/50 z-[5]" />
    </section>
  );
}
