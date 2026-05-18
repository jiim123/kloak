import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  Bold,
  Check,
  CheckSquare,
  ChevronLeft,
  Code,
  Heading1,
  Heading2,
  Image,
  Italic,
  Link,
  List,
  ListOrdered,
  Loader2,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  MoreVertical,
  Pencil,
  Quote,
  Server,
  Share2,
  Strikethrough,
  Trash2,
  Underline,
  UserCircle,
  X,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { UserBadges } from "@/components/ui/user-badges";
import { BotTag } from "@/components/ui/bot-tag";
import { supabase } from "@/integrations/supabase/client";
import { openUserProfileModal, SIDE_ALIGNED_USER_PROFILE_POPOVER } from "@/lib/userProfilePopover";
import { useAuthStore } from "@/stores/authStore";
import { useDMStore } from "@/stores/dmStore";
import { useServerStore } from "@/stores/serverStore";
import { useUIStore } from "@/stores/uiStore";
import { useUserCacheStore } from "@/stores/userCacheStore";
import type { User, UserStatus } from "@/types";
import type { Badge } from "@/types/badge";

const POST_MAX_LENGTH = 1000;
const POST_TITLE_MAX_LENGTH = 120;
const COMMENT_MAX_LENGTH = 500;
const TAGLINE_MAX_LENGTH = 80;
const quickReactionEmojis = ["👍", "❤️", "😂", "🎉", "😮"];

type ComposerAction =
  | "bold"
  | "underline"
  | "italic"
  | "strikethrough"
  | "image"
  | "inlineCode"
  | "link"
  | "check"
  | "bullet"
  | "numbered"
  | "h1"
  | "h2"
  | "quote"
  | "codeBlock"
  | "divider";

const composerTools: Array<{ action: ComposerAction; label: string; icon: typeof Bold }> = [
  { action: "bold", label: "Bold", icon: Bold },
  { action: "underline", label: "Underline", icon: Underline },
  { action: "italic", label: "Italic", icon: Italic },
  { action: "strikethrough", label: "Strikethrough", icon: Strikethrough },
  { action: "image", label: "Image", icon: Image },
  { action: "inlineCode", label: "Inline code", icon: Code },
  { action: "link", label: "Link", icon: Link },
  { action: "image", label: "Image", icon: Image },
  { action: "check", label: "Checklist", icon: CheckSquare },
  { action: "bullet", label: "Bulleted list", icon: List },
  { action: "numbered", label: "Numbered list", icon: ListOrdered },
  { action: "h1", label: "Heading 1", icon: Heading1 },
  { action: "h2", label: "Heading 2", icon: Heading2 },
  { action: "quote", label: "Quote", icon: Quote },
  { action: "codeBlock", label: "Code block", icon: Code },
  { action: "divider", label: "Divider", icon: MoreVertical },
];

const JoinedSectionIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M20.8894 13V14H20.0194C19.2794 14 18.6794 14.6 18.6794 15.35V15.65C18.6794 16.4 18.0794 17 17.3294 17C16.5894 17 15.9894 16.4 15.9894 15.65V15.35C15.9894 14.6 15.3794 14 14.6394 14C13.8994 14 13.2994 14.6 13.2994 15.35V15.65C13.2994 16.4 12.6894 17 11.9494 17C11.2094 17 10.5994 16.4 10.5994 15.65V15.35C10.5994 14.6 9.99938 14 9.25938 14C8.51938 14 7.90938 14.6 7.90938 15.35V15.65C7.90938 16.4 7.30938 17 6.56938 17C5.81938 17 5.21937 16.4 5.21937 15.65V15.33C5.21937 14.59 4.62938 13.99 3.89938 13.98H3.10938V13C3.10938 11.62 4.14938 10.45 5.55938 10.11C5.83938 10.04 6.12938 10 6.43938 10H17.5594C17.8694 10 18.1594 10.04 18.4394 10.11C19.8494 10.45 20.8894 11.62 20.8894 13Z"
      fill="currentColor"
    />
    <path
      d="M18.4405 7.17V8.58C18.1505 8.52 17.8605 8.5 17.5605 8.5H6.44055C6.14055 8.5 5.85055 8.53 5.56055 8.59V7.17C5.56055 5.97 6.64055 5 7.98055 5H16.0205C17.3605 5 18.4405 5.97 18.4405 7.17Z"
      fill="currentColor"
    />
    <path d="M8.75 3.54844V5.00844H7.98C7.72 5.00844 7.48 5.03844 7.25 5.09844V3.54844C7.25 3.19844 7.59 2.89844 8 2.89844C8.41 2.89844 8.75 3.19844 8.75 3.54844Z" fill="currentColor" />
    <path d="M16.75 3.32812V5.09812C16.52 5.02813 16.28 4.99813 16.02 4.99813H15.25V3.32812C15.25 2.91813 15.59 2.57812 16 2.57812C16.41 2.57812 16.75 2.91813 16.75 3.32812Z" fill="currentColor" />
    <path d="M12.75 2.82V5H11.25V2.82C11.25 2.37 11.59 2 12 2C12.41 2 12.75 2.37 12.75 2.82Z" fill="currentColor" />
    <path
      d="M22 21.2505C22 21.6605 21.66 22.0005 21.25 22.0005H2.75C2.34 22.0005 2 21.6605 2 21.2505C2 20.8405 2.34 20.5005 2.75 20.5005H3.11V15.4805H3.72V15.5505C3.72 16.8905 4.6 18.1305 5.91 18.4205C6.93 18.6605 7.9 18.3305 8.56 17.6805C8.94 17.3005 9.56 17.2905 9.94 17.6705C10.46 18.1805 11.17 18.5005 11.95 18.5005C12.73 18.5005 13.44 18.1905 13.96 17.6705C14.34 17.3005 14.95 17.3005 15.34 17.6805C15.99 18.3305 16.96 18.6605 17.99 18.4205C19.3 18.1305 20.18 16.8905 20.18 15.5505V15.5005H20.89V20.5005H21.25C21.66 20.5005 22 20.8405 22 21.2505Z"
      fill="currentColor"
    />
  </svg>
);

interface ProfilePost {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  reactions: ProfileReaction[];
  comments: ProfileComment[];
  comment_count: number;
  user?: User | null;
}

interface ProfileReaction {
  emoji: string;
  count: number;
  users: string[];
  hasReacted: boolean;
}

interface ProfileComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user?: User | null;
}

const toProfileUser = (raw: any): User => ({
  id: raw.id,
  username: raw.username,
  display_name: raw.display_name,
  avatar_url: raw.avatar_url,
  banner_url: raw.banner_url ?? null,
  avatar_decoration: raw.avatar_decoration,
  profile_effect: raw.profile_effect ?? null,
  banner_color: raw.banner_color || "#5865F2",
  profile_theme_primary: raw.profile_theme_primary ?? null,
  profile_theme_accent: raw.profile_theme_accent ?? null,
  bio: raw.bio,
  tagline: raw.tagline ?? null,
  status: raw.status as UserStatus,
  custom_status: raw.custom_status,
  created_at: raw.created_at,
  last_seen: raw.last_seen,
  pronouns: raw.pronouns ?? null,
  is_bot: raw.is_bot ?? false,
});

const mapPost = (raw: any): ProfilePost => ({
  id: raw.id,
  user_id: raw.user_id,
  title: raw.title || "Untitled",
  content: raw.content,
  created_at: raw.created_at,
  updated_at: raw.updated_at,
  reactions: (Array.isArray(raw.reactions) ? raw.reactions : []).map((reaction: any) => ({
    emoji: reaction.emoji,
    count: Number(reaction.count || 0),
    users: Array.isArray(reaction.users) ? reaction.users : [],
    hasReacted: Boolean(reaction.has_reacted ?? reaction.hasReacted),
  })),
  comments: (Array.isArray(raw.comments) ? raw.comments : []).map((comment: any) => ({
    id: comment.id,
    post_id: comment.post_id,
    user_id: comment.user_id,
    content: comment.content,
    created_at: comment.created_at,
    updated_at: comment.updated_at,
    user: comment.user ? toProfileUser(comment.user) : null,
  })),
  comment_count: Number(raw.comment_count || 0),
  user: raw.user ? toProfileUser(raw.user) : null,
});

const getInitials = (value: string) => value.slice(0, 2).toUpperCase();

const escapeMarkdownText = (value: string) => value.replace(/\u00a0/g, " ");

const nodeTextToMarkdown = (node: Node): string => {
  if (node.nodeType === Node.TEXT_NODE) return escapeMarkdownText(node.textContent || "");
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const element = node as HTMLElement;
  const tagName = element.tagName.toLowerCase();
  const children = Array.from(element.childNodes).map(nodeTextToMarkdown).join("");
  const block = children.replace(/\n+$/g, "");

  switch (tagName) {
    case "br":
      return "\n";
    case "strong":
    case "b":
      return `**${children}**`;
    case "em":
    case "i":
      return `*${children}*`;
    case "u":
      return `__${children}__`;
    case "s":
    case "strike":
    case "del":
      return `~~${children}~~`;
    case "code":
      return `\`${children}\``;
    case "pre":
      return `\`\`\`\n${element.textContent || ""}\n\`\`\`\n`;
    case "h1":
      return `# ${block}\n`;
    case "h2":
      return `## ${block}\n`;
    case "blockquote":
      return `${block
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n")}\n`;
    case "li": {
      const parent = element.parentElement?.tagName.toLowerCase();
      const index = parent === "ol" ? Array.from(element.parentElement?.children || []).indexOf(element) + 1 : 0;
      return `${parent === "ol" ? `${index}. ` : "- "}${block}\n`;
    }
    case "a": {
      const href = element.getAttribute("href") || "";
      return href ? `[${children || href}](${href})` : children;
    }
    case "img": {
      const src = element.getAttribute("src") || "";
      const alt = element.getAttribute("alt") || "image";
      return src ? `![${alt}](${src})` : "";
    }
    case "div":
    case "p":
      return `${block}\n`;
    default:
      return children;
  }
};

const htmlToMarkdown = (html: string): string => {
  const container = document.createElement("div");
  container.innerHTML = html;
  return Array.from(container.childNodes).map(nodeTextToMarkdown).join("").replace(/\n{3,}/g, "\n\n").trim();
};

const formatInlineMarkdown = (text: string): React.ReactNode[] => {
  const nodes: React.ReactNode[] = [];
  const pattern = /(!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|~~([^~]+)~~|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const key = `${match.index}-${match[0]}`;

    if (match[2] !== undefined && match[3]) {
      nodes.push(<img key={key} src={match[3]} alt={match[2] || "Image"} className="my-2 max-h-80 max-w-full rounded-[6px] object-contain" loading="lazy" />);
    } else if (match[4] !== undefined && match[5]) {
      nodes.push(
        <a key={key} href={match[5]} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
          {match[4]}
        </a>,
      );
    } else if (match[6] !== undefined) {
      nodes.push(<strong key={key}>{match[6]}</strong>);
    } else if (match[7] !== undefined) {
      nodes.push(<u key={key}>{match[7]}</u>);
    } else if (match[8] !== undefined) {
      nodes.push(<em key={key}>{match[8]}</em>);
    } else if (match[9] !== undefined) {
      nodes.push(<del key={key}>{match[9]}</del>);
    } else if (match[10] !== undefined) {
      nodes.push(
        <code key={key} className="rounded bg-black/30 px-1 py-0.5 text-[0.9em]">
          {match[10]}
        </code>,
      );
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
};

const ProfileMarkdown = ({ content }: { content: string }) => {
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const key = `${index}-${line}`;

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.trim() === "---") {
      blocks.push(<div key={key} className="my-4 text-center text-lg tracking-[0.35rem] text-muted-foreground">...</div>);
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      blocks.push(
        <pre key={key} className="my-3 overflow-x-auto rounded-[6px] bg-black/30 p-3 text-xs leading-5">
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      index += 1;
      continue;
    }

    if (line.startsWith("# ")) {
      blocks.push(<h1 key={key} className="mt-3 text-xl font-bold">{formatInlineMarkdown(line.slice(2))}</h1>);
      index += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push(<h2 key={key} className="mt-3 text-lg font-bold">{formatInlineMarkdown(line.slice(3))}</h2>);
      index += 1;
      continue;
    }

    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].startsWith("> ")) {
        quoteLines.push(lines[index].slice(2));
        index += 1;
      }
      blocks.push(
        <blockquote key={key} className="my-3 border-l-4 border-border pl-3 text-muted-foreground">
          {quoteLines.map((quoteLine, quoteIndex) => (
            <Fragment key={`${key}-${quoteIndex}`}>
              {formatInlineMarkdown(quoteLine)}
              {quoteIndex < quoteLines.length - 1 && <br />}
            </Fragment>
          ))}
        </blockquote>,
      );
      continue;
    }

    if (/^(- |\d+\. |- \[ \] )/.test(line)) {
      const listLines: string[] = [];
      const ordered = /^\d+\. /.test(line);
      while (index < lines.length && (ordered ? /^\d+\. /.test(lines[index]) : /^(- |- \[ \] )/.test(lines[index]))) {
        listLines.push(lines[index]);
        index += 1;
      }
      const ListTag = ordered ? "ol" : "ul";
      blocks.push(
        <ListTag key={key} className={`my-3 space-y-1 pl-5 ${ordered ? "list-decimal" : "list-disc"}`}>
          {listLines.map((item, itemIndex) => {
            const checklist = item.startsWith("- [ ] ");
            const text = item.replace(/^\d+\. /, "").replace(/^- \[ \] /, "").replace(/^- /, "");
            return (
              <li key={`${key}-${itemIndex}`} className={checklist ? "list-none" : undefined}>
                {checklist && <span className="mr-2 inline-flex h-3 w-3 rounded-[2px] border border-muted-foreground align-[-1px]" />}
                {formatInlineMarkdown(text)}
              </li>
            );
          })}
        </ListTag>,
      );
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].startsWith("# ") &&
      !lines[index].startsWith("## ") &&
      !lines[index].startsWith("> ") &&
      !lines[index].startsWith("```") &&
      lines[index].trim() !== "---" &&
      !/^(- |\d+\. |- \[ \] )/.test(lines[index])
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }

    blocks.push(
      <p key={key} className="whitespace-pre-wrap break-words">
        {paragraphLines.map((paragraphLine, paragraphIndex) => (
          <Fragment key={`${key}-${paragraphIndex}`}>
            {formatInlineMarkdown(paragraphLine)}
            {paragraphIndex < paragraphLines.length - 1 && <br />}
          </Fragment>
        ))}
      </p>,
    );
  }

  return <div className="space-y-2 text-sm leading-6">{blocks}</div>;
};

const UserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const servers = useServerStore((s) => s.servers);
  const { openConversation, setCurrentConversation } = useDMStore();
  const setCurrentServer = useServerStore((s) => s.setCurrentServer);
  const openModal = useUIStore((s) => s.openModal);
  const richBodyRef = useRef<HTMLDivElement | null>(null);

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [sharedServerIds, setSharedServerIds] = useState<string[]>([]);
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [titleDraft, setTitleDraft] = useState("");
  const [draft, setDraft] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentEditDrafts, setCommentEditDrafts] = useState<Record<string, string>>({});
  const [expandedCommentPostIds, setExpandedCommentPostIds] = useState<Set<string>>(new Set());
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [taglineDraft, setTaglineDraft] = useState("");
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isEditingTagline, setIsEditingTagline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [pendingCommentPostId, setPendingCommentPostId] = useState<string | null>(null);
  const [pendingCommentActionId, setPendingCommentActionId] = useState<string | null>(null);
  const [pendingReactionKey, setPendingReactionKey] = useState<string | null>(null);
  const [isSavingTagline, setIsSavingTagline] = useState(false);

  const serverIds = useMemo(() => servers.map((server) => server.id), [servers]);
  const isSelf = currentUser?.id === userId;

  const fetchProfile = useCallback(async () => {
    if (!currentUser?.id || !userId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc("profile", {
        _target_user_id: userId,
        _requesting_user_id: currentUser.id,
        _server_ids: serverIds,
      });

      if (error) throw error;
      const payload = data as any;
      if (!payload?.user) throw new Error("Profile not found");

      const nextUser = toProfileUser(payload.user);
      setProfileUser(nextUser);
      setBadges((Array.isArray(payload.badges) ? payload.badges : []) as Badge[]);
      setSharedServerIds((Array.isArray(payload.shared_server_ids) ? payload.shared_server_ids : []) as string[]);
      setPosts((Array.isArray(payload.posts) ? payload.posts : []).map(mapPost));
      useUserCacheStore.getState().upsertUser(nextUser);
    } catch (error) {
      console.error("Failed to load profile page:", error);
      toast.error("Failed to load profile");
      setProfileUser(null);
      setBadges([]);
      setSharedServerIds([]);
      setPosts([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id, serverIds, userId]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    setTaglineDraft(profileUser?.tagline ?? "");
  }, [profileUser?.tagline]);

  const sharedServers = useMemo(() => {
    const ids = new Set(sharedServerIds);
    return servers.filter((server) => ids.has(server.id));
  }, [servers, sharedServerIds]);

  const handleMessage = useCallback(async () => {
    if (!currentUser || !userId || currentUser.id === userId) return;

    try {
      const conversation = await openConversation(currentUser.id, userId);
      if (!conversation) {
        toast.error("You can't message this user");
        return;
      }

      setCurrentServer(null);
      setCurrentConversation(conversation);
      navigate(`/app?conversation=${conversation.id}`, { replace: true });
    } catch {
      toast.error("Failed to open conversation");
    }
  }, [currentUser, navigate, openConversation, setCurrentConversation, setCurrentServer, userId]);

  const handleOpenUserPopup = useCallback(
    (targetUserId: string, anchor: HTMLElement) => {
      openUserProfileModal(openModal, targetUserId, anchor, SIDE_ALIGNED_USER_PROFILE_POPOVER);
    },
    [openModal],
  );

  const handleCreatePost = useCallback(async () => {
    if (!currentUser?.id || !isSelf) return;
    const title = titleDraft.trim();
    const content = draft.trim();
    if (!title || !content) return;
    if (title.length > POST_TITLE_MAX_LENGTH) {
      toast.error(`Post titles must be ${POST_TITLE_MAX_LENGTH} characters or fewer`);
      return;
    }
    if (content.length > POST_MAX_LENGTH) {
      toast.error(`Posts must be ${POST_MAX_LENGTH} characters or fewer`);
      return;
    }

    setIsPosting(true);
    try {
      const { data, error } = await supabase.rpc("create_profile_post" as any, {
        _user_id: currentUser.id,
        _title: title,
        _content: content,
      });
      if (error) throw error;
      setPosts((prev) => [mapPost(data), ...prev]);
      setTitleDraft("");
      setDraft("");
      setIsComposerOpen(false);
      if (richBodyRef.current) richBodyRef.current.innerHTML = "";
    } catch (error: any) {
      toast.error(error?.message || "Failed to create post");
    } finally {
      setIsPosting(false);
    }
  }, [currentUser?.id, draft, isSelf, titleDraft]);

  const syncRichDraft = useCallback(() => {
    const nextDraft = htmlToMarkdown(richBodyRef.current?.innerHTML || "").slice(0, POST_MAX_LENGTH);
    setDraft(nextDraft);
  }, []);

  const runEditorCommand = useCallback(
    (command: string, value?: string) => {
      richBodyRef.current?.focus();
      document.execCommand(command, false, value);
      syncRichDraft();
    },
    [syncRichDraft],
  );

  const insertHtml = useCallback(
    (html: string) => {
      richBodyRef.current?.focus();
      document.execCommand("insertHTML", false, html);
      syncRichDraft();
    },
    [syncRichDraft],
  );

  const handleComposerAction = useCallback(
    (action: ComposerAction) => {
      switch (action) {
        case "bold":
          runEditorCommand("bold");
          break;
        case "underline":
          runEditorCommand("underline");
          break;
        case "italic":
          runEditorCommand("italic");
          break;
        case "strikethrough":
          runEditorCommand("strikeThrough");
          break;
        case "inlineCode":
          insertHtml("<code>code</code>");
          break;
        case "link": {
          const url = window.prompt("Enter link URL");
          if (!url) return;
          runEditorCommand("createLink", url);
          break;
        }
        case "image": {
          const url = window.prompt("Enter image URL");
          if (!url) return;
          insertHtml(`<img src="${url.replace(/"/g, "&quot;")}" alt="Image" />`);
          break;
        }
        case "check":
          insertHtml('<ul><li><span data-check-placeholder="true">[ ] </span>Task</li></ul>');
          break;
        case "bullet":
          runEditorCommand("insertUnorderedList");
          break;
        case "numbered":
          runEditorCommand("insertOrderedList");
          break;
        case "h1":
          runEditorCommand("formatBlock", "h1");
          break;
        case "h2":
          runEditorCommand("formatBlock", "h2");
          break;
        case "quote":
          runEditorCommand("formatBlock", "blockquote");
          break;
        case "codeBlock":
          insertHtml("<pre><code>code</code></pre>");
          break;
        case "divider": {
          insertHtml("<div>---</div>");
          break;
        }
      }
    },
    [insertHtml, runEditorCommand],
  );

  const handleSaveTagline = useCallback(async () => {
    if (!isSelf || !profileUser) return;
    const nextTagline = taglineDraft.trim();
    if (nextTagline.length > TAGLINE_MAX_LENGTH) {
      toast.error(`Tagline must be ${TAGLINE_MAX_LENGTH} characters or fewer`);
      return;
    }

    setIsSavingTagline(true);
    try {
      await updateUser({ tagline: nextTagline || null });
      setProfileUser((prev) => (prev ? { ...prev, tagline: nextTagline || null } : prev));
      setIsEditingTagline(false);
    } catch {
      toast.error("Failed to update tagline");
    } finally {
      setIsSavingTagline(false);
    }
  }, [isSelf, profileUser, taglineDraft, updateUser]);

  const handleDeletePost = useCallback(
    async (postId: string) => {
      if (!currentUser?.id || !isSelf) return;
      try {
        const { error } = await supabase.rpc("delete_profile_post" as any, {
          _user_id: currentUser.id,
          _post_id: postId,
        });
        if (error) throw error;
        setPosts((prev) => prev.filter((post) => post.id !== postId));
      } catch (error: any) {
        toast.error(error?.message || "Failed to delete post");
      }
    },
    [currentUser?.id, isSelf],
  );

  const handleToggleReaction = useCallback(
    async (postId: string, emoji: string) => {
      if (!currentUser?.id) return;
      const key = `${postId}:${emoji}`;
      setPendingReactionKey(key);
      try {
        const { data, error } = await supabase.rpc("toggle_profile_post_reaction" as any, {
          _post_id: postId,
          _user_id: currentUser.id,
          _emoji: emoji,
        });
        if (error) throw error;
        const reactions = (Array.isArray(data) ? data : []).map((reaction: any) => ({
          emoji: reaction.emoji,
          count: Number(reaction.count || 0),
          users: Array.isArray(reaction.users) ? reaction.users : [],
          hasReacted: Boolean(reaction.has_reacted),
        }));
        setPosts((prev) => prev.map((post) => (post.id === postId ? { ...post, reactions } : post)));
      } catch (error: any) {
        toast.error(error?.message || "Failed to update reaction");
      } finally {
        setPendingReactionKey(null);
      }
    },
    [currentUser?.id],
  );

  const handleCreateComment = useCallback(
    async (postId: string) => {
      if (!currentUser?.id) return;
      const content = (commentDrafts[postId] || "").trim();
      if (!content) return;
      if (content.length > COMMENT_MAX_LENGTH) {
        toast.error(`Comments must be ${COMMENT_MAX_LENGTH} characters or fewer`);
        return;
      }

      setPendingCommentPostId(postId);
      try {
        const { data, error } = await supabase.rpc("create_profile_post_comment" as any, {
          _post_id: postId,
          _user_id: currentUser.id,
          _content: content,
        });
        if (error) throw error;
        const nextComment: ProfileComment = {
          id: data.id,
          post_id: data.post_id,
          user_id: data.user_id,
          content: data.content,
          created_at: data.created_at,
          updated_at: data.updated_at,
          user: data.user ? toProfileUser(data.user) : currentUser,
        };
        setPosts((prev) =>
          prev.map((post) =>
            post.id === postId
              ? { ...post, comments: [...post.comments, nextComment].slice(-5), comment_count: post.comment_count + 1 }
              : post,
          ),
        );
        setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
      } catch (error: any) {
        toast.error(error?.message || "Failed to add comment");
      } finally {
        setPendingCommentPostId(null);
      }
    },
    [commentDrafts, currentUser],
  );

  const handleStartEditComment = useCallback((comment: ProfileComment) => {
    setEditingCommentId(comment.id);
    setCommentEditDrafts((prev) => ({ ...prev, [comment.id]: comment.content }));
  }, []);

  const handleCancelEditComment = useCallback((commentId: string) => {
    setEditingCommentId(null);
    setCommentEditDrafts((prev) => {
      const next = { ...prev };
      delete next[commentId];
      return next;
    });
  }, []);

  const handleSaveCommentEdit = useCallback(
    async (commentId: string) => {
      if (!currentUser?.id) return;
      const content = (commentEditDrafts[commentId] || "").trim();
      if (!content) return;
      if (content.length > COMMENT_MAX_LENGTH) {
        toast.error(`Comments must be ${COMMENT_MAX_LENGTH} characters or fewer`);
        return;
      }

      setPendingCommentActionId(commentId);
      try {
        const { data, error } = await supabase.rpc("edit_profile_post_comment" as any, {
          _comment_id: commentId,
          _user_id: currentUser.id,
          _content: content,
        });
        if (error) throw error;
        setPosts((prev) =>
          prev.map((post) => ({
            ...post,
            comments: post.comments.map((comment) =>
              comment.id === commentId
                ? { ...comment, content: data.content, updated_at: data.updated_at || comment.updated_at }
                : comment,
            ),
          })),
        );
        handleCancelEditComment(commentId);
      } catch (error: any) {
        toast.error(error?.message || "Failed to edit comment");
      } finally {
        setPendingCommentActionId(null);
      }
    },
    [commentEditDrafts, currentUser?.id, handleCancelEditComment],
  );

  const handleDeleteComment = useCallback(
    async (postId: string, commentId: string) => {
      if (!currentUser?.id) return;
      setPendingCommentActionId(commentId);
      try {
        const { error } = await supabase.rpc("delete_profile_post_comment" as any, {
          _comment_id: commentId,
          _user_id: currentUser.id,
        });
        if (error) throw error;
        setPosts((prev) =>
          prev.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  comments: post.comments.filter((comment) => comment.id !== commentId),
                  comment_count: Math.max(0, post.comment_count - 1),
                }
              : post,
          ),
        );
        if (editingCommentId === commentId) handleCancelEditComment(commentId);
      } catch (error: any) {
        toast.error(error?.message || "Failed to delete comment");
      } finally {
        setPendingCommentActionId(null);
      }
    },
    [currentUser?.id, editingCommentId, handleCancelEditComment],
  );

  const toggleComments = useCallback((postId: string) => {
    setExpandedCommentPostIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  }, []);

  const getReactionUserNames = useCallback(
    (post: ProfilePost, reaction: ProfileReaction) =>
      reaction.users.map((reactorId) => {
        if (reactorId === currentUser?.id) return "You";
        if (reactorId === post.user_id) return post.user?.display_name || profileUser?.display_name || post.user?.username || profileUser?.username || "Profile owner";
        const commentUser = post.comments.find((comment) => comment.user_id === reactorId)?.user;
        return commentUser?.display_name || commentUser?.username || "Someone";
      }),
    [currentUser?.id, profileUser?.display_name, profileUser?.username],
  );

  const handleSharePost = useCallback(
    async (post: ProfilePost) => {
      const profilePath = `/app/profiles/${post.user_id}`;
      const link = `${window.location.origin}${profilePath}?post=${post.id}`;
      const shareText = `${post.title}\n${link}`;

      try {
        if (navigator.share) {
          await navigator.share({ title: post.title, text: post.title, url: link });
        } else {
          await navigator.clipboard.writeText(shareText);
          toast.success("Post link copied");
        }
      } catch (error: any) {
        if (error?.name !== "AbortError") toast.error("Failed to share post");
      }
    },
    [],
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-layout-chat text-muted-foreground">
        <div className="flex items-center gap-3 text-sm font-medium">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading profile...
        </div>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="flex h-full items-center justify-center bg-layout-chat px-6 text-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Profile not found</h1>
          <Button className="mt-4" variant="secondary" onClick={() => navigate("/app")}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  const displayName = profileUser.display_name || profileUser.username;
  const joinedAt = profileUser.created_at ? format(new Date(profileUser.created_at), "MMM d, yyyy") : "Unknown";
  const bannerStyle = profileUser.banner_url
    ? {
        backgroundColor: "hsl(var(--chat))",
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.1), hsl(var(--chat))), url(${profileUser.banner_url})`,
      }
    : {
        background: `linear-gradient(135deg, ${profileUser.profile_theme_primary || profileUser.banner_color} 0%, ${
          profileUser.profile_theme_accent || "hsl(var(--muted))"
        } 100%)`,
      };

  return (
    <div className="h-full overflow-y-auto bg-layout-chat text-foreground">
      <header className="sticky top-0 z-20 flex h-12 items-center gap-2.5 border-b border-[#23262f] bg-[#343844] px-3 text-white shadow-sm">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-[4px] text-[#c7ccd6] transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <svg className="h-[20px] w-[20px] shrink-0 text-[#c7ccd6]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12.12 12.78C12.05 12.77 11.96 12.77 11.88 12.78C10.12 12.72 8.71997 11.28 8.71997 9.50998C8.71997 7.69998 10.18 6.22998 12 6.22998C13.81 6.22998 15.28 7.69998 15.28 9.50998C15.27 11.28 13.88 12.72 12.12 12.78Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M18.74 19.3801C16.96 21.0101 14.6 22.0001 12 22.0001C9.40001 22.0001 7.04001 21.0101 5.26001 19.3801C5.36001 18.4401 5.96001 17.5201 7.03001 16.8001C9.77001 14.9801 14.25 14.9801 16.97 16.8001C18.04 17.5201 18.64 18.4401 18.74 19.3801Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="truncate text-[14px] font-semibold leading-none">{displayName}</span>
      </header>
      <section className="relative h-[164px] overflow-hidden bg-cover bg-center sm:h-[210px]" style={bannerStyle} />

      <div className="mx-auto min-h-full max-w-[1180px] px-4 pb-10 sm:px-6">
        <section className="relative -mt-16 flex flex-col items-center text-center">
          <div className="relative">
            <AvatarWithDecoration user={profileUser} active className="h-[104px] w-[104px] rounded-full ring-8 ring-[hsl(var(--chat))]" />
          </div>

          <div className="mt-3 flex max-w-full items-center justify-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-normal">{displayName}</h1>
            {profileUser.is_bot && <BotTag />}
            {badges.length > 0 && <UserBadges badges={badges} />}
          </div>
          <p className="mt-1 text-sm font-medium text-muted-foreground">@{profileUser.username}</p>
          {isSelf ? (
            <div className="mt-2 flex w-full max-w-[560px] items-center justify-center gap-2 px-2">
              {isEditingTagline ? (
                <div className="flex w-full items-center gap-2">
                  <input
                    value={taglineDraft}
                    onChange={(event) => setTaglineDraft(event.target.value.slice(0, TAGLINE_MAX_LENGTH))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void handleSaveTagline();
                      if (event.key === "Escape") {
                        setTaglineDraft(profileUser.tagline ?? "");
                        setIsEditingTagline(false);
                      }
                    }}
                    className="h-9 min-w-0 flex-1 rounded-[6px] border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Add a tagline"
                    maxLength={TAGLINE_MAX_LENGTH}
                    autoFocus
                  />
                  <Button size="icon-sm" variant="ghost" onClick={() => void handleSaveTagline()} loading={isSavingTagline} aria-label="Save tagline">
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => {
                      setTaglineDraft(profileUser.tagline ?? "");
                      setIsEditingTagline(false);
                    }}
                    aria-label="Cancel tagline edit"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingTagline(true)}
                  className="flex max-w-full items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80"
                >
                  <span className="break-words">{profileUser.tagline || "Add a tagline"}</span>
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          ) : profileUser.tagline ? (
            <p className="mt-2 max-w-[540px] break-words text-sm font-medium">{profileUser.tagline}</p>
          ) : null}

          {!isSelf && (
            <Button type="button" onClick={handleMessage} className="mt-4" variant="white" size="default">
              <MessageCircle className="h-4 w-4" />
              Message
            </Button>
          )}
        </section>

        <section className={`mt-8 grid gap-5 ${isSelf ? "lg:grid-cols-[minmax(0,1fr)_240px]" : "lg:grid-cols-[220px_minmax(0,1fr)_240px]"}`}>
          {!isSelf && (
            <aside>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mutual Servers</h2>
              <div className="space-y-2">
                {sharedServers.length > 0 ? (
                  sharedServers.map((server) => (
                    <div key={server.id} className="flex items-center gap-3 rounded-[6px] bg-secondary/60 p-2">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-muted text-xs font-semibold">
                        {server.icon_url ? <img src={server.icon_url} alt="" className="h-full w-full object-cover" /> : getInitials(server.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{server.name}</p>
                        <p className="text-xs text-muted-foreground">Shared server</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[6px] border border-dashed border-border p-4 text-sm text-muted-foreground">No shared servers to show.</div>
                )}
              </div>
            </aside>
          )}

          <section className="min-w-0">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Feed</h2>
            </div>

            {isSelf && (
              <div className="mb-4">
                {!isComposerOpen ? (
                  <button
                    type="button"
                    onClick={() => setIsComposerOpen(true)}
                    className="flex h-[62px] w-full items-center rounded-[4px] bg-[#555965] px-4 text-left shadow-sm transition-colors hover:bg-[#5b5f6c]"
                  >
                    <AvatarWithDecoration user={profileUser} className="h-9 w-9 shrink-0" />
                    <span className="mx-4 h-9 w-px bg-[#686d79]" />
                    <span className="text-[18px] font-semibold text-[#c3c7d0]">Write a Post</span>
                  </button>
                ) : (
                  <>
                    <div className="overflow-hidden rounded-[4px] border border-white/5 bg-[#4f535f] shadow-sm">
                      <div className="flex items-center gap-3 px-3 pt-3">
                        <AvatarWithDecoration user={profileUser} className="h-8 w-8 shrink-0" />
                        <input
                          value={titleDraft}
                          onChange={(event) => setTitleDraft(event.target.value.slice(0, POST_TITLE_MAX_LENGTH))}
                          placeholder="Post title"
                          className="min-w-0 flex-1 bg-transparent text-[18px] font-extrabold leading-none text-white outline-none placeholder:text-[#c0c5ce]"
                          maxLength={POST_TITLE_MAX_LENGTH}
                          autoFocus
                        />
                      </div>

                      <div className="mt-3 flex h-8 items-center gap-1 overflow-hidden border-y border-[#454955] px-3 text-[#c0c5ce]">
                        {composerTools.map(({ action, label, icon: Icon }, index) => (
                          <button
                            key={`${action}-${index}`}
                            type="button"
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] text-[#c0c5ce] transition-colors hover:bg-white/10 hover:text-white"
                            onClick={() => handleComposerAction(action)}
                            aria-label={label}
                            title={label}
                          >
                            <Icon className="h-4 w-4" />
                          </button>
                        ))}
                      </div>

                      <div className="relative min-h-[96px]">
                        {!draft && <div className="pointer-events-none absolute left-4 top-3 text-[13px] text-[#a2a7b0]">What do you want to post?</div>}
                        <div
                          ref={richBodyRef}
                          contentEditable
                          suppressContentEditableWarning
                          onInput={syncRichDraft}
                          onBlur={syncRichDraft}
                          className="profile-rich-editor min-h-[96px] w-full px-4 py-3 text-[13px] leading-6 text-[#f2f3f5] outline-none [&_blockquote]:border-l-4 [&_blockquote]:border-[#727782] [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-black/30 [&_code]:px-1 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-bold [&_img]:my-2 [&_img]:max-h-80 [&_img]:max-w-full [&_img]:rounded-[6px] [&_li]:ml-5 [&_ol]:list-decimal [&_pre]:rounded [&_pre]:bg-black/30 [&_pre]:p-3 [&_ul]:list-disc"
                          role="textbox"
                          aria-multiline="true"
                          aria-label="Post body"
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-end gap-3">
                      <button
                        type="button"
                        className="h-8 rounded-[4px] px-3 text-[13px] font-medium text-[#b9bec8] transition-colors hover:text-white disabled:opacity-50"
                        onClick={() => {
                          setTitleDraft("");
                          setDraft("");
                          setIsComposerOpen(false);
                          if (richBodyRef.current) richBodyRef.current.innerHTML = "";
                        }}
                        disabled={isPosting}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="h-8 min-w-[72px] rounded-[4px] bg-[#d7d9df] px-4 text-[13px] font-semibold text-[#2f3136] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => void handleCreatePost()}
                        disabled={!titleDraft.trim() || !draft.trim() || isPosting}
                      >
                        {isPosting ? "Posting" : "Post"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="space-y-3">
              {posts.length > 0 ? (
                posts.map((post) => (
                  <article key={post.id} className="group rounded-[6px] border border-border bg-secondary/40 p-4">
                    <div className="flex items-center gap-3">
                      <AvatarWithDecoration user={post.user || profileUser} className="h-10 w-10 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={(event) => handleOpenUserPopup(post.user_id, event.currentTarget)}
                            className="truncate text-sm font-semibold hover:underline"
                          >
                            {displayName}
                          </button>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="ghost" size="icon-sm" aria-label="Post actions">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[160px] overflow-hidden rounded-md bg-[#4E505C] p-0">
                          <DropdownMenuItem onClick={() => void handleSharePost(post)} className="rounded-none px-3 py-2">
                            <Share2 className="mr-2 h-4 w-4 shrink-0" />
                            Share
                          </DropdownMenuItem>
                          {isSelf && (
                            <>
                              <DropdownMenuSeparator className="mx-0 my-0 bg-white/10" />
                              <DropdownMenuItem
                                onClick={() => void handleDeletePost(post.id)}
                                className="rounded-none px-3 py-2 text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4 shrink-0" />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="mt-3">
                      <h3 className="break-words text-base font-semibold leading-6">{post.title}</h3>
                      <div className="mt-3">
                        <ProfileMarkdown content={post.content} />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {post.reactions.map((reaction) => (
                        <HoverCard key={reaction.emoji} openDelay={200}>
                          <HoverCardTrigger asChild>
                            <span className="inline-flex">
                              <button
                                type="button"
                                onClick={() => void handleToggleReaction(post.id, reaction.emoji)}
                                disabled={pendingReactionKey === `${post.id}:${reaction.emoji}`}
                                className={`flex h-8 items-center gap-1.5 rounded-[4px] border px-2 text-sm transition-colors ${
                                  reaction.hasReacted
                                    ? "border-primary/60 bg-primary/20 text-foreground"
                                    : "border-border bg-background/40 text-muted-foreground hover:bg-background/70 hover:text-foreground"
                                }`}
                              >
                                <span>{reaction.emoji}</span>
                                <span className="text-xs font-semibold">{reaction.count}</span>
                              </button>
                            </span>
                          </HoverCardTrigger>
                          <HoverCardContent className="w-auto max-w-[260px] p-2" align="start" side="top">
                            {(() => {
                              const names = getReactionUserNames(post, reaction);
                              const preview = names.slice(0, 4);
                              const remaining = Math.max(0, names.length - preview.length);
                              return (
                                <div className="flex items-center gap-2">
                                  <span className="text-lg leading-none">{reaction.emoji}</span>
                                  <div className="min-w-0 text-sm leading-tight">
                                    <span className="text-muted-foreground">reacted by </span>
                                    {preview.map((name, index) => (
                                      <span key={`${reaction.emoji}-${name}-${index}`}>
                                        {name}
                                        {index < preview.length - 1 ? ", " : ""}
                                      </span>
                                    ))}
                                    {remaining > 0 && <span>{preview.length > 0 ? ", " : ""}{remaining} others</span>}
                                  </div>
                                </div>
                              );
                            })()}
                          </HoverCardContent>
                        </HoverCard>
                      ))}
                      {quickReactionEmojis
                        .filter((emoji) => !post.reactions.some((reaction) => reaction.emoji === emoji))
                        .slice(0, Math.max(0, 5 - post.reactions.length))
                        .map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => void handleToggleReaction(post.id, emoji)}
                            disabled={pendingReactionKey === `${post.id}:${emoji}`}
                            className="flex h-8 w-8 items-center justify-center rounded-[4px] border border-border bg-background/30 text-sm transition-colors hover:bg-background/70"
                            aria-label={`React with ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      <button
                        type="button"
                        onClick={() => toggleComments(post.id)}
                        className="ml-auto flex h-8 items-center gap-2 rounded-[4px] px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-background/40 hover:text-foreground"
                        aria-expanded={expandedCommentPostIds.has(post.id)}
                      >
                        <MessageSquare className="h-4 w-4" />
                        {post.comment_count === 1 ? "1 comment" : `${post.comment_count} comments`}
                      </button>
                    </div>

                    {expandedCommentPostIds.has(post.id) && (
                      <div className="mt-4 border-t border-border pt-4">
                        {post.comments.length > 0 && (
                          <div className="mb-3 space-y-3">
                            {post.comments.map((comment) => {
                              const commentUser = comment.user || profileUser;
                              const commentName = commentUser.display_name || commentUser.username;
                              const canEditComment = currentUser?.id === comment.user_id;
                              const canDeleteComment = currentUser?.id === comment.user_id || currentUser?.id === post.user_id;
                              const isEditingComment = editingCommentId === comment.id;
                              return (
                                <div key={comment.id} className="flex items-center gap-3">
                                  <AvatarWithDecoration user={commentUser} className="h-7 w-7 shrink-0" />
                                  <div className="min-w-0 flex-1 rounded-[6px] bg-background/30 px-3 py-2">
                                    <div className="flex min-h-5 items-center gap-2">
                                      <div className="flex min-w-0 flex-1 items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={(event) => handleOpenUserPopup(comment.user_id, event.currentTarget)}
                                          className="truncate text-sm font-semibold hover:underline"
                                        >
                                          {commentName}
                                        </button>
                                        <span className="text-[11px] text-muted-foreground">
                                          {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                                        </span>
                                      </div>
                                      {(canEditComment || canDeleteComment) && (
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon-sm"
                                              className="h-6 w-6"
                                              aria-label="Comment actions"
                                              disabled={pendingCommentActionId === comment.id}
                                            >
                                              <MoreVertical className="h-3.5 w-3.5" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end" className="min-w-[150px] overflow-hidden rounded-md bg-[#4E505C] p-0">
                                            {canEditComment && (
                                              <DropdownMenuItem
                                                onClick={() => handleStartEditComment(comment)}
                                                className="rounded-none px-3 py-2"
                                              >
                                                <Pencil className="mr-2 h-4 w-4 shrink-0" />
                                                Edit
                                              </DropdownMenuItem>
                                            )}
                                            {canEditComment && canDeleteComment && <DropdownMenuSeparator className="mx-0 my-0 bg-white/10" />}
                                            {canDeleteComment && (
                                              <DropdownMenuItem
                                                onClick={() => void handleDeleteComment(post.id, comment.id)}
                                                className="rounded-none px-3 py-2 text-destructive focus:text-destructive"
                                              >
                                                <Trash2 className="mr-2 h-4 w-4 shrink-0" />
                                                Delete
                                              </DropdownMenuItem>
                                            )}
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      )}
                                    </div>
                                    {isEditingComment ? (
                                      <div className="mt-2 flex items-center gap-2">
                                        <input
                                          value={commentEditDrafts[comment.id] || ""}
                                          onChange={(event) =>
                                            setCommentEditDrafts((prev) => ({
                                              ...prev,
                                              [comment.id]: event.target.value.slice(0, COMMENT_MAX_LENGTH),
                                            }))
                                          }
                                          onKeyDown={(event) => {
                                            if (event.key === "Enter" && !event.shiftKey) {
                                              event.preventDefault();
                                              void handleSaveCommentEdit(comment.id);
                                            }
                                            if (event.key === "Escape") handleCancelEditComment(comment.id);
                                          }}
                                          className="h-8 min-w-0 flex-1 rounded-[6px] border border-border bg-background/40 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                          maxLength={COMMENT_MAX_LENGTH}
                                          autoFocus
                                        />
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => void handleSaveCommentEdit(comment.id)}
                                          disabled={!commentEditDrafts[comment.id]?.trim() || pendingCommentActionId === comment.id}
                                          className="h-8 min-w-[64px] rounded-[4px] bg-[#d7d9df] px-3 text-[13px] font-semibold text-[#2f3136] hover:bg-white hover:text-[#2f3136] disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          Save
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleCancelEditComment(comment.id)}
                                          disabled={pendingCommentActionId === comment.id}
                                          className="h-8 px-2 text-[13px]"
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    ) : (
                                      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5">{comment.content}</p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <AvatarWithDecoration user={currentUser || profileUser} className="h-7 w-7 shrink-0" />
                          <input
                            value={commentDrafts[post.id] || ""}
                            onChange={(event) =>
                              setCommentDrafts((prev) => ({
                                ...prev,
                                [post.id]: event.target.value.slice(0, COMMENT_MAX_LENGTH),
                              }))
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                void handleCreateComment(post.id);
                              }
                            }}
                            placeholder="Write a comment"
                            className="h-9 min-w-0 flex-1 rounded-[6px] border border-border bg-background/40 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            maxLength={COMMENT_MAX_LENGTH}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleCreateComment(post.id)}
                            disabled={!commentDrafts[post.id]?.trim() || pendingCommentPostId === post.id}
                            className="h-9 min-w-[82px] rounded-[4px] bg-[#d7d9df] px-4 text-[13px] font-semibold text-[#2f3136] transition-colors hover:bg-white hover:text-[#2f3136] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Comment
                          </Button>
                        </div>
                      </div>
                    )}
                  </article>
                ))
              ) : (
                <div className="flex min-h-[190px] flex-col items-center justify-center rounded-[6px] border border-dashed border-border text-center text-sm font-medium text-muted-foreground">
                  <MoreHorizontal className="mb-3 h-9 w-9 opacity-60" />
                  No posts yet.
                </div>
              )}
            </div>
          </section>

          <aside>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">About</h2>
            <div className="space-y-4 rounded-[6px] border border-border bg-secondary/40 p-4 text-sm">
              {profileUser.bio ? (
                <p className="whitespace-pre-wrap break-words leading-6">{profileUser.bio}</p>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                  <UserCircle className="mb-2 h-9 w-9 opacity-60" />
                  No bio yet.
                </div>
              )}

              <div className="border-t border-border pt-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Joined</p>
                <p className="mt-1 flex items-center gap-2 font-medium">
                  <JoinedSectionIcon className="h-4 w-4 text-muted-foreground" />
                  {joinedAt}
                </p>
              </div>
              {profileUser.pronouns && (
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Pronouns</p>
                  <p className="mt-1 font-medium">{profileUser.pronouns}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Servers</p>
                <p className="mt-1 flex items-center gap-2 font-medium">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  {isSelf ? `${servers.length} joined` : `${sharedServers.length} mutual`}
                </p>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
};

export default UserProfile;
