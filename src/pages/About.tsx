import { motion } from "framer-motion";
import { NavigationMenu } from "@/components/layout/NavigationMenu";
import { Footer } from "@/components/ui/footer-section";
import { SEO } from "@/components/seo";

const sectionAnim = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6 },
};

const About = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center w-full landing-typography">
      <SEO
        title="About Us"
        description="The story behind Kloak. A privacy-first communication platform built by people who believe your conversations should belong to you."
      />
      <div className="w-full">
        <NavigationMenu />
        <main className="pt-10">
          {/* Hero Section */}
          <section className="relative py-32 md:py-40 px-8 lg:px-16 overflow-hidden bg-foreground">
            <div className="max-w-7xl mx-auto">
              <motion.div
                className="flex items-center gap-4 mb-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6 }}
              >
                <span className="text-xs font-mono text-background tracking-widest">Our Story</span>
              </motion.div>

              <motion.h1
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light text-background leading-tight tracking-tight mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1 }}
              >
                About
                <br />
                <span className="text-background">Kloak.</span>
              </motion.h1>

              <motion.p
                className="text-lg md:text-xl text-background max-w-2xl leading-relaxed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                We built this because we were tired of being the product.
              </motion.p>
            </div>
          </section>

          {/* Section 1: About Kloak */}
          <section className="relative py-24 px-8 lg:px-16 bg-card/50 border-b border-border/20">
            <div className="max-w-3xl mx-auto">
              <motion.div {...sectionAnim}>
                <h4 className="text-muted-foreground tracking-widest  mb-12">About Kloak</h4>
                <div className="space-y-6 text-foreground text-base md:text-lg leading-[1.8]">
                  <p>
                    Kloak is a community-driven communication platform created by people who are genuinely passionate
                    about privacy. Not privacy as a buzzword. Not privacy as a toggle buried in a settings menu. Privacy
                    as the foundation everything else is built on.
                  </p>
                  <p>
                    We are the kind of people who refuse to hand over our identities to corporations that treat personal
                    data like currency. The kind of people who believe you should be able to talk to your friends,
                    collaborate with your community, and express yourself freely without a company profiling your every
                    click, message, and habit to sell you back to advertisers.
                  </p>
                  <p>That belief is why Kloak exists.</p>
                </div>
              </motion.div>
            </div>
          </section>

          {/* Section 2: How it started */}
          <section className="relative py-24 px-8 lg:px-16 border-b border-border/20">
            <div className="max-w-3xl mx-auto">
              <motion.div {...sectionAnim}>
                <h4 className="text-muted-foreground tracking-widest mb-12">How it started</h4>
                <div className="space-y-6 text-foreground/85 text-base md:text-lg leading-[1.8]">
                  <p>
                    In January 2026, we quietly opened the doors to a very, very early alpha, almost like a shell. No
                    promotion. No marketing campaigns. No launch events. Just a small group of people building something
                    in silence, testing the ground to see if the idea could hold weight.
                  </p>
                  <p>The goal was simple: build first, talk later. We did not want attention. We wanted answers.</p>
                  <p>But people found us anyway.</p>
                  <p>
                    Within weeks, it became clear that we were not the only ones hungry for something different. By
                    February 2026, we knew that if we were serious about pushing this platform forward, we needed more
                    hands on deck and more resources behind it.
                  </p>
                </div>
              </motion.div>
            </div>
          </section>

          {/* Section 3: Where we are now */}
          <section className="relative py-24 px-8 lg:px-16 bg-card/50 border-b border-border/20">
            <div className="max-w-3xl mx-auto">
              <motion.div {...sectionAnim}>
                <h4 className="text-muted-foreground tracking-widest mb-12">Where we are now</h4>
                <div className="space-y-6 text-foreground/85 text-base md:text-lg leading-[1.8]">
                  <p>
                    Today, Kloak is maintained by a team of roughly five people, all working on this as a side project
                    alongside our day jobs. We are not backed by venture capital. We are not chasing valuations. We are
                    building this because we believe it matters, and we fund it through self-funding and donations from
                    the people who choose to believe in the idea of Kloak and use it.
                  </p>
                  <p>
                    That is a deliberate choice. No subscriptions. No ads. No data harvesting. When your revenue model
                    does not depend on exploiting user data, you can actually build something that serves the people
                    using it.
                  </p>
                </div>
              </motion.div>
            </div>
          </section>

          {/* Section 4: What comes next */}
          <section className="relative py-24 px-8 lg:px-16 border-b border-border/20">
            <div className="max-w-3xl mx-auto">
              <motion.div {...sectionAnim}>
                <h4 className="text-muted-foreground tracking-widest mb-12">What comes next</h4>
                <div className="space-y-6 text-foreground/85 text-base md:text-lg leading-[1.8]">
                  <p>
                    Our primary focus going forward is to implement a zero-knowledge encryption strategy. This means
                    building a system where even we cannot read your messages. Not because we promise not to, but
                    because it will be mathematically impossible.
                  </p>
                  <p>
                    We are working toward integrating end-to-end encryption across direct messages and group
                    communications so that your conversations belong entirely to you. Alongside that, we are designing a
                    recovery system so that if you lose access to your account, there is a secure path back in without
                    compromising the zero-knowledge model. Because encryption that locks you out permanently is not a
                    solution, it is a different problem.
                  </p>
                  <p>
                    We are not promising any of this on a fixed timeline. This is the direction we are heading, and we
                    are committed to getting there. Whether that takes six months or 2 years, we do not know yet. What
                    we do know is that we would rather take the time to do it right than rush something out.
                  </p>
                </div>
              </motion.div>
            </div>
          </section>

          {/* Section 5: Why we do this */}
          <section className="relative py-24 px-8 lg:px-16 bg-card/50 border-b border-border/20">
            <div className="max-w-3xl mx-auto">
              <motion.div {...sectionAnim}>
                <h4 className="text-muted-foreground tracking-widest mb-12">Why we do this</h4>
                <div className="space-y-6 text-foreground/85 text-base md:text-lg leading-[1.8]">
                  <p>
                    There is no shortage of communication platforms out there. Most of them are free. Most of them are
                    also watching everything you do.
                  </p>
                  <p>
                    We think people deserve better than that. We think you should be able to have a conversation without
                    it becoming a data point. We think communities should be able to grow without being monetized. And
                    we think privacy is not something you should have to pay for, fight for, or compromise on.
                  </p>
                  <p>
                    Kloak is not perfect. We are small. We are scrappy. We are building this in our spare time because
                    we care about it deeply. But we would rather be honest and early than polished and compromised.
                  </p>
                  <p>If that sounds like something worth being part of, we are glad you are here.</p>
                </div>
              </motion.div>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default About;
