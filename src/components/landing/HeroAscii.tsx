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
                  Use Kloak in Browser
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
                  See why Kloak exists
                </Button>
              </Link>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <a
                href="https://play.google.com/store/apps/details?id=app.kloak.mobile"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 transition-all hover:bg-white/10 hover:border-white/20"
                aria-label="Get Kloak on Google Play"
              >
                <svg className="h-7 w-7 shrink-0" viewBox="0 0 511.999 511.999" xmlns="http://www.w3.org/2000/svg">
                  <path d="M382.369,175.623C322.891,142.356,227.427,88.937,79.355,6.028C69.372-0.565,57.886-1.429,47.962,1.93l254.05,254.05L382.369,175.623z" fill="#32BBFF" />
                  <path d="M47.962,1.93c-1.86,0.63-3.67,1.39-5.401,2.308C31.602,10.166,23.549,21.573,23.549,36v439.96c0,14.427,8.052,25.834,19.012,31.761c1.728,0.917,3.537,1.68,5.395,2.314L302.012,255.98L47.962,1.93z" fill="#32BBFF" />
                  <path d="M302.012,255.98L47.956,510.035c9.927,3.384,21.413,2.586,31.399-4.103c143.598-80.41,237.986-133.196,298.152-166.746c1.675-0.941,3.316-1.861,4.938-2.772L302.012,255.98z" fill="#32BBFF" />
                  <path d="M23.549,255.98v219.98c0,14.427,8.052,25.834,19.012,31.761c1.728,0.917,3.537,1.68,5.395,2.314L302.012,255.98H23.549z" fill="#2C9FD9" />
                  <path d="M79.355,6.028C67.5-1.8,53.52-1.577,42.561,4.239l255.595,255.596l84.212-84.212C322.891,142.356,227.427,88.937,79.355,6.028z" fill="#29CC5E" />
                  <path d="M298.158,252.126L42.561,507.721c10.96,5.815,24.939,6.151,36.794-1.789c143.598-80.41,237.986-133.196,298.152-166.746c1.675-0.941,3.316-1.861,4.938-2.772L298.158,252.126z" fill="#D93F21" />
                  <path d="M488.45,255.98c0-12.19-6.151-24.492-18.342-31.314c0,0-22.799-12.721-92.682-51.809l-83.123,83.123l83.204,83.205c69.116-38.807,92.6-51.892,92.6-51.892C482.299,280.472,488.45,268.17,488.45,255.98z" fill="#FFD500" />
                  <path d="M470.108,287.294c12.191-6.822,18.342-19.124,18.342-31.314H294.303l83.204,83.205C446.624,300.379,470.108,287.294,470.108,287.294z" fill="#FFAA00" />
                </svg>
                <div className="flex flex-col items-start">
                  <span className="text-[10px] leading-tight text-zinc-400">GET IT ON</span>
                  <span className="text-sm font-semibold leading-tight text-white">Google Play</span>
                </div>
              </a>
              {/* App Store - Coming Soon */}
              <div
                className="pointer-events-none inline-flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] px-5 py-2.5 opacity-50"
                aria-label="App Store coming soon"
              >
                <svg className="h-7 w-7 shrink-0" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient x1="50%" y1="0%" x2="50%" y2="100%" id="appstore-grad">
                      <stop stopColor="#17C9FB" offset="0%" />
                      <stop stopColor="#1A74E8" offset="100%" />
                    </linearGradient>
                  </defs>
                  <path d="M56.0638473,0 L199.936153,0 C230.899361,0 256,25.1006394 256,56.0638473 L256,199.936153 C256,230.899361 230.899361,256 199.936153,256 L56.0638473,256 C25.1006394,256 0,230.899361 0,199.936153 L0,56.0638473 C0,25.1006394 25.1006394,0 56.0638473,0 Z" fill="url(#appstore-grad)" />
                  <path d="M82.041678,185.810289 L82.0657467,185.817889 L73.3130924,200.977891 C70.1182861,206.51167 63.0418283,208.407779 57.5080489,205.212719 C51.9745229,202.018166 50.0784142,194.941709 53.2732205,189.407929 L59.7211046,178.240042 L60.3397975,177.16835 C61.4449319,175.579561 64.1720448,172.838767 69.6270308,173.353838 C69.6270308,173.353838 82.4637674,174.747037 83.3925667,181.418887 C83.3928201,181.418887 83.5194976,183.614461 82.041678,185.810289 Z M206.18511,147.089287 L178.890925,147.089287 C177.032313,146.96489 176.22031,146.3011 175.901843,145.915241 L146.663918,95.2738878 L144.873712,92.786702 C142.002187,88.3953002 137.442051,99.6272864 137.442051,99.6272864 C131.997452,112.142769 138.21453,126.372451 140.382488,130.673152 L180.963875,200.962183 C184.158428,206.495962 191.234886,208.392071 196.768665,205.197011 C202.302191,202.002458 204.1983,194.926001 201.003494,189.392221 L190.855613,171.815973 C190.659263,171.390337 190.316981,170.233771 192.398038,170.229211 L206.18511,170.229211 C212.574975,170.229211 217.755071,165.049115 217.755071,158.659249 C217.755071,152.269383 212.574975,147.089287 206.18511,147.089287 Z M153.171088,162.818324 C153.171088,162.818324 154.627879,170.228957 148.99073,170.228957 L143.353582,170.228957 L143.353582,170.229211 L48.0918579,170.229211 C41.701992,170.229211 36.5218962,165.049115 36.5218962,158.659249 C36.5218962,152.269383 41.701992,147.089287 48.0918579,147.089287 L74.0318604,147.089287 C78.2198182,146.846573 79.2127163,144.42906 79.2127163,144.42906 L79.2355183,144.440715 L113.095904,85.7925846 C113.703196,84.6575543 113.189139,83.5871295 113.099704,83.417635 L101.917376,64.0494072 C98.7223163,58.5156278 100.618425,51.4394233 106.152204,48.244617 C111.685984,45.0495574 118.761935,46.9456661 121.956994,52.4794455 L127.143171,61.4623995 L132.320226,52.4954068 C135.515033,46.9616274 142.591237,45.0655188 148.125016,48.2605784 C153.658796,51.455638 155.554904,58.5318425 152.359845,64.0653685 L105.242153,145.675313 C105.036176,146.172142 104.97309,146.951969 106.505888,147.089287 L134.670094,147.089287 L134.676174,147.363671 C134.676174,147.363671 150.954231,147.617026 153.171088,162.818324 Z" fill="white" fillRule="nonzero" />
                </svg>
                <div className="flex flex-col items-start">
                  <span className="text-[10px] leading-tight text-zinc-500">Download on the</span>
                  <span className="text-sm font-semibold leading-tight text-white/70">App Store</span>
                </div>
                <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-400">Soon</span>
              </div>

              {/* Windows - Coming Soon */}
              <div
                className="pointer-events-none inline-flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] px-5 py-2.5 opacity-50"
                aria-label="Windows app coming soon"
              >
                <svg className="h-7 w-7 shrink-0" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                  <path fill="white" d="M30,15H17c-0.6,0-1-0.4-1-1V3.3c0-0.5,0.4-0.9,0.8-1l13-2.3c0.3,0,0.6,0,0.8,0.2C30.9,0.4,31,0.7,31,1v13 C31,14.6,30.6,15,30,15z" />
                  <path fill="white" d="M13,15H1c-0.6,0-1-0.4-1-1V6c0-0.5,0.4-0.9,0.8-1l12-2c0.3,0,0.6,0,0.8,0.2C13.9,3.4,14,3.7,14,4v10 C14,14.6,13.6,15,13,15z" />
                  <path fill="white" d="M30,32c-0.1,0-0.1,0-0.2,0l-13-2.3c-0.5-0.1-0.8-0.5-0.8-1V18c0-0.6,0.4-1,1-1h13c0.6,0,1,0.4,1,1v13 c0,0.3-0.1,0.6-0.4,0.8C30.5,31.9,30.2,32,30,32z" />
                  <path fill="white" d="M13,29c-0.1,0-0.1,0-0.2,0l-12-2C0.4,26.9,0,26.5,0,26v-8c0-0.6,0.4-1,1-1h12c0.6,0,1,0.4,1,1v10 c0,0.3-0.1,0.6-0.4,0.8C13.5,28.9,13.2,29,13,29z" />
                </svg>
                <div className="flex flex-col items-start">
                  <span className="text-[10px] leading-tight text-zinc-500">Get it for</span>
                  <span className="text-sm font-semibold leading-tight text-white/70">Windows</span>
                </div>
                <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-400">Soon</span>
              </div>

              {/* Linux - Coming Soon */}
              <div
                className="pointer-events-none inline-flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] px-5 py-2.5 opacity-50"
                aria-label="Linux app coming soon"
              >
                <svg className="h-7 w-7 shrink-0" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                  <path d="M30 16C30 23.728 23.735 30 16 30C8.265 30 2 23.728 2 16C2 8.265 8.265 2 16 2C23.735 2 30 8.265 30 16Z" fill="#E95420" />
                  <path d="M6.82154 14.1563C5.81185 14.1563 5 14.9865 5 16.0035C5 17.0205 5.81867 17.8507 6.82154 17.8507C7.82442 17.8507 8.64309 17.0205 8.64309 16.0035C8.64309 14.9795 7.82442 14.1563 6.82154 14.1563ZM19.8316 22.5482C18.9583 23.0602 18.665 24.1879 19.163 25.0734C19.6679 25.959 20.7799 26.2634 21.6531 25.7514C22.5264 25.2395 22.8197 24.1118 22.3217 23.2262C21.8101 22.3476 20.698 22.0432 19.8316 22.5482ZM10.7785 16.0035C10.7785 14.177 11.6722 12.565 13.0434 11.5896L11.7131 9.32725C10.1167 10.4065 8.93645 12.06 8.43842 13.9902C9.01149 14.4676 9.37989 15.194 9.37989 16.0035C9.37989 16.8129 9.01149 17.5393 8.43842 18.0167C8.92962 19.9469 10.1167 21.6004 11.7131 22.6797L13.0434 20.4174C11.6722 19.4419 10.7785 17.8299 10.7785 16.0035ZM16.0998 10.6071C18.8833 10.6071 21.1619 12.7657 21.4007 15.5261L24 15.4846C23.8704 13.4506 22.9971 11.6241 21.6463 10.282C20.9504 10.5449 20.1522 10.5034 19.4632 10.1021C18.7673 9.69393 18.3375 9.01593 18.2147 8.26875C17.5393 8.08195 16.8298 7.97817 16.0998 7.97817C14.8377 7.97817 13.6506 8.27566 12.5932 8.80838L13.8621 11.1053C14.5375 10.787 15.3016 10.6071 16.0998 10.6071ZM16.0998 21.3998C15.3016 21.3998 14.5375 21.2199 13.8553 20.9017L12.5864 23.1985C13.6438 23.7313 14.8377 24.0287 16.093 24.0287C16.823 24.0287 17.5325 23.925 18.2079 23.7382C18.3239 22.9979 18.7605 22.313 19.4564 21.9048C20.1454 21.4966 20.9504 21.462 21.6395 21.7249C22.9835 20.3828 23.8636 18.5563 23.9932 16.5223L21.3939 16.4808C21.1619 19.2343 18.8833 21.3998 16.0998 21.3998ZM19.8248 9.45178C20.698 9.96374 21.8101 9.65933 22.3149 8.77378C22.8197 7.88824 22.5196 6.76054 21.6463 6.24859C20.7731 5.73663 19.661 6.04104 19.1562 6.92659C18.6582 7.81213 18.9583 8.93983 19.8248 9.45178Z" fill="white" />
                </svg>
                <div className="flex flex-col items-start">
                  <span className="text-[10px] leading-tight text-zinc-500">Get it for</span>
                  <span className="text-sm font-semibold leading-tight text-white/70">Linux</span>
                </div>
                <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-400">Soon</span>
              </div>
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

