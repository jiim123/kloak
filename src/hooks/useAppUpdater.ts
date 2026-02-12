import { useEffect, useState, useCallback } from 'react';

interface UpdateInfo {
  available: boolean;
  version?: string;
  body?: string;
  date?: string;
  error?: string;
}

/**
 * Hook to check for app updates
 * 
 * @example
 * const { updateInfo, checkUpdate, installUpdate, isInstalling } = useAppUpdater();
 * 
 * useEffect(() => {
 *   checkUpdate();
 * }, []);
 */
export function useAppUpdater() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({ available: false });
  const [isChecking, setIsChecking] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [hasCheckedOnce, setHasCheckedOnce] = useState(false);

  const checkUpdate = useCallback(async () => {
    // Don't block the app - check updates in the background
    setIsChecking(true);
    try {
      // Check if we're in Tauri and updater is available
      const { isTauri } = await import('@/lib/tauriRuntime');
      if (!isTauri()) {
        setUpdateInfo({ 
          available: false,
          error: 'Not running in Tauri app'
        });
        return;
      }

      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      
      if (update?.available) {
        setUpdateInfo({
          available: true,
          version: update.version,
          body: update.body,
          date: update.date,
        });
      } else {
        setUpdateInfo({ available: false });
      }
    } catch (error) {
      let errorMessage = 'Unknown error';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        errorMessage = (error as any).message || 
                      (error as any).error || 
                      (error as any).toString() || 
                      JSON.stringify(error);
      }
      
      if (errorMessage.includes('Plugin not found') || 
          errorMessage.includes('not allowed') ||
          (errorMessage.includes('plugin') && errorMessage.includes('not found'))) {
        setUpdateInfo({
          available: false,
          error: 'Update checking is only available in production builds. Use the release build to check for updates.',
        });
      } else {
        setUpdateInfo({
          available: false,
          error: errorMessage || 'Failed to check for updates.',
        });
      }
    } finally {
      setIsChecking(false);
      setHasCheckedOnce(true);
    }
  }, []);

  // NO AUTO-CHECK - updates are checked manually via button in settings

  const installUpdate = async () => {
    if (!updateInfo.available) {
      return;
    }

    setIsInstalling(true);
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      
      if (update?.available) {
        await update.downloadAndInstall();
      } else {
        setUpdateInfo({
          ...updateInfo,
          available: false,
          error: 'Update is no longer available. Please check again.',
        });
        setIsInstalling(false);
      }
    } catch (error) {
      let errorMessage = 'Failed to install update';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        errorMessage = (error as any).message || 
                      (error as any).error || 
                      (error as any).toString() || 
                      JSON.stringify(error);
      }
      
      setUpdateInfo({
        ...updateInfo,
        error: errorMessage || 'Failed to install update. Please try again.',
      });
      setIsInstalling(false);
    }
  };

  return {
    updateInfo,
    isChecking,
    isInstalling,
    hasCheckedOnce,
    checkUpdate,
    installUpdate,
  };
}
