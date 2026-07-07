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
  const y = useTransform(scrollYProgress, [0, 1], [44, -44]);
  const scale = useTransform(scrollYProgress, [0, 0.45, 1], [0.97, 1, 1.02]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className="relative mx-auto w-full max-w-[1360px]"
    >
      <motion.img
        src="/hero-img.svg"
        alt="Kloak app interface"
        style={{ y, scale }}
        className="relative w-full rounded-[28px] shadow-[0_30px_90px_rgba(0,0,0,0.45)]"
      />
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
              The Discord alternative that does not watch you.
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
