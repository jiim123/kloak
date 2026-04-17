import { ArrowRight, Link as LinkIcon } from "@phosphor-icons/react";
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

import { Button } from '@/components/ui/button';

const fadeInUp = {
 initial: { opacity: 0, y: 20 },
 animate: { opacity: 1, y: 0 },
 transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
};

const stagger = {
 animate: {
 transition: {
 staggerChildren: 0.15
 }
 }
};

export const HeroClassic = () => {
 return (
 <section className="flex-1 flex items-center px-6 py-32">
 <motion.div 
 className="max-w-6xl mx-auto w-full"
 initial="initial"
 animate="animate"
 variants={stagger}
 >
 <motion.p 
 variants={fadeInUp}
 className="text-primary font-medium mb-6 tracking-wide text-sm uppercase"
 >
 No email. No password. No tracking.
 </motion.p>
 
 <motion.h1 
 variants={fadeInUp}
 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-medium text-foreground mb-8 leading-[0.95] tracking-tight max-w-4xl"
 >
 Your chat.
 <br />
 Your key.
 </motion.h1>
 
 <motion.p 
 variants={fadeInUp}
 className="text-xl text-muted-foreground max-w-xl mb-12 leading-relaxed"
 >
 One cryptographic key. That's it. No accounts, no data harvesting, no corporate surveillance. 
 Just you and your conversations.
 </motion.p>
 
 <motion.div variants={fadeInUp}>
 <LinkIcon to="/app">
 <Button size="lg" className="text-base px-8 h-12">
 Create Your Key
 <ArrowRight className="w-5 h-5 ml-2" />
 </Button>
 </LinkIcon>
 </motion.div>
 </motion.div>
 </section>
 );
};

export default HeroClassic;
