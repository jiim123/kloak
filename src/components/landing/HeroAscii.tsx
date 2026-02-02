import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GrainGradient } from "@paper-design/shaders-react";

export const HeroImage = () => {
  return (
    <section className="relative min-h-screen overflow-hidden bg-[hsl(var(--neutral-0))]">
      {/* Shader background */}
      <div className="absolute inset-0">
        <GrainGradient
          style={{ width: "100%", height: "100%" }}
          colors={["#ffffff", "#000000"]}
          colorBack="#0f0f0f"
          softness={0.5}
          intensity={0.5}
          noise={0.5}
          shape="ripple"
          speed={1}
          scale={2.64}
          offsetY={-0.86}
        />
      </div>

      {/* Main content - with blend mode */}
      <div className="relative z-10 w-full min-h-screen flex flex-col items-center justify-center px-6 mix-blend-difference">
        <div className="max-w-4xl mx-auto text-center">
          {/* Pre-title */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xs uppercase tracking-[0.3em] text-white mb-12"
          >
            Privacy-first communication
          </motion.p>

          {/* Main title */}
          <div className="space-y-2 md:space-y-4 mb-12">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-light tracking-tight text-white"
            >
              Communication without
            </motion.h1>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-light tracking-tight text-white"
            >
              compromise.
            </motion.h1>
          </div>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="text-base md:text-lg text-white/70 max-w-xl mx-auto leading-relaxed font-light"
          >
            End-to-end encrypted messaging, voice, and community spaces. Built on infrastructure designed for privacy,
            not profit.
          </motion.p>
        </div>
      </div>

      {/* CTA - outside blend mode container so buttons render normally */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex justify-center pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link to="/app">
            <Button
              size="lg"
              className="rounded-full px-8 h-12 text-sm font-normal tracking-wide bg-white hover:bg-neutral-200 text-black border-0 group"
            >
              Open Kloak
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          <Link to="/philosophy">
            <Button
              variant="ghost"
              size="lg"
              className="rounded-full px-8 h-12 text-sm font-normal tracking-wide text-white/80 hover:text-white hover:bg-white/10"
            >
              Our Philosophy
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroImage;
