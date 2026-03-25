import { lazy, Suspense, useRef, useState, useEffect } from "react";
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

// Lazy-load the heavy WebGL shader component (only visible at bottom of page)
const LazyDithering = lazy(() => import("@paper-design/shaders-react").then((m) => ({ default: m.Dithering })));

/** CTA section – only mounts the heavy WebGL shader when scrolled into view */
function CtaSection() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return null;
}

const Index = () => {
  const features = [
    {
      icon: MessageCircle,
      title: "Real-Time Messaging",
      description: "Instant delivery with live edits, replies, and reactions.",
    },
    {
      icon: Headphones,
      title: "Voice Channels",
      description: "Low-latency voice chat, always ready when you are.",
    },
    {
      icon: Users,
      title: "Servers & Roles",
      description: "Organize communities with granular role-based permissions.",
    },
    {
      icon: Lock,
      title: "Secret Key Auth",
      description: "One cryptographic key. No email, phone, or password.",
    },
    {
      icon: Shield,
      title: "Direct Messages",
      description: "Private conversations with friends. Block anyone instantly.",
    },
    {
      icon: Palette,
      title: "Themes",
      description: "Multiple themes and full profile customization.",
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center landing-typography">
      <SEO {...SEO_CONFIG.home} />
      <div className="w-full">
        <NavigationMenu />
        <main>
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

          {/* Features Section */}
          <section className="relative py-32 md:py-48 px-8 lg:px-16 overflow-hidden">
            <div className="max-w-7xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="mb-16 md:mb-24"
              >
                <div className="flex items-center gap-4 mb-4">
                  <span className="font-mono text-primary tracking-widest uppercase">Features</span>
                </div>
                <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-foreground leading-tight tracking-tight">
                  Everything you need.
                  <br />
                  <span>Nothing you don't.</span>
                </h2>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {features.map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.08 }}
                    className="group relative rounded-2xl border border-border/40 bg-card/30 p-8 md:p-10 flex flex-col justify-between min-h-[280px] md:min-h-[320px] hover:border-border/80 hover:bg-card/50 transition-all duration-300"
                  >
                    <div className="w-10 h-10 flex items-center justify-center">
                      <feature.icon className="w-7 h-7 text-foreground" strokeWidth={1.5} />
                    </div>
                    <div className="mt-auto">
                      <h3 className="text-2xl sm:text-3xl font-light text-foreground tracking-tight mb-2">
                        {feature.title}
                      </h3>
                      <p className="text-[15px] text-muted-foreground leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* CTA Section with Dithering Background */}
          <CtaSection />

          {/* Footer */}
          <Footer />
        </main>
      </div>
    </div>
  );
};

export default Index;
