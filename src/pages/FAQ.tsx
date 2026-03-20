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
        a: "Using Kloak is and will always be free. Features that require significant server resources, such as larger file storage or any other QoL feature, may in the future be offered as optional paid upgrades. Any paid features will be clearly communicated in advance. The core platform, including messaging, servers, and direct messages, will remain free.",
      },
      {
        q: "Is there a mobile app for Kloak?",
        a: "Not yet. Kloak is currently available through your web browser.",
      },
      {
        q: "Is there a desktop app?",
        a: "Not yet. Kloak is currently available through your web browser.",
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
        a: "Your secret key is displayed once during account creation. For security, Kloak does not store your key — only a one-way hash is kept. Make sure to save it immediately in a password manager or another secure location. If you lose it, your account cannot be recovered.",
      },
      {
        q: "Is my data encrypted?",
        a: "Your secret key is hashed using SHA-256 before being stored. We never see or store your actual key. All data is transmitted over encrypted HTTPS connections. We are currently working toward implementing end-to-end encryption for messages, which will ensure that only the intended recipients can read them. We will always be transparent about exactly what level of encryption is in place.",
      },
      {
        q: "Why don't you require email or phone for login?",
        a: "Email is the universal tracking ID that links your activity across the entire internet. Phone numbers are tied to your legal identity and can be used to verify you for advertising purposes. We use cryptographic secret keys instead, which prove you are you without telling us anything about who you actually are.",
      },
      {
        q: "Can someone else access my account?",
        a: "Only someone with your secret key can access your account. We cannot be compelled to give anyone else access because we do not store your key, only a one-way hash. Keep your key secure and never share it with anyone.",
      },
      {
        q: "What data does Kloak collect about me?",
        a: "Kloak collects the minimum required to operate the service: your username, a one-way hash of your secret key, your messages and content, optional profile information you choose to add, and server membership records. No email address, phone number, real name, location, or biometric data is ever collected. Unlike most platforms, we also collect zero analytics, tracking pixels, or behavioral data. There is no advertising infrastructure on Kloak because there is no business model that depends on knowing who you are.",
      },
    ],
  },
  {
    title: "Legal & Trust",
    icon: Key,
    questions: [
      {
        q: "Is there a legal entity behind Kloak?",
        a: "Kloak is currently a community project without a registered legal entity. We are evaluating the right legal structure as the project grows and will be transparent about any changes.",
      },
      {
        q: "Does GDPR apply to Kloak?",
        a: "GDPR governs the processing of personal data. Because Kloak collects zero personal data, no email addresses, no phone numbers, no IP logs, no analytics, and no tracking of any kind, GDPR's scope of application to Kloak is extremely limited. Authentication is handled through a cryptographic secret key that cannot be linked back to any real-world identity. There is simply very little personal data for the regulation to govern.",
      },
      {
        q: "Where is my data stored and processed?",
        a: "Kloak uses Supabase as its backend infrastructure. AWS EU West. Because we collect no personal data, what is stored is limited to message content and server structure. There is no personal profile tied to your account at any stage.",
      },
      {
        q: "Is my data encrypted?",
        a: "Your secret key is hashed using SHA-256 before being stored. We never see or store your actual key. All data is transmitted over encrypted HTTPS connections. We are currently working toward implementing end-to-end encryption for messages, which will ensure that only the intended recipients can read them. We will always be transparent about exactly what level of encryption is in place.",
      },
      {
        q: "How are donations handled?",
        a: "Donations are accepted voluntarily through Buy Me a Coffee and different cryptocurrencies and go directly toward server infrastructure and platform development. Donating does not purchase any service or guarantee any specific feature. It is entirely optional support for a free project. Donors interact with Buy Me a Coffee's own platform, which has its own privacy policy and terms.",
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
      {
        q: "How do I delete my account?",
        a: "You can delete your account at any time from User Settings. When you delete your account, your profile and personal data are permanently removed. Your messages may remain in servers but will show as from a deleted user. This action is immediate and irreversible.",
      },
      {
        q: "Who owns the content I create on Kloak?",
        a: "You do. We only need enough rights to operate the service, meaning we store and transmit your messages to intended recipients. We will not use your content for advertising, train AI models on your messages, sell your content to third parties, or claim ownership over anything you create.",
      },
      {
        q: "How does server moderation work?",
        a: "Server owners and administrators are responsible for moderating content within their servers. Kloak provides moderation tools including role permissions, message deletion, and user banning. We do not actively monitor private servers or scan messages with AI. We act on reports of platform-wide rule violations.",
      },
      {
        q: "Do you sell or share my data?",
        a: "Your data is never sold or distributed to external parties. The only exception is for legal compliance, though our minimal data collection practices limit what is actually stored.",
      },
      {
        q: "What behavior is not allowed on Kloak?",
        a: "We don't micromanage conversations or police opinions. However, some things are not acceptable: illegal activities, harassment and abuse, child exploitation content, intellectual property violations, attacks on the platform, and spam or phishing. Violations result in account termination, and all terminations are final.",
      },
    ],
  },
];

const FAQ = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center w-full landing-typography">
      <SEO
        title="FAQ"
        description="Frequently asked questions about Kloak. Learn about our privacy-first approach, secret key authentication, and how to use the platform."
      />
      <div className="w-full">
        <NavigationMenu />
        <main>
          {/* Hero Section */}
          <section className="relative min-h-[85vh] flex items-end px-8 lg:px-16 pb-20 overflow-hidden bg-foreground">
            <div className="max-w-7xl mx-auto w-full">
              <motion.div
                className="flex items-center gap-4 mb-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6 }}
              >
                <span className="text-xs font-mono text-background tracking-widest">Help Center</span>
              </motion.div>

              <motion.h1
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light text-background leading-tight tracking-tight mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1 }}
              >
                Frequently asked
                <br />
                <span className="text-background/60">questions.</span>
              </motion.h1>

              <motion.p
                className="text-lg md:text-xl text-background/70 max-w-2xl leading-relaxed"
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
                  <h4 className="font-medium text-muted-foreground tracking-widest">{category.title}</h4>
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
                        className="border border-border/30 bg-background px-6 md:px-8"
                      >
                        <AccordionTrigger className="text-left font-medium hover:no-underline py-6 text-base md:text-lg font-normal">
                          {item.q}
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground leading-[1.7] pb-6 text-base/6">
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
