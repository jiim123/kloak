import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.3,
    },
  },
};

// HUD corner brackets component
const HUDCorner = ({ position }: { position: "tl" | "tr" | "bl" | "br" }) => {
  const positionClasses = {
    tl: "top-6 left-6 border-l border-t",
    tr: "top-6 right-6 border-r border-t",
    bl: "bottom-6 left-6 border-l border-b",
    br: "bottom-6 right-6 border-r border-b",
  };

  return (
    <div
      className={`absolute w-12 h-12 border-primary/30 ${positionClasses[position]}`}
    />
  );
};

// Animated grid background
const GridBackground = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {/* Subtle grid pattern */}
    <div
      className="absolute inset-0 opacity-[0.03]"
      style={{
        backgroundImage: `
          linear-gradient(hsl(var(--primary)) 1px, transparent 1px),
          linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)
        `,
        backgroundSize: "80px 80px",
      }}
    />
    {/* Radial gradient overlay */}
    <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />
    <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background opacity-50" />
  </div>
);

// Animated data visualization element
const DataVisualization = () => (
  <div className="absolute bottom-32 right-12 hidden lg:flex flex-col gap-1 opacity-20">
    {Array.from({ length: 8 }).map((_, i) => (
      <motion.div
        key={i}
        className="h-1 bg-primary/60"
        initial={{ width: 0 }}
        animate={{ width: Math.random() * 80 + 20 }}
        transition={{
          duration: 1.5,
          delay: i * 0.1,
          repeat: Infinity,
          repeatType: "reverse",
          repeatDelay: 2,
        }}
      />
    ))}
  </div>
);

export const HeroPalantir = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background layers */}
      <GridBackground />

      {/* HUD corner brackets */}
      <HUDCorner position="tl" />
      <HUDCorner position="tr" />
      <HUDCorner position="bl" />
      <HUDCorner position="br" />

      {/* Status indicators - top */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-primary/60 animate-pulse" />
        <span className="text-[10px] font-mono text-primary/50 tracking-[0.3em] uppercase">
          System Online
        </span>
        <div className="w-2 h-2 rounded-full bg-primary/60 animate-pulse" />
      </div>

      {/* Data visualization */}
      <DataVisualization />

      {/* Main content */}
      <motion.div
        className="relative z-10 max-w-4xl mx-auto px-6 text-center"
        initial="initial"
        animate="animate"
        variants={staggerContainer}
      >
        {/* Small tagline */}
        <motion.p
          variants={fadeInUp}
          className="text-[11px] font-mono text-primary/70 tracking-[0.4em] uppercase mb-8"
        >
          Privacy-First Communication
        </motion.p>

        {/* Main headline - short and powerful */}
        <motion.h1
          variants={fadeInUp}
          className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-semibold text-foreground leading-[0.95] tracking-tight mb-8"
        >
          Your key.
          <br />
          <span className="text-primary">Your voice.</span>
        </motion.h1>

        {/* One-line description */}
        <motion.p
          variants={fadeInUp}
          className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto mb-12"
        >
          One cryptographic key. Zero data collection. Complete control.
        </motion.p>

        {/* CTA buttons */}
        <motion.div variants={fadeInUp} className="flex items-center justify-center gap-4">
          {/* Primary CTA */}
          <Link to="/app">
            <button className="group flex items-center gap-3 bg-foreground text-background px-8 py-4 text-sm font-medium tracking-[0.1em] uppercase transition-all duration-300 hover:bg-primary hover:text-primary-foreground">
              Get Started
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </Link>

          {/* Secondary CTA */}
          <Link to="/philosophy">
            <button className="flex items-center gap-3 border border-border/50 px-8 py-4 text-sm font-medium tracking-[0.1em] uppercase text-muted-foreground transition-all duration-300 hover:border-foreground/50 hover:text-foreground hover:bg-foreground/5">
              Learn More
            </button>
          </Link>
        </motion.div>
      </motion.div>

      {/* Bottom status bar */}
      <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
        <div className="flex items-center gap-4 text-[10px] font-mono text-muted-foreground/40">
          <span className="tracking-widest">v1.0</span>
          <div className="w-8 h-px bg-border/50" />
          <span className="tracking-widest">SECURE</span>
        </div>

        <div className="flex items-center gap-4 text-[10px] font-mono text-muted-foreground/40">
          <span className="tracking-widest">ENCRYPTED</span>
          <div className="w-8 h-px bg-border/50" />
          <span className="tracking-widest">PRIVATE</span>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-20 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.8 }}
      >
        <motion.div
          className="w-px h-12 bg-gradient-to-b from-primary/50 to-transparent"
          animate={{ scaleY: [1, 0.5, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>
    </section>
  );
};

export default HeroPalantir;
