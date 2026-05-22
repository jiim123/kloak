import { usePollStore } from "@/stores/pollStore";

export const POLL_CONTENT_PREFIX = "__kloak_poll__:" as const;

// More tolerant matcher: allow surrounding whitespace/newlines and accept the
// prefix appearing at the start of any trimmed content.
const POLL_ID_REGEX = /__kloak_poll__:([0-9a-fA-F-]{36})/;

export function isPollMessageContent(content: string): boolean {
  if (typeof content !== "string") return false;
  const trimmed = content.trim();
  return trimmed.startsWith(POLL_CONTENT_PREFIX) || POLL_ID_REGEX.test(trimmed);
}

export function getPollIdFromContent(content: string): string | null {
  if (typeof content !== "string") return null;
  const trimmed = content.trim();
  if (trimmed.startsWith(POLL_CONTENT_PREFIX)) {
    const id = trimmed.slice(POLL_CONTENT_PREFIX.length).trim();
    return id.length ? id : null;
  }
  const match = trimmed.match(POLL_ID_REGEX);
  return match ? match[1] : null;
}

/** Format a poll reference into a human label like "Poll: <question>". */
export function formatPollLabel(pollId: string | null | undefined, maxLength = 60): string {
  if (!pollId) return "Poll";
  const poll = usePollStore.getState().pollsById[pollId];
  const question = poll?.question?.trim();
  if (!question) return "Poll";
  const truncated = question.length > maxLength ? `${question.slice(0, maxLength - 1)}…` : question;
  return `Poll: ${truncated}`;
}

/** Reactive variant of formatPollLabel — re-renders when the poll's question changes. */
export function usePollLabel(pollId: string | null | undefined, maxLength = 60): string {
  const question = usePollStore((s) => (pollId ? s.pollsById[pollId]?.question : undefined));
  if (!pollId) return "Poll";
  const q = question?.trim();
  if (!q) return "Poll";
  const truncated = q.length > maxLength ? `${q.slice(0, maxLength - 1)}…` : q;
  return `Poll: ${truncated}`;
}
