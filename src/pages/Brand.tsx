import { motion } from "framer-motion";
import { NavigationMenu } from "@/components/layout/NavigationMenu";
import { Footer } from "@/components/ui/footer-section";
import { SEO } from "@/components/seo";
import { Copy, Check, Download, ArrowDownRight } from "lucide-react";
import { useState } from "react";
import kloakLogo from "@/assets/kloak-logo.svg";

/* ─── Color swatch data ─── */
const brandColors = [
  { name: "Background", token: "--background", hex: "#0F0F0F", hsl: "0 0% 6%" },
  { name: "Foreground", token: "--foreground", hex: "#E0E0E0", hsl: "0 0% 88%" },
  { name: "Primary", token: "--primary", hex: "#EDEDED", hsl: "0 0% 93%" },
  { name: "Card", token: "--card", hex: "#171717", hsl: "0 0% 9%" },
  { name: "Muted", token: "--muted", hex: "#2B2B2B", hsl: "0 0% 17%" },
  { name: "Muted FG", token: "--muted-foreground", hex: "#949494", hsl: "0 0% 58%" },
  { name: "Border", token: "--border", hex: "#2B2B2B", hsl: "0 0% 17%" },
];

const statusColors = [
  { name: "Online", hex: "#40BF80", class: "bg-kloak-online" },
  { name: "Idle", hex: "#E5A54B", class: "bg-kloak-idle" },
  { name: "DND", hex: "#D45555", class: "bg-kloak-dnd" },
  { name: "Offline", hex: "#6B6B6B", class: "bg-kloak-offline" },
];

const typographySamples = [
  { label: "H1 / Display", className: "text-4xl sm:text-5xl font-light tracking-tight", sample: "Privacy is the architecture." },
  { label: "H2 / Section", className: "text-2xl sm:text-3xl font-light tracking-tight", sample: "Communication should be private." },
  { label: "H3 / Subsection", className: "text-lg font-medium", sample: "No email. No password. No tracking." },
  { label: "Body", className: "text-base font-normal", sample: "Your conversations belong to you. Always." },
  { label: "Caption / Mono", className: "text-xs font-mono tracking-widest uppercase", sample: "System Status" },
];

const spacingScale = [4, 8, 12, 16, 24, 32, 48, 64];

/* ─── Clipboard helper ─── */
const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-kloak-online" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
};

/* ─── Section label ─── */
const SectionLabel = ({ number, label }: { number: string; label: string }) => (
  <motion.div
    className="flex items-center gap-4 mb-16"
    initial={{ opacity: 0, x: -20 }}
    whileInView={{ opacity: 1, x: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5 }}
  >
    <span className="text-6xl sm:text-8xl font-extralight text-foreground/[0.06] select-none leading-none">{number}</span>
    <div>
      <span className="text-xs font-mono text-muted-foreground tracking-widest uppercase block mb-1">{number} · {label}</span>
      <div className="w-12 h-px bg-foreground/20" />
    </div>
  </motion.div>
);

/* ─── Page ─── */
const Brand = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center w-full landing-typography">
      <SEO title="Brand Guidelines" description="Official brand guidelines for Kloak. Logos, colors, typography, and usage rules for the privacy-first communication platform." />
      <div className="w-full">
        <NavigationMenu />
        <main className="pt-10">

          {/* ═══ Hero ═══ */}
          <section className="relative py-32 md:py-44 px-8 lg:px-16 overflow-hidden">
            <div className="absolute inset-0 bg-foreground" />
            {/* Decorative grid */}
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: `linear-gradient(hsl(var(--background)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--background)) 1px, transparent 1px)`,
              backgroundSize: '60px 60px'
            }} />
            <div className="max-w-7xl mx-auto relative">
              <div className="grid md:grid-cols-[1fr,auto] gap-12 items-end">
                <div>
                  <motion.span
                    className="text-xs font-mono text-background/40 tracking-widest uppercase block mb-8"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6 }}
                  >
                    Brand Guidelines
                  </motion.span>

                  <motion.h1
                    className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extralight text-background leading-[0.95] tracking-tight mb-8"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.1 }}
                  >
                    The Kloak
                    <br />
                    <span className="text-background/30">identity.</span>
                  </motion.h1>

                  <motion.p
                    className="text-base text-background/50 max-w-md leading-relaxed"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                  >
                    Rules for representing Kloak across all media. Consistent, minimal, intentional.
                  </motion.p>
                </div>

                <motion.div
                  className="hidden md:flex flex-col items-end gap-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                >
                  {["Logo", "Color", "Typography", "Spacing", "Tone", "Usage"].map((s, i) => (
                    <a
                      key={s}
                      href={`#${s.toLowerCase()}`}
                      className="text-[11px] font-mono text-background/30 hover:text-background/70 tracking-widest uppercase transition-colors py-1"
                    >
                      0{i + 1} — {s}
                    </a>
                  ))}
                </motion.div>
              </div>
            </div>
          </section>

          {/* ═══ 01 · Logo ═══ */}
          <section id="logo" className="relative py-28 px-8 lg:px-16 border-b border-border/10">
            <div className="max-w-7xl mx-auto">
              <SectionLabel number="01" label="Logo" />

              <div className="grid md:grid-cols-3 gap-3">
                {/* Light on dark — large */}
                <motion.div
                  className="md:col-span-2 border border-border/20 bg-card/50 p-16 flex flex-col items-center justify-center gap-8 min-h-[320px] relative group"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                >
                  <img src={kloakLogo} alt="Kloak logo light" className="h-10" />
                  <span className="text-[10px] font-mono text-muted-foreground/50 tracking-widest uppercase absolute bottom-6 left-6">
                    Primary — dark bg
                  </span>
                </motion.div>

                {/* Dark on light */}
                <motion.div
                  className="border border-border/20 bg-foreground p-12 flex flex-col items-center justify-center gap-8 min-h-[320px] relative"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                >
                  <img src={kloakLogo} alt="Kloak logo dark" className="h-8 invert" />
                  <span className="text-[10px] font-mono text-background/40 tracking-widest uppercase absolute bottom-6 left-6">
                    Inverted — light bg
                  </span>
                </motion.div>
              </div>

              {/* K monogram row */}
              <div className="grid md:grid-cols-3 gap-3 mt-3">
                <motion.div
                  className="border border-border/20 bg-card/50 p-12 flex flex-col items-center justify-center gap-6 relative"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.15 }}
                >
                  <img src="/logo-k-b.svg" alt="Kloak K monogram" className="h-14 invert" />
                  <span className="text-[10px] font-mono text-muted-foreground/50 tracking-widest uppercase absolute bottom-6 left-6">
                    Monogram
                  </span>
                </motion.div>

                <motion.div
                  className="md:col-span-2 border border-border/20 bg-card/30 p-10 flex flex-col justify-center"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <div className="grid sm:grid-cols-2 gap-8">
                    <div>
                      <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                        <ArrowDownRight className="w-3 h-3 text-muted-foreground" />
                        Clear space
                      </h3>
                      <p className="text-muted-foreground/70 text-[13px] leading-relaxed">
                        Maintain clear space equal to the height of the "K" letterform on all sides. Never crowd the logo.
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                        <ArrowDownRight className="w-3 h-3 text-muted-foreground" />
                        Minimum size
                      </h3>
                      <p className="text-muted-foreground/70 text-[13px] leading-relaxed">
                        Wordmark: 80px / 20mm minimum. Monogram: 16px / 4mm minimum.
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </section>

          {/* ═══ 02 · Color ═══ */}
          <section id="color" className="relative py-28 px-8 lg:px-16 border-b border-border/10 bg-card/30">
            <div className="max-w-7xl mx-auto">
              <SectionLabel number="02" label="Color" />

              {/* Brand swatches — large tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-0 border border-border/20 overflow-hidden">
                {brandColors.map((c, i) => (
                  <motion.div
                    key={c.name}
                    className="group relative"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: i * 0.04 }}
                  >
                    <div className="aspect-square" style={{ backgroundColor: c.hex }} />
                    <div className="p-3 bg-background border-t border-border/10">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-medium text-foreground">{c.name}</span>
                        <CopyButton text={c.hex} />
                      </div>
                      <p className="text-[10px] font-mono text-muted-foreground/60">{c.hex}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Status colors — inline strip */}
              <motion.div
                className="mt-8 flex flex-wrap items-center gap-8 border border-border/20 bg-background p-6"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                <span className="text-[10px] font-mono text-muted-foreground/50 tracking-widest uppercase">Status</span>
                {statusColors.map((s) => (
                  <div key={s.name} className="flex items-center gap-2.5">
                    <div className="w-3 h-3 rounded-full ring-2 ring-offset-2 ring-offset-background" style={{ backgroundColor: s.hex, boxShadow: `0 0 12px ${s.hex}40` }} />
                    <span className="text-xs text-foreground/80">{s.name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground/40">{s.hex}</span>
                  </div>
                ))}
              </motion.div>

              {/* Token note */}
              <motion.div
                className="mt-8 border-l-2 border-foreground/10 pl-6 py-2"
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.3 }}
              >
                <p className="text-muted-foreground/70 text-[13px] leading-relaxed max-w-2xl">
                  Kloak uses semantic CSS custom properties (<code className="text-[11px] font-mono text-foreground/60 px-1.5 py-0.5 bg-muted/50 rounded">--background</code>, <code className="text-[11px] font-mono text-foreground/60 px-1.5 py-0.5 bg-muted/50 rounded">--primary</code>) rather than hard-coded values. Components always reference tokens, never raw hex.
                </p>
              </motion.div>
            </div>
          </section>

          {/* ═══ 03 · Typography ═══ */}
          <section id="typography" className="relative py-28 px-8 lg:px-16 border-b border-border/10">
            <div className="max-w-7xl mx-auto">
              <SectionLabel number="03" label="Typography" />

              {/* Typeface cards */}
              <div className="grid md:grid-cols-2 gap-3 mb-16">
                <motion.div
                  className="border border-border/20 bg-card/50 p-10 relative overflow-hidden"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                >
                  <span className="text-[10px] font-mono text-muted-foreground/50 tracking-widest uppercase block mb-6">Primary</span>
                  <p className="text-4xl font-extralight text-foreground tracking-tight mb-1">Aa</p>
                  <p className="text-lg font-light text-foreground/60 mb-4">Stack Sans Headline</p>
                  <p className="text-muted-foreground/50 text-xs">Weights 300–700. Headings & body.</p>
                  {/* Giant ghost letter */}
                  <span className="absolute -right-6 -bottom-10 text-[180px] font-extralight text-foreground/[0.02] select-none leading-none">A</span>
                </motion.div>
                <motion.div
                  className="border border-border/20 bg-card/50 p-10 relative overflow-hidden"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                >
                  <span className="text-[10px] font-mono text-muted-foreground/50 tracking-widest uppercase block mb-6">Monospace</span>
                  <p className="text-4xl font-mono text-foreground tracking-tight mb-1">0x</p>
                  <p className="text-lg font-mono text-foreground/60 mb-4">System Mono</p>
                  <p className="text-muted-foreground/50 text-xs">Labels, codes, secret keys.</p>
                  <span className="absolute -right-4 -bottom-8 text-[180px] font-mono text-foreground/[0.02] select-none leading-none">_</span>
                </motion.div>
              </div>

              {/* Type scale — stacked with increasing size */}
              <div className="space-y-0">
                {typographySamples.map((t, i) => (
                  <motion.div
                    key={t.label}
                    className="border-t border-border/10 py-8 grid md:grid-cols-[160px,1fr] gap-4 items-baseline"
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.35, delay: i * 0.06 }}
                  >
                    <span className="text-[10px] font-mono text-muted-foreground/40 tracking-widest uppercase">
                      {t.label}
                    </span>
                    <p className={`text-foreground ${t.className}`}>{t.sample}</p>
                  </motion.div>
                ))}
                <div className="border-t border-border/10" />
              </div>
            </div>
          </section>

          {/* ═══ 04 · Spacing ═══ */}
          <section id="spacing" className="relative py-28 px-8 lg:px-16 border-b border-border/10 bg-card/30">
            <div className="max-w-7xl mx-auto">
              <SectionLabel number="04" label="Spacing" />

              <div className="grid md:grid-cols-[1fr,1fr] gap-12">
                {/* Visual scale */}
                <div>
                  <p className="text-muted-foreground/60 text-[13px] leading-relaxed mb-10 max-w-sm">
                    4px base grid. All spacing, padding, and sizing as multiples of 4. Visual consistency across every surface.
                  </p>
                  <div className="space-y-3">
                    {spacingScale.map((px, i) => (
                      <motion.div
                        key={px}
                        className="flex items-center gap-4"
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.3, delay: i * 0.04 }}
                      >
                        <span className="text-[10px] font-mono text-muted-foreground/40 w-10 text-right">{px}</span>
                        <div className="relative h-6 flex items-center">
                          <div
                            className="h-full bg-foreground/[0.07] border border-foreground/10"
                            style={{ width: `${px * 3}px` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground/30">
                          {px / 4}rem
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Border radius */}
                <motion.div
                  className="border border-border/20 bg-background p-10 self-start"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                    <ArrowDownRight className="w-3 h-3 text-muted-foreground" />
                    Border radius
                  </h3>
                  <p className="text-muted-foreground/60 text-[13px] leading-relaxed mb-8">
                    Default: 6px (<code className="text-[10px] font-mono text-foreground/50 px-1 py-0.5 bg-muted/40 rounded">--radius: 0.375rem</code>). The aesthetic leans sharp over soft.
                  </p>
                  <div className="flex items-end gap-5">
                    {[
                      { r: "rounded-sm", label: "2px" },
                      { r: "rounded-md", label: "6px" },
                      { r: "rounded-lg", label: "8px" },
                      { r: "rounded-full", label: "full" },
                    ].map((item) => (
                      <div key={item.label} className="flex flex-col items-center gap-2">
                        <div className={`w-14 h-14 border border-foreground/10 bg-foreground/[0.04] ${item.r}`} />
                        <span className="text-[9px] font-mono text-muted-foreground/40">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </div>
            </div>
          </section>

          {/* ═══ 05 · Tone ═══ */}
          <section id="tone" className="relative py-28 px-8 lg:px-16 border-b border-border/10">
            <div className="max-w-7xl mx-auto">
              <SectionLabel number="05" label="Voice & Tone" />

              {/* Principles — big text cards */}
              <div className="grid md:grid-cols-3 gap-3 mb-12">
                {[
                  { title: "Direct", word: "D", description: "Say what you mean. No fluff, no buzzwords. Short sentences. Active voice." },
                  { title: "Honest", word: "H", description: "Never exaggerate. Acknowledge limitations. Trust is built through transparency." },
                  { title: "Calm", word: "C", description: "No exclamation marks in UI. No urgency theater. No dark patterns. Quiet confidence." },
                ].map((item, i) => (
                  <motion.div
                    key={item.title}
                    className="border border-border/20 bg-card/50 p-8 relative overflow-hidden group"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.08 }}
                  >
                    <span className="absolute -right-4 -top-6 text-[120px] font-extralight text-foreground/[0.03] select-none leading-none group-hover:text-foreground/[0.06] transition-colors duration-500">{item.word}</span>
                    <h3 className="text-sm font-medium text-foreground mb-3 relative">{item.title}</h3>
                    <p className="text-muted-foreground/60 text-[13px] leading-relaxed relative">{item.description}</p>
                  </motion.div>
                ))}
              </div>

              {/* Do / Don't */}
              <div className="grid md:grid-cols-2 gap-3">
                <motion.div
                  className="border border-border/20 bg-background p-8"
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                >
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-2 h-2 rounded-full bg-kloak-online" />
                    <span className="text-[10px] font-mono text-kloak-online tracking-widest uppercase">Do</span>
                  </div>
                  <ul className="space-y-4">
                    {[
                      '"Your key is the only way to access your account."',
                      '"We don\'t collect email addresses."',
                      '"Privacy is the architecture."',
                    ].map((text, i) => (
                      <li key={i} className="text-muted-foreground/60 text-[13px] leading-relaxed pl-4 border-l border-kloak-online/20">
                        {text}
                      </li>
                    ))}
                  </ul>
                </motion.div>
                <motion.div
                  className="border border-border/20 bg-background p-8"
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.25 }}
                >
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-2 h-2 rounded-full bg-destructive" />
                    <span className="text-[10px] font-mono text-destructive tracking-widest uppercase">Don't</span>
                  </div>
                  <ul className="space-y-4">
                    {[
                      '"Revolutionary next-gen privacy solution!"',
                      '"Join millions of users today!"',
                      '"Don\'t miss out on our exclusive features!"',
                    ].map((text, i) => (
                      <li key={i} className="text-muted-foreground/60 text-[13px] leading-relaxed pl-4 border-l border-destructive/20">
                        {text}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              </div>
            </div>
          </section>

          {/* ═══ 06 · Usage ═══ */}
          <section id="usage" className="relative py-28 px-8 lg:px-16 border-b border-border/10 bg-card/30">
            <div className="max-w-7xl mx-auto">
              <SectionLabel number="06" label="Usage Rules" />

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  "Do not stretch, rotate, or skew the logo.",
                  "Do not apply effects (shadows, glows, gradients).",
                  "Do not place on busy or low-contrast backgrounds.",
                  "Do not use as a pattern or decorative element.",
                  "Do not alter colors outside provided variants.",
                  "Do not add outlines, strokes, or borders.",
                  "Do not combine with other brand lockups.",
                  "Do not imply partnership without permission.",
                ].map((rule, i) => (
                  <motion.div
                    key={i}
                    className="border border-border/20 bg-background p-6 relative group"
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: i * 0.04 }}
                  >
                    <span className="text-[10px] font-mono text-destructive/40 block mb-3">✕</span>
                    <p className="text-muted-foreground/60 text-[12px] leading-relaxed">{rule}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* ═══ Download CTA ═══ */}
          <section className="py-28 px-8 lg:px-16">
            <div className="max-w-xl mx-auto text-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <Download className="w-8 h-8 text-foreground/20 mx-auto mb-8" />
                <h2 className="text-2xl sm:text-3xl font-extralight text-foreground tracking-tight mb-4">
                  Need assets?
                </h2>
                <p className="text-muted-foreground/50 text-sm mb-8 leading-relaxed">
                  For press kits, logo files, or brand questions.
                </p>
                <a
                  href="mailto:support@kloak.app"
                  className="inline-flex items-center gap-2 text-xs font-mono text-foreground/60 hover:text-foreground tracking-widest uppercase transition-colors border-b border-foreground/10 hover:border-foreground/30 pb-1"
                >
                  support@kloak.app
                </a>
              </motion.div>
            </div>
          </section>

        </main>
        <Footer />
      </div>
    </div>
  );
};

export default Brand;
