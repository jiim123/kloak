import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FormatToolbar } from "@/components/chat/FormatToolbar";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { useAuthStore } from "@/stores/authStore";
import { useEditStore } from "@/stores/editStore";
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

const escapeEditorHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const markdownInlineToEditorHtml = (markdown: string): string => {
  const codeTokens: string[] = [];
  let html = escapeEditorHtml(markdown).replace(/`([^`\n]+)`/g, (_match, code: string) => {
    const token = `\u0000CODE${codeTokens.length}\u0000`;
    codeTokens.push(`<code>${code}</code>`);
    return token;
  });

  html = html
    .replace(/\|\|(.+?)\|\|/g, '<span data-profile-spoiler="true" class="rounded bg-muted/80 px-1 text-transparent select-none">$1</span>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<u>$1</u>")
    .replace(/~~(.+?)~~/g, "<s>$1</s>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");

  return html.replace(/\u0000CODE(\d+)\u0000/g, (_match, index: string) => codeTokens[Number(index)] ?? "");
};

const markdownToEditorHtml = (markdown: string): string => {
  const normalized = markdown.replace(/\r\n/g, "\n");
  let html = "";
  let cursor = 0;
  const codeBlockPattern = /```[^\n]*\n?([\s\S]*?)```/g;

  for (const match of normalized.matchAll(codeBlockPattern)) {
    const index = match.index ?? 0;
    html += markdownInlineToEditorHtml(normalized.slice(cursor, index)).replace(/\n/g, "<br>");
    html += `<pre><code>${escapeEditorHtml((match[1] ?? "").replace(/\n$/g, ""))}</code></pre>`;
    cursor = index + match[0].length;
  }

  html += markdownInlineToEditorHtml(normalized.slice(cursor)).replace(/\n/g, "<br>");
  return html;
};

const splitAnnouncementContent = (content: string) => {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  const separatorMatch = /\n\s*\n/.exec(normalized);
  const separatorIndex = separatorMatch?.index ?? -1;
  if (separatorIndex === -1) {
    const [firstLine = "", ...rest] = normalized.split("\n");
    return {
      title: firstLine.slice(0, TITLE_MAX_LENGTH),
      body: rest.join("\n").trim(),
    };
  }

  return {
    title: normalized.slice(0, separatorIndex).trim().slice(0, TITLE_MAX_LENGTH),
    body: normalized.slice(separatorIndex + (separatorMatch?.[0].length ?? 0)).trim(),
  };
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
  const editMessage = useMessageStore((state) => state.editMessage);
  const { editingMessage, cancelEditing } = useEditStore();
  const { hasPermission } = useMemberPermissions(channelId);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastValidHtmlRef = useRef("");
  const isRestoringRef = useRef(false);
  const savedDraftRef = useRef<{ title: string; body: string; html: string } | null>(null);
  const pendingEditorBodyRef = useRef<string | null>(null);
  const previousEditingIdRef = useRef<string | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const isEditMode = !!editingMessage && !editingMessage.isDM && editingMessage.channelId === channelId;
  const trimmedTitle = title.trim();
  const trimmedBody = body.trim();
  const composedContent = `${trimmedTitle}\n\n${trimmedBody}`;
  const composedLength = trimmedTitle.length + trimmedBody.length + (trimmedTitle && trimmedBody ? 2 : 0);
  const isOverLimit = composedLength > MESSAGE_MAX_LENGTH;

  const currentMember = members.find((member) => member.user_id === user?.id);
  const isMuted = currentMember?.is_muted ?? false;
  const canManageMessages = hasPermission("manage_messages");
  const canSend = !isMuted && hasPermission("send_messages") && canManageMessages;
  const canUseComposer = canSend || isEditMode;
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
    if (isEditMode) cancelEditing();
    setIsOpen(false);
    setTitle("");
    setBody("");
    lastValidHtmlRef.current = "";
    if (editorRef.current) editorRef.current.innerHTML = "";
  }, [channelId]);

  useEffect(() => {
    const currentEditingId = isEditMode ? editingMessage.id : null;
    if (currentEditingId === previousEditingIdRef.current) return;

    if (currentEditingId) {
      savedDraftRef.current = {
        title,
        body,
        html: editorRef.current?.innerHTML ?? lastValidHtmlRef.current,
      };
      const next = splitAnnouncementContent(editingMessage.content);
      setIsOpen(true);
      setTitle(next.title);
      setBody(next.body);
      pendingEditorBodyRef.current = next.body;
      lastValidHtmlRef.current = "";
    } else if (previousEditingIdRef.current) {
      const draft = savedDraftRef.current;
      savedDraftRef.current = null;
      setTitle(draft?.title ?? "");
      setBody(draft?.body ?? "");
      setIsOpen(!!draft?.title || !!draft?.body);
      requestAnimationFrame(() => {
        if (!editorRef.current) return;
        editorRef.current.innerHTML = draft?.html ?? "";
        lastValidHtmlRef.current = editorRef.current.innerHTML;
      });
    }

    previousEditingIdRef.current = currentEditingId;
  }, [body, editingMessage?.content, editingMessage?.id, isEditMode, title]);

  useLayoutEffect(() => {
    if (!isOpen || !isEditMode || pendingEditorBodyRef.current === null || !editorRef.current) return;

    editorRef.current.innerHTML = markdownToEditorHtml(pendingEditorBodyRef.current);
    lastValidHtmlRef.current = editorRef.current.innerHTML;
    pendingEditorBodyRef.current = null;
    editorRef.current.focus();
    moveCaretToEnd(editorRef.current);
  }, [isEditMode, isOpen, editingMessage?.id]);

  useEffect(() => () => onStopTyping?.(), [onStopTyping]);

  const resetComposer = useCallback(() => {
    if (isEditMode) {
      cancelEditing();
      return;
    }
    setTitle("");
    setBody("");
    setIsOpen(false);
    lastValidHtmlRef.current = "";
    if (editorRef.current) editorRef.current.innerHTML = "";
    onStopTyping?.();
  }, [cancelEditing, isEditMode, onStopTyping]);

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
    if (!user?.id || !canUseComposer || !trimmedTitle || !trimmedBody || composedContent.length > MESSAGE_MAX_LENGTH || isPosting) return;

    setIsPosting(true);
    if (isEditMode && editingMessage) {
      try {
        await editMessage(editingMessage.id, composedContent, user.id);
        cancelEditing();
      } catch (error) {
        console.error("Failed to edit announcement:", error);
        toast.error("Failed to edit announcement");
      } finally {
        setIsPosting(false);
      }
      return;
    }

    const message = await sendMessage(channelId, user.id, composedContent);
    setIsPosting(false);

    if (!message) {
      toast.error("Failed to post announcement");
      return;
    }

    resetComposer();
    window.dispatchEvent(new CustomEvent("channelMessageSent", { detail: { channelId } }));
  }, [canUseComposer, cancelEditing, channelId, composedContent, editMessage, editingMessage, isEditMode, isPosting, resetComposer, sendMessage, trimmedBody, trimmedTitle, user?.id]);

  if (!canUseComposer) {
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
                className="profile-rich-editor min-h-[160px] w-full whitespace-pre-wrap px-4 py-3 text-[14px] leading-6 text-foreground outline-none [&_code]:rounded [&_code]:bg-muted/40 [&_code]:px-1 [&_pre]:rounded [&_pre]:bg-muted/40 [&_pre]:p-3"
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
                {isPosting ? (isEditMode ? "Saving" : "Posting") : isEditMode ? "Save" : "Post"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
