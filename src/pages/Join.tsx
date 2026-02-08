import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Code, Shield, Palette, Sparkles, Mail, ChevronDown } from "lucide-react";
import { Footer } from "@/components/ui/footer-section";
import { NavigationMenu } from "@/components/layout/NavigationMenu";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/seo";

interface RoleRequirement {
  text: string;
}

interface RoleData {
  icon: React.ElementType;
  title: string;
  description: string;
  mindset: string;
  requirements: RoleRequirement[];
}

const roles: RoleData[] = [
  {
    icon: Palette,
    title: "Designers",
    description:
      "Design for potentially thousands of users. Create emojis, avatar decorations, motion designs, and visual experiences that make Kloak unique.",
    mindset:
      "You care about the details. You understand that the difference between good and great is in the hover states, the spacing, the way a transition feels. You want to build a visual identity for a platform that stands apart from the mainstream.",
    requirements: [
      { text: "Proficiency in UI/UX design tools such as Figma, Adobe Creative Suite, or equivalent" },
      {
        text: "Strong understanding of modern web design principles including responsive layouts, accessibility standards, and design systems",
      },
      {
        text: "Experience creating cohesive visual languages — icons, typography hierarchies, color systems, and component libraries",
      },
      {
        text: "Ability to design motion graphics, micro-interactions, and animations using CSS animations, Lottie, or similar tools",
      },
      {
        text: "Familiarity with Tailwind CSS utility-first design patterns is a plus — our entire interface is built on it",
      },
      {
        text: "Experience designing for dark-themed interfaces with glass morphism, backdrop blur effects, and layered transparency",
      },
      {
        text: "Ability to create custom emoji sets, avatar decorations, and visual assets that maintain consistency at multiple resolutions",
      },
      {
        text: "An eye for subtle, sophisticated aesthetics — we favor clean and professional over loud and flashy",
      },
      {
        text: "Understanding of how design choices impact performance, particularly animation frame rates and rendering overhead",
      },
      { text: "Bonus: Experience with brand identity work, marketing collateral, or landing page design" },
    ],
  },
  {
    icon: Code,
    title: "Developers",
    description: "Build secure, performant systems from the ground up. React, TypeScript, Supabase, and more.",
    mindset:
      "You write code that respects the user. You question whether a feature needs to exist before building it. You understand that simplicity and reliability beat complexity and feature bloat every time. You're comfortable working in a fast-moving indie environment where you wear multiple hats.",
    requirements: [
      { text: "Strong proficiency in React and TypeScript." },
      { text: "Working knowledge of Tailwind CSS for styling and component design" },
      {
        text: "Experience with Supabase or PostgreSQL — our backend runs on Supabase, so understanding of Row Level Security policies, PostgreSQL functions, triggers, real-time subscriptions, and database design is highly valued",
      },
      { text: "Familiarity with Zustand or similar state management libraries" },
      {
        text: "Comfort working with Generative AI coding tools such as Cursor, Lovable, Claude, or GitHub Copilot — we leverage AI-assisted development extensively and need people who can write effective prompts, review AI-generated code critically, and understand when AI output needs human correction",
      },
      {
        text: "Understanding of real-time communication patterns — WebSockets, presence systems, optimistic updates, and subscription-based data flows",
      },
      {
        text: "Experience with authentication systems, particularly token-based auth, cryptographic key management, or non-traditional identity systems",
      },
      { text: "Knowledge of end-to-end encryption principles and secure data handling practices" },
      {
        text: "Familiarity with Progressive Web App architecture, service workers, and offline-first patterns is a plus",
      },
      {
        text: "Experience with WebRTC or voice/video integration platforms such as LiveKit is a strong bonus",
      },
      { text: "Ability to read, debug, and refactor existing codebases — not just greenfield work" },
    ],
  },
  {
    icon: Shield,
    title: "Security Enthusiasts",
    description: "Help us stay ahead of threats and ensure our users' data remains theirs alone.",
    mindset:
      "You think like an attacker so you can defend like a professional. You understand that privacy isn't a feature you bolt on — it's an architectural decision that touches everything. You're the person who asks \"but what if someone tries to...\" before code ships.",
    requirements: [
      {
        text: "Understanding of web application security fundamentals — OWASP Top 10, XSS, CSRF, SQL injection, and common attack vectors",
      },
      {
        text: "Experience with or strong interest in end-to-end encryption implementation, key management, and cryptographic protocols",
      },
      {
        text: "Familiarity with PostgreSQL security patterns, particularly Row Level Security, role-based access control, and the distinction between client-side and server-side permission enforcement",
      },
      {
        text: "Knowledge of authentication security — token handling, session management, secret key-based identity systems, and brute force mitigation",
      },
      {
        text: "Understanding of privacy-by-design architecture — data minimization, zero-knowledge principles, and how infrastructure choices impact user privacy",
      },
      {
        text: "Familiarity with European privacy frameworks including GDPR and the implications of hosting jurisdiction on data protection",
      },
      {
        text: "Experience with penetration testing, vulnerability assessment, or security auditing of web applications",
      },
      {
        text: "Ability to identify security anti-patterns in code review, particularly around real-time data subscriptions and API exposure",
      },
      {
        text: "Knowledge of secure DevOps practices — secrets management, environment isolation, and deployment security",
      },
      { text: "Bonus: Experience with threat modeling, incident response planning, or security documentation" },
    ],
  },
  {
    icon: Heart,
    title: "Community Builders",
    description: "Connect with users, gather feedback, and help shape the future of private communication.",
    mindset:
      "You're the bridge between the people who build Kloak and the people who use it. You believe communities grow best when they're built on trust and transparency, not algorithms and engagement hacks. You're passionate about giving people a voice in the tools they use every day.",
    requirements: [
      {
        text: "Experience managing or moderating online communities, particularly on platforms like Discord, Slack, Reddit, or similar",
      },
      {
        text: "Strong written communication skills — you can explain technical privacy concepts in plain language that resonates with everyday users",
      },
      {
        text: "Ability to create and maintain documentation including FAQs, community guidelines, onboarding guides, and help articles",
      },
      { text: "Experience gathering, organizing, and prioritizing user feedback to inform product decisions" },
      {
        text: "Understanding of Kloak's target audiences — gamers, musicians, artists, streamers, small businesses, and privacy-conscious users — and the ability to speak authentically to those communities",
      },
      { text: "Familiarity with content creation for social media, blog posts, or community announcements" },
      {
        text: "Ability to handle conflict resolution and enforce community standards with fairness, transparency, and a reactive rather than surveillance-based approach",
      },
      {
        text: "Understanding of privacy culture and the ability to articulate why privacy matters without resorting to fear-mongering or technical jargon",
      },
      {
        text: "Experience with or interest in grassroots community growth strategies — building genuine engagement rather than chasing vanity metrics",
      },
      {
        text: "Bonus: Experience with support ticket systems, bug reporting workflows, or user research methodologies",
      },
    ],
  },
];

const RoleAccordion = ({ role, isOpen, onToggle }: { role: RoleData; isOpen: boolean; onToggle: () => void }) => {
  const Icon = role.icon;

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
          <h3 className="text-xl md:text-2xl font-medium text-foreground">{role.title}</h3>
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
              {/* Description */}
              <p className="text-muted-foreground leading-relaxed mb-8 max-w-3xl">{role.description}</p>

              {/* Requirements */}
              <div className="mb-8">
                <h4 className="text-sm font-mono text-primary tracking-widest uppercase mb-5">
                  What we're looking for
                </h4>
                <ul className="space-y-3">
                  {role.requirements.map((req, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-2 shrink-0" />
                      <span className="text-muted-foreground text-sm leading-relaxed">{req.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Mindset */}
              <div className="mb-10 border-l-2 border-primary/20 pl-6">
                <h4 className="text-sm font-mono text-primary tracking-widest uppercase mb-3">Mindset</h4>
                <p className="text-muted-foreground text-sm leading-relaxed italic">{role.mindset}</p>
              </div>

              {/* Contact CTA */}
              <div className="border border-border/20 bg-card/30 p-6 md:p-8 rounded-lg">
                <h4 className="text-lg font-medium text-foreground mb-2">Ready to join?</h4>
                <p className="text-muted-foreground text-sm leading-relaxed mb-5 max-w-xl">
                  If you're passionate about privacy and want to contribute to something meaningful, we'd love to hear
                  from you. Tell us about yourself, what excites you, and how you'd like to help.
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
    </motion.div>
  );
};

const Join = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const handleToggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center w-full">
      <SEO
        title="Join Us | Kloak"
        description="Join the Kloak team. We're a small indie team looking for passionate designers, engineers, and security enthusiasts."
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
                We're a tiny indie team on a mission to give people back their privacy. No investors pushing growth
                metrics. No corporate roadmap. Just passionate volunteers building tools that respect users.
              </motion.p>
            </div>
          </section>

          {/* Roles Section - Accordions */}
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
                {roles.map((role, index) => (
                  <RoleAccordion
                    key={role.title}
                    role={role}
                    isOpen={openIndex === index}
                    onToggle={() => handleToggle(index)}
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
                  <h3 className="text-xl font-medium text-foreground">Mission Driven</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Privacy isn't a feature for us—it's the foundation everything is built on.
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
