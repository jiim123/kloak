import { useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  Compass,
  Palette,
  Plus,
  RotateCcw,
  Settings,
  Trash2,
  Upload,
  UserRoundPlus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore, useUIStore, type HomeBackground, type HomeQuickAction } from "@/stores";

const KLOAK_LOGO_SRC =
  "data:image/svg+xml,%3c?xml%20version=%271.0%27%20encoding=%27UTF-8%27?%3e%3csvg%20id=%27b%27%20data-name=%27Layer%202%27%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%20549.53%20118.98%27%3e%3cdefs%3e%3cstyle%3e%20.d%20{%20fill:%20%23f9f9f9;%20}%20%3c/style%3e%3c/defs%3e%3cg%20id=%27c%27%20data-name=%27Layer%201%27%3e%3cg%3e%3cg%3e%3cpath%20class=%27d%27%20d=%27M180.91,7.69h13.58v49h.42L231.73,7.69h15.4l-32.2,43.26v.56l33.6,54.18h-15.12l-27.44-45.36h-.56l-10.92,13.86v31.5h-13.58V7.69Z%27/%3e%3cpath%20class=%27d%27%20d=%27M254.83,95.33h27.44V15.25h-27.44V4.89h40.6v90.44h25.06v10.36h-65.66v-10.36Z%27/%3e%3cpath%20class=%27d%27%20d=%27M326.79,70.27c0-21.7,14.42-36.4,35.28-36.4s35.56,14.7,35.56,36.4-14.28,36.12-35.56,36.12-35.28-14.56-35.28-36.12ZM362.07,95.75c13.72,0,22.4-9.66,22.4-25.48s-8.54-25.76-22.4-25.76-21.98,9.8-21.98,25.76,8.4,25.48,21.98,25.48Z%27/%3e%3cpath%20class=%27d%27%20d=%27M405.75,86.09c0-9.38,5.04-15.68,14.56-18.48,5.46-1.54,13.3-2.38,27.86-4.48,5.46-.84,7.14-2.1,7.14-5.74,0-8.4-5.74-12.88-16.1-12.88s-16.38,4.48-17.78,12.46h-12.74c1.54-14.7,12.88-23.1,30.8-23.1s28.84,9.66,28.84,26.74v45.08h-12.46v-12.04h-.42c-4.9,8.12-14.14,12.74-25.06,12.74-15.68,0-24.64-7.42-24.64-20.3ZM432.77,95.89c13.02,0,22.54-8.68,22.54-20.72v-4.2c-5.88,2.38-21.98,2.66-28,4.34-5.74,1.68-8.4,4.9-8.4,10.36,0,6.72,4.76,10.22,13.86,10.22Z%27/%3e%3cpath%20class=%27d%27%20d=%27M483.59,4.89h13.02v62.86h.42l36.54-33.18h14.56l-30.66,28.98v.56l32.06,41.58h-14.56l-26.18-33.46h-.56l-11.62,11.06v22.4h-13.02V4.89Z%27/%3e%3c/g%3e%3cpath%20class=%27d%27%20d=%27M119.72,31.87V0c-31.55,0-60.26,12.35-81.58,32.46C34.1,22.42,31.87,11.47,31.87,0H0c0,21.92,5.97,42.47,16.35,60.13C6.43,77.49.75,97.58.75,118.98h31.87c0-11.08,2.08-21.68,5.87-31.44,21.2,19.51,49.48,31.44,80.49,31.44v-31.87c-24.86,0-47.31-10.47-63.2-27.22,15.92-17.22,38.69-28.02,63.94-28.02Z%27/%3e%3c/g%3e%3c/g%3e%3c/svg%3e";

const BACKGROUNDS: Array<{ id: HomeBackground; label: string; style: CSSProperties }> = [
  { id: "default", label: "Default", style: { background: "hsl(var(--layout-chat))" } },
  {
    id: "midnight",
    label: "Midnight",
    style: {
      background:
        "radial-gradient(circle at top left, rgba(56,189,248,0.18), transparent 32%), linear-gradient(135deg, #080b14, #17111f 55%, #050509)",
    },
  },
  {
    id: "forest",
    label: "Forest",
    style: {
      background:
        "radial-gradient(circle at 15% 10%, rgba(74,222,128,0.16), transparent 34%), linear-gradient(135deg, #07110d, #12231a 58%, #050806)",
    },
  },
  {
    id: "ocean",
    label: "Ocean",
    style: {
      background:
        "radial-gradient(circle at 80% 10%, rgba(45,212,191,0.18), transparent 32%), linear-gradient(145deg, #061217, #0e2530 56%, #05090d)",
    },
  },
  {
    id: "rose",
    label: "Rose",
    style: {
      background:
        "radial-gradient(circle at 20% 10%, rgba(244,114,182,0.18), transparent 30%), linear-gradient(135deg, #15070d, #24111b 56%, #090507)",
    },
  },
  {
    id: "cyber",
    label: "Cyber",
    style: {
      background:
        "radial-gradient(circle at 12% 12%, rgba(34,197,94,0.16), transparent 28%), linear-gradient(135deg, #050805, #111315 58%, #050505)",
    },
  },
];

const ACTION_META: Record<HomeQuickAction, { icon: LucideIcon; title: string; description: string }> = {
  friends: { icon: UserRoundPlus, title: "Friends", description: "Requests and DMs" },
  explore: { icon: Compass, title: "Explore", description: "Public servers" },
  join: { icon: Users, title: "Join", description: "Use an invite" },
  create: { icon: Plus, title: "Create", description: "Start a server" },
  settings: { icon: Settings, title: "Settings", description: "App settings" },
};

const CustomizePanel = ({ children }: { children: ReactNode }) => (
  <div className="mt-6 w-full rounded-lg border border-border/50 bg-card/55 p-4 text-left shadow-sm backdrop-blur">
    {children}
  </div>
);

const resizeBackgroundImage = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Choose an image file."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read that image."));
    reader.onload = () => {
      const image = new window.Image();
      image.onerror = () => reject(new Error("Unable to load that image."));
      image.onload = () => {
        const maxSide = 1920;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Unable to prepare that image."));
          return;
        }
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });

export const HomeLanding = () => {
  const navigate = useNavigate();
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const { user } = useAuthStore();
  const { openModal, openSettings, homePreferences, setHomePreferences, resetHomePreferences } = useUIStore();

  const name = user?.display_name || user?.username || "there";
  const background = BACKGROUNDS.find((item) => item.id === homePreferences.background) || BACKGROUNDS[0];

  const runAction = (action: HomeQuickAction) => {
    if (action === "friends") navigate("/app/friends");
    if (action === "explore") navigate("/app/explore");
    if (action === "join") openModal("join-server");
    if (action === "create") openModal("create-server");
    if (action === "settings") openSettings();
  };

  const toggleAction = (action: HomeQuickAction) => {
    const enabled = homePreferences.quickActions.includes(action);
    const next = enabled
      ? homePreferences.quickActions.filter((item) => item !== action)
      : [...homePreferences.quickActions, action];
    setHomePreferences({ quickActions: next.length ? next : ["friends"] });
  };

  const handleBackgroundUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploadError("");
    try {
      const dataUrl = await resizeBackgroundImage(file);
      setHomePreferences({
        backgroundImageDataUrl: dataUrl,
        backgroundImageOpacity: homePreferences.backgroundImageOpacity || 0.28,
        backgroundImageFit: homePreferences.backgroundImageFit || "contain",
      });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Unable to use that image.");
    }
  };

  return (
    <div
      className="relative flex h-full min-h-0 w-full flex-1 items-center justify-center overflow-y-auto px-4 py-8"
      style={background.style}
    >
      {homePreferences.backgroundImageDataUrl ? (
        <div
          className="pointer-events-none absolute inset-0 bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${homePreferences.backgroundImageDataUrl})`,
            backgroundSize: homePreferences.backgroundImageFit,
            opacity: homePreferences.backgroundImageOpacity,
          }}
        />
      ) : null}
      <div className={cn("pointer-events-none absolute inset-0", homePreferences.backgroundImageDataUrl ? "bg-background/45" : "bg-transparent")} />

      <div className="relative z-10 flex w-full max-w-xl flex-col items-center text-center">
        <div className="mb-6 flex w-full justify-center">
          <img
            src={KLOAK_LOGO_SRC}
            alt="Kloak"
            className="h-auto w-28 max-w-[56%] opacity-95 sm:w-32"
            draggable={false}
          />
        </div>

        <p className="mb-2 text-sm font-medium text-muted-foreground">Welcome back</p>
        <h1 className="max-w-full truncate text-2xl font-semibold text-foreground sm:text-3xl">{name}</h1>
        <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
          Choose a direct message, visit friends, or find a community to join.
        </p>

        <div className="mt-8 flex w-full flex-wrap justify-center gap-3">
          {homePreferences.quickActions.map((action) => {
            const meta = ACTION_META[action];
            const Icon = meta.icon;
            return (
              <button
                key={action}
                onClick={() => runAction(action)}
                className="group flex min-h-28 w-[calc(50%-0.375rem)] max-w-44 flex-col items-center justify-center gap-2 rounded-lg border border-border/50 bg-card/35 px-3 py-4 text-center transition-colors hover:border-primary/45 hover:bg-card/60 sm:w-40"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-xs font-medium text-foreground sm:text-sm">{meta.title}</h2>
                  <p className="text-[11px] leading-4 text-muted-foreground sm:text-xs">{meta.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        <Button
          className="mt-5"
          variant={isCustomizing ? "primary" : "outline"}
          size="sm"
          iconLeft={isCustomizing ? <Check /> : <Palette />}
          onClick={() => setIsCustomizing((value) => !value)}
        >
          {isCustomizing ? "Done" : "Customize"}
        </Button>

        {isCustomizing ? (
          <CustomizePanel>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-foreground">Home Options</h2>
              <Button variant="ghost" size="sm" iconLeft={<RotateCcw />} onClick={resetHomePreferences}>
                Reset
              </Button>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">Background color</span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {BACKGROUNDS.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setHomePreferences({ background: item.id })}
                      style={item.style}
                      className={cn(
                        "h-10 rounded-lg border px-2 text-xs text-foreground transition-colors",
                        homePreferences.background === item.id ? "border-primary" : "border-border/70",
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-muted-foreground">Background photo</span>
                  {homePreferences.backgroundImageDataUrl ? (
                    <span className="text-xs text-muted-foreground">Enabled</span>
                  ) : null}
                </div>

                {homePreferences.backgroundImageDataUrl ? (
                  <div
                    className="h-28 rounded-lg border border-border bg-center bg-no-repeat"
                    style={{
                      backgroundImage: `url(${homePreferences.backgroundImageDataUrl})`,
                      backgroundSize: homePreferences.backgroundImageFit,
                    }}
                  />
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-background/40 px-3 text-xs text-foreground transition-colors hover:border-primary/50 hover:bg-background/60">
                    <Upload className="h-3.5 w-3.5" />
                    Upload photo
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(event) => {
                        void handleBackgroundUpload(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                  </label>

                  {homePreferences.backgroundImageDataUrl ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      iconLeft={<Trash2 />}
                      onClick={() => setHomePreferences({ backgroundImageDataUrl: "" })}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>

                {uploadError ? <p className="text-xs text-destructive">{uploadError}</p> : null}

                <label className="space-y-2">
                  <span className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
                    Photo visibility
                    <span>{Math.round(homePreferences.backgroundImageOpacity * 100)}%</span>
                  </span>
                  <input
                    type="range"
                    min={12}
                    max={65}
                    value={Math.round(homePreferences.backgroundImageOpacity * 100)}
                    disabled={!homePreferences.backgroundImageDataUrl}
                    onChange={(event) => setHomePreferences({ backgroundImageOpacity: Number(event.target.value) / 100 })}
                    className="w-full accent-primary disabled:opacity-40"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  {(["contain", "cover"] as const).map((fit) => (
                    <button
                      key={fit}
                      onClick={() => setHomePreferences({ backgroundImageFit: fit })}
                      disabled={!homePreferences.backgroundImageDataUrl}
                      className={cn(
                        "h-9 rounded-lg border px-3 text-xs transition-colors disabled:opacity-40",
                        homePreferences.backgroundImageFit === fit
                          ? "border-primary/60 bg-primary/10 text-foreground"
                          : "border-border bg-background/40 text-muted-foreground",
                      )}
                    >
                      {fit === "contain" ? "Fit whole photo" : "Fill screen"}
                    </button>
                  ))}
                </div>

                <p className="text-xs text-muted-foreground">Photos are resized and saved locally on this device.</p>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">Quick actions</span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {(Object.keys(ACTION_META) as HomeQuickAction[]).map((action) => {
                    const Icon = ACTION_META[action].icon;
                    const enabled = homePreferences.quickActions.includes(action);
                    return (
                      <button
                        key={action}
                        onClick={() => toggleAction(action)}
                        className={cn(
                          "flex h-9 items-center justify-center gap-2 rounded-lg border px-2 text-xs transition-colors",
                          enabled
                            ? "border-primary/60 bg-primary/10 text-foreground"
                            : "border-border bg-background/40 text-muted-foreground",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {ACTION_META[action].title}
                        {enabled ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </CustomizePanel>
        ) : null}
      </div>
    </div>
  );
};
