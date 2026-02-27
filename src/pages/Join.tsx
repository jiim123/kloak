import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  Code,
  Shield,
  Palette,
  Sparkles,
  Mail,
  ChevronDown,
  Lock,
  Monitor,
  Server,
  Mic,
  Pen,
  PenTool,
  Users,
  FileText,
  Search,
  Scale,
} from "lucide-react";
import { Footer } from "@/components/ui/footer-section";
import { NavigationMenu } from "@/components/layout/NavigationMenu";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/seo";

interface PositionData {
  icon: React.ElementType;
  title: string;
  description: string;
  mindset: string;
  requirements: string[];
}

interface CategoryData {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  positions: PositionData[];
}

const categories: CategoryData[] = [
  {
    icon: Code,
    title: "Engineering",
    subtitle:
      "Build zero-knowledge communication infrastructure from the ground up. Our stack is React, TypeScript, Tailwind CSS, Zustand, and Supabase, with Signal Protocol, Sender Keys, and libsodium on the horizon.",
    positions: [
      {
        icon: Monitor,
        title: "Frontend Engineer",
        description:
          "Own the client-side experience for a real-time communication platform serving thousands of users. Build performant, accessible interfaces that handle encrypted state, live data subscriptions, and complex interaction patterns across web, PWA, and Tauri desktop environments.",
        mindset:
          "You write code that respects the user. You question whether a feature needs to exist before building it. You understand that in a zero-knowledge system, the client carries more responsibility than usual because encryption and decryption happen entirely in the browser.",
        requirements: [
          "Strong proficiency in React and TypeScript with experience building complex, stateful applications that handle real-time data",
          "Working knowledge of Tailwind CSS for component styling and responsive design. Our entire interface is built on Tailwind utility classes",
          "Familiarity with Zustand or similar lightweight state management libraries for managing client-side state across concurrent real-time subscriptions",
          "Understanding of real-time communication patterns: WebSockets, presence systems, subscription-based data flows, and state reconciliation strategies",
          "Experience building accessible, performant interfaces that work across desktop and mobile viewports without separate codebases",
          "Familiarity with Progressive Web App architecture, service workers, and offline-first patterns",
          "Experience with or willingness to learn Tauri for desktop application packaging, including bridging between webview and native Rust backends",
          "Comfort working with Framer Motion or similar animation libraries for micro-interactions and UI transitions",
          "Ability to read, debug, and refactor existing codebases. We need people who can work within an evolving architecture, not only greenfield projects",
          "Comfort working with AI-assisted development tools such as Cursor, Lovable, Claude, or GitHub Copilot. We use AI-assisted development extensively and need engineers who can review generated code critically",
        ],
      },
      {
        icon: Lock,
        title: "Cryptography Engineer",
        description:
          "Implement and maintain Kloak's zero-knowledge encryption layer. This role is responsible for integrating Signal Protocol for direct messages, Sender Keys for group channels, and client-side file encryption using libsodium. You will build the systems that ensure the server is architecturally incapable of reading user content.",
        mindset:
          "You understand that cryptographic code is not regular code. It requires a different standard of review, a different tolerance for cleverness, and a deep respect for the difference between theoretically secure and practically secure. You know that the hardest part of E2E encryption is not the math but the key management.",
        requirements: [
          "Strong understanding of end-to-end encryption protocols: Signal Protocol (Double Ratchet, X3DH key agreement), Sender Keys for group messaging, and the security properties each provides including forward secrecy and post-compromise security",
          "Practical experience with cryptographic libraries, particularly libsodium (XChaCha20-Poly1305 for symmetric encryption, X25519 for key exchange, Ed25519 for signing) or equivalent",
          "Understanding of key derivation functions (HKDF) and why separating authentication credentials from encryption keys is architecturally critical",
          "Experience with client-side key management: secure key generation, encrypted local storage of private keys, key rotation, and multi-device key synchronization",
          "Knowledge of group encryption challenges specific to Discord-style platforms: persistent channel history, large group key distribution, new member access boundaries, and member removal with post-compromise rekeying",
          "Familiarity with file encryption pipelines: per-file random key generation, streaming encryption for large files, and encrypted key distribution to recipients",
          "Understanding of the migration challenges involved in transitioning a live platform from plaintext to encrypted storage without breaking existing user access",
          "Proficiency in TypeScript. Our encryption layer runs client-side in React. Experience with Rust is a strong bonus for Tauri desktop integration using libsignal-client",
          "Ability to write clear technical documentation explaining cryptographic design decisions for both engineers and security auditors",
          "Awareness of metadata exposure risks. Even with encrypted content, patterns like message timing, channel membership, and message frequency can leak information",
        ],
      },
      {
        icon: Server,
        title: "Backend & Infrastructure Engineer",
        description:
          "Design and maintain the server-side systems that support zero-knowledge communication. In our architecture, the backend must be reliable and performant while being deliberately excluded from access to user content. This role covers database design, Row Level Security policies, Edge Functions, real-time subscription infrastructure, and hosting operations on Swedish infrastructure.",
        mindset:
          "You build systems that are designed to know as little as possible. You understand that in a zero-knowledge platform, the backend's job is to route encrypted payloads, enforce access control at the database layer, and stay out of the way. You take database security personally.",
        requirements: [
          "Strong experience with PostgreSQL, including schema design, indexing strategies, query optimization, and understanding of execution plans",
          "Deep familiarity with Supabase or similar PostgreSQL-backed platforms, including Row Level Security policies, database functions, triggers, and real-time subscriptions",
          "Experience designing and enforcing server-side access control. Client-side validation is never sufficient. Every sensitive operation must be verified at the database or Edge Function layer",
          "Understanding of real-time infrastructure: managing WebSocket connections at scale, subscription fan-out, presence tracking, and connection lifecycle management",
          "Familiarity with Edge Functions or serverless function patterns for authentication token generation, permission verification, and server-side business logic",
          "Experience with database migration strategies, particularly for platforms transitioning from plaintext to encrypted storage where legacy data must be handled carefully",
          "Understanding of hosting operations: deployment pipelines, environment isolation, secrets management, and monitoring for a production communication platform",
          "Familiarity with Swedish or EU hosting providers and the operational implications of hosting under European privacy jurisdiction",
          "Knowledge of egress cost management and database performance optimization for platforms with real-time usage patterns that can spike unpredictably",
          "Bonus: Experience with self-hosting open-source infrastructure components such as LiveKit, and managing TURN/STUN server configurations",
        ],
      },
      {
        icon: Mic,
        title: "Voice & Media Engineer",
        description:
          "Build Kloak's voice communication layer using LiveKit, integrated with our zero-knowledge architecture. This role covers real-time audio transport, room management, encrypted media streams, and the React component layer that makes voice channels feel native to the platform.",
        mindset:
          "You care about latency, codec quality, and the invisible complexity behind a voice call that just works. You understand that adding voice to a privacy-focused platform means the audio stream deserves the same architectural protections as text messages.",
        requirements: [
          "Experience with WebRTC fundamentals: media capture, peer connections, ICE candidates, TURN/STUN traversal, and the SFU (Selective Forwarding Unit) architecture model",
          "Familiarity with LiveKit or similar real-time media platforms, including their server SDKs for token generation and client SDKs for room management",
          "Understanding of audio codec configuration, particularly Opus with configurable bitrates, DTX (discontinuous transmission), echo cancellation, and noise suppression",
          "Experience building React components for real-time communication: participant lists, mute controls, connection state indicators, and voice activity detection UI",
          "Knowledge of encrypted media stream patterns and how E2E encryption applies to voice channels (insertable streams, frame-level encryption)",
          "Familiarity with room-based architecture: mapping voice channels to rooms, managing participant permissions, handling join/leave events, and speaker detection",
          "Understanding of self-hosting considerations for media servers, including capacity planning, TURN server deployment, and network topology for low-latency audio",
          "Proficiency in TypeScript and React. Voice UI components must integrate cleanly with Kloak's existing sidebar, channel structure, and design system",
          "Bonus: Experience with video integration, screen sharing, or building custom media processing pipelines",
        ],
      },
    ],
  },
  {
    icon: Palette,
    title: "Design",
    subtitle:
      "Shape the visual identity of a zero-knowledge platform. Our interfaces are built on Tailwind CSS with a dark theme, glass morphism, and a zinc/emerald color system that prioritizes clarity over decoration.",
    positions: [
      {
        icon: PenTool,
        title: "Product Designer",
        description:
          "Design the core user experience for encrypted real-time communication. This means solving problems that most messaging platforms never face: key verification flows, encryption status indicators, device linking interfaces, and making zero-knowledge architecture feel invisible to everyday users.",
        mindset:
          "You understand that the difference between good and great lives in the hover states, the spacing, the way a transition feels. You also understand that privacy-focused design has unique challenges. Communicating trust, making encryption understandable, and designing for a system where the server cannot help with data recovery all require deliberate, thoughtful solutions.",
        requirements: [
          "Proficiency in UI/UX design tools such as Figma, Adobe Creative Suite, or equivalent",
          "Strong understanding of modern web design principles including responsive layouts, WCAG accessibility standards, and scalable design systems",
          "Experience designing for real-time communication interfaces: message threads, channel navigation, presence indicators, notification patterns, and multi-panel layouts",
          "Ability to design trust-communicating UI patterns: encryption status indicators, key verification flows, device management screens, and security state visualizations that are intuitive to non-technical users",
          "Familiarity with Tailwind CSS utility-first design patterns. Our design decisions translate directly into utility classes and our designers work closely with engineers at the implementation level",
          "Experience designing for dark-themed interfaces with glass morphism, layered transparency, and backdrop blur effects",
          "Understanding of how design choices impact performance, particularly animation frame rates, GPU compositing, and rendering overhead on lower-end devices",
          "An eye for subtle, sophisticated aesthetics. We favor clean and professional over loud and flashy",
          "Experience designing onboarding flows for non-traditional authentication systems where users manage cryptographic keys rather than email and password",
          "Bonus: Experience with privacy-focused product design where communicating trust and security state is a core design objective rather than an afterthought",
        ],
      },
      {
        icon: Pen,
        title: "Brand & Visual Designer",
        description:
          "Own Kloak's visual identity across every surface: marketing pages, social media, community assets, custom emoji sets, avatar decorations, and motion design. Build the visual language that makes a privacy platform feel alive, distinctive, and approachable rather than sterile or paranoid.",
        mindset:
          "You want to prove that privacy and polish are not mutually exclusive. You understand that a platform's visual identity shapes how people feel about it before they ever read a word of copy. You can work across scales, from a 32-pixel emoji to a full landing page layout, with the same attention to craft.",
        requirements: [
          "Experience creating cohesive visual languages: icon sets, typography hierarchies, color systems, and component libraries that maintain consistency across platforms and contexts",
          "Ability to design motion graphics, micro-interactions, and animations using CSS animations, Lottie, Framer Motion, or After Effects",
          "Ability to create custom emoji sets, avatar decorations, badges, and visual assets that read clearly at multiple resolutions and across light and dark contexts",
          "Experience with brand identity systems: logo usage guidelines, tone of voice documentation, and visual standards that can scale across a growing contributor team",
          "Familiarity with marketing design: landing pages, social media assets, email templates, and promotional materials that communicate value without resorting to fear-based privacy messaging",
          "Strong typographic sensibility and understanding of how type choices communicate trust, professionalism, and approachability simultaneously",
          "Understanding of how visual assets are implemented in web applications. You do not need to write code, but knowing how your designs translate into Tailwind classes and React components makes collaboration faster",
          "Bonus: Experience with video production, explainer animations, or visual storytelling for technical products",
        ],
      },
    ],
  },
  {
    icon: Shield,
    title: "Security & Privacy",
    subtitle:
      "Harden a zero-knowledge platform against real-world threats and ensure our privacy claims are backed by verifiable architecture, not just policy. Our stack includes Supabase RLS, Edge Functions, libsodium, Signal Protocol, and Swedish hosting jurisdiction.",
    positions: [
      {
        icon: Search,
        title: "Application Security Engineer",
        description:
          "Audit and harden Kloak's security posture across the full stack. Review our Signal Protocol and Sender Key implementations, identify attack surfaces in client-side cryptography, test Row Level Security policies, and ensure that the boundary between encrypted and plaintext data is airtight during the migration to zero-knowledge architecture.",
        mindset:
          'You think like an attacker so you can defend like a professional. You understand that privacy is not a feature you bolt on. It is an architectural decision that touches every layer of the stack. You are the person who asks "but what if someone tries to..." before code ships.',
        requirements: [
          "Understanding of web application security fundamentals: OWASP Top 10, XSS, CSRF, injection attacks, and common attack vectors in real-time WebSocket-based applications",
          "Experience with or strong working knowledge of end-to-end encryption protocols: Signal Protocol (Double Ratchet, X3DH), Sender Keys, and the security properties each provides including forward secrecy, post-compromise security, and deniability",
          "Familiarity with cryptographic primitives and their correct application: XChaCha20-Poly1305, X25519, Ed25519, HKDF, and the practical use of libsodium or equivalent libraries",
          "Understanding of client-side key management security: the threat model around browser-based cryptography, encrypted key storage, key rotation schedules, and the differences between webview and native key storage (Tauri Stronghold, OS keychains)",
          "Experience with PostgreSQL security patterns, particularly Row Level Security, role-based access control, and the critical distinction between client-side and server-side permission enforcement",
          "Knowledge of authentication security: token handling, session management, secret key-based identity systems, brute force mitigation, and rate limiting strategies",
          "Experience with penetration testing, vulnerability assessment, or formal security auditing of web applications, with particular interest in candidates who have audited cryptographic implementations",
          "Ability to identify security anti-patterns in code review, particularly around real-time data subscriptions, API exposure, and the boundaries between encrypted and plaintext data in a partially migrated system",
          "Knowledge of secure DevOps practices: secrets management, environment isolation, deployment security, and dependency supply chain integrity",
          "Bonus: Experience with threat modeling, incident response planning, or formal verification of cryptographic protocols",
        ],
      },
      {
        icon: Scale,
        title: "Privacy & Compliance Analyst",
        description:
          "Ensure Kloak's privacy architecture translates into verifiable, legally sound commitments. Map our zero-knowledge design to GDPR obligations, draft transparent privacy documentation, analyze metadata exposure risks, and help define what Kloak can and cannot guarantee at each stage of our encryption rollout.",
        mindset:
          "You believe privacy policy should reflect technical reality, not aspirational marketing. You understand that a platform hosted in Sweden under EU jurisdiction has specific legal advantages and obligations, and that honest communication about capabilities builds more trust than overclaiming.",
        requirements: [
          "Understanding of GDPR requirements and how they apply to communication platforms, particularly the principles of data minimization, purpose limitation, and the right to erasure",
          "Familiarity with the privacy implications of hosting jurisdiction, specifically the advantages and obligations of operating under Swedish and EU data protection law",
          "Ability to analyze a technical architecture and identify what data the platform actually collects, processes, and retains, including metadata that persists even after content encryption is implemented",
          "Experience drafting or reviewing privacy policies, terms of service, transparency reports, or data processing agreements that accurately represent technical capabilities without legal jargon that obscures meaning",
          'Understanding of the distinction between policy-based privacy ("we promise not to look") and architectural privacy ("we cannot look"), and the ability to communicate this distinction clearly to users',
          "Familiarity with content moderation obligations under EU law, including the Digital Services Act, and how these intersect with zero-knowledge architecture where the platform cannot read user content",
          "Understanding of lawful interception and data preservation frameworks, and how zero-knowledge encryption affects a platform's ability and obligation to respond to legal requests",
          "Ability to produce clear, jargon-free user-facing documentation that explains what Kloak protects, what it does not yet protect, and what the roadmap looks like",
          "Bonus: Experience with open-source licensing, contributor agreements, or the legal frameworks around donation-funded software projects",
        ],
      },
    ],
  },
  {
    icon: Heart,
    title: "Community & Content",
    subtitle:
      "Be the bridge between the people who build Kloak and the people who use it. Translate complex encryption and privacy concepts into language that resonates with everyday users, and help grow a community rooted in trust.",
    positions: [
      {
        icon: Users,
        title: "Community Manager",
        description:
          "Grow and nurture Kloak's user community across the platform itself and external channels. Moderate with transparency, gather actionable user feedback, and represent the community's voice in product decisions. You are the primary point of contact between users and the team building the product they depend on.",
        mindset:
          "You believe communities grow best when they are built on trust and transparency, not engagement metrics and algorithmic manipulation. You can explain why zero-knowledge encryption matters without resorting to fear or jargon. You understand that for a privacy platform, the community itself is the primary growth engine.",
        requirements: [
          "Experience managing or moderating online communities, particularly on platforms like Discord, Slack, Reddit, or similar real-time communication tools",
          "Strong written communication skills with the ability to explain technical privacy and encryption concepts in plain, accessible language",
          "Understanding of Kloak's target audiences: gamers, musicians, artists, streamers, small teams, and privacy-conscious users seeking alternatives to surveillance-based platforms",
          "Experience gathering, organizing, and prioritizing user feedback to inform product decisions in a structured and actionable way",
          "Ability to handle conflict resolution and enforce community standards with fairness and transparency, using a reactive moderation approach rather than surveillance-based monitoring",
          "Understanding of privacy culture and the broader digital rights landscape, with the ability to articulate why architectural privacy matters without overpromising or misrepresenting current capabilities",
          "Familiarity with content creation for social media, blog posts, or community announcements in a tone that is direct, honest, and free of marketing fluff",
          "Experience with or interest in grassroots community growth: building genuine engagement through trust, quality, and word-of-mouth rather than growth hacking or vanity metrics",
          "Ability to coordinate between community feedback, bug reports, and the development team without requiring deep technical knowledge of the codebase",
          "Bonus: Experience with support ticket systems, bug reporting workflows, user research methodologies, or open-source community management",
        ],
      },
      {
        icon: FileText,
        title: "Technical Writer",
        description:
          "Create and maintain Kloak's documentation across every audience: user-facing help guides, developer onboarding documentation, API references, security whitepapers, and educational content that explains zero-knowledge architecture to non-technical readers. Good documentation is the difference between a product people try and a product people trust.",
        mindset:
          "You believe that if it is not documented, it does not exist. You can take a complex cryptographic concept and explain it at three different levels of depth depending on the audience. You understand that for a privacy platform, documentation is not just helpful, it is a trust signal.",
        requirements: [
          "Strong technical writing skills with the ability to produce clear, structured documentation for multiple audiences: end users, developers, security auditors, and contributors",
          "Ability to explain encryption and privacy concepts (E2E encryption, zero-knowledge architecture, key management) in plain language without sacrificing accuracy",
          "Experience creating and maintaining documentation systems: user guides, FAQs, onboarding flows, changelogs, and knowledge bases",
          "Familiarity with developer documentation patterns: API references, architecture decision records, setup guides, and contributing guidelines for open-source projects",
          "Ability to write security-facing documentation: threat model summaries, encryption protocol overviews, and privacy whitepapers that are technically precise but accessible",
          "Experience working with Markdown, static site generators, or documentation platforms such as Docusaurus, GitBook, or Notion",
          "Understanding of how documentation supports community trust, particularly the importance of honestly representing current capabilities versus planned features",
          "Ability to maintain consistency across a growing documentation set as the product evolves, including version-aware documentation that tracks feature rollouts",
          "Bonus: Experience with visual documentation (diagrams, flowcharts, architecture visuals) or producing educational content such as blog posts and explainer articles",
        ],
      },
    ],
  },
];

const PositionCard = ({
  position,
  isOpen,
  onToggle,
}: {
  position: PositionData;
  isOpen: boolean;
  onToggle: () => void;
}) => {
  const Icon = position.icon;

  return (
    <div className="border border-border/20 bg-background/50">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-6 md:p-8 text-left group hover:bg-card/30 transition-colors duration-300"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:border-primary/40 transition-colors duration-300">
            <Icon className="w-5 h-5 text-primary/80" />
          </div>
          <h4 className="text-lg md:text-xl font-medium text-foreground">{position.title}</h4>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="shrink-0 ml-4"
        >
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] }}
            className="overflow-hidden"
          >
            <div className="px-6 md:px-8 pb-8 pt-2">
              <p className="text-muted-foreground leading-relaxed mb-8 max-w-3xl">{position.description}</p>

              <div className="mb-8">
                <h5 className="text-sm font-mono text-primary tracking-widest uppercase mb-5">
                  What we're looking for
                </h5>
                <ul className="space-y-3">
                  {position.requirements.map((req, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-2 shrink-0" />
                      <span className="text-muted-foreground text-sm leading-relaxed">{req}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mb-8 border-l-2 border-primary/20 pl-6">
                <h5 className="text-sm font-mono text-primary tracking-widest uppercase mb-3">Mindset</h5>
                <p className="text-muted-foreground text-sm leading-relaxed italic">{position.mindset}</p>
              </div>

              <div className="border border-border/20 bg-card/30 p-6 md:p-8 rounded-lg">
                <h5 className="text-lg font-medium text-foreground mb-2">Interested in this role?</h5>
                <p className="text-muted-foreground text-sm leading-relaxed mb-5 max-w-xl">
                  Tell us about yourself, what excites you about zero-knowledge systems, and how you would like to
                  contribute. Include any relevant work, projects, or ideas.
                </p>
                <a href="mailto:join@kloak.app">
                  <Button size="default" className="h-11 px-6">
                    <Mail className="w-4 h-4 mr-2" />
                    join@kloak.app
                  </Button>
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const CategoryAccordion = ({
  category,
  isOpen,
  onToggle,
  openPositionIndex,
  onPositionToggle,
}: {
  category: CategoryData;
  isOpen: boolean;
  onToggle: () => void;
  openPositionIndex: number | null;
  onPositionToggle: (index: number) => void;
}) => {
  const Icon = category.icon;

  return (
    <motion.div
      className="border border-border/30 overflow-hidden bg-background"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-8 md:p-10 text-left group hover:bg-card/50 transition-colors duration-300"
      >
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 border border-primary/30 flex items-center justify-center shrink-0 group-hover:border-primary/50 transition-colors duration-300">
            <Icon className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h3 className="text-xl md:text-2xl font-medium text-foreground">{category.title}</h3>
            <span className="text-sm text-muted-foreground/60">
              {category.positions.length} {category.positions.length === 1 ? "position" : "positions"}
            </span>
          </div>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="shrink-0 ml-4"
        >
          <ChevronDown className="w-6 h-6 text-muted-foreground" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] }}
            className="overflow-hidden"
          >
            <div className="px-8 md:px-10 pb-10 pt-2">
              <p className="text-muted-foreground leading-relaxed mb-8 max-w-3xl">{category.subtitle}</p>

              <div className="space-y-3">
                {category.positions.map((position, index) => (
                  <PositionCard
                    key={position.title}
                    position={position}
                    isOpen={openPositionIndex === index}
                    onToggle={() => onPositionToggle(index)}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const Join = () => {
  const [openCategoryIndex, setOpenCategoryIndex] = useState<number | null>(null);
  const [openPositionIndices, setOpenPositionIndices] = useState<Record<number, number | null>>({});

  const handleCategoryToggle = (index: number) => {
    setOpenCategoryIndex(openCategoryIndex === index ? null : index);
  };

  const handlePositionToggle = (categoryIndex: number, positionIndex: number) => {
    setOpenPositionIndices((prev) => ({
      ...prev,
      [categoryIndex]: prev[categoryIndex] === positionIndex ? null : positionIndex,
    }));
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center w-full landing-typography">
      <SEO
        title="Join Us | Kloak"
        description="Join the Kloak team. We're building zero-knowledge communication infrastructure and looking for engineers, designers, security specialists, and community builders."
      />
      <div className="w-full">
        <NavigationMenu />
        <main className="pt-10">
          {/* Hero Section */}
          <section className="relative py-32 md:py-40 px-8 lg:px-16 overflow-hidden">
            <div className="max-w-7xl mx-auto">
              <motion.div
                className="flex items-center gap-4 mb-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6 }}
              >
                <span className="text-xs font-mono text-primary tracking-widest uppercase">Volunteer With Us</span>
              </motion.div>

              <motion.h1
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light text-foreground leading-tight tracking-tight mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1 }}
              >
                Build something
                <br />
                <span className="text-primary/60">that matters.</span>
              </motion.h1>

              <motion.p
                className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                We're a small indie team building a privacy-preserved communication platform. No investors pushing
                growth metrics. No corporate roadmap. Just passionate volunteers building tools where the server never
                sees your content.
              </motion.p>
            </div>
          </section>

          {/* Roles Section */}
          <section className="relative py-24 px-8 lg:px-16 bg-card/50 border-y border-border/20">
            <div className="max-w-7xl mx-auto">
              <motion.div
                className="mb-16"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <span className="text-xs font-mono text-primary tracking-widest uppercase mb-4 block">
                  We're Hiring Volunteers
                </span>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-light text-foreground leading-tight tracking-tight">
                  Current openings.
                </h2>
              </motion.div>

              <div className="space-y-4">
                {categories.map((category, index) => (
                  <CategoryAccordion
                    key={category.title}
                    category={category}
                    isOpen={openCategoryIndex === index}
                    onToggle={() => handleCategoryToggle(index)}
                    openPositionIndex={openPositionIndices[index] ?? null}
                    onPositionToggle={(positionIndex) => handlePositionToggle(index, positionIndex)}
                  />
                ))}
              </div>

              <motion.div
                className="mt-12 text-center"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <p className="text-muted-foreground">
                  Don't see your role listed? We're always open to meeting talented people. Reach out anyway.
                </p>
              </motion.div>
            </div>
          </section>

          {/* Values Section */}
          <section className="relative py-24 px-8 lg:px-16 border-b border-border/20">
            <div className="max-w-7xl mx-auto">
              <motion.div
                className="grid md:grid-cols-3 gap-8"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <div className="space-y-4">
                  <Sparkles className="w-8 h-8 text-primary" />
                  <h3 className="text-xl font-medium text-foreground">Remote First</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Contribute from anywhere. We care about what you build, not where you sit.
                  </p>
                </div>
                <div className="space-y-4">
                  <Heart className="w-8 h-8 text-primary" />
                  <h3 className="text-xl font-medium text-foreground">Zero-Knowledge by Design</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Privacy is not a feature here. It is the architecture. Every decision starts with what the server
                    should never see.
                  </p>
                </div>
                <div className="space-y-4">
                  <Code className="w-8 h-8 text-primary" />
                  <h3 className="text-xl font-medium text-foreground">Indie Spirit</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Small team, big ambitions. Every contribution shapes the product directly.
                  </p>
                </div>
              </motion.div>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default Join;
