


import { File, FileArchive, FileCode, FileImage, FileText, FileXls, FilmStrip, MusicNote } from "@phosphor-icons/react";
import type { IconProps } from "@phosphor-icons/react";
type IconComponent = React.FC<IconProps>;

const mimeIconMap: Record<string, IconComponent> = {
 "application/pdf": FileText,
 "text/plain": FileType,
 "application/json": FileCode,
 "application/msword": FileText,
 "application/vnd.openxmlformats-officedocument.wordprocessingml.document": FileText,
 "application/vnd.ms-excel": FileXls,
 "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": FileXls,
 "application/zip": FileArchive,
 "application/x-rar-compressed": FileArchive,
 "application/gzip": FileArchive,
 "image/svg+xml": FileImage,
};

const prefixIconMap: [string, IconComponent][] = [
 ["image/", FileImage],
 ["video/", FilmStrip],
 ["audio/", MusicNote],
];

export function getFileIcon(mimeType?: string | null): IconComponent {
 if (!mimeType) return File;

 if (mimeIconMap[mimeType]) return mimeIconMap[mimeType];

 for (const [prefix, icon] of prefixIconMap) {
 if (mimeType.startsWith(prefix)) return icon;
 }

 return File;
}
