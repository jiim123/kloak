import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Shield, 
  Eye, 
  EyeOff, 
  Lock, 
  Users, 
  MessageCircle, 
  Zap, 
  Heart,
  ArrowRight,
  Key,
  Database,
  Ban,
  Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/ui/footer-section';
import { GrainGradient } from '@paper-design/shaders-react';
import kloakLogo from '@/assets/kloak-logo.svg';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
};

const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

const Index = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Background shader */}
      <div className="absolute inset-0 z-0">
        <GrainGradient
          style={{ width: '100%', height: '100%' }}
          colors={["#6b6557", "#8a8274", "#a39e8c"]}
          colorBack="#0d0d0c"
          softness={0.76}
          intensity={0.08}
          noise={0.5}
          shape="wave"
          speed={1}
          scale={1.68}
          rotation={304}
          offsetX={-0.06}
        />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 w-full py-6 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <img src={kloakLogo} alt="Kloak" className="h-8" />
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
      <section className="relative z-10 flex-1 flex items-center justify-center px-6 py-20">
        <motion.div 
          className="max-w-4xl mx-auto text-center"
          initial="initial"
          animate="animate"
          variants={stagger}
        >
          <motion.div variants={fadeInUp} className="mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
              <Shield className="w-4 h-4" />
              Privacy is not a feature. It's the architecture.
            </span>
          </motion.div>
          
          <motion.h1 
            variants={fadeInUp}
            className="text-4xl sm:text-5xl md:text-6xl font-semibold text-foreground mb-6 leading-tight tracking-tight"
          >
            Communication without
            <br />
            <span className="text-primary">compromise</span>
          </motion.h1>
          
          <motion.p 
            variants={fadeInUp}
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Kloak is for everyone who refuses to be the product. No email. No password. 
            No tracking. Just a cryptographic key that only you possess.
          </motion.p>
          
          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/auth">
              <Button size="lg" className="text-base px-8">
                <Key className="w-5 h-5 mr-2" />
                Create Your Key
              </Button>
            </Link>
            <Link to="/philosophy">
              <Button variant="outline" size="lg" className="text-base px-8">
                Read Our Philosophy
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Benefits Section */}
      <section className="relative z-10 py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl sm:text-4xl font-semibold text-foreground mb-4 tracking-tight">
              Why people choose Kloak
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Built for those who believe privacy is a fundamental right, not a premium feature.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: EyeOff,
                title: "Zero Data Collection",
                description: "We don't want your email, phone number, or personal details. We don't collect what we don't need."
              },
              {
                icon: Ban,
                title: "No Monetization of You",
                description: "You're not the product here. No ads, no data selling, no profiling. Ever."
              },
              {
                icon: Lock,
                title: "Cryptographic Authentication",
                description: "Your secret key is the only way in. We can't access your account. Neither can anyone else."
              }
            ].map((benefit, index) => (
              <motion.div
                key={benefit.title}
                className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-8 hover:border-border transition-colors"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                  <benefit.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3 tracking-tight">{benefit.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{benefit.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 py-24 px-6 bg-card/30 backdrop-blur-sm border-y border-border/30">
        <div className="max-w-6xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl sm:text-4xl font-semibold text-foreground mb-4 tracking-tight">
              Everything you need, nothing you don't
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Full-featured communication that respects your privacy at every level.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: MessageCircle,
                title: "Real-time Messaging",
                description: "Instant messaging with servers, channels, and direct messages."
              },
              {
                icon: Users,
                title: "Communities",
                description: "Create and join servers with channels organized your way."
              },
              {
                icon: Zap,
                title: "Fast & Responsive",
                description: "Modern tech stack for seamless real-time experiences."
              },
              {
                icon: Database,
                title: "Minimal Footprint",
                description: "We store only what's essential for the app to function."
              }
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                className="p-6 rounded-lg border border-border/30 bg-background/50 hover:bg-card/50 transition-colors"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <feature.icon className="w-8 h-8 text-primary mb-4" />
                <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* For All Section */}
      <section className="relative z-10 py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div 
            className="text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border mb-8">
              <Globe className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">For Everyone</span>
            </div>
            
            <h2 className="text-3xl sm:text-4xl font-semibold text-foreground mb-6 tracking-tight">
              Free speech for all communities
            </h2>
            
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed max-w-3xl mx-auto">
              Kloak isn't built for a niche. It's built for humans who want to communicate freely. 
              Whether you're organizing a book club, building a gaming community, running a small business, 
              or just talking with friends — Kloak treats you all the same.
            </p>
            
            <div className="grid sm:grid-cols-3 gap-6 mb-12">
              {[
                {
                  icon: Heart,
                  title: "Community Driven",
                  description: "Built for communities of all sizes and interests."
                },
                {
                  icon: Shield,
                  title: "Equal Treatment",
                  description: "No premium tiers that unlock privacy. Everyone gets the same protection."
                },
                {
                  icon: Eye,
                  title: "Transparent",
                  description: "We tell you exactly what we do. No fine print. No surprises."
                }
              ].map((item, index) => (
                <motion.div
                  key={item.title}
                  className="p-6 rounded-xl bg-card/30 border border-border/30"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <item.icon className="w-8 h-8 text-primary mb-4 mx-auto" />
                  <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </motion.div>
              ))}
            </div>
            
            <p className="text-muted-foreground text-lg italic">
              "We believe the internet should be a place where ideas flow freely — without surveillance, 
              without exploitation, and without compromise."
            </p>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-24 px-6">
        <motion.div 
          className="max-w-3xl mx-auto text-center bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl sm:text-4xl font-semibold text-foreground mb-4 tracking-tight">
            Ready to take back your privacy?
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            No signup forms. No verification emails. Just generate your key and start communicating.
          </p>
          <Link to="/auth">
            <Button size="lg" className="text-base px-8">
              <Key className="w-5 h-5 mr-2" />
              Get Started Now
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <div className="relative z-10">
        <Footer />
      </div>
    </div>
  );
};

export default Index;
