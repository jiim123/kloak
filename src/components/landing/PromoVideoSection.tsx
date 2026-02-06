import { useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import promoVideo from "@/assets/kloak-promo.mp4";

export const PromoVideoSection = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  return (
    <section
      ref={sectionRef}
      className="relative py-24 md:py-40 px-6 lg:px-16 border-t border-border/20 overflow-hidden bg-[hsl(var(--neutral-0))]"
    >
      {/* Ambient glow behind the video */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full bg-primary/[0.04] blur-[120px]" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Section label */}
        <motion.div
          className="flex items-center gap-4 mb-6"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-xs font-mono text-primary tracking-widest uppercase">
            See it in action
          </span>
        </motion.div>

        <motion.h2
          className="text-3xl sm:text-4xl md:text-5xl font-light text-foreground leading-tight tracking-tight mb-12 md:mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          Built different.
          <br />
          <span className="text-primary/60">See for yourself.</span>
        </motion.h2>

        {/* Video container with parallax */}
        <motion.div style={{ y, opacity }} className="relative">
          {/* Outer frame with border glow */}
          <div className="relative rounded-xl overflow-hidden border border-border/30 bg-[hsl(var(--neutral-50))] shadow-2xl shadow-black/40">
            {/* Top browser-style bar */}
            <div className="flex items-center gap-2 px-4 py-3 bg-[hsl(var(--neutral-100))] border-b border-border/20">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[hsl(var(--neutral-300))]" />
                <div className="w-3 h-3 rounded-full bg-[hsl(var(--neutral-300))]" />
                <div className="w-3 h-3 rounded-full bg-[hsl(var(--neutral-300))]" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-4 py-1 rounded-md bg-[hsl(var(--neutral-200))] text-xs text-muted-foreground font-mono">
                  kloak.app
                </div>
              </div>
              <div className="w-[54px]" /> {/* spacer to balance the dots */}
            </div>

            {/* Video */}
            <div className="relative aspect-video bg-black cursor-pointer group" onClick={togglePlay}>
              <video
                ref={videoRef}
                src={promoVideo}
                muted={isMuted}
                playsInline
                loop
                preload="metadata"
                className="w-full h-full object-cover"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />

              {/* Play overlay — shows when paused */}
              {!isPlaying && (
                <motion.div
                  className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Play className="w-7 h-7 md:w-8 md:h-8 text-white ml-1" />
                  </motion.div>
                </motion.div>
              )}

              {/* Bottom controls — show on hover when playing */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="flex items-center justify-between">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePlay();
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                  >
                    {isPlaying ? (
                      <Pause className="w-4 h-4 text-white" />
                    ) : (
                      <Play className="w-4 h-4 text-white ml-0.5" />
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMute();
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                  >
                    {isMuted ? (
                      <VolumeX className="w-4 h-4 text-white" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-white" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Reflection glow below */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-16 bg-primary/[0.06] blur-3xl rounded-full pointer-events-none" />
        </motion.div>
      </div>
    </section>
  );
};

export default PromoVideoSection;
