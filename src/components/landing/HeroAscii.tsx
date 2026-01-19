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
    <section className="w-full">
      <motion.div initial="initial" animate="animate" className="w-full">
        <div className="relative overflow-hidden w-full h-screen">
          {/* Image */}
          <img
            src="https://images.pexels.com/photos/30626449/pexels-photo-30626449.jpeg"
            alt="Kloak hero"
            className="w-full h-full object-cover"
            loading="lazy"
          />

          {/* Subtle bottom gradient */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          {/* Bottom-left text */}
          <motion.div
            {...fadeIn}
            className="absolute bottom-12 left-6 sm:bottom-16 sm:left-10 md:bottom-20 md:left-16 lg:left-20 max-w-2xl"
          >
            <p className="text-sm font-medium text-primary mb-4 uppercase tracking-wide">
              For Gamers · Communities · Teams · Everyone
            </p>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold text-white leading-[1.1] mb-6">
              Where conversations
              <br />
              belong to you.
            </h1>
            <p className="text-lg sm:text-xl text-white/80 mb-8 leading-relaxed max-w-xl">
              A space for your community to connect, create, and grow together—without ads, tracking, or compromise.
            </p>
            <Link to="/app">
              <Button size="lg" className="h-12 px-8 text-base">
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
