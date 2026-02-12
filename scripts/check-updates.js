/**
 * Frontend update checker utility
 * This can be imported in your React app to check for updates
 */

import { check } from '@tauri-apps/plugin-updater';

/**
 * Check for app updates
 * @returns {Promise<{available: boolean, version?: string, body?: string}>}
 */
export async function checkForUpdates() {
  try {
    const update = await check();
    
    if (update?.available) {
      return {
        available: true,
        version: update.version,
        body: update.body,
        date: update.date,
      };
    }
    
    return { available: false };
  } catch (error) {
    console.error('Failed to check for updates:', error);
    return { available: false, error: error.message };
  }
}

/**
 * Install the update if available
 * @returns {Promise<boolean>}
 */
export async function installUpdate() {
  try {
    const update = await check();
    
    if (update?.available) {
      await update.downloadAndInstall();
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Failed to install update:', error);
    throw error;
  }
}
