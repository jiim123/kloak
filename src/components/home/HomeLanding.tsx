import { motion } from "framer-motion";
import { Shield, Zap } from "lucide-react";

export const HomeLanding = () => {
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
                            <Shield className="w-10 h-10 text-primary" />
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                            Welcome to <span className="text-primary">Kloak</span>
                        </h1>
                        <p className="text-lg text-muted-foreground leading-relaxed max-w-lg mx-auto">
                            Your private sanctuary for secure communication. Select a conversation to start chatting, or find friends in the sidebar.
                        </p>
                    </motion.div>

                    {/* Feature Highlights - Compact */}
                    <motion.div variants={item} className="grid sm:grid-cols-2 gap-4 pt-4">
                        <div className="p-4 rounded-lg bg-card/50 border border-border/50">
                            <div className="flex items-center gap-3 mb-2">
                                <Zap className="w-5 h-5 text-primary" />
                                <h3 className="font-semibold text-sm">Lightning Fast</h3>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Optimized for speed. Messages deliver instantly.
                            </p>
                        </div>

                        <div className="p-4 rounded-lg bg-card/50 border border-border/50">
                            <div className="flex items-center gap-3 mb-2">
                                <Shield className="w-5 h-5 text-primary" />
                                <h3 className="font-semibold text-sm">Secure by Default</h3>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                No tracking, no ads. Encrypted in transit.
                            </p>
                        </div>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
};
