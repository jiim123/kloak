import { Link } from "react-router-dom";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

// Typing animation component
const TypeWriter = ({
  text,
  delay = 0,
  speed = 40,
  className = "",
  onComplete,
}: {
  text: string;
  delay?: number;
  speed?: number;
  className?: string;
  onComplete?: () => void;
}) => {
  const [displayedText, setDisplayedText] = useState("");
  const [showCursor, setShowCursor] = useState(true);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const startTimeout = setTimeout(() => {
      let currentIndex = 0;
      const interval = setInterval(() => {
        if (currentIndex <= text.length) {
          setDisplayedText(text.slice(0, currentIndex));
          currentIndex++;
        } else {
          clearInterval(interval);
          setIsComplete(true);
          onComplete?.();
        }
      }, speed);

      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(startTimeout);
  }, [text, delay, speed, onComplete]);

  useEffect(() => {
    if (isComplete) {
      const cursorTimeout = setTimeout(() => setShowCursor(false), 1500);
      return () => clearTimeout(cursorTimeout);
    }
  }, [isComplete]);

  return (
    <span className={className}>
      {displayedText}
      <motion.span
        animate={{ opacity: showCursor ? [1, 0] : 0 }}
        transition={{ duration: 0.5, repeat: showCursor ? Infinity : 0, repeatType: "reverse" }}
        className="inline-block w-[2px] h-[0.9em] bg-[hsl(var(--brand-600))] ml-1 translate-y-[0.1em]"
      />
    </span>
  );
};

// Radial grid background for depth
const RadialGrid = () => (
  <div className="absolute inset-0 overflow-hidden">
    {/* Perspective grid */}
    <div
      className="absolute inset-0 opacity-[0.03]"
      style={{
        backgroundImage: `
          linear-gradient(to right, hsl(var(--brand-600)) 1px, transparent 1px),
          linear-gradient(to bottom, hsl(var(--brand-600)) 1px, transparent 1px)
        `,
        backgroundSize: "60px 60px",
        transform: "perspective(500px) rotateX(60deg)",
        transformOrigin: "center top",
        maskImage: "linear-gradient(to bottom, black 0%, transparent 80%)",
        WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 80%)",
      }}
    />

    {/* Concentric rings */}
    <div className="absolute inset-0 flex items-center justify-center">
      {[1, 2, 3, 4, 5].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border border-[hsl(var(--neutral-300))]"
          style={{
            width: `${i * 20}%`,
            height: `${i * 20}%`,
            opacity: 0.04 - i * 0.005,
          }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.04 - i * 0.005 }}
          transition={{ duration: 1.5, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
    </div>

    {/* Radial gradient glow */}
    <div
      className="absolute inset-0"
      style={{
        background: "radial-gradient(ellipse at 50% 50%, hsl(var(--neutral-200) / 0.15) 0%, transparent 50%)",
      }}
    />
  </div>
);

// Subtle particle field
const ParticleField = () => {
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 1,
    duration: Math.random() * 20 + 20,
    delay: Math.random() * 5,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full bg-[hsl(var(--neutral-500))]"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.1, 0.3, 0.1],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
};

export const HeroImage = () => {
  const [line1Complete, setLine1Complete] = useState(false);
  const [line2Complete, setLine2Complete] = useState(false);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const backgroundX = useTransform(mouseX, [-0.5, 0.5], [-10, 10]);
  const backgroundY = useTransform(mouseY, [-0.5, 0.5], [-10, 10]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      mouseX.set(clientX / innerWidth - 0.5);
      mouseY.set(clientY / innerHeight - 0.5);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <section className="relative min-h-screen overflow-hidden bg-[hsl(var(--neutral-0))]">
      {/* Layered background for depth */}
      <motion.div className="absolute inset-0" style={{ x: backgroundX, y: backgroundY }}>
        <RadialGrid />
        <ParticleField />
      </motion.div>

      {/* Noise texture */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,hsl(var(--neutral-0))_80%)]" />

      {/* Main content */}
      <div className="relative z-10 w-full min-h-screen flex flex-col items-center justify-center px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Pre-title */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--neutral-500))] mb-12"
          >
            Privacy-first communication
          </motion.p>

          {/* Main title - typing effect */}
          <div className="space-y-2 md:space-y-4 mb-12">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-light tracking-tight text-[hsl(var(--neutral-900))]">
              <TypeWriter
                text="Communication without"
                delay={600}
                speed={35}
                onComplete={() => setLine1Complete(true)}
              />
            </h1>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-light tracking-tight text-[hsl(var(--brand-600))]">
              {line1Complete && (
                <TypeWriter text="compromise." delay={200} speed={50} onComplete={() => setLine2Complete(true)} />
              )}
            </h1>
          </div>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: line2Complete ? 1 : 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-base md:text-lg text-[hsl(var(--neutral-500))] max-w-xl mx-auto leading-relaxed font-light"
          >
            End-to-end encrypted messaging, voice, and community spaces. Built on infrastructure designed for privacy,
            not profit.
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: line2Complete ? 1 : 0, y: line2Complete ? 0 : 20 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link to="/app">
              <Button
                size="lg"
                className="rounded-full px-8 h-12 text-sm font-normal tracking-wide bg-[hsl(var(--brand-600))] hover:bg-[hsl(var(--brand-700))] text-[hsl(var(--neutral-0))] border-0 group"
              >
                Get started
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/features">
              <Button
                variant="ghost"
                size="lg"
                className="rounded-full px-8 h-12 text-sm font-normal tracking-wide text-[hsl(var(--neutral-600))] hover:text-[hsl(var(--neutral-800))] hover:bg-[hsl(var(--neutral-100))]"
              >
                Learn more
              </Button>
            </Link>
          </motion.div>

          {/* Bottom info */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: line2Complete ? 1 : 0 }}
            transition={{ duration: 0.6, delay: 1 }}
            className="mt-20 flex items-center justify-center gap-8 text-xs text-[hsl(var(--neutral-400))] tracking-wide"
          >
            <span>No data collection</span>
            <span className="w-1 h-1 rounded-full bg-[hsl(var(--neutral-400))]" />
            <span>Swedish infrastructure</span>
            <span className="w-1 h-1 rounded-full bg-[hsl(var(--neutral-400))]" />
            <span>Open architecture</span>
          </motion.div>
        </div>
      </div>

      {/* Subtle bottom line */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: line2Complete ? 1 : 0 }}
        transition={{ duration: 1.5, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--neutral-300))] to-transparent"
      />
    </section>
  );
};

export default HeroImage;
