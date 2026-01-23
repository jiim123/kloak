import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Plus, Users, Compass } from "lucide-react";
import { useUIStore } from "@/stores";
import kloakLogo from "@/assets/kloak-logo.svg";

export const HomeLanding = () => {
    const navigate = useNavigate();
    const { openModal } = useUIStore();

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
        <div className="flex-1 h-full bg-layout-chat overflow-y-auto w-full flex items-center justify-center">
            <div className="max-w-3xl mx-auto px-6 py-12">
                <motion.div
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="space-y-16"
                >
                    {/* Hero Section */}
                    <motion.div variants={item} className="text-center space-y-8">
                        <img src={kloakLogo} alt="Kloak" className="h-16 md:h-20 mx-auto" />
                        <div className="space-y-4">
                            <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground">
                                Welcome Back
                            </h1>
                            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl mx-auto">
                                Chat with friends, build communities, and connect — all without giving up your privacy.
                            </p>
                        </div>
                    </motion.div>

                    {/* Action Boxes */}
                    <motion.div variants={item} className="grid sm:grid-cols-3 gap-6">
                        <button
                            onClick={() => openModal('create-server')}
                            className="p-8 rounded-2xl bg-card/50 border border-border/50 hover:bg-card hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 text-left group"
                        >
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                    <Plus className="w-7 h-7 text-primary" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-lg">Create Server</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Start your own private community
                                    </p>
                                </div>
                            </div>
                        </button>

                        <button
                            onClick={() => openModal('join-server')}
                            className="p-8 rounded-2xl bg-card/50 border border-border/50 hover:bg-card hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 text-left group"
                        >
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                    <Users className="w-7 h-7 text-primary" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-lg">Join Server</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Enter an invite code to join
                                    </p>
                                </div>
                            </div>
                        </button>

                        <button
                            onClick={() => navigate('/app/explore')}
                            className="p-8 rounded-2xl bg-card/50 border border-border/50 hover:bg-card hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 text-left group"
                        >
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                    <Compass className="w-7 h-7 text-primary" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-lg">Discover</h3>
                                    <p className="text-sm text-muted-foreground">
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
