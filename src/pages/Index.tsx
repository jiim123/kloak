import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
  Menu,
  FileText,
  Heart,
  Cookie,
  ScrollText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/ui/footer-section';
import kloakLogo from '@/assets/kloak-logo.svg';

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
  const [menuOpen, setMenuOpen] = useState(false);

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

  const menuCategories = [
    {
      title: "Get Started",
      links: [
        { label: "Create Account", href: "/auth", icon: Key },
      ]
    },
    {
      title: "Company",
      links: [
        { label: "Philosophy", href: "/philosophy", icon: Heart },
      ]
    },
    {
      title: "Legal",
      links: [
        { label: "Terms of Service", href: "/terms", icon: ScrollText },
        { label: "Privacy Policy", href: "/privacy", icon: FileText },
        { label: "Cookie Policy", href: "/cookies", icon: Cookie },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navigation */}
      <nav className="w-full py-6 px-6 border-b border-border/20">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <img src={kloakLogo} alt="Kloak" className="h-7" />
          <button 
            onClick={() => setMenuOpen(true)}
            className="p-2 -mr-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Open menu"
          >
            <div className="flex flex-col gap-1.5">
              <div className="w-5 h-0.5 bg-current" />
              <div className="w-5 h-0.5 bg-current" />
            </div>
          </button>
        </div>
      </nav>

      {/* Menu Sidebar */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
            />
            
            {/* Sidebar */}
            <motion.div
              className="fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-card border-l border-border/30 z-50 flex flex-col"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              {/* Sidebar Header */}
              <div className="flex items-center justify-between p-6 border-b border-border/20">
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Menu</span>
                <button 
                  onClick={() => setMenuOpen(false)}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sidebar Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {menuCategories.map((category) => (
                  <div key={category.title}>
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">
                      {category.title}
                    </h3>
                    <div className="space-y-1">
                      {category.links.map((link) => (
                        <Link
                          key={link.href}
                          to={link.href}
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-foreground hover:bg-muted/50 transition-colors group"
                        >
                          <link.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          <span className="text-sm">{link.label}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Sidebar Footer */}
              <div className="p-6 border-t border-border/20">
                <Link to="/auth" onClick={() => setMenuOpen(false)}>
                  <Button className="w-full">
                    Get Started
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Hero Section */}
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
            Privacy-first messaging
          </motion.p>
          
          <motion.h1 
            variants={fadeInUp}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-semibold text-foreground mb-8 leading-[0.95] tracking-tight max-w-4xl"
          >
            You are not
            <br />
            the product.
          </motion.h1>
          
          <motion.p 
            variants={fadeInUp}
            className="text-xl text-muted-foreground max-w-xl mb-12 leading-relaxed"
          >
            Kloak is built for people who refuse to trade their privacy for connection. 
            No email. No password. No tracking. Just a key that only you hold.
          </motion.p>
          
          <motion.div variants={fadeInUp}>
            <Link to="/auth">
              <Button size="lg" className="text-base px-8 h-12">
                Create Your Key
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </section>

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
            className="overflow-hidden"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {/* Header */}
            <div className="grid grid-cols-[1fr,120px,120px] sm:grid-cols-[1fr,160px,160px] gap-4 pb-4 border-b border-border/30">
              <div />
              <div className="text-center">
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Others</span>
              </div>
              <div className="text-center">
                <span className="text-sm font-medium text-primary uppercase tracking-wide">Kloak</span>
              </div>
            </div>

            {/* Rows */}
            {comparisonData.map((row, index) => (
              <motion.div
                key={row.label}
                className="grid grid-cols-[1fr,120px,120px] sm:grid-cols-[1fr,160px,160px] gap-4 py-5 border-b border-border/20 items-center"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
              >
                <span className="text-foreground font-medium">{row.label}</span>
                <div className="flex justify-center">
                  {row.others ? (
                    <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center">
                      <Check className="w-4 h-4 text-destructive" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center">
                      <X className="w-4 h-4 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
                <div className="flex justify-center">
                  {row.kloak ? (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Check className="w-4 h-4 text-primary" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <X className="w-4 h-4 text-primary" />
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
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
              <MessageCircle className="w-10 h-10 text-primary mb-8" />
              <h3 className="text-3xl sm:text-4xl font-semibold text-foreground mb-4 tracking-tight">
                Real-time messaging
              </h3>
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
              <Lock className="w-10 h-10 text-primary mb-8" />
              <h3 className="text-2xl sm:text-3xl font-semibold text-foreground mb-4 tracking-tight">
                Key-based auth
              </h3>
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
              <Users className="w-10 h-10 text-primary mb-8" />
              <h3 className="text-2xl sm:text-3xl font-semibold text-foreground mb-4 tracking-tight">
                Communities
              </h3>
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
              <Zap className="w-10 h-10 text-primary mb-8" />
              <h3 className="text-3xl sm:text-4xl font-semibold text-foreground mb-4 tracking-tight">
                Modern infrastructure
              </h3>
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
          <motion.div 
            className="grid lg:grid-cols-2 gap-16 items-center"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div>
              <p className="text-primary font-medium mb-4 tracking-wide text-sm uppercase">For Everyone</p>
              <h2 className="text-4xl sm:text-5xl font-semibold text-foreground leading-tight tracking-tight mb-6">
                Free speech starts with free infrastructure.
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                Kloak isn't built for a demographic. It's built for humans. Whether you're organizing 
                a book club, running a business, or building a global community — you deserve the 
                same level of privacy and respect.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                No premium tiers that unlock privacy features. No enterprise-only security. 
                Everyone gets everything.
              </p>
            </div>
            <div className="space-y-6">
              {[
                "Activists and organizers",
                "Creative communities",
                "Gaming groups",
                "Small businesses",
                "Friends and families",
                "Anyone who values privacy"
              ].map((group, index) => (
                <motion.div
                  key={group}
                  className="flex items-center gap-4 text-lg"
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.08 }}
                >
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-foreground">{group}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
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
