import { Bold, Italic, Underline, Code, Eye, X, FileCode, Strikethrough, Image, List, ListOrdered, Heading1, Heading2, Quote, AlignLeft, AlignCenter, AlignRight, Minus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface FormatToolbarProps {
  onFormat: (format: string, color?: string) => void;
  onClose: () => void;
  onImageClick?: () => void;
}

const FORMAT_OPTIONS = [
  { id: 'bold', icon: Bold, label: 'Bold' },
  { id: 'italic', icon: Italic, label: 'Italic' },
  { id: 'underline', icon: Underline, label: 'Underline' },
  { id: 'strikethrough', icon: Strikethrough, label: 'Strikethrough' },
  { id: 'code', icon: Code, label: 'Inline Code' },
  { id: 'image', icon: Image, label: 'Image', isAction: true },
  { id: 'codeblock', icon: FileCode, label: 'Code Block' },
  { id: 'list', icon: List, label: 'Bullet List' },
  { id: 'orderedlist', icon: ListOrdered, label: 'Numbered List' },
  { id: 'heading1', icon: Heading1, label: 'Heading 1' },
  { id: 'heading2', icon: Heading2, label: 'Heading 2' },
  { id: 'quote', icon: Quote, label: 'Quote' },
  { id: 'spoiler', icon: Eye, label: 'Spoiler' },
  { id: 'alignLeft', icon: AlignLeft, label: 'Align Left' },
  { id: 'alignCenter', icon: AlignCenter, label: 'Align Center' },
  { id: 'alignRight', icon: AlignRight, label: 'Align Right' },
  { id: 'separator', icon: Minus, label: 'Separator' },
];

export const FormatToolbar = ({ onFormat, onClose, onImageClick }: FormatToolbarProps) => {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 px-3 sm:px-4 py-2 bg-muted/40 rounded-t-2xl border-b border-border/50 font-[Inter,system-ui,sans-serif] overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-0.5 min-w-max">
          {FORMAT_OPTIONS.map((option) => {
            if (option.isAction && option.id === 'image' && onImageClick) {
              return (
                <Tooltip key={option.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={onImageClick}
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
              );
            }
            return (
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
            );
          })}

          {/* Divider */}
          <div className="w-px h-5 bg-border mx-1 flex-shrink-0" />

          {/* Close button */}
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
        </div>
      </div>
    </TooltipProvider>
  );
};

// Format syntax map for wrapping selected text
export const FORMAT_SYNTAX: Record<string, { prefix: string; suffix: string }> = {
  bold: { prefix: '**', suffix: '**' },
  italic: { prefix: '*', suffix: '*' },
  underline: { prefix: '__', suffix: '__' },
  strikethrough: { prefix: '~~', suffix: '~~' },
  code: { prefix: '`', suffix: '`' },
  codeblock: { prefix: '```\n', suffix: '\n```' },
  list: { prefix: '- ', suffix: '' },
  orderedlist: { prefix: '1. ', suffix: '' },
  heading1: { prefix: '# ', suffix: '' },
  heading2: { prefix: '## ', suffix: '' },
  quote: { prefix: '> ', suffix: '' },
  spoiler: { prefix: '||', suffix: '||' },
};

// Code block syntax with optional language (for manual language specification)
export const getCodeBlockSyntax = (language: string) => ({
  prefix: `\`\`\`${language}\n`,
  suffix: '\n```',
});

// Color syntax using custom markdown-like format
export const getColorSyntax = (color: string) => ({
  prefix: `[${color}:`,
  suffix: ']',
});
