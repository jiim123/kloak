import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Prism from 'prismjs';

// Import common languages - order matters for dependencies!
// markup and markup-templating must come before php
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-markup-templating';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';

interface CodeBlockProps {
  code: string;
  language?: string;
}

// Language aliases
const languageAliases: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  rb: 'ruby',
  sh: 'bash',
  shell: 'bash',
  yml: 'yaml',
  html: 'markup',
  xml: 'markup',
  cs: 'csharp',
};

// Simple language detection heuristics
const detectLanguage = (code: string): string => {
  const trimmed = code.trim();
  
  // Check for specific patterns
  if (/^import\s+.*from\s+['"]/.test(trimmed) || /^export\s+(default\s+)?/.test(trimmed)) {
    return trimmed.includes(': ') ? 'typescript' : 'javascript';
  }
  if (/^(const|let|var)\s+\w+\s*[:=]/.test(trimmed)) {
    return trimmed.includes(': ') ? 'typescript' : 'javascript';
  }
  if (/^(def|class)\s+\w+/.test(trimmed) || /^import\s+\w+$/.test(trimmed)) {
    return 'python';
  }
  if (/^(package|func)\s+\w+/.test(trimmed)) {
    return 'go';
  }
  if (/^(fn|let\s+mut|impl)\s+/.test(trimmed)) {
    return 'rust';
  }
  if (/^(public|private|class)\s+(class|static|void)/.test(trimmed)) {
    return 'java';
  }
  if (/^\s*<[a-zA-Z]/.test(trimmed) && />\s*$/.test(trimmed)) {
    return 'markup';
  }
  if (/^SELECT|^INSERT|^UPDATE|^DELETE|^CREATE\s+TABLE/i.test(trimmed)) {
    return 'sql';
  }
  if (/^\{[\s\S]*\}$/.test(trimmed) || /^\[[\s\S]*\]$/.test(trimmed)) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {}
  }
  if (/^#!/.test(trimmed) || /^\s*\$\s/.test(trimmed)) {
    return 'bash';
  }
  
  return 'plaintext';
};

export const CodeBlock = ({ code, language }: CodeBlockProps) => {
  const codeRef = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);
  
  // Normalize language
  const normalizedLang = language 
    ? languageAliases[language.toLowerCase()] || language.toLowerCase()
    : detectLanguage(code);
  
  // Check if Prism has this language
  const hasLanguage = Prism.languages[normalizedLang] !== undefined;
  const finalLang = hasLanguage ? normalizedLang : 'plaintext';

  useEffect(() => {
    if (codeRef.current && hasLanguage) {
      Prism.highlightElement(codeRef.current);
    }
  }, [code, finalLang, hasLanguage]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-2 rounded-lg overflow-hidden bg-[hsl(var(--code-block-bg))] border border-border">
      {/* Header with language and copy button */}
      <div className="flex items-center justify-between px-4 py-2 bg-secondary/50 border-b border-border">
        <span className="text-xs text-muted-foreground font-mono uppercase">
          {finalLang === 'plaintext' ? 'code' : finalLang}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleCopy}
        >
          {copied ? (
            <>
              <Check className="w-3 h-3" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              Copy
            </>
          )}
        </Button>
      </div>
      
      {/* Code content */}
      <pre className="p-4 overflow-x-auto text-sm leading-relaxed m-0">
        <code 
          ref={codeRef} 
          className={`language-${finalLang} font-mono`}
        >
          {code}
        </code>
      </pre>
    </div>
  );
};

// Inline code component
export const InlineCode = ({ children }: { children: string }) => (
  <code className="px-1.5 py-0.5 mx-0.5 rounded bg-secondary font-mono text-sm text-primary">
    {children}
  </code>
);