import { Cookie, Check, X, ChevronDown, Shield, Sparkles } from "lucide-react";
import { Footer } from "@/components/ui/footer-section";
import { NavigationMenu } from "@/components/layout/NavigationMenu";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { SEO } from "@/components/seo";
import { SEO_CONFIG } from "@/lib/seo";

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

const NoCookieCard = ({ name, whyTheyUseIt, whyWeDont }: { name: string; whyTheyUseIt: string; whyWeDont: string }) => (
  <div className="rounded-xl border border-border/50 bg-card/30 p-4 transition-all duration-300 hover:bg-card/50">
    <div className="mb-3 flex items-center gap-2">
      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-red-500/15">
        <X className="h-3.5 w-3.5 text-red-400" />
      </div>
      <h4 className="font-medium text-foreground/90">{name}</h4>
    </div>
    <div className="space-y-2 text-sm">
      <p className="text-muted-foreground">
        <span className="text-foreground/60">Why Big Tech uses them:</span> {whyTheyUseIt}
      </p>
      <p className="text-foreground/70">
        <span className="text-green-400">Why we don't:</span> {whyWeDont}
      </p>
    </div>
  </div>
);

const Cookies = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO {...SEO_CONFIG.cookies} />
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
                  notes your browser keeps to make your experience smoother. The problem is, most companies use them to
                  take notes about <em>you</em> instead of <em>for</em> you.
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
                <div className="space-y-4">
                  <p>
                    This is where it gets interesting. Here's everything we intentionally don't use—and why the rest of
                    the industry can't seem to quit them:
                  </p>
                  <div className="grid gap-3">
                    <NoCookieCard
                      name="Analytics Cookies"
                      whyTheyUseIt="To track every click, scroll, and hover. To know exactly how long you stared at that product before deciding you couldn't afford it. This data gets packaged and sold, or used to optimize for 'engagement' (read: addiction)."
                      whyWeDont="We don't need to know your every move to build a good product. If something's broken, you'll tell us. If something's great, you'll keep using it. Revolutionary concept, we know."
                    />
                    <NoCookieCard
                      name="Advertising Cookies"
                      whyTheyUseIt="To follow you around the internet like a persistent salesperson. Looked at running shoes once? Congratulations, you'll see them in your dreams for the next six months. This is how 'free' platforms actually make money—by selling your attention to the highest bidder."
                      whyWeDont="You pay us directly. That's the whole point. We don't need to monetize your eyeballs because you're our customer, not our product. No ads means no ad tracking. Simple."
                    />
                    <NoCookieCard
                      name="Social Media Pixels"
                      whyTheyUseIt="Those little Facebook and Twitter buttons aren't just for sharing—they're surveillance outposts. They report back to headquarters every site you visit, building a shadow profile even if you don't click anything."
                      whyWeDont="We genuinely don't care about growing our social media presence at the cost of your privacy. No share buttons, no tracking pixels, no silent data collection. If you want to tell people about Kloak, use your words."
                    />
                    <NoCookieCard
                      name="Third-Party Trackers"
                      whyTheyUseIt="Most sites load dozens of external scripts—analytics, A/B testing, heat mapping, session recording. Each one is another company with access to your data, another privacy policy you never read, another potential data breach waiting to happen."
                      whyWeDont="Every third-party script is a liability. We built everything in-house because your conversations shouldn't pass through a dozen different companies just so we can see which button color gets more clicks."
                    />
                    <NoCookieCard
                      name="Cross-Site Cookies"
                      whyTheyUseIt="To build a complete picture of your online life across every website you visit. Your shopping habits, your political views, your health concerns—all stitched together into a profile that's worth real money to advertisers and data brokers."
                      whyWeDont="What you do on Kloak stays on Kloak. What you do elsewhere is none of our business. We're a communication platform, not a private investigation firm."
                    />
                    <NoCookieCard
                      name="Device Fingerprinting"
                      whyTheyUseIt="When you block cookies, they get creative. By combining your screen resolution, installed fonts, browser plugins, and dozens of other signals, they can identify you with alarming accuracy—no cookies required."
                      whyWeDont="We authenticate you with cryptographic keys, not surveillance techniques. We don't need to identify your device because we're not trying to track you—we're just trying to make sure you are who you say you are."
                    />
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
                <div className="space-y-3">
                  <p>
                    You know those annoying popups that guilt-trip you into "accepting all" with a tiny, hard-to-find
                    "manage preferences" link? Those exist because companies need your permission to track you.
                  </p>
                  <p>
                    Under GDPR and similar regulations, consent banners are only required for non-essential cookies.
                    Since Kloak only uses strictly necessary cookies for the service to function, no consent banner is
                    legally required.
                  </p>
                  <p>
                    It's one less annoyance for you—and honestly, it's kind of nice not having to design a popup that
                    manipulates people into giving up their privacy.
                  </p>
                </div>
              }
            />

            <FAQItem
              question="But how do you improve the product without analytics?"
              answer={
                <div className="space-y-3">
                  <p>
                    This is the question Big Tech wants you to think has no answer. "We need your data to improve!" they
                    say, while coincidentally making billions selling that same data.
                  </p>
                  <p>
                    Here's our secret: we talk to our users. Radical, we know. We read feedback, we respond to support
                    requests, we pay attention to what people ask for. We use aggregate, anonymized server metrics to
                    know if the service is working—not to build psychological profiles of our users.
                  </p>
                  <p>
                    Turns out you can build a great product by actually listening to people instead of surveilling them.
                    The bar is just that low.
                  </p>
                </div>
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
