import { motion } from "framer-motion";
import { Heart, Shield, Lock, EyeOff, Coins, Scale, Sparkles } from "lucide-react";
import { Footer } from "@/components/ui/footer-section";
import { NavigationMenu } from "@/components/layout/NavigationMenu";
import { SEO } from "@/components/seo";
import { SEO_CONFIG } from "@/lib/seo";
import { SmokeRing } from "@paper-design/shaders-react";
const manifestPoints = [
  {
    icon: Shield,
    title: "Privacy is the architecture",
    content:
      "Most platforms make privacy a feature. A checkbox in your settings menu. Something you enable after they've gathered everything about you. Privacy isn't a feature at Kloak. It's a limitation we defined from the outset. We don't collect your email address because we don't need it. We don't track your location because our system doesn't require you to provide it.",
  },
  {
    icon: Lock,
    title: "No email. No password. No digital identity.",
    content:
      "Your email address is your skeleton key to digital identity. Your buying patterns, your politics, and your medical questions are all tied together with your email address. All businesses with that information have access to the tools necessary to connect the dots on you. All hacks compromise the same identity for a dozen other locations. We use secret keys, cryptographic technology. The same technology that secures billions in cryptocurrency. Your key is generated on your device, stored on your device, and verifies you without ever telling us anything about who you really are.",
  },
  {
    icon: EyeOff,
    title: "Metadata is data",
    content:
      "You may be encrypting your messages. But being encrypted doesn't necessarily make people private. Most messaging apps monitor all of the information around your conversations. They are aware of who you’re talking to, when, how frequently, and even where. They create profiles of your relationships and patterns, they are just unable to read the text. True privacy means not being tracked at all.",
  },
  {
    icon: Coins,
    title: "No greedy shareholders",
    content:
      "Shareholder-driven platforms don't work for you, they work for profit. That means maximizing 'engagement' through ads, tracking, and psychological manipulation. Your attention becomes the product they sell. Kloak operates on a simple principle: you pay us, we work for you. Some features require payment, but when you're the customer instead of the product, our success depends on your satisfaction—not your addiction.",
  },
  {
    icon: Heart,
    title: "No micro-transactions. Ever.",
    content:
      "No premium emojis. No paid stickers. No server boosts or cosmetic gambling. These 'features' are designed by psychologists to exploit you—through FOMO, social pressure, and artificial scarcity. It's gross, and we're not doing it. You're not a slot machine.",
  },
  {
    icon: Sparkles,
    title: "AI that helps, not surveils",
    content:
      "The problem with AI in most platforms isn't the technology. It's how it's used. Scanning your messages to build advertising profiles. Analyzing your behavior to predict and manipulate your choices. Training models on your private conversations without consent. We don't do any of that. If we ever add AI features, they'll be opt-in, transparent about what they do, and won't require shipping your data to third parties.",
  },
];

const Philosophy = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center w-full">
      <SEO {...SEO_CONFIG.philosophy} />
      <div className="w-full">
        <NavigationMenu />
        <main className="pt-10">
          {/* Hero Section */}
          <section className="relative py-32 md:py-40 px-8 lg:px-16 overflow-hidden">
            {/* Blue shader background */}
            <div className="absolute inset-0">
              <SmokeRing
                style={{ width: "100%", height: "100%" }}
                colors={["#1e40af"]}
                colorBack="#0c1836"
                noiseScale={3}
                noiseIterations={3}
                radius={0.95}
                thickness={0.85}
                innerShape={0.9}
                speed={0.3}
                scale={2.24}
                offsetY={0.46}
              />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto">
              <motion.div
                className="flex items-center gap-4 mb-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6 }}
              >
                <span className="text-xs font-mono text-white/80 tracking-widest uppercase">Our Manifesto</span>
              </motion.div>

              <motion.h1
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light text-white leading-tight tracking-tight mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1 }}
              >
                Communication should
                <br />
                <span className="text-white/60">be completely private.</span>
              </motion.h1>

              <motion.p
                className="text-lg md:text-xl text-white/70 max-w-2xl leading-relaxed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                It should not be tracked, analyzed, or sold. Ever.
              </motion.p>
            </div>
          </section>

          {/* Manifesto Points */}
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
                  What We Believe
                </span>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-light text-foreground leading-tight tracking-tight">
                  The principles we build on.
                </h2>
              </motion.div>

              <div className="grid gap-6">
                {manifestPoints.map((point, index) => (
                  <motion.div
                    key={point.title}
                    className="relative border border-border/30 p-8 md:p-10 group overflow-hidden bg-background hover:bg-card/50 transition-colors"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary/5 to-transparent" />
                    <div className="flex items-start gap-4 md:gap-6">
                      <div className="w-12 h-12 border border-primary/30 flex items-center justify-center shrink-0 group-hover:border-primary/50 transition-colors duration-300">
                        <point.icon className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg md:text-xl font-medium text-foreground mb-3">{point.title}</h3>
                        <p className="text-muted-foreground text-[17px] leading-[1.7]">{point.content}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* Why We Exist */}
          <section className="relative py-24 px-8 lg:px-16 border-b border-border/20">
            <div className="max-w-7xl mx-auto">
              <motion.div
                className="grid md:grid-cols-2 gap-12 md:gap-16"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <div>
                  <span className="text-xs font-mono text-primary tracking-widest uppercase mb-4 block">
                    Why We Exist
                  </span>
                  <h2 className="text-3xl sm:text-4xl font-light text-foreground leading-tight tracking-tight mb-6">
                    Because surveillance capitalism isn't inevitable.
                  </h2>
                </div>
                <div className="space-y-4 text-muted-foreground leading-relaxed">
                  <p>
                    Somewhere along the way, we all accepted that free communication platforms would spy on us. That our
                    messages would be scanned for advertising keywords. That our social connections would be mapped,
                    analyzed, and sold. That "free" meant we were the product.
                  </p>
                  <p>
                    The technology exists to build private communication platforms. The business models exist to sustain
                    them without surveillance. The only reason Big Tech doesn't do it is because your data is worth more
                    to them than your trust.
                  </p>
                  <p>We made a different choice.</p>
                </div>
              </motion.div>
            </div>
          </section>

          {/* Long-term Vision */}
          <section className="relative py-24 px-8 lg:px-16 bg-card/50 border-b border-border/20">
            <div className="max-w-2xl mx-auto">
              <motion.div
                className="text-center border border-border/30 bg-background p-10 md:p-14 rounded-lg"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <Scale className="w-12 h-12 text-primary mx-auto mb-6" />
                <h2 className="text-3xl sm:text-4xl font-light text-foreground leading-tight tracking-tight mb-4">
                  The Bottom Line
                </h2>
                <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed">
                  Kloak exists because we believe there should be a place where people can communicate without being the
                  product. Where privacy isn't a premium feature. Where your conversations are truly your own. That's
                  not idealism. It's just how things should be.
                </p>
              </motion.div>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default Philosophy;
