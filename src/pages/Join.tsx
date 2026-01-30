import { useState } from "react";
import { motion } from "framer-motion";
import { Heart, Code, Shield, Palette, Sparkles, Send, CheckCircle, Loader2 } from "lucide-react";
import { Footer } from "@/components/ui/footer-section";
import { NavigationMenu } from "@/components/layout/NavigationMenu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SEO } from "@/components/seo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

const applicationSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  email: z.string().trim().email("Invalid email address").max(255, "Email must be less than 255 characters"),
  role: z.string().trim().min(1, "Please tell us what role interests you").max(100, "Role must be less than 100 characters"),
  message: z.string().trim().min(10, "Please tell us a bit more about yourself").max(2000, "Message must be less than 2000 characters"),
  portfolio: z.string().trim().max(500, "Portfolio link must be less than 500 characters").optional(),
});

const roles = [
  {
    icon: Palette,
    title: "Designers",
    description: "Craft intuitive interfaces that respect user privacy while delivering exceptional experiences.",
  },
  {
    icon: Code,
    title: "Engineers",
    description: "Build secure, performant systems from the ground up. React, TypeScript, Supabase, and more.",
  },
  {
    icon: Shield,
    title: "Security Enthusiasts",
    description: "Help us stay ahead of threats and ensure our users' data remains theirs alone.",
  },
  {
    icon: Heart,
    title: "Community Builders",
    description: "Connect with users, gather feedback, and help shape the future of private communication.",
  },
];

const Join = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "",
    message: "",
    portfolio: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate form data
    const result = applicationSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.functions.invoke("send-join-application", {
        body: formData,
      });

      if (error) throw error;

      setIsSubmitted(true);
      toast.success("Application sent successfully!");
    } catch (error) {
      console.error("Error sending application:", error);
      toast.error("Failed to send application. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      <SEO
        title="Join Us | Kloak"
        description="Join the Kloak team. We're a small indie team looking for passionate designers, engineers, and security enthusiasts."
      />
      <div className="w-full">
        <NavigationMenu />
        <main className="pt-10">
          {/* Hero Section */}
          <section className="relative py-32 md:py-40 px-8 lg:px-16 overflow-hidden">
            <div className="max-w-7xl mx-auto">
              <motion.div
                className="flex items-center gap-4 mb-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6 }}
              >
                <span className="text-xs font-mono text-primary tracking-widest uppercase">Join Our Team</span>
              </motion.div>

              <motion.h1
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light text-foreground leading-tight tracking-tight mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1 }}
              >
                Build something
                <br />
                <span className="text-primary/60">that matters.</span>
              </motion.h1>

              <motion.p
                className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                We're a tiny indie team on a mission to give people back their privacy. No investors pushing growth
                metrics. No corporate roadmap. Just passionate people building tools that respect users.
              </motion.p>
            </div>
          </section>

          {/* Who We're Looking For */}
          <section className="relative py-24 px-8 lg:px-16 bg-card/50 border-y border-border/20">
            <div className="max-w-7xl mx-auto">
              <motion.div
                className="mb-16"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <span className="text-xs font-mono text-primary tracking-widest uppercase mb-4 block">
                  Who We're Looking For
                </span>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-light text-foreground leading-tight tracking-tight">
                  Passion over pedigree.
                </h2>
              </motion.div>

              <div className="grid md:grid-cols-2 gap-6">
                {roles.map((role, index) => (
                  <motion.div
                    key={role.title}
                    className="relative border border-border/30 p-8 md:p-10 group overflow-hidden bg-background hover:bg-card/50 transition-colors"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary/5 to-transparent" />
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 border border-primary/30 flex items-center justify-center shrink-0 group-hover:border-primary/50 transition-colors duration-300">
                        <role.icon className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-foreground mb-2">{role.title}</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">{role.description}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <motion.div
                className="mt-12 text-center"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <p className="text-muted-foreground">
                  Don't see your role listed? We're always open to meeting talented people. Reach out anyway.
                </p>
              </motion.div>
            </div>
          </section>

          {/* Values Section */}
          <section className="relative py-24 px-8 lg:px-16 border-b border-border/20">
            <div className="max-w-7xl mx-auto">
              <motion.div
                className="grid md:grid-cols-3 gap-8"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <div className="space-y-4">
                  <Sparkles className="w-8 h-8 text-primary" />
                  <h3 className="text-xl font-medium text-foreground">Remote First</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Work from anywhere. We care about what you build, not where you sit.
                  </p>
                </div>
                <div className="space-y-4">
                  <Heart className="w-8 h-8 text-primary" />
                  <h3 className="text-xl font-medium text-foreground">Mission Driven</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Privacy isn't a feature for us—it's the foundation everything is built on.
                  </p>
                </div>
                <div className="space-y-4">
                  <Code className="w-8 h-8 text-primary" />
                  <h3 className="text-xl font-medium text-foreground">Indie Spirit</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Small team, big ambitions. Every contribution shapes the product directly.
                  </p>
                </div>
              </motion.div>
            </div>
          </section>

          {/* Application Form */}
          <section className="relative py-24 px-8 lg:px-16 bg-card/50 border-b border-border/20">
            <div className="max-w-2xl mx-auto">
              <motion.div
                className="mb-12 text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <span className="text-xs font-mono text-primary tracking-widest uppercase mb-4 block">Apply Now</span>
                <h2 className="text-3xl sm:text-4xl font-light text-foreground leading-tight tracking-tight mb-4">
                  Ready to join?
                </h2>
                <p className="text-muted-foreground">Tell us about yourself and what excites you about Kloak.</p>
              </motion.div>

              {isSubmitted ? (
                <motion.div
                  className="text-center py-16 border border-border/30 bg-background rounded-lg"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4 }}
                >
                  <CheckCircle className="w-16 h-16 text-primary mx-auto mb-6" />
                  <h3 className="text-2xl font-medium text-foreground mb-3">Application Sent!</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Thanks for your interest in joining Kloak. We'll review your application and get back to you soon.
                  </p>
                </motion.div>
              ) : (
                <motion.form
                  onSubmit={handleSubmit}
                  className="space-y-6 border border-border/30 bg-background p-8 md:p-10 rounded-lg"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Your name"
                        className={errors.name ? "border-destructive" : ""}
                      />
                      {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="you@example.com"
                        className={errors.email ? "border-destructive" : ""}
                      />
                      {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role">What role interests you? *</Label>
                    <Input
                      id="role"
                      name="role"
                      value={formData.role}
                      onChange={handleChange}
                      placeholder="e.g., Frontend Engineer, UI Designer, Security Researcher..."
                      className={errors.role ? "border-destructive" : ""}
                    />
                    {errors.role && <p className="text-sm text-destructive">{errors.role}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="portfolio">Portfolio / GitHub / LinkedIn (optional)</Label>
                    <Input
                      id="portfolio"
                      name="portfolio"
                      value={formData.portfolio}
                      onChange={handleChange}
                      placeholder="https://..."
                      className={errors.portfolio ? "border-destructive" : ""}
                    />
                    {errors.portfolio && <p className="text-sm text-destructive">{errors.portfolio}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Tell us about yourself *</Label>
                    <Textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      placeholder="What excites you about privacy-focused products? What would you bring to the team?"
                      rows={6}
                      className={errors.message ? "border-destructive" : ""}
                    />
                    {errors.message && <p className="text-sm text-destructive">{errors.message}</p>}
                  </div>

                  <Button type="submit" className="w-full h-14 text-lg" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5 mr-2" />
                        Send Application
                      </>
                    )}
                  </Button>
                </motion.form>
              )}
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default Join;
