import { Link } from "react-router-dom";
import { ArrowLeft, Heart, Shield, Eye, EyeOff, Lock, Coins, MessageCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import kloakLogo from "@/assets/kloak-logo.svg";

const Philosophy = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link to="/auth">
          <Button variant="ghost" size="sm" className="mb-8 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>

        <div className="flex items-center gap-4 mb-2">
          <img src={kloakLogo} alt="Kloak" className="h-8" />
          <div className="h-8 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Heart className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">Our Philosophy</h1>
          </div>
        </div>
        <p className="text-muted-foreground mb-8 ml-[52px]">Why we built Kloak the way we did</p>

        <div className="p-6 bg-primary/5 border border-primary/20 rounded-xl mb-8">
          <p className="text-lg text-foreground/90 leading-relaxed font-medium text-center">
            "Communication should be totally private. It should not be tracked, analyzed, or sold. Ever."
          </p>
        </div>

        <div className="space-y-8 text-foreground/90">
          <section>
            <h2 className="text-xl font-medium mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Privacy is Not a Feature
            </h2>
            <p className="leading-relaxed mb-4">
              Most platforms treat privacy as a checkbox—a setting you can toggle, a preference you can adjust. 
              At Kloak, we believe privacy should be the foundation, not an afterthought.
            </p>
            <p className="leading-relaxed">
              That's why we built our entire architecture around one principle: <strong>collect nothing we don't 
              absolutely need</strong>. We can't sell what we don't have. We can't leak what we never collected. 
              We can't be compelled to share what doesn't exist.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-medium mb-4 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Communication Should Be Free
            </h2>
            <p className="leading-relaxed mb-4">
              When you talk to a friend in person, no one is recording your conversation to sell you ads. 
              No one is analyzing your words to build a profile. No one is monetizing your relationship.
            </p>
            <p className="leading-relaxed">
              Why should online communication be any different? We believe your conversations belong to you 
              and the people you're talking to—not to advertisers, data brokers, or algorithms.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-medium mb-4 flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              No Email. No Password. No Phone.
            </h2>
            <p className="leading-relaxed mb-4">
              Traditional platforms require your email, phone number, or other identifying information to 
              create an account. This creates a trail that can be tracked, hacked, or subpoenaed.
            </p>
            <p className="leading-relaxed">
              Kloak uses a cryptographically generated secret key instead. It's like a password that's 
              impossible to guess and never tied to your real identity. You are who you claim to be—nothing more.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-medium mb-4 flex items-center gap-2">
              <EyeOff className="h-5 w-5 text-green-500" />
              No Tracking. No Analytics. No Surveillance.
            </h2>
            <p className="leading-relaxed mb-4">
              We don't track your behavior. We don't analyze your messages. We don't build profiles. 
              We don't use cookies for advertising or marketing. We don't share data with third parties.
            </p>
            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              {[
                "No behavioral tracking",
                "No advertising IDs",
                "No data brokers",
                "No marketing analytics",
                "No social graphs sold",
                "No message scanning",
                "No AI training on your data",
                "No cross-platform tracking",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                  <EyeOff className="h-4 w-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm">{item}</span>
                </div>
              ))}
            </div>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-medium mb-4 flex items-center gap-2">
              <Coins className="h-5 w-5 text-amber-500" />
              No Micro-Transactions. Ever.
            </h2>
            <p className="leading-relaxed mb-4">
              We will never introduce micro-transactions, premium emojis, paid stickers, or any other 
              nickel-and-dime monetization schemes. These systems are designed to extract maximum value 
              from users, often targeting vulnerable people with manipulative psychological tactics.
            </p>
            <p className="leading-relaxed">
              If we ever need to monetize, we'll be transparent about it—a simple, honest model that 
              respects your intelligence and your wallet. Not dark patterns. Not gambling mechanics. 
              Not artificial scarcity.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-medium mb-4 flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Transparency Over Obscurity
            </h2>
            <p className="leading-relaxed mb-4">
              We don't hide behind pages of legal jargon designed to confuse you. Our policies are written 
              in plain language because you deserve to understand exactly what you're agreeing to.
            </p>
            <p className="leading-relaxed">
              When we make decisions, we'll explain why. When we change something, we'll tell you. 
              Trust is built through honesty, not fine print.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-medium mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Your Data Belongs to You
            </h2>
            <p className="leading-relaxed mb-4">
              You can delete your account whenever you want. Your data won't linger in "anonymized" 
              databases or be "retained for legal purposes" indefinitely. When you're gone, you're gone.
            </p>
            <p className="leading-relaxed">
              We're not building a platform that traps you. We're building one that respects you.
            </p>
          </section>

          <Separator />

          <section className="p-6 bg-muted/30 rounded-xl">
            <h2 className="text-lg font-medium mb-3">The Bottom Line</h2>
            <p className="leading-relaxed text-foreground/80">
              Kloak exists because we believe there should be a place where people can communicate 
              without being the product. Where privacy isn't a premium feature. Where your conversations 
              are truly your own. That's not idealism—it's just how things should be.
            </p>
          </section>
        </div>

        <div className="mt-12 flex gap-4 text-sm">
          <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
          <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
          <Link to="/cookies" className="text-primary hover:underline">Cookie Policy</Link>
        </div>
      </div>
    </div>
  );
};

export default Philosophy;