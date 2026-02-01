import { motion } from "framer-motion";
import { Heart, Code, Shield, Palette, Sparkles, Mail } from "lucide-react";
import { Footer } from "@/components/ui/footer-section";
import { NavigationMenu } from "@/components/layout/NavigationMenu";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/seo";

const roles = [
  {
    icon: Palette,
    title: "Designers",
    description: "Design for potentially thousands of users. Create emojis, avatar decorations, motion designs, and visual experiences that make Kloak unique.",
  },
  {
    icon: Code,
    title: "Engineers",
    description: "Build secure, performant systems from the ground up. React, TypeScript, Supabase, and more.",
  },
  {
    icon: Shield,
    title: "Security Enthusiasts",
    description: "Help us stay ahead of threats and ensure our users' data remains theirs alone.",
  },
  {
    icon: Heart,
    title: "Community Builders",
    description: "Connect with users, gather feedback, and help shape the future of private communication.",
  },
];

const Join = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center w-full">
      <SEO
        title="Join Us | Kloak"
        description="Join the Kloak team. We're a small indie team looking for passionate designers, engineers, and security enthusiasts."
      />
      <div className="w-full">
        <NavigationMenu />
        <main className="pt-10">
          {/* Hero Section */}
          <section className="relative py-32 md:py-40 px-8 lg:px-16 overflow-hidden">
            <div className="max-w-7xl mx-auto">
               <Dithering
                  style={{ width: "100%", height: "100%" }}
                  colorBack="#878787"
                  colorFront="#0f0f0f"
                  shape="wave"
                  type="4x4"
                  size={2}
                  speed={0.7}
                  scale={0.6}
                  offsetX={0.06}
                  offsetY={-0.12}
                />
              </div>
              <motion.div
                className="flex items-center gap-4 mb-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6 }}
              >
                <span className="text-xs font-mono text-primary tracking-widest uppercase">Volunteer With Us</span>
              </motion.div>

              <motion.h1
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light text-foreground leading-tight tracking-tight mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1 }}
              >
                Build something
                <br />
                <span className="text-primary/60">that matters.</span>
              </motion.h1>

              <motion.p
                className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                We're a tiny indie team on a mission to give people back their privacy. No investors pushing growth
                metrics. No corporate roadmap. Just passionate volunteers building tools that respect users.
              </motion.p>
            </div>
          </section>

          {/* Who We're Looking For */}
          <section className="relative py-24 px-8 lg:px-16 bg-card/50 border-y border-border/20">
            <div className="max-w-7xl mx-auto">
              <motion.div
                className="mb-16"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <span className="text-xs font-mono text-primary tracking-widest uppercase mb-4 block">
                  Volunteer Positions
                </span>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-light text-foreground leading-tight tracking-tight">
                  Passion over pedigree.
                </h2>
              </motion.div>

              <div className="grid md:grid-cols-2 gap-6">
                {roles.map((role, index) => (
                  <motion.div
                    key={role.title}
                    className="relative border border-border/30 p-8 md:p-10 group overflow-hidden bg-background hover:bg-card/50 transition-colors"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary/5 to-transparent" />
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 border border-primary/30 flex items-center justify-center shrink-0 group-hover:border-primary/50 transition-colors duration-300">
                        <role.icon className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-foreground mb-2">{role.title}</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">{role.description}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <motion.div
                className="mt-12 text-center"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <p className="text-muted-foreground">
                  Don't see your role listed? We're always open to meeting talented people. Reach out anyway.
                </p>
              </motion.div>
            </div>
          </section>

          {/* Values Section */}
          <section className="relative py-24 px-8 lg:px-16 border-b border-border/20">
            <div className="max-w-7xl mx-auto">
              <motion.div
                className="grid md:grid-cols-3 gap-8"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <div className="space-y-4">
                  <Sparkles className="w-8 h-8 text-primary" />
                  <h3 className="text-xl font-medium text-foreground">Remote First</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Contribute from anywhere. We care about what you build, not where you sit.
                  </p>
                </div>
                <div className="space-y-4">
                  <Heart className="w-8 h-8 text-primary" />
                  <h3 className="text-xl font-medium text-foreground">Mission Driven</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Privacy isn't a feature for us—it's the foundation everything is built on.
                  </p>
                </div>
                <div className="space-y-4">
                  <Code className="w-8 h-8 text-primary" />
                  <h3 className="text-xl font-medium text-foreground">Indie Spirit</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Small team, big ambitions. Every contribution shapes the product directly.
                  </p>
                </div>
              </motion.div>
            </div>
          </section>

          {/* Contact CTA */}
          <section className="relative py-24 px-8 lg:px-16 bg-card/50 border-b border-border/20">
            <div className="max-w-2xl mx-auto">
              <motion.div
                className="text-center border border-border/30 bg-background p-10 md:p-14 rounded-lg"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <Mail className="w-12 h-12 text-primary mx-auto mb-6" />
                <h2 className="text-3xl sm:text-4xl font-light text-foreground leading-tight tracking-tight mb-4">
                  Ready to join?
                </h2>
                <p className="text-muted-foreground mb-8 max-w-lg mx-auto leading-relaxed">
                  If you're passionate about privacy and want to contribute to something meaningful, 
                  we'd love to hear from you. Tell us about yourself, what excites you, and how you'd like to help.
                </p>
                <a href="mailto:join@kloak.app">
                  <Button size="lg" className="h-14 px-8 text-lg">
                    <Mail className="w-5 h-5 mr-2" />
                    join@kloak.app
                  </Button>
                </a>
              </motion.div>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default Join;
