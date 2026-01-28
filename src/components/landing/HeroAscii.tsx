import { Link } from "react-router-dom";
import { LayoutGroup, motion } from "framer-motion";
import {
  ArrowRight,
  MessageSquareQuote,
  MessageSquare,
  Smile,
  Users,
  Heart,
  Home,
  Mic2,
  Sparkles,
  Tornado,
  Theater,
  Flame,
  Fingerprint,
  Laugh,
  UserPlus,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import TextRotate from "@/components/fancy/text/text-rotate";
import { GrainGradient } from "@paper-design/shaders-react";

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const ROTATING_TEXTS = [
  { label: "OPINION", icon: MessageSquareQuote, gradient: "gradient-purple" },
  { label: "MESSAGE", icon: MessageSquare, gradient: "gradient-blue" },
  { label: "REACTION", icon: Smile, gradient: "gradient-yellow" },
  { label: "COMMUNITY", icon: Users, gradient: "gradient-teal" },
  { label: "FRIENDS", icon: Heart, gradient: "gradient-pink" },
  { label: "FAMILY", icon: Home, gradient: "gradient-orange" },
  { label: "VOICE", icon: Mic2, gradient: "gradient-green" },
  { label: "VIBE", icon: Sparkles, gradient: "gradient-rainbow" },
  { label: "CHAOS", icon: Tornado, gradient: "gradient-red" },
  { label: "DRAMA", icon: Theater, gradient: "gradient-purple" },
  { label: "RANT", icon: Flame, gradient: "gradient-fire" },
  { label: "SECRET", icon: Fingerprint, gradient: "gradient-cyan" },
  { label: "MEMES", icon: Laugh, gradient: "gradient-yellow" },
  { label: "HOT TAKE", icon: Flame, gradient: "gradient-fire" },
  { label: "GROUP CHAT", icon: UserPlus, gradient: "gradient-blue" },
  { label: "DATA", icon: ShieldCheck, gradient: "gradient-green" },
];

export const HeroImage = () => {
  return (
    <section className="relative min-h-screen overflow-hidden">
      {/* Hidden SVG with gradient definitions */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="gradient-purple" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
          <linearGradient id="gradient-blue" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
          <linearGradient id="gradient-yellow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
          <linearGradient id="gradient-teal" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
          <linearGradient id="gradient-pink" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#f43f5e" />
          </linearGradient>
          <linearGradient id="gradient-orange" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#eab308" />
          </linearGradient>
          <linearGradient id="gradient-green" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
          <linearGradient id="gradient-rainbow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="25%" stopColor="#f97316" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="75%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
          <linearGradient id="gradient-red" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>
          <linearGradient id="gradient-fire" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#dc2626" />
            <stop offset="50%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
          <linearGradient id="gradient-cyan" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#0ea5e9" />
          </linearGradient>
        </defs>
      </svg>

      {/* Shader background */}
      <div className="absolute inset-0">
        <GrainGradient
          style={{ width: "100%", height: "100%" }}
          colors={["#424242"]}
          colorBack="#0f0f0f"
          softness={1}
          intensity={0.16}
          noise={0}
          shape="ripple"
          speed={0.9}
          scale={0.8}
        />
      </div>

      <div className="relative z-10 w-full min-h-screen flex items-center justify-center px-6 py-20">
          <motion.div variants={fadeIn} transition={{ duration: 0.5, delay: 0.1 }} className="mb-8">
            <LayoutGroup>
              <motion.div
                className="flex flex-col items-center justify-center text-3xl sm:text-4xl md:text-5xl lg:text-8xl font-light"
                layout
              >
                <motion.span
                  className="text-foreground"
                  layout
                  transition={{ type: "spring", damping: 30, stiffness: 400 }}
                >
                  YOUR
                </motion.span>

                <TextRotate
                  texts={ROTATING_TEXTS.map(({ label, icon: Icon, gradient }) => (
                    <span key={label} className="flex items-center gap-3 sm:gap-4">
                      {label}
                      <Icon
                        size="1em"
                        className="shrink-0 translate-y-[0.05em]"
                        style={{ stroke: `url(#${gradient})` }}
                        strokeWidth={1.5}
                      />
                    </span>
                  ))}
                  mainClassName="text-background px-3 sm:px-6 bg-primary overflow-hidden py-1 sm:py-2 justify-center rounded-lg my-2 sm:my-4"
                  staggerFrom="last"
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "-120%" }}
                  staggerDuration={0.025}
                  splitLevelClassName="overflow-hidden pb-0.5 sm:pb-1"
                  transition={{ type: "spring", damping: 30, stiffness: 400 }}
                  rotationInterval={3000}
                />

                <motion.span
                  className="text-foreground font-light"
                  layout
                  transition={{ type: "spring", damping: 30, stiffness: 400 }}
                >
                  IS PRIVATE.
                </motion.span>
              </motion.div>
            </LayoutGroup>
          </motion.div>

          <motion.p
            variants={fadeIn}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="landing-body text-primary mb-10 text-sm max-w-sm mx-auto"
          >
            A space for your community to connect, create, and grow together—without ads, tracking, or compromise.
          </motion.p>

          <motion.div variants={fadeIn} transition={{ duration: 0.5, delay: 0.3 }}>
            <Link to="/app">
              <Button size="lg" className="rounded-xl uppercase tracking-wider group">
                Download Kloak
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroImage;
