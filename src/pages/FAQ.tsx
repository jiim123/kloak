import { motion } from "framer-motion";
import { NavigationMenu } from "@/components/layout/NavigationMenu";
import { Footer } from "@/components/ui/footer-section";
import { SEO } from "@/components/seo";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Shield, Key, Users, HelpCircle } from "lucide-react";

const faqCategories = [
  {
    title: "About Kloak",
    icon: Shield,
    questions: [
      {
        q: "What is Kloak?",
        a: "Kloak is a communication platform built for real-time messaging with privacy at its core. Like Discord, it offers servers, channels, direct messages, and voice chat. The difference: privacy is built into the architecture, not added as a feature.",
      },
      {
        q: "Who is Kloak for?",
        a: "Kloak is for anyone who values digital privacy. Community organizers, friend groups, teams, or individuals who are tired of platforms harvesting their data. Kloak provides a space to communicate without surveillance.",
      },
      {
        q: "Why is Kloak privacy-focused?",
        a: "Communication is a fundamental right that shouldn't come with strings attached. Traditional platforms require your email, phone number, and track your behavior to monetize you. Kloak was built to prove that great communication tools don't need to compromise your privacy.",
      },
      {
        q: "What features does Kloak offer?",
        a: "Kloak includes servers with text and voice channels, channel categories, direct messaging for individuals and groups, real-time chat with reactions and replies, share images and videos, a friend system, customizable profiles, and notifications. None of these features require personal information.",
      },
      {
        q: "Is Kloak free?",
        a: "Using Kloak will always be free. However, some features that require significant server resources like voice channels and large file storage may require a paid tier in the future. Running servers costs money, and offering premium features helps us keep the core platform free for everyone.",
      },
    ],
  },
  {
    title: "Authentication & Security",
    icon: Key,
    questions: [
      {
        q: "How does authentication work without email or password?",
        a: "When you create an account, Kloak generates a unique 64-character cryptographic key. This key is your identity. No email, phone number, or password required. You paste your key to log in from any device.",
      },
      {
        q: "What happens if I lose my secret key?",
        a: "Your secret key is the only way to access your account. By design, we cannot recover it for you. This ensures true privacy because we don't store any information that could identify you. Save your key in a secure location like a password manager.",
      },
      {
        q: "Where can I find my secret key after signing up?",
        a: "After creating your account, your key is displayed once. You can always view it again by going to User Settings, then Account, then View Secret Key while logged in. We strongly recommend saving it immediately after account creation.",
      },
      {
        q: "Is my data encrypted?",
        a: "Your secret key is hashed using SHA-256 before being stored. We never see or store your actual key. Messages are transmitted securely over encrypted connections.",
      },
    ],
  },
  {
    title: "Using Kloak",
    icon: Users,
    questions: [
      {
        q: "How do I create or join a server?",
        a: "To create a server, click the '+' button in the server sidebar and choose 'Create Server.' To join an existing server, you'll need an invite code from a server member. Paste it in the 'Join Server' dialog or use a direct invite link.",
      },
      {
        q: "Can I use Kloak on multiple devices?",
        a: "Yes. Since your identity is your secret key, you can log in from any device by pasting your key. Your servers, messages, and friends will sync across all devices.",
      },
      {
        q: "How do direct messages work?",
        a: "You can start a direct message with any user by clicking on their profile and selecting 'Message.' Kloak also supports group DMs for private conversations with multiple people outside of servers.",
      },
    ],
  },
];

const FAQ = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center w-full">
      <SEO
        title="FAQ"
        description="Frequently asked questions about Kloak. Learn about our privacy-first approach, secret key authentication, and how to use the platform."
      />
      <div className="w-full">
        <NavigationMenu />
        <main className="pt-10">
          {/* Hero Section */}
          <section className="relative py-32 md:py-40 px-8 lg:px-16 overflow-hidden">
            <div className="max-w-7xl mx-auto">
              <motion.div
                className="flex items-center gap-4 mb-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6 }}
              >
                <span className="text-xs font-mono text-primary tracking-widest uppercase">Help Center</span>
              </motion.div>

              <motion.h1
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light text-foreground leading-tight tracking-tight mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1 }}
              >
                Frequently asked
                <br />
                <span className="text-primary/60">questions.</span>
              </motion.h1>

              <motion.p
                className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                Everything you need to know about Kloak. Can't find what you're looking for? Join our community server.
              </motion.p>
            </div>
          </section>

          {/* FAQ Categories */}
          {faqCategories.map((category, categoryIndex) => (
            <section
              key={category.title}
              className={`relative py-24 px-8 lg:px-16 border-y border-border/20 ${
                categoryIndex % 2 === 0 ? "bg-card/50" : ""
              }`}
            >
              <div className="max-w-7xl mx-auto">
                <motion.div
                  className="mb-12"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 border border-primary/30 flex items-center justify-center">
                      <category.icon className="w-6 h-6 text-primary" />
                    </div>
                    <span className="text-xs font-mono text-primary tracking-widest uppercase">{category.title}</span>
                  </div>
                </motion.div>

                <Accordion type="single" collapsible className="space-y-4">
                  {category.questions.map((item, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                    >
                      <AccordionItem
                        value={`${category.title}-${index}`}
                        className="border border-border/30 bg-background hover:bg-card/50 transition-colors px-6 md:px-8"
                      >
                        <AccordionTrigger className="text-left font-medium hover:no-underline py-6 text-base md:text-lg">
                          {item.q}
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground leading-relaxed pb-6 text-sm md:text-base">
                          {item.a}
                        </AccordionContent>
                      </AccordionItem>
                    </motion.div>
                  ))}
                </Accordion>
              </div>
            </section>
          ))}

          {/* Footer CTA */}
          <section className="relative py-24 px-8 lg:px-16 bg-card/50 border-b border-border/20">
            <div className="max-w-2xl mx-auto">
              <motion.div
                className="text-center border border-border/30 bg-background p-10 md:p-14 rounded-lg"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <HelpCircle className="w-12 h-12 text-primary mx-auto mb-6" />
                <h2 className="text-3xl sm:text-4xl font-light text-foreground leading-tight tracking-tight mb-4">
                  Still have questions?
                </h2>
                <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed">
                  Join our community server to get help from other Kloak users and stay updated on new features.
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

export default FAQ;
