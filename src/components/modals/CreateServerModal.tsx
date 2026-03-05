"use client";

import { useState, useRef, useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, MotionConfigContext } from "framer-motion";
import { Loader2, Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUIStore } from "@/stores/uiStore";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { secureUpload } from "@/lib/storageUpload";
import { toast } from "sonner";

// ─── Constants ───────────────────────────────────────────────────────────────
const MAX_ICON_SIZE = 1 * 1024 * 1024;
const ALLOWED_ICON_TYPES = ["image/jpeg", "image/png", "image/webp"];

const createServerSchema = z.object({
  name: z.string().trim().min(1, "Server name is required").max(50, "Server name must be less than 50 characters"),
});
type CreateServerForm = z.infer<typeof createServerSchema>;
type ModalView = "choose" | "create";

// ─── 3D Animation Helpers ────────────────────────────────────────────────────
const springTransition = { bounce: 0, delay: 0, duration: 0.45, type: "spring" as const };
const tweenTransition = {
  delay: 0,
  duration: 0.4,
  ease: [0.44, 0, 0.56, 1] as [number, number, number, number],
  type: "tween" as const,
};
const titleTransition = {
  duration: 0.3,
  ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
  type: "tween" as const,
};
const transformCentered = (_: any, t: string) => `translate(-50%, -50%) ${t}`;

const Transition: React.FC<{ value: any; children: React.ReactNode }> = ({ value, children }) => {
  const config = useContext(MotionConfigContext);
  const transition = value ?? config.transition;
  const contextValue = useMemo(() => ({ ...config, transition }), [JSON.stringify(transition)]);
  return <MotionConfigContext.Provider value={contextValue}>{children}</MotionConfigContext.Provider>;
};

// ─── Shared face style ───────────────────────────────────────────────────────
const faceBase: React.CSSProperties = {
  display: "flex",
  flex: "none",
  flexDirection: "column",
  alignContent: "center",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  padding: "0px",
  border: "3px solid var(--card-accent)",
  backgroundColor: "var(--background)",
};

// ─── SHAPE 1: Sliced Cube (Create) ───────────────────────────────────────────
const CubeSlice: React.FC<{ isHover: boolean; accentVar: string }> = ({ isHover, accentVar }) => (
  <Transition value={tweenTransition}>
    <motion.div
      style={{
        display: "flex",
        flex: "none",
        flexDirection: "row",
        gap: "10px",
        height: "min-content",
        overflow: "visible",
        padding: "0px",
        position: "relative",
        transformStyle: "preserve-3d",
        width: "min-content",
      }}
    >
      <motion.div style={{ ...faceBase, height: "30px", position: "relative", width: "200px", zIndex: 120 }} />
      <motion.div
        style={{
          ...faceBase,
          bottom: "0px",
          position: "absolute",
          right: "0px",
          top: "0px",
          width: "200px",
          zIndex: 1,
          rotateY: 180,
        }}
      />
      <motion.div
        style={{
          ...faceBase,
          bottom: "0px",
          left: "100px",
          position: "absolute",
          top: "0px",
          width: "200px",
          zIndex: 1,
          rotateY: 90,
        }}
      />
      <motion.div
        style={{
          ...faceBase,
          bottom: "0px",
          position: "absolute",
          right: "100px",
          top: "0px",
          width: "200px",
          zIndex: 1,
          rotateY: -90,
        }}
      />
      <motion.div
        style={{
          ...faceBase,
          flex: "none",
          height: "200px",
          left: "0px",
          position: "absolute",
          right: "0px",
          top: "-100px",
          zIndex: 1,
          rotateX: 90,
        }}
      />
      <motion.div
        style={{
          ...faceBase,
          flex: "none",
          height: "200px",
          left: "0px",
          position: "absolute",
          right: "0px",
          top: "-75px",
          zIndex: 1,
          rotateX: 90,
        }}
      />
    </motion.div>
  </Transition>
);

const CubeShape: React.FC<{ isHover: boolean }> = ({ isHover }) => {
  const cubeVariants = { hovered: { rotateX: -28, rotateY: -43, scale: 1.15 } };
  const cornerVariants = { hovered: { scale: 2.2 } };
  return (
    <motion.div
      style={{
        flex: "none",
        height: "300px",
        overflow: "visible",
        position: "relative",
        width: "300px",
        zIndex: 2,
        scale: 0.28,
      }}
    >
      <motion.div
        style={{
          alignContent: "center",
          alignItems: "center",
          display: "flex",
          flex: "none",
          flexDirection: "column",
          gap: "24px",
          height: "min-content",
          justifyContent: "center",
          left: "50%",
          overflow: "visible",
          padding: "0px",
          position: "absolute",
          top: "50%",
          transformStyle: "preserve-3d",
          width: "min-content",
          zIndex: 3,
          rotate: 49,
          rotateX: 23,
          rotateY: 33,
          scale: 0.7,
          transformPerspective: 1200,
        }}
        transformTemplate={transformCentered}
        variants={cubeVariants}
        animate={isHover ? "hovered" : "default"}
        transition={springTransition}
      >
        <CubeSlice isHover={isHover} accentVar="--card-accent" />
        <CubeSlice isHover={isHover} accentVar="--card-accent" />
        <CubeSlice isHover={isHover} accentVar="--card-accent" />
      </motion.div>
      {/* Corners */}
      {[
        {
          style: {
            left: "14px",
            top: "14px",
            borderLeft: "3px solid var(--card-accent)",
            borderTop: "3px solid var(--card-accent)",
          },
        },
        {
          style: {
            left: "14px",
            top: "262px",
            borderLeft: "3px solid var(--card-accent)",
            borderBottom: "3px solid var(--card-accent)",
          },
        },
        {
          style: {
            right: "14px",
            bottom: "14px",
            borderRight: "3px solid var(--card-accent)",
            borderBottom: "3px solid var(--card-accent)",
          },
        },
        {
          style: {
            right: "14px",
            top: "14px",
            borderRight: "3px solid var(--card-accent)",
            borderTop: "3px solid var(--card-accent)",
          },
        },
      ].map((c, i) => (
        <motion.div
          key={i}
          style={{
            flex: "none",
            height: "20px",
            overflow: "hidden",
            position: "absolute",
            width: "20px",
            zIndex: 2,
            ...c.style,
          }}
          variants={cornerVariants}
          animate={isHover ? "hovered" : "default"}
          transition={springTransition}
        />
      ))}
    </motion.div>
  );
};

// ─── SHAPE 2: Stacked Rings (Join) ───────────────────────────────────────────
const RingShape: React.FC<{ isHover: boolean }> = ({ isHover }) => {
  const ringVariants = { hovered: { rotateX: -20, rotateY: 50, scale: 1.1 } };
  const rings = [
    { rotateX: 80, y: -70, size: 180 },
    { rotateX: 80, y: 0, size: 220 },
    { rotateX: 80, y: 70, size: 180 },
    { rotateX: 10, y: 0, size: 200 },
    { rotateX: 45, y: 0, size: 210 },
  ];
  return (
    <motion.div
      style={{
        flex: "none",
        height: "300px",
        overflow: "visible",
        position: "relative",
        width: "300px",
        zIndex: 2,
        scale: 0.28,
      }}
    >
      <motion.div
        style={{
          display: "flex",
          alignContent: "center",
          alignItems: "center",
          justifyContent: "center",
          left: "50%",
          overflow: "visible",
          padding: "0px",
          position: "absolute",
          top: "50%",
          transformStyle: "preserve-3d",
          width: "min-content",
          zIndex: 3,
          rotateX: 20,
          rotateY: -30,
          transformPerspective: 1200,
        }}
        transformTemplate={transformCentered}
        variants={ringVariants}
        animate={isHover ? "hovered" : "default"}
        transition={springTransition}
      >
        {rings.map((r, i) => (
          <motion.div
            key={i}
            style={{
              position: "absolute",
              width: `${r.size}px`,
              height: `${r.size}px`,
              borderRadius: "50%",
              border: "3px solid var(--card-accent)",
              backgroundColor: "transparent",
              translateY: r.y,
              rotateX: r.rotateX,
              transformStyle: "preserve-3d",
            }}
          />
        ))}
        {/* Central dot */}
        <motion.div
          style={{
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            backgroundColor: "var(--card-accent)",
            opacity: 0.6,
            position: "absolute",
          }}
        />
      </motion.div>
    </motion.div>
  );
};

// ─── SHAPE 3: Orbiting Compass (Explore) ─────────────────────────────────────
const ExploreShape: React.FC<{ isHover: boolean }> = ({ isHover }) => {
  const globeVariants = { hovered: { rotateX: -15, rotateY: 60, scale: 1.1 } };
  const latLines = [-90, -60, -30, 0, 30, 60, 90];
  const lngLines = [0, 45, 90, 135];
  return (
    <motion.div
      style={{
        flex: "none",
        height: "300px",
        overflow: "visible",
        position: "relative",
        width: "300px",
        zIndex: 2,
        scale: 0.28,
      }}
    >
      <motion.div
        style={{
          display: "flex",
          alignContent: "center",
          alignItems: "center",
          justifyContent: "center",
          left: "50%",
          overflow: "visible",
          padding: "0px",
          position: "absolute",
          top: "50%",
          transformStyle: "preserve-3d",
          width: "min-content",
          zIndex: 3,
          rotateX: 15,
          rotateY: -20,
          transformPerspective: 1200,
        }}
        transformTemplate={transformCentered}
        variants={globeVariants}
        animate={isHover ? "hovered" : "default"}
        transition={springTransition}
      >
        {/* Latitude lines */}
        {latLines.map((lat, i) => (
          <motion.div
            key={`lat-${i}`}
            style={{
              position: "absolute",
              width: `${Math.round(200 * Math.cos((lat * Math.PI) / 180))}px`,
              height: `${Math.round(200 * Math.cos((lat * Math.PI) / 180))}px`,
              borderRadius: "50%",
              border: "2px solid var(--card-accent)",
              backgroundColor: "transparent",
              opacity: lat === 0 ? 1 : 0.45,
              translateY: Math.round(100 * Math.sin((lat * Math.PI) / 180)),
              rotateX: 90,
              transformStyle: "preserve-3d",
            }}
          />
        ))}
        {/* Longitude lines */}
        {lngLines.map((lng, i) => (
          <motion.div
            key={`lng-${i}`}
            style={{
              position: "absolute",
              width: "200px",
              height: "200px",
              borderRadius: "50%",
              border: "2px solid var(--card-accent)",
              backgroundColor: "transparent",
              opacity: 0.45,
              rotateY: lng,
              transformStyle: "preserve-3d",
            }}
          />
        ))}
        {/* Outer orbit ring */}
        <motion.div
          style={{
            position: "absolute",
            width: "240px",
            height: "240px",
            borderRadius: "50%",
            border: "2px dashed var(--card-accent)",
            backgroundColor: "transparent",
            opacity: 0.3,
          }}
        />
      </motion.div>
    </motion.div>
  );
};

// ─── Generic 3D Card ─────────────────────────────────────────────────────────
type ShapeType = "cube" | "rings" | "globe";

interface Card3DProps {
  heading: string;
  description: string;
  shape: ShapeType;
  accentColor: string; // CSS color value
  onClick: () => void;
}

const Card3D: React.FC<Card3DProps> = ({ heading, description, shape, accentColor, onClick }) => {
  const [isHover, setIsHover] = useState(false);

  const ShapeComponent = shape === "cube" ? CubeShape : shape === "rings" ? RingShape : ExploreShape;

  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
      style={{ "--card-accent": accentColor } as React.CSSProperties}
      className="w-full text-left"
      whileTap={{ scale: 0.985 }}
      transition={{ duration: 0.1 }}
    >
      <motion.div
        animate={{ borderColor: isHover ? accentColor + "66" : "transparent" }}
        transition={{ duration: 0.2 }}
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: "16px",
          padding: "12px 16px 12px 12px",
          borderRadius: "14px",
          position: "relative",
          overflow: "hidden",
          border: "1px solid",
          backgroundColor: isHover ? "color-mix(in srgb, var(--background) 60%, transparent)" : "transparent",
        }}
      >
        {/* Subtle bg glow on hover */}
        <motion.div
          animate={{ opacity: isHover ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            background: `radial-gradient(ellipse at 20% 50%, ${accentColor}18 0%, transparent 60%)`,
            pointerEvents: "none",
          }}
        />

        {/* 3D Icon */}
        <div
          style={{
            width: "72px",
            height: "72px",
            flexShrink: 0,
            position: "relative",
            zIndex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "10px",
            border: "1px solid color-mix(in srgb, var(--card-accent) 25%, transparent)",
            overflow: "visible",
          }}
        >
          <ShapeComponent isHover={isHover} />
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0, position: "relative", zIndex: 1 }}>
          {/* Heading with fill sweep */}
          <div
            style={{
              height: "26px",
              position: "relative",
              overflow: "hidden",
              fontWeight: 600,
              fontSize: "15px",
              letterSpacing: "-0.01em",
              display: "flex",
              alignItems: "center",
              color: "var(--foreground)",
              userSelect: "none",
            }}
          >
            <span style={{ position: "relative", zIndex: 1 }}>{heading}</span>
            <motion.span
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                height: "100%",
                color: "var(--background)",
                display: "flex",
                alignItems: "center",
                clipPath: "inset(0 100% 0 0)",
                zIndex: 2,
              }}
              animate={{ clipPath: isHover ? "inset(0 0% 0 0)" : "inset(0 100% 0 0)" }}
              transition={titleTransition}
            >
              {heading}
            </motion.span>
            <motion.div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                backgroundColor: "var(--card-accent)",
                transformOrigin: "left center",
                scaleX: 0,
                zIndex: 1,
              }}
              animate={{ scaleX: isHover ? 1 : 0 }}
              transition={titleTransition}
            />
          </div>

          <p
            style={{
              fontSize: "13px",
              lineHeight: "1.4",
              color: "color-mix(in srgb, var(--foreground) 55%, transparent)",
              marginTop: "3px",
              userSelect: "none",
            }}
          >
            {description}
          </p>
        </div>

        {/* Arrow */}
        <motion.div
          animate={{ opacity: isHover ? 1 : 0, x: isHover ? 0 : -6 }}
          transition={{ duration: 0.2 }}
          style={{ flexShrink: 0, position: "relative", zIndex: 1, color: accentColor, fontSize: "18px" }}
        >
          →
        </motion.div>
      </motion.div>
    </motion.button>
  );
};

// ─── Main Modal ───────────────────────────────────────────────────────────────
export const CreateServerModal = () => {
  const navigate = useNavigate();
  const { activeModal, closeModal, openModal } = useUIStore();
  const { createServer, updateServer, setCurrentServer, fetchChannels } = useServerStore();
  const { user } = useAuthStore();

  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<ModalView>("choose");
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createForm = useForm<CreateServerForm>({
    resolver: zodResolver(createServerSchema),
    defaultValues: { name: "" },
  });

  const isOpen = activeModal === "create-server";

  const handleIconSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_ICON_TYPES.includes(file.type)) {
      toast.error("Please select a JPEG, PNG, or WebP image");
      return;
    }
    if (file.size > MAX_ICON_SIZE) {
      toast.error("Image must be less than 1MB");
      return;
    }
    setIconFile(file);
    setIconPreview(URL.createObjectURL(file));
  };

  const clearIcon = () => {
    setIconFile(null);
    if (iconPreview) {
      URL.revokeObjectURL(iconPreview);
      setIconPreview(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadIcon = async (serverId: string, file: File): Promise<string | null> => {
    const { compressImage } = await import("@/lib/imageCompression");
    const compressed = await compressImage(file, "server-icon");
    const ext = compressed.name.split(".").pop() || "webp";
    const filePath = `${serverId}/icon-${Date.now()}.${ext}`;
    try {
      const result = await secureUpload("server-icons", filePath, file, { upsert: true });
      return result.publicUrl;
    } catch (err) {
      console.error("Failed to upload icon:", err);
      return null;
    }
  };

  const onCreateSubmit = async (data: CreateServerForm) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const server = await createServer(data.name, user.id);
      if (server) {
        if (iconFile) {
          const iconUrl = await uploadIcon(server.id, iconFile);
          if (iconUrl) await updateServer(server.id, user.id, { icon_url: iconUrl });
        }
        await updateServer(server.id, user.id, { banner_url: "/default_server_banner.png" });
        const serverWithBanner = { ...server, banner_url: "/default_server_banner.png" };
        toast.success(`Server "${server.name}" created!`);
        setCurrentServer(serverWithBanner);
        await fetchChannels(server.id);
        navigate(`/app/servers/${server.id}`);
        handleClose();
      }
    } catch {
      toast.error("Failed to create server");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    createForm.reset();
    setView("choose");
    clearIcon();
    closeModal();
  };

  const handleJoinClick = () => {
    closeModal();
    openModal("join-server");
  };

  const handleExploreClick = () => {
    handleClose();
    setCurrentServer(null);
    navigate("/app/explore");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-hidden bg-background/95 backdrop-blur-xl border-border/50 rounded-2xl p-0">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleIconSelect}
          className="hidden"
        />

        {/* ── Choose View ── */}
        {view === "choose" && (
          <div className="p-5 sm:p-6">
            <DialogHeader className="pb-5">
              <div className="text-center">
                <DialogTitle className="text-xl font-semibold tracking-tight">Add a Server</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-1">
                  Create your own server or join an existing one
                </DialogDescription>
              </div>
            </DialogHeader>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <Card3D
                heading="Create My Own"
                description="Start fresh with your own private community"
                shape="cube"
                accentColor="hsl(var(--kloak-success))"
                onClick={() => setView("create")}
              />
              <Card3D
                heading="Join a Server"
                description="Enter an invite code to join an existing server"
                shape="rings"
                accentColor="hsl(var(--primary))"
                onClick={handleJoinClick}
              />
              <Card3D
                heading="Explore Servers"
                description="Discover and browse public communities"
                shape="globe"
                accentColor="hsl(var(--kloak-warning))"
                onClick={handleExploreClick}
              />
            </div>
          </div>
        )}

        {/* ── Create View ── */}
        {view === "create" && (
          <div className="p-4 sm:p-6">
            <DialogHeader className="pb-4">
              <div className="text-center">
                <DialogTitle className="text-xl font-medium">Create Your Server</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-1">
                  Make yours and start talking
                </DialogDescription>
              </div>
            </DialogHeader>

            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-5">
              {/* Icon Upload */}
              <div className="flex flex-col items-center gap-2 p-4 bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30">
                <div className="relative">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-secondary flex items-center justify-center border-2 border-dashed border-muted-foreground/30 cursor-pointer hover:border-primary/50 transition-all duration-200 overflow-hidden"
                  >
                    {iconPreview ? (
                      <img src={iconPreview} alt="Server icon preview" className="w-full h-full object-cover" />
                    ) : (
                      <Upload className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  {iconPreview && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearIcon();
                      }}
                      className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 transition-colors shadow-lg"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Click to upload an icon (optional)</p>
              </div>

              {/* Server Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-medium uppercase text-muted-foreground tracking-wide">
                  Server Name
                </Label>
                <Input
                  id="name"
                  placeholder="My Awesome Server"
                  {...createForm.register("name")}
                  className={`rounded-xl ${createForm.formState.errors.name ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  autoFocus
                />
                {createForm.formState.errors.name && (
                  <p className="text-xs text-destructive">{createForm.formState.errors.name.message}</p>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                By creating a server, you agree to our Community Guidelines.
              </p>

              {/* Actions */}
              <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 sm:gap-3 pt-2 border-t border-border/30">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setView("choose");
                    clearIcon();
                  }}
                  className="flex-1 sm:flex-none rounded-xl"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 sm:flex-none rounded-xl bg-primary hover:bg-primary/90"
                >
                  {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Server
                </Button>
              </div>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
