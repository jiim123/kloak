import { Bold, Italic, Underline, Code, Eye, X, FileCode } from 'lucide-react';

interface FormatToolbarProps {
  onFormat: (format: string, color?: string) => void;
  onClose: () => void;
}

const FORMAT_OPTIONS = [
  { id: 'bold', icon: Bold, label: 'Bold' },
  { id: 'italic', icon: Italic, label: 'Italic' },
  { id: 'underline', icon: Underline, label: 'Underline' },
  { id: 'code', icon: Code, label: 'Inline Code' },
  { id: 'codeblock', icon: FileCode, label: 'Code Block' },
  { id: 'spoiler', icon: Eye, label: 'Spoiler' },
];

export const FormatToolbar = ({ onFormat, onClose }: FormatToolbarProps) => {
  return (
    <div className="flex items-center gap-1 px-2 py-1.5 bg-popover border border-border rounded-xl shadow-lg animate-in fade-in-0 zoom-in-95 duration-150">
      {FORMAT_OPTIONS.map((option) => (
        <button
          key={option.id}
          onClick={() => onFormat(option.id)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150"
          title={option.label}
        >
          <option.icon className="w-4 h-4" />
        </button>
      ))}

      {/* Divider */}
      <div className="w-px h-5 bg-border mx-1" />

      {/* Close button */}
      <button
        onClick={onClose}
        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150"
        title="Close"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// Format syntax map for wrapping selected text
export const FORMAT_SYNTAX: Record<string, { prefix: string; suffix: string }> = {
  bold: { prefix: '**', suffix: '**' },
  italic: { prefix: '*', suffix: '*' },
  underline: { prefix: '__', suffix: '__' },
  code: { prefix: '`', suffix: '`' },
  codeblock: { prefix: '```\n', suffix: '\n```' },
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
