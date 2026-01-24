import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Check, X, MessageCircle, Lock, Users, Zap, Shield } from "lucide-react";
import { Footer } from "@/components/ui/footer-section";
import { LandingNav } from "@/components/landing/LandingNav";
import HeroPalantir from "@/components/landing/HeroPalantir";

// Fade in animation for sections
const fadeInUp = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
};

// HUD corner component for sections
const SectionCorners = () => (
  <>
    <div className="absolute top-8 left-8 w-8 h-8 border-l border-t border-primary/20" />
    <div className="absolute top-8 right-8 w-8 h-8 border-r border-t border-primary/20" />
    <div className="absolute bottom-8 left-8 w-8 h-8 border-l border-b border-primary/20" />
    <div className="absolute bottom-8 right-8 w-8 h-8 border-r border-b border-primary/20" />
  </>
);

// Section label component
const SectionLabel = ({ number, label }: { number: string; label: string }) => (
  <div className="flex items-center gap-4 mb-8">
    <span className="text-[10px] font-mono text-primary/50 tracking-widest">{number}</span>
    <div className="w-12 h-px bg-gradient-to-r from-primary/40 to-transparent" />
    <span className="text-[10px] font-mono text-primary/70 tracking-[0.3em] uppercase">
      {label}
    </span>
  </div>
);

const Index = () => {
  const comparisonData = [
    { label: "Email required", others: true, kloak: false },
    { label: "Phone number required", others: true, kloak: false },
    { label: "Password stored on servers", others: true, kloak: false },
    { label: "Behavioral tracking", others: true, kloak: false },
    { label: "Data sold to advertisers", others: true, kloak: false },
    { label: "AI trained on your messages", others: true, kloak: false },
    { label: "Account recovery by platform", others: true, kloak: false },
    { label: "You control your identity", others: false, kloak: true },
  ];

  const principles = [
    {
      number: "01",
      title: "Zero data collection",
      description:
        "No email. No phone. No identity. We collect only what's essential for the app to function.",
    },
    {
      number: "02",
      title: "Cryptographic keys",
      description:
        "Your account is secured by a 64-character key that only you possess. Unrecoverable by design.",
    },
    {
      number: "03",
      title: "No surveillance",
      description:
        "No ads. No tracking. No profiling. No analytics. No pixels. No fingerprinting.",
    },
    {
      number: "04",
      title: "Open architecture",
      description:
        "Transparent approach. We tell you exactly what we do and don't do. No fine print.",
    },
  ];

  const capabilities = [
    {
      icon: MessageCircle,
      title: "Real-Time Messaging",
      description: "Instant delivery across servers and channels. Built for speed.",
      size: "large",
    },
    {
      icon: Lock,
      title: "Key-Based Auth",
      description: "One cryptographic key. No passwords. No vulnerabilities.",
      size: "small",
    },
    {
      icon: Users,
      title: "Communities",
      description: "Servers, channels, categories. Organized your way.",
      size: "small",
    },
    {
      icon: Zap,
      title: "Modern Stack",
      description: "Fast, responsive, and built to scale with you.",
      size: "large",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <LandingNav />

      <main>
        {/* Hero Section */}
        <HeroPalantir />

        {/* Problem Section */}
        <section className="relative py-32 px-6 overflow-hidden">
          <SectionCorners />

          <div className="max-w-7xl mx-auto">
            <motion.div className="grid lg:grid-cols-2 gap-16 items-start" {...fadeInUp}>
              <div>
                <SectionLabel number="001" label="The Problem" />
                <h2 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-foreground leading-[1.1] tracking-tight">
                  Every message is{" "}
                  <span className="text-primary">monetized.</span>
                </h2>
              </div>

              <div className="lg:pt-16">
                <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                  Most platforms treat your conversations as inventory. Your words become data
                  points. Your relationships become ad targets.
                </p>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  We built Kloak because communication is a human right — not a business model.
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Comparison Section */}
        <section className="relative py-32 px-6 border-y border-border/10 overflow-hidden">
          <SectionCorners />

          <div className="max-w-7xl mx-auto">
            <motion.div className="mb-16" {...fadeInUp}>
              <SectionLabel number="002" label="The Difference" />
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-foreground leading-[1.1] tracking-tight max-w-3xl">
                What they collect.{" "}
                <span className="text-primary">What we don't.</span>
              </h2>
            </motion.div>

            {/* Comparison table */}
            <motion.div
              className="border border-border/20 overflow-hidden"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] as const, delay: 0.2 }}
            >
              {/* Header */}
              <div className="grid grid-cols-[1fr,100px,100px] sm:grid-cols-[1fr,120px,120px] border-b border-border/20">
                <div className="p-4 sm:p-6 text-[10px] font-mono text-muted-foreground tracking-widest uppercase">
                  Feature
                </div>
                <div className="p-4 sm:p-6 text-center text-[10px] font-mono text-muted-foreground tracking-widest uppercase border-l border-border/20">
                  Others
                </div>
                <div className="p-4 sm:p-6 text-center text-[10px] font-mono text-primary tracking-widest uppercase border-l border-border/20">
                  Kloak
                </div>
              </div>

              {/* Rows */}
              {comparisonData.map((row, index) => (
                <motion.div
                  key={row.label}
                  className="grid grid-cols-[1fr,100px,100px] sm:grid-cols-[1fr,120px,120px] border-b border-border/10 last:border-b-0 hover:bg-muted/5 transition-colors duration-300"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                >
                  <div className="p-4 sm:p-6 text-sm text-foreground">{row.label}</div>
                  <div className="p-4 sm:p-6 flex items-center justify-center border-l border-border/10">
                    {row.others ? (
                      <div className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center">
                        <Check className="w-3 h-3 text-destructive" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-muted/30 flex items-center justify-center">
                        <X className="w-3 h-3 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="p-4 sm:p-6 flex items-center justify-center border-l border-border/10">
                    {row.kloak ? (
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                        <X className="w-3 h-3 text-primary" />
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Tagline */}
            <motion.p
              className="text-center text-muted-foreground text-lg font-mono mt-12"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] as const, delay: 0.4 }}
            >
              The less we know about you, the less anyone can take.
            </motion.p>
          </div>
        </section>

        {/* Principles Section */}
        <section className="relative py-32 px-6 overflow-hidden">
          <SectionCorners />

          {/* Subtle grid background */}
          <div
            className="absolute inset-0 opacity-[0.02] pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(hsl(var(--primary)) 1px, transparent 1px),
                linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)
              `,
              backgroundSize: "60px 60px",
            }}
          />

          <div className="max-w-7xl mx-auto relative">
            <motion.div className="mb-20" {...fadeInUp}>
              <SectionLabel number="003" label="Our Principles" />
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-foreground leading-[1.1] tracking-tight max-w-3xl">
                Privacy isn't a feature.{" "}
                <span className="text-primary">It's the architecture.</span>
              </h2>
            </motion.div>

            {/* Principles grid */}
            <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
              {principles.map((principle, index) => (
                <motion.div
                  key={principle.number}
                  className="group relative border border-border/20 p-8 lg:p-12 bg-transparent hover:border-primary/30 transition-all duration-500"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                >
                  {/* Corner accents */}
                  <div className="absolute top-0 left-0 w-4 h-4 border-l border-t border-primary/30 group-hover:border-primary/50 transition-colors" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-r border-t border-primary/30 group-hover:border-primary/50 transition-colors" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-l border-b border-primary/30 group-hover:border-primary/50 transition-colors" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-r border-b border-primary/30 group-hover:border-primary/50 transition-colors" />

                  <div className="flex items-start gap-6">
                    <span className="text-5xl font-mono font-light text-primary/30 group-hover:text-primary/50 transition-colors">
                      {principle.number}
                    </span>
                    <div>
                      <h3 className="text-xl font-semibold text-foreground mb-3 tracking-tight">
                        {principle.title}
                      </h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {principle.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Capabilities Section */}
        <section className="relative py-32 px-6 border-y border-border/10 overflow-hidden">
          <SectionCorners />

          <div className="max-w-7xl mx-auto">
            <motion.div className="mb-20" {...fadeInUp}>
              <SectionLabel number="004" label="Capabilities" />
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-foreground leading-[1.1] tracking-tight max-w-2xl">
                Full-featured.{" "}
                <span className="text-primary">Zero compromise.</span>
              </h2>
            </motion.div>

            {/* Capabilities grid */}
            <div className="grid lg:grid-cols-12 gap-6">
              {capabilities.map((cap, index) => {
                const Icon = cap.icon;
                const isLarge = cap.size === "large";

                return (
                  <motion.div
                    key={cap.title}
                    className={`relative border border-border/20 p-8 lg:p-10 group hover:border-primary/30 transition-all duration-500 bg-transparent ${
                      isLarge ? "lg:col-span-7" : "lg:col-span-5"
                    }`}
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                  >
                    {/* Corner accents */}
                    <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-primary/30 group-hover:border-primary/50 transition-colors" />
                    <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-primary/30 group-hover:border-primary/50 transition-colors" />
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 border-primary/30 group-hover:border-primary/50 transition-colors" />
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-primary/30 group-hover:border-primary/50 transition-colors" />

                    <Icon
                      className={`text-primary mb-6 ${isLarge ? "w-10 h-10" : "w-8 h-8"}`}
                    />
                    <h3
                      className={`font-semibold text-foreground tracking-tight mb-3 ${
                        isLarge ? "text-3xl sm:text-4xl" : "text-2xl"
                      }`}
                    >
                      {cap.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed max-w-md">
                      {cap.description}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* For Everyone Section */}
        <section className="relative py-32 px-6 overflow-hidden">
          <SectionCorners />

          <div className="max-w-7xl mx-auto">
            <motion.div className="text-center mb-20" {...fadeInUp}>
              <SectionLabel number="005" label="For Everyone" />
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-foreground leading-[1.1] tracking-tight max-w-4xl mx-auto mb-6">
                Free speech starts with{" "}
                <span className="text-primary">free infrastructure.</span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                No premium tiers. No enterprise-only security. Everyone gets everything.
              </p>
            </motion.div>

            {/* Use case cards */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  title: "Activists & Organizers",
                  description: "Coordinate movements without surveillance.",
                },
                {
                  title: "Creative Communities",
                  description: "Share your art in spaces you control.",
                },
                {
                  title: "Gaming Groups",
                  description: "Voice chat and guild coordination.",
                },
                {
                  title: "Small Businesses",
                  description: "Team communication without Big Tech.",
                },
                {
                  title: "Friends & Family",
                  description: "Private group chats that stay private.",
                },
                {
                  title: "Privacy Advocates",
                  description: "A platform that practices what it preaches.",
                },
              ].map((card, index) => (
                <motion.div
                  key={card.title}
                  className="group relative border border-border/20 p-8 hover:border-primary/30 transition-all duration-500"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: index * 0.08 }}
                >
                  {/* Corner accents */}
                  <div className="absolute top-0 left-0 w-3 h-3 border-l border-t border-primary/20 group-hover:border-primary/40 transition-colors" />
                  <div className="absolute top-0 right-0 w-3 h-3 border-r border-t border-primary/20 group-hover:border-primary/40 transition-colors" />
                  <div className="absolute bottom-0 left-0 w-3 h-3 border-l border-b border-primary/20 group-hover:border-primary/40 transition-colors" />
                  <div className="absolute bottom-0 right-0 w-3 h-3 border-r border-b border-primary/20 group-hover:border-primary/40 transition-colors" />

                  <h3 className="text-lg font-semibold text-foreground mb-2 tracking-tight">
                    {card.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{card.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative py-32 px-6 border-t border-border/10 overflow-hidden">
          <SectionCorners />

          <div className="max-w-4xl mx-auto text-center">
            <motion.div {...fadeInUp}>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-foreground leading-[1.1] tracking-tight mb-8">
                Ready to take back{" "}
                <span className="text-primary">your privacy?</span>
              </h2>

              <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-12">
                Join Kloak and experience communication without compromise.
              </p>

              <div className="flex items-center justify-center gap-4 flex-wrap">
                <Link to="/app">
                  <button className="group flex items-center gap-3 bg-foreground text-background px-8 py-4 text-sm font-medium tracking-[0.1em] uppercase transition-all duration-300 hover:bg-primary hover:text-primary-foreground">
                    Get Started
                    <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </button>
                </Link>

                <Link to="/philosophy">
                  <button className="flex items-center gap-3 border border-border/50 px-8 py-4 text-sm font-medium tracking-[0.1em] uppercase text-muted-foreground transition-all duration-300 hover:border-foreground/50 hover:text-foreground">
                    Our Philosophy
                  </button>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
