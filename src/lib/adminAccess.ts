import type { User } from "@/types";

// Temporary platform-admin allowlist.
// Keep this in sync with public.platform_admin_usernames() / public.platform_admin_user_ids()
// in supabase/migrations/20260621120000_add_platform_admin_reports.sql.
export const PLATFORM_ADMIN_USERNAMES = [
].map((username) => username.toLowerCase());

export const PLATFORM_ADMIN_USER_IDS: string[] = [
  "d9ff3045-de3a-4878-9e4e-a015d43b00ab",
  "925aea05-b0b7-4171-a925-e7dc8560014e",
  "ce6e5466-80a5-42e0-835f-086e2347ea82",
  "c3108f3f-d4ca-49c5-9dbf-bd83f9316db6",
];

export const isPlatformAdmin = (user: Pick<User, "id" | "username"> | null | undefined) => {
  if (!user) return false;
  return PLATFORM_ADMIN_USER_IDS.includes(user.id) || PLATFORM_ADMIN_USERNAMES.includes(user.username.toLowerCase());
};
