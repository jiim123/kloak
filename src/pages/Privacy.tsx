import { motion } from "framer-motion";
import { NavigationMenu } from "@/components/layout/NavigationMenu";
import { Footer } from "@/components/ui/footer-section";
import { SEO } from "@/components/seo";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Eye, Shield, Database, Globe, Trash2, Lock } from "lucide-react";

const privacyCategories = [
  {
    title: "Data Collection",
    icon: Database,
    questions: [
      {
        q: "What data does Kloak collect?",
        a: "We collect only what is absolutely necessary: your username (chosen by you), a hash of your secret key (one-way encrypted), your messages and content (to deliver them), optional profile information (you control it), and server membership records (to show you your servers). That's it. No hidden tracking, no behavioral analysis, no data enrichment from third parties.",
      },
      {
        q: "What data does Kloak NOT collect?",
        a: "Unlike virtually every other platform, we never collect: email addresses, phone numbers, real names, physical location or IP logging, device fingerprints, browsing history, or third-party tracking data. We don't collect this data because we don't need it. The less we know about you, the less can be leaked, subpoenaed, or misused.",
      },
    ],
  },
  {
    title: "Data Protection",
    icon: Lock,
    questions: [
      {
        q: "How is my data protected?",
        a: "Your secret key is hashed using SHA-256 before storage. We never see or store your actual key. Messages are transmitted over encrypted connections (TLS).",
      },
      {
        q: "Do you use cookies or tracking?",
        a: "We use only essential cookies stored in your browser's Local Storage. This includes: your authentication key (so you stay logged in), theme preferences (your visual settings), and UI state (sidebar positions, etc.). We do not use analytics cookies, advertising cookies, social media pixels, or any third-party tracking.",
      },
    ],
  },
  {
    title: "Data Sharing",
    icon: Globe,
    questions: [
      {
        q: "Do you share data with third parties?",
        a: "No. We do not sell, trade, or share your data with advertisers, data brokers, or anyone else. Period. The only exception: if legally required by European law. Even then, we've collected so little data that there's almost nothing to hand over, we cannot link accounts to real identities because we don't have that information, and we cannot recover or provide your secret key because we only store a hash.",
      },
      {
        q: "What happens if there's a legal request?",
        a: "We comply with valid European legal requests. However, our architecture means we have very limited data to provide. We cannot identify users by real name, email, or phone number because we don't collect that information. We cannot decrypt your secret key because we only store a one-way hash.",
      },
    ],
  },
  {
    title: "Data Retention",
    icon: Eye,
    questions: [
      {
        q: "How long is my data retained?",
        a: "Account data is retained while your account is active and deleted permanently when you delete your account. Messages are stored as long as they exist in channels or DMs. When you delete a message, it's removed from our servers. Server data is retained while the server exists and deleted when the server is deleted. We don't keep 'shadow profiles' or retain data after deletion.",
      },
      {
        q: "What are my rights?",
        a: "You have the right to: access and view all data associated with your account, correct and update your profile information at any time, delete your account and all associated data permanently, and export your data in a standard format. To exercise these rights, go to User Settings in the app. Most actions can be performed directly without contacting us.",
      },
    ],
  },
  {
    title: "Account Deletion",
    icon: Trash2,
    questions: [
      {
        q: "How do I delete my data?",
        a: "You can delete your account at any time from User Settings. When you delete your account: your profile and personal data are permanently removed, your messages remain in servers but show as from 'Deleted User,' and this action is immediate and irreversible. We don't hide the delete button or make you jump through hoops. Your data, your choice, immediately.",
      },
      {
        q: "Is deletion really permanent?",
        a: "Yes. When you delete your account, we don't keep backups or shadow copies. Your profile data is permanently erased from our systems. The only exception is messages in shared spaces, which remain but are disassociated from your identity.",
      },
    ],
  },
];

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center w-full landing-typography">
      <SEO
        title="Privacy Policy | Kloak"
        description="Privacy policy for Kloak. Learn what data we collect, how we protect it, and why we collect less than any other platform."
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
                <span className="text-xs font-mono text-background tracking-widest uppercase">
                  Legal
                </span>
              </motion.div>

              <motion.h1
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light text-background leading-tight tracking-tight mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1 }}
              >
                Privacy
                <br />
                <span className="text-background/60">policy.</span>
              </motion.h1>

              <motion.p
                className="text-lg md:text-xl text-background/70 max-w-2xl leading-relaxed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                Most privacy policies explain how companies collect your data. This one explains why we don't. Kloak was
                designed from the ground up to collect the absolute minimum.
              </motion.p>

              <motion.p
                className="text-sm text-background/50 mt-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                Last updated: January 2025
              </motion.p>
            </div>
          </section>

          {/* Privacy Categories */}
          {privacyCategories.map((category, categoryIndex) => (
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
                        <AccordionContent className="text-muted-foreground leading-[1.7] pb-6 text-[17px]">
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
                <Shield className="w-12 h-12 text-primary mx-auto mb-6" />
                <h2 className="text-3xl sm:text-4xl font-light text-foreground leading-tight tracking-tight mb-4">
                  Our Philosophy
                </h2>
                <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed">
                  The best privacy policy is one where there's almost nothing to disclose. We built Kloak to prove that
                  you can create a great communication platform without surveillance. Privacy isn't a feature, it's the
                  architecture.
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

export default Privacy;
