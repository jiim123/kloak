import {
  FileIcon,
  FileText,
  FileSpreadsheet,
  FileArchive,
  FileJson,
  FileImage,
  FileCode,
  FileAudio,
  FileVideo,
  FileType,
  FileType2,
  Presentation,
  Film,
  Music,
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

// ---------------------------------------------------------------------------
// Extended metadata: icon + human-readable type label
// ---------------------------------------------------------------------------

export interface FileMeta {
  Icon: IconComponent;
  label: string;
}

interface ExtensionInfo {
  Icon: IconComponent;
  label: string;
}

const extensionMap: Record<string, ExtensionInfo> = {
  // Documents
  pdf: { Icon: FileText, label: "PDF Document" },
  doc: { Icon: FileText, label: "Word Document" },
  docx: { Icon: FileText, label: "Word Document" },
  odt: { Icon: FileText, label: "OpenDocument Text" },
  rtf: { Icon: FileText, label: "Rich Text" },
  txt: { Icon: FileType, label: "Text" },
  md: { Icon: FileType, label: "Markdown" },
  // Spreadsheets
  xls: { Icon: FileSpreadsheet, label: "Spreadsheet" },
  xlsx: { Icon: FileSpreadsheet, label: "Spreadsheet" },
  ods: { Icon: FileSpreadsheet, label: "Spreadsheet" },
  csv: { Icon: FileSpreadsheet, label: "CSV" },
  tsv: { Icon: FileSpreadsheet, label: "TSV" },
  // Presentations
  ppt: { Icon: Presentation, label: "Presentation" },
  pptx: { Icon: Presentation, label: "Presentation" },
  key: { Icon: Presentation, label: "Keynote" },
  odp: { Icon: Presentation, label: "Presentation" },
  // Archives
  zip: { Icon: FileArchive, label: "ZIP Archive" },
  rar: { Icon: FileArchive, label: "RAR Archive" },
  "7z": { Icon: FileArchive, label: "7-Zip Archive" },
  tar: { Icon: FileArchive, label: "TAR Archive" },
  gz: { Icon: FileArchive, label: "Gzip Archive" },
  bz2: { Icon: FileArchive, label: "Bzip2 Archive" },
  xz: { Icon: FileArchive, label: "XZ Archive" },
  // Code
  js: { Icon: FileCode, label: "JavaScript" },
  mjs: { Icon: FileCode, label: "JavaScript" },
  cjs: { Icon: FileCode, label: "JavaScript" },
  ts: { Icon: FileCode, label: "TypeScript" },
  tsx: { Icon: FileCode, label: "TypeScript React" },
  jsx: { Icon: FileCode, label: "JavaScript React" },
  py: { Icon: FileCode, label: "Python" },
  rs: { Icon: FileCode, label: "Rust" },
  go: { Icon: FileCode, label: "Go" },
  java: { Icon: FileCode, label: "Java" },
  kt: { Icon: FileCode, label: "Kotlin" },
  swift: { Icon: FileCode, label: "Swift" },
  c: { Icon: FileCode, label: "C" },
  h: { Icon: FileCode, label: "C Header" },
  cpp: { Icon: FileCode, label: "C++" },
  hpp: { Icon: FileCode, label: "C++ Header" },
  cs: { Icon: FileCode, label: "C#" },
  rb: { Icon: FileCode, label: "Ruby" },
  php: { Icon: FileCode, label: "PHP" },
  sh: { Icon: FileCode, label: "Shell Script" },
  bash: { Icon: FileCode, label: "Bash Script" },
  zsh: { Icon: FileCode, label: "Zsh Script" },
  ps1: { Icon: FileCode, label: "PowerShell" },
  sql: { Icon: FileCode, label: "SQL" },
  html: { Icon: FileCode, label: "HTML" },
  htm: { Icon: FileCode, label: "HTML" },
  css: { Icon: FileCode, label: "CSS" },
  scss: { Icon: FileCode, label: "Sass" },
  sass: { Icon: FileCode, label: "Sass" },
  less: { Icon: FileCode, label: "Less" },
  json: { Icon: FileJson, label: "JSON" },
  yml: { Icon: FileCode, label: "YAML" },
  yaml: { Icon: FileCode, label: "YAML" },
  toml: { Icon: FileCode, label: "TOML" },
  xml: { Icon: FileCode, label: "XML" },
  vue: { Icon: FileCode, label: "Vue" },
  svelte: { Icon: FileCode, label: "Svelte" },
  // Audio
  mp3: { Icon: FileAudio, label: "MP3 Audio" },
  wav: { Icon: FileAudio, label: "WAV Audio" },
  flac: { Icon: FileAudio, label: "FLAC Audio" },
  ogg: { Icon: FileAudio, label: "OGG Audio" },
  m4a: { Icon: FileAudio, label: "M4A Audio" },
  aac: { Icon: FileAudio, label: "AAC Audio" },
  opus: { Icon: FileAudio, label: "Opus Audio" },
  // Video
  mp4: { Icon: FileVideo, label: "MP4 Video" },
  mkv: { Icon: FileVideo, label: "Matroska Video" },
  avi: { Icon: FileVideo, label: "AVI Video" },
  mov: { Icon: FileVideo, label: "QuickTime Video" },
  webm: { Icon: FileVideo, label: "WebM Video" },
  flv: { Icon: FileVideo, label: "Flash Video" },
  // Fonts
  ttf: { Icon: FileType2, label: "TrueType Font" },
  otf: { Icon: FileType2, label: "OpenType Font" },
  woff: { Icon: FileType2, label: "Web Font" },
  woff2: { Icon: FileType2, label: "Web Font" },
  // Images (rare fallback when MIME missing)
  svg: { Icon: FileImage, label: "SVG Image" },
  png: { Icon: FileImage, label: "PNG Image" },
  jpg: { Icon: FileImage, label: "JPEG Image" },
  jpeg: { Icon: FileImage, label: "JPEG Image" },
  gif: { Icon: FileImage, label: "GIF Image" },
  webp: { Icon: FileImage, label: "WebP Image" },
};

function getExtension(name: string): string | null {
  const idx = name.lastIndexOf(".");
  if (idx <= 0 || idx === name.length - 1) return null;
  return name.slice(idx + 1).toLowerCase();
}

export function getFileMeta(fileName?: string | null, mimeType?: string | null): FileMeta {
  const ext = fileName ? getExtension(fileName) : null;
  if (ext && extensionMap[ext]) return extensionMap[ext];

  if (mimeType) {
    if (mimeIconMap[mimeType]) {
      return { Icon: mimeIconMap[mimeType], label: prettyMimeLabel(mimeType) };
    }
    if (mimeType.startsWith("image/")) return { Icon: FileImage, label: prettyMimeLabel(mimeType) };
    if (mimeType.startsWith("video/")) return { Icon: FileVideo, label: prettyMimeLabel(mimeType) };
    if (mimeType.startsWith("audio/")) return { Icon: FileAudio, label: prettyMimeLabel(mimeType) };
    if (mimeType.startsWith("text/")) return { Icon: FileType, label: prettyMimeLabel(mimeType) };
    if (mimeType.startsWith("font/")) return { Icon: FileType2, label: prettyMimeLabel(mimeType) };
  }

  return { Icon: FileIcon, label: ext ? ext.toUpperCase() + " File" : "File" };
}

function prettyMimeLabel(mime: string): string {
  const sub = mime.split("/")[1] ?? mime;
  return sub.replace(/^x-/, "").toUpperCase();
}

export function formatFileSize(bytes?: number | null): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
