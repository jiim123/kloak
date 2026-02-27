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
  Radio,
  Database,
  Cloud,
  AppWindow,
  Key,
  Layers,
  Move3D,
  Megaphone,
  Image,
  ShieldCheck,
  Bug,
  Eye,
  MessageSquare,
  Share2,
  BookOpen,
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
      "Build privacy-preserved communication infrastructure from the ground up. Our stack is React, TypeScript, Tailwind CSS, Zustand, and Supabase, with Signal Protocol, Sender Keys, and libsodium on the horizon.",
    positions: [
      {
        icon: Monitor,
        title: "React UI Engineer",
        description:
          "Build and maintain the component library and page-level interfaces that users interact with every day. This includes message views, channel layouts, sidebars, modals, settings screens, and every pixel in between.",
        mindset:
          "You care about component architecture, prop contracts, and making interfaces that feel fast even on low-end hardware. You think in terms of reusable patterns and consistent behavior.",
        requirements: [
          "Strong proficiency in React and TypeScript with experience building complex component hierarchies",
          "Deep working knowledge of Tailwind CSS. Our entire interface is built on Tailwind utility classes and every design decision maps directly to them",
          "Experience building responsive layouts that work across desktop and mobile viewports without separate codebases",
          "Familiarity with accessible component patterns: keyboard navigation, ARIA attributes, focus management, and screen reader compatibility",
          "Understanding of React rendering performance: memoization strategies, virtualized lists for large message histories, and avoiding unnecessary re-renders",
          "Experience with form patterns, validation, and complex interactive states such as multi-step onboarding flows and settings panels",
          "Ability to translate design specs into pixel-accurate implementations while maintaining clean, maintainable code",
          "Comfort working with AI-assisted development tools such as Cursor, Lovable, Claude, or GitHub Copilot",
        ],
      },
      {
        icon: Radio,
        title: "Real-time Systems Engineer",
        description:
          "Own the data flow layer between the server and the UI. This means Supabase real-time subscriptions, Zustand state management, presence systems, typing indicators, and ensuring that encrypted message state stays synchronized across concurrent connections.",
        mindset:
          "You understand that real-time communication has different engineering constraints than request-response web apps. You think about race conditions, subscription lifecycles, reconnection strategies, and what happens when the network drops mid-message.",
        requirements: [
          "Experience with WebSocket-based real-time data flows, including subscription management, reconnection handling, and backpressure",
          "Familiarity with Zustand or similar lightweight state management for coordinating client-side state across multiple concurrent subscriptions",
          "Understanding of presence systems: how to track online/offline status, typing indicators, and active channel membership without excessive polling",
          "Experience with optimistic updates and the trade-offs between perceived responsiveness and data consistency in real-time systems",
          "Knowledge of subscription cleanup patterns to prevent memory leaks and stale listeners in long-lived single-page applications",
          "Understanding of how end-to-end encryption interacts with real-time state: decrypting incoming messages in the subscription handler, managing encrypted payloads in the store",
          "Proficiency in TypeScript with strong debugging skills for asynchronous, event-driven code",
          "Experience diagnosing and resolving timing-related bugs in production real-time applications",
        ],
      },
      {
        icon: Lock,
        title: "Encryption Engineer",
        description:
          "Implement Kloak's end-to-end encryption layer. This role is responsible for integrating Signal Protocol for direct messages, Sender Keys for group channels, and client-side file encryption using libsodium. You will build the systems that ensure the server is architecturally unable to read user content.",
        mindset:
          "You understand that cryptographic code requires a different standard of review and a deep respect for the difference between theoretically secure and practically secure. You know that the hardest part of E2E encryption is not the math but the key management.",
        requirements: [
          "Strong understanding of end-to-end encryption protocols: Signal Protocol (Double Ratchet, X3DH key agreement), Sender Keys for group messaging, forward secrecy, and post-compromise security",
          "Practical experience with cryptographic libraries, particularly libsodium (XChaCha20-Poly1305, X25519, Ed25519) or equivalent",
          "Understanding of key derivation functions (HKDF) and why separating authentication credentials from encryption keys is architecturally critical",
          "Knowledge of group encryption challenges specific to Discord-style platforms: persistent channel history, large group key distribution, new member access boundaries, and member removal with rekeying",
          "Familiarity with file encryption pipelines: per-file random key generation, streaming encryption for large files, and encrypted key distribution to recipients",
          "Understanding of the migration challenges involved in transitioning a live platform from plaintext to encrypted storage without breaking existing user access",
          "Proficiency in TypeScript. Our encryption layer runs client-side in React",
          "Ability to write clear technical documentation explaining cryptographic design decisions for both engineers and security auditors",
        ],
      },
      {
        icon: Key,
        title: "Key Management & Identity Engineer",
        description:
          "Design and build the identity and key lifecycle systems that underpin Kloak's privacy-preserved architecture. This covers secure key generation, encrypted local storage, multi-device key synchronization, device linking flows, and the migration path from our current secret key authentication to full cryptographic identity.",
        mindset:
          "You think about key lifecycle the way others think about user sessions. You understand that losing a private key is not a password reset problem, it is a permanent access problem, and you design systems that help users avoid that outcome without compromising the security model.",
        requirements: [
          "Experience with client-side key management: secure key generation using cryptographically strong random sources, encrypted storage of private key material, and key rotation strategies",
          "Understanding of multi-device key synchronization patterns: how to give a user access to their identity across phone, browser, and desktop without exposing private keys to the server",
          "Familiarity with device linking protocols: QR-based pairing, encrypted key transfer, and session approval flows",
          "Knowledge of key derivation architectures, particularly using HKDF to derive separate encryption and authentication keys from a single root secret",
          "Understanding of the differences between browser-based key storage (localStorage, IndexedDB), Tauri Stronghold, and native OS keychains (macOS Keychain, Windows Credential Manager)",
          "Experience designing recovery and backup strategies for cryptographic identity systems where the server cannot assist with key recovery",
          "Familiarity with non-traditional authentication systems that do not rely on email, password, or third-party identity providers",
          "Proficiency in TypeScript with bonus points for Rust experience (relevant to Tauri desktop key storage)",
        ],
      },
      {
        icon: Database,
        title: "Database Engineer",
        description:
          "Own the PostgreSQL layer that powers Kloak. This means schema design, query optimization, Row Level Security policies, database functions and triggers, and ensuring that the database enforces access control independently of the client. In a privacy-preserved system, the database must be reliable and secure while handling data it increasingly cannot read.",
        mindset:
          "You take database security personally. You understand that client-side validation is never sufficient and that every sensitive operation must be verified at the database layer. You write RLS policies before you write queries.",
        requirements: [
          "Strong experience with PostgreSQL, including normalized schema design, indexing strategies, query optimization, and reading execution plans",
          "Deep familiarity with Supabase or similar PostgreSQL-backed platforms, including Row Level Security policies, database functions, and triggers",
          "Experience designing and enforcing server-side access control through RLS. You understand why relying on client-side permission checks is a security anti-pattern",
          "Knowledge of database migration strategies, particularly for platforms transitioning from plaintext to encrypted storage where legacy data requires careful handling",
          "Understanding of how real-time subscriptions interact with RLS policies and how to ensure that subscription-level access control is as strict as query-level control",
          "Experience with PostgreSQL performance tuning for real-time communication workloads: high write throughput, concurrent reads, and managing connection pool limits",
          "Familiarity with backup strategies, point-in-time recovery, and data lifecycle policies including scheduled deletion of deprecated plaintext data",
          "Understanding of how encrypted payloads change database design: storing opaque ciphertext, managing encrypted metadata columns, and indexing strategies when content is not searchable",
        ],
      },
      {
        icon: Cloud,
        title: "DevOps & Infrastructure Engineer",
        description:
          "Manage the deployment pipeline, hosting infrastructure, environment isolation, and operational monitoring for a production communication platform. Ensure that the infrastructure layer reinforces Kloak's privacy guarantees rather than undermining them through logging, caching, or misconfigured services.",
        mindset:
          "You understand that infrastructure decisions have privacy consequences. A misconfigured log, an overly verbose error handler, or an unencrypted cache can leak the data that the application layer was designed to protect. You treat operational security as part of the product.",
        requirements: [
          "Experience with deployment pipelines for web applications: CI/CD configuration, staging environments, rollback strategies, and automated testing integration",
          "Knowledge of secrets management: environment variable handling, encrypted secret stores, and ensuring that API keys, database credentials, and signing keys never appear in logs or version control",
          "Understanding of environment isolation: separating development, staging, and production environments with distinct credentials and access controls",
          "Experience with monitoring and alerting for real-time applications: tracking WebSocket connection counts, database connection pool usage, API response times, and error rates",
          "Familiarity with egress cost management and bandwidth optimization for platforms with unpredictable real-time usage spikes",
          "Knowledge of EU hosting providers and the operational implications of hosting under European privacy jurisdiction",
          "Understanding of how logging policies impact privacy: what should and should not be logged, log retention periods, and how to ensure that debug logs never capture user content",
          "Bonus: Experience with self-hosting open-source infrastructure components such as LiveKit, and managing TURN/STUN server configurations",
        ],
      },
      {
        icon: Mic,
        title: "Voice Engineer",
        description:
          "Build the server-side and transport layer for Kloak's voice communication using LiveKit. This covers SFU deployment, room management, token generation, audio codec configuration, and encrypted media stream handling.",
        mindset:
          "You care about latency, call reliability, and the invisible complexity behind audio that just works. You understand that adding voice to a privacy-focused platform means the audio stream deserves the same architectural protections as text messages.",
        requirements: [
          "Experience with WebRTC fundamentals: media capture, peer connections, ICE candidates, TURN/STUN traversal, and the SFU (Selective Forwarding Unit) architecture model",
          "Familiarity with LiveKit or similar real-time media platforms, including server SDKs for token generation and room lifecycle management",
          "Understanding of audio codec configuration, particularly Opus with configurable bitrates, DTX (discontinuous transmission), echo cancellation, and noise suppression",
          "Knowledge of encrypted media stream patterns: insertable streams, frame-level encryption, and how E2E encryption applies to voice channels",
          "Understanding of self-hosting considerations for media servers: capacity planning, TURN server deployment, and network topology for low-latency audio",
          "Familiarity with room-based architecture: mapping voice channels to rooms, managing participant permissions, and handling join/leave events",
          "Experience with load testing and diagnosing quality issues in real-time audio systems",
          "Bonus: Experience with video integration, screen sharing, or building custom media processing pipelines",
        ],
      },
      {
        icon: AppWindow,
        title: "Desktop Application Engineer",
        description:
          "Build and maintain Kloak's desktop application using Tauri. This role bridges the React frontend with native Rust backends for secure key storage, file encryption, and system-level integrations that browsers cannot provide.",
        mindset:
          "You understand why a privacy-preserved communication platform benefits from a native wrapper. Browser-based crypto has limitations around key storage, file handling, and system integration that a Tauri shell can solve. You are comfortable working across the TypeScript/Rust boundary.",
        requirements: [
          "Experience with Tauri or similar web-to-native frameworks (Electron experience is transferable but Tauri is preferred for its security model)",
          "Proficiency in Rust at a working level: you can write Tauri commands, handle serialization between Rust and TypeScript, and work with the Tauri plugin ecosystem",
          "Familiarity with Tauri Stronghold or native OS keychain APIs for secure storage of private key material outside the browser sandbox",
          "Understanding of how to bridge client-side crypto between browser environments (Web Crypto API) and native Rust backends (libsignal-client, ring, or sodiumoxide)",
          "Experience with native file system access for encrypted file handling: reading, encrypting, and writing large files without browser memory constraints",
          "Knowledge of cross-platform build pipelines: building for Windows, macOS, and Linux from a single codebase with platform-specific considerations",
          "Familiarity with system tray integration, native notifications, auto-update mechanisms, and startup-on-boot configuration",
          "Understanding of the security implications of webview-based desktop apps: content security policies, IPC security, and preventing webview exploitation",
        ],
      },
    ],
  },
  {
    icon: Palette,
    title: "Design",
    subtitle: "Shape the visual identity of a privacy-preserved platform.",
    positions: [
      {
        icon: PenTool,
        title: "UX Designer",
        description:
          "Design the information architecture, user flows, and interaction patterns for encrypted real-time communication. This means solving problems most messaging platforms never face: key verification flows, device linking, secret key onboarding, and making privacy architecture feel invisible to everyday users.",
        mindset:
          "You design for comprehension first and aesthetics second. You understand that a confusing encryption prompt or a poorly designed key backup flow can undermine the entire security model. You believe that if a user needs to read a manual to stay safe, the UX has failed.",
        requirements: [
          "Experience designing user flows and information architecture for complex, multi-state applications",
          "Proficiency in wireframing and prototyping tools such as Figma, Sketch, or equivalent",
          "Understanding of progressive disclosure: revealing complexity gradually rather than overwhelming users with security decisions upfront",
          "Experience designing onboarding flows for non-traditional authentication systems where users manage cryptographic keys rather than email and password",
          "Ability to design trust-communicating interaction patterns: encryption status indicators, key verification confirmations, and device management flows",
          "Familiarity with usability testing methods: task-based testing, think-aloud protocols, and translating qualitative feedback into design iterations",
          "Experience designing for real-time communication patterns: message composition, channel switching, notification handling, and presence indicators",
          "Understanding of accessibility principles: WCAG compliance, keyboard-first navigation, and designing for assistive technologies",
        ],
      },
      {
        icon: Layers,
        title: "UI Designer",
        description:
          "Create the visual component layer for Kloak's interface. This includes designing buttons, inputs, cards, modals, dropdowns, tooltips, and every other element in a consistent, scalable design system that translates directly into Tailwind CSS utility classes.",
        mindset:
          "You think in systems, not screens. You understand that a well-designed component library makes everything downstream faster and more consistent. You obsess over spacing, color consistency, and the subtle differences between a good interface and a great one.",
        requirements: [
          "Proficiency in Figma or equivalent design tools with experience building and maintaining component libraries and design tokens",
          "Strong understanding of design system principles: consistent spacing scales, color palettes, typography hierarchies, and component variants",
          "Familiarity with Tailwind CSS utility-first patterns. Our designers work closely with engineers and design decisions translate directly into utility classes",
          "Understanding of responsive component behavior: how elements adapt, reflow, and collapse across viewport sizes without separate mobile designs",
          "Experience designing interactive states: hover, focus, active, disabled, loading, error, and empty states for every component",
          "An eye for subtle, sophisticated aesthetics. We favor clean and professional over loud and flashy",
          "Understanding of how design choices impact rendering performance, particularly on lower-end devices",
        ],
      },
      {
        icon: Image,
        title: "Icon & Asset Designer",
        description:
          "Create Kloak's custom visual assets: emoji sets, avatar decorations, badges, rank icons, achievement graphics, and any illustrative elements used across the platform and marketing materials. Every asset must read clearly at sizes ranging from 16 pixels to full resolution.",
        mindset:
          "You work at the intersection of illustration and interface design. You understand that a custom emoji set or a well-crafted badge system gives a platform personality and makes users feel ownership over their space. You can deliver at scale without sacrificing craft.",
        requirements: [
          "Experience creating icon sets and custom emoji that maintain visual clarity and consistency at multiple resolutions (16px through 512px)",
          "Proficiency in vector illustration tools: Adobe Illustrator, Figma, Affinity Designer, or equivalent",
          "Ability to create avatar decorations, profile badges, and rank indicators that work across light and dark contexts",
          "Understanding of SVG optimization for web: minimizing file size, ensuring crisp rendering, and supporting dynamic color theming",
          "Experience designing within a constrained visual language: matching an existing color palette, icon weight, and corner radius system",
          "Ability to produce assets in batch with consistent quality, working from a style guide rather than reinventing the approach for each piece",
          "Familiarity with exporting assets for web use: appropriate formats (SVG, PNG, WebP), resolution variants, and sprite sheet organization",
          "Bonus: Experience with pixel art, animated stickers, or collectible digital asset design",
        ],
      },
      {
        icon: Move3D,
        title: "Motion Designer",
        description:
          "Design and implement animations, transitions, and micro-interactions that give Kloak's interface a sense of life and responsiveness. This includes page transitions, loading states, notification animations, hover effects, and the subtle motion language that makes a real-time app feel fluid.",
        mindset:
          "You understand that motion is functional, not decorative. A well-timed transition communicates state change. A loading animation manages expectation. You design motion that helps users understand what just happened and what happens next.",
        requirements: [
          "Experience designing and implementing animations for web interfaces using Framer Motion, CSS animations, or Lottie",
          "Understanding of animation principles: easing curves, duration scaling, staggered entrances, and the relationship between motion and perceived performance",
          "Ability to create micro-interactions for common UI patterns: button feedback, toast notifications, panel transitions, message arrival animations, and scroll-linked effects",
          "Knowledge of performance constraints: GPU-composited properties (transform, opacity), avoiding layout thrash, and keeping animations at 60fps on mid-range hardware",
          "Experience with loading state design: skeleton screens, progress indicators, and transition animations that bridge asynchronous operations",
          "Familiarity with Framer Motion's animation API: variants, layout animations, exit animations, and gesture-driven interactions",
          "Ability to document motion specifications clearly enough for engineers to implement them accurately without frame-by-frame handoff",
          "Bonus: Experience with After Effects, Rive, or similar tools for prototyping complex animation sequences before implementation",
        ],
      },
      {
        icon: Pen,
        title: "Brand Identity Designer",
        description:
          "Own and evolve Kloak's brand identity system. This includes the logo, color system, typography standards, tone of voice guidelines, and the visual rules that ensure consistency as the team and the platform grow.",
        mindset:
          "You want to prove that privacy and polish are not mutually exclusive. You understand that a platform's visual identity shapes how people feel about it before they ever read a word of copy. You build systems that scale, not one-off designs.",
        requirements: [
          "Experience developing brand identity systems: logo usage guidelines, color specifications, typography standards, and visual rules that can be followed by a growing contributor team",
          "Strong typographic sensibility and understanding of how type choices communicate trust, professionalism, and approachability simultaneously",
          "Ability to define and document a tone of voice that is direct, honest, and avoids both corporate jargon and fear-based privacy messaging",
          "Experience creating brand templates and guidelines that non-designers can follow for consistent output",
          "Understanding of how brand identity translates across mediums: web interfaces, social media, print materials, presentation decks, and documentation",
          "Ability to evolve an existing brand system without breaking continuity. Kloak already has an established visual direction and this role builds on it rather than replacing it",
          "Familiarity with accessibility standards in brand design: contrast ratios, colorblind-safe palettes, and legibility at all sizes",
          "Bonus: Experience building brand identity for privacy, security, or open-source projects where trust is a primary brand attribute",
        ],
      },
      {
        icon: Megaphone,
        title: "Marketing Designer",
        description:
          "Create the visual materials that introduce Kloak to the world: landing pages, social media assets, email templates, announcement graphics, and promotional materials. Translate Kloak's technical privacy story into visuals that resonate with creative communities, not just security professionals.",
        mindset:
          "You understand that marketing for a privacy platform is different. You do not use fear, surveillance imagery, or dark patterns. Instead, you communicate empowerment, independence, and the idea that your tools should work for you, not against you.",
        requirements: [
          "Experience designing marketing collateral: landing pages, social media graphics, email headers, and promotional banners",
          "Ability to communicate complex product value propositions visually, translating technical concepts like encryption and privacy into approachable imagery",
          "Understanding of web-based marketing design: above-the-fold hierarchy, CTA placement, responsive layout for marketing pages, and conversion-oriented design thinking",
          "Familiarity with social media asset requirements across platforms: optimal sizes, format constraints, and platform-specific design conventions",
          "Experience creating visual content that speaks to creative communities (gamers, musicians, artists, streamers) rather than enterprise or security audiences exclusively",
          "Ability to work within an established brand system, applying existing guidelines to new contexts without drifting from the visual identity",
          "Understanding of how to A/B test visual approaches and iterate based on engagement data",
          "Bonus: Experience with video thumbnails, presentation design, or creating visual narratives for product launches",
        ],
      },
    ],
  },
  {
    icon: Shield,
    title: "Security & Privacy",
    subtitle:
      "Harden a privacy-preserved platform against real-world threats and ensure our claims are backed by verifiable architecture, not just policy. Our stack includes Supabase RLS, Edge Functions, libsodium, and Signal Protocol.",
    positions: [
      {
        icon: Bug,
        title: "Penetration Tester",
        description:
          "Actively test Kloak's attack surface across the full stack: client-side JavaScript, Supabase API endpoints, RLS policy bypasses, real-time subscription leaks, and the boundaries between encrypted and plaintext data during the encryption migration. Report findings with clear reproduction steps and severity assessments.",
        mindset:
          "You break things methodically to make them stronger. You do not stop at the first vulnerability. You chain findings together to demonstrate real-world impact. You understand that a communication platform has different attack priorities than an e-commerce site.",
        requirements: [
          "Experience with web application penetration testing: identifying and exploiting XSS, CSRF, injection, authentication bypass, and authorization flaws",
          "Familiarity with testing real-time WebSocket-based applications, including subscription hijacking, message injection, and presence system manipulation",
          "Ability to test Row Level Security policies by crafting direct database queries and API calls that attempt to bypass client-side access control",
          "Knowledge of authentication attack vectors: brute force, credential stuffing, token theft, session fixation, and attacks specific to non-password identity systems",
          "Experience with browser developer tools, proxy interception (Burp Suite, mitmproxy), and manual testing methodologies",
          "Ability to write clear, reproducible vulnerability reports with severity ratings, proof-of-concept steps, and recommended remediations",
          "Understanding of responsible disclosure practices and the ethics of security testing",
          "Bonus: Experience testing cryptographic implementations for timing attacks, padding oracles, or key material exposure",
        ],
      },
      {
        icon: ShieldCheck,
        title: "Cryptographic Auditor",
        description:
          "Review and validate Kloak's encryption implementations for correctness, completeness, and resistance to known attack classes. This includes auditing Signal Protocol integration, Sender Key group encryption, file encryption pipelines, and the key management lifecycle.",
        mindset:
          "You read cryptographic code differently than application code. You look for nonce reuse, improper key derivation, missing authentication tags, unsafe random number generation, and the subtle implementation mistakes that turn a theoretically sound protocol into a practically broken one.",
        requirements: [
          "Strong understanding of applied cryptography: symmetric encryption (AES-GCM, XChaCha20-Poly1305), asymmetric key exchange (X25519, X3DH), digital signatures (Ed25519), and key derivation (HKDF)",
          "Familiarity with Signal Protocol internals: Double Ratchet correctness, prekey bundle handling, session state management, and the security properties that must hold across message ordering edge cases",
          "Ability to audit Sender Key implementations for group messaging: key distribution correctness, rekeying on member removal, and resistance to key compromise",
          "Knowledge of common cryptographic implementation mistakes: nonce reuse, using encryption without authentication, PRNG seeding issues, and side-channel leakage in JavaScript environments",
          "Experience reviewing client-side cryptographic code in TypeScript/JavaScript, understanding the limitations of browser-based crypto compared to native implementations",
          "Understanding of metadata leakage analysis: what information remains visible even when content is properly encrypted",
          "Ability to produce audit reports that are actionable for engineers, including specific code references and recommended fixes",
          "Bonus: Experience with formal verification tools or published security research in applied cryptography",
        ],
      },
      {
        icon: Eye,
        title: "Security Operations Analyst",
        description:
          "Monitor, detect, and respond to security incidents on the Kloak platform. This includes tracking abuse patterns, bot attacks, rate limit evasion, and suspicious authentication activity. Build the detection systems that protect users without requiring surveillance of their content.",
        mindset:
          "You understand that security monitoring on a privacy-preserved platform looks different. You cannot inspect message content, so you build detection around behavioral signals, metadata patterns, and infrastructure telemetry. You protect users by watching the system, not the users.",
        requirements: [
          "Experience with security monitoring and incident detection for web applications",
          "Understanding of bot detection and mitigation strategies: rate limiting, behavioral analysis, CAPTCHA integration, and IP reputation systems",
          "Knowledge of authentication abuse patterns: credential stuffing, brute force attacks, account enumeration, and automated registration abuse",
          "Familiarity with building detection rules that operate on metadata and behavioral signals rather than content inspection",
          "Experience with incident response: triage, containment, investigation, and post-incident documentation",
          "Understanding of abuse patterns specific to communication platforms: spam, harassment campaigns, invite link abuse, and coordinated inauthentic behavior",
          "Ability to balance security enforcement with privacy principles: blocking abuse without creating surveillance infrastructure",
          "Bonus: Experience with SIEM tools, log analysis, or building custom detection pipelines",
        ],
      },
      {
        icon: Scale,
        title: "Privacy & Compliance Analyst",
        description:
          "Ensure Kloak's privacy architecture translates into verifiable, legally sound commitments. Map our encryption design to GDPR obligations, draft transparent privacy documentation, analyze metadata exposure risks, and help define what Kloak can and cannot guarantee at each stage of the encryption rollout.",
        mindset:
          "You believe privacy policy should reflect technical reality, not aspirational marketing. You understand that honest communication about capabilities builds more trust than overclaiming. You bridge the gap between what the engineering team builds and what the legal framework requires.",
        requirements: [
          "Understanding of GDPR requirements and how they apply to communication platforms, particularly data minimization, purpose limitation, and the right to erasure",
          "Familiarity with the privacy implications of hosting jurisdiction and how EU data protection law affects platform obligations",
          "Ability to analyze a technical architecture and identify what data the platform actually collects, processes, and retains, including metadata that persists after content encryption",
          "Experience drafting or reviewing privacy policies, terms of service, transparency reports, or data processing agreements that accurately represent technical capabilities",
          'Understanding of the distinction between policy-based privacy ("we promise not to look") and architectural privacy ("we cannot look"), and the ability to communicate this clearly',
          "Familiarity with content moderation obligations under EU law, including the Digital Services Act, and how these intersect with encrypted architecture where the platform cannot read user content",
          "Understanding of lawful interception and data preservation frameworks, and how encryption affects a platform's ability and obligation to respond to legal requests",
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
        icon: MessageSquare,
        title: "Community Moderator",
        description:
          "Maintain a healthy, welcoming environment across Kloak's community spaces. Enforce community guidelines with consistency and transparency, resolve conflicts, and ensure that the community culture reflects Kloak's values of respect, honesty, and user empowerment.",
        mindset:
          "You understand that moderation on a privacy-focused platform is philosophically different. You use reactive moderation based on reports and visible behavior, not surveillance or automated content scanning. You enforce rules fairly while respecting the privacy principles the platform was built on.",
        requirements: [
          "Experience moderating online communities on platforms like Discord, Slack, Reddit, or similar real-time communication tools",
          "Strong written communication skills with a calm, fair, and consistent tone even in heated situations",
          "Ability to enforce community guidelines transparently: clear warnings, consistent consequences, and documented decision-making",
          "Experience with conflict resolution between community members, including de-escalation techniques and mediation",
          "Understanding of the difference between reactive moderation (responding to reports) and proactive surveillance, and why Kloak uses the former",
          "Familiarity with common community abuse patterns: spam, harassment, brigading, and coordinated disruption",
          "Ability to document moderation actions and contribute to evolving community guidelines based on real incidents",
          "Bonus: Experience moderating communities with a privacy or open-source focus",
        ],
      },
      {
        icon: Users,
        title: "Community Growth Coordinator",
        description:
          "Drive organic growth of Kloak's user community through genuine engagement, partnerships, and outreach. Identify and connect with the creative communities (gamers, musicians, artists, streamers) and privacy-conscious users who would benefit most from the platform.",
        mindset:
          "You believe that for a privacy platform, the community itself is the primary growth engine. You build relationships, not funnels. You understand that trust-based growth is slower but more sustainable than paid acquisition or growth hacking.",
        requirements: [
          "Experience with community growth strategies, particularly grassroots and word-of-mouth approaches rather than paid advertising",
          "Understanding of Kloak's target audiences: gamers, musicians, artists, streamers, small teams, and privacy-conscious users",
          "Ability to identify partnership opportunities with aligned communities, creators, and organizations in the privacy and creative spaces",
          "Experience gathering, organizing, and prioritizing user feedback to inform product decisions in a structured and actionable way",
          "Familiarity with onboarding optimization: understanding why users join, why they stay, and where they drop off",
          "Ability to coordinate between community needs and the development team without requiring deep technical knowledge of the codebase",
          "Understanding of privacy culture and the ability to articulate why architectural privacy matters without overpromising or misrepresenting current capabilities",
          "Bonus: Experience growing communities for open-source projects, indie products, or donation-funded platforms",
        ],
      },
      {
        icon: Share2,
        title: "Social Media & Content Coordinator",
        description:
          "Manage Kloak's presence across social media and content channels. Create announcements, feature highlights, educational posts, and community updates in a tone that is direct, honest, and free of marketing fluff. Build Kloak's public voice.",
        mindset:
          "You communicate privacy as empowerment, not paranoia. You write posts that creative communities actually want to read, not security whitepapers disguised as social content. You understand that consistency and authenticity matter more than viral moments.",
        requirements: [
          "Experience managing social media accounts for products, communities, or organizations, with a focus on authentic engagement over vanity metrics",
          "Strong writing skills with the ability to explain technical privacy concepts in plain, approachable language",
          "Familiarity with content creation across platforms: Twitter/X, Reddit, Mastodon, blog posts, and community announcements",
          "Ability to write product updates, feature announcements, and changelogs that are informative without being either overly technical or overly promotional",
          "Understanding of how to communicate honestly about product capabilities, including what is live today versus what is on the roadmap",
          "Experience with content scheduling, engagement monitoring, and adapting tone and format to different platform audiences",
          "Ability to represent Kloak's voice consistently: direct, honest, technically grounded, and respectful of the audience's intelligence",
          "Bonus: Experience with visual content creation (basic graphics, video clips) or managing content for privacy-focused or open-source projects",
        ],
      },
      {
        icon: BookOpen,
        title: "Documentation Writer",
        description:
          "Create and maintain user-facing documentation: help guides, FAQ pages, onboarding tutorials, feature explanations, and troubleshooting resources. Make Kloak easy to understand for users who may never have used a privacy-preserved communication platform before.",
        mindset:
          "You believe that clear documentation is a form of respect for the user's time. You write for the person who just wants to get something done, not the person who wants to understand the entire system. You keep things concise, scannable, and accurate.",
        requirements: [
          "Strong writing skills with the ability to produce clear, structured documentation for non-technical audiences",
          "Experience creating user-facing help content: getting started guides, feature walkthroughs, FAQ pages, and troubleshooting articles",
          "Ability to explain encryption and privacy concepts (E2E encryption, secret keys, device linking) in plain language without sacrificing accuracy",
          "Familiarity with documentation tools and platforms: Markdown, static site generators, Docusaurus, GitBook, Notion, or equivalent",
          "Understanding of how documentation supports user trust, particularly the importance of honestly representing current capabilities versus planned features",
          "Ability to maintain and update documentation as features evolve, ensuring that outdated information is caught and corrected promptly",
          "Experience organizing information hierarchically so users can find answers quickly without reading entire documents",
          "Bonus: Experience with visual documentation (screenshots, annotated walkthroughs, short video guides)",
        ],
      },
      {
        icon: FileText,
        title: "Technical & Security Writer",
        description:
          "Produce developer-facing and security-facing documentation: API references, architecture decision records, encryption protocol overviews, threat model summaries, contributing guidelines, and security whitepapers. Write for engineers, auditors, and contributors who need precise technical information.",
        mindset:
          "You can take a complex cryptographic concept and explain it at three different levels of depth depending on the audience. You understand that for a privacy platform, technical documentation is not just helpful, it is a trust signal. If it is not documented, it does not exist.",
        requirements: [
          "Strong technical writing skills with the ability to produce precise documentation for developers, security auditors, and open-source contributors",
          "Ability to document cryptographic design decisions: protocol choices, key management architecture, and the security properties each component provides",
          "Familiarity with developer documentation patterns: API references, architecture decision records, setup guides, and contributing guidelines",
          "Ability to write security-facing documentation: threat model summaries, encryption protocol overviews, and privacy whitepapers that are technically precise but accessible",
          "Experience reading and understanding codebases well enough to document their behavior accurately, even if you are not writing the code yourself",
          "Familiarity with version-aware documentation practices: tracking feature rollouts, flagging capabilities that are planned versus shipped, and maintaining changelogs",
          "Experience working with engineering teams to extract technical knowledge and translate it into structured, publishable documentation",
          "Bonus: Experience with diagram tools (Mermaid, draw.io, Excalidraw) for producing architecture visuals and data flow diagrams",
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

              <div className="border border-border/20 bg-card/30 p-6 md:p-8 rounded-lg">
                <h5 className="text-lg font-medium text-foreground mb-2">Interested in this role?</h5>
                <p className="text-muted-foreground text-sm leading-relaxed mb-5 max-w-xl">
                  Tell us about yourself, what excites you about privacy-preserved communication, and how you would like
                  to contribute. Include any relevant work, projects, or ideas.
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
            <span className="text-xs text-muted-foreground">
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
        description="Join the Kloak team. We're building privacy-preserved communication infrastructure and looking for engineers, designers, security specialists, and community builders."
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
                <span className="text-primary">that matters.</span>
              </motion.h1>

              <motion.p
                className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                We're a small indie team building privacy-preserved communication infrastructure. No investors pushing
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
                  We're looking for volunteers
                </span>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-light text-foreground leading-tight tracking-tight">
                  Open Positions.
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
                  <h3 className="text-xl font-medium text-foreground">Privacy by Architecture</h3>
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
