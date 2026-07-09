import type { User } from "@/types";

export const isPlatformAdmin = (user: Pick<User, "is_staff"> | null | undefined) => Boolean(user?.is_staff);
