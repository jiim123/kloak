import { lazy, Suspense, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const LazyHalftoneScene = lazy(() =>
  import("./HalftoneScene").then((m) => ({ default: m.HalftoneScene }))
);

export const HeroImage = () => {
  const sectionRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const videoScale = useTransform(scrollYProgress, [0.15, 0.45], [0.85, 1]);
  const videoOpacity = useTransform(scrollYProgress, [0.1, 0.35], [0, 1]);
  const videoY = useTransform(scrollYProgress, [0.15, 0.45], [60, 0]);

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-[hsl(var(--neutral-0))]">
      {/* Top hero area — 75vh */}
      <div className="relative h-[75vh] flex flex-col items-center justify-center px-4 sm:px-6">
        <div className="w-full max-w-4xl mx-auto text-center">
          {/* Pre-title */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="font-mono text-[10px] sm:text-xs tracking-[0.3em] text-foreground mb-6 sm:mb-8 md:mb-12"
          >
            Talk privately
          </motion.p>

          {/* Main title */}
          <div className="mb-4 sm:mb-6 md:mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <h1 className="text-[clamp(1.5rem,5vw,6rem)] font-medium tracking-tight text-foreground leading-[1.1]">
                Finally, a Place to Just Be
                <br />
                Together.
              </h1>
            </motion.div>
          </div>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed font-light mb-8"
          >
            Where your conversations actually belong to you.
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link to="/app">
              <Button
                size="lg"
                className="rounded-full px-8 h-12 text-sm font-normal tracking-wide bg-foreground hover:bg-foreground/90 text-background border-0 group"
              >
                Open Kloak
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/about">
              <Button
                variant="ghost"
                size="lg"
                className="rounded-full px-8 h-12 text-sm font-normal tracking-wide text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                About Kloak
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>

      {/* Halftone 3D visual below hero text */}
      <motion.div
        style={{ scale: videoScale, opacity: videoOpacity, y: videoY }}
        className="relative w-full max-w-5xl mx-auto px-4 sm:px-8 pb-16"
      >
        <div className="rounded-2xl overflow-hidden border border-border/20 shadow-2xl">
          <Suspense
            fallback={
              <div className="w-full aspect-video bg-[#dbd6cc]" />
            }
          >
            <LazyHalftoneScene className="w-full aspect-video" />
          </Suspense>
        </div>
      </motion.div>
    </section>
  );
};

export default HeroImage;
