import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ImageUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (file: File) => Promise<void>;
}

interface SelectedFile {
  file: File;
  preview: string;
}

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
const MAX_FILES = 10;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export const ImageUploadDialog = ({ open, onOpenChange, onUpload }: ImageUploadDialogProps) => {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (files: FileList | File[]) => {
    setError(null);
    const fileArray = Array.from(files);
    
    // Check total count
    if (selectedFiles.length + fileArray.length > MAX_FILES) {
      setError(`You can only attach up to ${MAX_FILES} images at once`);
      return;
    }

    const validFiles: SelectedFile[] = [];
    
    for (const file of fileArray) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError('Please select valid image files (JPEG, PNG, GIF, or WebP)');
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        setError('Each file must be less than 1MB');
        continue;
      }

      // Create preview
      const preview = URL.createObjectURL(file);
      validFiles.push({ file, preview });
    }

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    setError(null);

    try {
      // Call onUpload for each file
      for (const { file, preview } of selectedFiles) {
        const result = onUpload(file);
        if (result instanceof Promise) {
          await result;
        }
        // Revoke preview URL
        URL.revokeObjectURL(preview);
      }
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    // Revoke all preview URLs
    selectedFiles.forEach(({ preview }) => URL.revokeObjectURL(preview));
    setSelectedFiles([]);
    setError(null);
    onOpenChange(false);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Upload Images
          </DialogTitle>
          <DialogDescription>
            Share images with this channel (up to {MAX_FILES} at once)
          </DialogDescription>
        </DialogHeader>

        {/* Upload area */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary hover:bg-accent/50 transition-colors"
        >
          <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-foreground font-medium mb-1">
            Click to upload or drag and drop
          </p>
          <p className="text-xs text-muted-foreground">
            JPEG, PNG, GIF, or WebP (max 1MB each)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFileSelect(e.target.files);
              }
              // Reset input so same file can be selected again
              e.target.value = '';
            }}
            className="hidden"
          />
        </div>

        {/* Selected files preview */}
        {selectedFiles.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {selectedFiles.length} image{selectedFiles.length > 1 ? 's' : ''} selected
            </p>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
              {selectedFiles.map((item, index) => (
                <div key={index} className="relative group">
                  <img
                    src={item.preview}
                    alt={`Preview ${index + 1}`}
                    className="w-16 h-16 object-cover rounded-lg border border-border"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                    className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={selectedFiles.length === 0 || isUploading}
          >
            {isUploading ? 'Uploading...' : `Attach ${selectedFiles.length > 0 ? selectedFiles.length : ''} Image${selectedFiles.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
