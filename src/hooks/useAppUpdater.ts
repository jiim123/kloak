import { useEffect, useState } from 'react';
import { check } from '@tauri-apps/plugin-updater';

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

  const checkUpdate = async () => {
    setIsChecking(true);
    try {
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
      console.error('Failed to check for updates:', error);
      setUpdateInfo({
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsChecking(false);
    }
  };

  const installUpdate = async () => {
    if (!updateInfo.available) {
      return;
    }

    setIsInstalling(true);
    try {
      const update = await check();
      if (update?.available) {
        await update.downloadAndInstall();
        // The app will restart automatically after installation
      }
    } catch (error) {
      console.error('Failed to install update:', error);
      setUpdateInfo({
        ...updateInfo,
        error: error instanceof Error ? error.message : 'Failed to install update',
      });
      setIsInstalling(false);
    }
  };

  return {
    updateInfo,
    isChecking,
    isInstalling,
    checkUpdate,
    installUpdate,
  };
}
