import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export const HeroImage = () => {
  return (
    <section className="relative min-h-screen bg-background overflow-hidden">
      {/* Two Column Layout */}
      <div className="relative z-10 w-full min-h-screen">
        <div className="grid md:grid-cols-2 min-h-screen">
          {/* LEFT COLUMN - Text & CTA */}
          <div className="flex items-center justify-center px-6 sm:px-10 lg:px-16 py-20 md:py-0 order-2 md:order-1">
            <motion.div initial="initial" animate="animate" className="max-w-xl">
              {/* Tagline */}
              <motion.p
                variants={fadeIn}
                transition={{ duration: 0.5, delay: 0 }}
                className="landing-body text-muted-foreground mb-4 text-sm"
              >
                For Gamers · Communities · Teams · Everyone
              </motion.p>

              {/* Headline */}
              <motion.h1
                variants={fadeIn}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="landing-hero-title text-foreground mb-6"
              >
                Where conversations
                <br />
                <span className="text-primary">belong to you.</span>
              </motion.h1>

              {/* Description */}
              <motion.p
                variants={fadeIn}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="landing-body text-muted-foreground mb-8 text-base sm:text-lg"
              >
                A space for your community to connect, create, and grow together—without ads, tracking, or compromise.
              </motion.p>

              {/* CTA Button */}
              <motion.div variants={fadeIn} transition={{ duration: 0.5, delay: 0.3 }}>
                <Link to="/app">
                  <Button
                    size="lg"
                    className="h-12 px-8 text-base rounded-xl uppercase font-semibold tracking-wider group"
                  >
                    Join Kloak
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </motion.div>

              {/* Trust line */}
              <motion.p
                variants={fadeIn}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="mt-8 text-sm text-muted-foreground"
              >
                No credit card required • Free forever • Your data stays yours
              </motion.p>
            </motion.div>
          </div>

          {/* RIGHT COLUMN - Image */}
          <div className="relative flex items-center justify-center p-6 md:p-10 lg:p-12 order-1 md:order-2">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative w-full h-full min-h-[300px] md:min-h-[500px] lg:min-h-[600px]"
            >
              {/* Image container with rounded corners */}
              <div className="relative w-full h-full rounded-2xl lg:rounded-3xl overflow-hidden shadow-2xl">
                <img
                  src="https://images.pexels.com/photos/30626449/pexels-photo-30626449.jpeg"
                  alt="Kloak hero"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {/* Subtle gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroImage;
