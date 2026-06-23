import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FormatToolbar } from "@/components/chat/FormatToolbar";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { useAuthStore } from "@/stores/authStore";
import { useMessageStore } from "@/stores/messageStore";
import { useServerStore } from "@/stores/serverStore";

const TITLE_MAX_LENGTH = 100;
const MESSAGE_MAX_LENGTH = 2000;
const BODY_MAX_LENGTH = MESSAGE_MAX_LENGTH - 3;

interface AnnouncementComposerProps {
  channelId: string;
  onTyping?: () => void;
  onStopTyping?: () => void;
  onSlowmodeStatusChange?: (status: {
    enabled: boolean;
    blocked: boolean;
    immune: boolean;
    remainingSeconds: number;
  }) => void;
}

const nodeTextToMarkdown = (node: Node): string => {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent || "").replace(/\u00a0/g, " ");
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
      return element.dataset.profileSpoiler === "true" ? `||${children}||` : children;
    case "h1":
      return `# ${block}\n`;
    case "h2":
      return `## ${block}\n`;
    case "blockquote":
      return `${block.split("\n").map((line) => `> ${line}`).join("\n")}\n`;
    case "li": {
      const parent = element.parentElement?.tagName.toLowerCase();
      const index = parent === "ol" ? Array.from(element.parentElement?.children || []).indexOf(element) + 1 : 0;
      return `${parent === "ol" ? `${index}. ` : "- "}${block}\n`;
    }
    case "a": {
      const href = element.getAttribute("href") || "";
      return href ? `[${children || href}](${href})` : children;
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

export const AnnouncementComposer = ({
  channelId,
  onTyping,
  onStopTyping,
  onSlowmodeStatusChange,
}: AnnouncementComposerProps) => {
  const user = useAuthStore((state) => state.user);
  const currentChannel = useServerStore((state) => state.currentChannel);
  const members = useServerStore((state) => state.members);
  const sendMessage = useMessageStore((state) => state.sendMessage);
  const { hasPermission } = useMemberPermissions(channelId);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastValidHtmlRef = useRef("");
  const isRestoringRef = useRef(false);

  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const trimmedTitle = title.trim();
  const trimmedBody = body.trim();
  const composedContent = `${trimmedTitle}\n\n${trimmedBody}`;
  const composedLength = trimmedTitle.length + trimmedBody.length + (trimmedTitle && trimmedBody ? 2 : 0);
  const isOverLimit = composedLength > MESSAGE_MAX_LENGTH;

  const currentMember = members.find((member) => member.user_id === user?.id);
  const isMuted = currentMember?.is_muted ?? false;
  const canManageMessages = hasPermission("manage_messages");
  const canSend = !isMuted && hasPermission("send_messages") && canManageMessages;
  const slowmodeEnabled = Math.max(0, Number(currentChannel?.slowmode_seconds) || 0) > 0;

  useEffect(() => {
    onSlowmodeStatusChange?.({
      enabled: slowmodeEnabled,
      blocked: false,
      immune: canManageMessages,
      remainingSeconds: 0,
    });
  }, [canManageMessages, onSlowmodeStatusChange, slowmodeEnabled]);

  useEffect(() => {
    setIsOpen(false);
    setTitle("");
    setBody("");
    lastValidHtmlRef.current = "";
    if (editorRef.current) editorRef.current.innerHTML = "";
  }, [channelId]);

  useEffect(() => () => onStopTyping?.(), [onStopTyping]);

  const resetComposer = useCallback(() => {
    setTitle("");
    setBody("");
    setIsOpen(false);
    lastValidHtmlRef.current = "";
    if (editorRef.current) editorRef.current.innerHTML = "";
    onStopTyping?.();
  }, [onStopTyping]);

  const syncBody = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || isRestoringRef.current) return;

    const nextHtml = editor.innerHTML;
    const nextBody = htmlToMarkdown(nextHtml);
    if (nextBody.length > BODY_MAX_LENGTH) {
      isRestoringRef.current = true;
      editor.innerHTML = lastValidHtmlRef.current;
      moveCaretToEnd(editor);
      isRestoringRef.current = false;
      return;
    }

    lastValidHtmlRef.current = nextHtml;
    setBody(nextBody);
    if (nextBody) onTyping?.();
  }, [onTyping]);

  const handleFormat = useCallback(
    (formatType: string) => {
      const editor = editorRef.current;
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

      syncBody();
    },
    [syncBody],
  );

  const handlePost = useCallback(async () => {
    if (!user?.id || !canSend || !trimmedTitle || !trimmedBody || composedContent.length > MESSAGE_MAX_LENGTH || isPosting) return;

    setIsPosting(true);
    const message = await sendMessage(channelId, user.id, composedContent);
    setIsPosting(false);

    if (!message) {
      toast.error("Failed to post announcement");
      return;
    }

    resetComposer();
    window.dispatchEvent(new CustomEvent("channelMessageSent", { detail: { channelId } }));
  }, [canSend, channelId, composedContent, isPosting, resetComposer, sendMessage, trimmedBody, trimmedTitle, user?.id]);

  if (!canSend) {
    return (
      <div className="px-4 pb-6">
        <div className="flex items-center justify-center rounded-2xl border border-border/50 bg-muted/30 py-4">
          <span className="text-muted-foreground">{isMuted ? "You are muted" : "Read-only channel"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 pb-3 pt-2 sm:px-5 sm:pb-5">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex h-[50px] w-full items-center rounded-[4px] bg-muted px-4 text-left shadow-sm transition-colors hover:bg-muted/90"
        >
          <AvatarWithDecoration user={user} className="h-9 w-9 shrink-0" />
          <span className="mx-4 h-9 w-px bg-border" />
          <span className="text-[18px] font-normal text-muted-foreground">Write an Announcement</span>
        </button>
      ) : (
        <>
          <div className="overflow-hidden rounded-[4px] border border-white/5 bg-muted shadow-sm">
            <div className="flex items-center gap-3 px-3 pt-3">
              <AvatarWithDecoration user={user} className="h-8 w-8 shrink-0" />
              <input
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value.slice(0, TITLE_MAX_LENGTH));
                  onTyping?.();
                }}
                placeholder="Announcement title"
                className="min-w-0 flex-1 bg-transparent text-[18px] font-normal leading-none text-foreground outline-none placeholder:text-muted-foreground"
                maxLength={TITLE_MAX_LENGTH}
                autoFocus
              />
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {title.length}/{TITLE_MAX_LENGTH}
              </span>
            </div>

            <div
              className="format-toolbar mt-3 border-y border-border px-0 py-0 text-muted-foreground"
              onMouseDown={(event) => event.preventDefault()}
            >
              <FormatToolbar
                onFormat={handleFormat}
                className="rounded-none border-0 bg-transparent px-0 py-1"
                contentClassName="px-0"
              />
            </div>

            <div className="relative min-h-[160px]">
              {!body && (
                <div className="pointer-events-none absolute left-4 top-3 text-[13px] text-muted-foreground">
                  What do you want to announce?
                </div>
              )}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onBeforeInput={(event) => {
                  const nativeEvent = event.nativeEvent as InputEvent;
                  if (!nativeEvent.data || body.length < BODY_MAX_LENGTH) return;
                  if ((window.getSelection()?.toString() || "").length > 0) return;
                  event.preventDefault();
                }}
                onInput={syncBody}
                onBlur={() => {
                  syncBody();
                  onStopTyping?.();
                }}
                className="profile-rich-editor min-h-[160px] w-full px-4 py-3 text-[14px] leading-6 text-foreground outline-none [&_code]:rounded [&_code]:bg-muted/40 [&_code]:px-1 [&_pre]:rounded [&_pre]:bg-muted/40 [&_pre]:p-3"
                role="textbox"
                aria-multiline="true"
                aria-label="Announcement body"
              />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <span className={`text-[11px] tabular-nums ${isOverLimit ? "text-destructive" : "text-muted-foreground"}`}>
              {composedLength}/{MESSAGE_MAX_LENGTH} characters
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="h-8 rounded-[4px] px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                onClick={resetComposer}
                disabled={isPosting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="h-8 min-w-[72px] rounded-[4px] bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void handlePost()}
                disabled={!title.trim() || !body.trim() || isOverLimit || isPosting}
              >
                {isPosting ? "Posting" : "Post"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
