 import { motion } from "framer-motion";
 import { NavigationMenu } from "@/components/layout/NavigationMenu";
 import { Footer } from "@/components/ui/footer-section";
 import { SEO } from "@/components/seo";
 import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
 import { Cookie, Shield, Check, X, Settings, HelpCircle } from "lucide-react";
 
 const cookieCategories = [
   {
     title: "What We Use",
     icon: Check,
     questions: [
       {
         q: "What are cookies?",
         a: "Cookies are small text files stored on your device when you visit a website. They help websites remember information about your visit, like your preferences and login status. Think of them as tiny notes your browser keeps to make your experience smoother. The problem is, most companies use them to take notes about you instead of for you.",
       },
       {
         q: "What cookies does Kloak use?",
         a: "We only use essential cookies stored in your browser's Local Storage: Secret Key (stores your encrypted authentication key locally so you stay logged in), Theme Preference (remembers your preferred theme), Message Drafts (saves unsent messages so you don't lose them), and UI Preferences (stores settings like sidebar state and notification preferences). That's it.",
       },
     ],
   },
   {
     title: "What We Don't Use",
     icon: X,
     questions: [
       {
         q: "What about Analytics Cookies?",
         a: "Big Tech uses analytics cookies to track every click, scroll, and hover. To know exactly how long you stared at that product before deciding you couldn't afford it. This data gets packaged and sold, or used to optimize for 'engagement.' We don't need to know your every move to build a good product. If something's broken, you'll tell us. If something's great, you'll keep using it.",
       },
       {
         q: "What about Advertising Cookies?",
         a: "Advertising cookies follow you around the internet like a persistent salesperson. Looked at running shoes once? Congratulations, you'll see them in your dreams for the next six months. This is how 'free' platforms make money. We don't need to monetize your eyeballs because you're our customer, not our product. No ads means no ad tracking.",
       },
       {
         q: "What about Social Media Pixels and Third-Party Trackers?",
         a: "Those little Facebook and Twitter buttons aren't just for sharing. They're surveillance outposts that report back every site you visit, building a shadow profile even if you don't click anything. Most sites load dozens of external scripts: analytics, A/B testing, heat mapping, session recording. Each one is another company with access to your data. We built everything in-house because your conversations shouldn't pass through a dozen different companies.",
       },
       {
         q: "What about Cross-Site Cookies and Device Fingerprinting?",
         a: "Cross-site cookies build a complete picture of your online life across every website you visit. Your shopping habits, your political views, your health concerns. When you block cookies, they get creative with device fingerprinting. We authenticate you with cryptographic keys, not surveillance techniques. What you do on Kloak stays on Kloak. What you do elsewhere is none of our business.",
       },
     ],
   },
   {
     title: "Managing Cookies",
     icon: Settings,
     questions: [
       {
         q: "How can I manage or delete cookies?",
         a: "Since we only use essential cookies stored in Local Storage, you have complete control. Clear all data using your browser's 'Clear browsing data' feature. Logging out automatically clears your authentication data. You can disable Local Storage entirely in browser settings, but this will prevent Kloak from working properly.",
       },
       {
         q: "Why don't I see a cookie consent banner?",
         a: "You know those annoying popups that guilt-trip you into 'accepting all' with a tiny, hard-to-find 'manage preferences' link? Those exist because companies need your permission to track you. Under GDPR and similar regulations, consent banners are only required for non-essential cookies. Since Kloak only uses strictly necessary cookies for the service to function, no consent banner is legally required.",
       },
     ],
   },
   {
     title: "Common Questions",
     icon: HelpCircle,
     questions: [
       {
         q: "But how do you improve the product without analytics?",
         a: "This is the question Big Tech wants you to think has no answer. 'We need your data to improve!' they say, while coincidentally making billions selling that same data. Here's our secret: we talk to our users. Radical, we know. We read feedback, we respond to support requests, we pay attention to what people ask for. We use aggregate, anonymized server metrics to know if the service is working. Not to build psychological profiles.",
       },
       {
         q: "What happens to cookies when I delete my account?",
         a: "When you delete your account, we remove all server-side data associated with you. Local Storage data in your browser remains until you clear it manually or log out. This is purely client-side data that never leaves your device. You can clear it anytime through your browser settings.",
       },
     ],
   },
 ];
 
 const Cookies = () => {
   return (
     <div className="min-h-screen bg-background flex flex-col items-center w-full">
       <SEO
         title="Cookie Policy | Kloak"
         description="Cookie policy for Kloak. We use only essential cookies. No tracking, no advertising, no third-party analytics."
       />
       <div className="w-full">
         <NavigationMenu />
         <main className="pt-10">
           {/* Hero Section - Light Silver Theme */}
           <section className="relative py-32 md:py-40 px-8 lg:px-16 overflow-hidden bg-neutral-200 dark:bg-neutral-800">
             <div className="max-w-7xl mx-auto">
               <motion.div
                 className="flex items-center gap-4 mb-8"
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 transition={{ duration: 0.6 }}
               >
                 <span className="text-xs font-mono text-neutral-600 dark:text-neutral-400 tracking-widest uppercase">Legal</span>
               </motion.div>
 
               <motion.h1
                 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light text-neutral-900 dark:text-neutral-100 leading-tight tracking-tight mb-8"
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ duration: 0.8, delay: 0.1 }}
               >
                 Cookie
                 <br />
                 <span className="text-neutral-500 dark:text-neutral-400">policy.</span>
               </motion.h1>
 
               <motion.p
                 className="text-lg md:text-xl text-neutral-700 dark:text-neutral-300 max-w-2xl leading-relaxed"
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ duration: 0.8, delay: 0.2 }}
               >
                 Good news: we keep it simple. Kloak uses only essential cookies required for the application to function. No tracking, no advertising, no third-party analytics.
               </motion.p>
 
               <motion.p
                 className="text-sm text-neutral-500 dark:text-neutral-500 mt-6"
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 transition={{ duration: 0.6, delay: 0.3 }}
               >
                 Last updated: January 2025
               </motion.p>
             </div>
           </section>
 
           {/* Cookie Categories */}
           {cookieCategories.map((category, categoryIndex) => (
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
                         <AccordionContent className="text-muted-foreground leading-[1.7] pb-6 text-[17px]">
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
                   Our Philosophy
                 </h2>
                 <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed">
                   The best cookie policy is one where there's almost nothing to disclose. We only store what's necessary for you to use Kloak. Nothing more. Privacy isn't a feature, it's the architecture.
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
 
 export default Cookies;
