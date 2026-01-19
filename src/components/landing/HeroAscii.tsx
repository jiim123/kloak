import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
};

export const HeroImage = () => {
  return (
    <section className="px-6 py-24">
      <motion.div initial="initial" animate="animate" className="max-w-6xl mx-auto">
        <div className="relative overflow-hidden rounded-2xl">
          {/* Image */}
          <img
            src="https://images.pexels.com/photos/30626449/pexels-photo-30626449.jpeg"
            alt="Kloak hero"
            className="w-full h-[100vh] object-cover"
            loading="lazy"
          />

          {/* Subtle bottom gradient */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

          {/* Bottom-left text */}
          <motion.div
            {...fadeIn}
            className="absolute bottom-6 left-6 sm:bottom-8 sm:left-8 md:bottom-10 md:left-10 max-w-xl"
          >
            <p className="text-sm font-medium text-primary mb-3 uppercase tracking-wide">
              For Gamers · Communities · Teams · Everyone
            </p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-white leading-tight mb-4">
              Where conversations
              <br />
              belong to you.
            </h1>
            <p className="text-base sm:text-lg text-white/80 mb-6 leading-relaxed">
              A space for your community to connect, create, and grow together—without ads, tracking, or compromise.
            </p>
            <Link to="/app">
              <Button size="lg" className="h-11 px-7 text-base">
                Join Kloak
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
};

export default HeroImage;
