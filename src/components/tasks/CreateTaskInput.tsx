import { useState, useRef } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreateTaskInputProps {
  onCreateTask: (title: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export const CreateTaskInput = ({
  onCreateTask,
  disabled = false,
  placeholder = 'Add an item...',
}: CreateTaskInputProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (!disabled) {
      setIsEditing(true);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const handleSubmit = async () => {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      setIsEditing(false);
      setValue('');
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateTask(trimmedValue);
      setValue('');
      // Keep editing mode active for rapid task creation
      inputRef.current?.focus();
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setValue('');
    }
  };

  const handleBlur = () => {
    if (!value.trim()) {
      setIsEditing(false);
      setValue('');
    } else {
      // If there's content, submit it
      handleSubmit();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-secondary/30 border border-border/50">
        <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={isSubmitting}
          className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground focus:ring-0"
          maxLength={200}
        />
        {isSubmitting && (
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        )}
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-all duration-150',
        'text-muted-foreground hover:text-foreground hover:bg-secondary/60',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <div className="w-5 h-5 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center flex-shrink-0">
        <Plus className="w-3 h-3" />
      </div>
      <span className="text-sm">{placeholder}</span>
    </button>
  );
};
