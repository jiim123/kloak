 import { FileText, Key, Prohibit, Scales, Shield, Trash, UserCheck } from "@phosphor-icons/react";
import { motion } from "framer-motion";
 import { NavigationMenu } from "@/components/layout/NavigationMenu";
 import { Footer } from "@/components/ui/footer-section";
 import { SEO } from "@/components/seo";
 import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
 
 
 const termsCategories = [
 {
 title: "Account & Eligibility",
 icon: UserCheck,
 questions: [
 {
 q: "Who can use Kloak?",
 a: "You must be at least 13 years old to use Kloak. If you're under 18, you need permission from a parent or guardian. We don't verify age because that would require collecting personal information, which defeats the purpose of a privacy-first platform. By using Kloak, you're telling us you meet these requirements.",
 },
 {
 q: "What are you agreeing to?",
 a: "By creating an account and using Kloak, you agree to: follow these terms and our community guidelines, not use Kloak for illegal activities, accept responsibility for your secret key, and respect other users and their privacy. That's really it. We're not hiding anything in fine print because there is no fine print.",
 },
 ],
 },
 {
 title: "Prohibited Conduct",
 icon: Prohibit,
 questions: [
 {
 q: "What behavior is NOT allowed?",
 a: "We don't micromanage conversations or police opinions. However, some things are just not acceptable: illegal activities, harassment and abuse (targeted harassment, threats, doxxing, stalking), child exploitation (zero tolerance, immediate termination and law enforcement referral), intellectual property violations, platform attacks (hacking, exploiting, disrupting systems), and spam or phishing. Violations result in account termination. All terminations are final.",
 },
 {
 q: "How is moderation handled?",
 a: "Server owners and administrators are responsible for moderating content within their servers. Kloak provides moderation tools including role permissions, message deletion, and user banning. We do not actively monitor private servers or scan messages with AI. We act on reports of platform-wide rule violations.",
 },
 ],
 },
 {
 title: "Your Secret Key",
 icon: Key,
 questions: [
 {
 q: "What about your secret key?",
 a: "Your secret key is the only way to access your account. By design, we cannot recover it for you. This is a feature, not a bug. It ensures true privacy because we don't store any information that could identify you. You are responsible for: keeping your key secure and private, backing up your key in a safe location, and never sharing your key with anyone. If you lose your key, you lose your account. We mean it.",
 },
 {
 q: "Can someone else access my account?",
 a: "Only someone with your secret key can access your account. We cannot be compelled to give anyone else access because we do not store your key, only a one-way hash. Keep your key secure and never share it with anyone.",
 },
 ],
 },
 {
 title: "Content Ownership",
 icon: FileText,
 questions: [
 {
 q: "Who owns the content you create?",
 a: "You do. Your messages, files, and content remain yours. We only need enough rights to operate the service, meaning we can store and transmit your messages to their intended recipients. We will never: use your content for advertising, train AI models on your messages, sell your content to third parties, or claim ownership over anything you create.",
 },
 {
 q: "What happens to my content if I leave?",
 a: "Your messages may remain in servers after account deletion but will show as from a 'Deleted User.' This preserves conversation context for other participants while removing your personal association with the content.",
 },
 ],
 },
 {
 title: "Account Termination",
 icon: Trash,
 questions: [
 {
 q: "What happens when you delete your account?",
 a: "You can delete your account at any time from User Settings. When you do: your profile and personal data are permanently deleted, your messages remain in servers but show as from 'Deleted User,' and servers you own may be transferred or deleted. This action is immediate and irreversible. We don't keep backups of deleted accounts.",
 },
 {
 q: "Can Kloak terminate my account?",
 a: "We may terminate accounts that violate these terms, particularly for illegal activities, harassment, child exploitation, or platform attacks. Terminated accounts cannot be recovered, and all associated data will be deleted.",
 },
 ],
 },
 {
 title: "Legal & Liability",
 icon: Scales,
 questions: [
 {
 q: "What happens if there is a legal request?",
 a: "Kloak is not a company, and we have never presented ourselves as one. There is no registered legal entity, no commercial registration, and no corporate structure behind the platform. Kloak is a passion project maintained by a small, distributed team of volunteers located in different parts of the world. Even if a legal request were directed at us, our architecture means we have very limited data to provide. We cannot identify users by real name, email, or phone number because we don't collect that information. We cannot decrypt your secret key because we only store a one-way hash.",
 },
 {
 q: "Can we change these terms?",
 a: "Yes, but we'll always notify you of significant changes. We won't suddenly change the rules and expect you to comply retroactively. If you disagree with updated terms, you can stop using Kloak and delete your account. Continued use after changes means you accept the new terms.",
 },
 {
 q: "What about liability?",
 a: "Kloak is not a business. There is no registered legal entity, no corporate structure, and no commercial product. It's a passion project run by a small, distributed team of volunteers who believe privacy-first communication should exist. We don't generate revenue and we don't operate under any jurisdiction as a company.\n\nThat said, here's what you should know: Kloak is provided \"as is.\" We work hard to keep it stable, secure, and improving, but we can't make legal guarantees about uptime, data integrity, or anything else, because there's no entity capable of making those guarantees. If something goes wrong, we'll do everything we reasonably can to fix it. But using Kloak means accepting that you're using a volunteer-built platform, not a commercial service with SLAs and legal backstops.\n\nThe biggest liability that falls on you is your secret key. If you lose it, no one can recover your account.",
 },
 ],
 },
 ];
 
 const Terms = () => {
 return (
 <div className="min-h-screen bg-background flex flex-col items-center w-full landing-typography">
 <SEO
 title="Terms of Service | Kloak"
 description="Terms of service for Kloak. Plain English, no tricks. Understand exactly what you're agreeing to."
 />
 <div className="w-full">
 <NavigationMenu />
 <main>
 {/* Hero Section */}
 <section className="relative min-h-[85vh] flex items-end px-8 lg:px-16 pb-20 overflow-hidden bg-foreground">
 <div className="max-w-7xl mx-auto w-full">
 <motion.div
 className="flex items-center gap-4 mb-8"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 transition={{ duration: 0.6 }}
 >
 <span className="text-xs font-mono text-background tracking-widest uppercase">Legal</span>
 </motion.div>
 
 <motion.h1
 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light text-background leading-tight tracking-tight mb-8"
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.8, delay: 0.1 }}
 >
 Terms of
 <br />
 <span className="text-background/60">service.</span>
 </motion.h1>
 
 <motion.p
 className="text-lg md:text-xl text-background/70 max-w-2xl leading-relaxed"
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.8, delay: 0.2 }}
 >
 Plain English, no tricks. These terms are written to be actually readable. We want you to understand exactly what you're agreeing to.
 </motion.p>
 
 <motion.p
 className="text-sm text-background/50 mt-6"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 transition={{ duration: 0.6, delay: 0.3 }}
 >
 Last updated: January 2025
 </motion.p>
 </div>
 </section>
 
 {/* Terms Categories */}
 {termsCategories.map((category, categoryIndex) => (
 <section
 key={category.title}
 className={`relative py-24 px-8 lg:px-16 border-y border-border/20 ${
 categoryIndex % 2 === 0 ? "bg-card/50" : ""
 }`}
 >
 <div className="max-w-7xl mx-auto">
 <motion.div
 className="mb-12"
 initial={{ opacity: 0, y: 20 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true }}
 transition={{ duration: 0.6 }}
 >
 <div className="flex items-center gap-4 mb-4">
 <div className="w-12 h-12 border border-primary/30 flex items-center justify-center">
 <category.icon className="w-6 h-6 text-primary" />
 </div>
 <span className="text-xs font-mono text-primary tracking-widest uppercase">{category.title}</span>
 </div>
 </motion.div>
 
 <Accordion type="single" collapsible className="space-y-4">
 {category.questions.map((item, index) => (
 <motion.div
 key={index}
 initial={{ opacity: 0, y: 20 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true }}
 transition={{ duration: 0.5, delay: index * 0.1 }}
 >
 <AccordionItem
 value={`${category.title}-${index}`}
 className="border border-border/30 bg-background hover:bg-card/50 transition-colors px-6 md:px-8"
 >
 <AccordionTrigger className="text-left font-medium hover:no-underline py-6 text-base md:text-lg">
 {item.q}
 </AccordionTrigger>
 <AccordionContent className="text-muted-foreground leading-[1.8] pb-6 text-base md:text-lg">
 {item.a}
 </AccordionContent>
 </AccordionItem>
 </motion.div>
 ))}
 </Accordion>
 </div>
 </section>
 ))}
 
 {/* Footer CTA */}
 <section className="relative py-24 px-8 lg:px-16 bg-card/50 border-b border-border/20">
 <div className="max-w-2xl mx-auto">
 <motion.div
 className="text-center border border-border/30 bg-background p-10 md:p-14 rounded-lg"
 initial={{ opacity: 0, y: 20 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true }}
 transition={{ duration: 0.6 }}
 >
 <Shield className="w-12 h-12 text-primary mx-auto mb-6" />
 <h2 className="text-3xl sm:text-4xl font-light text-foreground leading-tight tracking-tight mb-4">
 Our Commitment
 </h2>
 <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed">
 These terms exist to protect both you and Kloak. We're not trying to trap you with legal tricks. 
 We want a relationship built on mutual respect and transparency. Privacy isn't a feature, it's the architecture.
 </p>
 </motion.div>
 </div>
 </section>
 </main>
 <Footer />
 </div>
 </div>
 );
 };
 
 export default Terms;