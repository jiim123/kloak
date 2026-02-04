import { NavigationMenu } from "@/components/layout/NavigationMenu";
import { SEO } from "@/components/seo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Shield, Key, Users } from "lucide-react";

const faqCategories = [
  {
    title: "About Kloak",
    icon: Shield,
    questions: [
      {
        q: "What is Kloak?",
        a: "Kloak is a privacy-first communication platform designed for real-time messaging. It functions similarly to Discord, offering servers, channels, direct messages, and voice chat—but with a fundamental difference: your privacy is the architecture, not a feature.",
      },
      {
        q: "Who is Kloak for?",
        a: "Kloak is for anyone who values their digital privacy. Whether you're a community organizer, a group of friends, a team, or just someone tired of platforms harvesting your data—Kloak gives you a space to communicate without surveillance.",
      },
      {
        q: "Why is Kloak privacy-focused?",
        a: "We believe communication is a fundamental right that shouldn't come with strings attached. Traditional platforms require your email, phone number, and track your behavior to monetize you. Kloak was built from the ground up to prove that great communication tools don't need to compromise your privacy.",
      },
      {
        q: "What features does Kloak offer?",
        a: "Kloak includes servers with text and voice channels, channel categories, direct messaging (1-to-1 and group), real-time chat with reactions and replies, file attachments, user presence indicators, a friend system, customizable profiles, and notifications—all without requiring personal information.",
      },
    ],
  },
  {
    title: "Authentication & Security",
    icon: Key,
    questions: [
      {
        q: "How does authentication work without email or password?",
        a: "When you create an account, Kloak generates a unique 64-character cryptographic secret key. This key is your identity—no email, phone number, or password required. You simply paste your key to log in from any device.",
      },
      {
        q: "What happens if I lose my secret key?",
        a: "Your secret key is the only way to access your account. By design, we cannot recover it for you—this ensures true privacy since we don't store any information that could identify you. Always save your key in a secure location like a password manager.",
      },
      {
        q: "Where can I find my secret key after signing up?",
        a: "After creating your account, your key is displayed once. You can always view it again by going to User Settings → Account → View Secret Key while logged in. We strongly recommend saving it immediately after account creation.",
      },
      {
        q: "Is my data encrypted?",
        a: "Your secret key is hashed using SHA-256 before being stored—we never see or store your actual key. Messages are transmitted securely over encrypted connections. Your conversations belong to you.",
      },
    ],
  },
  {
    title: "Using Kloak",
    icon: Users,
    questions: [
      {
        q: "How do I create or join a server?",
        a: "To create a server, click the '+' button in the server sidebar and choose 'Create Server.' To join an existing server, you'll need an invite code from a server member—paste it in the 'Join Server' dialog or use a direct invite link.",
      },
      {
        q: "Can I use Kloak on multiple devices?",
        a: "Yes! Since your identity is your secret key, you can log in from any device by pasting your key. Your servers, messages, and friends will sync across all devices.",
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
    <>
      <SEO
        title="FAQ"
        description="Frequently asked questions about Kloak. Learn about our privacy-first approach, secret key authentication, and how to use the platform."
      />
      <div className="min-h-screen bg-background">
        <NavigationMenu />

        <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                Frequently Asked Questions
              </h1>
              <p className="text-muted-foreground text-lg">
                Everything you need to know about Kloak
              </p>
            </div>

            {/* FAQ Categories */}
            <div className="space-y-8">
              {faqCategories.map((category) => (
                <section key={category.title}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <category.icon className="w-5 h-5 text-primary" />
                    </div>
                    <h2 className="text-xl font-semibold">{category.title}</h2>
                  </div>

                  <Accordion type="single" collapsible className="space-y-2">
                    {category.questions.map((item, index) => (
                      <AccordionItem
                        key={index}
                        value={`${category.title}-${index}`}
                        className="border border-border/50 rounded-xl px-4 data-[state=open]:bg-secondary/30"
                      >
                        <AccordionTrigger className="text-left font-medium hover:no-underline">
                          {item.q}
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground leading-relaxed">
                          {item.a}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </section>
              ))}
            </div>

            {/* Footer CTA */}
            <div className="mt-16 text-center p-6 rounded-2xl bg-secondary/30 border border-border/30">
              <p className="text-muted-foreground mb-2">
                Still have questions?
              </p>
              <p className="text-sm text-muted-foreground">
                Join our community server to get help from other Kloak users.
              </p>
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default FAQ;
