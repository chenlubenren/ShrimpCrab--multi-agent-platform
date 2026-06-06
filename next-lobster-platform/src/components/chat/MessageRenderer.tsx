'use client';

import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface MessageRendererProps {
  content: string;
  className?: string;
  tone?: 'default' | 'inverse';
}

function containsHtml(content: string): boolean {
  return /<[a-z][\s\S]*>/i.test(content);
}

function containsMarkdownSyntax(content: string): boolean {
  return /(^|\n)\s*(#{1,6}\s|> |\* |- |\d+\.\s|```)|(\*\*|__|~~|`[^`]+`|\[[^\]]+\]\([^)]+\)|!\[[^\]]*\]\([^)]+\)|\|.+\|)/m.test(content);
}

function isRenderableImageSrc(src: string): boolean {
  const value = src.trim();
  if (!value) return false;
  if (/^data:image\//i.test(value)) return true;
  if (/^blob:/i.test(value)) return true;
  if (/^(https?:)?\/\//i.test(value)) return true;
  if (/^(\.?\.?\/|\/)/.test(value)) return true;

  try {
    return Boolean(new URL(value));
  } catch {
    return false;
  }
}

function isStandaloneImage(content: string): boolean {
  const value = content.trim();
  return isRenderableImageSrc(value) && /(?:\.(?:png|jpg|jpeg|gif|webp|svg)(?:[?#].*)?$)|^data:image\//i.test(value);
}

function ImageBlock({ src, alt }: { src: string; alt?: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const isValidUrl = useMemo(() => isRenderableImageSrc(src), [src]);

  return (
    <figure className="my-4 max-w-full">
      <div className="relative inline-block cursor-pointer" onClick={() => setExpanded((value) => !value)}>
        {!loaded && !error && (
          <div
            className="flex min-h-[150px] min-w-[200px] items-center justify-center border-4 border-pixel-black bg-pixel-black/10 animate-pulse"
          >
            <span className="font-pixel text-sm text-pixel-black/50">图片加载中...</span>
          </div>
        )}

        {error || !isValidUrl ? (
          <div className="inline-block border-4 border-pixel-black bg-pixel-red/20 p-4">
            <div className="flex items-center gap-2 font-pixel text-sm text-pixel-red">
              <span>×</span>
              <span>图片加载失败</span>
            </div>
            {src ? (
              <div className="mt-2 max-w-xs truncate font-mono text-xs text-pixel-black/50">{src}</div>
            ) : null}
          </div>
        ) : (
          <>
            <img
              src={src}
              alt={alt || '图片'}
              className={`max-w-full border-4 border-pixel-black transition-all duration-300 ${
                loaded ? 'opacity-100' : 'absolute opacity-0'
              } ${expanded ? 'max-h-none' : 'max-h-96'}`}
              onLoad={() => setLoaded(true)}
              onError={() => setError(true)}
              style={{ boxShadow: '4px 4px 0px 0px #101010' }}
              loading="lazy"
            />
            {!loaded ? (
              <div className="flex min-h-[150px] min-w-[200px] items-center justify-center border-4 border-pixel-black bg-pixel-black/10 animate-pulse">
                <span className="font-pixel text-sm text-pixel-black/50">加载中...</span>
              </div>
            ) : null}
          </>
        )}

        {loaded ? (
          <div className="absolute bottom-2 right-2 bg-pixel-black/70 px-2 py-1 font-pixel text-xs text-pixel-white">
            {expanded ? '点击缩小' : '点击放大'}
          </div>
        ) : null}
      </div>

      {alt ? (
        <figcaption className="mt-2 border-2 border-pixel-black/20 bg-pixel-black/5 px-2 py-1 text-center font-pixel text-xs text-pixel-black/60">
          {alt}
        </figcaption>
      ) : null}
    </figure>
  );
}

function CodeBlock({ code, language, filename }: { code: string; language: string; filename?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  }

  return (
    <div className="my-4 overflow-hidden rounded-none border-4 border-pixel-black">
      <div className="flex items-center justify-between bg-pixel-black px-4 py-2">
        <div className="flex items-center gap-3">
          {filename ? (
            <span className="flex items-center gap-2 font-pixel text-xs text-pixel-white/80">
              <span>文件</span>
              <span>{filename}</span>
            </span>
          ) : null}
          <span className="bg-pixel-white/10 px-2 py-0.5 font-pixel text-xs uppercase text-pixel-white/60">
            {language || 'code'}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="border-2 border-pixel-white/30 bg-pixel-white/20 px-3 py-1 font-pixel text-xs text-pixel-white transition-colors hover:bg-pixel-white/30"
        >
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <pre className="overflow-x-auto bg-[#1e1e1e] p-4 font-mono text-sm leading-relaxed text-pixel-white">
        <code className={language ? `language-${language}` : ''}>{code}</code>
      </pre>
    </div>
  );
}

function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const icons: Record<string, string> = {
    ts: 'TS',
    tsx: 'TSX',
    js: 'JS',
    jsx: 'JSX',
    py: 'PY',
    json: 'JSON',
    md: 'MD',
    css: 'CSS',
    html: 'HTML',
    scss: 'SCSS',
    png: 'IMG',
    jpg: 'IMG',
    jpeg: 'IMG',
    gif: 'IMG',
    webp: 'IMG',
    svg: 'SVG',
    pdf: 'PDF',
    txt: 'TXT',
    yaml: 'YAML',
    yml: 'YAML',
  };

  return icons[ext || ''] || 'FILE';
}

function FilePreviewBlock({ filename, content }: { filename: string; content?: string }) {
  const [expanded, setExpanded] = useState(false);
  const language = filename.split('.').pop() || '';
  const fileIcon = getFileIcon(filename);

  return (
    <div className="my-4 border-4 border-pixel-black bg-pixel-white">
      <div
        className="flex cursor-pointer items-center justify-between px-4 py-3 transition-colors hover:bg-pixel-black/5"
        onClick={() => setExpanded((value) => !value)}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold">{fileIcon}</span>
          <div>
            <div className="font-pixel text-sm text-pixel-black">{filename}</div>
            <div className="font-pixel text-xs text-pixel-black/50">{language.toUpperCase()}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-pixel text-xs text-pixel-black/50">
            {content ? `${content.split('\n').length} lines` : 'empty'}
          </span>
          <span className="font-pixel text-pixel-black/50">{expanded ? '收起' : '展开'}</span>
        </div>
      </div>

      {expanded && content ? (
        <div className="border-t-4 border-pixel-black">
          <pre className="max-h-80 overflow-x-auto bg-[#1e1e1e] p-4 font-mono text-xs text-pixel-white">
            <code>{content}</code>
          </pre>
        </div>
      ) : null}
    </div>
  );
}

export function MessageRenderer({ content, className = '', tone = 'default' }: MessageRendererProps) {
  const [viewMode, setViewMode] = useState<'render' | 'source'>('render');
  const hasOnlyImage = isStandaloneImage(content);
  const htmlContent = useMemo(() => containsHtml(content), [content]);
  const markdownContent = useMemo(() => containsMarkdownSyntax(content), [content]);
  const canToggleView = htmlContent || markdownContent;
  const sourceLanguage = htmlContent ? 'html' : 'md';
  const inverseTone = tone === 'inverse';
  const textColor = inverseTone ? 'text-pixel-white' : 'text-pixel-black';
  const mutedTextColor = inverseTone ? 'text-pixel-white/70' : 'text-pixel-black/70';
  const borderColor = inverseTone ? 'border-pixel-white/40' : 'border-pixel-black/20';
  const linkColor = inverseTone ? 'text-pixel-yellow hover:text-pixel-white' : 'text-pixel-blue hover:text-pixel-blue/70';

  useEffect(() => {
    setViewMode('render');
  }, [content]);

  if (hasOnlyImage) {
    return <ImageBlock src={content.trim()} />;
  }

  return (
    <div className={className}>
      {canToggleView ? (
        <div className="mb-3 flex items-center justify-end gap-2">
          <span className={`font-pixel text-[10px] ${mutedTextColor}`}>
            {htmlContent ? 'HTML' : 'Markdown'}
          </span>
          <div className={`inline-flex overflow-hidden border-2 ${inverseTone ? 'border-pixel-white/40' : 'border-pixel-black'}`}>
            <button
              type="button"
              onClick={() => setViewMode('render')}
              className={`px-2 py-1 font-pixel text-[10px] ${
                viewMode === 'render'
                  ? inverseTone
                    ? 'bg-pixel-white text-pixel-black'
                    : 'bg-pixel-black text-pixel-white'
                  : inverseTone
                    ? 'bg-pixel-white/10 text-pixel-white'
                    : 'bg-pixel-white text-pixel-black'
              }`}
            >
              渲染
            </button>
            <button
              type="button"
              onClick={() => setViewMode('source')}
              className={`border-l-2 px-2 py-1 font-pixel text-[10px] ${
                inverseTone ? 'border-pixel-white/40' : 'border-pixel-black'
              } ${
                viewMode === 'source'
                  ? inverseTone
                    ? 'bg-pixel-white text-pixel-black'
                    : 'bg-pixel-black text-pixel-white'
                  : inverseTone
                    ? 'bg-pixel-white/10 text-pixel-white'
                    : 'bg-pixel-white text-pixel-black'
              }`}
            >
              源码
            </button>
          </div>
        </div>
      ) : null}

      {viewMode === 'source' && canToggleView ? (
        <CodeBlock code={content} language={sourceLanguage} />
      ) : (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
            code: ({ className, children, ...props }) => {
              const match = /language-(\w+)/.exec(className || '');
              const isInline = !match && !className;

              if (isInline) {
                return (
                  <code
                    className={`px-1.5 py-0.5 font-mono text-sm ${
                      inverseTone
                        ? 'border border-pixel-white/20 bg-pixel-white/15 text-pixel-yellow'
                        : 'border border-pixel-black/30 bg-pixel-black/10 text-pixel-red'
                    }`}
                    {...props}
                  >
                    {children}
                  </code>
                );
              }

              return (
                <CodeBlock code={String(children).replace(/\n$/, '')} language={match ? match[1] : ''} />
              );
            },
            a: ({ href, children, ...props }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={`${linkColor} underline transition-colors`}
                {...props}
              >
                {children}
              </a>
            ),
            img: ({ src, alt }) => <ImageBlock src={src || ''} alt={alt} />,
            h1: ({ children }) => (
              <h1 className={`mt-4 mb-2 border-b-4 pb-2 font-pixel text-xl ${textColor} ${inverseTone ? 'border-pixel-white/40' : 'border-pixel-black'}`}>
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className={`mt-3 mb-2 flex items-center gap-2 font-pixel text-lg ${textColor}`}>
                <span className="h-6 w-2 bg-pixel-yellow" />
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className={`mt-2 mb-1 font-pixel text-base ${textColor}`}>{children}</h3>
            ),
            ul: ({ children }) => <ul className={`my-2 list-disc list-inside space-y-1 ${textColor}`}>{children}</ul>,
            ol: ({ children }) => <ol className={`my-2 list-decimal list-inside space-y-1 ${textColor}`}>{children}</ol>,
            li: ({ children }) => (
              <li className={`flex items-start gap-2 font-pixel text-sm ${textColor}`}>
                <span className="text-pixel-yellow">•</span>
                <span>{children}</span>
              </li>
            ),
            blockquote: ({ children }) => (
              <blockquote className={`my-3 border-l-4 border-pixel-yellow px-4 py-3 ${inverseTone ? 'bg-pixel-white/10' : 'bg-pixel-yellow/10'}`}>
                <div className={mutedTextColor}>{children}</div>
              </blockquote>
            ),
            hr: () => <hr className={`my-4 border-t-4 ${inverseTone ? 'border-pixel-white/30' : 'border-pixel-black'}`} />,
            p: ({ children }) => (
              <div className={`my-2 font-pixel text-sm leading-relaxed ${textColor}`}>{children}</div>
            ),
            table: ({ children }) => (
              <div className="my-4 overflow-x-auto">
                <table className={`w-full border-4 ${inverseTone ? 'border-pixel-white/40' : 'border-pixel-black'}`}>{children}</table>
              </div>
            ),
            thead: ({ children }) => (
              <thead className={inverseTone ? 'bg-pixel-white text-pixel-black' : 'bg-pixel-black text-pixel-white'}>
                {children}
              </thead>
            ),
            th: ({ children }) => (
              <th className={`border-b-4 px-4 py-2 text-left font-pixel text-sm ${inverseTone ? 'border-pixel-white/40 text-pixel-black' : 'border-pixel-black'}`}>
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className={`border-b-2 px-4 py-2 font-pixel text-sm ${textColor} ${borderColor}`}>{children}</td>
            ),
            strong: ({ children }) => <strong className={`font-bold ${textColor}`}>{children}</strong>,
            em: ({ children }) => <em className={`italic ${inverseTone ? 'text-pixel-white/85' : 'text-pixel-black/80'}`}>{children}</em>,
          }}
        >
          {content}
        </ReactMarkdown>
      )}
    </div>
  );
}

export { ImageBlock, CodeBlock, FilePreviewBlock };
