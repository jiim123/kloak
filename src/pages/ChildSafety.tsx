import { motion } from "framer-motion";
import { NavigationMenu } from "@/components/layout/NavigationMenu";
import { Footer } from "@/components/ui/footer-section";
import { SEO } from "@/components/seo";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Shield, Eye, Lock, Globe, Database } from "lucide-react";

const csaeCategories = [
  {
    title: "Zero Tolerance Policy",
    icon: Shield,
    questions: [
      {
        q: "What is Kloak's stance on child sexual abuse and exploitation?",
        a: "Kloak maintains a zero-tolerance policy toward any form of child sexual abuse material (CSAM), child sexual exploitation, grooming, trafficking, or any activity that harms or endangers minors. Content that promotes, depicts, facilitates, or encourages the sexual exploitation of children is strictly prohibited and will result in immediate enforcement action.",
      },
      {
        q: "Does Kloak allow CSAM or exploitative content?",
        a: "No. Any content involving child sexual abuse material, exploitation of minors, grooming behavior, or attempts to facilitate sexual contact with minors is strictly forbidden. Such content is removed immediately upon detection or report.",
      },
    ],
  },
  {
    title: "Reporting & Enforcement",
    icon: Eye,
    questions: [
      {
        q: "How can users report harmful content?",
        a: "Users can report content, messages, profiles, servers, or communities that may violate our policies directly through the platform. Reports are reviewed as quickly as possible by our moderation team.",
      },
      {
        q: "What happens when a violation is found?",
        a: "Accounts, communities, and content found to violate our Child Safety Standards may be removed immediately. Depending on the severity of the violation, enforcement actions may include content removal, account suspension, permanent account termination, and referral to relevant authorities where required by law.",
      },
    ],
  },
  {
    title: "Child Safety Measures",
    icon: Lock,
    questions: [
      {
        q: "How does Kloak help protect minors?",
        a: "Kloak is committed to maintaining a safe environment for all users. We actively investigate reports involving minors, remove harmful content, and take action against users who engage in predatory or exploitative behavior.",
      },
      {
        q: "Does Kloak prohibit grooming behavior?",
        a: "Yes. Attempts to manipulate, coerce, exploit, or establish inappropriate relationships with minors are strictly prohibited. Any suspected grooming activity may result in immediate enforcement action.",
      },
    ],
  },
  {
    title: "Legal Compliance",
    icon: Globe,
    questions: [
      {
        q: "Does Kloak cooperate with law enforcement?",
        a: "Yes. When legally required, Kloak cooperates with appropriate law enforcement agencies and child protection organizations regarding reports of child sexual abuse, exploitation, or other threats to child safety.",
      },
      {
        q: "What laws and standards does Kloak follow?",
        a: "Kloak's policies are designed to comply with applicable child safety laws and platform requirements, including Google Play's Child Safety Standards and relevant regulations concerning child sexual abuse and exploitation.",
      },
    ],
  },
  {
    title: "Contact & Escalation",
    icon: Database,
    questions: [
      {
        q: "How can concerns about child safety be reported?",
        a: "Users who encounter content or behavior that may involve child sexual abuse or exploitation should report it immediately through the platform's reporting tools or by contacting our safety team.",
      },
      {
        q: "How can I contact Kloak regarding child safety concerns?",
        a: "For urgent child safety concerns, reports, or inquiries related to child sexual abuse and exploitation, please contact our dedicated safety team at safety@kloak.app. Reports involving potential child exploitation receive priority review.",
      },
    ],
  },
];

const ChildSafety = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center w-full landing-typography">
      <SEO
        title="Child Safety Standards | Kloak"
        description="Learn how Kloak protects children through strict policies against child sexual abuse and exploitation, reporting tools, enforcement actions, and cooperation with authorities."
      />

      <div className="w-full">
        <NavigationMenu />

        <main>
          {/* Hero Section */}
          <section className="relative min-h-[85vh] flex items-end overflow-hidden bg-black px-8 pb-20 text-white lg:px-16">
            <div className="relative z-10 max-w-7xl mx-auto w-full">
              <motion.div
                className="flex items-center gap-4 mb-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6 }}
              >
                <span className="text-xs font-mono text-zinc-400 tracking-widest uppercase">
                  Legal
                </span>
              </motion.div>

              <motion.h1
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light text-white leading-tight tracking-tight mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1 }}
              >
                Child Safety
                <br />
                <span className="text-zinc-500">standards.</span>
              </motion.h1>

              <motion.p
                className="text-lg md:text-xl text-zinc-300 max-w-2xl leading-relaxed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                Kloak is committed to protecting children and maintaining a platform
                free from child sexual abuse and exploitation. We enforce strict
                policies against CSAM, grooming, trafficking, and any behavior that
                endangers minors.
              </motion.p>

              <motion.p
                className="text-sm text-zinc-500 mt-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                Last updated: July 2026
              </motion.p>
            </div>
          </section>

          {/* CSAE Categories */}
          {csaeCategories.map((category, categoryIndex) => (
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

                    <span className="text-xs font-mono text-primary tracking-widest uppercase">
                      {category.title}
                    </span>
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

                        <AccordionContent className="text-muted-foreground leading-[1.8] pb-6 text-base md:text-lg">
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
                  Protecting Children Online
                </h2>

                <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed">
                  Child safety is a fundamental responsibility. Kloak maintains a
                  zero-tolerance approach to child sexual abuse and exploitation
                  and is committed to creating a safer online environment through
                  enforcement, reporting tools, and cooperation with relevant
                  authorities.
                </p>

                <div className="mt-8 pt-8 border-t border-border/20">
                  <p className="text-sm text-muted-foreground">
                    Child Safety Contact
                  </p>
                  <p className="text-primary font-medium mt-2">
                    safety@kloak.app
                  </p>
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

export default ChildSafety;