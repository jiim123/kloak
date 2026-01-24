import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Plus, Users, Compass } from "lucide-react";
import { useUIStore, useAuthStore } from "@/stores";
import kloakLogo from "@/assets/kloak-logo.svg";

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
                staggerChildren: 0.1
            }
        }
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    return (
        <div className="flex-1 h-full bg-layout-chat overflow-y-auto w-full flex items-center justify-center relative min-h-0 py-4 sm:py-0">
            {/* Background Image with Opacity */}
            <div 
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{
                    backgroundImage: `url('https://img.freepik.com/free-photo/sunset-bike-ride_23-2151995338.jpg?t=st=1769254304~exp=1769257904~hmac=ef08dce584a865eaa79824be05567f1fa0b64271174038cee13863db1e3cf7d6&w=1060')`,
                    opacity: 0.25
                }}
            />
            {/* Dark overlay for better text readability */}
            <div className="absolute inset-0 bg-layout-chat/60" />
            
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

            <div className="max-w-3xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-12 relative z-10 w-full">
                <motion.div
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="space-y-6 sm:space-y-12 md:space-y-16"
                >
                    {/* Hero Section */}
                    <motion.div variants={item} className="text-center space-y-3 sm:space-y-6 md:space-y-8">
                        <img src={kloakLogo} alt="Kloak" className="h-10 sm:h-14 md:h-16 lg:h-20 mx-auto" />
                        <div className="space-y-2 sm:space-y-3 md:space-y-4">
                            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-5xl font-bold tracking-tight text-foreground px-2 break-words">
                                {greeting.text},{" "}
                                <span className="text-primary break-words">{displayName}</span>{" "}
                                <span aria-hidden="true">{greeting.emoji}</span>
                            </h1>
                            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-muted-foreground leading-relaxed max-w-xl mx-auto px-2 sm:px-4">
                                Chat with friends, build communities, and connect — all without giving up your privacy.
                            </p>
                        </div>
                    </motion.div>

                    {/* Action Boxes */}
                    <motion.div variants={item} className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 md:gap-6 px-1 sm:px-2 md:px-0">
                        <button
                            onClick={() => openModal('create-server')}
                            className="p-4 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl bg-card/50 border border-border/50 hover:bg-card hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 text-left group w-full"
                        >
                            <div className="flex flex-col items-center text-center gap-2 sm:gap-3 md:gap-4">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-lg sm:rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                    <Plus className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-primary" />
                                </div>
                                <div className="space-y-0.5 sm:space-y-1 md:space-y-2">
                                    <h3 className="font-semibold text-sm sm:text-base md:text-lg">Create Server</h3>
                                    <p className="text-xs sm:text-sm text-muted-foreground px-1">
                                        Start your own private community
                                    </p>
                                </div>
                            </div>
                        </button>

                        <button
                            onClick={() => openModal('join-server')}
                            className="p-4 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl bg-card/50 border border-border/50 hover:bg-card hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 text-left group w-full"
                        >
                            <div className="flex flex-col items-center text-center gap-2 sm:gap-3 md:gap-4">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-lg sm:rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                    <Users className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-primary" />
                                </div>
                                <div className="space-y-0.5 sm:space-y-1 md:space-y-2">
                                    <h3 className="font-semibold text-sm sm:text-base md:text-lg">Join Server</h3>
                                    <p className="text-xs sm:text-sm text-muted-foreground px-1">
                                        Enter an invite code to join
                                    </p>
                                </div>
                            </div>
                        </button>

                        <button
                            onClick={() => navigate('/app/explore')}
                            className="col-span-2 sm:col-span-1 p-4 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl bg-card/50 border border-border/50 hover:bg-card hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 text-left group w-full"
                        >
                            <div className="flex flex-col items-center text-center gap-2 sm:gap-3 md:gap-4">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-lg sm:rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                    <Compass className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-primary" />
                                </div>
                                <div className="space-y-0.5 sm:space-y-1 md:space-y-2">
                                    <h3 className="font-semibold text-sm sm:text-base md:text-lg">Discover</h3>
                                    <p className="text-xs sm:text-sm text-muted-foreground px-1">
                                        Explore public communities
                                    </p>
                                </div>
                            </div>
                        </button>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
};
