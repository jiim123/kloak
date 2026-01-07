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
      <section className="py-32 px-6 border-t border-border/20">
        <div className="max-w-6xl mx-auto">
          <motion.div 
            className="grid lg:grid-cols-2 gap-16 items-start"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div>
              <p className="text-primary font-medium mb-4 tracking-wide text-sm uppercase">The Problem</p>
              <h2 className="text-4xl sm:text-5xl font-semibold text-foreground leading-tight tracking-tight">
                Every message you send is monetized.
              </h2>
            </div>
            <div className="space-y-6 text-lg text-muted-foreground leading-relaxed">
              <p>
                Most platforms treat your conversations as inventory. Your words become data points. 
                Your relationships become ad targets. Your private moments become profit.
              </p>
              <p>
                We built Kloak because we believe communication is a human right — not a business model.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="py-32 px-6 bg-card/50 border-y border-border/20">
        <div className="max-w-6xl mx-auto">
          <motion.div 
            className="mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-primary font-medium mb-4 tracking-wide text-sm uppercase">The Difference</p>
            <h2 className="text-4xl sm:text-5xl font-semibold text-foreground leading-tight tracking-tight max-w-3xl">
              What they collect. What we don't.
            </h2>
          </motion.div>

          <motion.div 
            className="rounded-lg border border-border/30 overflow-hidden bg-background"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Table>
              <TableHeader>
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead className="text-muted-foreground font-medium w-[50%]">Feature</TableHead>
                  <TableHead className="text-center text-muted-foreground font-medium uppercase tracking-wide text-sm">Others</TableHead>
                  <TableHead className="text-center text-primary font-medium uppercase tracking-wide text-sm">Kloak</TableHead>
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

          <motion.p 
            className="text-center text-muted-foreground mt-12 text-lg"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            The less we know about you, the less anyone can take.
          </motion.p>
        </div>
      </section>

      {/* Principles Section */}
      <section className="py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div 
            className="mb-20"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-primary font-medium mb-4 tracking-wide text-sm uppercase">Our Principles</p>
            <h2 className="text-4xl sm:text-5xl font-semibold text-foreground leading-tight tracking-tight max-w-2xl">
              Privacy isn't a feature. It's the architecture.
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-x-16 gap-y-20">
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
                className="group"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <span className="text-5xl font-semibold text-border/60 group-hover:text-primary/40 transition-colors duration-300">
                  {principle.number}
                </span>
                <h3 className="text-2xl font-semibold text-foreground mt-4 mb-3 tracking-tight">
                  {principle.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {principle.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Capabilities Section - Bold Creative Layout */}
      <section className="py-32 px-6 bg-card/50 border-y border-border/20 overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <motion.div 
            className="mb-24"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-primary font-medium mb-4 tracking-wide text-sm uppercase">Capabilities</p>
            <h2 className="text-4xl sm:text-5xl font-semibold text-foreground leading-tight tracking-tight max-w-2xl">
              Full-featured. Zero compromise.
            </h2>
          </motion.div>

          {/* Large Feature Grid */}
          <div className="grid lg:grid-cols-12 gap-6">
            {/* Main Feature - Large */}
            <motion.div
              className="lg:col-span-7 bg-background border border-border/30 rounded-lg p-10 relative group overflow-hidden"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/10 transition-colors duration-500" />
              <div className="flex items-center gap-4 mb-4">
                <MessageCircle className="w-8 h-8 text-primary shrink-0" />
                <h3 className="text-3xl sm:text-4xl font-semibold text-foreground tracking-tight">
                  Real-time messaging
                </h3>
              </div>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-md">
                Instant message delivery across servers, channels, and direct conversations. 
                Built for speed without sacrificing privacy.
              </p>
            </motion.div>

            {/* Secondary Feature */}
            <motion.div
              className="lg:col-span-5 bg-background border border-border/30 rounded-lg p-10 relative group overflow-hidden"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 group-hover:bg-primary/10 transition-colors duration-500" />
              <div className="flex items-center gap-3 mb-4">
                <Lock className="w-7 h-7 text-primary shrink-0" />
                <h3 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
                  Key-based auth
                </h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                One cryptographic key. Full control. No password managers, no recovery emails, no vulnerabilities.
              </p>
            </motion.div>

            {/* Third Feature */}
            <motion.div
              className="lg:col-span-5 bg-background border border-border/30 rounded-lg p-10 relative group overflow-hidden"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="absolute top-0 left-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2 group-hover:bg-primary/10 transition-colors duration-500" />
              <div className="flex items-center gap-3 mb-4">
                <Users className="w-7 h-7 text-primary shrink-0" />
                <h3 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
                  Communities
                </h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Create spaces for your people. Organize with servers, channels, and categories — your way.
              </p>
            </motion.div>

            {/* Fourth Feature - Large */}
            <motion.div
              className="lg:col-span-7 bg-background border border-border/30 rounded-lg p-10 relative group overflow-hidden"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <div className="absolute bottom-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl translate-y-1/2 translate-x-1/2 group-hover:bg-primary/10 transition-colors duration-500" />
              <div className="flex items-center gap-4 mb-4">
                <Zap className="w-8 h-8 text-primary shrink-0" />
                <h3 className="text-3xl sm:text-4xl font-semibold text-foreground tracking-tight">
                  Modern infrastructure
                </h3>
              </div>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-md">
                Built on a modern tech stack for performance and reliability. 
                Fast, responsive, and built to scale with you.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* For Everyone Section */}
      <section className="py-32 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <motion.div 
            className="text-center mb-20"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-primary font-medium mb-4 tracking-wide text-sm uppercase">For Everyone</p>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-foreground leading-tight tracking-tight mb-6 max-w-4xl mx-auto">
              Free speech starts with free infrastructure.
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              No premium tiers that unlock privacy features. No enterprise-only security. 
              Everyone gets everything.
            </p>
          </motion.div>

          {/* Cards Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { 
                title: "Activists & Organizers", 
                description: "Coordinate movements without surveillance. Your cause, your privacy.",
                icon: "megaphone",
                gradient: "from-rose-500/20 to-orange-500/20"
              },
              { 
                title: "Creative Communities", 
                description: "Share your art, music, and ideas in spaces you control.",
                icon: "palette",
                gradient: "from-violet-500/20 to-purple-500/20"
              },
              { 
                title: "Gaming Groups", 
                description: "Voice chat, strategy sessions, and guild coordination — lag-free.",
                icon: "gamepad",
                gradient: "from-emerald-500/20 to-teal-500/20"
              },
              { 
                title: "Small Businesses", 
                description: "Team communication without Big Tech reading your roadmap.",
                icon: "briefcase",
                gradient: "from-blue-500/20 to-cyan-500/20"
              },
              { 
                title: "Friends & Family", 
                description: "Private group chats that stay private. Period.",
                icon: "heart",
                gradient: "from-pink-500/20 to-rose-500/20"
              },
              { 
                title: "Privacy Advocates", 
                description: "Finally, a platform that practices what it preaches.",
                icon: "shield",
                gradient: "from-amber-500/20 to-yellow-500/20"
              },
            ].map((card, index) => (
              <motion.div
                key={card.title}
                className="group relative bg-card/50 border border-border/30 rounded-2xl p-8 overflow-hidden hover:border-primary/30 transition-colors duration-300"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -4 }}
              >
                {/* Gradient background */}
                <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                
                {/* Animated icon */}
                <motion.div 
                  className="relative mb-6"
                  whileHover={{ rotate: [0, -10, 10, -5, 0] }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors duration-300">
                    {card.icon === "megaphone" && (
                      <motion.svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-primary"
                      >
                        <path d="m3 11 18-5v12L3 13v-2z"/>
                        <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>
                      </motion.svg>
                    )}
                    {card.icon === "palette" && (
                      <motion.svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-primary"
                      >
                        <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
                        <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
                        <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
                        <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
                        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z"/>
                      </motion.svg>
                    )}
                    {card.icon === "gamepad" && (
                      <motion.svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-primary"
                      >
                        <line x1="6" x2="10" y1="12" y2="12"/>
                        <line x1="8" x2="8" y1="10" y2="14"/>
                        <line x1="15" x2="15.01" y1="13" y2="13"/>
                        <line x1="18" x2="18.01" y1="11" y2="11"/>
                        <rect width="20" height="12" x="2" y="6" rx="2"/>
                      </motion.svg>
                    )}
                    {card.icon === "briefcase" && (
                      <motion.svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-primary"
                      >
                        <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                        <rect width="20" height="14" x="2" y="6" rx="2"/>
                      </motion.svg>
                    )}
                    {card.icon === "heart" && (
                      <motion.svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-primary"
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
                      >
                        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                      </motion.svg>
                    )}
                    {card.icon === "shield" && (
                      <Shield className="w-7 h-7 text-primary" />
                    )}
                  </div>
                </motion.div>

                {/* Content */}
                <div className="relative">
                  <h3 className="text-xl font-semibold text-foreground mb-2 tracking-tight">
                    {card.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {card.description}
                  </p>
                </div>

                {/* Decorative corner */}
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-primary/5 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-6 bg-card/50 border-t border-border/20">
        <motion.div 
          className="max-w-3xl mx-auto text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <Shield className="w-12 h-12 text-primary mx-auto mb-8" />
          <h2 className="text-4xl sm:text-5xl font-semibold text-foreground mb-6 tracking-tight">
            Take back your privacy.
          </h2>
          <p className="text-xl text-muted-foreground mb-10 max-w-lg mx-auto">
            No signup forms. No verification emails. Generate your key and start communicating freely.
          </p>
          <Link to="/auth">
            <Button size="lg" className="text-base px-10 h-12">
              <Key className="w-5 h-5 mr-2" />
              Get Started
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Index;
