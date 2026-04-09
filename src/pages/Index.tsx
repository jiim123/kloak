import { lazy, Suspense, useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Key, MessageCircle, Users, Lock, Headphones, MessagesSquare, Megaphone, ListChecks, Images, SmilePlus, UserRoundCog, KeySquare } from "lucide-react";
import { Footer } from "@/components/ui/footer-section";
import { NavigationMenu } from "@/components/layout/NavigationMenu";
import { Marquee } from "@/components/ui/marquee";
import HeroAscii from "@/components/landing/HeroAscii";
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
  const coreFeatures = [
    {
      icon: MessageCircle,
      title: "Messaging",
      description:
        "Send messages in real time with edits, replies, and rich formatting. Chat one-on-one through Direct Messages or create Group Messages with multiple friends.",
      color: "96, 165, 250",   // blue-400
      textDark: true,
    },
    {
      icon: Users,
      title: "Friends & Social",
      description:
        "Add friends by username, manage incoming requests, and block anyone instantly. Your friend list travels with you across every server.",
      color: "74, 222, 128",   // green-400
      textDark: true,
    },
    {
      icon: SmilePlus,
      title: "Reactions",
      description:
        "React to any message with emoji. Servers can upload custom emoji packs that every member can use across channels.",
      color: "250, 204, 21",   // yellow-400
      textDark: true,
    },
    {
      icon: UserRoundCog,
      title: "Roles & Permissions",
      description:
        "Create custom roles with colors and icons. Over 30 granular permissions control who can post, pin, manage channels, and more.",
      color: "192, 132, 252",  // purple-400
      textDark: true,
    },
    {
      icon: Lock,
      title: "Administration",
      description:
        "Kick or ban disruptive members, mute users, set slowmode, enable read-only channels, and block links or attachments per channel.",
      color: "248, 113, 113",  // red-400
      textDark: true,
    },
    {
      icon: KeySquare,
      title: "Secret Key Auth",
      description:
        "No email, phone, or password. One cryptographic key is all you need. Generated on your device, hashed before it ever touches a server.",
      color: "251, 146, 60",   // orange-400
      textDark: true,
    },
  ];

  const channelTypes = [
    {
      icon: MessageCircle,
      title: "Chat",
      description:
        "Real-time text channels for everyday conversation. Supports replies, mentions, attachments, polls, and pinned messages.",
    },
    {
      icon: Headphones,
      title: "Voice & Video",
      description: "Talk in real-time with voice and video. Low-latency WebRTC connections, always ready when you are.",
    },
    {
      icon: MessagesSquare,
      title: "Forum",
      description:
        "Organize long-running conversations into dedicated posts. Each post has its own reply thread, perfect for Q&A and feedback.",
    },
    {
      icon: Megaphone,
      title: "Announcements",
      description:
        "Share one-way updates from admins and moderators with the whole server. Members can react and comment without cluttering the feed.",
    },
    {
      icon: ListChecks,
      title: "Tasks",
      description:
        "Create tasks, assign them to members, and track progress. Keep your team aligned without leaving the platform.",
    },
    {
      icon: Images,
      title: "Media",
      description:
        "A dedicated space for sharing images, videos, and visual inspiration. Gallery view with comments and reactions.",
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
          <section className="relative py-32 md:py-48 px-8 lg:px-16">
            <div className="max-w-[1240px] mx-auto grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-12 md:gap-16 items-start">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-foreground leading-tight tracking-tight">
                  A place to talk
                  <br />
                  without being watched.
                </h2>
              </motion.div>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8 }}
                className="text-base md:text-lg text-muted-foreground leading-[1.8]"
              >
                Kloak is a community-driven communication platform built by people who are genuinely passionate
                about privacy. Not privacy as a buzzword or a toggle buried in settings. Privacy as the foundation
                everything else is built on. There are no emails, no phone numbers, no passwords. Your identity is a
                single cryptographic key generated on your device, hashed before it ever touches a server, and
                unrecoverable by design. Kloak is not a company. There is no registered legal entity, no venture
                capital, no ads, no subscriptions, and no data harvesting. It is a passion project maintained by a
                small team of volunteers who believe your conversations should belong to you.
              </motion.p>
            </div>
          </section>

          {/* Core Features Section */}
          <section className="relative py-32 md:py-48 overflow-hidden">
            <div className="max-w-[1240px] mx-auto space-y-12 md:space-y-16 px-8 lg:px-16">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-foreground leading-tight tracking-tight">
                  Everything you need.
                  <br />
                  <span>Nothing you don't.</span>
                </h2>
              </motion.div>
            </div>

            <div className="mt-12 md:mt-16">
              <Marquee pauseOnHover duration="50s">
                {coreFeatures.map((feature) => (
                  <div
                    key={feature.title}
                    className="group/card relative rounded-2xl border border-border/40 bg-card/30 p-8 md:p-10 flex flex-col justify-between min-h-[280px] md:min-h-[320px] w-[340px] md:w-[400px] shrink-0 overflow-hidden transition-all duration-500 ease-out hover:scale-[1.03] hover:border-transparent hover:shadow-2xl"
                    style={{
                      "--feature-color": feature.color,
                    } as React.CSSProperties}
                  >
                    {/* Radial fill that expands from the icon position */}
                    <div
                      className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 ease-out"
                      style={{
                        background: `radial-gradient(circle at 48px 48px, rgb(${feature.color}) 0%, rgb(${feature.color} / 0.85) 40%, rgb(${feature.color} / 0.7) 100%)`,
                      }}
                    />
                    <div className="relative z-10 w-10 h-10 flex items-center justify-center">
                      <feature.icon
                        className="w-7 h-7 transition-colors duration-500 group-hover/card:text-gray-900"
                        style={{ color: `rgb(${feature.color})` }}
                        strokeWidth={1.5}
                      />
                    </div>
                    <div className="relative z-10 mt-auto">
                      <h3 className="text-2xl sm:text-3xl font-light text-foreground tracking-tight mb-2 transition-colors duration-500 group-hover/card:text-gray-900">
                        {feature.title}
                      </h3>
                      <p className="text-[15px] text-muted-foreground leading-relaxed transition-colors duration-500 group-hover/card:text-gray-900/70">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                ))}
              </Marquee>
            </div>
          </section>

          {/* Channel Types Section */}
          <section className="relative py-32 md:py-48 px-8 lg:px-16">
            <div className="max-w-[1240px] mx-auto space-y-12 md:space-y-16">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-foreground leading-tight tracking-tight">
                  Everything your community needs,
                  <br />
                  <span>from text to talk.</span>
                </h2>
              </motion.div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {channelTypes.map((channel, index) => (
                  <motion.div
                    key={channel.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.08 }}
                    className="group relative rounded-2xl border border-border/40 bg-card/30 p-8 md:p-10 flex flex-col justify-between min-h-[280px] md:min-h-[320px] hover:border-border/80 hover:bg-card/50 transition-all duration-300"
                  >
                    <div className="w-10 h-10 flex items-center justify-center">
                      <channel.icon className="w-7 h-7 text-foreground" strokeWidth={1.5} />
                    </div>
                    <div className="mt-auto">
                      <h3 className="text-2xl sm:text-3xl font-light text-foreground tracking-tight mb-2">
                        {channel.title}
                      </h3>
                      <p className="text-[15px] text-muted-foreground leading-relaxed">{channel.description}</p>
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
