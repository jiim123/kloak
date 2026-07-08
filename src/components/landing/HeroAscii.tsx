import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const HeroPreviewImage = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 0.5, 1], [140, 0, -140]);
  const scale = useTransform(scrollYProgress, [0, 0.45, 1], [0.86, 1.03, 0.94]);
  const rotateX = useTransform(scrollYProgress, [0, 0.45, 1], [12, 0, -8]);
  const rotateZ = useTransform(scrollYProgress, [0, 0.45, 1], [-2, 0, 1.5]);
  const opacity = useTransform(scrollYProgress, [0, 0.18, 0.82, 1], [0.32, 1, 1, 0.42]);
  const glowOpacity = useTransform(scrollYProgress, [0, 0.34, 0.74, 1], [0.35, 1, 0.78, 0.28]);
  const glowScale = useTransform(scrollYProgress, [0, 0.5, 1], [0.82, 1.08, 0.92]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className="relative mx-auto w-full max-w-[1080px]"
    >
      <div className="relative [perspective:1200px]">
        <motion.div style={{ y, scale, rotateX, rotateZ, opacity }} className="relative [transform-style:preserve-3d]">
          <motion.div
            style={{ opacity: glowOpacity, scale: glowScale }}
            className="pointer-events-none absolute -inset-x-24 -inset-y-20 rounded-[56px] bg-[radial-gradient(ellipse_at_center,rgba(76,76,92,0.9)_0%,rgba(30,30,38,0.86)_34%,rgba(8,8,12,0.62)_56%,rgba(0,0,0,0)_78%)] blur-3xl"
          />
          <motion.div
            style={{ opacity: glowOpacity }}
            className="pointer-events-none absolute -inset-x-8 -inset-y-6 rounded-[36px] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.18)_0%,rgba(48,48,60,0.62)_42%,rgba(0,0,0,0)_72%)] blur-xl"
          />
          <img
            src="/hero-img.svg"
            alt="Kloak app interface"
            className="relative w-full rounded-[28px] shadow-[0_46px_130px_rgba(0,0,0,0.82),0_0_64px_rgba(120,120,140,0.28)]"
          />
        </motion.div>
      </div>
    </motion.div>
  );
};

export const HeroImage = () => {
  return (
    <section className="relative overflow-hidden bg-black pt-24 text-white sm:pt-28">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.08),transparent_34%),radial-gradient(circle_at_50%_64%,rgba(255,255,255,0.045),transparent_36%),linear-gradient(180deg,#020203_0%,#08090c_48%,#020203_100%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[1480px] flex-col px-4 pb-24 sm:px-6 lg:px-8">
        <div className="flex flex-1 flex-col items-center justify-center gap-12 pt-6">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto max-w-4xl pt-2 text-center"
          >
            <h1 className="text-[clamp(2.75rem,7vw,6.8rem)] font-semibold leading-[0.9] tracking-tight text-white">
              The <span className="font-['Instrument_Serif'] font-normal italic tracking-normal text-zinc-100">Discord alternative</span> that{" "}
              <span className="font-['Instrument_Serif'] font-normal italic tracking-normal text-zinc-100">does not watch you</span>.
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">
              Kloak gives your group chat, voice, channels, roles, events, media, and DMs without phone numbers, emails,
              ads, or behavioral tracking.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/app">
                <Button size="lg" className="h-12 w-full px-6 text-sm sm:w-auto" rounded="full">
                  Open Kloak
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/about">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 w-full border-white/15 bg-white/5 px-6 text-sm text-white hover:bg-white/10 sm:w-auto"
                  rounded="full"
                >
                  Why it exists
                </Button>
              </Link>
            </div>
          </motion.div>

          <div className="w-full pb-8">
            <HeroPreviewImage />
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroImage;

