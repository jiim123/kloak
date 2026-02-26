import { Link } from "react-router-dom";
import { motion } from "framer-motion";
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
const Index = () => {

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
    <div className="min-h-screen bg-background flex flex-col items-center landing-typography">
      <SEO {...SEO_CONFIG.home} />
      <div className="w-full">
        <NavigationMenu />
        <main className="pt-16">

          {/* Hero Section */}
          <HeroAscii />

          {/* What is Kloak Section */}
          <section className="relative py-32 md:py-48 px-8 lg:px-16 bg-light text-light-foreground overflow-hidden">
            <div className="max-w-3xl mx-auto text-center">
              <motion.div
                className="flex items-center justify-center gap-4 mb-12"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <span className="font-mono text-light-foreground/60 tracking-widest uppercase">What is Kloak</span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8 }}
                className="space-y-8"
              >
                <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-light-foreground leading-tight tracking-tight">
                  A place to talk
                  <br />
                  without being watched.
                </h2>

                <p className="text-[17px] text-light-foreground/70 leading-[1.7] max-w-2xl mx-auto">
                  Kloak is a real-time communication platform built for communities, friend groups, gaming squads, and creative teams. It gives you servers, voice channels, direct messages, roles, and permissions, all without requiring an email, phone number, or password. Your identity is a single cryptographic key that only you hold. No ads, no data harvesting, no algorithm deciding what you see. Just a space to talk, collaborate, and build communities on your own terms.
                </p>
              </motion.div>
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
                  <span className="font-mono text-primary tracking-widest uppercase">The Problem</span>
                </div>
                <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-foreground leading-tight tracking-tight">
                  What they take.
                  <br />
                   <span>What we don't.</span>
                </h2>
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
                        <TableCell className="font-light text-muted-foreground text-[17px]">{row.label}</TableCell>
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
                className="text-center text-[17px] text-muted-foreground mt-12"
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
                  <span className="font-mono text-primary tracking-widest uppercase">Capabilities</span>
                </div>
                <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-foreground leading-tight tracking-tight">
                  Everything you need.
                  <br />
                  <span>Nothing you don't.</span>
                </h2>
              </motion.div>

              {/* Feature Grid */}
              <div className="grid md:grid-cols-2 gap-6">
                {[
                  {
                    icon: MessageCircle,
                    title: "Real-Time Messaging",
                    description:
                      "Your messages arrive instantly. Edits, replies, and reactions update live for everyone in the conversation, no refreshing needed.",
                  },
                  {
                    icon: Headphones,
                    title: "Voice Channels",
                    description:
                      "Jump into a voice channel and talk with your group while browsing the rest of the app. Low latency, always ready when you are.",
                  },
                  {
                    icon: Users,
                    title: "Servers, Roles & Permissions",
                    description:
                      "Organize your community with servers, categories, and channels. Assign roles and control exactly who can do what, down to the channel level.",
                  },
                  {
                    icon: Lock,
                    title: "Secret Key Authentication",
                    description:
                      "No email. No phone number. No password. You get one cryptographic key that is your identity. Nobody can recover it, reset it, or take it from you.",
                  },
                  {
                    icon: Shield,
                    title: "Direct Messages & Friends",
                    description:
                      "Add friends by username, start private conversations, and block anyone you don't want to hear from. Simple and straightforward.",
                  },
                  {
                    icon: Palette,
                    title: "Themes & Customization",
                    description:
                      "Switch between multiple themes instantly. Personalize your profile with avatars, banners, bios, and custom statuses to make it yours.",
                  },
                ].map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    className="relative rounded-lg p-10 group overflow-hidden bg-card/30"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <div className="flex items-start gap-4">
                      <feature.icon className="w-5 h-5 text-primary shrink-0 mt-1" />
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-foreground mb-3">{feature.title}</h3>
                        <p className="text-[17px] text-muted-foreground leading-[1.7]">{feature.description}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* Built For Creators Section */}
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
                  <span className="font-mono text-primary tracking-widest uppercase">Your Space</span>
                </div>
                <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-foreground leading-tight tracking-tight mb-6">
                  Built for people
                  <br />
                   <span>Built to have fun.</span>
                </h2>
                <p className="text-[17px] text-muted-foreground max-w-2xl leading-[1.7]">
                  Whether you're coordinating a raid, mixing a track, or simply just talking to friends and family,
                  Kloak is the space where your communication lives without being monetized.
                </p>
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
                    {/* Icon */}
                    <div className="relative mb-6">
                      <div className="w-12 h-12 border border-primary/30 flex items-center justify-center group-hover:border-primary/50 transition-colors duration-300">
                        <card.icon className="w-6 h-6 text-primary" />
                      </div>
                    </div>
                    {/* Content */}
                    <div className="relative">
                      <h3 className="text-base font-semibold text-foreground mb-2">{card.title}</h3>
                      <p className="text-[17px] text-muted-foreground leading-[1.7]">{card.description}</p>
                    </div>
                  </motion.div>
                ))}
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
                  <span className="font-mono text-primary tracking-widest uppercase">Get Started</span>
                </div>
                <div className="w-16 h-16 border border-primary/30 flex items-center justify-center mx-auto mb-8">
                  <Key className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-foreground leading-tight tracking-tight mb-6 max-w-2xl mx-auto">
                  Your key.
                  <br />
                   <span>Your community.</span>
                </h2>
                <p className="text-[17px] text-muted-foreground mb-10 max-w-lg mx-auto leading-[1.7]">
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
