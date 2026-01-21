export const POLL_CONTENT_PREFIX = "__kloak_poll__:" as const;

export function isPollMessageContent(content: string): boolean {
  return typeof content === "string" && content.startsWith(POLL_CONTENT_PREFIX);
}

export function getPollIdFromContent(content: string): string | null {
  if (!isPollMessageContent(content)) return null;
  const id = content.slice(POLL_CONTENT_PREFIX.length).trim();
  return id.length ? id : null;
}

