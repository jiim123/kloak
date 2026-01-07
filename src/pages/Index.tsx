import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Shield, 
  ArrowRight,
  Key,
  MessageCircle,
  Users,
  Zap,
  Lock,
  X,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/ui/footer-section';
import { NavigationMenu } from '@/components/layout/NavigationMenu';
import HeroAscii from '@/components/landing/HeroAscii';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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

const Index = () => {
  const comparisonData = [
    { label: "Email required", others: true, kloak: false },
    { label: "Phone number required", others: true, kloak: false },
    { label: "Password stored on servers", others: true, kloak: false },
    { label: "Behavioral tracking", others: true, kloak: false },
    { label: "Data sold to advertisers", others: true, kloak: false },
    { label: "AI trained on your messages", others: true, kloak: false },
    { label: "Account recovery by platform", others: true, kloak: false },
    { label: "You control your identity", others: false, kloak: true },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <NavigationMenu />

      {/* Hero Section */}
      <HeroAscii />

      {/* The Problem Section */}
      <section className="relative py-32 px-6 border-t border-border/20 overflow-hidden">
        {/* Corner Frame Accents */}
        <div className="absolute top-4 left-4 w-8 h-8 border-l border-t border-primary/20" />
        <div className="absolute top-4 right-4 w-8 h-8 border-r border-t border-primary/20" />
        <div className="absolute bottom-4 left-4 w-8 h-8 border-l border-b border-primary/20" />
        <div className="absolute bottom-4 right-4 w-8 h-8 border-r border-b border-primary/20" />
        
        <div className="max-w-6xl mx-auto">
          <motion.div 
            className="grid lg:grid-cols-2 gap-16 items-start"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div>
              {/* Section header with ASCII style */}
              <div className="flex items-center gap-4 mb-4">
                <span className="text-xs font-mono text-primary/70">002</span>
                <div className="w-8 h-px bg-gradient-to-r from-primary/50 to-transparent" />
                <span className="text-xs font-mono text-primary tracking-widest uppercase">The Problem</span>
              </div>
              <div className="flex items-start gap-4">
                <div className="hidden md:block w-px h-20 bg-gradient-to-b from-primary/50 to-transparent" />
                <h2 className="text-4xl sm:text-5xl font-semibold text-foreground leading-tight tracking-tight">
                  Every message you send is <span className="text-primary">monetized.</span>
                </h2>
              </div>
            </div>
            <div className="relative">
              <div className="space-y-6 text-lg text-muted-foreground leading-relaxed">
                <p>
                  Most platforms treat your conversations as inventory. Your words become data points. 
                  Your relationships become ad targets. Your private moments become profit.
                </p>
                <p>
                  We built Kloak because we believe communication is a human right — not a business model.
                </p>
              </div>
              {/* Technical corner accent */}
              <div className="hidden md:block absolute -right-4 bottom-0 text-[8px] font-mono text-primary/40">
                <div className="border-l border-primary/20 pl-2">
                  ◇ DATA.EXPLOITATION
                </div>
              </div>
            </div>
          </motion.div>
          
          {/* Bottom technical notation */}
          <div className="hidden md:flex items-center gap-4 mt-12 text-xs font-mono text-muted-foreground/50">
            <div className="flex gap-0.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="w-1 h-2 bg-primary/20" />
              ))}
            </div>
            <span>PRIVACY.VIOLATED</span>
            <div className="w-16 h-px bg-gradient-to-r from-primary/20 to-transparent" />
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="relative py-32 px-6 bg-card/50 border-y border-border/20 overflow-hidden">
        {/* Corner Frame Accents */}
        <div className="absolute top-4 left-4 w-8 h-8 border-l border-t border-primary/20" />
        <div className="absolute top-4 right-4 w-8 h-8 border-r border-t border-primary/20" />
        <div className="absolute bottom-4 left-4 w-8 h-8 border-l border-b border-primary/20" />
        <div className="absolute bottom-4 right-4 w-8 h-8 border-r border-b border-primary/20" />
        
        <div className="max-w-6xl mx-auto">
          <motion.div 
            className="mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {/* Section header with ASCII style */}
            <div className="flex items-center gap-4 mb-4">
              <span className="text-xs font-mono text-primary/70">003</span>
              <div className="w-8 h-px bg-gradient-to-r from-primary/50 to-transparent" />
              <span className="text-xs font-mono text-primary tracking-widest uppercase">The Difference</span>
            </div>
            <div className="flex items-start gap-4">
              <div className="hidden md:block w-px h-20 bg-gradient-to-b from-primary/50 to-transparent" />
              <h2 className="text-4xl sm:text-5xl font-semibold text-foreground leading-tight tracking-tight max-w-3xl">
                What they collect. <span className="text-primary">What we don't.</span>
              </h2>
            </div>
          </motion.div>

          <motion.div 
            className="rounded-lg border border-border/30 overflow-hidden bg-background relative"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {/* Table corner accents */}
            <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-primary/30" />
            <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-primary/30" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 border-primary/30" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-primary/30" />
            
            <Table>
              <TableHeader>
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead className="text-muted-foreground font-mono text-xs tracking-wider w-[50%]">FEATURE</TableHead>
                  <TableHead className="text-center text-muted-foreground font-mono text-xs tracking-wider uppercase">OTHERS</TableHead>
                  <TableHead className="text-center text-primary font-mono text-xs tracking-wider uppercase">KLOAK</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparisonData.map((row, index) => (
                  <motion.tr
                    key={row.label}
                    className="border-border/20 transition-colors hover:bg-muted/30"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                  >
                    <TableCell className="font-medium text-foreground">{row.label}</TableCell>
                    <TableCell className="text-center">
                      {row.others ? (
                        <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                          <Check className="w-4 h-4 text-destructive" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center mx-auto">
                          <X className="w-4 h-4 text-muted-foreground/50" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.kloak ? (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                          <Check className="w-4 h-4 text-primary" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                          <X className="w-4 h-4 text-primary" />
                        </div>
                      )}
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </motion.div>

          <motion.div 
            className="flex flex-col md:flex-row items-center justify-center gap-4 mt-12"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <div className="hidden md:flex gap-0.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="w-1 h-2 bg-primary/30" />
              ))}
            </div>
            <p className="text-center text-muted-foreground text-lg font-mono">
              The less we know about you, the less anyone can take.
            </p>
            <div className="hidden md:flex gap-0.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="w-1 h-2 bg-primary/30" />
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Principles Section */}
      <section className="relative py-32 px-6 overflow-hidden">
        {/* Corner Frame Accents */}
        <div className="absolute top-4 left-4 w-8 h-8 border-l border-t border-primary/20" />
        <div className="absolute top-4 right-4 w-8 h-8 border-r border-t border-primary/20" />
        <div className="absolute bottom-4 left-4 w-8 h-8 border-l border-b border-primary/20" />
        <div className="absolute bottom-4 right-4 w-8 h-8 border-r border-b border-primary/20" />
        
        {/* Background grid pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        
        <div className="max-w-6xl mx-auto relative">
          <motion.div 
            className="mb-20"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {/* Section header with ASCII style */}
            <div className="flex items-center gap-4 mb-4">
              <span className="text-xs font-mono text-primary/70">004</span>
              <div className="w-8 h-px bg-gradient-to-r from-primary/50 to-transparent" />
              <span className="text-xs font-mono text-primary tracking-widest uppercase">Our Principles</span>
            </div>
            <div className="flex items-start gap-4">
              <div className="hidden md:block w-px h-20 bg-gradient-to-b from-primary/50 to-transparent" />
              <h2 className="text-4xl sm:text-5xl font-semibold text-foreground leading-tight tracking-tight max-w-2xl">
                Privacy isn't a feature. <span className="text-primary">It's the architecture.</span>
              </h2>
            </div>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-x-16 gap-y-16">
            {[
              {
                number: "01",
                title: "Zero data collection",
                description: "We don't ask for your email, phone number, or identity. We collect only what's essential for the app to function. Nothing more."
              },
              {
                number: "02",
                title: "Cryptographic keys, not passwords",
                description: "Your account is secured by a 64-character key that only you possess. We can't recover it. We can't reset it. We can't access it."
              },
              {
                number: "03",
                title: "No ads, no tracking, no profiling",
                description: "We will never monetize your data. There are no analytics tracking your behavior. No pixels. No fingerprinting. No exceptions."
              },
              {
                number: "04",
                title: "Open architecture",
                description: "Our approach is transparent. We tell you exactly what we do and don't do. There's no fine print designed to confuse you."
              }
            ].map((principle, index) => (
              <motion.div
                key={principle.number}
                className="group relative"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                {/* Card with ASCII styling */}
                <div className="relative border border-border/20 p-8 bg-card/30 hover:border-primary/30 transition-colors duration-300">
                  {/* Corner accents */}
                  <div className="absolute top-0 left-0 w-3 h-3 border-l border-t border-primary/40" />
                  <div className="absolute top-0 right-0 w-3 h-3 border-r border-t border-primary/40" />
                  <div className="absolute bottom-0 left-0 w-3 h-3 border-l border-b border-primary/40" />
                  <div className="absolute bottom-0 right-0 w-3 h-3 border-r border-b border-primary/40" />
                  
                  <div className="flex items-start gap-4">
                    <span className="text-4xl font-mono font-semibold text-primary/40 group-hover:text-primary/60 transition-colors duration-300">
                      {principle.number}
                    </span>
                    <div className="w-px h-12 bg-gradient-to-b from-primary/30 to-transparent" />
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-foreground mb-3 tracking-tight uppercase">
                        {principle.title}
                      </h3>
                      <p className="text-muted-foreground leading-relaxed text-sm">
                        {principle.description}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          
          {/* Bottom technical notation */}
          <div className="hidden md:flex items-center justify-center gap-4 mt-16 text-xs font-mono text-muted-foreground/50">
            <span>◇</span>
            <div className="w-16 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            <span>CORE.VALUES</span>
            <div className="w-16 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            <span>◇</span>
          </div>
        </div>
      </section>

      {/* Capabilities Section */}
      <section className="relative py-32 px-6 bg-card/50 border-y border-border/20 overflow-hidden">
        {/* Corner Frame Accents */}
        <div className="absolute top-4 left-4 w-8 h-8 border-l border-t border-primary/20" />
        <div className="absolute top-4 right-4 w-8 h-8 border-r border-t border-primary/20" />
        <div className="absolute bottom-4 left-4 w-8 h-8 border-l border-b border-primary/20" />
        <div className="absolute bottom-4 right-4 w-8 h-8 border-r border-b border-primary/20" />
        
        <div className="max-w-6xl mx-auto">
          <motion.div 
            className="mb-20"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {/* Section header with ASCII style */}
            <div className="flex items-center gap-4 mb-4">
              <span className="text-xs font-mono text-primary/70">005</span>
              <div className="w-8 h-px bg-gradient-to-r from-primary/50 to-transparent" />
              <span className="text-xs font-mono text-primary tracking-widest uppercase">Capabilities</span>
            </div>
            <div className="flex items-start gap-4">
              <div className="hidden md:block w-px h-20 bg-gradient-to-b from-primary/50 to-transparent" />
              <h2 className="text-4xl sm:text-5xl font-semibold text-foreground leading-tight tracking-tight max-w-2xl">
                Full-featured. <span className="text-primary">Zero compromise.</span>
              </h2>
            </div>
          </motion.div>

          {/* Feature Grid with ASCII styling */}
          <div className="grid lg:grid-cols-12 gap-6">
            {/* Main Feature - Large */}
            <motion.div
              className="lg:col-span-7 relative border border-border/30 p-10 group overflow-hidden bg-background"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-primary/40" />
              <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-primary/40" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 border-primary/40" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-primary/40" />
              
              <div className="flex items-center gap-4 mb-4">
                <MessageCircle className="w-8 h-8 text-primary shrink-0" />
                <h3 className="text-3xl sm:text-4xl font-semibold text-foreground tracking-tight uppercase">
                  Real-time messaging
                </h3>
              </div>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-md">
                Instant message delivery across servers, channels, and direct conversations. 
                Built for speed without sacrificing privacy.
              </p>
              <div className="absolute bottom-4 right-4 text-[8px] font-mono text-primary/40">MSG.001</div>
            </motion.div>

            {/* Secondary Feature */}
            <motion.div
              className="lg:col-span-5 relative border border-border/30 p-10 group overflow-hidden bg-background"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-primary/40" />
              <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-primary/40" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 border-primary/40" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-primary/40" />
              
              <div className="flex items-center gap-3 mb-4">
                <Lock className="w-7 h-7 text-primary shrink-0" />
                <h3 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight uppercase">
                  Key-based auth
                </h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                One cryptographic key. Full control. No password managers, no recovery emails, no vulnerabilities.
              </p>
              <div className="absolute bottom-4 right-4 text-[8px] font-mono text-primary/40">AUTH.002</div>
            </motion.div>

            {/* Third Feature */}
            <motion.div
              className="lg:col-span-5 relative border border-border/30 p-10 group overflow-hidden bg-background"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-primary/40" />
              <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-primary/40" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 border-primary/40" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-primary/40" />
              
              <div className="flex items-center gap-3 mb-4">
                <Users className="w-7 h-7 text-primary shrink-0" />
                <h3 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight uppercase">
                  Communities
                </h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Create spaces for your people. Organize with servers, channels, and categories — your way.
              </p>
              <div className="absolute bottom-4 right-4 text-[8px] font-mono text-primary/40">COMM.003</div>
            </motion.div>

            {/* Fourth Feature - Large */}
            <motion.div
              className="lg:col-span-7 relative border border-border/30 p-10 group overflow-hidden bg-background"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-primary/40" />
              <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-primary/40" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 border-primary/40" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-primary/40" />
              
              <div className="flex items-center gap-4 mb-4">
                <Zap className="w-8 h-8 text-primary shrink-0" />
                <h3 className="text-3xl sm:text-4xl font-semibold text-foreground tracking-tight uppercase">
                  Modern infrastructure
                </h3>
              </div>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-md">
                Built on a modern tech stack for performance and reliability. 
                Fast, responsive, and built to scale with you.
              </p>
              <div className="absolute bottom-4 right-4 text-[8px] font-mono text-primary/40">INFRA.004</div>
            </motion.div>
          </div>
          
          {/* Bottom technical notation */}
          <div className="hidden md:flex items-center gap-4 mt-12 text-xs font-mono text-muted-foreground/50">
            <div className="flex gap-0.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="w-1 h-3 bg-primary/20" style={{ opacity: 0.2 + (i * 0.1) }} />
              ))}
            </div>
            <span>FEATURES.LOADED</span>
            <div className="w-16 h-px bg-gradient-to-r from-primary/30 to-transparent" />
            <span>∞</span>
          </div>
        </div>
      </section>

      {/* For Everyone Section */}
      <section className="relative py-32 px-6 overflow-hidden">
        {/* Corner Frame Accents */}
        <div className="absolute top-4 left-4 w-8 h-8 border-l border-t border-primary/20" />
        <div className="absolute top-4 right-4 w-8 h-8 border-r border-t border-primary/20" />
        <div className="absolute bottom-4 left-4 w-8 h-8 border-l border-b border-primary/20" />
        <div className="absolute bottom-4 right-4 w-8 h-8 border-r border-b border-primary/20" />
        
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <motion.div 
            className="text-center mb-20"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {/* Section header with ASCII style */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="w-12 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              <span className="text-xs font-mono text-primary/70">006</span>
              <div className="w-8 h-px bg-gradient-to-r from-primary/50 to-transparent" />
              <span className="text-xs font-mono text-primary tracking-widest uppercase">For Everyone</span>
              <div className="w-8 h-px bg-gradient-to-l from-primary/50 to-transparent" />
              <span className="text-xs font-mono text-primary/70">◇</span>
              <div className="w-12 h-px bg-gradient-to-l from-transparent via-primary/50 to-transparent" />
            </div>
            
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-foreground leading-tight tracking-tight mb-6 max-w-4xl mx-auto">
              Free speech starts with <span className="text-primary">free infrastructure.</span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              No premium tiers that unlock privacy features. No enterprise-only security. 
              Everyone gets everything.
            </p>
          </motion.div>

          {/* Cards Grid with ASCII styling */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { 
                title: "Activists & Organizers", 
                description: "Coordinate movements without surveillance. Your cause, your privacy.",
                icon: "megaphone",
                code: "ACT.001"
              },
              { 
                title: "Creative Communities", 
                description: "Share your art, music, and ideas in spaces you control.",
                icon: "palette",
                code: "CRT.002"
              },
              { 
                title: "Gaming Groups", 
                description: "Voice chat, strategy sessions, and guild coordination — lag-free.",
                icon: "gamepad",
                code: "GMR.003"
              },
              { 
                title: "Small Businesses", 
                description: "Team communication without Big Tech reading your roadmap.",
                icon: "briefcase",
                code: "BIZ.004"
              },
              { 
                title: "Friends & Family", 
                description: "Private group chats that stay private. Period.",
                icon: "heart",
                code: "FAM.005"
              },
              { 
                title: "Privacy Advocates", 
                description: "Finally, a platform that practices what it preaches.",
                icon: "shield",
                code: "PRV.006"
              },
            ].map((card, index) => (
              <motion.div
                key={card.title}
                className="group relative border border-border/30 p-8 overflow-hidden hover:border-primary/40 transition-colors duration-300 bg-card/30"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                {/* Corner accents */}
                <div className="absolute top-0 left-0 w-3 h-3 border-l border-t border-primary/30 group-hover:border-primary/50 transition-colors" />
                <div className="absolute top-0 right-0 w-3 h-3 border-r border-t border-primary/30 group-hover:border-primary/50 transition-colors" />
                <div className="absolute bottom-0 left-0 w-3 h-3 border-l border-b border-primary/30 group-hover:border-primary/50 transition-colors" />
                <div className="absolute bottom-0 right-0 w-3 h-3 border-r border-b border-primary/30 group-hover:border-primary/50 transition-colors" />
                
                {/* Icon */}
                <div className="relative mb-6">
                  <div className="w-14 h-14 border border-primary/30 flex items-center justify-center group-hover:border-primary/50 transition-colors duration-300">
                    {card.icon === "megaphone" && (
                      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                        <path d="m3 11 18-5v12L3 13v-2z"/>
                        <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>
                      </svg>
                    )}
                    {card.icon === "palette" && (
                      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                        <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
                        <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
                        <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
                        <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
                        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z"/>
                      </svg>
                    )}
                    {card.icon === "gamepad" && (
                      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                        <line x1="6" x2="10" y1="12" y2="12"/>
                        <line x1="8" x2="8" y1="10" y2="14"/>
                        <line x1="15" x2="15.01" y1="13" y2="13"/>
                        <line x1="18" x2="18.01" y1="11" y2="11"/>
                        <rect width="20" height="12" x="2" y="6" rx="2"/>
                      </svg>
                    )}
                    {card.icon === "briefcase" && (
                      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                        <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                        <rect width="20" height="14" x="2" y="6" rx="2"/>
                      </svg>
                    )}
                    {card.icon === "heart" && (
                      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                      </svg>
                    )}
                    {card.icon === "shield" && (
                      <Shield className="w-7 h-7 text-primary" />
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="relative">
                  <h3 className="text-lg font-semibold text-foreground mb-2 tracking-tight uppercase">
                    {card.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {card.description}
                  </p>
                </div>

                {/* Code notation */}
                <div className="absolute bottom-3 right-3 text-[8px] font-mono text-primary/40">
                  {card.code}
                </div>
              </motion.div>
            ))}
          </div>
          
          {/* Bottom technical notation */}
          <div className="hidden md:flex items-center justify-center gap-4 mt-16 text-xs font-mono text-muted-foreground/50">
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-primary/30" />
              <div className="w-2 h-2 rounded-full bg-primary/20" />
              <div className="w-2 h-2 rounded-full bg-primary/10" />
            </div>
            <span>ALL.USERS.WELCOME</span>
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-primary/10" />
              <div className="w-2 h-2 rounded-full bg-primary/20" />
              <div className="w-2 h-2 rounded-full bg-primary/30" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-32 px-6 bg-card/50 border-t border-border/20 overflow-hidden">
        {/* Corner Frame Accents */}
        <div className="absolute top-4 left-4 w-8 h-8 border-l border-t border-primary/30" />
        <div className="absolute top-4 right-4 w-8 h-8 border-r border-t border-primary/30" />
        <div className="absolute bottom-4 left-4 w-8 h-8 border-l border-b border-primary/30" />
        <div className="absolute bottom-4 right-4 w-8 h-8 border-r border-b border-primary/30" />
        
        <motion.div 
          className="max-w-3xl mx-auto text-center relative"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          {/* Section code */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="w-12 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            <span className="text-xs font-mono text-primary/70">007</span>
            <div className="w-12 h-px bg-gradient-to-l from-transparent via-primary/50 to-transparent" />
          </div>
          
          <div className="w-16 h-16 border border-primary/40 flex items-center justify-center mx-auto mb-8">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          
          <h2 className="text-4xl sm:text-5xl font-semibold text-foreground mb-6 tracking-tight uppercase">
            Take back your <span className="text-primary">privacy.</span>
          </h2>
          <p className="text-xl text-muted-foreground mb-10 max-w-lg mx-auto">
            No signup forms. No verification emails. Generate your key and start communicating freely.
          </p>
          
          <Link to="/auth">
            <button className="group relative px-10 py-4 bg-primary text-primary-foreground font-medium transition-all duration-300 hover:bg-primary/90 uppercase tracking-wider">
              <span className="absolute -top-px -left-px w-3 h-3 border-l border-t border-primary-foreground/30" />
              <span className="absolute -top-px -right-px w-3 h-3 border-r border-t border-primary-foreground/30" />
              <span className="absolute -bottom-px -left-px w-3 h-3 border-l border-b border-primary-foreground/30" />
              <span className="absolute -bottom-px -right-px w-3 h-3 border-r border-b border-primary-foreground/30" />
              <span className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Get Started
              </span>
            </button>
          </Link>
          
          {/* Bottom technical notation */}
          <div className="flex items-center justify-center gap-4 mt-12 text-xs font-mono text-muted-foreground/50">
            <span>◐ READY</span>
            <div className="flex gap-0.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="w-1 h-3 bg-primary/30 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
            <span>AWAITING.INPUT</span>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Index;
