import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Plus, Users, Compass, Heart } from "lucide-react";
import { useUIStore, useAuthStore } from "@/stores";
import { SupportUsButton } from "@/components/support/SupportUsButton";
import kloakLogo from "@/assets/kloak-logo.svg";

const SupportUsBox = () => (
  <div className="p-4 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl bg-card/50 border border-border/50 hover:bg-card hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-200 text-left group w-full h-full relative">
    <div className="flex flex-col items-center text-center gap-2 sm:gap-3 md:gap-4">
      <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-lg sm:rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
        <Heart className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-emerald-400" />
      </div>
      <div className="space-y-0.5 sm:space-y-1 md:space-y-2">
        <h3 className="font-semibold text-sm sm:text-base md:text-lg">Support Us</h3>
        <p className="text-xs sm:text-sm text-muted-foreground px-1">Help keep Kloak running</p>
      </div>
    </div>
    {/* Invisible SupportUsButton overlay that handles click + dropdown/sheet */}
    <div className="absolute inset-0 flex items-center justify-center">
      <SupportUsButton variant="overlay" />
    </div>
  </div>
);

export const HomeLanding = () => {
  const navigate = useNavigate();
  const { openModal } = useUIStore();
  const { user } = useAuthStore();

  const getTimeGreeting = () => {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 12) return { text: "Good morning", emoji: "☀️" };
    if (hour >= 12 && hour < 17) return { text: "Good afternoon", emoji: "🌤️" };
    if (hour >= 17 && hour < 22) return { text: "Good evening", emoji: "🌙" };
    return { text: "Good night", emoji: "🌙" };
  };

  const greeting = getTimeGreeting();
  const displayName = user?.display_name || user?.username || "there";

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <div className="flex-1 h-full bg-layout-chat overflow-y-auto w-full flex items-center justify-center relative min-h-0 py-3 sm:py-0">
      {/* Gradient Circle Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-1/4 left-1/4 w-64 h-64 sm:w-96 sm:h-96 rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-transparent blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 30, 0],
            y: [0, -20, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-56 h-56 sm:w-80 sm:h-80 rounded-full bg-gradient-to-tl from-primary/15 via-primary/5 to-transparent blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            x: [0, -25, 0],
            y: [0, 25, 0],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute top-1/2 right-1/3 w-48 h-48 sm:w-72 sm:h-72 rounded-full bg-gradient-to-r from-primary/10 via-primary/5 to-transparent blur-3xl"
          animate={{
            scale: [1, 1.15, 1],
            x: [0, 20, 0],
            y: [0, 15, 0],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-5 md:py-8 relative z-10 w-full">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-4 sm:space-y-8 md:space-y-10"
        >
          {/* Hero Section */}
          <motion.div
            variants={item}
            className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 md:gap-3"
          >
            <div className="flex items-center relative">
              <img
                src="/krill/krill-welcome.svg"
                alt="Happy krill"
                className="h-52 w-52 sm:h-56 sm:w-56 md:h-44 md:w-44 object-contain"
                fetchPriority="high"
              />
            </div>
            <div className="text-center sm:text-left space-y-1 sm:space-y-1.5">
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight text-foreground break-words">
                {greeting.text}, <span className="text-primary break-words">{displayName}</span>{" "}
                <span aria-hidden="true">{greeting.emoji}</span>
              </h1>
              <p className="text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl">
                Chat with friends, build communities, and connect — all without giving up your privacy.
              </p>
            </div>
          </motion.div>

          {/* Action Boxes */}
          <motion.div
            variants={item}
            className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 md:gap-4 px-1 sm:px-2 md:px-0"
          >
            <button
              onClick={() => openModal("create-server")}
              className="p-3 sm:p-4 md:p-6 rounded-xl sm:rounded-2xl bg-card/50 border border-border/50 hover:bg-card hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 text-left group w-full"
            >
              <div className="flex flex-col items-center text-center gap-2 sm:gap-3 md:gap-4">
                <div className="w-9 h-9 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-lg sm:rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Plus className="w-4.5 h-4.5 sm:w-5 sm:h-5 md:w-6 md:h-6 text-primary" />
                </div>
                <div className="space-y-0.5 sm:space-y-1 md:space-y-2">
                  <h3 className="font-semibold text-sm sm:text-base md:text-lg">Create Server</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground px-1">Start your own private community</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => openModal("join-server")}
              className="p-3 sm:p-4 md:p-6 rounded-xl sm:rounded-2xl bg-card/50 border border-border/50 hover:bg-card hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 text-left group w-full"
            >
              <div className="flex flex-col items-center text-center gap-2 sm:gap-3 md:gap-4">
                <div className="w-9 h-9 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-lg sm:rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Users className="w-4.5 h-4.5 sm:w-5 sm:h-5 md:w-6 md:h-6 text-primary" />
                </div>
                <div className="space-y-0.5 sm:space-y-1 md:space-y-2">
                  <h3 className="font-semibold text-sm sm:text-base md:text-lg">Join Server</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground px-1">Enter an invite code to join</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => navigate("/app/explore")}
              className="p-3 sm:p-4 md:p-6 rounded-xl sm:rounded-2xl bg-card/50 border border-border/50 hover:bg-card hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 text-left group w-full"
            >
              <div className="flex flex-col items-center text-center gap-2 sm:gap-3 md:gap-4">
                <div className="w-9 h-9 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-lg sm:rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Compass className="w-4.5 h-4.5 sm:w-5 sm:h-5 md:w-6 md:h-6 text-primary" />
                </div>
                <div className="space-y-0.5 sm:space-y-1 md:space-y-2">
                  <h3 className="font-semibold text-sm sm:text-base md:text-lg">Discover</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground px-1">Explore public communities</p>
                </div>
              </div>
            </button>

            {/* Support Us - mobile only (hidden on sm+ where sidebar button is visible) */}
            <div className="sm:hidden">
              <SupportUsBox />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

