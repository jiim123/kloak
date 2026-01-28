import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Key, MessageCircle, Users, Zap, Lock, X, Check } from "lucide-react";
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
      "Coordinate raids, share strategies, and build your guild—without your conversations training someone else's AI or feeding targeted ads.",
  },
  {
    name: "Dev Teams",
    description:
      "Ship code, debug together, and vent about legacy systems. Your standups and code reviews stay between you and your team.",
  },
  {
    name: "Friend Groups",
    description:
      "Group chats that feel like they used to—just friends talking, sharing memes, making plans. Not a data mine with a chat feature.",
  },
  {
    name: "Privacy Advocates",
    description:
      "Finally, a platform that practices what it preaches. Privacy by architecture, not by policy. No asterisks, no exceptions.",
  },
  {
    name: "Small Businesses",
    description:
      "Client conversations, team coordination, sensitive documents—none of it becomes training data or shows up in a breach.",
  },
  {
    name: "Creators & Communities",
    description:
      "Build your audience on your terms. No algorithm gatekeeping your reach, no platform mining your community for profit.",
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
    { label: "Email required", others: true, kloak: false },
    { label: "Phone number required", others: true, kloak: false },
    { label: "Password stored on servers", others: true, kloak: false },
    { label: "Behavioral tracking", others: true, kloak: false },
    { label: "Data sold to advertisers", others: true, kloak: false },
    { label: "AI trained on your messages", others: true, kloak: false },
    { label: "Account recovery by platform", others: true, kloak: false },
    { label: "You control your identity", others: false, kloak: true },
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
                    <div className="hidden md:block w-px h-24 bg-gradient-to-b from-primary/50 to-transparent" />
                    <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-foreground leading-tight tracking-tight">
                      A place to talk
                      <br />
                      <span className="text-primary/60">without being watched.</span>
                    </h2>
                  </div>

                  <p className="text-lg md:text-xl text-primary leading-relaxed max-w-xl">
                    Kloak is a communication platform for communities, teams, and friends—built from the ground up so
                    your conversations stay yours.
                  </p>

                  <div className="flex flex-wrap gap-6 text-sm text-primary/50">
                    <span className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      No ads
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      No tracking
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      No data harvesting
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
                    {/* Subtle gradient accent */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent" />

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
                        transition={{ duration: 0.5 }}
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
                              duration: i === activeIndex ? 4 : 0,
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
                Most platforms treat privacy as a setting you can toggle. We built Kloak so we{" "}
                <span className="text-foreground italic">physically cannot</span> access your data—even if we wanted to.
              </motion.p>
            </div>
          </section>

          {/* Comparison Section */}
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
                  <span className="text-xs font-mono text-primary tracking-widest uppercase">The Difference</span>
                </div>
                <div className="flex items-start gap-4">
                  <div className="hidden md:block w-px h-20 bg-gradient-to-b from-primary/50 to-transparent" />
                  <h2 className="landing-section-title text-foreground max-w-3xl">
                    What they collect. <span className="text-primary">What we don't.</span>
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
                        Feature
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
              <motion.div
                className="flex flex-col md:flex-row items-center justify-center gap-4 mt-12"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <p className="text-center landing-body text-muted-foreground">
                  The less we know about you, the less anyone can take.
                </p>
              </motion.div>
            </div>
          </section>

          {/* Principles Section */}
          <section className="relative py-32 px-8 lg:px-16 overflow-hidden">
            {/* Background grid pattern */}
            <div
              className="absolute inset-0 opacity-[0.02]"
              style={{
                backgroundImage:
                  "linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />
            <div className="max-w-7xl mx-auto relative">
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
                  <div className="hidden md:block w-px h-20 bg-gradient-to-b from-primary/50 to-transparent" />
                  <h2 className="landing-section-title text-foreground max-w-2xl">
                    Privacy isn't a feature. <span className="text-primary">It's the architecture.</span>
                  </h2>
                </div>
              </motion.div>
              <div className="grid md:grid-cols-2 gap-x-16 gap-y-16">
                {[
                  {
                    number: "01",
                    title: "Zero data collection",
                    description:
                      "We don't ask for your email, phone number, or identity. We collect only what's essential for the app to function. Nothing more.",
                  },
                  {
                    number: "02",
                    title: "Cryptographic keys, not passwords",
                    description:
                      "Your account is secured by a 64-character key that only you possess. We can't recover it. We can't reset it. We can't access it.",
                  },
                  {
                    number: "03",
                    title: "No ads, no tracking, no profiling",
                    description:
                      "We will never monetize your data. There are no analytics tracking your behavior. No pixels. No fingerprinting. No exceptions.",
                  },
                  {
                    number: "04",
                    title: "Open architecture",
                    description:
                      "Our approach is transparent. We tell you exactly what we do and don't do. There's no fine print designed to confuse you.",
                  },
                ].map((principle, index) => (
                  <motion.div
                    key={principle.number}
                    className="group relative"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                  >
                    {/* Card with styling */}
                    <div className="relative border border-border/20 p-8 bg-card/30 hover:border-primary/30 transition-colors duration-300">
                      <div className="flex items-start gap-4">
                        <span className="text-4xl font-mono font-semibold text-primary/40 group-hover:text-primary/60 transition-colors duration-300">
                          {principle.number}
                        </span>
                        <div className="w-px h-12 bg-gradient-to-b from-primary/30 to-transparent" />
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

          {/* Capabilities Section */}
          <section className="relative py-32 px-8 lg:px-16 bg-card/50 border-y border-border/20 overflow-hidden">
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
                  <div className="hidden md:block w-px h-20 bg-gradient-to-b from-primary/50 to-transparent" />
                  <h2 className="landing-section-title text-foreground max-w-2xl">
                    Full-featured. <span className="text-primary">Zero compromise.</span>
                  </h2>
                </div>
              </motion.div>
              {/* Feature Grid */}
              <div className="grid lg:grid-cols-12 gap-6">
                {/* Main Feature - Large */}
                <motion.div
                  className="lg:col-span-7 relative border border-border/30 p-10 group overflow-hidden bg-background"
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <MessageCircle className="w-8 h-8 text-primary shrink-0" />
                    <h3 className="landing-card-title text-foreground text-xl sm:text-2xl">Real-Time Messaging</h3>
                  </div>
                  <p className="landing-body text-muted-foreground max-w-md text-sm">
                    Instant message delivery across servers, channels, and direct conversations. Built for speed without
                    sacrificing privacy.
                  </p>
                </motion.div>
                {/* Secondary Feature */}
                <motion.div
                  className="lg:col-span-5 relative border border-border/30 p-10 group overflow-hidden bg-background"
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <Lock className="w-7 h-7 text-primary shrink-0" />
                    <h3 className="landing-card-title text-foreground text-lg sm:text-xl">Key-Based Auth</h3>
                  </div>
                  <p className="landing-body text-muted-foreground text-sm">
                    One cryptographic key. Full control. No password managers, no recovery emails, no vulnerabilities.
                  </p>
                </motion.div>
                {/* Third Feature */}
                <motion.div
                  className="lg:col-span-5 relative border border-border/30 p-10 group overflow-hidden bg-background"
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <Users className="w-7 h-7 text-primary shrink-0" />
                    <h3 className="landing-card-title text-foreground text-lg sm:text-xl">Communities</h3>
                  </div>
                  <p className="landing-body text-muted-foreground text-sm">
                    Create spaces for your people. Organize with servers, channels, and categories — your way.
                  </p>
                </motion.div>
                {/* Fourth Feature - Large */}
                <motion.div
                  className="lg:col-span-7 relative border border-border/30 p-10 group overflow-hidden bg-background"
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <Zap className="w-8 h-8 text-primary shrink-0" />
                    <h3 className="landing-card-title text-foreground text-xl sm:text-2xl">Modern Infrastructure</h3>
                  </div>
                  <p className="landing-body text-muted-foreground max-w-md text-sm">
                    Built on a modern tech stack for performance and reliability. Fast, responsive, and built to scale
                    with you.
                  </p>
                </motion.div>
              </div>
            </div>
          </section>

          {/* For Everyone Section */}
          <section className="relative py-32 px-8 lg:px-16 overflow-hidden">
            <div className="max-w-7xl mx-auto">
              {/* Section Header */}
              <motion.div
                className="text-center mb-20"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                {/* Section header */}
                <div className="flex items-center justify-center gap-4 mb-6">
                  <span className="text-xs font-mono text-primary tracking-widest uppercase">For Everyone</span>
                </div>
                <h2 className="landing-section-title text-foreground mb-6 max-w-4xl mx-auto">
                  Free speech starts with <span className="text-primary">free infrastructure.</span>
                </h2>
                <p className="landing-body text-muted-foreground max-w-2xl mx-auto">
                  No premium tiers that unlock privacy features. No enterprise-only security. Everyone gets everything.
                </p>
              </motion.div>
              {/* Cards Grid */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  {
                    title: "Activists & Organizers",
                    description: "Coordinate movements without surveillance. Your cause, your privacy.",
                    icon: "megaphone",
                  },
                  {
                    title: "Creative Communities",
                    description: "Share your art, music, and ideas in spaces you control.",
                    icon: "palette",
                  },
                  {
                    title: "Gaming Groups",
                    description: "Voice chat, strategy sessions, and guild coordination — lag-free.",
                    icon: "gamepad",
                  },
                  {
                    title: "Small Businesses",
                    description: "Team communication without Big Tech reading your roadmap.",
                    icon: "briefcase",
                  },
                  {
                    title: "Friends & Family",
                    description: "Private group chats that stay private. Period.",
                    icon: "heart",
                  },
                  {
                    title: "Privacy Advocates",
                    description: "Finally, a platform that practices what it preaches.",
                    icon: "shield",
                  },
                ].map((card, index) => (
                  <motion.div
                    key={card.title}
                    className="group relative border border-border/30 p-8 overflow-hidden hover:border-primary/40 transition-colors duration-300 bg-card/30"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    {/* Icon */}
                    <div className="relative mb-6">
                      <div className="w-14 h-14 border border-primary/30 flex items-center justify-center group-hover:border-primary/50 transition-colors duration-300">
                        {card.icon === "megaphone" && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="28"
                            height="28"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-primary"
                          >
                            <path d="m3 11 18-5v12L3 13v-2z" />
                            <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
                          </svg>
                        )}
                        {card.icon === "palette" && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="28"
                            height="28"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-primary"
                          >
                            <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
                            <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
                            <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
                            <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
                            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z" />
                          </svg>
                        )}
                        {card.icon === "gamepad" && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="28"
                            height="28"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-primary"
                          >
                            <line x1="6" x2="10" y1="12" y2="12" />
                            <line x1="8" x2="8" y1="10" y2="14" />
                            <line x1="15" x2="15.01" y1="13" y2="13" />
                            <line x1="18" x2="18.01" y1="11" y2="11" />
                            <rect width="20" height="12" x="2" y="6" rx="2" />
                          </svg>
                        )}
                        {card.icon === "briefcase" && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="28"
                            height="28"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-primary"
                          >
                            <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                            <rect width="20" height="14" x="2" y="6" rx="2" />
                          </svg>
                        )}
                        {card.icon === "heart" && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="28"
                            height="28"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-primary"
                          >
                            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                          </svg>
                        )}
                        {card.icon === "shield" && <Shield className="w-7 h-7 text-primary" />}
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

          {/* CTA Section */}
          <section className="relative py-32 px-8 lg:px-16 bg-card/50 border-t border-border/20 overflow-hidden">
            <motion.div
              className="max-w-7xl mx-auto text-center relative"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="w-16 h-16 border border-primary/40 flex items-center justify-center mx-auto mb-8">
                <Shield className="w-8 h-8 text-primary" />
              </div>
              <h2 className="landing-section-title text-foreground mb-6">
                Take Back Your <span className="text-primary">Privacy.</span>
              </h2>
              <p className="landing-body text-muted-foreground mb-10 max-w-lg mx-auto">
                No signup forms. No verification emails. Generate your key and start communicating freely.
              </p>
              <Link to="/auth">
                <button className="group relative px-10 py-4 bg-primary text-primary-foreground font-semibold transition-all duration-300 hover:bg-primary/90 uppercase tracking-wider">
                  <span className="flex items-center gap-2">
                    <Key className="w-5 h-5" />
                    Get Started
                  </span>
                </button>
              </Link>
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
