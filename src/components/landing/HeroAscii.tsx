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
    <section className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
      <motion.div initial="initial" animate="animate" className="max-w-[1800px] mx-auto">
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl">
          {/* Image */}
          <img
            src="https://images.pexels.com/photos/30626449/pexels-photo-30626449.jpeg"
            alt="Kloak hero"
            className="w-full h-[60vh] sm:h-[70vh] md:h-[80vh] lg:h-[85vh] xl:h-[90vh] object-cover"
            loading="lazy"
          />

          {/* Gradient overlay - stronger on mobile for better text readability */}
          <div className="absolute inset-0 pointer-events-none" />

          {/* Content container */}
          <motion.div {...fadeIn} className="absolute inset-x-0 bottom-0 p-5 sm:p-8 md:p-10 lg:p-14 xl:p-16">
            <div className="max-w-3xl">
              {/* Tagline */}
              <p className="landing-body text-white/80 mb-2 sm:mb-3 md:mb-4 text-xs sm:text-sm">
                For Gamers · Communities · Teams · Everyone
              </p>

              {/* Headline */}
              <h1 className="landing-hero-title text-white mb-3 sm:mb-4 md:mb-6">
                Where conversations
                <br className="hidden sm:block" />
                <span className="sm:hidden"> </span>
                belong to you.
              </h1>

              {/* Description */}
              <p className="landing-body text-white/80 mb-4 sm:mb-6 md:mb-8 max-w-xl text-sm sm:text-base">
                A space for your community to connect, create, and grow together—without ads, tracking, or compromise.
              </p>

              {/* CTA Button */}
              <Link to="/app">
                <Button
                  size="lg"
                  className="h-10 sm:h-11 md:h-12 px-5 sm:px-6 md:px-8 text-sm sm:text-base rounded-xl uppercase font-semibold tracking-wider"
                >
                  Join Kloak
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
};

export default HeroImage;
