import { Bold, Italic, Code, Eye, FileCode, Strikethrough, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useEffect, useRef, useState, useCallback } from 'react';

const FORMAT_OPTIONS = [
  { id: 'bold', icon: Bold, label: 'Bold' },
  { id: 'italic', icon: Italic, label: 'Italic' },
  { id: 'strikethrough', icon: Strikethrough, label: 'Strikethrough' },
  { id: 'code', icon: Code, label: 'Inline Code' },
  { id: 'codeblock', icon: FileCode, label: 'Code Block' },
  { id: 'spoiler', icon: Eye, label: 'Spoiler' },
];

// Format syntax map for wrapping selected text
export const FORMAT_SYNTAX: Record<string, { prefix: string; suffix: string }> = {
  bold: { prefix: '**', suffix: '**' },
  italic: { prefix: '*', suffix: '*' },
  underline: { prefix: '__', suffix: '__' },
  strikethrough: { prefix: '~~', suffix: '~~' },
  code: { prefix: '`', suffix: '`' },
  codeblock: { prefix: '```\n', suffix: '\n```' },
  spoiler: { prefix: '||', suffix: '||' },
};

// Code block syntax with optional language
export const getCodeBlockSyntax = (language: string) => ({
  prefix: `\`\`\`${language}\n`,
  suffix: '\n```',
});

interface SelectionFormatToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  onFormat: (formatType: string) => void;
}

export const SelectionFormatToolbar = ({ textareaRef, onFormat }: SelectionFormatToolbarProps) => {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updatePosition = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start === end) {
      setVisible(false);
      return;
    }

    // Get textarea's bounding rect relative to the viewport
    const rect = textarea.getBoundingClientRect();
    const parent = textarea.closest('.relative');
    const parentRect = parent?.getBoundingClientRect() ?? rect;

    // Create a temporary element to measure text position
    const mirror = document.createElement('div');
    const style = window.getComputedStyle(textarea);
    
    mirror.style.cssText = `
      position: absolute;
      visibility: hidden;
      white-space: pre-wrap;
      word-wrap: break-word;
      overflow: hidden;
      width: ${textarea.clientWidth}px;
      font: ${style.font};
      padding: ${style.padding};
      line-height: ${style.lineHeight};
      letter-spacing: ${style.letterSpacing};
    `;

    const textBefore = textarea.value.substring(0, start);
    const selectedText = textarea.value.substring(start, end);
    
    mirror.textContent = textBefore;
    const span = document.createElement('span');
    span.textContent = selectedText || '.';
    mirror.appendChild(span);
    
    document.body.appendChild(mirror);

    const spanRect = span.getBoundingClientRect();
    const mirrorRect = mirror.getBoundingClientRect();
    
    // Calculate position relative to textarea
    const selectionTop = spanRect.top - mirrorRect.top - textarea.scrollTop;
    const selectionLeft = (spanRect.left - mirrorRect.left + spanRect.width / 2);
    
    document.body.removeChild(mirror);

    // Position relative to the outer container (the .relative parent)
    const toolbarTop = rect.top - parentRect.top + selectionTop - 44; // 44px above selection
    const toolbarLeft = Math.max(8, Math.min(
      rect.left - parentRect.left + selectionLeft - 120, // center the ~240px toolbar
      parentRect.width - 260
    ));

    setPosition({ top: toolbarTop, left: toolbarLeft });
    setVisible(true);
  }, [textareaRef]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handleSelect = () => {
      // Small delay to let selection finalize
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = setTimeout(() => {
        updatePosition();
      }, 50);
    };

    const handleMouseUp = () => {
      setTimeout(updatePosition, 10);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.shiftKey || e.key === 'Shift') {
        setTimeout(updatePosition, 10);
      }
    };

    const handleBlur = () => {
      // Delay hide to allow clicking toolbar buttons
      hideTimeoutRef.current = setTimeout(() => {
        setVisible(false);
      }, 200);
    };

    textarea.addEventListener('select', handleSelect);
    textarea.addEventListener('mouseup', handleMouseUp);
    textarea.addEventListener('keyup', handleKeyUp);
    textarea.addEventListener('blur', handleBlur);

    return () => {
      textarea.removeEventListener('select', handleSelect);
      textarea.removeEventListener('mouseup', handleMouseUp);
      textarea.removeEventListener('keyup', handleKeyUp);
      textarea.removeEventListener('blur', handleBlur);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [textareaRef, updatePosition]);

  // Hide when selection is cleared
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      // Don't hide if clicking the toolbar itself
      if (toolbarRef.current?.contains(e.target as Node)) return;
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  if (!visible) return null;

  return (
    <TooltipProvider>
      <div
        ref={toolbarRef}
        className="absolute z-50 flex items-center gap-0.5 px-2 py-1.5 bg-popover border border-border rounded-xl shadow-lg animate-in fade-in-0 zoom-in-95 duration-100"
        style={{ top: position.top, left: position.left }}
        onMouseDown={(e) => {
          // Prevent blur on the textarea when clicking toolbar
          e.preventDefault();
        }}
      >
        {FORMAT_OPTIONS.map((option) => (
          <Tooltip key={option.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  onFormat(option.id);
                  setVisible(false);
                }}
                onMouseDown={(e) => e.preventDefault()}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors duration-100 flex-shrink-0"
              >
                <option.icon className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <p>{option.label}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
};

// Legacy FormatToolbar for TiptapEditor-based components (Announcements, Forums)
interface FormatToolbarProps {
  onFormat: (format: string) => void;
  onClose?: () => void;
  onImageClick?: () => void;
  className?: string;
  contentClassName?: string;
}

export const FormatToolbar = ({ onFormat, onClose, onImageClick, className, contentClassName }: FormatToolbarProps) => {
  return (
    <TooltipProvider>
      <div className={`flex items-center gap-1 px-3 sm:px-4 py-2 bg-muted/40 rounded-t-2xl border-b border-border/50 font-[Inter,system-ui,sans-serif] overflow-x-auto scrollbar-hide ${className ?? ""}`}>
        <div className={`flex items-center gap-0.5 min-w-max ${contentClassName ?? ""}`}>
          {FORMAT_OPTIONS.map((option) => (
            <Tooltip key={option.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onFormat(option.id)}
                  onMouseDown={(e) => e.preventDefault()}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors duration-150 flex-shrink-0"
                >
                  <option.icon className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{option.label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
          {onClose && (
            <>
              <div className="w-px h-5 bg-border mx-1 flex-shrink-0" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onClose}
                    onMouseDown={(e) => e.preventDefault()}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors duration-150 flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Close</p>
                </TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};
