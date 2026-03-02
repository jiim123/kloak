import { useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from "react";
import { parseTextContent } from "@/components/chat/MessageContent";

interface RichTextEditorProps {
  value: string;
  onChange: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
}

export const RichTextEditor = forwardRef<HTMLDivElement, RichTextEditorProps>(
  ({ value, onChange, onFocus, onBlur, placeholder }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const isUpdatingRef = useRef(false);
    const lastValueRef = useRef(value);

    // Expose ref to parent
    useImperativeHandle(ref, () => editorRef.current as HTMLDivElement);

    // Convert formatted HTML back to markdown by walking the DOM
    const htmlToMarkdown = useCallback((html: string): string => {
      if (!html.trim()) return "";
      
      const temp = document.createElement('div');
      temp.innerHTML = html;
      
      let markdown = "";
      let lastWasBlock = false;
      
      const processNode = (node: Node): void => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || "";
          markdown += text;
          lastWasBlock = false;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          const tag = el.tagName.toLowerCase();
          const children = Array.from(el.childNodes);
          const isBlock = ['h1', 'h2', 'h3', 'p', 'div'].includes(tag);
          
          // Add newline before block elements (except first, and only if not already a newline)
          if (isBlock && markdown && !markdown.endsWith('\n') && lastWasBlock === false) {
            // Only add newline if there's content before
            if (markdown.trim().length > 0) {
              markdown += '\n';
            }
          }
          
          if (tag === 'h1') {
            const text = el.textContent?.trim() || "";
            if (text) {
              if (markdown && !markdown.endsWith('\n')) {
                markdown += '\n';
              }
              markdown += '# ' + text + '\n';
              lastWasBlock = true;
            }
          } else if (tag === 'h2') {
            const text = el.textContent?.trim() || "";
            if (text) {
              if (markdown && !markdown.endsWith('\n')) {
                markdown += '\n';
              }
              markdown += '## ' + text + '\n';
              lastWasBlock = true;
            }
          } else if (tag === 'h3') {
            const text = el.textContent?.trim() || "";
            if (text) {
              if (markdown && !markdown.endsWith('\n')) {
                markdown += '\n';
              }
              markdown += '### ' + text + '\n';
              lastWasBlock = true;
            }
          } else if (tag === 'br') {
            // Single <br> = single newline, but don't add if already at newline
            if (!markdown.endsWith('\n')) {
              markdown += '\n';
            }
            lastWasBlock = false;
          } else if (tag === 'strong') {
            markdown += '**';
            children.forEach(processNode);
            markdown += '**';
            lastWasBlock = false;
          } else if (tag === 'em') {
            markdown += '*';
            children.forEach(processNode);
            markdown += '*';
            lastWasBlock = false;
          } else if (tag === 'del') {
            markdown += '~~';
            children.forEach(processNode);
            markdown += '~~';
            lastWasBlock = false;
          } else if (tag === 'u') {
            markdown += '__';
            children.forEach(processNode);
            markdown += '__';
            lastWasBlock = false;
          } else if (tag === 'img') {
            // Extract image URL from data attribute or src
            const imgUrl = (el as HTMLImageElement).src || (el as HTMLImageElement).dataset.imageUrl || "";
            if (imgUrl) {
              // Add space before if needed (not at start, not after space/newline)
              if (markdown && !markdown.endsWith(' ') && !markdown.endsWith('\n')) {
                markdown += ' ';
              }
              markdown += imgUrl;
              // Add space after
              markdown += ' ';
            }
            lastWasBlock = false;
          } else if (tag === 'p' || tag === 'div') {
            // Check if this is an empty paragraph/div (just whitespace or <br>)
            const hasOnlyBr = children.length === 1 && children[0].nodeType === Node.ELEMENT_NODE && 
                              (children[0] as HTMLElement).tagName.toLowerCase() === 'br';
            const hasContent = el.textContent?.trim();
            
            if (hasContent && !hasOnlyBr) {
              // Process children
              children.forEach(processNode);
              // Only add newline after if there's actual content
              if (!markdown.endsWith('\n')) {
                markdown += '\n';
              }
              lastWasBlock = true;
            } else if (hasOnlyBr) {
              // Empty paragraph with just <br> = single newline
              if (!markdown.endsWith('\n')) {
                markdown += '\n';
              }
              lastWasBlock = false;
            } else {
              // Empty paragraph/div, skip it
              lastWasBlock = false;
            }
          } else {
            // For other elements (spans, etc.), process children without adding newlines
            children.forEach(processNode);
            lastWasBlock = false;
          }
        }
      };
      
      Array.from(temp.childNodes).forEach(processNode);
      
      // Clean up: normalize newlines but preserve intentional line breaks
      let cleaned = markdown
        .replace(/\r\n/g, '\n') // Normalize line endings
        .replace(/\r/g, '\n')
        .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
        .replace(/[ \t]+$/gm, ''); // Remove trailing spaces/tabs from each line
      
      // Don't remove leading/trailing newlines if they're intentional
      // Just trim excessive ones
      return cleaned;
    }, []);

    // Initialize with value on mount
    useEffect(() => {
      if (!editorRef.current) return;
      const editor = editorRef.current;
      if (editor.innerHTML === "" && value) {
        isUpdatingRef.current = true;
        const valueWithNewlines = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const formatted = valueWithNewlines.trim() ? parseTextContent(valueWithNewlines) : "";
        editor.innerHTML = formatted;
        lastValueRef.current = value;
        isUpdatingRef.current = false;
      }
    }, []);

    // Update formatted content when value changes (but not when user is typing)
    useEffect(() => {
      if (isUpdatingRef.current || !editorRef.current) return;
      
      const editor = editorRef.current;
      // Get current markdown from HTML
      const currentHtml = editor.innerHTML;
      const currentMarkdown = htmlToMarkdown(currentHtml);
      
      // Normalize both for comparison (trim and normalize newlines)
      const normalizedCurrent = currentMarkdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
      const normalizedValue = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
      
      // Only skip update if markdown is exactly the same AND we're not in the middle of typing
      // Always format when value changes to ensure real-time preview
      if (normalizedCurrent === normalizedValue && normalizedValue !== "" && lastValueRef.current === value) {
        // Check if HTML needs formatting by comparing with what parseTextContent would produce
        const valueWithNewlines = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const expectedFormatted = valueWithNewlines.trim() ? parseTextContent(valueWithNewlines) : "";
        // Only skip if HTML is already correctly formatted
        if (editor.innerHTML.trim() === expectedFormatted.trim()) {
          return;
        }
      }

      const selection = window.getSelection();
      const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      
      // Save cursor position relative to plain text
      let cursorOffset = 0;
      if (range && editor.contains(range.commonAncestorContainer)) {
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(editor);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        cursorOffset = preCaretRange.toString().length;
      }

      // Update HTML with formatted content
      isUpdatingRef.current = true;
      // Ensure value has proper newlines for headings to work
      const valueWithNewlines = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const formatted = valueWithNewlines.trim() ? parseTextContent(valueWithNewlines) : "";
      
      // Normalize HTML: convert block elements created by contentEditable to <br> tags
      // This prevents extra newlines when converting back to markdown
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = formatted || "";
      
      // Replace empty <p> and <div> with <br>
      const emptyBlocks = tempDiv.querySelectorAll('p:empty, div:empty');
      emptyBlocks.forEach(block => {
        const br = document.createElement('br');
        block.replaceWith(br);
      });
      
      // Replace <p> and <div> that only contain <br> with just <br>
      const brOnlyBlocks = Array.from(tempDiv.querySelectorAll('p, div')).filter(el => {
        const children = Array.from(el.childNodes);
        return children.length === 1 && 
               children[0].nodeType === Node.ELEMENT_NODE && 
               (children[0] as HTMLElement).tagName.toLowerCase() === 'br';
      });
      brOnlyBlocks.forEach(block => {
        const br = document.createElement('br');
        block.replaceWith(br);
      });
      
      editor.innerHTML = tempDiv.innerHTML || "";

      // Restore cursor position
      if (cursorOffset > 0 && formatted) {
        requestAnimationFrame(() => {
          try {
            const newSelection = window.getSelection();
            if (!newSelection) return;

            const newRange = document.createRange();
            const walker = document.createTreeWalker(
              editor,
              NodeFilter.SHOW_TEXT,
              null
            );
            
            let currentOffset = 0;
            let targetNode: Node | null = null;
            let targetOffset = 0;

            while (walker.nextNode()) {
              const node = walker.currentNode;
              const nodeLength = node.textContent?.length || 0;
              if (currentOffset + nodeLength >= cursorOffset) {
                targetNode = node;
                targetOffset = cursorOffset - currentOffset;
                break;
              }
              currentOffset += nodeLength;
            }

            if (targetNode && targetNode.textContent) {
              newRange.setStart(targetNode, Math.min(targetOffset, targetNode.textContent.length));
              newRange.collapse(true);
              newSelection.removeAllRanges();
              newSelection.addRange(newRange);
            } else {
              // Fallback: place cursor at end
              const fallbackRange = document.createRange();
              fallbackRange.selectNodeContents(editor);
              fallbackRange.collapse(false);
              newSelection.removeAllRanges();
              newSelection.addRange(fallbackRange);
            }
          } catch (e) {
            // Fallback: place cursor at end
            const fallbackRange = document.createRange();
            fallbackRange.selectNodeContents(editor);
            fallbackRange.collapse(false);
            const newSelection = window.getSelection();
            newSelection?.removeAllRanges();
            newSelection?.addRange(fallbackRange);
          }
        });
      } else if (value === "" && editor.innerHTML !== "") {
        // Clear content
        editor.innerHTML = "";
      }

      lastValueRef.current = value;
      isUpdatingRef.current = false;
    }, [value, htmlToMarkdown]);

    const handleInput = () => {
      if (isUpdatingRef.current || !editorRef.current) return;
      
      const editor = editorRef.current;
      // Convert HTML back to markdown to preserve formatting
      const html = editor.innerHTML;
      const text = htmlToMarkdown(html);
      
      // Update if markdown changed
      if (text !== lastValueRef.current) {
        lastValueRef.current = text;
        onChange(text);
      }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, text);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      // Handle Enter key - insert single newline (single <br>, not block element)
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || !editorRef.current) return;
        
        const editor = editorRef.current;
        const range = selection.getRangeAt(0);
        
        // Always insert <br> directly, never let contentEditable create block elements
        const br = document.createElement('br');
        
        // Delete any selected content first
        range.deleteContents();
        
        // Insert the br
        range.insertNode(br);
        
        // Move cursor after the br
        range.setStartAfter(br);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Trigger input event immediately
        isUpdatingRef.current = false; // Allow input handler to run
        editor.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };

    return (
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        className="min-h-[200px] resize-none bg-transparent border-0 focus-visible:ring-0 outline-none text-[14px] leading-[1.5] font-[Inter,system-ui,sans-serif] whitespace-pre-wrap break-words [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-muted-foreground [&_p]:inline [&_div]:inline [&_p]:m-0 [&_div]:m-0"
        style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
      />
    );
  }
);

RichTextEditor.displayName = "RichTextEditor";
