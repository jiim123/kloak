import { Link } from "react-router-dom";
import { LayoutGroup, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import TextRotate from "@/components/fancy/text/text-rotate";
import { GrainGradient } from "@paper-design/shaders-react";

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export const HeroImage = () => {
  return (
    <section className="relative min-h-screen overflow-hidden">
      {/* Shader background */}
      <div className="absolute inset-0">
        <GrainGradient
          style={{ width: "100%", height: "100%" }}
          colors={["#424242"]}
          colorBack="#0f0f0f"
          softness={1}
          intensity={0.16}
          noise={0}
          shape="ripple"
          speed={0.9}
          scale={0.8}
        />
      </div>

      {/* Full width content */}
      <div className="relative z-10 w-full min-h-screen flex items-center justify-center px-6 py-20">
        <motion.div initial="initial" animate="animate" className="w-full text-center">
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
                className="flex flex-col items-center justify-center text-6xl sm:text-4xl md:text-5xl lg:text-6xl font-light"
                layout
              >
                <motion.span
                  className="text-foreground"
                  layout
                  transition={{ type: "spring", damping: 30, stiffness: 400 }}
                >
                  YOUR
                </motion.span>
                <TextRotate
                  texts={[
                    "OPINION 💭",
                    "MESSAGE 💬",
                    "REACTION 😚",
                    "COMMUNITY 👥",
                    "FRIENDS 💜",
                    "VOICE 🎙️",
                    "VIBE ✨",
                    "CHAOS 🌪️",
                    "DRAMA 🎭",
                    "RANT 🔥",
                    "SECRET 🤫",
                    "MEMES 😂",
                    "HOT TAKE 🌶️",
                    "GROUP CHAT 👯",
                    "DATA 🔐",
                  ]}
                  mainClassName="text-background px-2 sm:px-3 bg-white overflow-hidden py-1 sm:py-1.5 justify-center rounded-lg my-2 sm:my-3"
                  staggerFrom="last"
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "-120%" }}
                  staggerDuration={0.025}
                  splitLevelClassName="overflow-hidden pb-0.5 sm:pb-1"
                  transition={{ type: "spring", damping: 30, stiffness: 400 }}
                  rotationInterval={3000}
                />
                <motion.span
                  className="text-foreground font-light"
                  layout
                  transition={{ type: "spring", damping: 30, stiffness: 400 }}
                >
                  IS PRIVATE.
                </motion.span>
              </motion.div>
            </LayoutGroup>
          </motion.div>

          {/* Description */}
          <motion.p
            variants={fadeIn}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="landing-body text-muted-foreground mb-10 text-sm sm:text-sm md:text-sm max-w-sm mx-auto"
          >
            A space for your community to connect, create, and grow together—without ads, tracking, or compromise.
          </motion.p>

          {/* CTA Button */}
          <motion.div variants={fadeIn} transition={{ duration: 0.5, delay: 0.3 }}>
            <Link to="/app">
              <Button size="lg" rounded="xl" className="uppercase tracking-wider group">
                Join Kloak
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroImage;
