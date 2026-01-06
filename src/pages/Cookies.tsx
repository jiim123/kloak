import { Link } from "react-router-dom";
import { ArrowLeft, Cookie, CheckCircle, XCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Footer } from "@/components/ui/footer-section";
import kloakLogo from "@/assets/kloak-logo.svg";

const Cookies = () => {
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
            <Cookie className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">Cookie Policy</h1>
          </div>
        </div>
        <p className="text-muted-foreground mb-8 ml-[52px]">Last updated: January 2025</p>

        <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-xl mb-8">
          <h2 className="text-lg font-medium mb-2 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Good News: We Keep It Simple
          </h2>
          <p className="text-foreground/80 leading-relaxed">
            Kloak uses only essential cookies required for the application to function. 
            We don't use tracking cookies, advertising cookies, or any third-party analytics.
          </p>
        </div>

        <div className="space-y-8 text-foreground/90">
          <section>
            <h2 className="text-xl font-medium mb-3">What Are Cookies?</h2>
            <p className="leading-relaxed">
              Cookies are small text files stored on your device when you visit a website. 
              They help websites remember information about your visit, like your preferences 
              and login status.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-medium mb-4 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Cookies We Use
            </h2>
            <p className="text-muted-foreground mb-4">
              We only use essential cookies that are strictly necessary for the service to work:
            </p>
            <div className="space-y-4">
              <div className="p-4 bg-card rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">Local Storage: Secret Key</h3>
                  <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">Essential</span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Stores your encrypted authentication key locally so you don't have to log in every time.
                </p>
                <p className="text-xs text-muted-foreground">
                  <strong>Duration:</strong> Until you log out or clear browser data
                </p>
              </div>

              <div className="p-4 bg-card rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">Local Storage: Theme Preference</h3>
                  <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">Essential</span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Remembers your preferred theme (dark/light mode) for a consistent experience.
                </p>
                <p className="text-xs text-muted-foreground">
                  <strong>Duration:</strong> Persistent until cleared
                </p>
              </div>

              <div className="p-4 bg-card rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">Local Storage: Message Drafts</h3>
                  <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">Essential</span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Saves unsent messages so you don't lose them if you accidentally navigate away.
                </p>
                <p className="text-xs text-muted-foreground">
                  <strong>Duration:</strong> Until message is sent or manually cleared
                </p>
              </div>

              <div className="p-4 bg-card rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">Local Storage: UI Preferences</h3>
                  <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">Essential</span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Stores settings like sidebar state and notification preferences.
                </p>
                <p className="text-xs text-muted-foreground">
                  <strong>Duration:</strong> Persistent until cleared
                </p>
              </div>
            </div>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-medium mb-4 flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Cookies We Don't Use
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { name: "Analytics cookies", desc: "No Google Analytics or similar" },
                { name: "Advertising cookies", desc: "No ad tracking or retargeting" },
                { name: "Social media cookies", desc: "No Facebook, Twitter pixels" },
                { name: "Third-party trackers", desc: "No external tracking scripts" },
                { name: "Cross-site cookies", desc: "No tracking across websites" },
                { name: "Fingerprinting", desc: "No device fingerprinting" },
              ].map((item) => (
                <div key={item.name} className="flex items-start gap-3 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                  <XCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-medium">{item.name}</span>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-medium mb-3">Managing Cookies</h2>
            <p className="leading-relaxed mb-3">
              Since we only use essential cookies stored in your browser's Local Storage, you have full control:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4 text-foreground/80">
              <li>
                <strong>Clear all data:</strong> Use your browser's "Clear browsing data" feature to remove all stored data
              </li>
              <li>
                <strong>Log out:</strong> Logging out clears your authentication data
              </li>
              <li>
                <strong>Browser settings:</strong> You can disable Local Storage in your browser settings, 
                but this will prevent Kloak from working properly
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-medium mb-3 flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              A Note on "Cookie Consent"
            </h2>
            <p className="leading-relaxed">
              You may have noticed we don't show an annoying cookie consent banner. That's because under 
              privacy regulations like GDPR, consent is only required for non-essential cookies (like 
              tracking and advertising). Since we only use strictly necessary cookies for the service to 
              function, no consent banner is legally required.
            </p>
          </section>

          <Separator />

          <section className="p-4 bg-muted/30 rounded-lg">
            <p className="text-muted-foreground text-sm">
              <strong>Our philosophy:</strong> We believe the best cookie policy is one where there's almost 
              nothing to disclose. We only store what's necessary for you to use Kloak—nothing more.
            </p>
          </section>
        </div>

      </div>
      <Footer />
    </div>
  );
};

export default Cookies;
