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

// 1. Define the rotation data outside the component to prevent re-renders
const ROTATING_TEXTS = [
  { label: "OPINION", icon: MessageSquareQuote },
  { label: "MESSAGE", icon: MessageSquare },
  { label: "REACTION", icon: Smile },
  { label: "COMMUNITY", icon: Users },
  { label: "FRIENDS", icon: Heart },
  { label: "FAMILY", icon: Home },
  { label: "VOICE", icon: Mic2 },
  { label: "VIBE", icon: Sparkles },
  { label: "CHAOS", icon: Tornado },
  { label: "DRAMA", icon: Theater },
  { label: "RANT", icon: Flame },
  { label: "SECRET", icon: Fingerprint },
  { label: "MEMES", icon: Laugh },
  { label: "HOT TAKE", icon: Flame },
  { label: "GROUP CHAT", icon: UserPlus },
  { label: "DATA", icon: ShieldCheck },
];

export const HeroImage = () => {
  return (
    <section className="relative min-h-screen overflow-hidden">
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
        <motion.div initial="initial" animate="animate" className="w-full text-center">
          <motion.p
            variants={fadeIn}
            transition={{ duration: 0.5, delay: 0 }}
            className="landing-body text-muted-foreground mb-6 text-sm"
          >
            For Gamers · Communities · Teams · Everyone
          </motion.p>

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

                {/* 2. Map through the objects */}
                <TextRotate
                  texts={ROTATING_TEXTS.map(({ label, icon: Icon }) => (
                    <span key={label} className="flex items-center gap-3 sm:gap-4">
                      {label}
                      <Icon size="1em" className="shrink-0 translate-y-[0.05em] stroke-[1.5px]" />
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
