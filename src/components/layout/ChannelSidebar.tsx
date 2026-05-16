import { useState, useMemo, useCallback, useEffect, useRef, memo, type ReactNode, type SyntheticEvent } from "react";
import { FluentEmoji } from "@/components/ui/FluentEmoji";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";
import { useMessageStore } from "@/stores/messageStore";
import { useServerStore } from "@/stores/serverStore";
import { useVoiceStore } from "@/stores/voiceStore";
import { useVoicePresenceWatchers } from "@/hooks/useVoicePresenceWatchers";
import { useUIStore } from "@/stores/uiStore";
import { useUnreadChannelsContext } from "@/hooks/useUnreadChannelsContext";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { useChannelSettingsStore } from "@/stores/channelSettingsStore";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LoggedInUserPanel } from "@/components/layout/LoggedInUserPanel";
import { VoiceConnectedBanner } from "@/components/layout/VoiceConnectedBanner";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ChannelContextMenu } from "@/components/layout/ChannelContextMenu";
import { ChannelContextDrawer } from "@/components/layout/ChannelContextDrawer";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { fetchAndCacheUser, getUserFromCache, useUserCacheStore } from "@/stores/userCacheStore";
import { openUserProfileModal } from "@/lib/userProfilePopover";
import { beginChannelNavigationPerf } from "@/lib/chatPerf";
import type { Channel, ChannelCategory, ServerRole } from "@/types";

const INITIAL_CHANNEL_PREFETCH_LIMIT = 35;

// ─── Inline SVG Icons (memo-wrapped, zero bundle cost) ───

const HashIcon = memo(({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" />
    <line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" />
  </svg>
));
HashIcon.displayName = "HashIcon";

const VolumeIcon = memo(({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
  </svg>
));
VolumeIcon.displayName = "VolumeIcon";

const VolumeXIcon = memo(({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
  </svg>
));
VolumeXIcon.displayName = "VolumeXIcon";

const MicOffIcon = memo(({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="1" y1="1" x2="23" y2="23" />
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.12 1.49-.34 2.18" />
    <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
  </svg>
));
MicOffIcon.displayName = "MicOffIcon";

const ChevronDownIcon = memo(({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
));
ChevronDownIcon.displayName = "ChevronDownIcon";

const ChevronRightIcon = memo(({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
));
ChevronRightIcon.displayName = "ChevronRightIcon";

const SettingsIcon = memo(({ className, onClick }: { className?: string; onClick?: (e: React.MouseEvent) => void }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} onClick={onClick}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
));
SettingsIcon.displayName = "SettingsIcon";

const PlusIcon = memo(({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
));
PlusIcon.displayName = "PlusIcon";

const LockIcon = memo(({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
));
LockIcon.displayName = "LockIcon";

const LogOutIcon = memo(({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
  </svg>
));
LogOutIcon.displayName = "LogOutIcon";

const UserPlusIcon = memo(({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
  </svg>
));
UserPlusIcon.displayName = "UserPlusIcon";

const FolderPlusIcon = memo(({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    <line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" />
  </svg>
));
FolderPlusIcon.displayName = "FolderPlusIcon";

const InfoIcon = memo(({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M16.19 2H12.75V8V8.75V13.75H22V8.75V8V7.81C22 4.17 19.83 2 16.19 2Z" fill="#A2A2AB" />
    <path d="M2 10.25V15.25V15.75V16.19C2 19.83 4.17 22 7.81 22H11.25V15.75V15.25V10.25H2Z" fill="#A2A2AB" />
    <path d="M11.25 2V8.75H2V7.81C2 4.17 4.17 2 7.81 2H11.25Z" fill="#A2A2AB" />
    <path d="M22 15.25V16.19C22 19.83 19.83 22 16.19 22H12.75V15.25H22Z" fill="#A2A2AB" />
  </svg>
));
InfoIcon.displayName = "InfoIcon";

const MembersIcon = memo(({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M5 9.5C5 7.01472 7.01472 5 9.5 5C11.9853 5 14 7.01472 14 9.5C14 11.9853 11.9853 14 9.5 14C7.01472 14 5 11.9853 5 9.5Z"
      fill="#A2A2AB"
    />
    <path
      d="M14.3675 12.0632C14.322 12.1494 14.3413 12.2569 14.4196 12.3149C15.0012 12.7454 15.7209 13 16.5 13C18.433 13 20 11.433 20 9.5C20 7.567 18.433 6 16.5 6C15.7209 6 15.0012 6.2546 14.4196 6.68513C14.3413 6.74313 14.322 6.85058 14.3675 6.93679C14.7714 7.70219 15 8.5744 15 9.5C15 10.4256 14.7714 11.2978 14.3675 12.0632Z"
      fill="#A2A2AB"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4.64115 15.6993C5.87351 15.1644 7.49045 15 9.49995 15C11.5112 15 13.1293 15.1647 14.3621 15.7008C15.705 16.2847 16.5212 17.2793 16.949 18.6836C17.1495 19.3418 16.6551 20 15.9738 20H3.02801C2.34589 20 1.85045 19.3408 2.05157 18.6814C2.47994 17.2769 3.29738 16.2826 4.64115 15.6993Z"
      fill="#A2A2AB"
    />
    <path
      d="M14.8185 14.0364C14.4045 14.0621 14.3802 14.6183 14.7606 14.7837V14.7837C15.803 15.237 16.5879 15.9043 17.1508 16.756C17.6127 17.4549 18.33 18 19.1677 18H20.9483C21.6555 18 22.1715 17.2973 21.9227 16.6108C21.9084 16.5713 21.8935 16.5321 21.8781 16.4932C21.5357 15.6286 20.9488 14.9921 20.0798 14.5864C19.2639 14.2055 18.2425 14.0483 17.0392 14.0008L17.0194 14H16.9997C16.2909 14 15.5506 13.9909 14.8185 14.0364Z"
      fill="#A2A2AB"
    />
  </svg>
));
MembersIcon.displayName = "MembersIcon";

const Edit2Icon = memo(({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
));
Edit2Icon.displayName = "Edit2Icon";

const Trash2Icon = memo(({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-2 14H7L5 6" />
    <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
));
Trash2Icon.displayName = "Trash2Icon";

const GripVerticalIcon = memo(({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="9" cy="12" r="1" /><circle cx="9" cy="5" r="1" /><circle cx="9" cy="19" r="1" />
    <circle cx="15" cy="12" r="1" /><circle cx="15" cy="5" r="1" /><circle cx="15" cy="19" r="1" />
  </svg>
));
GripVerticalIcon.displayName = "GripVerticalIcon";

const ArrowUpDownIcon = memo(({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="12" y1="2" x2="12" y2="22" /><polyline points="8 18 12 22 16 18" /><polyline points="8 6 12 2 16 6" />
  </svg>
));
ArrowUpDownIcon.displayName = "ArrowUpDownIcon";

const MegaphoneIcon = memo(({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m3 11 18-5v12L3 13v-2z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
  </svg>
));
MegaphoneIcon.displayName = "MegaphoneIcon";

const FilmIcon = memo(({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
    <line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" />
    <line x1="2" y1="12" x2="22" y2="12" /><line x1="2" y1="7" x2="7" y2="7" />
    <line x1="2" y1="17" x2="7" y2="17" /><line x1="17" y1="7" x2="22" y2="7" /><line x1="17" y1="17" x2="22" y2="17" />
  </svg>
));
FilmIcon.displayName = "FilmIcon";

const ClipboardListIcon = memo(({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" />
  </svg>
));
ClipboardListIcon.displayName = "ClipboardListIcon";

const MessageSquareIcon = memo(({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
));
MessageSquareIcon.displayName = "MessageSquareIcon";

const EyeOffIcon = memo(({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
));
EyeOffIcon.displayName = "EyeOffIcon";

const CopyIcon = memo(({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
));
CopyIcon.displayName = "CopyIcon";

// Ghost Icon Component
const GhostIcon = memo(({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      d="M16 10.5C16 11.3284 15.5523 12 15 12C14.4477 12 14 11.3284 14 10.5C14 9.67157 14.4477 9 15 9C15.5523 9 16 9.67157 16 10.5Z"
      fill="currentColor"
    />
    <ellipse cx="9" cy="10.5" rx="1" ry="1.5" fill="currentColor" />
    <path
      d="M22 19.723V12.3006C22 6.61173 17.5228 2 12 2C6.47715 2 2 6.61173 2 12.3006V19.723C2 21.0453 3.35098 21.9054 4.4992 21.314C5.42726 20.836 6.5328 20.9069 7.39614 21.4998C8.36736 22.1667 9.63264 22.1667 10.6039 21.4998L10.9565 21.2576C11.5884 20.8237 12.4116 20.8237 13.0435 21.2576L13.3961 21.4998C14.3674 22.1667 15.6326 22.1667 16.6039 21.4998C17.4672 20.9069 18.5727 20.836 19.5008 21.314C20.649 21.9054 22 21.0453 22 19.723Z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
));
GhostIcon.displayName = "GhostIcon";

// ─── Voice Participant List ───

const VoiceParticipantList = memo(({
  channelId,
  userIds,
  resolveUser,
}: {
  channelId: string;
  userIds: string[];
  resolveUser: (userId: string) => { avatarUser?: any; label: string };
}) => {
  const participantMeta = useVoiceStore((s) => s.participantMeta);
  const { openModal } = useUIStore();

  const handleClick = useCallback((userId: string, el: HTMLElement) => {
    openUserProfileModal(openModal, userId, el);
  }, [openModal]);

  return (
    <div className="ml-7 mt-1 space-y-0.5">
      {userIds.map((id) => {
        const info = resolveUser(id);
        const meta = participantMeta[`${channelId}:${id}`];
        return (
          <button
            key={id}
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-secondary/50 transition-colors w-full text-left cursor-pointer"
            onClick={(e) => handleClick(id, e.currentTarget)}
            aria-label={`Voice user ${info.label}`}
          >
            <AvatarWithDecoration user={info.avatarUser} size={22} freezeGifUntilHover />
            <span className="truncate flex-1">{info.label}</span>
            {meta?.isDeafened ? (
              <VolumeXIcon className="w-3.5 h-3.5 text-destructive/70 flex-shrink-0" />
            ) : meta?.isMuted ? (
              <MicOffIcon className="w-3.5 h-3.5 text-destructive/70 flex-shrink-0" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
});
VoiceParticipantList.displayName = "VoiceParticipantList";

// ─── Uncategorized Drop Zone ───

const UncategorizedDropZone = memo(({
  children,
  isDragOver,
  hasChannels,
}: {
  children: ReactNode;
  isDragOver: boolean;
  hasChannels: boolean;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: "uncategorized-drop",
    data: { type: "category-drop", categoryId: null },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "transition-all duration-800",
        (isOver || isDragOver) && "ring-2 ring-primary/50 ring-offset-2 ring-offset-card/50 rounded-md p-1 mb-2",
        !hasChannels && (isOver || isDragOver) && "min-h-[60px] flex items-center justify-center",
      )}
    >
      {children}
      {!hasChannels && (isOver || isDragOver) && (
        <div className="text-xs text-muted-foreground text-center py-2">Drop channel here to uncategorize</div>
      )}
    </div>
  );
});
UncategorizedDropZone.displayName = "UncategorizedDropZone";

// ─── Voice user count badge with pulsing dot ───

const VoiceUserCountBadge = memo(({ count }: { count: number }) => (
  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-mono rounded-full bg-green-600/20 text-green-400 flex-shrink-0">
    <span className="relative flex h-1.5 w-1.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
    </span>
    {count}
  </span>
));
VoiceUserCountBadge.displayName = "VoiceUserCountBadge";

// ─── Unread dot indicator ───

const UnreadDot = memo(() => (
  <span className="inline-block w-1.5 h-1.5 rounded-full bg-foreground flex-shrink-0" />
));
UnreadDot.displayName = "UnreadDot";

const SIDEBAR_ITEM_ICON_SLOT = "flex-shrink-0 w-5 h-5 flex items-center justify-center";
const SIDEBAR_ITEM_ICON = "block w-4 h-4 flex-shrink-0";

// ─── Channel icon resolver (memoized helper) ───

const ChannelIcon = memo(({ channel, isUnread, isActive }: { channel: Channel; isUnread: boolean; isActive: boolean }) => {
  const iconCn = cn(
    `${SIDEBAR_ITEM_ICON} transition-colors`,
    isUnread && !isActive ? "text-foreground opacity-100" : "text-muted-foreground",
  );

  if (channel.icon) return <FluentEmoji emoji={channel.icon} size={18} />;
  if (channel.is_private) return <LockIcon className={iconCn} />;
  if (channel.type === "voice") return <VolumeIcon className={iconCn} />;
  if (channel.type === "forum") return <MessageSquareIcon className={iconCn} />;
  if (channel.type === "announcement") return <MegaphoneIcon className={iconCn} />;
  if (channel.type === "media") return <FilmIcon className={iconCn} />;
  if (channel.type === "tasks") return <ClipboardListIcon className={iconCn} />;
  if (channel.ghost_mode) return <GhostIcon className={iconCn} />;
  return <HashIcon className={iconCn} />;
});
ChannelIcon.displayName = "ChannelIcon";

// ─── Modern Sortable Channel Item ───

const SortableChannel = memo(({
  channel,
  isActive,
  isUnread,
  mentionCount,
  isAdmin,
  voiceUserIds,
  resolveUser,
  onSelect,
  onOpenChat,
  onEdit,
  onDelete,
  onCopyLink,
  onMarkAsRead,
  isMobile,
  isDraggingAny,
  isSortingMode,
  categories,
  hasLinkedChat,
  isLinkedChatActive,
  onPrefetch,
  onPrefetchCancel,
}: {
  channel: Channel;
  isActive: boolean;
  isUnread: boolean;
  mentionCount: number;
  isAdmin: boolean;
  voiceUserIds?: string[];
  resolveUser?: (userId: string) => { avatarUser?: any; label: string };
  onSelect: () => void;
  onOpenChat?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
  onMarkAsRead?: () => void;
  isMobile?: boolean;
  isDraggingAny?: boolean;
  isSortingMode?: boolean;
  categories?: ChannelCategory[];
  hasLinkedChat?: boolean;
  isLinkedChatActive?: boolean;
  onPrefetch?: () => void;
  onPrefetchCancel?: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: channel.id,
    data: { type: "channel", channel },
    disabled: isMobile && !isSortingMode,
  });

  const style = useMemo(() => ({
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  }), [transform, transition, isDragging]);

  const handleSettingsClick = useCallback((e: SyntheticEvent) => {
    e.stopPropagation();
    onEdit();
  }, [onEdit]);

  const handleOpenChatClick = useCallback((e: SyntheticEvent) => {
    e.stopPropagation();
    onOpenChat?.();
  }, [onOpenChat]);

  const voiceCount = voiceUserIds?.length ?? 0;
  const showOpenChatAction = channel.type === "voice" && hasLinkedChat && !!onOpenChat;
  const showDesktopActions = !isMobile && !isSortingMode && (showOpenChatAction || isAdmin);
  const rowIsActive = isActive || !!isLinkedChatActive;
  const desktopActionCount = (showOpenChatAction ? 1 : 0) + (isAdmin ? 2 : 0);
  const desktopActionPaddingClass =
    desktopActionCount >= 3
      ? "pr-24"
      : desktopActionCount === 2
        ? "pr-16"
        : desktopActionCount === 1 || (channel.type === "voice" && voiceCount > 0)
          ? "pr-10"
          : "";

  // Build aria-label
  const ariaLabel = useMemo(() => {
    const parts = [`${channel.type || 'text'} channel ${channel.name}`];
    if (isUnread && mentionCount === 0) parts.push('unread');
    if (mentionCount > 0) parts.push(`${mentionCount} mention${mentionCount > 1 ? 's' : ''}`);
    if (channel.is_private) parts.push('private');
    if (showOpenChatAction) parts.push('has attached chat');
    return parts.join(', ');
  }, [channel.name, channel.type, channel.is_private, isUnread, mentionCount, showOpenChatAction]);

  const buttonContent = (
    <div className="flex items-center w-full min-w-0">
      {isMobile && isSortingMode && isAdmin && (
        <div {...attributes} {...listeners} className="p-1.5 mr-1 cursor-grab active:cursor-grabbing touch-none">
          <GripVerticalIcon className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
      <button
        onClick={isSortingMode ? undefined : onSelect}
        onMouseEnter={onPrefetch}
        onMouseLeave={onPrefetchCancel}
        onFocus={onPrefetch}
        onBlur={onPrefetchCancel}
        aria-label={ariaLabel}
        className={cn(
          "group relative flex-1 min-w-0 flex items-center gap-2 px-2.5 py-2 md:py-1.5 text-[14px] leading-5 font-medium select-none rounded-[3px]",
          "transition-colors duration-150",
          "hover:bg-foreground/[0.04]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1",
          rowIsActive && !isSortingMode && "bg-foreground/[0.06] text-foreground",
          !rowIsActive && "text-muted-foreground hover:text-foreground",
          isUnread && !rowIsActive && "text-foreground font-[500]",
          isDragging && "opacity-50 shadow-lg ring-2 ring-primary/30 bg-secondary",
          isSortingMode && "cursor-default",
          desktopActionPaddingClass,
        )}
      >
        {/* Active indicator */}
        <div
          className={cn(
            "absolute left-1 top-1.5 bottom-1.5 w-0.5 bg-foreground rounded-full transition-opacity duration-150",
            rowIsActive && !isSortingMode ? "opacity-100" : "opacity-0",
          )}
        />

        {/* Channel icon */}
        <div className={SIDEBAR_ITEM_ICON_SLOT}>
          <ChannelIcon channel={channel} isUnread={isUnread} isActive={isActive} />
        </div>

        {/* Channel name */}
        <span className="truncate flex-1 text-left leading-5">{channel.name}</span>

        {/* Private indicator (only if no custom icon already showing lock) */}
        {channel.is_private && !channel.icon && <LockIcon className="w-3 h-3 text-muted-foreground flex-shrink-0" />}

        {/* NSFW badge */}
        {channel.is_nsfw && (
          <span className="px-1.5 py-0.5 text-[11px] font-sans font-medium rounded-full bg-kloak-dnd text-white border border-kloak-dnd/60 uppercase leading-none flex-shrink-0">
            NSFW
          </span>
        )}

        {/* Voice user count badge */}
        {channel.type === "voice" && voiceCount > 0 && !isSortingMode && (
          <span
            className={cn(
              "absolute right-3 top-1/2 -translate-y-1/2 transition-opacity duration-150",
              showDesktopActions && "group-hover:opacity-0",
            )}
          >
            <VoiceUserCountBadge count={voiceCount} />
          </span>
        )}

        {/* Unread dot (no mentions) */}
        {isUnread && mentionCount === 0 && !isSortingMode && (
          <span
            className={cn(
              "absolute right-3 top-1/2 -translate-y-1/2 transition-opacity duration-150",
              showDesktopActions && "group-hover:opacity-0",
            )}
          >
            <UnreadDot />
          </span>
        )}

        {/* Mention badge */}
        {mentionCount > 0 && !isSortingMode && (
          <span
            className={cn(
              "px-1.5 py-0.5 text-xs font-mono rounded-full bg-red-600 text-white flex-shrink-0 transition-opacity",
              showDesktopActions && "group-hover:opacity-0",
            )}
          >
            {mentionCount > 99 ? "99+" : mentionCount}
          </span>
        )}

        {showDesktopActions && (
          <div className="absolute right-1 top-1/2 z-10 flex -translate-y-1/2 items-center gap-0.5">
            {showOpenChatAction && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    role="button"
                    tabIndex={0}
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity transition-colors group-hover:opacity-100 hover:bg-secondary hover:text-foreground",
                      isLinkedChatActive && "bg-foreground/[0.08] text-foreground",
                    )}
                    onClick={handleOpenChatClick}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleOpenChatClick(e);
                      }
                    }}
                    aria-label={`Open chat for ${channel.name}`}
                  >
                    <MessageSquareIcon className="w-3.5 h-3.5" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Open Chat</TooltipContent>
              </Tooltip>
            )}

            {isAdmin && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      role="button"
                      tabIndex={0}
                      className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity transition-colors group-hover:opacity-100 hover:bg-secondary hover:text-foreground"
                      onClick={handleSettingsClick}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleSettingsClick(e);
                        }
                      }}
                      aria-label={`Open settings for ${channel.name}`}
                    >
                      <SettingsIcon className="w-3.5 h-3.5" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Channel Settings</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      {...attributes}
                      {...listeners}
                      className="flex h-6 w-6 cursor-grab items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity transition-colors group-hover:opacity-50 hover:!opacity-100 hover:bg-secondary hover:text-foreground active:cursor-grabbing"
                      aria-label={`Reorder ${channel.name}`}
                    >
                      <div className="w-1 h-3 flex flex-col gap-0.5 justify-center">
                        <div className="w-1 h-1 rounded-full bg-current" />
                        <div className="w-1 h-1 rounded-full bg-current" />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Drag to Reorder</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        )}
      </button>
    </div>
  );

  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleMobileContextMenu = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (isMobile && !isSortingMode && !isDraggingAny) {
      e.preventDefault();
      e.stopPropagation();
      setDrawerOpen(true);
    }
  }, [isMobile, isSortingMode, isDraggingAny]);

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {isMobile && (isSortingMode || isDraggingAny) ? (
        buttonContent
      ) : isMobile ? (
        <>
          <div onContextMenu={handleMobileContextMenu}>
            {buttonContent}
          </div>
          <ChannelContextDrawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            channel={channel}
            isAdmin={isAdmin}
            categories={categories}
            onEdit={onEdit}
            onDelete={onDelete}
            onCopyLink={onCopyLink}
            onOpenChat={onOpenChat}
            onMarkAsRead={onMarkAsRead}
          />
        </>
      ) : (
        <ContextMenu>
          <ContextMenuTrigger asChild disabled={isDraggingAny}>
            {buttonContent}
          </ContextMenuTrigger>
          <ChannelContextMenu
            channel={channel}
            isAdmin={isAdmin}
            categories={categories}
            onEdit={onEdit}
            onDelete={onDelete}
            onCopyLink={onCopyLink}
            onOpenChat={onOpenChat}
            onMarkAsRead={onMarkAsRead}
          />
        </ContextMenu>
      )}

      {channel.type === "voice" && voiceUserIds && voiceUserIds.length > 0 && resolveUser && (
        <VoiceParticipantList channelId={channel.id} userIds={voiceUserIds} resolveUser={resolveUser} />
      )}
    </div>
  );
});
SortableChannel.displayName = "SortableChannel";

// ─── Category Content ───

const CategoryContent = memo(({
  channels,
  currentChannelId,
  getChannelUnread,
  isAdmin,
  onSelectChannel,
  onOpenChannelChat,
  onEditChannel,
  onDeleteChannel,
  onCopyChannelLink,
  onMarkAsRead,
  voicePresenceByChannel,
  resolveUser,
  isMobile,
  isDraggingAny,
  isSortingMode,
  categories,
  linkedTextChannelByVoiceId,
  onPrefetchChannel,
  onCancelPrefetchChannel,
}: {
  channels: Channel[];
  currentChannelId: string | undefined;
  getChannelUnread: (channelId: string) => { unreadCount: number; mentionCount: number };
  isAdmin: boolean;
  onSelectChannel: (channel: Channel) => void;
  onOpenChannelChat: (channel: Channel) => void;
  onEditChannel: (channelId: string) => void;
  onDeleteChannel: (channelId: string) => void;
  onCopyChannelLink: (channelId: string) => void;
  onMarkAsRead?: (channelId: string) => void;
  voicePresenceByChannel: Record<string, string[]>;
  resolveUser: (userId: string) => { avatarUser?: any; label: string };
  isMobile?: boolean;
  isDraggingAny?: boolean;
  isSortingMode?: boolean;
  categories?: ChannelCategory[];
  linkedTextChannelByVoiceId: Map<string, Channel>;
  onPrefetchChannel?: (channel: Channel) => void;
  onCancelPrefetchChannel?: (channelId: string) => void;
}) => {
  const channelIds = useMemo(() => channels.map((c) => c.id), [channels]);

  return (
    <div className="space-y-0.5 ml-1 animate-fade-in">
      <SortableContext items={channelIds} strategy={verticalListSortingStrategy}>
        {channels.map((channel) => {
          const { unreadCount, mentionCount } = getChannelUnread(channel.id);
          const linkedTextChannel = linkedTextChannelByVoiceId.get(channel.id);
          return (
            <SortableChannel
              key={channel.id}
              channel={channel}
              isActive={currentChannelId === channel.id}
              isUnread={unreadCount > 0}
              mentionCount={mentionCount}
              isAdmin={isAdmin}
              voiceUserIds={voicePresenceByChannel[channel.id]}
              resolveUser={resolveUser}
              onSelect={() => onSelectChannel(channel)}
              onOpenChat={() => onOpenChannelChat(channel)}
              onEdit={() => onEditChannel(channel.id)}
              onDelete={() => onDeleteChannel(channel.id)}
              onCopyLink={() => onCopyChannelLink(channel.id)}
              onMarkAsRead={onMarkAsRead ? () => onMarkAsRead(channel.id) : undefined}
              onPrefetch={onPrefetchChannel ? () => onPrefetchChannel(channel) : undefined}
              onPrefetchCancel={onCancelPrefetchChannel ? () => onCancelPrefetchChannel(channel.id) : undefined}
              isMobile={isMobile}
              isDraggingAny={isDraggingAny}
              isSortingMode={isSortingMode}
              hasLinkedChat={!!linkedTextChannel}
              isLinkedChatActive={
                !!currentChannelId &&
                !!linkedTextChannel &&
                currentChannelId !== channel.id &&
                currentChannelId === linkedTextChannel.id
              }
            />
          );
        })}
      </SortableContext>
    </div>
  );
});
CategoryContent.displayName = "CategoryContent";

// ─── Sortable Category ───

const SortableCategory = memo(({
  category,
  channels,
  isCollapsed,
  isAdmin,
  currentChannelId,
  getChannelUnread,
  onToggle,
  onSelectChannel,
  onOpenChannelChat,
  onAddChannel,
  onEditChannel,
  onEditCategory,
  onDeleteCategory,
  onDeleteChannel,
  onCopyChannelLink,
  onMarkAsRead,
  isDragOver,
  voicePresenceByChannel,
  resolveUser,
  isMobile,
  isDraggingAny,
  isSortingMode,
  allCategories,
  linkedTextChannelByVoiceId,
  onPrefetchChannel,
  onCancelPrefetchChannel,
}: {
  category: ChannelCategory;
  channels: Channel[];
  isCollapsed: boolean;
  isAdmin: boolean;
  currentChannelId: string | undefined;
  getChannelUnread: (channelId: string) => { unreadCount: number; mentionCount: number };
  onToggle: () => void;
  onSelectChannel: (channel: Channel) => void;
  onOpenChannelChat: (channel: Channel) => void;
  onAddChannel: () => void;
  onEditChannel: (channelId: string) => void;
  onEditCategory: () => void;
  onDeleteCategory: () => void;
  onDeleteChannel: (channelId: string) => void;
  onCopyChannelLink: (channelId: string) => void;
  onMarkAsRead?: (channelId: string) => void;
  isDragOver?: boolean;
  voicePresenceByChannel: Record<string, string[]>;
  resolveUser: (userId: string) => { avatarUser?: any; label: string };
  isMobile?: boolean;
  isDraggingAny?: boolean;
  isSortingMode?: boolean;
  allCategories?: ChannelCategory[];
  linkedTextChannelByVoiceId: Map<string, Channel>;
  onPrefetchChannel?: (channel: Channel) => void;
  onCancelPrefetchChannel?: (channelId: string) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
    data: { type: "category", category },
    disabled: isMobile && !isSortingMode,
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `category-drop-${category.id}`,
    data: { type: "category-drop", categoryId: category.id },
  });

  const style = useMemo(() => ({
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  }), [transform, transition, isDragging]);

  const handleSettingsClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onEditCategory();
  }, [onEditCategory]);

  const categoryButton = (
    <div className="flex items-center flex-1">
      {isMobile && isSortingMode && isAdmin && (
        <div {...attributes} {...listeners} className="p-1 mr-1 cursor-grab active:cursor-grabbing touch-none">
          <GripVerticalIcon className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
      <button
        className={cn(
          "flex items-center gap-1 text-[11px] md:text-[11px] font-[500] text-muted-foreground hover:text-foreground uppercase tracking-wider flex-1 py-1.5",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1 rounded-sm",
          isDragging && "opacity-50",
          isSortingMode && "cursor-default",
        )}
        onClick={isSortingMode ? undefined : onToggle}
        aria-expanded={!isCollapsed}
        aria-label={`${category.name} category, ${channels.length} channels${isCollapsed ? ', collapsed' : ''}`}
      >
        <ChevronDownIcon className={cn("w-3 h-3 transition-transform duration-150", isCollapsed && "-rotate-90")} />
        <span className="truncate">{category.name}</span>
        {isCollapsed && <span className="ml-1 text-muted-foreground/60">({channels.length})</span>}
      </button>
    </div>
  );

  const [catDrawerOpen, setCatDrawerOpen] = useState(false);

  const handleCatMobileContext = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (isMobile && isAdmin && !isSortingMode && !isDraggingAny) {
      e.preventDefault();
      e.stopPropagation();
      setCatDrawerOpen(true);
    }
  }, [isMobile, isAdmin, isSortingMode, isDraggingAny]);

  const handleEditFromDrawer = useCallback(() => {
    setCatDrawerOpen(false);
    onEditCategory();
  }, [onEditCategory]);

  const handleDeleteFromDrawer = useCallback(() => {
    setCatDrawerOpen(false);
    onDeleteCategory();
  }, [onDeleteCategory]);

  const setRefs = useCallback((node: HTMLDivElement | null) => {
    setNodeRef(node);
    setDroppableRef(node);
  }, [setNodeRef, setDroppableRef]);

  return (
    <div
      ref={setRefs}
      style={style}
      className={cn(
        "mb-4 transition-colors duration-200",
        (isOver || isDragOver) && "ring-2 ring-primary/50 ring-offset-2 ring-offset-card/50 rounded-md",
        isDragging && "shadow-lg ring-2 ring-primary/30 bg-card rounded-md",
      )}
    >
      {/* Category header */}
      <div className="group flex items-center gap-1 px-0.5 mb-1">
        {isMobile && (isSortingMode || isDraggingAny) ? (
          categoryButton
        ) : isMobile ? (
          <>
            <div onContextMenu={handleCatMobileContext} className="flex-1">
              {categoryButton}
            </div>
            {isAdmin && (
              <Drawer open={catDrawerOpen} onOpenChange={setCatDrawerOpen}>
                <DrawerContent>
                  <DrawerHeader className="pb-2">
                    <DrawerTitle className="text-base font-semibold">{category.name}</DrawerTitle>
                  </DrawerHeader>
                  <div className="px-2 pb-6 space-y-0.5">
                    <button
                      onClick={handleEditFromDrawer}
                      className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium rounded-lg text-foreground hover:bg-secondary/40 active:bg-secondary/60 transition-colors"
                    >
                      <Edit2Icon className="w-4 h-4" />
                      Edit Category
                    </button>
                    <button
                      onClick={handleDeleteFromDrawer}
                      className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium rounded-lg text-destructive hover:bg-destructive/10 active:bg-destructive/20 transition-colors"
                    >
                      <Trash2Icon className="w-4 h-4" />
                      Delete Category
                    </button>
                  </div>
                </DrawerContent>
              </Drawer>
            )}
          </>
        ) : (
          <ContextMenu>
            <ContextMenuTrigger asChild disabled={isDraggingAny}>
              {categoryButton}
            </ContextMenuTrigger>
            {isAdmin && (
              <ContextMenuContent>
                <ContextMenuItem onClick={onEditCategory}>
                  <Edit2Icon className="w-4 h-4 mr-2" />
                  Edit Category
                </ContextMenuItem>
                <ContextMenuItem onClick={onDeleteCategory} className="text-destructive focus:text-destructive">
                  <Trash2Icon className="w-4 h-4 mr-2" />
                  Delete Category
                </ContextMenuItem>
              </ContextMenuContent>
            )}
          </ContextMenu>
        )}

        {/* Desktop-only controls - hide in sort mode */}
        {isAdmin && !isMobile && !isSortingMode && (
          <SettingsIcon
            className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground cursor-pointer flex-shrink-0"
            onClick={handleSettingsClick}
          />
        )}

        {/* Add channel button - hide in sort mode */}
        {isAdmin && !isSortingMode && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="p-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground rounded hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                onClick={onAddChannel}
                aria-label={`Create channel in ${category.name}`}
              >
                <PlusIcon className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Create Channel
            </TooltipContent>
          </Tooltip>
        )}

        {/* Drag handle - desktop only */}
        {isAdmin && !isMobile && (
          <div
            {...attributes}
            {...listeners}
            className="p-1 opacity-0 group-hover:opacity-50 hover:!opacity-100 cursor-grab active:cursor-grabbing"
          >
            <div className="w-1 h-3 flex flex-col gap-0.5 justify-center">
              <div className="w-1 h-1 rounded-full bg-muted-foreground" />
              <div className="w-1 h-1 rounded-full bg-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Channels */}
      {!isCollapsed && (
        <CategoryContent
          channels={channels}
          currentChannelId={currentChannelId}
          getChannelUnread={getChannelUnread}
          isAdmin={isAdmin}
          onSelectChannel={onSelectChannel}
          onOpenChannelChat={onOpenChannelChat}
          onEditChannel={onEditChannel}
          onDeleteChannel={onDeleteChannel}
          onCopyChannelLink={onCopyChannelLink}
          onMarkAsRead={onMarkAsRead}
          voicePresenceByChannel={voicePresenceByChannel}
          resolveUser={resolveUser}
          isMobile={isMobile}
          isDraggingAny={isDraggingAny}
          isSortingMode={isSortingMode}
          categories={allCategories}
          linkedTextChannelByVoiceId={linkedTextChannelByVoiceId}
          onPrefetchChannel={onPrefetchChannel}
          onCancelPrefetchChannel={onCancelPrefetchChannel}
        />
      )}
    </div>
  );
});
SortableCategory.displayName = "SortableCategory";

// ─── Main Sidebar ───

export const ChannelSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const {
    currentServer,
    currentChannel,
    setCurrentChannel,
    categories,
    channels,
    members,
    servers,
    leaveServer,
    reorderCategories,
    reorderChannels,
    deleteChannel,
    deleteCategory,
  } = useServerStore();

  const voicePresenceByChannel = useVoiceStore((s) => s.presenceByChannel);
  const joinedVoiceChannelId = useVoiceStore((s) => s.joinedChannelId);
  const { openModal, openServerSettings, openServerSettingsPage, closeMobileSidebars } = useUIStore();
  const isMobile = useIsMobile();
  const userCacheVersion = useUserCacheStore((s) => s._version);

  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<"channel" | "category" | null>(null);
  const [overCategoryId, setOverCategoryId] = useState<string | null>(null);
  const [isSortingMode, setIsSortingMode] = useState(false);
  const [bgDrawerOpen, setBgDrawerOpen] = useState(false);
  const [isServerHeaderCondensed, setIsServerHeaderCondensed] = useState(false);

  const channelIds = useMemo(() => (channels || []).map((c) => c.id), [channels]);
  const { getChannelUnread, markAsRead } = useUnreadChannelsContext();

  // Fetch per-user channel settings (mute, hide, pin) when channels change
  const { fetchSettings, isHidden, isPinned } = useChannelSettingsStore();
  const channelIdsKey = useMemo(() => channelIds.join(","), [channelIds]);
  useEffect(() => {
    fetchSettings(channelIds);
  }, [channelIdsKey]);

  const voiceChannelIds = useMemo(
    () => (channels || []).filter((c) => c.type === "voice").map((c) => c.id),
    [channels],
  );

  const watchedVoiceChannelIds = useMemo(
    () => voiceChannelIds.filter((id) => id !== joinedVoiceChannelId),
    [voiceChannelIds, joinedVoiceChannelId],
  );
  useVoicePresenceWatchers({ channelIds: watchedVoiceChannelIds, userId: user?.id ?? null });

  const currentMembership = useMemo(() => {
    if (!currentServer) return null;
    return servers.find((s) => s.id === currentServer.id);
  }, [servers, currentServer]);

  const memberUserById = useMemo(() => {
    void userCacheVersion;
    const map = new Map<string, any>();
    for (const m of members) {
      map.set(m.user_id, m.user ?? getUserFromCache(m.user_id));
    }
    return map;
  }, [members, userCacheVersion]);

  useEffect(() => {
    const voiceUserIds = Array.from(
      new Set(
        Object.values(voicePresenceByChannel)
          .flat()
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    );

    for (const userId of voiceUserIds) {
      if (memberUserById.get(userId)) continue;
      if (getUserFromCache(userId)) continue;
      fetchAndCacheUser(userId).catch(() => {});
    }
  }, [voicePresenceByChannel, memberUserById, userCacheVersion]);

  const resolveUser = useCallback(
    (userId: string) => {
      void userCacheVersion;
      const u = memberUserById.get(userId) ?? getUserFromCache(userId);
      const label = u?.display_name || u?.username || userId.slice(0, 8);
      return { avatarUser: u, label };
    },
    [memberUserById, userCacheVersion],
  );

  // Use permission system instead of hardcoded role checks
  const { hasPermission, isOwner } = useMemberPermissions();
  const canManageChannels = hasPermission("manage_channels");
  const canManageServer = hasPermission("manage_server");
  const canManageRoles = hasPermission("manage_roles");
  const canViewMembersShortcut = hasPermission("view_channels");
  const isAdmin = canManageChannels;
  const canSeeServerSettings = canManageChannels || canManageServer || canManageRoles;

  const channelSettings = useChannelSettingsStore((s) => s.settings);
  const [showHidden, setShowHidden] = useState(false);

  const { uncategorizedChannels, sortedCategories, hiddenChannels } = useMemo(() => {
    const safeChannels = (channels || []).filter((channel) => !channel.linked_voice_channel_id);
    const safeCategories = categories || [];
    const hidden = safeChannels.filter((channel) => isHidden(channel.id));
    const uncategorized = safeChannels
      .filter((channel) => !channel.category_id && !isHidden(channel.id))
      .sort((a, b) => {
        const aPinned = isPinned(a.id) ? 0 : 1;
        const bPinned = isPinned(b.id) ? 0 : 1;
        if (aPinned !== bPinned) return aPinned - bPinned;
        return (a.position ?? 0) - (b.position ?? 0);
      });

    const sorted = [...safeCategories].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    return { uncategorizedChannels: uncategorized, sortedCategories: sorted, hiddenChannels: hidden };
  }, [channels, categories, channelSettings]);

  const getChannelsForCategory = useCallback(
    (categoryId: string) => {
      return (channels || [])
        .filter((c) => c.category_id === categoryId && !c.linked_voice_channel_id && !isHidden(c.id))
        .sort((a, b) => {
          const aPinned = isPinned(a.id) ? 0 : 1;
          const bPinned = isPinned(b.id) ? 0 : 1;
          if (aPinned !== bPinned) return aPinned - bPinned;
          return (a.position ?? 0) - (b.position ?? 0);
        });
    },
    [channels],
  );

  const channelById = useMemo(() => {
    const map = new Map<string, Channel>();
    for (const channel of channels || []) {
      map.set(channel.id, channel);
    }
    return map;
  }, [channels]);

  const linkedTextIdsByVoiceId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const channel of channels || []) {
      if (channel.type !== "text" || !channel.linked_voice_channel_id) continue;
      const voiceId = channel.linked_voice_channel_id;
      const existing = map.get(voiceId);
      if (existing) {
        existing.push(channel.id);
      } else {
        map.set(voiceId, [channel.id]);
      }
    }
    return map;
  }, [channels]);

  const linkedTextChannelByVoiceId = useMemo(() => {
    const map = new Map<string, Channel>();
    for (const channel of channels || []) {
      if (channel.type !== "text" || !channel.linked_voice_channel_id) continue;
      if (!map.has(channel.linked_voice_channel_id)) {
        map.set(channel.linked_voice_channel_id, channel);
      }
    }
    return map;
  }, [channels]);

  const getSidebarChannelUnread = useCallback(
    (channelId: string) => {
      const base = getChannelUnread(channelId);
      const channel = channelById.get(channelId);
      if (!channel || channel.type !== "voice") return base;

      const linkedTextIds = linkedTextIdsByVoiceId.get(channelId);
      if (!linkedTextIds || linkedTextIds.length === 0) return base;

      let unreadCount = base.unreadCount;
      let mentionCount = base.mentionCount;

      for (const linkedId of linkedTextIds) {
        const linkedInfo = getChannelUnread(linkedId);
        unreadCount += linkedInfo.unreadCount;
        mentionCount += linkedInfo.mentionCount;
      }

      return { ...base, unreadCount, mentionCount };
    },
    [getChannelUnread, channelById, linkedTextIdsByVoiceId],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: isMobile && isSortingMode ? 5 : 10 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const isDraggingAny = activeId !== null;

  useEffect(() => {
    setIsServerHeaderCondensed(false);
  }, [currentServer?.id]);

  const handleChannelListScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const shouldCondense = event.currentTarget.scrollTop > 20;
    setIsServerHeaderCondensed((prev) => (prev === shouldCondense ? prev : shouldCondense));
  }, []);

  const toggleCategory = useCallback((categoryId: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  const handleSelectChannel = useCallback(
    (channel: Channel) => {
      beginChannelNavigationPerf(channel.id, {
        source: "sidebar",
        serverId: currentServer?.id ?? null,
        channelType: channel.type,
      });
      setCurrentChannel(channel);
      closeMobileSidebars();
      if (currentServer) {
        navigate(`/app/servers/${currentServer.id}/channels/${channel.id}`);
      }
    },
    [setCurrentChannel, currentServer, navigate, closeMobileSidebars],
  );

  const prefetchTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const cancelPrefetchChannel = useCallback((channelId: string) => {
    const timers = prefetchTimersRef.current;
    const timer = timers.get(channelId);
    if (!timer) return;
    clearTimeout(timer);
    timers.delete(channelId);
  }, []);

  const handlePrefetchChannel = useCallback((channel: Channel) => {
    if (channel.type !== "text" && channel.type !== "announcement") return;
    if (channel.server_id !== currentServer?.id) return;
    if (channel.id === currentChannel?.id) return;

    const timers = prefetchTimersRef.current;
    if (timers.has(channel.id)) return;

    const timer = setTimeout(() => {
      timers.delete(channel.id);
      if (useServerStore.getState().currentServer?.id !== channel.server_id) return;
      if (useServerStore.getState().currentChannel?.id === channel.id) return;
      const cacheEntry = useMessageStore.getState().messagesByChannel[channel.id];
      const hasFreshCache =
        !!cacheEntry &&
        (cacheEntry.messages?.length ?? 0) > 0 &&
        Date.now() - cacheEntry.lastFetched < 5 * 60_000;

      if (hasFreshCache) return;
      void useMessageStore.getState().prefetchChannelBootstrap(channel.id, INITIAL_CHANNEL_PREFETCH_LIMIT);
    }, 120);

    timers.set(channel.id, timer);
  }, [currentChannel?.id, currentServer?.id]);

  useEffect(() => {
    const timers = prefetchTimersRef.current;
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    timers.clear();
  }, [currentServer?.id]);

  useEffect(() => {
    return () => {
      const timers = prefetchTimersRef.current;
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  const handleOpenVoiceChannelChat = useCallback(
    (voiceChannel: Channel) => {
      if (!currentServer || voiceChannel.type !== "voice") return;
      const linkedTextChannel = linkedTextChannelByVoiceId.get(voiceChannel.id);
      if (!linkedTextChannel) {
        toast.error("No attached text chat yet");
        return;
      }
      setCurrentChannel(voiceChannel);
      closeMobileSidebars();
      navigate(`/app/servers/${currentServer.id}/channels/${voiceChannel.id}?voiceChat=1`);
    },
    [closeMobileSidebars, currentServer, linkedTextChannelByVoiceId, navigate, setCurrentChannel],
  );

  const isOverviewActive = !!currentServer && location.pathname === `/app/servers/${currentServer.id}/overview`;

  const handleSelectOverview = useCallback(() => {
    if (!currentServer) return;
    setCurrentChannel(null);
    navigate(`/app/servers/${currentServer.id}/overview`);
  }, [currentServer, setCurrentChannel, navigate]);

  const handleSelectMembersShortcut = useCallback(() => {
    localStorage.setItem("kloak:server-settings-tab", "members");
    if (isMobile) {
      openServerSettings();
      closeMobileSidebars();
      return;
    }
    openServerSettingsPage();
  }, [isMobile, openServerSettings, openServerSettingsPage, closeMobileSidebars]);

  const handleLeaveServer = useCallback(async () => {
    if (!currentServer || !user || isOwner) return;
    await leaveServer(currentServer.id, user.id);
  }, [currentServer, user, isOwner, leaveServer]);

  const handleCopyChannelLink = useCallback(
    (channelId: string) => {
      if (!currentServer) return;
      const channelLink = `${window.location.origin}/app/servers/${currentServer.id}/channels/${channelId}`;
      navigator.clipboard
        .writeText(channelLink)
        .then(() => {
          toast.success("Channel link copied!");
        })
        .catch(() => {
          toast.error("Failed to copy channel link");
        });
    },
    [currentServer],
  );

  const handleDeleteChannel = useCallback(
    async (channelId: string) => {
      if (!user) return;
      try {
        await deleteChannel(channelId, user.id);
        toast.success("Channel deleted");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to delete channel");
      }
    },
    [user, deleteChannel],
  );

  const handleDeleteCategory = useCallback(
    async (categoryId: string) => {
      if (!user) return;
      try {
        await deleteCategory(categoryId, user.id);
        toast.success("Category deleted");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to delete category");
      }
    },
    [user, deleteCategory],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current;
    setActiveId(active.id as string);
    setActiveType(data?.type || null);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;

    if (!over) {
      setOverCategoryId(null);
      return;
    }

    const activeData = active.data.current;
    const overData = over.data.current;

    if (activeData?.type === "channel" && overData?.type === "category-drop") {
      setOverCategoryId(overData.categoryId as string | null);
      return;
    }

    if (activeData?.type === "channel" && overData?.type === "channel") {
      const overChannel = overData.channel as Channel;
      setOverCategoryId(overChannel.category_id || null);
      return;
    }

    if (activeData?.type === "channel" && overData?.type === "category") {
      setOverCategoryId(over.id as string);
      return;
    }

    setOverCategoryId(null);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);
    setActiveType(null);
    setOverCategoryId(null);

    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    if (activeData?.type === "category" && overData?.type === "category") {
      const oldIndex = sortedCategories.findIndex((c) => c.id === active.id);
      const newIndex = sortedCategories.findIndex((c) => c.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(sortedCategories, oldIndex, newIndex);
        await reorderCategories(newOrder.map((c) => c.id));
      }
      return;
    }

    if (activeData?.type === "channel") {
      const activeChannel = activeData.channel as Channel;

      if (overData?.type === "category-drop") {
        const targetCategoryId = overData.categoryId as string | null;
        const targetChannels = targetCategoryId ? getChannelsForCategory(targetCategoryId) : uncategorizedChannels;
        const newPosition = targetChannels.length;

        if (activeChannel.category_id !== targetCategoryId) {
          await reorderChannels(activeChannel.id, targetCategoryId, newPosition);
        }
        return;
      }

      if (overData?.type === "category") {
        const targetCategoryId = over.id as string;
        const targetChannels = getChannelsForCategory(targetCategoryId);
        const newPosition = targetChannels.length;

        if (activeChannel.category_id !== targetCategoryId) {
          await reorderChannels(activeChannel.id, targetCategoryId, newPosition);
        }
        return;
      }

      const overChannel = overData?.channel as Channel | undefined;
      if (overChannel) {
        const targetCategoryId = overChannel.category_id;

        if ((activeChannel.category_id ?? null) === (targetCategoryId ?? null)) {
          const categoryChannels = targetCategoryId ? getChannelsForCategory(targetCategoryId) : uncategorizedChannels;
          const oldIndex = categoryChannels.findIndex((c) => c.id === active.id);
          const newIndex = categoryChannels.findIndex((c) => c.id === over.id);

          if (oldIndex !== -1 && newIndex !== -1) {
            await reorderChannels(activeChannel.id, activeChannel.category_id, newIndex);
          }
        } else {
          const targetChannels = targetCategoryId ? getChannelsForCategory(targetCategoryId) : uncategorizedChannels;
          const newIndex = targetChannels.findIndex((c) => c.id === over.id);

          if (newIndex !== -1) {
            await reorderChannels(activeChannel.id, targetCategoryId ?? null, newIndex);
          }
        }
      }
    }
  }, [sortedCategories, uncategorizedChannels, getChannelsForCategory, reorderCategories, reorderChannels]);

  const getActiveItem = useCallback(() => {
    if (!activeId) return null;

    if (activeType === "category") {
      const category = categories.find((c) => c.id === activeId);
      if (category) {
        return (
          <div className="flex items-center gap-1 px-3 py-1.5 bg-card border border-border shadow-lg rounded-md text-sm ring-2 ring-primary/30">
            <ChevronRightIcon className="w-3 h-3 text-muted-foreground" />
            <span className="uppercase text-xs font-normal">{category.name}</span>
          </div>
        );
      }
    }

    if (activeType === "channel") {
      const channel = channels.find((c) => c.id === activeId);
      if (channel) {
        const getIcon = () => {
          if (channel.icon) return <FluentEmoji emoji={channel.icon} size={18} />;
          if (channel.type === "voice") return <VolumeIcon className="w-4 h-4 text-muted-foreground" />;
          if (channel.ghost_mode) return <GhostIcon className="w-4 h-4 text-muted-foreground" />;
          return <HashIcon className="w-4 h-4 text-muted-foreground" />;
        };

        return (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border shadow-lg rounded-md text-sm ring-2 ring-primary/30">
            {getIcon()}
            <span>{channel.name}</span>
          </div>
        );
      }
    }

    return null;
  }, [activeId, activeType, categories, channels]);

  const handleToggleHidden = useCallback(() => {
    setShowHidden((prev) => !prev);
  }, []);

  const handleExitSortMode = useCallback(() => {
    setIsSortingMode(false);
  }, []);

  // Memoize handler factories to avoid inline arrows where possible
  const handleOpenInvite = useCallback(() => {
    if (currentServer) openModal("invite", { serverId: currentServer.id });
  }, [currentServer, openModal]);

  const handleOpenServerSettings = useCallback(() => {
    if (isMobile) {
      openServerSettings();
      closeMobileSidebars();
    } else {
      openServerSettingsPage();
    }
  }, [isMobile, openServerSettings, openServerSettingsPage, closeMobileSidebars]);

  const handleOpenCreateChannel = useCallback(() => {
    if (currentServer) openModal("create-channel", { serverId: currentServer.id });
  }, [currentServer, openModal]);

  const handleOpenCreateCategory = useCallback(() => {
    if (currentServer) openModal("create-channel", { serverId: currentServer.id, isCategory: true });
  }, [currentServer, openModal]);

  const handleBgContextMenu = useCallback((e: React.MouseEvent) => {
    if (isMobile && isAdmin && !isSortingMode) {
      e.preventDefault();
      setBgDrawerOpen(true);
    }
  }, [isMobile, isAdmin, isSortingMode]);

  const handleBgDrawerCreateCategory = useCallback(() => {
    setBgDrawerOpen(false);
    if (currentServer) openModal("create-channel", { serverId: currentServer.id, isCategory: true });
  }, [currentServer, openModal]);

  const handleBgDrawerCreateChannel = useCallback(() => {
    setBgDrawerOpen(false);
    if (currentServer) openModal("create-channel", { serverId: currentServer.id });
  }, [currentServer, openModal]);

  const handleBgDrawerSort = useCallback(() => {
    setBgDrawerOpen(false);
    setIsSortingMode(true);
  }, []);

  if (!currentServer) {
    return (
      <div className="h-full flex flex-col bg-layout-sidebar">
        <div className="flex-1 flex flex-col bg-card/50 rounded-2xl border border-border/50 items-center justify-center">
          <div className="text-center animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-secondary/50 flex items-center justify-center">
              <HashIcon className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">Select a server</p>
          </div>
        </div>
      </div>
    );
  }

  const serverBannerUrl = currentServer.banner_url
    ? currentServer.banner_url.includes("blob:")
      ? currentServer.banner_url
      : `${currentServer.banner_url}${currentServer.banner_url.includes("?") ? "&" : "?"}cb=${encodeURIComponent(currentServer.banner_url.split("/").pop()?.split("?")[0] ?? "")}`
    : null;
  const isDefaultServerBanner = !serverBannerUrl || serverBannerUrl.includes("/default_server_banner.png");

  // Shared channel list rendering (used by both mobile and desktop)
  const renderChannelList = (
    <>
      {/* Default sections */}
      <div className="mb-2 ml-1 space-y-0.5">
        <button
          onClick={handleSelectOverview}
          aria-label="Server overview"
          className={cn(
            "group relative w-full flex items-center gap-2 px-2.5 py-1.5 text-sm select-none",
            "leading-5",
            "transition-colors duration-150",
            "hover:bg-foreground/[0.04]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1 rounded-sm",
            isOverviewActive && "bg-foreground/[0.06] text-foreground",
            !isOverviewActive && "text-muted-foreground hover:text-foreground",
          )}
        >
          <div
            className={cn(
              "absolute left-1 top-1.5 bottom-1.5 w-0.5 bg-foreground rounded-full transition-opacity duration-150",
              isOverviewActive ? "opacity-100" : "opacity-0",
            )}
          />
            <div className={SIDEBAR_ITEM_ICON_SLOT}>
              <InfoIcon
                className={cn(
                SIDEBAR_ITEM_ICON,
                )}
              />
            </div>
          <span className="truncate flex-1 text-left leading-5">Overview</span>
        </button>
        {canViewMembersShortcut && (
          <button
            onClick={handleSelectMembersShortcut}
            aria-label="Open members settings"
            className={cn(
              "group relative w-full flex items-center gap-2 px-2.5 py-1.5 text-sm select-none",
              "leading-5",
              "transition-colors duration-150",
              "hover:bg-foreground/[0.04]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1 rounded-sm",
              "text-muted-foreground hover:text-foreground",
            )}
          >
            <div className={SIDEBAR_ITEM_ICON_SLOT}>
              <MembersIcon className={SIDEBAR_ITEM_ICON} />
            </div>
            <span className="truncate flex-1 text-left leading-5">Members</span>
          </button>
        )}
        <div className="mx-2 my-1 h-px bg-border/40" aria-hidden="true" />
      </div>

      <UncategorizedDropZone
        isDragOver={overCategoryId === null && activeType === "channel"}
        hasChannels={uncategorizedChannels.length > 0}
      >
        {uncategorizedChannels.length > 0 && (
          <div className="mb-3 space-y-0.5">
            <SortableContext items={uncategorizedChannels.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              {uncategorizedChannels.map((channel) => {
                const { unreadCount, mentionCount } = getSidebarChannelUnread(channel.id);
                return (
                  <SortableChannel
                    key={channel.id}
                    channel={channel}
                    isActive={currentChannel?.id === channel.id}
                    isUnread={unreadCount > 0}
                    mentionCount={mentionCount}
                    isAdmin={isAdmin}
                    voiceUserIds={voicePresenceByChannel[channel.id]}
                    resolveUser={resolveUser}
                    onSelect={() => handleSelectChannel(channel)}
                    onOpenChat={() => handleOpenVoiceChannelChat(channel)}
                    onEdit={() => openModal("edit-channel", { channelId: channel.id })}
                    onDelete={() => handleDeleteChannel(channel.id)}
                    onCopyLink={() => handleCopyChannelLink(channel.id)}
                    onPrefetch={() => handlePrefetchChannel(channel)}
                    onPrefetchCancel={() => cancelPrefetchChannel(channel.id)}
                    isMobile={isMobile}
                    isDraggingAny={isDraggingAny}
                    isSortingMode={isSortingMode}
                    hasLinkedChat={linkedTextChannelByVoiceId.has(channel.id)}
                    isLinkedChatActive={currentChannel?.linked_voice_channel_id === channel.id}
                  />
                );
              })}
            </SortableContext>
          </div>
        )}
      </UncategorizedDropZone>

      <SortableContext items={sortedCategories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        {sortedCategories.map((category) => (
          <SortableCategory
            key={category.id}
            category={category}
            channels={getChannelsForCategory(category.id)}
            isCollapsed={collapsedCategories.has(category.id)}
            isAdmin={isAdmin}
            currentChannelId={currentChannel?.id}
            getChannelUnread={getSidebarChannelUnread}
            onToggle={() => toggleCategory(category.id)}
            onSelectChannel={handleSelectChannel}
            onOpenChannelChat={handleOpenVoiceChannelChat}
            onAddChannel={() => openModal("create-channel", { categoryId: category.id })}
            onEditChannel={(channelId) => openModal("edit-channel", { channelId })}
            onEditCategory={() => openModal("edit-channel", { isCategory: true, categoryId: category.id })}
            onDeleteCategory={() => handleDeleteCategory(category.id)}
            onDeleteChannel={handleDeleteChannel}
            onCopyChannelLink={handleCopyChannelLink}
            onMarkAsRead={(channelId) => markAsRead(channelId)}
            onPrefetchChannel={handlePrefetchChannel}
            onCancelPrefetchChannel={cancelPrefetchChannel}
            isDragOver={overCategoryId === category.id && activeType === "channel"}
            voicePresenceByChannel={voicePresenceByChannel}
            resolveUser={resolveUser}
            isMobile={isMobile}
            isDraggingAny={isDraggingAny}
            isSortingMode={isSortingMode}
            allCategories={sortedCategories}
            linkedTextChannelByVoiceId={linkedTextChannelByVoiceId}
          />
        ))}
      </SortableContext>

      {hiddenChannels.length > 0 && (
        <div className="mt-4 border-t border-border/30 pt-2">
          <button
            onClick={handleToggleHidden}
            aria-expanded={showHidden}
            aria-label={`Hidden channels, ${hiddenChannels.length} channels${showHidden ? ', expanded' : ', collapsed'}`}
            className="w-full flex items-center gap-1.5 px-2 py-1 text-xs font-normal uppercase text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-sm"
          >
            {showHidden ? <ChevronDownIcon className="w-3 h-3" /> : <ChevronRightIcon className="w-3 h-3" />}
            <EyeOffIcon className="w-3 h-3" />
            <span>Hidden Channels ({hiddenChannels.length})</span>
          </button>
          {showHidden && (
            <div className="mt-1 space-y-0.5 opacity-60">
              {hiddenChannels.map((channel) => {
                const { unreadCount, mentionCount } = getSidebarChannelUnread(channel.id);
                return (
                  <SortableChannel
                    key={channel.id}
                    channel={channel}
                    isActive={currentChannel?.id === channel.id}
                    isUnread={unreadCount > 0}
                    mentionCount={mentionCount}
                    isAdmin={isAdmin}
                    voiceUserIds={voicePresenceByChannel[channel.id]}
                    resolveUser={resolveUser}
                    onSelect={() => handleSelectChannel(channel)}
                    onOpenChat={() => handleOpenVoiceChannelChat(channel)}
                    onEdit={() => openModal("edit-channel", { channelId: channel.id })}
                    onDelete={() => handleDeleteChannel(channel.id)}
                    onCopyLink={() => handleCopyChannelLink(channel.id)}
                    onMarkAsRead={() => markAsRead(channel.id)}
                    onPrefetch={() => handlePrefetchChannel(channel)}
                    onPrefetchCancel={() => cancelPrefetchChannel(channel.id)}
                    isMobile={isMobile}
                    isDraggingAny={isDraggingAny}
                    isSortingMode={isSortingMode}
                    categories={sortedCategories}
                    hasLinkedChat={linkedTextChannelByVoiceId.has(channel.id)}
                    isLinkedChatActive={currentChannel?.linked_voice_channel_id === channel.id}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {(channels || []).length === 0 && (categories || []).length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in">
          <div className="w-12 h-12 rounded-xl bg-secondary/50 flex items-center justify-center mb-3">
            <HashIcon className="w-6 h-6 text-muted-foreground/50" />
          </div>
          <p className="text-sm text-muted-foreground mb-2">No channels yet</p>
          {isAdmin && (
            <Button
              variant="link"
              size="sm"
              onClick={handleOpenCreateChannel}
            >
              Create a channel
            </Button>
          )}
        </div>
      )}
    </>
  );

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Server header with banner */}
        <div className="relative">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="group w-full overflow-hidden text-left transition-colors active:scale-[0.995]">
                <div
                  className={cn(
                    "relative overflow-hidden transition-[height] duration-200 ease-out",
                    isServerHeaderCondensed ? "h-16" : "h-[124px]",
                  )}
                >
                  {serverBannerUrl ? (
                    <img
                      src={serverBannerUrl}
                      alt={`${currentServer.name} banner`}
                      className={cn(
                        "h-full w-full object-cover transition-[filter,transform] duration-200 ease-out",
                        isServerHeaderCondensed ? "scale-150 [filter:blur(32px)]" : "group-hover:scale-[1.02]",
                      )}
                    />
                  ) : (
                    <div
                      className={cn(
                        "h-full w-full bg-[linear-gradient(135deg,hsl(350_42%_23%),hsl(31_31%_25%)_68%,hsl(var(--sidebar)))] transition-[filter,transform] duration-200 ease-out",
                        isServerHeaderCondensed && "scale-150 [filter:blur(32px)]",
                      )}
                    />
                  )}
                  {isServerHeaderCondensed ? (
                    <div className="absolute inset-0 bg-[hsl(var(--sidebar)/0.38)] backdrop-blur-xl" />
                  ) : !isDefaultServerBanner ? (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-[hsl(var(--sidebar)/0.75)]" />
                      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[hsl(var(--sidebar))] via-[hsl(var(--sidebar)/0.76)] to-transparent" />
                    </>
                  ) : (
                    <div className="absolute inset-0 bg-black/10" />
                  )}

                  <div
                    className={cn(
                      "absolute inset-x-0 flex items-center gap-3 px-4 transition-[bottom,padding] duration-200 ease-out",
                      isServerHeaderCondensed ? "bottom-0 py-3" : "bottom-0 pb-3",
                    )}
                  >
                    <h2
                      className={cn(
                        "min-w-0 flex-1 truncate font-semibold leading-tight text-foreground drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)] transition-[font-size] duration-200 ease-out",
                        isServerHeaderCondensed ? "text-[16px]" : "text-[20px]",
                      )}
                    >
                      {currentServer.name}
                    </h2>
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-black/30 text-white/80 backdrop-blur-sm transition-colors group-hover:bg-black/40">
                      <ChevronDownIcon className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[var(--radix-dropdown-menu-trigger-width)] overflow-hidden rounded-md bg-[#4E505C] p-0"
              align="start"
              sideOffset={4}
            >
              {/* Invite People */}
              <DropdownMenuItem
                onClick={handleOpenInvite}
                className="flex items-center gap-2 px-3 py-1.5 rounded-none cursor-pointer transition-colors hover:bg-white/[0.04] focus:bg-white/[0.06]"
              >
                <div className="flex h-5 w-5 items-center justify-center flex-shrink-0">
                  <UserPlusIcon className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">Invite People</span>
              </DropdownMenuItem>

              {canSeeServerSettings && (
                <>
                  <DropdownMenuSeparator className="mx-0 my-0 bg-white/10" />

                  {/* Server Settings */}
                  <DropdownMenuItem
                    onClick={handleOpenServerSettings}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-none cursor-pointer transition-colors hover:bg-white/[0.04] focus:bg-white/[0.06]"
                  >
                    <div className="flex h-5 w-5 items-center justify-center flex-shrink-0">
                      <SettingsIcon className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium">Server Settings</span>
                  </DropdownMenuItem>

                  {canManageChannels && (
                    <>
                      {/* Create Channel */}
                      <DropdownMenuItem
                        onClick={handleOpenCreateChannel}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-none cursor-pointer transition-colors hover:bg-white/[0.04] focus:bg-white/[0.06]"
                      >
                        <div className="flex h-5 w-5 items-center justify-center flex-shrink-0">
                          <HashIcon className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium">Create Channel</span>
                      </DropdownMenuItem>

                      {/* Create Category */}
                      <DropdownMenuItem
                        onClick={handleOpenCreateCategory}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-none cursor-pointer transition-colors hover:bg-white/[0.04] focus:bg-white/[0.06]"
                      >
                        <div className="flex h-5 w-5 items-center justify-center flex-shrink-0">
                          <FolderPlusIcon className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium">Create Category</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </>
              )}

              {!isOwner && (
                <>
                  <DropdownMenuSeparator className="mx-0 my-0 bg-white/10" />

                  {/* Leave Server */}
                  <DropdownMenuItem
                    onClick={handleLeaveServer}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-none cursor-pointer transition-colors hover:bg-white/[0.04] focus:bg-white/[0.06]"
                  >
                    <div className="flex h-5 w-5 items-center justify-center flex-shrink-0">
                      <LogOutIcon className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium">Leave Server</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Sorting Mode Header */}
        {isSortingMode && (
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-transparent border-b border-border/50">
            <div className="flex items-center gap-2">
              <GripVerticalIcon className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Sorting Mode</span>
            </div>
            <Button size="sm" variant="ghost" onClick={handleExitSortMode} className="h-7 px-2 text-xs">
              Done
            </Button>
          </div>
        )}

        {/* Channel list */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {isMobile ? (
            <>
              <div
                className={cn(
                  "flex-1 overflow-y-auto px-2.5 py-5 channel-sidebar-scroll",
                  isSortingMode && "bg-foreground/[0.03] border-2 border-dashed border-border/50 rounded-xl mx-1 my-1",
                )}
                style={{ touchAction: "pan-y" }}
                onContextMenu={handleBgContextMenu}
                onScroll={handleChannelListScroll}
              >
                {renderChannelList}
              </div>

              {/* Mobile background drawer */}
              {isAdmin && (
                <Drawer open={bgDrawerOpen} onOpenChange={setBgDrawerOpen}>
                  <DrawerContent>
                    <DrawerHeader className="pb-2">
                      <DrawerTitle className="text-base font-semibold">Channel Options</DrawerTitle>
                    </DrawerHeader>
                    <div className="px-2 pb-6 space-y-0.5">
                      <button
                        onClick={handleBgDrawerCreateCategory}
                        className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium rounded-lg text-foreground hover:bg-secondary/40 active:bg-secondary/60 transition-colors"
                      >
                        <FolderPlusIcon className="w-4 h-4" />
                        Create Category
                      </button>
                      <button
                        onClick={handleBgDrawerCreateChannel}
                        className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium rounded-lg text-foreground hover:bg-secondary/40 active:bg-secondary/60 transition-colors"
                      >
                        <PlusIcon className="w-4 h-4" />
                        Create Channel
                      </button>
                      <div className="h-px bg-border/50 my-1" />
                      <button
                        onClick={handleBgDrawerSort}
                        className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium rounded-lg text-foreground hover:bg-secondary/40 active:bg-secondary/60 transition-colors"
                      >
                        <ArrowUpDownIcon className="w-4 h-4" />
                        Sort Channels
                      </button>
                    </div>
                  </DrawerContent>
                </Drawer>
              )}
            </>
          ) : (
          <ContextMenu>
            <ContextMenuTrigger asChild disabled={isSortingMode}>
              <div
                className={cn(
                  "flex-1 overflow-y-auto px-2.5 py-5 channel-sidebar-scroll",
                  isSortingMode && "bg-foreground/[0.03] border-2 border-dashed border-border/50 rounded-xl mx-1 my-1",
                )}
                style={{ touchAction: "pan-y" }}
                onScroll={handleChannelListScroll}
              >
                {renderChannelList}
              </div>
            </ContextMenuTrigger>
            {isAdmin && (
              <ContextMenuContent>
                <ContextMenuItem onClick={handleOpenCreateCategory}>
                  <FolderPlusIcon className="w-4 h-4 mr-2" />
                  Create Category
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={handleOpenCreateChannel}>
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Create Channel
                </ContextMenuItem>
              </ContextMenuContent>
            )}
          </ContextMenu>
          )}
          <DragOverlay>{getActiveItem()}</DragOverlay>
        </DndContext>

        {/* Voice and User panels inside the floating card */}
        <VoiceConnectedBanner />
        <LoggedInUserPanel />
      </div>
    </div>
  );
};
