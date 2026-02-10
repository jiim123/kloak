import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ResolvedEmoji } from '@/lib/globalEmojiResolver';
import { supabase } from '@/integrations/supabase/client';

interface CustomEmojiPopoverProps {
  emoji: ResolvedEmoji;
  anchorRect: DOMRect;
  onClose: () => void;
}

export function CustomEmojiPopover({ emoji, anchorRect, onClose }: CustomEmojiPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);

  // Fetch member count for published servers
  useEffect(() => {
    if (!emoji.isPublished) return;

    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from('server_members')
        .select('*', { count: 'exact', head: true })
        .eq('server_id', emoji.serverId);
      if (!cancelled && count !== null) setMemberCount(count);
    })();
    return () => { cancelled = true; };
  }, [emoji.serverId, emoji.isPublished]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Position: above or below the anchor, centered
  const top = anchorRect.bottom + 8;
  const left = Math.max(8, Math.min(anchorRect.left + anchorRect.width / 2 - 160, window.innerWidth - 328));

  // Check if it would overflow bottom → show above instead
  const showAbove = top + 200 > window.innerHeight;
  const finalTop = showAbove ? anchorRect.top - 8 : top;

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-[200] w-[320px] rounded-lg border border-border bg-popover shadow-xl animate-in fade-in-0 zoom-in-95 duration-150"
      style={{
        top: showAbove ? undefined : `${finalTop}px`,
        bottom: showAbove ? `${window.innerHeight - finalTop}px` : undefined,
        left: `${left}px`,
      }}
    >
      {/* Emoji preview section */}
      <div className="p-4 flex items-start gap-3">
        <img
          src={emoji.url}
          alt={`:${emoji.name}:`}
          className="w-12 h-12 object-contain flex-shrink-0 rounded"
        />
        <div className="min-w-0">
          <p className="font-semibold text-foreground text-sm">:{emoji.name}:</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            This emoji is from one of your servers. Type its name in the chat bar to use it.
          </p>
        </div>
      </div>

      {/* Server info section - only for published servers */}
      {emoji.isPublished && (
        <div className="border-t border-border px-4 py-3">
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-2">
            This emoji is from
          </p>
          <div className="flex items-center gap-2.5">
            {emoji.serverIcon ? (
              <img
                src={emoji.serverIcon}
                alt={emoji.serverName}
                className="w-9 h-9 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-foreground flex-shrink-0">
                {emoji.serverName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{emoji.serverName}</p>
              <p className="text-xs text-muted-foreground">
                {memberCount !== null ? `${memberCount.toLocaleString()} Member${memberCount !== 1 ? 's' : ''}` : '...'}
                {' · '}
                Discoverable Server
              </p>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
