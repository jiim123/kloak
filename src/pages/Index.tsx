import { lazy, Suspense, useRef, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Key,
  MessageCircle,
  Users,
  Lock,
  Headphones,
  MessagesSquare,
  Megaphone,
  ListChecks,
  Images,
  SmilePlus,
  UserRoundCog,
  KeySquare,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { Footer } from "@/components/ui/footer-section";
import { NavigationMenu } from "@/components/layout/NavigationMenu";
import { Marquee } from "@/components/ui/marquee";
import HeroAscii from "@/components/landing/HeroAscii";
import { SEO } from "@/components/seo";
import { SEO_CONFIG } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { FeatureDetailModal, type FeatureDetail } from "@/components/landing/FeatureDetailModal";

/** Draggable marquee wrapper - auto-scrolls, pauses on drag, resumes on release */
function DraggableMarquee({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const currentOffset = useRef(0);

  const getPageX = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) =>
    "touches" in e ? (e.touches[0]?.pageX ?? 0) : (e as MouseEvent).pageX;

  const onStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    isDragging.current = true;
    const track = trackRef.current;
    if (track) {
      const style = window.getComputedStyle(track);
      const matrix = new DOMMatrix(style.transform);
      currentOffset.current = matrix.m41;
      track.style.transform = `translateX(${currentOffset.current}px)`;
      track.classList.add("is-dragging");
    }
    startX.current = getPageX(e);
  }, []);

  const onMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const track = trackRef.current;
    if (!track) return;
    const delta = getPageX(e) - startX.current;
    track.style.transform = `translateX(${currentOffset.current + delta}px)`;
  }, []);

  const onEnd = useCallback(() => {
    isDragging.current = false;
    const track = trackRef.current;
    if (track) {
      track.style.transform = "";
      track.classList.remove("is-dragging");
    }
  }, []);

  useEffect(() => {
    const handleUp = () => onEnd();
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchend", handleUp);
    return () => {
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchend", handleUp);
    };
  }, [onEnd]);

  return (
    <div
      ref={containerRef}
      className="overflow-hidden"
      onMouseDown={onStart}
      onMouseMove={onMove}
      onMouseUp={onEnd}
      onTouchStart={onStart}
      onTouchMove={onMove}
      onTouchEnd={onEnd}
      style={{ userSelect: "none" }}
    >
      <div ref={trackRef} className="flex gap-4 md:gap-6 marquee-container" style={{ width: "max-content" }}>
        {children}
      </div>
    </div>
  );
}

/** Terminal-style feature card */
function TerminalCard({
  icon: Icon,
  title,
  description,
  href = "#",
  onArrowClick,
  className = "",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  href?: string;
  onArrowClick?: () => void;
  className?: string;
}) {
  return (
    <div className={`terminal-card flex flex-col bg-card/30 ${className}`}>
      {/* Top row: icon + title */}
      <div className="flex border-b border-muted-foreground/20">
        <div className="terminal-card-icon w-1/4 flex items-center justify-center border-r border-muted-foreground/20 p-4 transition-colors duration-300">
          <Icon className="w-5 h-5 text-foreground transition-colors duration-300" strokeWidth={1.5} />
        </div>
        <div className="w-3/4 flex items-center p-4">
          <span className="text-[14px] uppercase tracking-widest text-foreground font-medium">{title}</span>
        </div>
      </div>
      {/* Content row */}
      <div className="border-b border-muted-foreground/20 p-4 flex-1">
        <p className="text-[14px] text-muted-foreground leading-relaxed">{description}</p>
      </div>
      {/* Action row: text + arrow link */}
      <div className="flex">
        <div className="w-3/4 flex items-center p-4 border-r border-muted-foreground/20">
          <span className="text-[12px] text-muted-foreground truncate">Learn more about {title}</span>
        </div>
        <button
          onClick={(e) => {
            e.preventDefault();
            onArrowClick?.();
          }}
          className="terminal-card-arrow w-1/4 flex items-center justify-center p-4 transition-colors duration-300"
        >
          <ArrowRight className="w-4 h-4 text-foreground transition-all duration-300" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

const Index = () => {
  const [activeFeature, setActiveFeature] = useState<FeatureDetail | null>(null);

  const channelFeatureDetails: Record<string, Omit<FeatureDetail, "icon" | "title">> = {
    Chat: {
      tagline: "Conversation without the surveillance.",
      description:
        "Chat channels are the heart of every Kloak server. Send messages, reply to friends, mention people, share files, create polls, and pin important stuff so it never gets lost. Everything happens instantly.",
      controversial:
        "Most chat apps read your conversations to sell ads or recommend content. Kloak does none of that. We do not scan, index, or monetize your messages. No recommendations, no trending topics pulled from your private chats. Your words stay yours.",
    },
    "Voice & Video": {
      tagline: "Talk freely, without anyone listening in.",
      description:
        "Voice and video channels let you hop into a call whenever you want. No meeting links, no calendar invites, no extra steps. Just click a channel and start talking with your friends.",
      controversial:
        "Most platforms route all your voice and video through their own servers, which means they could technically record or analyze your calls. Kloak sends your voice directly between participants. Your call data never passes through our systems.",
    },
    Forum: {
      tagline: "Bigger topics deserve their own space.",
      description:
        "Forum channels turn messy group chats into organized discussions. Start a post about any topic and let people reply in a dedicated thread. Come back days or weeks later and everything is still easy to follow.",
      controversial:
        "Most forum platforms track every view, scroll, and click to build a profile of your behavior. Kloak forums are just for talking. We do not track how long you read, how far you scroll, or use your habits to decide what you see next.",
    },
    Announcements: {
      tagline: "Important updates, front and center.",
      description:
        "Announcement channels give admins a dedicated space to share news with the whole server. Members can react and leave comments without burying the original post.",
      controversial:
        "On other platforms, announcements get mixed in with algorithm-picked content and promotions. Kloak keeps it simple: announcements show up in order, with no algorithmic sorting, no promoted posts, and no engagement tricks.",
    },
    Tasks: {
      tagline: "Stay organized without leaving the chat.",
      description:
        "Task channels bring simple project management right into your server. Create to-dos, assign them to people, set priorities, and track what gets done, all without opening another app.",
      controversial:
        "Most project tools track how long tasks take and build performance reports on individuals. Kloak tasks are just here to help your group get things done. We do not measure or report anyone's productivity.",
    },
    Media: {
      tagline: "A gallery for everything your community shares.",
      description:
        "Media channels give photos, videos, and visual content a proper home instead of letting them disappear in a chat scroll. Everything shows up in a clean, browsable gallery.",
      controversial:
        "Social media platforms scan your uploads for facial recognition, ad targeting, and training algorithms. Kloak media channels simply store and display your content. Your images are not analyzed or used for anything beyond showing them to your community.",
    },
  };

  const coreFeatures = [
    {
      icon: MessageCircle,
      title: "Messaging",
      description:
        "Send messages in real time with edits, replies, and rich formatting. Chat one-on-one through Direct Messages or create Group Messages with multiple friends.",
      color: "96, 165, 250",
      contrast: "15, 40, 80",
      contrastSub: "15, 40, 80, 0.6",
    },
    {
      icon: Users,
      title: "Friends & Social",
      description:
        "Add friends by username, manage incoming requests, and block anyone instantly. Your friend list travels with you across every server.",
      color: "74, 222, 128",
      contrast: "10, 50, 25",
      contrastSub: "10, 50, 25, 0.6",
    },
    {
      icon: SmilePlus,
      title: "Reactions",
      description:
        "React to any message with emoji. Servers can upload custom emoji packs that every member can use across channels.",
      color: "250, 204, 21",
      contrast: "60, 45, 5",
      contrastSub: "60, 45, 5, 0.65",
    },
    {
      icon: UserRoundCog,
      title: "Roles & Permissions",
      description:
        "Create custom roles with colors and icons. Over 30 granular permissions control who can post, pin, manage channels, and more.",
      color: "192, 132, 252",
      contrast: "35, 10, 60",
      contrastSub: "35, 10, 60, 0.6",
    },
    {
      icon: Lock,
      title: "Administration",
      description:
        "Kick or ban disruptive members, mute users, set slowmode, enable read-only channels, and block links or attachments per channel.",
      color: "248, 113, 113",
      contrast: "65, 10, 10",
      contrastSub: "65, 10, 10, 0.6",
    },
    {
      icon: KeySquare,
      title: "Secret Key Auth",
      description:
        "No email, phone, or password. One cryptographic key is all you need. Generated on your device, hashed before it ever touches a server.",
      color: "251, 146, 60",
      contrast: "55, 25, 5",
      contrastSub: "55, 25, 5, 0.6",
    },
  ];

  const channelTypes = [
    {
      icon: MessageCircle,
      title: "Chat",
      description:
        "Text channels for everyday conversation. Reply to messages, mention friends, share files, run polls, and pin what matters most.",
    },
    {
      icon: Headphones,
      title: "Voice & Video",
      description: "Jump into a voice or video call with your friends. No links, no scheduling. Just join a channel and start talking.",
    },
    {
      icon: MessagesSquare,
      title: "Forum",
      description:
        "Give bigger topics their own space. Start a post, let people reply in threads, and keep everything easy to find later.",
    },
    {
      icon: Megaphone,
      title: "Announcements",
      description:
        "Post updates for your whole community in one place. Members can react and comment without burying the original message.",
    },
    {
      icon: ListChecks,
      title: "Tasks",
      description:
        "Keep your group organized with simple task lists. Assign work, set priorities, and track what gets done, all in one place.",
    },
    {
      icon: Images,
      title: "Media",
      description:
        "A gallery for sharing photos, videos, and inspiration. Browse everything in one view with comments and reactions.",
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
                Kloak is a community-driven passion project for people who want to talk without being tracked. We don’t
                want your email, your phone number, or your data. Your identity is a cryptographic key that lives on
                your device, giving you total ownership over your digital life.
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
                  Only What Matters.
                </h2>
              </motion.div>
            </div>

            <div className="mt-12 md:mt-16 relative">
              <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-24 md:w-40 bg-gradient-to-r from-background to-transparent" />
              <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-24 md:w-40 bg-gradient-to-l from-background to-transparent" />
              <DraggableMarquee>
                {[0, 1].map((copy) =>
                  coreFeatures.map((feature) => (
                    <TerminalCard
                      key={`${copy}-${feature.title}`}
                      icon={feature.icon}
                      title={feature.title}
                      description={feature.description}
                      className="w-[340px] md:w-[400px] min-h-[280px] md:min-h-[300px] shrink-0"
                    />
                  )),
                )}
              </DraggableMarquee>
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
                  >
                    <TerminalCard
                      icon={channel.icon}
                      title={channel.title}
                      description={channel.description}
                      className="h-full"
                      onArrowClick={() => {
                        const details = channelFeatureDetails[channel.title];
                        if (details) {
                          setActiveFeature({
                            icon: channel.icon,
                            title: channel.title,
                            ...details,
                          });
                        }
                      }}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* Feature Detail Modal */}
          <FeatureDetailModal
            feature={activeFeature}
            open={!!activeFeature}
            onClose={() => setActiveFeature(null)}
          />

          {/* Footer */}
          <Footer />
        </main>
      </div>
    </div>
  );
};

export default Index;
