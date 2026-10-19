import React, { useMemo } from 'react';
import { marked } from 'marked';
import { AlertCircle, FileCode, CheckCircle2 } from 'lucide-react';

export interface CommanderNotepadPreviewProps {
  content: string;
  filePath: string | null;
  title: string;
  fontSize?: number;
}

/**
 * Tokenizes JSON string into syntax-colored HTML with line numbers
 */
function highlightJson(jsonStr: string): { lines: string[]; error?: string } {
  let formatted = jsonStr;
  let error: string | undefined;

  try {
    const parsed = JSON.parse(jsonStr);
    formatted = JSON.stringify(parsed, null, 2);
  } catch (err) {
    error = String(err);
  }

  const escaped = formatted
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const highlighted = escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          return `<span class="text-[#60cdff] font-medium">${match.slice(0, -1)}</span><span class="text-zinc-500">:</span>`;
        }
        return `<span class="text-emerald-300">${match}</span>`;
      }
      if (/true|false/.test(match)) {
        return `<span class="text-purple-400 font-semibold">${match}</span>`;
      }
      if (/null/.test(match)) {
        return `<span class="text-rose-400 italic font-semibold">${match}</span>`;
      }
      return `<span class="text-orange-400 font-mono">${match}</span>`;
    }
  );

  return { lines: highlighted.split('\n'), error };
}

export const CommanderNotepadPreview: React.FC<CommanderNotepadPreviewProps> = ({
  content,
  filePath,
  title,
  fontSize = 13,
}) => {
  const fileName = (filePath ? filePath.split('\\').pop() : title) || '';
  const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() || '' : '';

  const isMarkdown = ext === 'md' || ext === 'markdown';
  const isJson = ext === 'json';

  // Render Markdown to HTML
  const markdownHtml = useMemo(() => {
    if (!isMarkdown) return '';
    try {
      const parsed = marked.parse(content, {
        gfm: true,
        breaks: true,
      }) as string;
      return parsed;
    } catch (err) {
      console.error('[CommanderNotepadPreview] Markdown error:', err);
      return `<p class="text-rose-400">Chyba při parsování Markdown: ${String(err)}</p>`;
    }
  }, [content, isMarkdown]);

  // Render JSON to highlighted lines
  const jsonResult = useMemo(() => {
    if (!isJson) return null;
    return highlightJson(content);
  }, [content, isJson]);

  // 1. JSON Preview
  if (isJson && jsonResult) {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-[#0c0d11] text-zinc-200 overflow-hidden font-mono select-text">
        {/* JSON Status Banner */}
        {jsonResult.error ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 border-b border-rose-500/20 text-rose-300 text-xs shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="font-mono truncate">{jsonResult.error}</span>
          </div>
        ) : (
          <div className="flex items-center justify-between px-3 py-1 bg-[#14151b] border-b border-white/[0.06] text-[11px] text-zinc-400 shrink-0">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Platný formát JSON</span>
            </div>
            <span className="text-zinc-500">{jsonResult.lines.length} řádků</span>
          </div>
        )}

        {/* Code Content with Line Numbers */}
        <div
          className="flex-1 overflow-auto p-3"
          style={{ fontSize: `${fontSize}px`, lineHeight: '1.6' }}
        >
          <div className="table w-full font-mono">
            {jsonResult.lines.map((line, idx) => (
              <div key={idx} className="table-row hover:bg-white/[0.02]">
                <div className="table-cell pr-4 text-right text-zinc-600 select-none w-10 shrink-0 font-mono text-[11px]">
                  {idx + 1}
                </div>
                <div
                  className="table-cell whitespace-pre text-zinc-300"
                  dangerouslySetInnerHTML={{ __html: line || ' ' }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 2. Markdown Preview
  if (isMarkdown) {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-[#0d0e12] text-zinc-200 overflow-hidden select-text">
        <div
          className="flex-1 overflow-y-auto p-5 space-y-4 max-w-4xl mx-auto w-full leading-relaxed prose-invert font-sans"
          style={{ fontSize: `${fontSize}px` }}
        >
          <div
            className="markdown-body space-y-3"
            dangerouslySetInnerHTML={{ __html: markdownHtml }}
          />
        </div>
      </div>
    );
  }

  // 3. Fallback: Formatted Code / Text View
  const lines = content.split('\n');
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0c0d11] text-zinc-200 overflow-hidden font-mono select-text">
      <div
        className="flex-1 overflow-auto p-3"
        style={{ fontSize: `${fontSize}px`, lineHeight: '1.6' }}
      >
        <div className="table w-full">
          {lines.map((line, idx) => (
            <div key={idx} className="table-row hover:bg-white/[0.02]">
              <div className="table-cell pr-4 text-right text-zinc-600 select-none w-10 shrink-0 text-[11px]">
                {idx + 1}
              </div>
              <div className="table-cell whitespace-pre text-zinc-300">{line || ' '}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
