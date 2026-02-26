import { useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import promoVideo from "@/assets/kloak-promo.mp4";

export const HeroImage = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  // Video frame: scale up and fade in as user scrolls down
  const videoScale = useTransform(scrollYProgress, [0.15, 0.45], [0.85, 1]);
  const videoOpacity = useTransform(scrollYProgress, [0.1, 0.35], [0, 1]);
  const videoY = useTransform(scrollYProgress, [0.15, 0.45], [60, 0]);

  // Autoplay when video scrolls into view
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-[hsl(var(--neutral-0))]">
      {/* Top hero area — 75vh */}
      <div className="relative h-[75vh]">
        {/* Main content */}
        <div className="relative z-10 w-full h-full flex flex-col items-center justify-center px-4 sm:px-6">
          <div className="w-full max-w-4xl mx-auto text-center break-words">
            {/* Pre-title */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-xs uppercase tracking-[0.3em] text-foreground/60 mb-8 md:mb-12"
            >
              Privacy-first communication
            </motion.p>

            {/* Main title */}
            <div className="mb-8 md:mb-12">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl xl:text-8xl font-light tracking-tight text-foreground leading-[1.1]">
                  Communication without
                </h1>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
                <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl xl:text-8xl font-light tracking-tight text-foreground leading-[1.1]">
                  compromise.
                </h1>
              </motion.div>
            </div>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed font-light"
            >
              Where your conversations actually belong to you.
            </motion.p>
          </div>
        </div>

        {/* CTA - outside blend mode container so buttons render normally */}
        <div className="absolute bottom-0 left-0 right-0 z-20 flex justify-center pb-12 md:pb-24">
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
            <Link to="/philosophy">
              <Button
                variant="ghost"
                size="lg"
                className="rounded-full px-8 h-12 text-sm font-normal tracking-wide text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                Our Philosophy
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>

      {/* Video showcase — revealed on scroll */}
      <div className="relative px-6 lg:px-16 pb-24 md:pb-32 pt-8 md:pt-16">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full bg-primary/[0.04] blur-[100px]" />
        </div>

        <motion.div
          style={{ scale: videoScale, opacity: videoOpacity, y: videoY }}
          className="max-w-5xl mx-auto relative z-10"
        >
          {/* Browser frame */}
          <div className="rounded-xl overflow-hidden border border-border/30 bg-[hsl(var(--neutral-50))] shadow-2xl shadow-black/50">
            {/* Top bar */}
            <div className="flex items-center gap-2 px-4 py-3 bg-[hsl(var(--neutral-100))] border-b border-border/20">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[hsl(var(--neutral-300))]" />
                <div className="w-3 h-3 rounded-full bg-[hsl(var(--neutral-300))]" />
                <div className="w-3 h-3 rounded-full bg-[hsl(var(--neutral-300))]" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-4 py-1 rounded-md bg-[hsl(var(--neutral-200))] text-xs text-muted-foreground font-mono">
                  kloak.app
                </div>
              </div>
              <div className="w-[54px]" />
            </div>

            {/* Video */}
            <div className="relative aspect-video bg-black">
              <video
                ref={videoRef}
                src={promoVideo}
                muted
                playsInline
                loop
                preload="metadata"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Reflection glow */}
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-3/4 h-12 bg-primary/[0.05] blur-3xl rounded-full pointer-events-none" />
        </motion.div>
      </div>
    </section>
  );
};

export default HeroImage;
