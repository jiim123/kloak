import { useState } from 'react';
import { Bold, Italic, Underline, Code, Eye, Palette, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface FormatToolbarProps {
  onFormat: (format: string, color?: string) => void;
  onClose: () => void;
}

const TEXT_COLORS = [
  { name: 'Red', value: 'red', class: 'bg-red-500' },
  { name: 'Orange', value: 'orange', class: 'bg-orange-500' },
  { name: 'Yellow', value: 'yellow', class: 'bg-yellow-500' },
  { name: 'Green', value: 'green', class: 'bg-green-500' },
  { name: 'Blue', value: 'blue', class: 'bg-blue-500' },
  { name: 'Purple', value: 'purple', class: 'bg-purple-500' },
  { name: 'Pink', value: 'pink', class: 'bg-pink-500' },
];

const FORMAT_OPTIONS = [
  { id: 'bold', icon: Bold, label: 'Bold', syntax: '**' },
  { id: 'italic', icon: Italic, label: 'Italic', syntax: '*' },
  { id: 'underline', icon: Underline, label: 'Underline', syntax: '__' },
  { id: 'code', icon: Code, label: 'Code', syntax: '`' },
  { id: 'spoiler', icon: Eye, label: 'Spoiler', syntax: '||' },
];

export const FormatToolbar = ({ onFormat, onClose }: FormatToolbarProps) => {
  const [showColorPicker, setShowColorPicker] = useState(false);

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

      {/* Color picker */}
      <Popover open={showColorPicker} onOpenChange={setShowColorPicker}>
        <PopoverTrigger asChild>
          <button
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150"
            title="Text Color"
          >
            <Palette className="w-4 h-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-auto p-2 bg-popover border border-border" 
          align="center"
          side="top"
          sideOffset={8}
        >
          <div className="flex flex-col gap-2">
            <span className="text-xs text-muted-foreground px-1">Text Color</span>
            <div className="flex gap-1.5">
              {TEXT_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => {
                    onFormat('color', color.value);
                    setShowColorPicker(false);
                  }}
                  className={cn(
                    "w-6 h-6 rounded-full transition-transform hover:scale-110",
                    color.class
                  )}
                  title={color.name}
                />
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>

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
  spoiler: { prefix: '||', suffix: '||' },
};

// Color syntax using custom markdown-like format
export const getColorSyntax = (color: string) => ({
  prefix: `[${color}:`,
  suffix: ']',
});
