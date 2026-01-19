import { Shield, Eye, EyeOff, Database, Lock, Trash2, ChevronDown, Server, Scale, Clock } from "lucide-react";
import { Footer } from "@/components/ui/footer-section";
import { NavigationMenu } from "@/components/layout/NavigationMenu";
import { useState } from "react";
import { cn } from "@/lib/utils";

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

const DataCard = ({
  name,
  description,
  icon: Icon,
}: {
  name: string;
  description: string;
  icon: React.ElementType;
}) => (
  <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 p-4 transition-all duration-300 hover:border-amber-500/30 hover:bg-card">
    <div className="mb-2 flex items-center gap-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
        <Icon className="h-4 w-4 text-amber-400" />
      </div>
      <h4 className="font-medium text-foreground/90">{name}</h4>
    </div>
    <p className="text-sm text-muted-foreground">{description}</p>
  </div>
);

const NotCollectedCard = ({ name, reason }: { name: string; reason: string }) => (
  <div className="rounded-xl border border-border/50 bg-card/30 p-4 transition-all duration-300 hover:bg-card/50">
    <div className="mb-2 flex items-center gap-2">
      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-500/15">
        <EyeOff className="h-3.5 w-3.5 text-green-400" />
      </div>
      <h4 className="font-medium text-foreground/90">{name}</h4>
    </div>
    <p className="text-sm text-muted-foreground">{reason}</p>
  </div>
);

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <NavigationMenu />
      <main className="flex-1 pt-20">
        <div className="max-w-3xl mx-auto px-6 py-16 w-full">
          {/* Header */}
          <div className="mb-16 text-center">
            <div className="mb-6 inline-flex items-center justify-center rounded-2xl bg-primary/10 p-4 ring-1 ring-primary/20">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <h1 className="mb-3 text-3xl font-semibold tracking-tight md:text-4xl">Privacy Policy</h1>
            <p className="text-muted-foreground">Last updated: January 2025</p>
          </div>

          {/* Hero card */}
          <div className="relative mb-12 overflow-hidden rounded-3xl border border-primary/20 bg-primary/5 p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/30">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="mb-2 text-xl font-medium text-foreground">Privacy is Our Architecture</h2>
                <p className="text-foreground/70 leading-relaxed">
                  Unlike most platforms, Kloak was built from the ground up with privacy as the foundation—not an
                  afterthought. We don't collect what we don't need, and we can't share what we don't have. This isn't
                  just policy, it's engineering.
                </p>
              </div>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="space-y-4">
            <FAQItem
              question="What personal information do you collect?"
              defaultOpen={true}
              accent="amber"
              answer={
                <div className="space-y-4">
                  <p>
                    Only what's absolutely necessary to make Kloak work. We've designed the system to function with
                    minimal data—not because regulations forced us to, but because that's how privacy-respecting
                    software should be built.
                  </p>
                  <div className="grid gap-3">
                    <DataCard
                      name="Username"
                      description="A name you choose to identify yourself. Doesn't have to be your real name—we genuinely don't care who you are in the physical world."
                      icon={Eye}
                    />
                    <DataCard
                      name="Secret Key Hash"
                      description="A one-way cryptographic hash of your secret key. We never store your actual key—only a mathematical fingerprint that lets us verify you without knowing the original. Even if someone stole our database, they couldn't log in as you."
                      icon={Lock}
                    />
                    <DataCard
                      name="Messages & Content"
                      description="Text messages, uploaded files, and reactions you create. These are stored to enable communication between users. We're a messaging platform—this one's kind of unavoidable."
                      icon={Database}
                    />
                    <DataCard
                      name="Profile Information"
                      description="Optional display name, avatar, bio, and status. All chosen by you, all optional. Express yourself or don't—your call."
                      icon={Eye}
                    />
                    <DataCard
                      name="Server Membership"
                      description="Records of which servers you've joined and your role within them. Necessary for, you know, letting you access your servers."
                      icon={Server}
                    />
                  </div>
                </div>
              }
            />

            <FAQItem
              question="What DON'T you collect?"
              accent="green"
              answer={
                <div className="space-y-4">
                  <p>
                    This is the fun part. Here's everything we intentionally don't ask for—and why Big Tech can't seem
                    to live without it:
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <NotCollectedCard
                      name="Email Address"
                      reason="The universal identifier. Once a company has your email, they can link your activity across services, sell it to marketers, and spam you forever. We use cryptographic keys instead."
                    />
                    <NotCollectedCard
                      name="Phone Number"
                      reason="Even more valuable than email—it's tied to your real identity, can be used for SIM swapping attacks, and is a goldmine for identity verification services. Hard pass."
                    />
                    <NotCollectedCard
                      name="Real Name"
                      reason="We're not the government. You can be whoever you want on Kloak. Your identity is your business."
                    />
                    <NotCollectedCard
                      name="Physical Address"
                      reason="Unless we're mailing you something (we're not), there's zero reason to know where you live. This data just sits in databases waiting to be leaked."
                    />
                    <NotCollectedCard
                      name="Payment Information"
                      reason="Payments are handled by secure third-party processors. Your credit card number never touches our servers. We couldn't charge you twice if we wanted to."
                    />
                    <NotCollectedCard
                      name="Location Data"
                      reason="We don't track where you are, where you've been, or where you're going. Your movements are none of our business."
                    />
                    <NotCollectedCard
                      name="Biometric Data"
                      reason="No face scans, no fingerprints, no voice prints. Biometrics are forever—you can't change your face after a data breach."
                    />
                    <NotCollectedCard
                      name="Device Fingerprints"
                      reason="We don't catalog your screen resolution, installed fonts, or browser plugins to create a unique identifier. That's surveillance, not authentication."
                    />
                  </div>
                </div>
              }
            />

            <FAQItem
              question="Why no email or phone number for login?"
              answer={
                <div className="space-y-3">
                  <p>
                    Most platforms require email and phone "for security" or "account recovery." The real reasons? Email
                    is the universal tracking ID that links your activity across the entire internet. Phone numbers are
                    even better—they're tied to your legal identity and can be used to verify you're a real person (and
                    therefore a valuable advertising target).
                  </p>
                  <p>
                    We use cryptographic secret keys instead. It's the same technology that secures billions of dollars
                    in cryptocurrency. Your key is generated on your device, stays on your device, and proves you're you
                    without telling us anything about who "you" actually is.
                  </p>
                  <p>
                    The tradeoff? If you lose your key, we can't help you recover your account. There's no "forgot
                    password" email because there's no email. This is a feature, not a bug—it means we literally cannot
                    be compelled to give someone else access to your account.
                  </p>
                </div>
              }
            />

            <FAQItem
              question="How do you use my data?"
              answer={
                <div className="space-y-3">
                  <p>
                    Boringly. We use your data to make Kloak work. That's it. No "improving your experience" euphemisms
                    for building advertising profiles. No "personalization" that's actually surveillance.
                  </p>
                  <ul className="space-y-2 text-foreground/70">
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/50" />
                      <span>
                        <strong className="text-foreground/90">Authentication:</strong> Verifying your identity when you
                        log in with your secret key
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/50" />
                      <span>
                        <strong className="text-foreground/90">Message Delivery:</strong> Storing and transmitting your
                        messages to intended recipients (shocking, we know)
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/50" />
                      <span>
                        <strong className="text-foreground/90">Presence & Status:</strong> Showing your online status to
                        friends and server members
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/50" />
                      <span>
                        <strong className="text-foreground/90">Notifications:</strong> Alerting you to mentions, friend
                        requests, and messages
                      </span>
                    </li>
                  </ul>
                  <p>
                    We don't analyze your messages for advertising keywords. We don't build psychological profiles. We
                    don't sell "insights" to third parties. We just... deliver your messages. Revolutionary.
                  </p>
                </div>
              }
            />

            <FAQItem
              question="Do you sell or share my data?"
              accent="red"
              answer={
                <div className="space-y-3">
                  <p className="text-base font-medium text-foreground/90">No. Full stop.</p>
                  <p>
                    We don't sell your data. We don't rent it. We don't trade it. We don't "share it with partners to
                    improve your experience." We don't give it to advertisers, data brokers, or anyone else who asks
                    nicely.
                  </p>
                  <p>
                    Could we make money selling your data? Absolutely. That's the entire business model of Big Tech. But
                    we chose a different path: you pay us directly, and in exchange, we work for you instead of
                    advertisers. Radical concept.
                  </p>
                  <p>
                    The only exception: if legally required by Swedish law (where our servers are hosted), we may have
                    to comply with valid legal requests. But here's the thing—we've collected so little data that
                    there's almost nothing to hand over. Can't share what we don't have.
                  </p>
                </div>
              }
            />

            <FAQItem
              question="How can I delete my data?"
              accent="red"
              answer={
                <div className="space-y-3">
                  <p>
                    You can delete your account at any time from the settings menu. No "are you sure?" emails, no 30-day
                    waiting periods designed to make you give up, no dark patterns to keep you around.
                  </p>
                  <p>When you delete your account:</p>
                  <ul className="space-y-2 text-foreground/70">
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400/50" />
                      <span>Your profile and personal data are permanently removed</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400/50" />
                      <span>
                        Your messages may remain in servers but will show as from "Deleted User"—preserving conversation
                        context without identifying you
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400/50" />
                      <span>
                        This action is immediate and irreversible—we don't secretly keep your data "just in case"
                      </span>
                    </li>
                  </ul>
                  <p>
                    When we say delete, we mean delete. Not "archived," not "anonymized," not "retained for legal
                    purposes." Gone.
                  </p>
                </div>
              }
            />

            <FAQItem
              question="What about legal requests and government access?"
              answer={
                <div className="space-y-3">
                  <p>
                    We're based in Sweden and our servers are in Sweden. This means we operate under Swedish and EU law,
                    not U.S. law. We can't be compelled by U.S. National Security Letters or secret FISA court orders.
                  </p>
                  <p>
                    If we receive a valid legal request under Swedish law, we'll comply with what's legally required—but
                    only what's legally required. We'll also notify affected users unless legally prohibited from doing
                    so.
                  </p>
                  <p>
                    Here's the key point: our privacy architecture means we have very little to hand over even if
                    compelled. We don't have your email, your phone number, your real name, your location history, or
                    your payment details. We can't decrypt your messages in transit. The best protection against
                    government overreach is simply not having the data in the first place.
                  </p>
                </div>
              }
            />

            <FAQItem
              question="Will this policy change?"
              answer={
                <div className="space-y-3">
                  <p>
                    We may update this policy occasionally—usually to clarify language or reflect new features. We'll
                    always indicate the date of the last update at the top of this page.
                  </p>
                  <p>
                    What won't change: our fundamental commitment to minimal data collection and user privacy. We built
                    Kloak specifically because we were tired of platforms that treat privacy as a marketing checkbox
                    rather than an engineering principle. That's not changing.
                  </p>
                  <p>
                    Continued use of Kloak after policy changes constitutes acceptance. But honestly, if we ever betray
                    the principles on this page, you should leave—and we'd deserve it.
                  </p>
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
                Most privacy policies are written to protect companies from lawsuits. Ours is written to explain why we
                built things differently. We collect less, store less, and share nothing—because that's what respecting
                your privacy actually looks like.
              </p>
            </div>
          </div>
        </div>
        <Footer />
      </main>
    </div>
  );
};

export default Privacy;
