import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  Loader2,
  MessageCircle,
  MessageSquare,
  MoreVertical,
  Pencil,
  Server,
  Share2,
  Trash2,
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
import { FormatToolbar } from "@/components/chat/FormatToolbar";
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
const POST_TITLE_MAX_LENGTH = 100;
const COMMENT_MAX_LENGTH = 300;
const TAGLINE_MAX_LENGTH = 80;
const quickReactionEmojis = ["👍", "❤️", "😂", "🎉", "😮"];

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
    case "span":
      if (element.dataset.profileSpoiler === "true") {
        return `||${children}||`;
      }
      return children;
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

const moveCaretToEnd = (element: HTMLElement) => {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
};

const formatInlineMarkdown = (text: string): React.ReactNode[] => {
  const nodes: React.ReactNode[] = [];
  const pattern = /(!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|~~([^~]+)~~|`([^`]+)`|\|\|([^|]+)\|\|)/g;
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
        <code key={key} className="rounded bg-muted/40 px-1 py-0.5 text-[0.9em]">
          {match[10]}
        </code>,
      );
    } else if (match[11] !== undefined) {
      nodes.push(
        <span key={key} className="rounded bg-muted/80 px-1 text-transparent select-none">
          {match[11]}
        </span>,
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
        <pre key={key} className="my-3 overflow-x-auto rounded-[6px] bg-muted/40 p-3 text-xs leading-5">
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

  return <div className="space-y-2 text-[15px] leading-6">{blocks}</div>;
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
  const lastValidComposerHtmlRef = useRef("");
  const isRestoringComposerRef = useRef(false);

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
      lastValidComposerHtmlRef.current = "";
      setIsComposerOpen(false);
      if (richBodyRef.current) richBodyRef.current.innerHTML = "";
    } catch (error: any) {
      toast.error(error?.message || "Failed to create post");
    } finally {
      setIsPosting(false);
    }
  }, [currentUser?.id, draft, isSelf, titleDraft]);

  const syncRichDraft = useCallback(() => {
    const editor = richBodyRef.current;
    if (!editor || isRestoringComposerRef.current) return;

    const nextHtml = editor.innerHTML;
    const nextDraft = htmlToMarkdown(nextHtml);

    if (nextDraft.length > POST_MAX_LENGTH) {
      isRestoringComposerRef.current = true;
      editor.innerHTML = lastValidComposerHtmlRef.current;
      moveCaretToEnd(editor);
      isRestoringComposerRef.current = false;
      return;
    }

    lastValidComposerHtmlRef.current = nextHtml;
    setDraft(nextDraft);
  }, []);

  const handleComposerAction = useCallback(
    (formatType: string) => {
      const editor = richBodyRef.current;
      if (!editor) return;

      editor.focus();

      switch (formatType) {
        case "bold":
          document.execCommand("bold");
          break;
        case "italic":
          document.execCommand("italic");
          break;
        case "strikethrough":
          document.execCommand("strikeThrough");
          break;
        case "code":
          document.execCommand("insertHTML", false, "<code>text</code>");
          break;
        case "codeblock":
          document.execCommand("insertHTML", false, "<pre><code>text</code></pre>");
          break;
        case "spoiler":
          document.execCommand(
            "insertHTML",
            false,
            '<span data-profile-spoiler="true" class="rounded bg-muted/80 px-1 text-transparent select-none">text</span>',
          );
          break;
        default:
          return;
      }

      syncRichDraft();
    },
    [syncRichDraft],
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

  if (profileUser.is_bot) {
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
      <header className="sticky top-0 z-20 flex h-12 items-center gap-2.5 border-b border-border bg-card px-3 text-foreground shadow-sm">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-[4px] text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <svg className="h-[20px] w-[20px] shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
            <Button type="button" onClick={handleMessage} className="mt-4 rounded-[4px]" variant="white" size="default">
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
                    className="flex h-[50px] w-full items-center rounded-[4px] bg-muted px-4 text-left shadow-sm transition-colors hover:bg-muted"
                  >
                    <AvatarWithDecoration user={profileUser} className="h-9 w-9 shrink-0" />
                    <span className="mx-4 h-9 w-px bg-muted" />
                    <span className="text-[18px] font-normal text-muted-foreground">Write a Post</span>
                  </button>
                ) : (
                  <>
                    <div className="overflow-hidden rounded-[4px] border border-white/5 bg-muted shadow-sm">
                      <div className="flex items-center gap-3 px-3 pt-3">
                        <AvatarWithDecoration user={profileUser} className="h-8 w-8 shrink-0" />
                        <input
                          value={titleDraft}
                          onChange={(event) => setTitleDraft(event.target.value.slice(0, POST_TITLE_MAX_LENGTH))}
                          placeholder="Post title"
                          className="min-w-0 flex-1 bg-transparent text-[18px] font-normal leading-none text-foreground outline-none placeholder:text-muted-foreground"
                          maxLength={POST_TITLE_MAX_LENGTH}
                          autoFocus
                        />
                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                          {titleDraft.length}/{POST_TITLE_MAX_LENGTH}
                        </span>
                      </div>

                      <div className="mt-3 border-y border-border px-0 py-0 text-muted-foreground format-toolbar" onMouseDown={(event) => event.preventDefault()}>
                        <FormatToolbar
                          onFormat={handleComposerAction}
                          className="bg-transparent border-0 rounded-none px-0 py-1"
                          contentClassName="px-0"
                        />
                      </div>

                      <div className="relative min-h-[160px]">
                        {!draft && <div className="pointer-events-none absolute left-4 top-3 text-[13px] text-muted-foreground">What do you want to post?</div>}
                        <div
                          ref={richBodyRef}
                          contentEditable
                          suppressContentEditableWarning
                          onBeforeInput={(event) => {
                            const nativeEvent = event.nativeEvent as InputEvent;
                            if (!nativeEvent.data || draft.length < POST_MAX_LENGTH) return;
                            if ((window.getSelection()?.toString() || "").length > 0) return;
                            event.preventDefault();
                          }}
                          onInput={syncRichDraft}
                          onBlur={syncRichDraft}
                          className="profile-rich-editor min-h-[160px] w-full px-4 py-3 text-[14px] leading-6 text-foreground outline-none [&_code]:rounded [&_code]:bg-muted/40 [&_code]:px-1 [&_pre]:rounded [&_pre]:bg-muted/40 [&_pre]:p-3"
                          role="textbox"
                          aria-multiline="true"
                          aria-label="Post body"
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {draft.length}/{POST_MAX_LENGTH} characters
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="h-8 rounded-[4px] px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                          onClick={() => {
                            setTitleDraft("");
                            setDraft("");
                            setIsComposerOpen(false);
                          }}
                          disabled={isPosting}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="h-8 min-w-[72px] rounded-[4px] bg-primary px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => void handleCreatePost()}
                          disabled={!titleDraft.trim() || !draft.trim() || isPosting}
                        >
                          {isPosting ? "Posting" : "Post"}
                        </button>
                      </div>
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
                        <DropdownMenuContent align="end" className="min-w-[160px] overflow-hidden rounded-md bg-card p-0">
                          <DropdownMenuItem onClick={() => void handleSharePost(post)} className="rounded-none px-3 py-2">
                            <Share2 className="mr-2 h-4 w-4 shrink-0" />
                            Share
                          </DropdownMenuItem>
                          {isSelf && (
                            <>
                              <DropdownMenuSeparator className="mx-0 my-0 bg-muted/40" />
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
                      <h3 className="break-words text-[15px] font-semibold leading-6">{post.title}</h3>
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
                                className={`inline-flex h-7 items-center gap-1 rounded-full border px-2 py-0 transition-colors duration-150 ${
                                  reaction.hasReacted
                                    ? "border-border bg-muted text-foreground hover:bg-muted"
                                    : "border-border bg-muted text-foreground hover:bg-muted"
                                }`}
                              >
                                <span>{reaction.emoji}</span>
                                <span className={`text-[11px] leading-none text-foreground ${reaction.hasReacted ? "font-semibold" : "font-normal"}`}>
                                  {reaction.count}
                                </span>
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
                            className="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-muted px-2 py-0 text-foreground opacity-70 transition-colors duration-150 hover:bg-muted hover:opacity-100"
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
                                    <AvatarWithDecoration user={commentUser} className="h-9 w-9 shrink-0" />
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
                                          <DropdownMenuContent align="end" className="min-w-[150px] overflow-hidden rounded-md bg-card p-0">
                                            {canEditComment && (
                                              <DropdownMenuItem
                                                onClick={() => handleStartEditComment(comment)}
                                                className="rounded-none px-3 py-2"
                                              >
                                                <Pencil className="mr-2 h-4 w-4 shrink-0" />
                                                Edit
                                              </DropdownMenuItem>
                                            )}
                                            {canEditComment && canDeleteComment && <DropdownMenuSeparator className="mx-0 my-0 bg-muted/40" />}
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
                                      <div className="mt-2">
                                        <div className="flex items-center gap-2">
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
                                            className="h-8 min-w-[64px] rounded-[4px] bg-primary px-3 text-[13px] font-semibold text-foreground hover:bg-foreground/90 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
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
                                        <div className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">
                                          {(commentEditDrafts[comment.id] || "").length}/{COMMENT_MAX_LENGTH}
                                        </div>
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
                        <div className="flex items-start gap-2">
                          <AvatarWithDecoration user={currentUser || profileUser} className="h-9 w-9 shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
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
                                className="h-9 min-w-[82px] rounded-[4px] bg-primary px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-foreground/90 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Comment
                              </Button>
                            </div>
                            <div className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">
                              {(commentDrafts[post.id] || "").length}/{COMMENT_MAX_LENGTH}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                ))
              ) : (
                <div className="flex min-h-[190px] flex-col items-center justify-center rounded-[6px] border border-dashed border-border text-center text-sm font-medium text-muted-foreground">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="mb-3 h-16 w-16 opacity-50"
                    aria-hidden="true"
                  >
                    <path
                      d="M14.5 7.5H16.1C16.9401 7.5 17.3601 7.5 17.681 7.66349C17.9632 7.8073 18.1927 8.03677 18.3365 8.31901C18.5 8.63988 18.5 9.05992 18.5 9.9V17.5C18.5 18.6046 17.6046 19.5 16.5 19.5V19.5C15.3954 19.5 14.5 18.6046 14.5 17.5V7.7C14.5 6.57989 14.5 6.01984 14.282 5.59202C14.0903 5.21569 13.7843 4.90973 13.408 4.71799C12.9802 4.5 12.4201 4.5 11.3 4.5H7.7C6.57989 4.5 6.01984 4.5 5.59202 4.71799C5.21569 4.90973 4.90973 5.21569 4.71799 5.59202C4.5 6.01984 4.5 6.5799 4.5 7.7V16.3C4.5 17.4201 4.5 17.9802 4.71799 18.408C4.90973 18.7843 5.21569 19.0903 5.59202 19.282C6.01984 19.5 6.5799 19.5 7.7 19.5H16.5"
                      stroke="currentColor"
                    />
                    <path
                      d="M11 6.5H8C7.53406 6.5 7.30109 6.5 7.11732 6.57612C6.87229 6.67761 6.67761 6.87229 6.57612 7.11732C6.5 7.30109 6.5 7.53406 6.5 8C6.5 8.46594 6.5 8.69891 6.57612 8.88268C6.67761 9.12771 6.87229 9.32239 7.11732 9.42388C7.30109 9.5 7.53406 9.5 8 9.5H11C11.4659 9.5 11.6989 9.5 11.8827 9.42388C12.1277 9.32239 12.3224 9.12771 12.4239 8.88268C12.5 8.69891 12.5 8.46594 12.5 8C12.5 7.53406 12.5 7.30109 12.4239 7.11732C12.3224 6.87229 12.1277 6.67761 11.8827 6.57612C11.6989 6.5 11.4659 6.5 11 6.5Z"
                      stroke="currentColor"
                    />
                    <path d="M6.5 11.5H12.5" stroke="currentColor" strokeLinecap="round" />
                    <path d="M6.5 13.5H12.5" stroke="currentColor" strokeLinecap="round" />
                    <path d="M6.5 15.5H12.5" stroke="currentColor" strokeLinecap="round" />
                    <path d="M6.5 17.5H10.5" stroke="currentColor" strokeLinecap="round" />
                  </svg>
                  No updates yet!
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
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
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
