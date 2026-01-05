import { useState, useRef } from 'react';
import { Upload, X, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ImageUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (file: File) => Promise<void>;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export const ImageUploadDialog = ({ open, onOpenChange, onUpload }: ImageUploadDialogProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    setError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);

    try {
      await onUpload(selectedFile);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setPreview(null);
    setError(null);
    onOpenChange(false);
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreview(null);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Upload Image
          </DialogTitle>
          <DialogDescription>
            Share an image with this channel
          </DialogDescription>
        </DialogHeader>

        {/* 14-day warning notice */}
        <Alert variant="default" className="border-[hsl(var(--kloak-warning))]/50 bg-[hsl(var(--kloak-warning))]/10">
          <AlertTriangle className="h-4 w-4 text-[hsl(var(--kloak-warning))]" />
          <AlertDescription className="text-sm text-[hsl(var(--kloak-warning))]">
            <strong>Notice:</strong> Uploaded images are automatically deleted after 14 days to save storage space. Make sure to save important images elsewhere.
          </AlertDescription>
        </Alert>

        {/* Upload area */}
        {!preview ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-accent/50 transition-colors"
          >
            <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-foreground font-medium mb-1">
              Click to upload or drag and drop
            </p>
            <p className="text-xs text-muted-foreground">
              JPEG, PNG, GIF, or WebP (max 10MB)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
              className="hidden"
            />
          </div>
        ) : (
          <div className="relative">
            <img
              src={preview}
              alt="Preview"
              className="w-full max-h-64 object-contain rounded-lg bg-secondary"
            />
            <button
              onClick={clearSelection}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 hover:bg-background text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              {selectedFile?.name} ({(selectedFile?.size ?? 0 / 1024 / 1024).toFixed(2)} MB)
            </p>
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
            disabled={!selectedFile || isUploading}
          >
            {isUploading ? 'Uploading...' : 'Upload & Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
