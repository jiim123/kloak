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
import { Dithering } from "@paper-design/shaders-react";
import { Footer } from "@/components/ui/footer-section";
import { NavigationMenu } from "@/components/layout/NavigationMenu";
import HeroAscii from "@/components/landing/HeroAscii";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SEO } from "@/components/seo";
import { SEO_CONFIG } from "@/lib/seo";

const Index = () => {
  const capabilities = [
    {
      icon: MessageCircle,
      label: "Messaging",
      title: "Real-Time Messaging",
      description:
        "Your messages arrive instantly. Edits, replies, and reactions update live for everyone in the conversation, no refreshing needed.",
    },
    {
      icon: Headphones,
      label: "Voice",
      title: "Voice Channels",
      description:
        "Jump into a voice channel and talk with your group while browsing the rest of the app. Low latency, always ready when you are.",
    },
    {
      icon: Users,
      label: "Structure",
      title: "Servers, Roles & Permissions",
      description:
        "Organize your community with servers, categories, and channels. Assign roles and control exactly who can do what, down to the channel level.",
    },
    {
      icon: Lock,
      label: "Identity",
      title: "Secret Key Authentication",
      description:
        "No email. No phone number. No password. You get one cryptographic key that is your identity. Nobody can recover it, reset it, or take it from you.",
    },
    {
      icon: Shield,
      label: "Private",
      title: "Direct Messages & Friends",
      description:
        "Add friends by username, start private conversations, and block anyone you don't want to hear from. Simple and straightforward.",
    },
    {
      icon: Palette,
      label: "Personal",
      title: "Themes & Customization",
      description:
        "Switch between multiple themes instantly. Personalize your profile with avatars, banners, bios, and custom statuses to make it yours.",
    },
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
                <span className="font-mono text-light-foreground tracking-widest uppercase">What is Kloak</span>
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

                <p className="text-[17px] text-light-foreground leading-[1.7] max-w-2xl mx-auto">
                  Kloak is a real-time communication platform built for communities, friend groups, gaming squads, and
                  creative teams. It gives you servers, voice channels, direct messages, roles, and permissions, all
                  without requiring an email, phone number, or password. Your identity is a single cryptographic key
                  that only you hold. No ads, no data harvesting, no algorithm deciding what you see. Just a space to
                  talk, collaborate, and build communities on your own terms.
                </p>
              </motion.div>
            </div>
          </section>

          {/* Capabilities Header */}
          <section className="relative pt-32 pb-16 px-8 lg:px-16 overflow-hidden">
            <div className="max-w-7xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <div className="flex items-center gap-4 mb-4">
                  <span className="font-mono text-primary tracking-widest uppercase">Capabilities</span>
                </div>
                <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-foreground leading-tight tracking-tight">
                  Everything you need.
                  <br />
                  <span>Nothing you don't.</span>
                </h2>
              </motion.div>
            </div>
          </section>

          {/* Individual Capability Sections */}
          {capabilities.map((capability, index) => {
            const isEven = index % 2 === 0;
            return (
              <section
                key={capability.title}
                className={`relative py-24 px-8 lg:px-16 overflow-hidden ${
                  isEven ? "" : "bg-card/30"
                } ${index === capabilities.length - 1 ? "border-b border-border/20" : ""}`}
              >
                <div className="max-w-7xl mx-auto">
                  <motion.div
                    className="grid md:grid-cols-[1fr_1.5fr] gap-12 md:gap-20 items-start"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                  >
                    {/* Left: Label + Icon */}
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 border border-primary/30 flex items-center justify-center shrink-0">
                        <capability.icon className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <span className="font-mono text-primary/60 tracking-widest uppercase text-xs">
                          {capability.label}
                        </span>
                        <h3 className="text-2xl sm:text-3xl font-light text-foreground leading-tight tracking-tight mt-1">
                          {capability.title}
                        </h3>
                      </div>
                    </div>

                    {/* Right: Description */}
                    <p className="text-[17px] text-muted-foreground leading-[1.7] md:pt-2">{capability.description}</p>
                  </motion.div>
                </div>
              </section>
            );
          })}

          {/* CTA Section with Dithering Background */}
          <section className="relative py-32 px-8 lg:px-16 border-t border-border/20 overflow-hidden">
            {/* Dithering Shader Background */}
            <div className="absolute inset-0 z-0">
              <Dithering
                width={1280}
                height={720}
                colorBack="#dbd7cc"
                colorFront="#1c1c1c"
                shape="wave"
                type="8x8"
                size={2.8}
                speed={0.12}
                scale={2.12}
                rotation={184}
                offsetX={0.28}
                offsetY={0.84}
              />
            </div>

            <motion.div
              className="max-w-7xl mx-auto relative"
              style={{ mixBlendMode: "difference" }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="text-center">
                {/* Section header */}
                <div className="flex items-center justify-center gap-4 mb-6">
                  <span className="font-mono text-white tracking-widest uppercase">Get Started</span>
                </div>
                <div className="w-16 h-16 border border-white/30 flex items-center justify-center mx-auto mb-8">
                  <Key className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-white leading-tight tracking-tight mb-6 max-w-2xl mx-auto">
                  Your key.
                  <br />
                  <span>Your community.</span>
                </h2>
                <p className="text-[17px] text-white mb-10 max-w-lg mx-auto leading-[1.7]">
                  No signup forms. No email verification. Generate your cryptographic key and start building your space.
                </p>
                <Link to="/auth">
                  <button className="group relative px-10 py-4 bg-white text-black font-semibold transition-all duration-300 hover:bg-white/90 uppercase tracking-wider">
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
