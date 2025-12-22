import { useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';

export const useKeyboardShortcuts = () => {
  const { activeModal, closeModal, openModal } = useUIStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Escape: close active modal
      if (e.key === 'Escape' && activeModal) {
        e.preventDefault();
        closeModal();
        return;
      }

      // Ctrl/Cmd + K: open quick switcher
      if (modKey && e.key === 'k') {
        e.preventDefault();
        if (activeModal === 'quickSwitcher') {
          closeModal();
        } else {
          openModal('quickSwitcher');
        }
        return;
      }

      // Ctrl/Cmd + /: open shortcuts help
      if (modKey && e.key === '/') {
        e.preventDefault();
        if (activeModal === 'shortcuts') {
          closeModal();
        } else {
          openModal('shortcuts');
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeModal, closeModal, openModal]);
};
