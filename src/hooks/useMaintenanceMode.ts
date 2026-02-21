// hooks/useMaintenanceMode.ts
// Checks maintenance status on mount and every 60s.
// If active, redirect users to a maintenance screen.

import { useEffect, useState } from "react";

const CHECK_INTERVAL_MS = 60_000; // 1 minute

export function useMaintenanceMode() {
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [loading, setLoading] = useState(true);

  const check = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/maintenance-mode`,
        {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      if (res.status === 503) {
        setIsMaintenance(true);
      } else {
        setIsMaintenance(false);
      }
    } catch {
      // Network error — assume down, show maintenance
      setIsMaintenance(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return { isMaintenance, loading };
}
