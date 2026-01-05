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
  const lines = trimmed.split('\n');
  const firstLine = lines[0] || '';
  
  // Check for shebang first
  if (/^#!.*python/i.test(firstLine)) return 'python';
  if (/^#!.*node|^#!.*bash|^#!.*sh/i.test(firstLine)) return 'bash';
  
  // Python patterns - check multiple indicators
  const pythonPatterns = [
    /^(def|class|async def)\s+\w+\s*\(/m,
    /^from\s+\w+\s+import/m,
    /^import\s+\w+(\s*,\s*\w+)*\s*$/m,
    /^\s*if\s+__name__\s*==\s*['"]__main__['"]/m,
    /:\s*$\n\s+(pass|return|raise|yield)/m,
    /\bprint\s*\(/,
    /\bself\./,
    /\bNone\b|\bTrue\b|\bFalse\b/,
  ];
  if (pythonPatterns.some(p => p.test(trimmed))) return 'python';
  
  // TypeScript patterns (before JavaScript)
  const tsPatterns = [
    /:\s*(string|number|boolean|any|void|never|unknown)\b/,
    /interface\s+\w+/,
    /type\s+\w+\s*=/,
    /<[A-Z]\w*>/,  // Generics
    /as\s+(string|number|boolean|any)/,
  ];
  if (tsPatterns.some(p => p.test(trimmed))) return 'typescript';
  
  // JavaScript/ES6 patterns
  const jsPatterns = [
    /^import\s+.*from\s+['"]/m,
    /^export\s+(default\s+)?(function|class|const|let|var)/m,
    /^(const|let|var)\s+\w+\s*=/m,
    /=>\s*{/,
    /\bconsole\.(log|error|warn)\s*\(/,
    /document\.|window\./,
    /\bfunction\s+\w+\s*\(/,
    /\bnew\s+(Promise|Map|Set|Array|Object)\(/,
  ];
  if (jsPatterns.some(p => p.test(trimmed))) return 'javascript';
  
  // HTML/XML
  if (/^\s*<(!DOCTYPE|html|head|body|div|span|p|a|script|style)/i.test(trimmed)) return 'markup';
  if (/^\s*<\?xml/i.test(trimmed)) return 'markup';
  if (/^\s*<[a-zA-Z][\s\S]*>\s*$/m.test(trimmed) && /<\/[a-zA-Z]+>\s*$/.test(trimmed)) return 'markup';
  
  // CSS
  if (/^\s*(\.|#|@media|@keyframes|:root)\s*[\w-]+\s*{/m.test(trimmed)) return 'css';
  if (/{\s*(color|background|margin|padding|display|flex|grid):/m.test(trimmed)) return 'css';
  
  // SQL
  if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\s/im.test(trimmed)) return 'sql';
  
  // JSON
  if (/^\s*[\[{]/.test(trimmed) && /[\]}]\s*$/.test(trimmed)) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {}
  }
  
  // YAML
  if (/^\s*[\w-]+:\s*(\n|$)/m.test(trimmed) && !/{/.test(firstLine)) return 'yaml';
  
  // Bash/Shell
  if (/^#!/.test(trimmed) || /^\s*\$\s/.test(trimmed)) return 'bash';
  if (/^(if|for|while|case|function)\s.*;\s*(then|do)/m.test(trimmed)) return 'bash';
  
  // Go
  if (/^package\s+\w+/m.test(trimmed) || /^func\s+(\(\w+\s+\*?\w+\)\s+)?\w+\s*\(/m.test(trimmed)) return 'go';
  
  // Rust
  if (/^(fn|pub fn|impl|struct|enum|trait|use)\s+/m.test(trimmed)) return 'rust';
  if (/let\s+mut\s+\w+/.test(trimmed)) return 'rust';
  
  // Java
  if (/^(public|private|protected)\s+(class|interface|enum|static|void)/m.test(trimmed)) return 'java';
  if (/System\.out\.print/.test(trimmed)) return 'java';
  
  // C#
  if (/^(public|private|protected|internal)\s+.*\s+(class|interface|struct|enum)/m.test(trimmed)) return 'csharp';
  if (/\bConsole\.(WriteLine|ReadLine)/.test(trimmed)) return 'csharp';
  
  // C/C++
  if (/^#include\s*[<"]/m.test(trimmed)) return 'cpp';
  if (/^(int|void|char|float|double)\s+main\s*\(/m.test(trimmed)) return 'c';
  if (/std::|cout|cin|endl/.test(trimmed)) return 'cpp';
  
  // PHP
  if (/^<\?php/i.test(trimmed) || /\$\w+\s*=/.test(trimmed)) return 'php';
  
  // Ruby
  if (/^(def|class|module|require|gem)\s+/m.test(trimmed)) return 'ruby';
  if (/\bputs\s+/.test(trimmed) || /\.each\s+do\s*\|/.test(trimmed)) return 'ruby';
  
  // Markdown
  if (/^#{1,6}\s+\w/m.test(trimmed) || /^\s*[-*+]\s+\w/m.test(trimmed)) return 'markdown';
  
  return 'javascript'; // Default to JavaScript for better highlighting than plaintext
};

export const CodeBlock = ({ code, language }: CodeBlockProps) => {
  const codeRef = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);
  
  // Normalize language
  const normalizedLang = language 
    ? languageAliases[language.toLowerCase()] || language.toLowerCase()
    : detectLanguage(code);
  
  // Check if Prism has this language, fallback to javascript for better highlighting
  const hasLanguage = Prism.languages[normalizedLang] !== undefined;
  const finalLang = hasLanguage ? normalizedLang : 'javascript';

  useEffect(() => {
    if (codeRef.current && Prism.languages[finalLang]) {
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