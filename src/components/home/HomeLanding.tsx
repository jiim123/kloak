import { useNavigate } from "react-router-dom";
import { Compass, Plus, UserRoundPlus, Users, type LucideIcon } from "lucide-react";
import { useUIStore, useAuthStore } from "@/stores";

const KLOAK_LOGO_SRC =
  "data:image/svg+xml,%3c?xml%20version=%271.0%27%20encoding=%27UTF-8%27?%3e%3csvg%20id=%27b%27%20data-name=%27Layer%202%27%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%20549.53%20118.98%27%3e%3cdefs%3e%3cstyle%3e%20.d%20{%20fill:%20%23f9f9f9;%20}%20%3c/style%3e%3c/defs%3e%3cg%20id=%27c%27%20data-name=%27Layer%201%27%3e%3cg%3e%3cg%3e%3cpath%20class=%27d%27%20d=%27M180.91,7.69h13.58v49h.42L231.73,7.69h15.4l-32.2,43.26v.56l33.6,54.18h-15.12l-27.44-45.36h-.56l-10.92,13.86v31.5h-13.58V7.69Z%27/%3e%3cpath%20class=%27d%27%20d=%27M254.83,95.33h27.44V15.25h-27.44V4.89h40.6v90.44h25.06v10.36h-65.66v-10.36Z%27/%3e%3cpath%20class=%27d%27%20d=%27M326.79,70.27c0-21.7,14.42-36.4,35.28-36.4s35.56,14.7,35.56,36.4-14.28,36.12-35.56,36.12-35.28-14.56-35.28-36.12ZM362.07,95.75c13.72,0,22.4-9.66,22.4-25.48s-8.54-25.76-22.4-25.76-21.98,9.8-21.98,25.76,8.4,25.48,21.98,25.48Z%27/%3e%3cpath%20class=%27d%27%20d=%27M405.75,86.09c0-9.38,5.04-15.68,14.56-18.48,5.46-1.54,13.3-2.38,27.86-4.48,5.46-.84,7.14-2.1,7.14-5.74,0-8.4-5.74-12.88-16.1-12.88s-16.38,4.48-17.78,12.46h-12.74c1.54-14.7,12.88-23.1,30.8-23.1s28.84,9.66,28.84,26.74v45.08h-12.46v-12.04h-.42c-4.9,8.12-14.14,12.74-25.06,12.74-15.68,0-24.64-7.42-24.64-20.3ZM432.77,95.89c13.02,0,22.54-8.68,22.54-20.72v-4.2c-5.88,2.38-21.98,2.66-28,4.34-5.74,1.68-8.4,4.9-8.4,10.36,0,6.72,4.76,10.22,13.86,10.22Z%27/%3e%3cpath%20class=%27d%27%20d=%27M483.59,4.89h13.02v62.86h.42l36.54-33.18h14.56l-30.66,28.98v.56l32.06,41.58h-14.56l-26.18-33.46h-.56l-11.62,11.06v22.4h-13.02V4.89Z%27/%3e%3c/g%3e%3cpath%20class=%27d%27%20d=%27M119.72,31.87V0c-31.55,0-60.26,12.35-81.58,32.46C34.1,22.42,31.87,11.47,31.87,0H0c0,21.92,5.97,42.47,16.35,60.13C6.43,77.49.75,97.58.75,118.98h31.87c0-11.08,2.08-21.68,5.87-31.44,21.2,19.51,49.48,31.44,80.49,31.44v-31.87c-24.86,0-47.31-10.47-63.2-27.22,15.92-17.22,38.69-28.02,63.94-28.02Z%27/%3e%3c/g%3e%3c/g%3e%3c/svg%3e";

const HomeAction = ({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="group flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-lg border border-border/50 bg-card/30 px-3 py-4 text-center transition-colors hover:border-primary/45 hover:bg-card/60"
  >
    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
      <Icon className="h-4.5 w-4.5" />
    </div>
    <div className="space-y-1">
      <h2 className="text-xs font-medium text-foreground sm:text-sm">{title}</h2>
      <p className="text-[11px] leading-4 text-muted-foreground sm:text-xs">{description}</p>
    </div>
  </button>
);

export const HomeLanding = () => {
  const navigate = useNavigate();
  const { openModal } = useUIStore();
  const { user } = useAuthStore();
  const name = user?.display_name || user?.username || "there";

  return (
    <div className="flex h-full min-h-0 w-full flex-1 items-center justify-center overflow-y-auto bg-layout-chat px-4 py-8">
      <div className="flex w-full max-w-xl flex-col items-center text-center">
        <div className="mb-6 flex w-full justify-center">
          <img
            src={KLOAK_LOGO_SRC}
            alt="Kloak"
            className="h-auto w-40 max-w-[70%] opacity-95 sm:w-48"
            draggable={false}
          />
        </div>

        <p className="mb-2 text-sm font-medium text-muted-foreground">Welcome back</p>
        <h1 className="max-w-full truncate text-2xl font-semibold text-foreground sm:text-3xl">{name}</h1>
        <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
          Choose a direct message, visit friends, or find a community to join.
        </p>

        <div className="mt-8 grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
          <HomeAction
            icon={UserRoundPlus}
            title="Friends"
            description="Requests and DMs"
            onClick={() => navigate("/app/friends")}
          />
          <HomeAction
            icon={Compass}
            title="Explore"
            description="Public servers"
            onClick={() => navigate("/app/explore")}
          />
          <HomeAction
            icon={Users}
            title="Join"
            description="Use an invite"
            onClick={() => openModal("join-server")}
          />
          <HomeAction
            icon={Plus}
            title="Create"
            description="Start a server"
            onClick={() => openModal("create-server")}
          />
        </div>
      </div>
    </div>
  );
};
