"use client";

import React, { useState, useRef, useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, MotionConfigContext, LayoutGroup } from "framer-motion";
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

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_ICON_SIZE = 1 * 1024 * 1024;
const ALLOWED_ICON_TYPES = ["image/jpeg", "image/png", "image/webp"];
const createServerSchema = z.object({
  name: z.string().trim().min(1, "Server name is required").max(50, "Server name must be less than 50 characters"),
});
type CreateServerForm = z.infer<typeof createServerSchema>;
type ModalView = "choose" | "create";

// ─── Animation config ─────────────────────────────────────────────────────────
const transition1 = { bounce: 0, delay: 0, duration: 0.4, type: "spring" as const };
const transition2 = {
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
  const ctx = useMemo(() => ({ ...config, transition }), [JSON.stringify(transition)]);
  return <MotionConfigContext.Provider value={ctx}>{children}</MotionConfigContext.Provider>;
};

// ─── Shared face style helper ─────────────────────────────────────────────────
const faceStyle = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  display: "flex",
  flex: "none",
  flexDirection: "column",
  alignContent: "center",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  padding: "0px",
  border: "4px solid var(--foreground)",
  backgroundColor: "var(--background)",
  ...extra,
});

// ─── Corner brackets ──────────────────────────────────────────────────────────
const Corners: React.FC<{ isHover: boolean }> = ({ isHover }) => {
  const variants = { hovered: { scale: 2.2 } };
  const corners = [
    { borderLeft: "4px solid var(--foreground)", borderTop: "4px solid var(--foreground)", left: "14px", top: "14px" },
    {
      borderLeft: "4px solid var(--foreground)",
      borderBottom: "4px solid var(--foreground)",
      left: "14px",
      top: "310px",
    },
    {
      borderRight: "4px solid var(--foreground)",
      borderBottom: "4px solid var(--foreground)",
      right: "14px",
      bottom: "14px",
    },
    {
      borderRight: "4px solid var(--foreground)",
      borderTop: "4px solid var(--foreground)",
      right: "14px",
      top: "14px",
    },
  ];
  return (
    <>
      {corners.map((c, i) => (
        <motion.div
          key={i}
          style={{
            flex: "none",
            height: "24px",
            width: "24px",
            overflow: "hidden",
            position: "absolute",
            zIndex: 2,
            ...c,
          }}
          variants={variants}
          animate={isHover ? "hovered" : "default"}
          transition={transition1}
        />
      ))}
    </>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// SHAPE 1 — Server icon: 3 stacked rack slices (same DNA as original cube)
// ══════════════════════════════════════════════════════════════════════════════
const RackSlice: React.FC<{ isHover: boolean }> = ({ isHover }) => {
  const cubeVariants = { hovered: { "--border-color": "rgb(139,47,250)" } };
  return (
    <Transition value={transition2}>
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
        <motion.div
          style={faceStyle({ height: "34px", position: "relative", width: "240px", zIndex: 120 })}
          variants={cubeVariants}
          animate={isHover ? "hovered" : "default"}
        />
        <motion.div
          style={faceStyle({
            bottom: "0px",
            position: "absolute",
            right: "0px",
            top: "0px",
            width: "240px",
            zIndex: 1,
            rotateY: 180,
          } as any)}
          variants={cubeVariants}
          animate={isHover ? "hovered" : "default"}
        />
        <motion.div
          style={faceStyle({
            bottom: "0px",
            left: "120px",
            position: "absolute",
            top: "0px",
            width: "240px",
            zIndex: 1,
            rotateY: 90,
          } as any)}
          variants={cubeVariants}
          animate={isHover ? "hovered" : "default"}
        />
        <motion.div
          style={faceStyle({
            bottom: "0px",
            position: "absolute",
            right: "120px",
            top: "0px",
            width: "240px",
            zIndex: 1,
            rotateY: -90,
          } as any)}
          variants={cubeVariants}
          animate={isHover ? "hovered" : "default"}
        />
        <motion.div
          style={faceStyle({
            flex: "none",
            height: "240px",
            left: "0px",
            position: "absolute",
            right: "0px",
            top: "-120px",
            zIndex: 1,
            rotateX: 90,
          } as any)}
          variants={cubeVariants}
          animate={isHover ? "hovered" : "default"}
        />
        <motion.div
          style={faceStyle({
            flex: "none",
            height: "240px",
            left: "0px",
            position: "absolute",
            right: "0px",
            top: "-86px",
            zIndex: 1,
            rotateX: 90,
          } as any)}
          variants={cubeVariants}
          animate={isHover ? "hovered" : "default"}
        />
      </motion.div>
    </Transition>
  );
};

const ServerIcon3D: React.FC<{ isHover: boolean }> = ({ isHover }) => {
  const sliceCubeVariants = { hovered: { rotateX: -28, rotateY: -43, scale: 1.1 } };
  return (
    <motion.div
      style={{
        flex: "none",
        height: "348px",
        overflow: "visible",
        position: "relative",
        width: "348px",
        zIndex: 2,
        scale: 0.3,
      }}
    >
      <motion.div
        style={{
          alignContent: "center",
          alignItems: "center",
          display: "flex",
          flex: "none",
          flexDirection: "column",
          gap: "28px",
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
        variants={sliceCubeVariants}
        animate={isHover ? "hovered" : "default"}
        transition={transition1}
      >
        <RackSlice isHover={isHover} />
        <RackSlice isHover={isHover} />
        <RackSlice isHover={isHover} />
      </motion.div>
      <Corners isHover={isHover} />
    </motion.div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// SHAPE 2 — People icon: 3 concentric cylinder rings (like a target / union)
// ══════════════════════════════════════════════════════════════════════════════
const CylinderRing: React.FC<{ isHover: boolean; diameter: number; height: number; segments?: number }> = ({
  isHover,
  diameter,
  height,
  segments = 12,
}) => {
  const cubeVariants = { hovered: { "--border-color": "rgb(139,47,250)" } };
  const r = diameter / 2;
  return (
    <motion.div
      style={{ position: "relative", transformStyle: "preserve-3d", width: `${diameter}px`, height: `${height}px` }}
    >
      {/* Top cap ring */}
      <motion.div
        style={{
          position: "absolute",
          width: `${diameter}px`,
          height: `${diameter}px`,
          borderRadius: "50%",
          border: "4px solid var(--foreground)",
          backgroundColor: "var(--background)",
          top: `-${diameter / 2}px`,
          left: "0px",
          rotateX: 90,
          transformStyle: "preserve-3d",
        }}
        variants={cubeVariants}
        animate={isHover ? "hovered" : "default"}
      />
      {/* Bottom cap ring */}
      <motion.div
        style={{
          position: "absolute",
          width: `${diameter}px`,
          height: `${diameter}px`,
          borderRadius: "50%",
          border: "4px solid var(--foreground)",
          backgroundColor: "var(--background)",
          top: `${height - diameter / 2}px`,
          left: "0px",
          rotateX: 90,
          transformStyle: "preserve-3d",
        }}
        variants={cubeVariants}
        animate={isHover ? "hovered" : "default"}
      />
      {/* Side panels */}
      {Array.from({ length: segments }, (_, i) => {
        const angle = (360 / segments) * i;
        const panelW = Math.round(2 * r * Math.sin(Math.PI / segments)) + 2;
        return (
          <motion.div
            key={i}
            style={faceStyle({
              position: "absolute",
              width: `${panelW}px`,
              height: `${height}px`,
              left: `${r - panelW / 2}px`,
              top: "0px",
              rotateY: angle,
              translateZ: r,
            } as any)}
            variants={cubeVariants}
            animate={isHover ? "hovered" : "default"}
          />
        );
      })}
    </motion.div>
  );
};

const PeopleIcon3D: React.FC<{ isHover: boolean }> = ({ isHover }) => {
  const groupVariants = { hovered: { rotateX: -25, rotateY: -45, scale: 1.1 } };
  return (
    <motion.div
      style={{
        flex: "none",
        height: "348px",
        overflow: "visible",
        position: "relative",
        width: "348px",
        zIndex: 2,
        scale: 0.3,
      }}
    >
      <motion.div
        style={{
          left: "50%",
          top: "50%",
          position: "absolute",
          transformStyle: "preserve-3d",
          transformPerspective: 1200,
          rotateX: 20,
          rotateY: -15,
        }}
        transformTemplate={transformCentered}
        variants={groupVariants}
        animate={isHover ? "hovered" : "default"}
        transition={transition1}
      >
        {/* Head cylinder — small, top */}
        <motion.div style={{ position: "absolute", transformStyle: "preserve-3d", translateX: -55, translateY: -155 }}>
          <CylinderRing isHover={isHover} diameter={110} height={90} segments={10} />
        </motion.div>
        {/* Body cylinder — wide, bottom */}
        <motion.div style={{ position: "absolute", transformStyle: "preserve-3d", translateX: -80, translateY: 0 }}>
          <CylinderRing isHover={isHover} diameter={160} height={130} segments={12} />
        </motion.div>
      </motion.div>
      <Corners isHover={isHover} />
    </motion.div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// SHAPE 3 — Compass/Explore icon: 3 orthogonal rings (like a gyroscope/globe)
// ══════════════════════════════════════════════════════════════════════════════
const OrbitalRing: React.FC<{ isHover: boolean; diameter: number; rotX?: number; rotY?: number; rotZ?: number }> = ({
  isHover,
  diameter,
  rotX = 0,
  rotY = 0,
  rotZ = 0,
}) => {
  const cubeVariants = { hovered: { "--border-color": "rgb(139,47,250)" } };
  const segments = 16;
  const r = diameter / 2;
  return (
    <motion.div
      style={{
        position: "absolute",
        transformStyle: "preserve-3d",
        translateX: -r,
        translateY: -r,
        rotateX: rotX,
        rotateY: rotY,
        rotateZ: rotZ,
      }}
    >
      {Array.from({ length: segments }, (_, i) => {
        const angle = (360 / segments) * i;
        const panelW = Math.round(2 * r * Math.sin(Math.PI / segments)) + 2;
        const panelH = 18;
        return (
          <motion.div
            key={i}
            style={faceStyle({
              position: "absolute",
              width: `${panelW}px`,
              height: `${panelH}px`,
              left: `${r - panelW / 2}px`,
              top: `${r - panelH / 2}px`,
              rotateY: angle,
              translateZ: r,
            } as any)}
            variants={cubeVariants}
            animate={isHover ? "hovered" : "default"}
          />
        );
      })}
    </motion.div>
  );
};

const CompassIcon3D: React.FC<{ isHover: boolean }> = ({ isHover }) => {
  const groupVariants = { hovered: { rotateX: -20, rotateY: 55, scale: 1.1 } };
  return (
    <motion.div
      style={{
        flex: "none",
        height: "348px",
        overflow: "visible",
        position: "relative",
        width: "348px",
        zIndex: 2,
        scale: 0.3,
      }}
    >
      <motion.div
        style={{
          left: "50%",
          top: "50%",
          position: "absolute",
          transformStyle: "preserve-3d",
          transformPerspective: 1200,
          rotateX: 15,
          rotateY: -20,
        }}
        transformTemplate={transformCentered}
        variants={groupVariants}
        animate={isHover ? "hovered" : "default"}
        transition={transition1}
      >
        {/* Three orthogonal rings — gyroscope / globe */}
        <OrbitalRing isHover={isHover} diameter={220} rotX={0} rotY={0} rotZ={0} />
        <OrbitalRing isHover={isHover} diameter={220} rotX={90} rotY={0} rotZ={0} />
        <OrbitalRing isHover={isHover} diameter={220} rotX={0} rotY={90} rotZ={0} />
      </motion.div>
      <Corners isHover={isHover} />
    </motion.div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// IconHover3D — base card (exact same as the original)
// ══════════════════════════════════════════════════════════════════════════════
type IconVariant = "server" | "people" | "compass";

const IconHover3D: React.FC<{
  heading: string;
  text: string;
  iconVariant: IconVariant;
  onClick: () => void;
}> = ({ heading, text, iconVariant, onClick }) => {
  const [isHover, setIsHover] = useState(false);
  const id = React.useId();

  const IconShape = iconVariant === "server" ? ServerIcon3D : iconVariant === "people" ? PeopleIcon3D : CompassIcon3D;

  return (
    <LayoutGroup id={id}>
      <Transition value={transition1}>
        <motion.button
          onClick={onClick}
          onMouseEnter={() => setIsHover(true)}
          onMouseLeave={() => setIsHover(false)}
          style={{
            backgroundColor: "var(--background)",
            alignContent: "center",
            alignItems: "center",
            display: "flex",
            flexDirection: "row",
            flexWrap: "nowrap",
            gap: "32px",
            height: "min-content",
            justifyContent: "flex-start",
            overflow: "visible",
            padding: "16px 20px",
            position: "relative",
            width: "100%",
            borderRadius: "12px",
            textAlign: "left",
            cursor: "pointer",
            border: "1px solid color-mix(in srgb, var(--foreground) 10%, transparent)",
          }}
        >
          {/* Icon box — exact same structure as original */}
          <motion.div
            style={{
              alignContent: "center",
              alignItems: "center",
              display: "flex",
              flex: "none",
              flexDirection: "row",
              flexWrap: "nowrap",
              height: "80px",
              justifyContent: "center",
              overflow: "visible",
              padding: "0px",
              position: "relative",
              width: "80px",
              zIndex: 1,
              border: "1px solid color-mix(in srgb, var(--foreground) 20%, transparent)",
              borderRadius: "8px",
              flexShrink: 0,
            }}
          >
            <motion.div
              style={{
                flex: "none",
                height: "348px",
                overflow: "visible",
                position: "relative",
                width: "348px",
                zIndex: 2,
                scale: 0.24,
              }}
            >
              <IconShape isHover={isHover} />
            </motion.div>
          </motion.div>

          {/* Content — exact same heading fill animation */}
          <motion.div
            style={{
              alignContent: "flex-start",
              alignItems: "flex-start",
              display: "flex",
              flex: 1,
              flexDirection: "column",
              gap: "8px",
              height: "min-content",
              justifyContent: "center",
              overflow: "hidden",
              padding: "0px",
              position: "relative",
            }}
          >
            <div
              style={{
                height: "28px",
                position: "relative",
                overflow: "hidden",
                fontFamily: '"Inter", sans-serif',
                fontWeight: 600,
                fontSize: "16px",
                color: "var(--foreground)",
                userSelect: "none",
                display: "flex",
                alignItems: "center",
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
                  backgroundColor: "var(--foreground)",
                  transformOrigin: "left center",
                  scaleX: 0,
                  zIndex: 1,
                }}
                animate={{ scaleX: isHover ? 1 : 0 }}
                transition={titleTransition}
              />
            </div>
            <div
              style={{
                fontFamily: '"Inter", sans-serif',
                fontWeight: 400,
                fontSize: "14px",
                lineHeight: "1.5em",
                userSelect: "none",
                color: "color-mix(in srgb, var(--foreground) 55%, transparent)",
              }}
            >
              {text}
            </div>
          </motion.div>
        </motion.button>
      </Transition>
    </LayoutGroup>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// CreateServerModal
// ══════════════════════════════════════════════════════════════════════════════
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
        toast.success(`Server "${server.name}" created!`);
        setCurrentServer({ ...server, banner_url: "/default_server_banner.png" });
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="sm:max-w-md max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-hidden bg-background/95 backdrop-blur-xl border-border/50 rounded-2xl p-0"
        style={
          { "--background": "hsl(var(--background))", "--foreground": "hsl(var(--foreground))" } as React.CSSProperties
        }
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleIconSelect}
          className="hidden"
        />

        {/* ── Choose View ─────────────────────────────────────────────────── */}
        {view === "choose" && (
          <div className="p-5 sm:p-6">
            <DialogHeader className="pb-5">
              <div className="text-center">
                <DialogTitle className="text-xl font-semibold tracking-tight">Add a Server</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-1">
                  Welcome to Kloak. Create your own community, join one with an invite, or explore what's out there.
                </DialogDescription>
              </div>
            </DialogHeader>

            <div className="flex flex-col gap-2">
              <IconHover3D
                heading="Create Server"
                text="Start your own private community"
                iconVariant="server"
                onClick={() => setView("create")}
              />
              <IconHover3D
                heading="Join Server"
                text="Enter an invite code to join"
                iconVariant="people"
                onClick={() => {
                  closeModal();
                  openModal("join-server");
                }}
              />
              <IconHover3D
                heading="Discover"
                text="Explore public communities"
                iconVariant="compass"
                onClick={() => {
                  handleClose();
                  setCurrentServer(null);
                  navigate("/app/explore");
                }}
              />
            </div>
          </div>
        )}

        {/* ── Create View ─────────────────────────────────────────────────── */}
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
