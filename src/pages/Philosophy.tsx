import {
  Heart,
  Shield,
  Lock,
  Coins,
  MessageCircle,
  Users,
  ChevronDown,
  EyeOff,
  Zap,
  Building2,
  Scale,
} from "lucide-react";
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
  accent?: "green" | "red" | "amber" | "default";
}

const FAQItem = ({ question, answer, defaultOpen = false, accent = "default" }: FAQItemProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const accentStyles = {
    green: "border-green-500/30 bg-green-500/5",
    red: "border-red-500/30 bg-red-500/5",
    amber: "border-amber-500/30 bg-amber-500/5",
    default: "border-border bg-card/50",
  };

  const iconColors = {
    green: "text-green-400",
    red: "text-red-400",
    amber: "text-amber-400",
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

const Philosophy = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO {...SEO_CONFIG.philosophy} />
      <NavigationMenu />
      <main className="flex-1 pt-20">
        <div className="max-w-3xl mx-auto px-6 py-16 w-full">
          {/* Header */}
          <div className="mb-16 text-center">
            <div className="mb-6 inline-flex items-center justify-center rounded-2xl bg-primary/10 p-4 ring-1 ring-primary/20">
              <Heart className="h-8 w-8 text-primary" />
            </div>
            <h1 className="mb-3 text-3xl font-semibold tracking-tight md:text-4xl">Our Philosophy</h1>
            <p className="text-muted-foreground">Why we built Kloak the way we did</p>
          </div>

          {/* Hero card */}
          <div className="relative mb-12 overflow-hidden rounded-3xl border border-primary/20 bg-primary/5 p-8">
            <div className="text-center">
              <p className="text-lg md:text-xl text-foreground/90 leading-relaxed font-medium italic">
                "Communication should be completely private. It should not be tracked, analyzed, or sold. Ever."
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                This isn't a marketing slogan. It's the engineering specification.
              </p>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="space-y-4">
            <FAQItem
              question="Why does Kloak exist?"
              defaultOpen={true}
              answer={
                <div className="space-y-3">
                  <p>
                    Because somewhere along the way, we all accepted that free communication platforms would spy on us.
                    That our messages would be scanned for advertising keywords. That our social connections would be
                    mapped, analyzed, and sold. That "free" meant we were the product.
                  </p>
                  <p>We built Kloak because we refused to accept that this is just how things have to be.</p>
                  <p>
                    The technology exists to build private communication platforms. The business models exist to sustain
                    them without surveillance. The only reason Big Tech doesn't do it is because your data is worth more
                    to them than your trust. We made a different choice.
                  </p>
                </div>
              }
            />

            <FAQItem
              question="What do you mean 'privacy is the architecture'?"
              accent="green"
              answer={
                <div className="space-y-3">
                  <p>
                    Most platforms treat privacy as a feature—a settings toggle, a checkbox in preferences, a thing you
                    can turn on after they've already collected everything about you. "Privacy mode" that still tracks
                    you, just slightly less. "Incognito" that isn't really incognito.
                  </p>
                  <p>At Kloak, privacy isn't a feature. It's a constraint we designed around from day one.</p>
                  <p>
                    We don't collect your email because the system doesn't need it. We don't track your location because
                    the system doesn't ask for it. We can't sell your data because we never built the infrastructure to
                    collect it in the first place.
                  </p>
                  <p>
                    This is what we mean by privacy as architecture: we built the walls without doors, so there's
                    nothing to lock. We can't betray your privacy even if we wanted to—and we don't want to.
                  </p>
                </div>
              }
            />

            <FAQItem
              question="Why no email or password?"
              answer={
                <div className="space-y-3">
                  <p>
                    Your email address is the skeleton key to your digital identity. It links your shopping habits to
                    your political views to your medical searches to your dating profile. Every company that has it can
                    connect the dots. Every breach exposes the same identifier across a dozen services.
                  </p>
                  <p>
                    Phone numbers are even worse—they're tied to your legal identity, can be used for SIM-swapping
                    attacks, and create a direct line to the real-world you.
                  </p>
                  <p>
                    We use cryptographic secret keys instead. It's the same technology securing billions of dollars in
                    cryptocurrency. Your key is generated on your device, stays on your device, and proves you're you
                    without telling us anything about who "you" actually is.
                  </p>
                  <p>
                    The tradeoff is real: lose your key, lose your account. We can't help you recover it because we
                    don't have it. But that's not a bug—it's proof that the system works. We literally cannot be forced
                    to give someone else access to your account, because we don't have the keys to the kingdom.
                  </p>
                </div>
              }
            />

            <FAQItem
              question="Why not just use end-to-end encryption?"
              answer={
                <div className="space-y-3">
                  <p>End-to-end encryption is necessary but not sufficient.</p>
                  <p>
                    Sure, encrypted messages can't be read in transit. But most "encrypted" platforms still collect
                    everything around the message: who you talked to, when, how often, from where, on what device. They
                    build social graphs. They analyze patterns. They know you messaged your ex at 2am even if they can't
                    read what you said.
                  </p>
                  <p>
                    Metadata is data. Sometimes it's more revealing than content. "Subject: Re: Your test results" tells
                    you plenty even if the body is encrypted.
                  </p>
                  <p>
                    Real privacy means minimizing collection at every layer—not just encrypting the payload while
                    hoovering up everything else. Encryption is one tool. Architecture is the whole toolbox.
                  </p>
                </div>
              }
            />

            <FAQItem
              question="What's wrong with how other platforms work?"
              accent="red"
              answer={
                <div className="space-y-3">
                  <p>Nothing—if you're comfortable being the product.</p>
                  <p>
                    Here's how "free" platforms actually work: they provide communication services in exchange for
                    comprehensive surveillance of your digital life. Every message scanned for advertising keywords.
                    Every friendship mapped into a social graph. Every behavior analyzed to predict what you'll buy, who
                    you'll vote for, what you're insecure about.
                  </p>
                  <p>
                    This data is packaged and sold to advertisers, data brokers, political campaigns, insurance
                    companies, and anyone else willing to pay. It's used to manipulate your feed, exploit your
                    psychology, and keep you scrolling. The platform's interests are structurally opposed to yours.
                  </p>
                  <p>
                    We're not saying these platforms are evil. We're saying their business model makes privacy
                    impossible. They can't stop spying on you because spying on you is how they make money. Every
                    "privacy feature" they ship is a compromise between your interests and their revenue.
                  </p>
                  <p>We chose a different business model so we could make different choices.</p>
                </div>
              }
            />

            <FAQItem
              question="Why do you charge money instead of showing ads?"
              accent="amber"
              answer={
                <div className="space-y-3">
                  <p>Because whoever pays the bills calls the shots.</p>
                  <p>
                    When advertisers pay, the platform optimizes for advertiser interests: engagement, addiction,
                    surveillance, manipulation. Your attention becomes the product being sold. Every feature decision
                    weighs "will this increase ad revenue?" before "will this help users?"
                  </p>
                  <p>
                    When you pay directly, we work for you. Our incentive is to make Kloak good enough that you keep
                    paying—not to make it addictive enough that advertisers keep paying. We succeed when you're
                    satisfied, not when you're manipulated.
                  </p>
                  <p>
                    This is why we'll never have ads. Not "no ads for premium users." Not "minimal, respectful ads." No
                    ads, ever. The moment we take advertising money, our interests diverge from yours. We're not willing
                    to do that.
                  </p>
                </div>
              }
            />

            <FAQItem
              question="Will you ever add micro-transactions or premium cosmetics?"
              accent="red"
              answer={
                <div className="space-y-3">
                  <p>No. Never.</p>
                  <p>
                    Micro-transactions, premium emojis, paid stickers, loot boxes, "supporter packs," battle
                    passes—these systems are designed by psychologists to extract maximum money from users. They exploit
                    FOMO, social pressure, gambling instincts, and artificial scarcity. They're particularly effective
                    at targeting vulnerable people: kids, people with addictive tendencies, people who feel socially
                    excluded.
                  </p>
                  <p>We find this gross. We're not going to do it.</p>
                  <p>
                    If you pay for Kloak, you get Kloak. All of it. Not "basic Kloak with premium features locked behind
                    additional payments." Not "free Kloak where paying users get special status symbols." Just... the
                    platform. Working. For you.
                  </p>
                  <p>
                    Themes, customization, emojis—they're part of the product, not monetization vectors. We're not going
                    to nickel-and-dime you for the ability to express yourself.
                  </p>
                </div>
              }
            />

            <FAQItem
              question="What about AI and machine learning?"
              answer={
                <div className="space-y-3">
                  <p>We're not anti-AI. We're anti-surveillance.</p>
                  <p>
                    The problem with AI in most platforms isn't the technology—it's how it's used. Scanning your
                    messages to build advertising profiles. Analyzing your behavior to predict and manipulate your
                    choices. Training models on your private conversations without consent.
                  </p>
                  <p>
                    We don't do any of that. We don't scan your messages with AI. We don't build behavioral models. We
                    don't train anything on your data. If we ever add AI features, they'll be opt-in, transparent about
                    what they do, and won't require shipping your data to third parties.
                  </p>
                  <p>AI that helps you is great. AI that surveils you is not. The distinction matters.</p>
                </div>
              }
            />

            <FAQItem
              question="How do you handle illegal content?"
              answer={
                <div className="space-y-3">
                  <p>Privacy isn't a shield for criminals.</p>
                  <p>
                    We built Kloak to protect ordinary people from mass surveillance—not to help bad actors evade
                    accountability. There's a clear difference between "we don't spy on everyone" and "we protect
                    criminals." We're firmly in the first camp.
                  </p>
                  <p>
                    When illegal content is reported to us—particularly child exploitation material—we act immediately.
                    We terminate accounts, preserve evidence, and report to authorities. We maintain minimal logs
                    specifically so we can cooperate with legitimate legal requests when serious crimes are involved.
                  </p>
                  <p>
                    The philosophy isn't "no cooperation ever." It's "no mass surveillance, but targeted response to
                    serious crimes." We don't scan every message looking for violations. But when violations are
                    reported, we take them seriously.
                  </p>
                </div>
              }
            />

            <FAQItem
              question="What's your long-term vision?"
              accent="green"
              answer={
                <div className="space-y-3">
                  <p>A world where private communication is normal, not a luxury.</p>
                  <p>
                    Right now, privacy-respecting platforms are niche. They're for "people with something to hide," for
                    the paranoid, for the technically sophisticated. That's backwards. Privacy should be the default,
                    not the exception.
                  </p>
                  <p>
                    We want to prove that you can build a sustainable business on respecting users instead of exploiting
                    them. That surveillance capitalism isn't inevitable—it's a choice, and we can choose differently.
                    That when given the option, people will pay for products that don't spy on them.
                  </p>
                  <p>
                    Kloak might not change the world. But if we can demonstrate that the model works—that privacy and
                    usability and profitability can coexist—maybe others will follow. Maybe the next generation of
                    platforms won't assume surveillance is the only way.
                  </p>
                  <p>That's the goal. One conversation at a time.</p>
                </div>
              }
            />
          </div>

          {/* Philosophy footer */}
          <div className="mt-12 flex items-start gap-4 rounded-2xl border border-border/50 bg-muted/30 p-6">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
              <Scale className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="mb-1 font-medium text-foreground/90">The Bottom Line</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Kloak exists because we believe there should be a place where people can communicate without being the
                product. Where privacy isn't a premium feature. Where your conversations are truly your own. That's not
                idealism—it's just how things should be.
              </p>
            </div>
          </div>
        </div>
        <Footer />
      </main>
    </div>
  );
};

export default Philosophy;
