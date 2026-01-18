import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const fadeIn = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
};

export const HeroSimple = () => {
  return (
    <section className="flex-1 flex items-center px-6 py-28 sm:py-32">
      <motion.div className="max-w-5xl mx-auto w-full" initial="initial" animate="animate">
        {/* Eyebrow */}
        <motion.p {...fadeIn} className="text-sm font-medium text-primary tracking-wide uppercase mb-6">
          No email · No password · No tracking
        </motion.p>

        {/* Headline */}
        <motion.h1
          {...fadeIn}
          transition={{ ...fadeIn.transition, delay: 0.05 }}
          className="text-5xl sm:text-6xl md:text-7xl font-semibold text-foreground leading-[0.95] tracking-tight max-w-4xl mb-8"
        >
          Your chat.
          <br />
          Your key.
        </motion.h1>

        {/* Description */}
        <motion.p
          {...fadeIn}
          transition={{ ...fadeIn.transition, delay: 0.1 }}
          className="text-lg sm:text-xl text-muted-foreground max-w-xl leading-relaxed mb-12"
        >
          One cryptographic key. No accounts, no data harvesting, no surveillance. Just you and your conversations.
        </motion.p>

        {/* Action */}
        <motion.div {...fadeIn} transition={{ ...fadeIn.transition, delay: 0.15 }}>
          <Link to="/app">
            <Button size="lg" className="px-8 h-12 text-base">
              Create your key
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
};

export default HeroSimple;
