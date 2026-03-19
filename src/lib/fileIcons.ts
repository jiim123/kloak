import {
  FileIcon,
  FileText,
  FileSpreadsheet,
  FileArchive,
  FileJson,
  FileImage,
  Film,
  Music,
  FileType,
} from "lucide-react";
import type { LucideProps } from "lucide-react";

type IconComponent = React.FC<LucideProps>;

const mimeIconMap: Record<string, IconComponent> = {
  "application/pdf": FileText,
  "text/plain": FileType,
  "application/json": FileJson,
  "application/msword": FileText,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": FileText,
  "application/vnd.ms-excel": FileSpreadsheet,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": FileSpreadsheet,
  "application/zip": FileArchive,
  "application/x-rar-compressed": FileArchive,
  "application/gzip": FileArchive,
  "image/svg+xml": FileImage,
};

const prefixIconMap: [string, IconComponent][] = [
  ["image/", FileImage],
  ["video/", Film],
  ["audio/", Music],
];

export function getFileIcon(mimeType?: string | null): IconComponent {
  if (!mimeType) return FileIcon;

  if (mimeIconMap[mimeType]) return mimeIconMap[mimeType];

  for (const [prefix, icon] of prefixIconMap) {
    if (mimeType.startsWith(prefix)) return icon;
  }

  return FileIcon;
}
