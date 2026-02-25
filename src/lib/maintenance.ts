/** When true, registration and login are disabled and maintenance banners are shown. Toggle via VITE_MAINTENANCE_MODE. */
export const MAINTENANCE_MODE = import.meta.env.VITE_MAINTENANCE_MODE === "false";

/** When true, new account registration is disabled while login remains functional. */
export const REGISTRATION_DISABLED = true;
