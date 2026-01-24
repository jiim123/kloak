import {
  FileText,
  Key,
  Users,
  MessageSquare,
  Server,
  Zap,
  Scale,
  Gavel,
  RefreshCw,
  ChevronDown,
  AlertTriangle,
  ShieldCheck,
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

const Terms = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO {...SEO_CONFIG.terms} />
      <NavigationMenu />
      <main className="flex-1 pt-20">
        <div className="max-w-3xl mx-auto px-6 py-16 w-full">
          {/* Header */}
          <div className="mb-16 text-center">
            <div className="mb-6 inline-flex items-center justify-center rounded-2xl bg-primary/10 p-4 ring-1 ring-primary/20">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <h1 className="mb-3 text-3xl font-semibold tracking-tight md:text-4xl">Terms of Service</h1>
            <p className="text-muted-foreground">Last updated: January 2025</p>
          </div>

          {/* Hero card */}
          <div className="relative mb-12 overflow-hidden rounded-3xl border border-primary/20 bg-primary/5 p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/30">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="mb-2 text-xl font-medium text-foreground">Terms That Respect You</h2>
                <p className="text-foreground/70 leading-relaxed">
                  Most terms of service are designed to protect companies while stripping away your rights. Ours are
                  written to be fair, readable, and honest about what we expect from each other. No 50-page legal
                  documents, no hidden gotchas.
                </p>
              </div>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="space-y-4">
            <FAQItem
              question="What am I agreeing to by using Kloak?"
              defaultOpen={true}
              answer={
                <div className="space-y-3">
                  <p>
                    By using Kloak, you agree to these terms. Pretty standard stuff. But unlike most services, we're not
                    burying important details in legal jargon hoping you won't read them.
                  </p>
                  <p>
                    The short version: be a decent human, don't break the law, take responsibility for your secret key,
                    and we'll provide you with a privacy-respecting communication platform. If you disagree with any
                    part of these terms, you shouldn't use the service—and we'd rather you know that upfront than
                    discover it later.
                  </p>
                  <p>
                    The privacy community sometimes pretends you can build a platform with zero ability to cooperate
                    with law enforcement. You can't—and you shouldn't want to. The goal isn't to protect criminals; it's
                    to protect ordinary people from mass surveillance.
                  </p>
                </div>
              }
            />

            <FAQItem
              question="How does the secret key system work?"
              accent="amber"
              answer={
                <div className="space-y-3">
                  <p>
                    Your account is secured by a cryptographically generated secret key instead of a traditional
                    password. This is the same technology that secures cryptocurrency wallets—battle-tested and
                    mathematically secure.
                  </p>
                  <p>Here's what you need to know:</p>
                  <ul className="space-y-2 text-foreground/70">
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400/50" />
                      <span>
                        <strong className="text-foreground/90">It's your sole responsibility.</strong> We cannot
                        recover, reset, or retrieve your key. This isn't us being difficult—we literally don't have it.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400/50" />
                      <span>
                        <strong className="text-foreground/90">It's the only way in.</strong> There's no "forgot
                        password" option because there's no password. No email reset, no SMS code, no security questions
                        about your first pet.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400/50" />
                      <span>
                        <strong className="text-foreground/90">We only store a hash.</strong> Your actual key never
                        touches our servers. We store a one-way mathematical fingerprint that lets us verify you without
                        knowing the original.
                      </span>
                    </li>
                  </ul>
                  <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                    <p className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="h-4 w-4 mt-0.5 text-red-400 flex-shrink-0" />
                      <span>
                        <strong className="text-foreground/90">This is important:</strong> If you lose your secret key,
                        you permanently lose access to your account. No exceptions, no appeals, no "but I'm really me"
                        conversations with support. Store your key somewhere safe—write it down, use a password manager,
                        whatever works for you. Just don't lose it.
                      </span>
                    </p>
                  </div>
                </div>
              }
            />

            <FAQItem
              question="What behavior isn't allowed?"
              accent="red"
              answer={
                <div className="space-y-3">
                  <p>
                    We're not going to micromanage your conversations or police your opinions. But some things are
                    genuinely not okay, and we need to be clear about them:
                  </p>
                  <ul className="space-y-2 text-foreground/70">
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400/50" />
                      <span>
                        <strong className="text-foreground/90">Illegal activities.</strong> Don't use Kloak to break the
                        law. We're not going to help you evade law enforcement, but we're also not going to be your
                        accomplice.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400/50" />
                      <span>
                        <strong className="text-foreground/90">Harassment and abuse.</strong> Don't use the platform to
                        stalk, threaten, or harm other people. Privacy tools shouldn't be weapons.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400/50" />
                      <span>
                        <strong className="text-foreground/90">Child exploitation content.</strong> Absolutely zero
                        tolerance. This will result in immediate account termination and reporting to authorities.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400/50" />
                      <span>
                        <strong className="text-foreground/90">Intellectual property violations.</strong> Don't share
                        content you don't have the right to share. We're not going to be your piracy platform.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400/50" />
                      <span>
                        <strong className="text-foreground/90">Attacking the platform.</strong> Don't try to hack,
                        exploit, or compromise Kloak's security. If you find a vulnerability, report it—don't exploit
                        it.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400/50" />
                      <span>
                        <strong className="text-foreground/90">Spam and phishing.</strong> Don't use Kloak to scam
                        people or flood servers with garbage.
                      </span>
                    </li>
                  </ul>
                  <p>
                    Notice what's not on this list: we don't ban "offensive" speech, controversial opinions, or content
                    that makes us uncomfortable. We're not here to be the thought police. But there's a difference
                    between controversial and harmful, and we know it when we see it.
                  </p>
                </div>
              }
            />

            <FAQItem
              question="Who owns the content I create?"
              accent="green"
              answer={
                <div className="space-y-3">
                  <p>You do. Full stop.</p>
                  <p>
                    Unlike some platforms that claim broad licenses to your content (looking at you, social media), we
                    only need enough rights to actually operate the service. When you post a message, we need to store
                    it and transmit it to the people you're talking to. That's the "license" you're granting us—nothing
                    more.
                  </p>
                  <p>We won't:</p>
                  <ul className="space-y-2 text-foreground/70">
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-400/50" />
                      <span>Use your content for advertising</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-400/50" />
                      <span>Train AI models on your messages</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-400/50" />
                      <span>Sell or license your content to third parties</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-400/50" />
                      <span>Claim ownership over anything you create</span>
                    </li>
                  </ul>
                  <p>Your words are yours. Your files are yours. We're just the messenger.</p>
                </div>
              }
            />

            <FAQItem
              question="How does server moderation work?"
              answer={
                <div className="space-y-3">
                  <p>
                    Server owners and administrators are responsible for moderating content within their servers. This
                    is a deliberate design choice, not us being lazy.
                  </p>
                  <p>
                    We provide moderation tools—role permissions, message deletion, user banning, etc.—but we don't
                    actively monitor what happens in private servers. We're not reading your messages, scanning your
                    files, or using AI to flag "problematic" content.
                  </p>
                  <p>This means:</p>
                  <ul className="space-y-2 text-foreground/70">
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/50" />
                      <span>
                        <strong className="text-foreground/90">Server owners set the rules.</strong> Each community
                        decides what's acceptable within their space.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/50" />
                      <span>
                        <strong className="text-foreground/90">We act on reports.</strong> If something violates our
                        platform-wide rules (the stuff in the "What isn't allowed" section), report it and we'll
                        investigate.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/50" />
                      <span>
                        <strong className="text-foreground/90">We don't do mass surveillance.</strong> We won't scan
                        every message looking for policy violations. That's antithetical to why Kloak exists.
                      </span>
                    </li>
                  </ul>
                </div>
              }
            />

            <FAQItem
              question="Is the service guaranteed to be available?"
              answer={
                <div className="space-y-3">
                  <p>We try our best, but no.</p>
                  <p>
                    We strive for high availability and take reliability seriously—downtime means you can't talk to your
                    friends, and that sucks. But we're not going to promise 99.999% uptime because sometimes servers
                    crash, updates need to be deployed, and unexpected things happen.
                  </p>
                  <p>
                    We also reserve the right to modify, suspend, or discontinue features. We'll try to give notice when
                    possible, but sometimes changes need to happen quickly. This isn't us planning to pull the rug—it's
                    us being honest that software evolves.
                  </p>
                  <p>
                    What we can promise: we'll communicate openly about outages and changes, and we won't discontinue
                    core functionality without significant advance notice.
                  </p>
                </div>
              }
            />

            <FAQItem
              question="What's the liability situation?"
              answer={
                <div className="space-y-3">
                  <p>Here's the part where we have to put on our lawyer hats (sorry):</p>
                  <p>
                    Kloak is provided "as is" without warranties of any kind. We're not liable for damages arising from
                    your use of the service, including:
                  </p>
                  <ul className="space-y-2 text-foreground/70">
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/50" />
                      <span>Loss of data (back up anything important)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/50" />
                      <span>Loss of access due to a forgotten secret key (we warned you)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/50" />
                      <span>Unauthorized access to your account (keep your key safe)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/50" />
                      <span>Service interruptions or discontinuation</span>
                    </li>
                  </ul>
                  <p>
                    This isn't us being mean—it's standard for any service, and anyone who promises otherwise is lying.
                    We'll do our best to keep things running smoothly, but we can't guarantee perfection.
                  </p>
                </div>
              }
            />

            <FAQItem
              question="Can my account be terminated?"
              accent="red"
              answer={
                <div className="space-y-3">
                  <p>Yes, but only if you violate these terms.</p>
                  <p>
                    We reserve the right to terminate or suspend accounts that break the rules—particularly the serious
                    stuff like illegal activity, harassment, or child exploitation content. We don't terminate accounts
                    because we disagree with your opinions or because you said something mean about us on social media.
                  </p>
                  <p>
                    On your end, you can delete your account whenever you want through the settings menu. No retention
                    games, no 30-day "cooling off" periods, no trying to talk you out of it. Your account, your choice.
                  </p>
                </div>
              }
            />

            <FAQItem
              question="Will these terms change?"
              answer={
                <div className="space-y-3">
                  <p>Probably, eventually. Software evolves, laws change, and sometimes we need to clarify things.</p>
                  <p>
                    When we update these terms, we'll change the "last updated" date at the top. For significant
                    changes, we'll try to notify users directly. Continued use of Kloak after changes means you accept
                    the new terms.
                  </p>
                  <p>
                    What won't change: our commitment to being fair, transparent, and treating you like a customer
                    rather than a product. If we ever write terms that would make current-us ashamed, future-us has
                    messed up badly.
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
              <h3 className="mb-1 font-medium text-foreground/90">The Deal</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                You pay us for a service. We provide that service honestly and protect your privacy. You don't abuse the
                platform or hurt other users. That's the deal. No hidden clauses, no surprise arbitration agreements, no
                signing away your firstborn. Questions? Join a community server and ask.
              </p>
            </div>
          </div>
        </div>
        <Footer />
      </main>
    </div>
  );
};

export default Terms;
