import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Key,
  MessageCircle,
  Users,
  Zap,
  Lock,
  X,
  Check,
  Mic,
  Headphones,
  Palette,
  Gamepad2,
  Music,
  Video,
} from "lucide-react";
import { Footer } from "@/components/ui/footer-section";
import { NavigationMenu } from "@/components/layout/NavigationMenu";
import HeroAscii from "@/components/landing/HeroAscii";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SEO } from "@/components/seo";
import { SEO_CONFIG } from "@/lib/seo";

const audienceGroups = [
  {
    name: "Gaming Communities",
    description:
      "Coordinate raids, share strategies, or rage at your friend screwing up that 1v1. Your voice comms and battle plans stay between you and your squad.",
  },
  {
    name: "Musicians & Producers",
    description:
      "Share demos, collaborate on tracks, and jam together. Your unreleased work won't train someone else's AI or leak before you're ready.",
  },
  {
    name: "Artists & Designers",
    description:
      "Share work-in-progress, get feedback, build your community. No algorithms deciding who sees your art.",
  },
  {
    name: "Streamers & Creators",
    description: "Connect with your audience on your terms. No platform mining your community for engagement metrics.",
  },
  {
    name: "Indie Dev Teams",
    description: "Ship games, share builds, coordinate launches. Your roadmap and source code stay confidential.",
  },
  {
    name: "Creative Collectives",
    description:
      "Your community, your culture, your rules. Build spaces that reflect your values, not a corporation's.",
  },
];

const Index = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % audienceGroups.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const comparisonData = [
    { label: "Messages scanned for ad targeting", others: true, kloak: false },
    { label: "Creative work used to train AI", others: true, kloak: false },
    { label: "Algorithm decides who sees your content", others: true, kloak: false },
    { label: "Premium tiers for basic features", others: true, kloak: false },
    { label: "Behavioral profiling & analytics", others: true, kloak: false },
    { label: "Platform can ban your community", others: true, kloak: false },
    { label: "You own your community data", others: false, kloak: true },
    { label: "Same features for everyone", others: false, kloak: true },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      <SEO {...SEO_CONFIG.home} />
      <div className="w-full">
        <NavigationMenu />
        <main className="pt-10">
          {/* Hero Section */}
          <HeroAscii />

          {/* What is Kloak Section */}
          <section className="relative py-32 md:py-48 px-8 lg:px-16 border-t border-border/20 overflow-hidden">
            <div className="max-w-7xl mx-auto">
              {/* Section header */}
              <motion.div
                className="flex items-center gap-4 mb-12"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <span className="text-xs font-mono text-primary tracking-widest uppercase">What is Kloak</span>
              </motion.div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
                {/* Left Column - Hook & What It Is */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.8 }}
                  className="space-y-8"
                >
                  <div className="flex items-start gap-4">
                    <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-foreground leading-tight tracking-tight">
                      A place to talk
                      <br />
                      <span className="text-primary/60">without being watched.</span>
                    </h2>
                  </div>

                  <p className="text-lg md:text-xl text-primary leading-relaxed max-w-xl">
                    Kloak is where creative communities thrive—without surveillance, without algorithms, without your
                    work becoming someone else's training data.
                  </p>

                  <div className="flex flex-wrap gap-6 text-sm text-primary/50">
                    <span className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      No ads
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      No AI training
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      No algorithm
                    </span>
                  </div>
                </motion.div>

                {/* Right Column - Rotating Audience Box */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="relative"
                >
                  <div className="relative rounded-none border border-border/30 bg-background/50 backdrop-blur-sm p-8 md:p-10 min-h-[320px] overflow-hidden">
                    {/* Label */}
                    <span className="text-xs font-mono uppercase tracking-widest text-primary/40 mb-6 block">
                      Built for
                    </span>

                    {/* Rotating Content */}
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeIndex}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-4"
                      >
                        <h3 className="text-2xl md:text-3xl font-medium text-foreground">
                          {audienceGroups[activeIndex].name}
                        </h3>
                        <p className="text-primary/70 text-lg leading-relaxed">
                          {audienceGroups[activeIndex].description}
                        </p>
                      </motion.div>
                    </AnimatePresence>

                    {/* Progress Indicators */}
                    <div className="absolute bottom-8 left-8 right-8 flex gap-2">
                      {audienceGroups.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveIndex(i)}
                          className="flex-1 h-1 rounded-full overflow-hidden bg-border/30 cursor-pointer"
                        >
                          <motion.div
                            className="h-full bg-primary/60 rounded-full"
                            initial={{ width: "0%" }}
                            animate={{
                              width: i === activeIndex ? "100%" : "0%",
                            }}
                            transition={{
                              duration: i === activeIndex ? 6 : 0,
                              ease: "linear",
                            }}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* The Differentiator - Full Width Below */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4, duration: 0.8 }}
                className="text-center text-lg md:text-xl text-primary/60 max-w-2xl mx-auto mt-24"
              >
                Other platforms promise privacy in their terms of service. We built Kloak so we{" "}
                <span className="text-foreground italic">physically cannot</span> access your data—even if we wanted to.
              </motion.p>
            </div>
          </section>

          {/* Problem Section - The Comparison */}
          <section className="relative py-32 px-8 lg:px-16 bg-card/50 border-y border-border/20 overflow-hidden">
            <div className="max-w-7xl mx-auto">
              <motion.div
                className="mb-16"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                {/* Section header */}
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-xs font-mono text-primary tracking-widest uppercase">The Problem</span>
                </div>
                <div className="flex items-start gap-4">
                  <div className="hidden md:block w-px h-24 bg-gradient-to-b from-primary/50 to-transparent" />
                  <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-foreground leading-tight tracking-tight">
                    What they take.
                    <br />
                    <span className="text-primary/60">What we don't.</span>
                  </h2>
                </div>
              </motion.div>

              <motion.div
                className="rounded-lg border border-border/30 overflow-hidden bg-background relative"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/30 hover:bg-transparent">
                      <TableHead className="text-muted-foreground font-mono text-xs tracking-wider w-[50%] uppercase">
                        Reality
                      </TableHead>
                      <TableHead className="text-center text-muted-foreground font-mono text-xs tracking-wider uppercase">
                        Others
                      </TableHead>
                      <TableHead className="text-center text-primary font-mono text-xs tracking-wider uppercase">
                        Kloak
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparisonData.map((row, index) => (
                      <motion.tr
                        key={row.label}
                        className="border-border/20 transition-colors hover:bg-muted/30"
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4, delay: index * 0.05 }}
                      >
                        <TableCell className="font-light text-foreground uppercase tracking-wider text-sm">
                          {row.label}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.others ? (
                            <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                              <Check className="w-4 h-4 text-destructive" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center mx-auto">
                              <X className="w-4 h-4 text-muted-foreground/50" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.kloak ? (
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                              <Check className="w-4 h-4 text-primary" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                              <X className="w-4 h-4 text-primary" />
                            </div>
                          )}
                        </TableCell>
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              </motion.div>

              <motion.p
                className="text-center landing-body text-muted-foreground mt-12"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                Your creativity shouldn't fund someone else's business model.
              </motion.p>
            </div>
          </section>

          {/* Capabilities Section */}
          <section className="relative py-32 px-8 lg:px-16 border-b border-border/20 overflow-hidden">
            <div className="max-w-7xl mx-auto">
              <motion.div
                className="mb-20"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                {/* Section header */}
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-xs font-mono text-primary tracking-widest uppercase">Capabilities</span>
                </div>
                <div className="flex items-start gap-4">
                  <div className="hidden md:block w-px h-24 bg-gradient-to-b from-primary/50 to-transparent" />
                  <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-foreground leading-tight tracking-tight">
                    Everything you need.
                    <br />
                    <span className="text-primary/60">Nothing you don't.</span>
                  </h2>
                </div>
              </motion.div>

              {/* Feature Grid - Matching Problem Section aesthetics */}
              <div className="grid md:grid-cols-2 gap-6">
                {[
                  {
                    icon: MessageCircle,
                    title: "Real-Time Chat",
                    description:
                      "Instant messaging across servers, channels, and DMs. Fast enough for raid callouts, private enough for unreleased tracks.",
                    accent: true,
                  },
                  {
                    icon: Headphones,
                    title: "Voice Channels",
                    description:
                      "Crystal-clear voice for your squad, your band practice, your D&D session. No compression artifacts ruining the vibe.",
                    accent: false,
                  },
                  {
                    icon: Users,
                    title: "Flexible Communities",
                    description:
                      "Servers, channels, categories, roles. Organize your community the way it makes sense for you—not the way a PM decided.",
                    accent: false,
                  },
                  {
                    icon: Lock,
                    title: "Key-Based Identity",
                    description:
                      "One cryptographic key, full control. No email, no phone number, no password to leak in the next breach.",
                    accent: true,
                  },
                ].map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    className={`relative border border-border/30 p-10 group overflow-hidden ${feature.accent ? "bg-card/50" : "bg-background"}`}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    {/* Subtle corner accent matching Problem Section */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary/5 to-transparent" />

                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 border border-primary/30 flex items-center justify-center shrink-0 group-hover:border-primary/50 transition-colors duration-300">
                        <feature.icon className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="landing-card-title text-foreground mb-3 text-lg">{feature.title}</h3>
                        <p className="landing-body text-muted-foreground text-sm leading-relaxed">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Coming Soon - Voice */}
              <motion.div
                className="mt-6 border border-dashed border-border/40 p-8 text-center"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <div className="flex items-center justify-center gap-3 mb-3">
                  <Mic className="w-5 h-5 text-primary/50" />
                  <span className="text-xs font-mono text-primary/50 tracking-widest uppercase">Coming Soon</span>
                </div>
                <p className="text-muted-foreground text-sm">
                  Studio-quality audio mode for musicians and producers. High-fidelity voice that doesn't butcher your
                  sound.
                </p>
              </motion.div>
            </div>
          </section>

          {/* Principles Section */}
          <section className="relative py-32 px-8 lg:px-16 bg-card/50 border-b border-border/20 overflow-hidden">
            <div className="max-w-7xl mx-auto">
              <motion.div
                className="mb-20"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                {/* Section header */}
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-xs font-mono text-primary tracking-widest uppercase">Our Principles</span>
                </div>
                <div className="flex items-start gap-4">
                  <div className="hidden md:block w-px h-24 bg-gradient-to-b from-primary/50 to-transparent" />
                  <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-foreground leading-tight tracking-tight">
                    Privacy isn't a feature.
                    <br />
                    <span className="text-primary/60">It's the architecture.</span>
                  </h2>
                </div>
              </motion.div>

              <div className="grid md:grid-cols-2 gap-6">
                {[
                  {
                    number: "01",
                    title: "Your work stays yours",
                    description:
                      "Nothing you share on Kloak trains AI models. Your unreleased tracks, your concept art, your game designs—they're not fodder for machine learning.",
                  },
                  {
                    number: "02",
                    title: "No algorithmic gatekeeping",
                    description:
                      "When you post, your community sees it. No engagement optimization, no reach throttling, no mysterious shadowbans.",
                  },
                  {
                    number: "03",
                    title: "Cryptographic identity",
                    description:
                      "Your account lives in a 64-character key that only you possess. We can't reset it, we can't access it, we can't hand it over.",
                  },
                  {
                    number: "04",
                    title: "One tier for everyone",
                    description:
                      "No premium unlocks, no artificial limits, no FOMO. Every feature we build ships to everyone. Your subscription supports the platform—that's it.",
                  },
                ].map((principle, index) => (
                  <motion.div
                    key={principle.number}
                    className="group relative"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <div className="relative border border-border/30 p-8 bg-background hover:border-primary/30 transition-colors duration-300">
                      <div className="flex items-start gap-4">
                        <span className="text-4xl font-mono font-semibold text-primary/30 group-hover:text-primary/50 transition-colors duration-300">
                          {principle.number}
                        </span>
                        <div className="w-px h-12 bg-gradient-to-b from-primary/20 to-transparent" />
                        <div className="flex-1">
                          <h3 className="landing-card-title text-foreground mb-3">{principle.title}</h3>
                          <p className="landing-body text-muted-foreground text-sm">{principle.description}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* Built For Creators Section */}
          <section className="relative py-32 px-8 lg:px-16 border-b border-border/20 overflow-hidden">
            <div className="max-w-7xl mx-auto">
              <motion.div
                className="mb-20"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                {/* Section header */}
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-xs font-mono text-primary tracking-widest uppercase">Your Space</span>
                </div>
                <div className="flex items-start gap-4">
                  <div className="hidden md:block w-px h-24 bg-gradient-to-b from-primary/50 to-transparent" />
                  <div>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-foreground leading-tight tracking-tight mb-6">
                      Built for people who
                      <br />
                      <span className="text-primary/60">make things.</span>
                    </h2>
                    <p className="landing-body text-muted-foreground max-w-2xl">
                      Whether you're coordinating a raid, mixing a track, or shipping a game—Kloak is the space where
                      your community lives without being monetized.
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Creator Cards Grid */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  {
                    icon: Gamepad2,
                    title: "Gamers & Guilds",
                    description: "Voice comms, raid coordination, guild management. Your strategies stay in the squad.",
                  },
                  {
                    icon: Music,
                    title: "Musicians & Producers",
                    description:
                      "Share demos, collaborate remotely, build your scene. Your unreleased work stays unreleased.",
                  },
                  {
                    icon: Palette,
                    title: "Artists & Designers",
                    description: "Feedback sessions, portfolio sharing, creative critique. No AI scraping your style.",
                  },
                  {
                    icon: Video,
                    title: "Streamers & Creators",
                    description: "Community that's actually yours. No algorithm deciding who sees your posts.",
                  },
                  {
                    icon: Zap,
                    title: "Indie Studios",
                    description:
                      "Ship games, share builds, coordinate across time zones. Your roadmap stays confidential.",
                  },
                  {
                    icon: Users,
                    title: "Creative Collectives",
                    description:
                      "Build culture, not just content. Spaces that reflect your values, not a platform's metrics.",
                  },
                ].map((card, index) => (
                  <motion.div
                    key={card.title}
                    className="group relative border border-border/30 p-8 overflow-hidden hover:border-primary/30 transition-colors duration-300 bg-card/30"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.08 }}
                  >
                    {/* Corner accent */}
                    <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-primary/5 to-transparent" />

                    {/* Icon */}
                    <div className="relative mb-6">
                      <div className="w-12 h-12 border border-primary/30 flex items-center justify-center group-hover:border-primary/50 transition-colors duration-300">
                        <card.icon className="w-6 h-6 text-primary" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="relative">
                      <h3 className="landing-card-title text-foreground mb-2 text-base">{card.title}</h3>
                      <p className="landing-body text-muted-foreground text-sm">{card.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* Simplicity Section - NEW */}
          <section className="relative py-32 px-8 lg:px-16 bg-card/50 border-b border-border/20 overflow-hidden">
            <div className="max-w-7xl mx-auto">
              <div className="grid lg:grid-cols-2 gap-16 items-center">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                >
                  {/* Section header */}
                  <div className="flex items-center gap-4 mb-4">
                    <span className="text-xs font-mono text-primary tracking-widest uppercase">Philosophy</span>
                  </div>
                  <div className="flex items-start gap-4 mb-8">
                    <div className="hidden md:block w-px h-24 bg-gradient-to-b from-primary/50 to-transparent" />
                    <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-foreground leading-tight tracking-tight">
                      Simplicity is a
                      <br />
                      <span className="text-primary/60">feature.</span>
                    </h2>
                  </div>
                  <p className="landing-body text-muted-foreground mb-6">
                    Most platforms bloat over time—adding features to justify subscription tiers, complexity to create
                    lock-in, dark patterns to maximize engagement.
                  </p>
                  <p className="landing-body text-muted-foreground">
                    Kloak stays simple on purpose. Chat that works. Voice that's clear. Communities that make sense.
                    Nothing designed to manipulate you into spending more time or money.
                  </p>
                </motion.div>

                <motion.div
                  className="relative"
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  <div className="border border-border/30 p-8 bg-background">
                    <div className="space-y-4">
                      {[
                        { label: "No premium emoji packs", strike: true },
                        { label: "No animated profile borders", strike: true },
                        { label: "No engagement streaks", strike: true },
                        { label: "No artificial upload limits", strike: true },
                        { label: "No gamified rewards", strike: true },
                      ].map((item, index) => (
                        <motion.div
                          key={item.label}
                          className="flex items-center gap-3"
                          initial={{ opacity: 0, x: 10 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                        >
                          <X className="w-4 h-4 text-primary/50" />
                          <span className="text-muted-foreground text-sm line-through decoration-primary/30">
                            {item.label}
                          </span>
                        </motion.div>
                      ))}

                      <div className="pt-4 mt-4 border-t border-border/30">
                        <motion.div
                          className="flex items-center gap-3"
                          initial={{ opacity: 0, x: 10 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.4, delay: 0.8 }}
                        >
                          <Check className="w-4 h-4 text-primary" />
                          <span className="text-foreground text-sm font-medium">Just communication that works.</span>
                        </motion.div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="relative py-32 px-8 lg:px-16 border-t border-border/20 overflow-hidden">
            <motion.div
              className="max-w-7xl mx-auto relative"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="text-center">
                {/* Section header */}
                <div className="flex items-center justify-center gap-4 mb-6">
                  <span className="text-xs font-mono text-primary tracking-widest uppercase">Get Started</span>
                </div>

                <div className="w-16 h-16 border border-primary/30 flex items-center justify-center mx-auto mb-8">
                  <Key className="w-8 h-8 text-primary" />
                </div>

                <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-foreground leading-tight tracking-tight mb-6 max-w-2xl mx-auto">
                  Your key.
                  <br />
                  <span className="text-primary/60">Your community.</span>
                </h2>

                <p className="landing-body text-muted-foreground mb-10 max-w-lg mx-auto">
                  No signup forms. No email verification. Generate your cryptographic key and start building your space.
                </p>

                <Link to="/auth">
                  <button className="group relative px-10 py-4 bg-primary text-primary-foreground font-semibold transition-all duration-300 hover:bg-primary/90 uppercase tracking-wider">
                    <span className="flex items-center gap-2">
                      <Key className="w-5 h-5" />
                      Generate Your Key
                    </span>
                  </button>
                </Link>
              </div>
            </motion.div>
          </section>

          {/* Footer */}
          <Footer />
        </main>
      </div>
    </div>
  );
};

export default Index;
