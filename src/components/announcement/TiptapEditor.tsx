import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import { useEffect, forwardRef, useImperativeHandle } from 'react';

interface TiptapEditorProps {
  value: string;
  onChange: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
}

export interface TiptapEditorRef {
  editor: Editor | null;
  dom: HTMLDivElement | null;
}

export const TiptapEditor = forwardRef<TiptapEditorRef, TiptapEditorProps>(
  ({ value, onChange, onFocus, onBlur, placeholder }, ref) => {
    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3],
          },
          horizontalRule: false, // We'll use our own
        }),
        Placeholder.configure({
          placeholder: placeholder || 'What do you want to announce?',
        }),
        TextAlign.configure({
          types: ['heading', 'paragraph'],
          defaultAlignment: 'left',
        }),
        Image.extend({
          addAttributes() {
            return {
              ...this.parent?.(),
              width: {
                default: null,
                parseHTML: element => element.getAttribute('width'),
                renderHTML: attributes => {
                  if (!attributes.width) return {};
                  return { width: attributes.width };
                },
              },
              height: {
                default: null,
                parseHTML: element => element.getAttribute('height'),
                renderHTML: attributes => {
                  if (!attributes.height) return {};
                  return { height: attributes.height };
                },
              },
              align: {
                default: 'left',
                parseHTML: element => {
                  const align = element.getAttribute('data-align') || 
                                element.closest('[style*="text-align"]')?.getAttribute('style')?.match(/text-align:\s*(\w+)/)?.[1] ||
                                'left';
                  return ['left', 'center', 'right'].includes(align) ? align : 'left';
                },
                renderHTML: attributes => {
                  if (!attributes.align || attributes.align === 'left') return {};
                  return {
                    'data-align': attributes.align,
                    style: `display: block; margin: 0 auto; ${attributes.align === 'center' ? 'text-align: center;' : attributes.align === 'right' ? 'text-align: right;' : ''}`,
                  };
                },
              },
            };
          },
        }).configure({
          inline: false,
          allowBase64: false,
          HTMLAttributes: {
            class: 'rounded-lg my-2 cursor-pointer hover:opacity-90 max-w-full image-resizable',
            loading: 'lazy',
          },
        }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: 'message-link',
          },
        }),
        Underline,
        HorizontalRule.extend({
          renderHTML() {
            return ['div', {
              class: 'separator-dots my-4 text-center text-muted-foreground',
              style: 'font-size: 1.5rem; letter-spacing: 0.5rem;',
            }, '•••'];
          },
        }),
      ],
      content: value,
      onUpdate: ({ editor }) => {
        // Convert to markdown-like format
        const html = editor.getHTML();
        const markdown = htmlToMarkdown(html);
        onChange(markdown);
      },
      onFocus,
      onBlur,
      editorProps: {
        attributes: {
          class: 'min-h-[200px] resize-none bg-transparent border-0 focus-visible:ring-0 outline-none text-[14px] leading-[1.5] font-[Inter,system-ui,sans-serif] whitespace-pre-wrap break-words prose prose-sm max-w-none [&_p]:m-0 [&_p]:leading-[1.5] [&_h1]:text-2xl [&_h1]:font-medium [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-xl [&_h2]:font-medium [&_h3]:text-lg [&_h3]:font-medium [&_h3]:mt-2 [&_h3]:mb-1 [&_img[data-align="center"]]:block [&_img[data-align="center"]]:mx-auto [&_img[data-align="right"]]:block [&_img[data-align="right"]]:ml-auto [&_img[data-align="left"]]:block [&_hr]:my-4 [&_hr]:border-t-2 [&_hr]:border-dotted [&_hr]:border-muted-foreground/50',
        },
      },
    });

    // Update editor content when value prop changes (but not when user is typing)
    useEffect(() => {
      if (!editor) return;
      
      const currentHtml = editor.getHTML();
      const currentMarkdown = htmlToMarkdown(currentHtml);
      
      // Only update if value actually changed from outside
      if (currentMarkdown !== value && value !== undefined) {
        const htmlContent = markdownToHtml(value);
        editor.commands.setContent(htmlContent, { emitUpdate: false });
      }
    }, [value, editor]);

    // Expose editor instance and DOM element
    useImperativeHandle(ref, () => ({
      editor,
      dom: editor?.view.dom as HTMLDivElement || null,
    }), [editor]);

    // Add image controls when image is selected or clicked
    useEffect(() => {
      if (!editor) return;

      const removeControls = () => {
        const existingControls = document.querySelector('.image-controls-toolbar');
        if (existingControls) {
          existingControls.remove();
        }
      };

      const showImageControls = (imgElement: HTMLImageElement) => {
        removeControls();
        
        // Get image node from the DOM - try multiple methods
        let pos: number;
        let node: any;
        
        try {
          pos = editor.view.posAtDOM(imgElement, 0);
          const $pos = editor.state.doc.resolve(pos);
          node = $pos.nodeAfter || $pos.nodeBefore;
          
          // If that didn't work, try finding the position by walking the DOM
          if (!node || node.type.name !== 'image') {
            const walker = document.createTreeWalker(
              editor.view.dom,
              NodeFilter.SHOW_ELEMENT,
              null
            );
            
            let currentPos = 0;
            let found = false;
            while (walker.nextNode()) {
              const el = walker.currentNode as HTMLElement;
              if (el === imgElement || el.contains(imgElement)) {
                try {
                  pos = editor.view.posAtDOM(el, 0);
                  const $pos = editor.state.doc.resolve(pos);
                  node = $pos.nodeAfter || $pos.nodeBefore;
                  if (node && node.type.name === 'image') {
                    found = true;
                    break;
                  }
                } catch (e) {
                  // Continue searching
                }
              }
            }
            
            if (!found) {
              // Last resort: search all image nodes
              editor.state.doc.descendants((node, pos) => {
                if (node.type.name === 'image') {
                  const dom = editor.view.nodeDOM(pos);
                  if (dom === imgElement || (dom as HTMLElement)?.contains?.(imgElement)) {
                    node = node;
                    pos = pos;
                    return false; // Stop searching
                  }
                }
              });
            }
          }
        } catch (e) {
          // Fallback: get attributes from DOM
          const align = imgElement.getAttribute('data-align') || 'left';
          const width = imgElement.getAttribute('width') || '400';
          
          // Create controls toolbar with DOM attributes
          const toolbar = document.createElement('div');
          toolbar.className = 'image-controls-toolbar flex items-center gap-1 bg-popover border border-border rounded-lg shadow-lg p-1 z-50';
          toolbar.innerHTML = `
            <button data-align="left" class="p-1.5 rounded hover:bg-muted ${align === 'left' ? 'bg-muted' : ''}" title="Align Left">←</button>
            <button data-align="center" class="p-1.5 rounded hover:bg-muted ${align === 'center' ? 'bg-muted' : ''}" title="Align Center">↔</button>
            <button data-align="right" class="p-1.5 rounded hover:bg-muted ${align === 'right' ? 'bg-muted' : ''}" title="Align Right">→</button>
            <div class="w-px h-5 bg-border mx-1"></div>
            <button data-resize="-50" class="p-1.5 rounded hover:bg-muted" title="Smaller">−</button>
            <button data-resize="50" class="p-1.5 rounded hover:bg-muted" title="Larger">+</button>
          `;
          
          const rect = imgElement.getBoundingClientRect();
          toolbar.style.position = 'fixed';
          toolbar.style.top = `${rect.top - 48}px`;
          toolbar.style.left = `${rect.left + rect.width / 2}px`;
          toolbar.style.transform = 'translateX(-50%)';
          
          toolbar.querySelectorAll('[data-align]').forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              const newAlign = (e.target as HTMLElement).getAttribute('data-align');
              if (newAlign) {
                imgElement.setAttribute('data-align', newAlign);
                imgElement.style.display = 'block';
                imgElement.style.marginLeft = newAlign === 'center' ? 'auto' : newAlign === 'right' ? 'auto' : '0';
                imgElement.style.marginRight = newAlign === 'center' ? 'auto' : newAlign === 'right' ? '0' : 'auto';
                // Trigger editor update
                editor.view.dispatch(editor.state.tr);
              }
            });
          });
          
          toolbar.querySelectorAll('[data-resize]').forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              const delta = parseInt((e.target as HTMLElement).getAttribute('data-resize') || '0', 10);
              const currentWidth = parseInt(width, 10);
              const newWidth = Math.max(100, Math.min(800, currentWidth + delta));
              imgElement.setAttribute('width', String(newWidth));
              imgElement.style.width = `${newWidth}px`;
              // Trigger editor update
              editor.view.dispatch(editor.state.tr);
            });
          });
          
          document.body.appendChild(toolbar);
          return;
        }
        
        if (!node || node.type.name !== 'image') return;
        
        // Create controls toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'image-controls-toolbar flex items-center gap-1 bg-popover border border-border rounded-lg shadow-lg p-1 z-50';
        toolbar.innerHTML = `
          <button data-align="left" class="p-1.5 rounded hover:bg-muted ${node.attrs.align === 'left' ? 'bg-muted' : ''}" title="Align Left">←</button>
          <button data-align="center" class="p-1.5 rounded hover:bg-muted ${node.attrs.align === 'center' ? 'bg-muted' : ''}" title="Align Center">↔</button>
          <button data-align="right" class="p-1.5 rounded hover:bg-muted ${node.attrs.align === 'right' ? 'bg-muted' : ''}" title="Align Right">→</button>
          <div class="w-px h-5 bg-border mx-1"></div>
          <button data-resize="-50" class="p-1.5 rounded hover:bg-muted" title="Smaller">−</button>
          <button data-resize="50" class="p-1.5 rounded hover:bg-muted" title="Larger">+</button>
        `;
        
        // Position toolbar relative to image
        const rect = imgElement.getBoundingClientRect();
        toolbar.style.position = 'fixed';
        toolbar.style.top = `${rect.top - 48}px`;
        toolbar.style.left = `${rect.left + rect.width / 2}px`;
        toolbar.style.transform = 'translateX(-50%)';
        
        // Add event listeners
        toolbar.querySelectorAll('[data-align]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const align = (e.target as HTMLElement).getAttribute('data-align') as 'left' | 'center' | 'right';
            if (align) {
              try {
                editor.chain().focus().setNodeSelection(pos).updateAttributes('image', { align }).run();
              } catch (e) {
                // Fallback to DOM manipulation
                imgElement.setAttribute('data-align', align);
                editor.view.dispatch(editor.state.tr);
              }
            }
          });
        });
        
        toolbar.querySelectorAll('[data-resize]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const delta = parseInt((e.target as HTMLElement).getAttribute('data-resize') || '0', 10);
            const currentWidth = parseInt(node.attrs.width || '400', 10);
            const newWidth = Math.max(100, Math.min(800, currentWidth + delta));
            try {
              editor.chain().focus().setNodeSelection(pos).updateAttributes('image', { width: String(newWidth) }).run();
            } catch (e) {
              // Fallback to DOM manipulation
              imgElement.setAttribute('width', String(newWidth));
              editor.view.dispatch(editor.state.tr);
            }
          });
        });
        
        document.body.appendChild(toolbar);
      };

      const handleClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const img = target.closest('img');
        if (img && editor.view.dom.contains(img)) {
          e.preventDefault();
          e.stopPropagation();
          // Select the image node first
          try {
            const pos = editor.view.posAtDOM(img, 0);
            editor.chain().setNodeSelection(pos).run();
          } catch (e) {
            // If selection fails, still show controls
          }
          showImageControls(img);
        } else if (!target.closest('.image-controls-toolbar')) {
          removeControls();
        }
      };
      
      // Handle clicks outside to remove controls
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.image-controls-toolbar') && !target.closest('img')) {
          removeControls();
        }
      };

      const handleSelectionUpdate = () => {
        const { selection } = editor.state;
        
        // Check if an image node is selected (NodeSelection has a node property)
        const nodeSelection = selection as { node?: { type: { name: string } } };
        if (nodeSelection.node && nodeSelection.node.type.name === 'image') {
          // Find the image element in the DOM
          try {
            const pos = selection.$anchor.pos;
            const dom = editor.view.domAtPos(pos);
            const imgElement = (dom.node.nodeType === Node.ELEMENT_NODE && (dom.node as HTMLElement).tagName === 'IMG')
              ? dom.node as HTMLImageElement
              : (dom.node.parentElement?.closest('img') as HTMLImageElement);
            
            if (imgElement) {
              showImageControls(imgElement);
              return;
            }
          } catch (e) {
            // Fall through to try finding by walking
          }
          
          // Alternative: find all images and match by src
          const allImages = editor.view.dom.querySelectorAll('img');
          const imgNode = nodeSelection.node as { attrs?: { src?: string } };
          for (const img of Array.from(allImages)) {
            if (img.getAttribute('src') === imgNode.attrs?.src) {
              showImageControls(img as HTMLImageElement);
              return;
            }
          }
        }
        
        // Also check if selection is inside an image
        const { $from } = selection;
        const imageNode = $from.node(-1);
        if (imageNode && imageNode.type.name === 'image') {
          const allImages = editor.view.dom.querySelectorAll('img');
          for (const img of Array.from(allImages)) {
            if (img.getAttribute('src') === imageNode.attrs.src) {
              showImageControls(img as HTMLImageElement);
              return;
            }
          }
        }
        
        // If no image selected, remove controls (unless clicking on toolbar)
        if (!document.activeElement?.closest('.image-controls-toolbar')) {
          removeControls();
        }
      };

      // Listen for clicks on images
      editor.view.dom.addEventListener('click', handleClick);
      document.addEventListener('click', handleClickOutside);
      editor.on('selectionUpdate', handleSelectionUpdate);

      return () => {
        editor.view.dom.removeEventListener('click', handleClick);
        document.removeEventListener('click', handleClickOutside);
        removeControls();
      };
    }, [editor]);

    if (!editor) {
      return null;
    }

    return <EditorContent editor={editor} />;
  }
);

TiptapEditor.displayName = 'TiptapEditor';

// Convert HTML to markdown
function htmlToMarkdown(html: string): string {
  if (!html.trim()) return '';
  
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  let markdown = '';

  const ensureBlockSeparation = () => {
    if (markdown && !markdown.endsWith('\n')) markdown += '\n';
  };
  
  const processNode = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      markdown += node.textContent || '';
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const children = Array.from(el.childNodes);
      const isBlock = ['h1', 'h2', 'h3', 'p', 'pre', 'hr', 'div'].includes(tag);

      if (isBlock) {
        ensureBlockSeparation();
      }
      
      switch (tag) {
        case 'h1':
          markdown += '# ' + el.textContent?.trim() + '\n';
          break;
        case 'h2':
          markdown += '## ' + el.textContent?.trim() + '\n';
          break;
        case 'h3':
          markdown += '### ' + el.textContent?.trim() + '\n';
          break;
        case 'p':
          // Preserve empty lines (<p><br></p>) as a single newline.
          if (children.length === 1 && children[0].nodeType === Node.ELEMENT_NODE) {
            const onlyChild = children[0] as HTMLElement;
            if (onlyChild.tagName.toLowerCase() === 'br') {
              if (!markdown.endsWith('\n')) markdown += '\n';
              break;
            }
          }

          children.forEach(processNode);
          if (!markdown.endsWith('\n')) markdown += '\n';
          break;
        case 'br':
          markdown += '\n';
          break;
        case 'strong':
          markdown += '**';
          children.forEach(processNode);
          markdown += '**';
          break;
        case 'em':
          markdown += '*';
          children.forEach(processNode);
          markdown += '*';
          break;
        case 'del':
          markdown += '~~';
          children.forEach(processNode);
          markdown += '~~';
          break;
        case 'u':
          markdown += '__';
          children.forEach(processNode);
          markdown += '__';
          break;
        case 'code':
          // Check if it's a code block
          if (el.parentElement?.tagName.toLowerCase() === 'pre') {
            // Code block - handled by parent
            children.forEach(processNode);
          } else {
            // Inline code
            markdown += '`';
            children.forEach(processNode);
            markdown += '`';
          }
          break;
        case 'pre':
          markdown += '```\n';
          const codeEl = el.querySelector('code');
          if (codeEl) {
            markdown += codeEl.textContent || '';
          }
          markdown += '\n```\n';
          break;
        case 'a':
          const href = el.getAttribute('href') || '';
          markdown += '[';
          children.forEach(processNode);
          markdown += `](${href})`;
          break;
        case 'img':
          const src = el.getAttribute('src') || '';
          const align = el.getAttribute('data-align') || 'left';
          const width = el.getAttribute('width');
          if (src) {
            if (markdown && !markdown.endsWith(' ') && !markdown.endsWith('\n')) {
              markdown += ' ';
            }
            // Store image with alignment and width in a custom format
            markdown += `[img:${align}:${width || 'auto'}:${src}]`;
            markdown += ' ';
          }
          break;
        case 'hr':
          markdown += '\n---\n';
          break;
        case 'div':
          // Check if it's a separator dots div
          if (el.classList.contains('separator-dots')) {
            markdown += '\n---\n';
          } else {
            children.forEach(processNode);
            // Treat divs as blocks to avoid merging adjacent lines (e.g., when the editor outputs div blocks).
            if (!markdown.endsWith('\n')) markdown += '\n';
          }
          break;
        default:
          children.forEach(processNode);
      }
    }
  };
  
  Array.from(temp.childNodes).forEach(processNode);
  
  // Clean up
  return markdown
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

// Convert markdown to HTML (simplified - Tiptap will handle the actual rendering)
function markdownToHtml(markdown: string): string {
  if (!markdown.trim()) return '';
  
  let html = markdown;
  
  // Headings
  html = html.replace(/^###\s+(.+?)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+?)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+?)$/gm, '<h1>$1</h1>');
  
  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Italic
  html = html.replace(/(?<![:/])\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  
  // Strikethrough
  html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  
  // Underline
  html = html.replace(/__([^_]+)__/g, '<u>$1</u>');
  
  // Code blocks
  html = html.replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>');
  
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  // Separator (horizontal rule) - can be --- or ***
  html = html.replace(/^---$/gm, '<hr>');
  html = html.replace(/^\*\*\*$/gm, '<hr>');
  
  // Images with custom format [img:align:width:url]
  html = html.replace(/\[img:(\w+):([^:]+):([^\]]+)\]/g, (match, align, width, url) => {
    const widthAttr = width !== 'auto' ? ` width="${width}"` : '';
    return `<img src="${url}" alt="Image" data-align="${align}"${widthAttr} />`;
  });
  
  // Regular image URLs
  const imageUrlPattern = /(https?:\/\/[^\s<]+\.(?:gif|jpe?g|png|webp|bmp|svg)(?:\?.*)?)/gi;
  html = html.replace(imageUrlPattern, (url) => {
    return `<img src="${url}" alt="Image" data-align="left" />`;
  });
  
  // Line breaks
  html = html.replace(/\n/g, '<br>');
  
  // Wrap in paragraphs
  const lines = html.split('<br>');
  html = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    // Don't wrap headings or code blocks
    if (trimmed.startsWith('<h') || trimmed.startsWith('<pre') || trimmed.startsWith('<code')) {
      return trimmed;
    }
    return `<p>${trimmed}</p>`;
  }).join('');
  
  return html;
}
