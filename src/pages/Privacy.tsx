import { Shield, Eye, EyeOff, Database, Lock, Trash2, CheckCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Footer } from "@/components/ui/footer-section";
import { NavigationMenu } from "@/components/layout/NavigationMenu";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <NavigationMenu />
      
      <div className="max-w-4xl mx-auto px-6 py-12 w-full">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">Privacy Policy</h1>
        </div>
        <p className="text-muted-foreground mb-8">Last updated: January 2025</p>

        <div className="p-6 bg-primary/5 border border-primary/20 rounded-xl mb-8">
          <h2 className="text-lg font-medium mb-2 flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Privacy is Our Architecture
          </h2>
          <p className="text-foreground/80 leading-relaxed">
            Unlike most platforms, Kloak was built from the ground up with privacy as the foundation—not an afterthought. 
            We don't collect what we don't need, and we can't share what we don't have.
          </p>
        </div>

        <div className="space-y-8 text-foreground/90">
          <section>
            <h2 className="text-xl font-medium mb-4 flex items-center gap-2">
              <EyeOff className="h-5 w-5 text-green-500" />
              What We Don't Collect
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                "Email addresses",
                "Phone numbers",
                "Real names",
                "Physical addresses",
                "Payment information",
                "Social security numbers",
                "Biometric data",
                "Location tracking",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm">{item}</span>
                </div>
              ))}
            </div>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-medium mb-4 flex items-center gap-2">
              <Eye className="h-5 w-5 text-amber-500" />
              What We Do Collect
            </h2>
            <p className="text-muted-foreground mb-4">
              Only what's absolutely necessary to provide the service:
            </p>
            <div className="space-y-4">
              <div className="p-4 bg-card rounded-lg border">
                <h3 className="font-medium mb-1">Username</h3>
                <p className="text-sm text-muted-foreground">
                  A name you choose to identify yourself. It doesn't have to be your real name.
                </p>
              </div>
              <div className="p-4 bg-card rounded-lg border">
                <h3 className="font-medium mb-1">Secret Key Hash</h3>
                <p className="text-sm text-muted-foreground">
                  A one-way cryptographic hash of your secret key. We never store your actual key—only a 
                  mathematical fingerprint that lets us verify you without knowing the original.
                </p>
              </div>
              <div className="p-4 bg-card rounded-lg border">
                <h3 className="font-medium mb-1">Messages & Content</h3>
                <p className="text-sm text-muted-foreground">
                  Text messages, uploaded files, and reactions you create. These are stored to enable 
                  communication between users.
                </p>
              </div>
              <div className="p-4 bg-card rounded-lg border">
                <h3 className="font-medium mb-1">Profile Information</h3>
                <p className="text-sm text-muted-foreground">
                  Optional display name, avatar, bio, and status—all chosen by you.
                </p>
              </div>
              <div className="p-4 bg-card rounded-lg border">
                <h3 className="font-medium mb-1">Server Membership</h3>
                <p className="text-sm text-muted-foreground">
                  Records of which servers you've joined and your role within them.
                </p>
              </div>
            </div>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-medium mb-4 flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              How We Use Your Data
            </h2>
            <ul className="space-y-3 text-foreground/80">
              <li className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-primary">1</span>
                </div>
                <span><strong>Authentication</strong> — Verifying your identity when you log in with your secret key</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-primary">2</span>
                </div>
                <span><strong>Message Delivery</strong> — Storing and transmitting your messages to intended recipients</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-primary">3</span>
                </div>
                <span><strong>Presence & Status</strong> — Showing your online status to friends and server members</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-primary">4</span>
                </div>
                <span><strong>Notifications</strong> — Alerting you to mentions, friend requests, and messages</span>
              </li>
            </ul>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-medium mb-3">Data Sharing</h2>
            <p className="leading-relaxed mb-3">
              We do not sell, rent, or trade your personal information. Period.
            </p>
            <p className="leading-relaxed text-foreground/80">
              We may disclose information only if required by law or to protect the safety of our users. 
              Given our minimal data collection, there's very little we could share even if compelled.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-medium mb-3">Data Storage & Security</h2>
            <p className="leading-relaxed mb-3">
              Your data is stored securely using industry-standard encryption and security practices. 
              We use Supabase for our infrastructure, which provides enterprise-grade security.
            </p>
            <p className="leading-relaxed text-foreground/80">
              Uploaded images are automatically deleted after 14 days to minimize data retention.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-medium mb-3 flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Your Rights & Data Deletion
            </h2>
            <p className="leading-relaxed mb-3">
              You can delete your account at any time from the settings menu. When you delete your account:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4 text-foreground/80">
              <li>Your profile and personal data are permanently removed</li>
              <li>Your messages may remain in servers but will show as from a deleted user</li>
              <li>This action is irreversible</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-medium mb-3">Changes to This Policy</h2>
            <p className="leading-relaxed">
              We may update this privacy policy occasionally. We'll indicate the date of the last update 
              at the top of this page. Continued use of Kloak after changes constitutes acceptance.
            </p>
          </section>

          <Separator />

          <section className="p-4 bg-muted/30 rounded-lg">
            <p className="text-muted-foreground text-sm">
              <strong>Our commitment:</strong> We built Kloak because we believe privacy is a fundamental right. 
              We'll continue to minimize data collection and maximize your control over your information.
            </p>
          </section>
        </div>

      </div>
      <Footer />
    </div>
  );
};

export default Privacy;
