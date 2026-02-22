import { motion } from "framer-motion";
import { NavigationMenu } from "@/components/layout/NavigationMenu";
import { Footer } from "@/components/ui/footer-section";
import { SEO } from "@/components/seo";
import { Copy, Check, Download } from "lucide-react";
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

/* ─── Section wrapper ─── */
const Section = ({
  id,
  label,
  title,
  children,
  alternate = false,
}: {
  id: string;
  label: string;
  title: string;
  children: React.ReactNode;
  alternate?: boolean;
}) => (
  <section
    id={id}
    className={`relative py-24 px-8 lg:px-16 border-b border-border/20 ${alternate ? "bg-card/50" : ""}`}
  >
    <div className="max-w-7xl mx-auto">
      <motion.div
        className="mb-16"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <span className="text-xs font-mono text-primary tracking-widest uppercase mb-3 block">{label}</span>
        <h2 className="text-3xl sm:text-4xl font-light text-foreground tracking-tight">{title}</h2>
      </motion.div>
      {children}
    </div>
  </section>
);

/* ─── Page ─── */
const Brand = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center w-full">
      <SEO title="Brand Guidelines" description="Official brand guidelines for Kloak. Logos, colors, typography, and usage rules for the privacy-first communication platform." />
      <div className="w-full">
        <NavigationMenu />
        <main className="pt-10">

          {/* ═══ Hero ═══ */}
          <section className="relative py-32 md:py-40 px-8 lg:px-16 overflow-hidden bg-foreground">
            <div className="max-w-7xl mx-auto">
              <motion.span
                className="text-xs font-mono text-background/60 tracking-widest uppercase block mb-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6 }}
              >
                Brand Guidelines
              </motion.span>

              <motion.h1
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light text-background leading-tight tracking-tight mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1 }}
              >
                The Kloak
                <br />
                <span className="text-background/50">identity system.</span>
              </motion.h1>

              <motion.p
                className="text-lg md:text-xl text-background/60 max-w-2xl leading-relaxed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                Rules for representing Kloak across all media. Consistent, minimal, intentional.
              </motion.p>
            </div>
          </section>

          {/* ═══ Table of Contents ═══ */}
          <section className="py-12 px-8 lg:px-16 border-b border-border/20 bg-card/50">
            <div className="max-w-7xl mx-auto flex flex-wrap gap-6">
              {["Logo", "Color", "Typography", "Spacing", "Tone", "Usage"].map((s) => (
                <a
                  key={s}
                  href={`#${s.toLowerCase()}`}
                  className="text-xs font-mono text-muted-foreground hover:text-foreground tracking-widest uppercase transition-colors"
                >
                  {s}
                </a>
              ))}
            </div>
          </section>

          {/* ═══ 01 · Logo ═══ */}
          <Section id="logo" label="01 · Logo" title="Logomark & wordmark.">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Light on dark */}
              <motion.div
                className="border border-border/30 bg-background p-12 flex flex-col items-center justify-center gap-8 min-h-[280px]"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <img src={kloakLogo} alt="Kloak logo light" className="h-8" />
                <span className="text-xs font-mono text-muted-foreground tracking-widest uppercase">
                  Primary — dark background
                </span>
              </motion.div>

              {/* Dark on light */}
              <motion.div
                className="border border-border/30 bg-foreground p-12 flex flex-col items-center justify-center gap-8 min-h-[280px]"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <img src={kloakLogo} alt="Kloak logo dark" className="h-8 invert" />
                <span className="text-xs font-mono text-background/60 tracking-widest uppercase">
                  Inverted — light background
                </span>
              </motion.div>
            </div>

            {/* K monogram */}
            <motion.div
              className="mt-6 border border-border/30 bg-background p-12 flex flex-col items-center justify-center gap-8"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <img src="/logo-k-b.svg" alt="Kloak K monogram" className="h-16 invert" />
              <span className="text-xs font-mono text-muted-foreground tracking-widest uppercase">
                K Monogram — app icon &amp; favicon
              </span>
            </motion.div>

            {/* Clear space & rules */}
            <div className="mt-12 grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-lg font-medium text-foreground mb-4">Clear space</h3>
                <p className="text-muted-foreground leading-relaxed text-[15px]">
                  Maintain a minimum clear space equal to the height of the "K" letterform on all sides of the logo. Never crowd the logo with other elements, text, or edges.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-foreground mb-4">Minimum size</h3>
                <p className="text-muted-foreground leading-relaxed text-[15px]">
                  The wordmark should never appear smaller than 80px wide in digital contexts or 20mm in print. The monogram should never appear smaller than 16px / 4mm.
                </p>
              </div>
            </div>
          </Section>

          {/* ═══ 02 · Color ═══ */}
          <Section id="color" label="02 · Color" title="Palette & tokens." alternate>
            {/* Brand swatches */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {brandColors.map((c, i) => (
                <motion.div
                  key={c.name}
                  className="border border-border/30 bg-background overflow-hidden group"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                >
                  <div className="h-20" style={{ backgroundColor: c.hex }} />
                  <div className="p-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{c.name}</span>
                      <CopyButton text={c.hex} />
                    </div>
                    <p className="text-xs font-mono text-muted-foreground">{c.hex}</p>
                    <p className="text-xs font-mono text-muted-foreground/60">{c.hsl}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Status colors */}
            <div className="mt-12">
              <h3 className="text-lg font-medium text-foreground mb-6">Status indicators</h3>
              <div className="flex flex-wrap gap-6">
                {statusColors.map((s) => (
                  <div key={s.name} className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: s.hex }} />
                    <span className="text-sm text-foreground">{s.name}</span>
                    <span className="text-xs font-mono text-muted-foreground">{s.hex}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Token philosophy */}
            <div className="mt-12 border border-border/30 bg-background p-8">
              <h3 className="text-lg font-medium text-foreground mb-3">Design token philosophy</h3>
              <p className="text-muted-foreground leading-relaxed text-[15px]">
                Kloak uses semantic CSS custom properties (e.g. <code className="text-xs font-mono text-primary px-1.5 py-0.5 bg-muted rounded">--background</code>, <code className="text-xs font-mono text-primary px-1.5 py-0.5 bg-muted rounded">--primary</code>) rather than hard-coded color values. This powers the multi-theme system. Components should always reference tokens, never raw hex/hsl.
              </p>
            </div>
          </Section>

          {/* ═══ 03 · Typography ═══ */}
          <Section id="typography" label="03 · Typography" title="Typefaces & scale.">
            {/* Typeface */}
            <div className="grid md:grid-cols-2 gap-8 mb-12">
              <div className="border border-border/30 bg-background p-8">
                <span className="text-xs font-mono text-primary tracking-widest uppercase block mb-4">Primary</span>
                <p className="text-3xl font-light text-foreground tracking-tight mb-2">Stack Sans Headline</p>
                <p className="text-muted-foreground text-sm">Weights 300-700. Used for all UI text, headings, and body copy. Clean geometry with humanist proportions.</p>
              </div>
              <div className="border border-border/30 bg-background p-8">
                <span className="text-xs font-mono text-primary tracking-widest uppercase block mb-4">Monospace</span>
                <p className="text-3xl font-mono text-foreground tracking-tight mb-2">System Mono</p>
                <p className="text-muted-foreground text-sm">Used for labels, tags, code blocks, and the secret key display. Inherits the system monospace stack.</p>
              </div>
            </div>

            {/* Scale */}
            <div className="space-y-6">
              {typographySamples.map((t, i) => (
                <motion.div
                  key={t.label}
                  className="border-b border-border/20 pb-6"
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                >
                  <span className="text-xs font-mono text-muted-foreground tracking-widest uppercase block mb-3">
                    {t.label}
                  </span>
                  <p className={`text-foreground ${t.className}`}>{t.sample}</p>
                </motion.div>
              ))}
            </div>
          </Section>

          {/* ═══ 04 · Spacing ═══ */}
          <Section id="spacing" label="04 · Spacing" title="Spatial rhythm." alternate>
            <p className="text-muted-foreground leading-relaxed text-[15px] mb-10 max-w-2xl">
              Kloak uses a 4px base grid. All spacing, padding, and sizing should be multiples of 4. This creates visual consistency across every surface.
            </p>
            <div className="space-y-4">
              {spacingScale.map((px) => (
                <div key={px} className="flex items-center gap-6">
                  <span className="text-xs font-mono text-muted-foreground w-12 text-right">{px}px</span>
                  <div
                    className="h-3 bg-primary/30 border border-primary/20"
                    style={{ width: `${px * 3}px` }}
                  />
                  <span className="text-xs font-mono text-muted-foreground/50">
                    {px / 4}rem
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-12 border border-border/30 bg-background p-8">
              <h3 className="text-lg font-medium text-foreground mb-3">Border radius</h3>
              <p className="text-muted-foreground leading-relaxed text-[15px] mb-6">
                Default radius is 6px (<code className="text-xs font-mono text-primary px-1.5 py-0.5 bg-muted rounded">--radius: 0.375rem</code>). Buttons and cards use the base radius. Avatars and status dots are fully rounded. The aesthetic leans sharp over soft.
              </p>
              <div className="flex items-end gap-6">
                <div className="w-16 h-16 border border-border/50 bg-muted/30 rounded-sm flex items-center justify-center">
                  <span className="text-[10px] font-mono text-muted-foreground">sm</span>
                </div>
                <div className="w-16 h-16 border border-border/50 bg-muted/30 rounded-md flex items-center justify-center">
                  <span className="text-[10px] font-mono text-muted-foreground">md</span>
                </div>
                <div className="w-16 h-16 border border-border/50 bg-muted/30 rounded-lg flex items-center justify-center">
                  <span className="text-[10px] font-mono text-muted-foreground">lg</span>
                </div>
                <div className="w-16 h-16 border border-border/50 bg-muted/30 rounded-full flex items-center justify-center">
                  <span className="text-[10px] font-mono text-muted-foreground">full</span>
                </div>
              </div>
            </div>
          </Section>

          {/* ═══ 05 · Tone ═══ */}
          <Section id="tone" label="05 · Voice & Tone" title="How Kloak speaks.">
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  title: "Direct",
                  description: "Say what you mean. No marketing fluff, no buzzwords. Short sentences. Active voice. If it can be said in fewer words, do it.",
                },
                {
                  title: "Honest",
                  description: "Never exaggerate capabilities. Acknowledge limitations openly. If something is hard, say it is hard. Trust is built through transparency.",
                },
                {
                  title: "Calm",
                  description: "No exclamation marks in UI copy. No urgency theater. No dark patterns. The tone is quiet confidence, not hype.",
                },
              ].map((item, i) => (
                <motion.div
                  key={item.title}
                  className="border border-border/30 bg-background p-8"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                >
                  <h3 className="text-lg font-medium text-foreground mb-3">{item.title}</h3>
                  <p className="text-muted-foreground leading-relaxed text-[15px]">{item.description}</p>
                </motion.div>
              ))}
            </div>

            <div className="mt-12 grid md:grid-cols-2 gap-6">
              <div className="border border-border/30 bg-background p-8">
                <span className="text-xs font-mono text-kloak-online tracking-widest uppercase block mb-4">Do</span>
                <ul className="space-y-3 text-muted-foreground text-[15px]">
                  <li className="flex items-start gap-3">
                    <span className="text-kloak-online mt-1">+</span>
                    <span>"Your key is the only way to access your account."</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-kloak-online mt-1">+</span>
                    <span>"We don't collect email addresses."</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-kloak-online mt-1">+</span>
                    <span>"Privacy is the architecture."</span>
                  </li>
                </ul>
              </div>
              <div className="border border-border/30 bg-background p-8">
                <span className="text-xs font-mono text-destructive tracking-widest uppercase block mb-4">Don't</span>
                <ul className="space-y-3 text-muted-foreground text-[15px]">
                  <li className="flex items-start gap-3">
                    <span className="text-destructive mt-1">-</span>
                    <span>"Revolutionary next-gen privacy solution!"</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-destructive mt-1">-</span>
                    <span>"Join millions of users today!"</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-destructive mt-1">-</span>
                    <span>"Don't miss out on our exclusive features!"</span>
                  </li>
                </ul>
              </div>
            </div>
          </Section>

          {/* ═══ 06 · Usage ═══ */}
          <Section id="usage" label="06 · Usage Rules" title="What not to do." alternate>
            <div className="grid sm:grid-cols-2 gap-6">
              {[
                "Do not stretch, rotate, or skew the logo.",
                "Do not apply effects (drop shadows, glows, gradients) to the logo.",
                "Do not place the logo on busy or low-contrast backgrounds.",
                "Do not use the logo as a pattern or decorative element.",
                "Do not alter the logo colors outside of the provided variants.",
                "Do not add outlines, strokes, or borders to the logo.",
                "Do not pair the Kloak name with other brand names in a combined lockup.",
                "Do not use the brand to imply partnership or endorsement without permission.",
              ].map((rule, i) => (
                <motion.div
                  key={i}
                  className="flex items-start gap-4 border border-border/30 bg-background p-6"
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                >
                  <span className="text-destructive font-mono text-sm mt-0.5">✕</span>
                  <p className="text-muted-foreground text-[15px] leading-relaxed">{rule}</p>
                </motion.div>
              ))}
            </div>
          </Section>

          {/* ═══ Download CTA ═══ */}
          <section className="py-24 px-8 lg:px-16 border-b border-border/20">
            <div className="max-w-2xl mx-auto">
              <motion.div
                className="text-center border border-border/30 bg-background p-10 md:p-14"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <Download className="w-12 h-12 text-primary mx-auto mb-6" />
                <h2 className="text-3xl sm:text-4xl font-light text-foreground tracking-tight mb-4">
                  Need assets?
                </h2>
                <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed mb-6">
                  For press kits, logo files, or brand questions, reach out to us directly.
                </p>
                <a
                  href="mailto:support@kloak.app"
                  className="inline-flex items-center gap-2 text-sm font-mono text-primary hover:text-foreground tracking-widest uppercase transition-colors"
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
