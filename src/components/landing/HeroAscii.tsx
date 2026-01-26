import { Link } from "react-router-dom";
import { LayoutGroup, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import TextRotate from "@/components/fancy/text/text-rotate";

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export const HeroImage = () => {
  return (
    <section className="relative min-h-screen overflow-hidden">
      {/* Soft gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
      <div className="absolute inset-0 bg-gradient-to-t from-primary/3 via-transparent to-transparent" />
      
      {/* Centered single column content */}
      <div className="relative z-10 w-full min-h-screen flex items-center justify-center px-6 py-20">
        <motion.div initial="initial" animate="animate" className="max-w-4xl text-center">
          {/* Tagline */}
          <motion.p
            variants={fadeIn}
            transition={{ duration: 0.5, delay: 0 }}
            className="landing-body text-muted-foreground mb-6 text-sm"
          >
            For Gamers · Communities · Teams · Everyone
          </motion.p>

          {/* Headline with TextRotate */}
          <motion.div variants={fadeIn} transition={{ duration: 0.5, delay: 0.1 }} className="mb-8">
            <LayoutGroup>
              <motion.div
                className="flex flex-wrap items-center justify-center text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-normal"
                layout
              >
                <motion.span
                  className="text-foreground mr-2 sm:mr-3"
                  layout
                  transition={{ type: "spring", damping: 30, stiffness: 400 }}
                >
                  YOUR
                </motion.span>
                <TextRotate
                  texts={["OPINION.", "MESSAGE.", "REACTION 👋😄🤷.", "PRIVACY.", "COMMUNITY.", "FRIENDS."]}
                  mainClassName="text-background px-2 sm:px-3 bg-white overflow-hidden py-1 sm:py-1.5 justify-center rounded-lg"
                  staggerFrom="last"
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "-120%" }}
                  staggerDuration={0.025}
                  splitLevelClassName="overflow-hidden pb-0.5 sm:pb-1"
                  transition={{ type: "spring", damping: 30, stiffness: 400 }}
                  rotationInterval={3000}
                />
              </motion.div>
            </LayoutGroup>
          </motion.div>

          {/* Description */}
          <motion.p
            variants={fadeIn}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="landing-body text-muted-foreground mb-10 text-base sm:text-lg md:text-xl max-w-xl mx-auto"
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
            className="mt-10 text-sm text-muted-foreground"
          >
            No credit card required • Free forever • Your data stays yours
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroImage;
