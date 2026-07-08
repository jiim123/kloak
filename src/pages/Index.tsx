import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Mic2,
  MessageSquareText,
  Megaphone,
  ListChecks,
  Images,
  CalendarDays,
  X,
} from "lucide-react";
import { Footer } from "@/components/ui/footer-section";
import { NavigationMenu } from "@/components/layout/NavigationMenu";
import HeroAscii from "@/components/landing/HeroAscii";
import { SEO } from "@/components/seo";
import { SEO_CONFIG } from "@/lib/seo";

const Index = () => {
  const [selectedFeatureImage, setSelectedFeatureImage] = useState<string | null>(null);

  const featureImages = [
    {
      image: "/features/voicechannels.svg",
      icon: Mic2,
      title: "Voice Channels",
      description: "Hop into a room when you want to chill, talk, or run a quick call with screen sharing.",
    },
    {
      image: "/features/forums.svg",
      icon: MessageSquareText,
      title: "Forums",
      description: "Keep things organized and easy to find. Start a topic, reply in threads, and let everyone catch up whenever.",
    },
    {
      image: "/features/announcements.svg",
      icon: Megaphone,
      title: "Announcements",
      description: "Post server updates where people can actually see them. Great for anything that the whole server should not miss.",
    },
    {
      image: "/features/tasks.svg",
      icon: ListChecks,
      title: "Tasks",
      description: "Turn plans into simple to-dos for your server. Assign tasks, keep track, and get things done without leaving the server.",
    },
    {
      image: "/features/mediachannels.svg",
      icon: Images,
      title: "Media Channels",
      description: "Give memes, clips, screenshots, and photos their own spot. Browse everything later instead of digging through chat.",
    },
    {
      image: "/features/calenders.svg",
      icon: CalendarDays,
      title: "Calendars",
      description: "Schedule game nights, calls, launches, or meetups so everyone knows what is happening and when to show up.",
    },
  ];
  return (
    <div className="min-h-screen bg-background flex flex-col items-center landing-typography">
      <SEO {...SEO_CONFIG.home} />
      <div className="w-full">
        <NavigationMenu />
        <main>
          <HeroAscii />

          <section className="relative overflow-hidden bg-black px-4 py-28 text-white sm:px-6 md:py-40 lg:px-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.1),transparent_28%),radial-gradient(circle_at_78%_62%,rgba(90,90,110,0.2),transparent_34%),linear-gradient(180deg,#020203_0%,#08090c_48%,#020203_100%)]" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-500/10 blur-3xl" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <div className="relative z-10 mx-auto grid min-h-[28rem] max-w-[1240px] grid-cols-1 gap-12 md:grid-cols-[1.08fr_0.92fr] md:items-center lg:gap-20">
              <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-120px" }} transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}>
                <h2 className="max-w-4xl text-[clamp(3.1rem,8vw,7.4rem)] font-semibold leading-[0.86] tracking-tight text-white">
                  A place to 💬 <span className="font-['Instrument_Serif'] font-normal italic tracking-normal text-zinc-100">talk</span>
                  <br />
                  without being 👀 <span className="font-['Instrument_Serif'] font-normal italic tracking-normal text-zinc-100">watched</span>.
                </h2>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-120px" }} transition={{ duration: 0.75, delay: 0.12, ease: [0.16, 1, 0.3, 1] }} className="md:self-center">
                <p className="max-w-xl text-base leading-8 text-zinc-300 sm:text-lg">
                  Kloak is a community-driven passion project for people who want the speed of modern group chat without
                  the surveillance layer. No email. No phone number. No behavioral tracking.
                </p>
              </motion.div>
            </div>
          </section>


          <section className="relative overflow-hidden bg-black px-4 py-28 text-white sm:px-6 md:py-40 lg:px-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_16%,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,#020203_0%,#08090c_50%,#020203_100%)]" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <div className="relative z-10 mx-auto max-w-[1040px]">
              <motion.div
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-120px" }}
                transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-4xl"
              >
                <h2 className="text-[clamp(3rem,7vw,6.8rem)] font-semibold leading-[0.88] tracking-tight text-white">
                  More ways to 🤝 <span className="font-['Instrument_Serif'] font-normal italic tracking-normal text-zinc-100">gather</span>.
                </h2>
                <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-300 sm:text-lg">
                  When we say Kloak is built differently, we mean it.
                </p>
              </motion.div>

              <div className="mt-16 grid grid-cols-1 gap-x-8 gap-y-16 md:grid-cols-2 xl:grid-cols-3">
                {featureImages.map((feature, index) => {
                  const FeatureIcon = feature.icon;
                  return (
                  <motion.article
                    key={feature.title}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-90px" }}
                    transition={{ duration: 0.65, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-col gap-6 rounded-[8px] border border-white/10 p-5"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedFeatureImage(feature.image)}
                      className="relative block w-full cursor-zoom-in rounded-[6px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35"
                      aria-label={`Open ${feature.title} image`}
                    >
                      <img
                        src={feature.image}
                        alt=""
                        className="relative z-10 mx-auto w-full max-w-[360px] transform-gpu drop-shadow-[0_28px_80px_rgba(0,0,0,0.55)] transition-transform duration-500 hover:scale-[1.02]"
                        loading="lazy"
                      />
                    </button>
                    <div>
                      <h3 className="flex items-center gap-2.5 text-[1.125rem] font-semibold leading-tight tracking-tight text-white">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-200">
                          <FeatureIcon className="h-4 w-4" strokeWidth={1.6} />
                        </span>
                        {feature.title}
                      </h3>
                      <p className="mt-2 max-w-md text-sm leading-7 text-zinc-400">{feature.description}</p>
                    </div>
                  </motion.article>
                  );
                })}
              </div>
            </div>
          </section>
          <AnimatePresence>
            {selectedFeatureImage && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
                onClick={() => setSelectedFeatureImage(null)}
              >
                <button
                  type="button"
                  onClick={() => setSelectedFeatureImage(null)}
                  className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  aria-label="Close image preview"
                >
                  <X className="h-5 w-5" strokeWidth={1.7} />
                </button>
                <motion.img
                  src={selectedFeatureImage}
                  alt=""
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="max-h-[86vh] max-w-[92vw] rounded-[8px] border border-white/10 object-contain shadow-[0_30px_120px_rgba(0,0,0,0.8)]"
                  onClick={(event) => event.stopPropagation()}
                />
              </motion.div>
            )}
          </AnimatePresence>
          <Footer />
        </main>
      </div>
    </div>
  );
};

export default Index;













