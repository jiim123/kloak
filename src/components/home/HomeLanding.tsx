import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Plus, Users, Compass, Heart } from "lucide-react";
import { useUIStore, useAuthStore } from "@/stores";
import { SupportUsButton } from "@/components/support/SupportUsButton";

const SupportUsBox = () => (
  <div className="p-4 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl bg-card/50 border border-border/50 hover:bg-card hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-200 text-left group w-full h-full relative">
    <div className="flex flex-col items-center text-center gap-2 sm:gap-3 md:gap-4">
      <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-lg sm:rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
        <Heart className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-emerald-400" />
      </div>
      <div className="space-y-0.5 sm:space-y-1 md:space-y-2">
        <h3 className="font-medium text-sm sm:text-base md:text-lg">Support Us</h3>
        <p className="text-xs sm:text-sm text-muted-foreground px-1">Help keep Kloak running</p>
      </div>
    </div>
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
      <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-5 md:py-8 relative z-10 w-full">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-6 sm:space-y-8 md:space-y-10"
        >
          {/* Greeting Section */}
          <motion.div variants={item} className="text-center space-y-1 sm:space-y-1.5">
            <div className="space-y-0.5 sm:space-y-1">
              <p className="text-base sm:text-lg md:text-xl text-muted-foreground font-medium">
                {greeting.text} <span aria-hidden="true">{greeting.emoji}</span>
              </p>
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-medium tracking-tight text-primary break-words">
                @{user?.username || "there"}
              </h1>
            </div>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">
              Create your own community, join one with an invite, or explore what's out there.
            </p>
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
                  <h3 className="font-medium text-sm sm:text-base md:text-lg">Create Server</h3>
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
                  <h3 className="font-medium text-sm sm:text-base md:text-lg">Join Server</h3>
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
                  <h3 className="font-medium text-sm sm:text-base md:text-lg">Discover</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground px-1">Explore public communities</p>
                </div>
              </div>
            </button>

            {/* Support Us - mobile only */}
            <div className="sm:hidden">
              <SupportUsBox />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};
