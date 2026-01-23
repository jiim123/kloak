import { motion } from "framer-motion";
import { Plus, Users, Compass } from "lucide-react";
import { useUIStore } from "@/stores";
import kloakLogo from "@/assets/kloak-logo.svg";

export const HomeLanding = () => {
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
            <div className="max-w-2xl mx-auto px-6 py-12">
                <motion.div
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="space-y-12"
                >
                    {/* Hero Section */}
                    <motion.div variants={item} className="text-center space-y-6">
                        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-primary/10 mb-4">
                            <img src={kloakLogo} alt="Kloak" className="w-10 h-10" />
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                            Welcome to <span className="text-primary">Kloak</span>
                        </h1>
                        <p className="text-lg text-muted-foreground leading-relaxed max-w-lg mx-auto">
                            Chat with friends, build communities, and connect — all without giving up your privacy.
                        </p>
                    </motion.div>

                    {/* Action Boxes */}
                    <motion.div variants={item} className="grid sm:grid-cols-3 gap-4 pt-4">
                        <button
                            onClick={() => openModal('create-server')}
                            className="p-4 rounded-lg bg-card/50 border border-border/50 hover:bg-card hover:border-primary/50 transition-colors text-left group"
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <Plus className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                                <h3 className="font-semibold text-sm">Create Server</h3>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Start your own community
                            </p>
                        </button>

                        <button
                            onClick={() => openModal('join-server')}
                            className="p-4 rounded-lg bg-card/50 border border-border/50 hover:bg-card hover:border-primary/50 transition-colors text-left group"
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <Users className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                                <h3 className="font-semibold text-sm">Join Server</h3>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Enter an invite code
                            </p>
                        </button>

                        <button
                            onClick={() => openModal('search')}
                            className="p-4 rounded-lg bg-card/50 border border-border/50 hover:bg-card hover:border-primary/50 transition-colors text-left group"
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <Compass className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                                <h3 className="font-semibold text-sm">Discover</h3>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Explore public communities
                            </p>
                        </button>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
};
