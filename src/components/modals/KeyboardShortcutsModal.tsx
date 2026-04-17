
import { Keyboard } from "@phosphor-icons/react";
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogHeader,
 DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUIStore } from '@/stores/uiStore';

interface ShortcutGroup {
 name: string;
 shortcuts: {
 keys: string[];
 description: string;
 }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
 {
 name: 'Navigation',
 shortcuts: [
 { keys: ['Ctrl', 'K'], description: 'Open quick switcher' },
 { keys: ['Ctrl', '/'], description: 'Open keyboard shortcuts' },
 { keys: ['Esc'], description: 'Close modal / Cancel action' },
 { keys: ['Alt', '↑'], description: 'Previous channel' },
 { keys: ['Alt', '↓'], description: 'Next channel' },
 ],
 },
 {
 name: 'Messages',
 shortcuts: [
 { keys: ['Enter'], description: 'Send message' },
 { keys: ['Shift', 'Enter'], description: 'New line in message' },
 { keys: ['↑'], description: 'Edit last message (when input empty)' },
 { keys: ['Ctrl', 'E'], description: 'Edit selected message' },
 ],
 },
 {
 name: 'Actions',
 shortcuts: [
 { keys: ['Ctrl', 'Shift', 'M'], description: 'Toggle mute' },
 { keys: ['Ctrl', 'Shift', 'D'], description: 'Toggle deafen' },
 ],
 },
];

const Kbd = ({ children }: { children: React.ReactNode }) => (
 <kbd className="px-2 py-1 text-xs font-mono bg-secondary rounded border border-border">
 {children}
 </kbd>
);

export const KeyboardShortcutsModal = () => {
 const { activeModal, closeModal } = useUIStore();

 const isOpen = activeModal === 'shortcuts';

 // Adjust for Mac users
 const formatKey = (key: string) => {
 const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
 if (key === 'Ctrl') return isMac ? '⌘' : 'Ctrl';
 if (key === 'Alt') return isMac ? '⌥' : 'Alt';
 if (key === 'Shift') return isMac ? '⇧' : 'Shift';
 return key;
 };

 return (
 <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
 <DialogContent className="sm:max-w-lg">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Keyboard className="w-5 h-5" />
 Keyboard Shortcuts
 </DialogTitle>
 <DialogDescription>
 Speed up your workflow with these shortcuts
 </DialogDescription>
 </DialogHeader>

 <ScrollArea className="max-h-[60vh]">
 <div className="space-y-6 pr-4">
 {SHORTCUT_GROUPS.map((group) => (
 <div key={group.name}>
 <h3 className="text-sm font-medium mb-3 text-muted-foreground uppercase">
 {group.name}
 </h3>
 <div className="space-y-2">
 {group.shortcuts.map((shortcut, index) => (
 <div 
 key={index}
 className="flex items-center justify-between py-2"
 >
 <span className="text-sm">{shortcut.description}</span>
 <div className="flex items-center gap-1">
 {shortcut.keys.map((key, keyIndex) => (
 <span key={keyIndex} className="flex items-center">
 <Kbd>{formatKey(key)}</Kbd>
 {keyIndex < shortcut.keys.length - 1 && (
 <span className="mx-1 text-muted-foreground">+</span>
 )}
 </span>
 ))}
 </div>
 </div>
 ))}
 </div>
 </div>
 ))}
 </div>
 </ScrollArea>

 <div className="pt-4 border-t text-center text-xs text-muted-foreground">
 Press <Kbd>Ctrl</Kbd> + <Kbd>/</Kbd> anytime to see this menu
 </div>
 </DialogContent>
 </Dialog>
 );
};