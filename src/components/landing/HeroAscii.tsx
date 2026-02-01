import { Link } from "react-router-dom";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowRight, Shield, Zap, Lock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

// Floating orbs component for depth
const FloatingOrb = ({
  className,
  delay = 0,
  duration = 20,
  size = "w-96 h-96",
}: {
  className?: string;
  delay?: number;
  duration?: number;
  size?: string;
}) => (
  <motion.div
    className={`absolute rounded-full blur-3xl opacity-30 ${size} ${className}`}
    animate={{
      y: [0, -50, 0],
      x: [0, 30, 0],
      scale: [1, 1.1, 1],
    }}
    transition={{
      duration,
      delay,
      repeat: Infinity,
      ease: "easeInOut",
    }}
  />
);

// Animated grid lines for tech feel
const GridLines = () => (
  <div className="absolute inset-0 overflow-hidden opacity-[0.03]">
    <div
      className="absolute inset-0"
      style={{
        backgroundImage: `
          linear-gradient(to right, currentColor 1px, transparent 1px),
          linear-gradient(to bottom, currentColor 1px, transparent 1px)
        `,
        backgroundSize: "60px 60px",
      }}
    />
  </div>
);

// Floating glass card component
const GlassCard = ({
  children,
  className = "",
  delay = 0,
  x = 0,
  y = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  x?: number;
  y?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 40, x }}
    animate={{ opacity: 1, y, x }}
    transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
    className={`absolute backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 shadow-2xl ${className}`}
  >
    <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay }}>
      {children}
    </motion.div>
  </motion.div>
);

// Animated word component with letter stagger
const AnimatedWord = ({ word, delay = 0, className = "" }: { word: string; delay?: number; className?: string }) => (
  <motion.span className={`inline-flex ${className}`}>
    {word.split("").map((letter, i) => (
      <motion.span
        key={i}
        initial={{ opacity: 0, y: 50, rotateX: -90 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{
          duration: 0.6,
          delay: delay + i * 0.04,
          ease: [0.16, 1, 0.3, 1],
        }}
        className="inline-block"
      >
        {letter}
      </motion.span>
    ))}
  </motion.span>
);

// Pill badge component
const PillBadge = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 20, scale: 0.9 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.05] border border-white/[0.1] backdrop-blur-sm"
  >
    {children}
  </motion.div>
);

export const HeroImage = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 25, stiffness: 150 };
  const x = useSpring(mouseX, springConfig);
  const y = useSpring(mouseY, springConfig);

  const rotateX = useTransform(y, [-0.5, 0.5], [5, -5]);
  const rotateY = useTransform(x, [-0.5, 0.5], [-5, 5]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      mouseX.set(clientX / innerWidth - 0.5);
      mouseY.set(clientY / innerHeight - 0.5);
      setMousePosition({ x: clientX, y: clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  const titleWords = ["Connect.", "Create.", "Control.", "Yours."];

  return (
    <section className="relative min-h-screen overflow-hidden bg-background">
      {/* Aurora gradient background */}
      <div className="absolute inset-0">
        <FloatingOrb className="bg-violet-500 -top-48 -left-48" delay={0} size="w-[600px] h-[600px]" />
        <FloatingOrb className="bg-cyan-500 top-1/4 right-0" delay={2} duration={25} size="w-[500px] h-[500px]" />
        <FloatingOrb className="bg-fuchsia-500 bottom-0 left-1/3" delay={4} duration={22} size="w-[400px] h-[400px]" />
        <FloatingOrb
          className="bg-emerald-500/50 top-1/2 left-1/4"
          delay={1}
          duration={18}
          size="w-[300px] h-[300px]"
        />
      </div>

      {/* Grid overlay */}
      <GridLines />

      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Radial gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />

      {/* Floating UI elements for depth - hidden on mobile */}
      <div className="hidden lg:block">
        <GlassCard className="top-32 right-[15%] z-20" delay={1}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center">
              <Shield className="w-5 h-5 text-background" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">End-to-End</p>
              <p className="text-sm font-medium text-foreground">Encrypted</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="top-48 left-[10%] z-20" delay={1.2}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-fuchsia-400 flex items-center justify-center">
              <Zap className="w-5 h-5 text-background" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Crystal Clear</p>
              <p className="text-sm font-medium text-foreground">Voice Chat</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="bottom-48 right-[20%] z-20" delay={1.4}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center">
              <Users className="w-5 h-5 text-background" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Built for</p>
              <p className="text-sm font-medium text-foreground">Communities</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="bottom-64 left-[8%] z-20" delay={1.6}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-400 to-pink-400 flex items-center justify-center">
              <Lock className="w-5 h-5 text-background" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Zero</p>
              <p className="text-sm font-medium text-foreground">Data Collection</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full min-h-screen flex flex-col items-center justify-center px-6 md:px-12">
        <div className="max-w-5xl mx-auto text-center">
          {/* Top badge */}
          <PillBadge delay={0.2}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-sm text-muted-foreground">Privacy-first communication</span>
          </PillBadge>

          {/* Main title */}
          <motion.div className="mt-8 mb-6" style={{ rotateX, rotateY, transformPerspective: 1000 }}>
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-bold tracking-tight">
              <div className="flex flex-wrap justify-center gap-x-4 md:gap-x-6">
                {titleWords.map((word, index) => (
                  <AnimatedWord
                    key={word}
                    word={word}
                    delay={0.4 + index * 0.15}
                    className={
                      index === titleWords.length - 1
                        ? "bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent"
                        : "text-foreground"
                    }
                  />
                ))}
              </div>
            </h1>
          </motion.div>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
          >
            A space for your community to chat, stream, and grow together—
            <span className="text-foreground font-medium">without ads, tracking, or compromise.</span>
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.4, ease: [0.16, 1, 0.3, 1] }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link to="/app">
              <Button
                size="lg"
                className="rounded-full px-8 h-14 text-base font-medium bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 border-0 shadow-lg shadow-violet-500/25 group"
              >
                Get Started Free
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/features">
              <Button
                variant="outline"
                size="lg"
                className="rounded-full px-8 h-14 text-base font-medium border-white/10 bg-white/[0.03] backdrop-blur-sm hover:bg-white/[0.08]"
              >
                See How It Works
              </Button>
            </Link>
          </motion.div>

          {/* Trust indicators */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1.8 }}
            className="mt-16 flex flex-wrap items-center justify-center gap-6 md:gap-8 text-sm text-muted-foreground"
          >
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
              <span>Swedish servers</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
              <span>GDPR compliant</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />
    </section>
  );
};

export default HeroImage;
