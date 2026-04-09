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
      tagline: "Real-time conversation without the surveillance.",
      description:
        "Chat channels are the foundation of every Kloak server. They deliver instant, real-time text communication with support for replies, threaded conversations, mentions, file attachments, polls, and pinned messages. Every message is delivered through WebSocket connections for zero-perceptible latency.",
      howItWorks:
        "When you send a message, it is transmitted through Supabase Realtime to every connected client in the channel. Messages support rich formatting including bold, italic, code blocks with syntax highlighting, spoiler tags, and inline mentions. Attachments are uploaded to encrypted storage and linked to your message. Read tracking keeps everyone in sync with unread counts and mention badges.",
      benefits: [
        "Zero-latency delivery through persistent WebSocket connections.",
        "Rich formatting and syntax-highlighted code blocks for technical communities.",
        "Granular channel permissions let admins control who can post, attach files, or embed links.",
        "Slowmode and read-only options give moderators precise control over conversation flow.",
        "Ghost mode hides usernames and avatars for truly anonymous discussions.",
      ],
      controversial:
        "Most chat platforms mine your conversations for ad targeting and algorithmic recommendations. Kloak does not read, index, or monetize your messages. There is no recommendation engine, no trending topics derived from your private conversations, and no data broker partnerships. Your words belong to you.",
    },
    "Voice & Video": {
      tagline: "Talk freely, without anyone listening in.",
      description:
        "Voice and video channels provide low-latency, peer-to-peer communication using WebRTC. Jump into a voice channel and start talking instantly with no meeting links, no scheduling, and no account verification beyond your secret key.",
      howItWorks:
        "Connections are established peer-to-peer through WebRTC, meaning your audio and video travel directly between participants rather than through a central server. Supabase Presence tracks who is in each voice channel, and the VoicePersistentHost component maintains your connection even as you navigate between text channels.",
      benefits: [
        "Peer-to-peer architecture means lower latency and no central point of interception.",
        "Persistent connections survive navigation, so you stay in voice while browsing channels.",
        "Simple mute, deafen, and disconnect controls with no unnecessary complexity.",
        "No meeting links or calendar integrations required. Just join and talk.",
      ],
      controversial:
        "Traditional platforms route all voice traffic through their servers, giving them the technical ability to record and analyze your calls. Kloak's peer-to-peer model eliminates this possibility by design. Your voice data never touches our infrastructure.",
    },
    Forum: {
      tagline: "Long-form discussion, organized by topic.",
      description:
        "Forum channels transform chaotic group chats into structured, searchable discussions. Each topic gets its own dedicated post with a threaded reply chain, making it easy to follow complex conversations days or weeks after they started.",
      howItWorks:
        "Users create posts within the forum channel, each with a title and opening message. Other members reply within that post's thread, keeping the conversation focused and organized. Posts can be sorted by activity, creation date, or engagement, and moderators can pin important threads.",
      benefits: [
        "Threaded replies keep discussions organized and easy to follow.",
        "Perfect for Q&A, feedback collection, and knowledge sharing.",
        "Posts remain searchable and accessible long after creation.",
        "Reduces noise in real-time chat channels by giving complex topics their own space.",
      ],
      controversial:
        "Most forum platforms track every view, scroll, and click to build engagement profiles. Kloak forums exist purely for communication. We do not track read time, scroll depth, or use your browsing patterns to manipulate what you see next.",
    },
    Announcements: {
      tagline: "One voice to the whole server, without the noise.",
      description:
        "Announcement channels give admins and moderators a dedicated broadcast space. Posts appear prominently and members can react and comment without cluttering the main feed, ensuring important updates are seen without being buried.",
      howItWorks:
        "Only users with the appropriate permissions can create announcement posts. Each post supports rich text formatting and file attachments. Members interact through a dedicated comment section and emoji reactions, keeping the announcement itself clean while allowing community response.",
      benefits: [
        "Clear separation between official communications and member discussion.",
        "Comment sections allow feedback without cluttering the announcement.",
        "Reaction support gives admins quick sentiment feedback.",
        "Permission-gated posting prevents unauthorized announcements.",
      ],
      controversial:
        "On mainstream platforms, announcements are often mixed with algorithmic content and promotional material. Kloak's announcement channels are purely chronological with no algorithmic sorting, no promoted content, and no engagement optimization.",
    },
    Tasks: {
      tagline: "Project management without leaving the conversation.",
      description:
        "Task channels bring lightweight project management directly into your server. Create tasks, assign them to members, set priorities, and track progress, all without switching to a separate tool or giving a third-party app access to your workspace.",
      howItWorks:
        "Tasks are created within dedicated task channels and can be assigned to one or more server members. Each task has a status, priority level, and comment thread. Changes are broadcast in real-time through Supabase Realtime, so the entire team sees updates instantly.",
      benefits: [
        "No need for external project management tools that require separate accounts.",
        "Real-time updates keep the entire team synchronized.",
        "Task assignments integrate with the existing member and role system.",
        "Comment threads on tasks keep context attached to the work.",
      ],
      controversial:
        "Most project management tools harvest detailed productivity metrics, tracking how long tasks take, who is most active, and building performance profiles. Kloak tasks exist to help your team coordinate. We do not measure or report individual productivity.",
    },
    Media: {
      tagline: "Share visuals in a space built for them.",
      description:
        "Media channels provide a gallery-style experience for sharing images, videos, and visual content. Instead of images getting lost in a chat scroll, they are displayed in a browsable grid with full-size previews, comments, and reactions.",
      howItWorks:
        "Users upload media to the channel, which is displayed in a responsive gallery grid. Each item can have a title, description, and comment thread. The gallery supports filtering by media type and user, making it easy to find specific content.",
      benefits: [
        "Gallery view prevents visual content from being lost in chat scroll.",
        "Dedicated comment threads per media item for focused discussion.",
        "Support for images, videos, and YouTube embeds in one unified space.",
        "Clean browsing experience designed for visual content consumption.",
      ],
      controversial:
        "Social media platforms use your uploaded images for facial recognition training, ad targeting, and content recommendation algorithms. Kloak media channels are simple storage and display. Your images are not scanned, analyzed, or used for any purpose beyond showing them to your community.",
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
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* Footer */}
          <Footer />
        </main>
      </div>
    </div>
  );
};

export default Index;
