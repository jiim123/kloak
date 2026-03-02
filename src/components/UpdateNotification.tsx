/**
 * Example component for showing update notifications
 * You can customize this to match your app's design
 */

import { useAppUpdater } from '@/hooks/useAppUpdater';
import { useEffect, useState } from 'react';

export function UpdateNotification() {
  const { updateInfo, checkUpdate, installUpdate, isInstalling } = useAppUpdater();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check for updates on mount
    checkUpdate();
  }, []);

  // Don't show if no update available, dismissed, or installing
  if (!updateInfo.available || dismissed || isInstalling) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg max-w-md z-50">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-medium mb-1">Update Available</h3>
          <p className="text-sm text-blue-100 mb-2">
            Version {updateInfo.version} is now available.
          </p>
          {updateInfo.body && (
            <p className="text-xs text-blue-200 mb-3 line-clamp-2">
              {updateInfo.body}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={installUpdate}
              className="px-4 py-2 bg-white text-blue-600 rounded hover:bg-blue-50 font-medium text-sm"
            >
              Install Update
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 text-sm"
            >
              Later
            </button>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-blue-200 hover:text-white"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
