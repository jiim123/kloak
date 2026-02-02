import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const HeroImage = () => {
  return (
    <section className="relative min-h-screen overflow-hidden bg-[hsl(var(--neutral-0))]">
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

          {/* Main title */}
          <div className="space-y-2 md:space-y-4 mb-12">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-light tracking-tight text-[hsl(var(--neutral-900))]"
            >
              Communication without
            </motion.h1>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-light tracking-tight text-[hsl(var(--brand-600))]"
            >
              compromise.
            </motion.h1>
          </div>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="text-base md:text-lg text-[hsl(var(--neutral-500))] max-w-xl mx-auto leading-relaxed font-light"
          >
            End-to-end encrypted messaging, voice, and community spaces. Built on infrastructure designed for privacy,
            not profit.
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1 }}
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
        </div>
      </div>
    </section>
  );
};

export default HeroImage;
