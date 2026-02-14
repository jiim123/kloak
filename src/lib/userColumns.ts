/**
 * Safe user columns for PostgREST queries.
 * Excludes key_hash and last_key_reset_at which have SELECT revoked.
 * NEVER use select('*') on the users table — always use these constants.
 */

/** Columns safe to SELECT from the users table (excludes auth credentials) */
export const USER_SAFE_COLUMNS =
  'id, username, display_name, avatar_url, banner_url, avatar_decoration, profile_effect, banner_color, profile_theme_primary, profile_theme_accent, bio, status, custom_status, created_at, last_seen, pronouns';

/** FK join fragment for embedding user data in PostgREST queries */
export const USER_FK_JOIN = `user:users (${USER_SAFE_COLUMNS})`;

/** Minimal user columns for lightweight queries (search, mentions, etc.) */
export const USER_MINIMAL_COLUMNS = 'id, username, display_name, avatar_url, banner_color';

/** FK join fragment with minimal columns */
export const USER_FK_JOIN_MINIMAL = `user:users (${USER_MINIMAL_COLUMNS})`;
