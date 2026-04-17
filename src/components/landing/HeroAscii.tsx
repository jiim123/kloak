import { ArrowRight } from "@phosphor-icons/react";
import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import heroVideo from "@/assets/kloak-hero.mp4";

export const HeroImage = () => {
 const sectionRef = useRef<HTMLDivElement>(null);

 return (
 <section ref={sectionRef} className="relative overflow-hidden bg-[hsl(var(--neutral-0))]">
 {/* Background video */}
 <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover" src={heroVideo} />
 <div className="absolute inset-0 bg-background/60" />
 <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 sm:px-6">
 <div className="w-full max-w-4xl mx-auto text-center">
 {/* Main title */}
 <div className="mb-8">
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
 >
 <h1 className="text-[clamp(1.25rem,4vw,5rem)] font-medium tracking-tight text-foreground leading-[1.1]">
 For real humans and
 <br />
 real communities.
 </h1>
 </motion.div>
 </div>

 {/* CTA */}
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.6, delay: 1 }}
 className="flex flex-col sm:flex-row items-center justify-center gap-4"
 >
 <Link to="/app">
 <Button size="lg" className="px-8 h-12 text-sm font-normal group">
 Open Kloak
 <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
 </Button>
 </Link>
 <Link to="/about">
 <Button variant="secondary" size="lg" className="px-8 h-12 text-sm font-normal">
 About Kloak
 </Button>
 </Link>
 </motion.div>
 </div>
 </div>
 </section>
 );
};

export default HeroImage;
