import { Cookie, Check, X, ChevronDown, Shield, Sparkles } from "lucide-react";
import { Footer } from "@/components/ui/footer-section";
import { NavigationMenu } from "@/components/layout/NavigationMenu";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface FAQItemProps {
  question: string;
  answer: React.ReactNode;
  defaultOpen?: boolean;
  accent?: "green" | "red" | "default";
}

const FAQItem = ({ question, answer, defaultOpen = false, accent = "default" }: FAQItemProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const accentStyles = {
    green: "border-green-500/30 bg-green-500/5",
    red: "border-red-500/30 bg-red-500/5",
    default: "border-border bg-card/50",
  };

  const iconColors = {
    green: "text-green-400",
    red: "text-red-400",
    default: "text-primary",
  };

  return (
    <div
      className={cn(
        "group rounded-2xl border transition-all duration-300",
        accentStyles[accent],
        isOpen ? "shadow-lg shadow-black/5" : "hover:shadow-md hover:shadow-black/5",
      )}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-4 p-5 text-left"
      >
        <span className="text-base font-medium text-foreground/90 group-hover:text-foreground transition-colors">
          {question}
        </span>
        <ChevronDown
          className={cn(
            "h-5 w-5 flex-shrink-0 transition-transform duration-300",
            iconColors[accent],
            isOpen && "rotate-180",
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-all duration-300 ease-out",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-5 pt-0 text-sm leading-relaxed text-foreground/70">{answer}</div>
        </div>
      </div>
    </div>
  );
};

const CookieCard = ({ name, description, duration }: { name: string; description: string; duration: string }) => (
  <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 p-4 transition-all duration-300 hover:border-green-500/30 hover:bg-card">
    <div className="mb-2 flex items-center justify-between">
      <h4 className="font-medium text-foreground/90">{name}</h4>
      <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-400">
        <Check className="h-3 w-3" />
        Essential
      </span>
    </div>
    <p className="mb-2 text-sm text-muted-foreground">{description}</p>
    <p className="text-xs text-muted-foreground/70">
      <span className="text-foreground/50">Duration:</span> {duration}
    </p>
  </div>
);

const NoCookieItem = ({ name, description }: { name: string; description: string }) => (
  <div className="flex items-start gap-3 rounded-lg border border-red-500/10 bg-red-500/5 p-3 transition-all duration-200 hover:border-red-500/20 hover:bg-red-500/10">
    <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-red-500/20">
      <X className="h-3 w-3 text-red-400" />
    </div>
    <div>
      <span className="text-sm font-medium text-foreground/90">{name}</span>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  </div>
);

const Cookies = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <NavigationMenu />
      <main className="flex-1 pt-20">
        <div className="max-w-3xl mx-auto px-6 py-16 w-full">
          {/* Header */}
          <div className="mb-16 text-center">
            <div className="mb-6 inline-flex items-center justify-center rounded-2xl bg-primary/10 p-4 ring-1 ring-primary/20">
              <Cookie className="h-8 w-8 text-primary" />
            </div>
            <h1 className="mb-3 text-3xl font-semibold tracking-tight md:text-4xl">Cookie Policy</h1>
            <p className="text-muted-foreground">Last updated: January 2025</p>
          </div>

          {/* Hero card */}
          <div className="relative mb-12 overflow-hidden rounded-3xl border border-green-500/20 bg-green-500/5 p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-green-500/15 ring-1 ring-green-500/30">
                <Sparkles className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <h2 className="mb-2 text-xl font-medium text-foreground">Good News: We Keep It Simple</h2>
                <p className="text-foreground/70 leading-relaxed">
                  Kloak uses only essential cookies required for the application to function. No tracking cookies, no
                  advertising cookies, no third-party analytics. Just what's necessary to give you a great experience.
                </p>
              </div>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="space-y-4">
            <FAQItem
              question="What are cookies?"
              defaultOpen={true}
              answer={
                <p>
                  Cookies are small text files stored on your device when you visit a website. They help websites
                  remember information about your visit, like your preferences and login status. Think of them as tiny
                  notes your browser keeps to make your experience smoother.
                </p>
              }
            />

            <FAQItem
              question="What cookies does Kloak use?"
              accent="green"
              answer={
                <div className="space-y-3">
                  <p className="mb-4">
                    We only use essential cookies stored in your browser's Local Storage—strictly what's necessary for
                    Kloak to work:
                  </p>
                  <div className="grid gap-3">
                    <CookieCard
                      name="Secret Key"
                      description="Stores your encrypted authentication key locally so you stay logged in."
                      duration="Until you log out or clear browser data"
                    />
                    <CookieCard
                      name="Theme Preference"
                      description="Remembers your preferred theme for a consistent visual experience."
                      duration="Persistent until cleared"
                    />
                    <CookieCard
                      name="Message Drafts"
                      description="Saves unsent messages so you don't lose them if you navigate away."
                      duration="Until message is sent"
                    />
                    <CookieCard
                      name="UI Preferences"
                      description="Stores settings like sidebar state and notification preferences."
                      duration="Persistent until cleared"
                    />
                  </div>
                </div>
              }
            />

            <FAQItem
              question="What cookies does Kloak NOT use?"
              accent="red"
              answer={
                <div className="space-y-3">
                  <p className="mb-4">
                    We believe in privacy by design. Here's everything we intentionally don't track:
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <NoCookieItem name="Analytics cookies" description="No Google Analytics or similar" />
                    <NoCookieItem name="Advertising cookies" description="No ad tracking or retargeting" />
                    <NoCookieItem name="Social media cookies" description="No Facebook, Twitter pixels" />
                    <NoCookieItem name="Third-party trackers" description="No external tracking scripts" />
                    <NoCookieItem name="Cross-site cookies" description="No tracking across websites" />
                    <NoCookieItem name="Device fingerprinting" description="No browser fingerprinting" />
                  </div>
                </div>
              }
            />

            <FAQItem
              question="How can I manage or delete cookies?"
              answer={
                <div className="space-y-3">
                  <p>Since we only use essential cookies stored in Local Storage, you have complete control:</p>
                  <ul className="space-y-2 text-foreground/70">
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/50" />
                      <span>
                        <strong className="text-foreground/90">Clear all data:</strong> Use your browser's "Clear
                        browsing data" feature to remove all stored data
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/50" />
                      <span>
                        <strong className="text-foreground/90">Log out:</strong> Logging out automatically clears your
                        authentication data
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/50" />
                      <span>
                        <strong className="text-foreground/90">Browser settings:</strong> You can disable Local Storage
                        entirely, but this will prevent Kloak from working properly
                      </span>
                    </li>
                  </ul>
                </div>
              }
            />

            <FAQItem
              question="Why don't I see a cookie consent banner?"
              answer={
                <p>
                  Great question! Under privacy regulations like GDPR, consent banners are only required for
                  non-essential cookies like tracking and advertising. Since Kloak only uses strictly necessary cookies
                  for the service to function, no consent banner is legally required. It's one less annoyance for
                  you—and a reflection of our privacy-first approach.
                </p>
              }
            />
          </div>

          {/* Philosophy footer */}
          <div className="mt-12 flex items-start gap-4 rounded-2xl border border-border/50 bg-muted/30 p-6">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="mb-1 font-medium text-foreground/90">Our Philosophy</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                The best cookie policy is one where there's almost nothing to disclose. We only store what's necessary
                for you to use Kloak—nothing more. Privacy isn't a feature, it's the architecture.
              </p>
            </div>
          </div>
        </div>
        <Footer />
      </main>
    </div>
  );
};

export default Cookies;
