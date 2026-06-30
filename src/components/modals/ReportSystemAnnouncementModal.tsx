import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageSquareWarning, ShieldCheck, Trophy } from "lucide-react";

type Announcement = {
  storageKey: string;
  icon: typeof ShieldCheck;
  title: string;
  description: string;
  body: string;
  buttonLabel: string;
  imageSrc?: string;
  eyebrow?: string;
};

const ANNOUNCEMENTS: Announcement[] = [
  {
    storageKey: "kloak.aura-announcement.v1.dismissed",
    icon: Trophy,
    imageSrc: "/aura-badge.svg",
    eyebrow: "What's New",
    title: "Aura is here",
    description: "Earn achievements as you use Kloak and build your Aura over time.",
    body: "Your Aura shows your progress across the app. Send messages, make friends, join servers, customize your profile, and unlock achievements that appear in User Settings and on profiles.",
    buttonLabel: "Start earning Aura",
  },
  {
    storageKey: "kloak.report-system-announcement.v1.dismissed",
    icon: MessageSquareWarning,
    title: "New report system is here",
    description: "You can now report messages, profiles, and servers when something needs our attention.",
    body: "Reports help keep Kloak safer and easier to use. Thanks for helping us look after the community.",
    buttonLabel: "Got it",
  },
  {
    storageKey: "kloak.two-factor-announcement.v1.dismissed",
    icon: ShieldCheck,
    title: "2FA is here",
    description: "You asked, we listened. You can now add an authenticator app code to your Kloak login.",
    body: "Head to User Settings > Account to set it up. It is quick, optional, gives your secret key an extra layer of backup, and opens up the option to reset your login key too.",
    buttonLabel: "Nice, got it",
  },
];

export const ReportSystemAnnouncementModal = () => {
  const [activeAnnouncement, setActiveAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    try {
      setActiveAnnouncement(
        ANNOUNCEMENTS.find((announcement) => window.localStorage.getItem(announcement.storageKey) !== "true") ?? null,
      );
    } catch {
      setActiveAnnouncement(ANNOUNCEMENTS[0] ?? null);
    }
  }, []);

  const dismiss = () => {
    if (!activeAnnouncement) return;

    try {
      window.localStorage.setItem(activeAnnouncement.storageKey, "true");
    } catch {
      // Ignore storage failures; closing the modal should still work for this session.
    }

    setActiveAnnouncement(
      ANNOUNCEMENTS.find((announcement) => {
        if (announcement.storageKey === activeAnnouncement.storageKey) return false;

        try {
          return window.localStorage.getItem(announcement.storageKey) !== "true";
        } catch {
          return false;
        }
      }) ?? null,
    );
  };

  const Icon = activeAnnouncement?.icon;

  return (
    <Dialog
      open={Boolean(activeAnnouncement)}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) dismiss();
      }}
    >
      <DialogContent className="max-w-[calc(100vw-2rem)] overflow-hidden rounded-[8px] border-border bg-card p-0 text-foreground shadow-2xl sm:max-w-[486px]">
        <div className="overflow-hidden border-b border-border bg-gradient-to-b from-primary/12 via-primary/5 to-transparent px-6 py-8">
          <div className="mx-auto mb-5 flex justify-center text-white">
            {activeAnnouncement?.imageSrc ? (
              <img
                src={activeAnnouncement.imageSrc}
                alt=""
                className="h-14 w-14 rounded-2xl object-cover shadow-lg shadow-primary/20"
              />
            ) : (
              Icon && <Icon className="h-12 w-12" aria-hidden="true" />
            )}
          </div>

          <DialogHeader className="mx-auto max-w-[360px] text-center">
            {activeAnnouncement?.eyebrow && (
              <div className="pb-2 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                {activeAnnouncement.eyebrow}
              </div>
            )}
            <DialogTitle className="text-center text-xl font-semibold tracking-tight sm:text-2xl">
              {activeAnnouncement?.title}
            </DialogTitle>
            <DialogDescription className="pt-2 text-center text-sm leading-relaxed text-muted-foreground sm:text-base">
              {activeAnnouncement?.description}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-[8px] border border-border bg-background/70 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
            {activeAnnouncement?.body}
          </div>

          <Button type="button" className="h-11 w-full rounded-[8px]" onClick={dismiss}>
            {activeAnnouncement?.buttonLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
