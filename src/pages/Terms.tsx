import { Shield, FileText, AlertTriangle, Scale } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Footer } from "@/components/ui/footer-section";
import { NavigationMenu } from "@/components/layout/NavigationMenu";

const Terms = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <NavigationMenu />
      
      <div className="max-w-4xl mx-auto px-6 py-12 w-full">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">Terms of Service</h1>
        </div>
        <p className="text-muted-foreground mb-8">Last updated: January 2025</p>

        <div className="space-y-8 text-foreground/90">
          <section>
            <h2 className="text-xl font-medium mb-3 flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Our Philosophy
            </h2>
            <p className="leading-relaxed">
              Kloak is built on a simple principle: <strong>privacy is not a feature—it's the architecture</strong>. 
              We've designed our platform to collect the absolute minimum data necessary for the service to function. 
              We don't want your email, phone number, or any personally identifiable information.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-medium mb-3">1. Acceptance of Terms</h2>
            <p className="leading-relaxed mb-3">
              By accessing or using Kloak, you agree to be bound by these Terms of Service. If you disagree 
              with any part of these terms, you may not access the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-medium mb-3">2. Your Secret Key</h2>
            <p className="leading-relaxed mb-3">
              Your account is secured by a cryptographically generated secret key. This key is:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4 text-foreground/80">
              <li><strong>Your sole responsibility</strong> — We cannot recover, reset, or retrieve your key</li>
              <li><strong>The only way to access your account</strong> — There are no "forgot password" options</li>
              <li><strong>Never stored in plain text</strong> — We only store a secure hash for verification</li>
            </ul>
            <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive flex-shrink-0" />
                <span>
                  <strong>Warning:</strong> If you lose your secret key, you permanently lose access to your account. 
                  There is no recovery process. Store your key securely.
                </span>
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-medium mb-3">3. User Conduct</h2>
            <p className="leading-relaxed mb-3">You agree not to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4 text-foreground/80">
              <li>Use the service for any illegal activities</li>
              <li>Harass, abuse, or harm other users</li>
              <li>Share content that violates others' intellectual property rights</li>
              <li>Attempt to compromise the security or integrity of the platform</li>
              <li>Share content depicting child exploitation or abuse</li>
              <li>Engage in spam, phishing, or malicious activities</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-medium mb-3">4. Content & Messages</h2>
            <p className="leading-relaxed mb-3">
              You retain ownership of any content you create or share on Kloak. However, by using our service, 
              you grant us a limited license to store and transmit your content as necessary to operate the platform.
            </p>
            <p className="leading-relaxed">
              Messages and files shared on Kloak are stored on our servers to enable the service. While we 
              implement security measures, you acknowledge that no system is completely secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-medium mb-3">5. Server Ownership & Moderation</h2>
            <p className="leading-relaxed mb-3">
              Server owners and administrators are responsible for moderating content within their servers. 
              Kloak provides tools for moderation but does not actively monitor private server content.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-medium mb-3">6. Service Availability</h2>
            <p className="leading-relaxed">
              We strive to maintain high availability but cannot guarantee uninterrupted service. 
              We reserve the right to modify, suspend, or discontinue any part of the service at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-medium mb-3 flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              7. Limitation of Liability
            </h2>
            <p className="leading-relaxed">
              Kloak is provided "as is" without warranties of any kind. We are not liable for any damages 
              arising from your use of the service, including but not limited to loss of data, loss of access 
              due to forgotten secret keys, or unauthorized access to your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-medium mb-3">8. Termination</h2>
            <p className="leading-relaxed">
              We reserve the right to terminate or suspend accounts that violate these terms. 
              You may delete your account at any time through the settings menu.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-medium mb-3">9. Changes to Terms</h2>
            <p className="leading-relaxed">
              We may update these terms from time to time. Continued use of the service after changes 
              constitutes acceptance of the new terms.
            </p>
          </section>

          <Separator />

          <section>
            <p className="text-muted-foreground text-sm">
              Questions about these terms? Join a community server to discuss with other users.
            </p>
          </section>
        </div>

      </div>
      <Footer />
    </div>
  );
};

export default Terms;
