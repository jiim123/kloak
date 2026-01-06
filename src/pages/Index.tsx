import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Shield, 
  ArrowRight,
  Key,
  MessageCircle,
  Users,
  Zap,
  Lock
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
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navigation */}
      <nav className="w-full py-6 px-6 border-b border-border/20">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <img src={kloakLogo} alt="Kloak" className="h-7" />
          <div className="flex items-center gap-4">
            <Link to="/philosophy">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                Philosophy
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="sm">
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

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

      {/* Principles Section */}
      <section className="py-32 px-6 bg-card/50 border-y border-border/20">
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

      {/* Features Section */}
      <section className="py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div 
            className="mb-20"
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

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: MessageCircle,
                title: "Real-time messaging",
                description: "Instant delivery across servers, channels, and direct messages."
              },
              {
                icon: Users,
                title: "Communities",
                description: "Create spaces for your people. Organize with channels and categories."
              },
              {
                icon: Lock,
                title: "Key-based auth",
                description: "One key. Full control. No password managers needed."
              },
              {
                icon: Zap,
                title: "Modern stack",
                description: "Built for performance. Fast, responsive, reliable."
              }
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                className="group"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* For Everyone Section */}
      <section className="py-32 px-6 border-t border-border/20">
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
