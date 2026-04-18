import { toast } from "sonner";

let lastToastTime = 0;

export function rateLimitToast(message = "You're doing that too fast. Please slow down.") {
  const now = Date.now();
  if (now - lastToastTime < 3000) return;
  lastToastTime = now;
  toast.error(message);
}
