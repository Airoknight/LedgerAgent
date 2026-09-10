'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Copy, Check, Eye, Code2 } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  isUser?: boolean;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, isUser = false }) => {
  const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted');
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  if (isUser) {
    return <div className="leading-relaxed whitespace-pre-wrap">{content}</div>;
  }

  return (
    <div className="space-y-2 group/md">
      {/* Formatting Option Quick Toolbar */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-2 text-[10px] text-slate-400">
        <div className="flex items-center gap-1.5 font-medium">
          <span className="text-[10px] uppercase tracking-wider font-mono text-slate-400">Rendering:</span>
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200/60">
            <button
              type="button"
              onClick={() => setViewMode('formatted')}
              className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-all ${
                viewMode === 'formatted'
                  ? 'bg-white text-emerald-700 font-bold shadow-2xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              title="View as rich formatted Markdown"
            >
              <Eye className="w-3 h-3 text-emerald-600" />
              <span>Formatted</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('raw')}
              className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-all ${
                viewMode === 'raw'
                  ? 'bg-white text-blue-700 font-bold shadow-2xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              title="View raw Markdown source"
            >
              <Code2 className="w-3 h-3 text-blue-600" />
              <span>Raw MD</span>
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors font-mono"
          title="Copy message content"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-600" />
              <span className="text-emerald-600 font-semibold">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Content Rendering */}
      {viewMode === 'raw' ? (
        <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap border border-slate-800 shadow-inner select-text">
          {content}
        </pre>
      ) : (
        <div className="prose-clean text-slate-800 text-xs leading-relaxed space-y-2">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkBreaks]}
            components={{
              h1: ({ children }) => (
                <h1 className="text-sm font-extrabold text-slate-900 mt-3 mb-1.5 pb-1 border-b border-slate-200/80 flex items-center gap-1.5">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-xs font-bold text-slate-900 mt-2.5 mb-1 pb-0.5 border-b border-slate-100 flex items-center gap-1.5">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-xs font-bold text-slate-800 mt-2 mb-0.5">
                  {children}
                </h3>
              ),
              p: ({ children }) => (
                <p className="my-1 leading-relaxed text-slate-700">
                  {children}
                </p>
              ),
              strong: ({ children }) => (
                <strong className="font-bold text-slate-900">
                  {children}
                </strong>
              ),
              em: ({ children }) => (
                <em className="italic text-slate-600 font-medium">
                  {children}
                </em>
              ),
              ul: ({ children }) => (
                <ul className="my-1.5 pl-4 list-disc space-y-1 text-slate-700 marker:text-emerald-500">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="my-1.5 pl-4 list-decimal space-y-1 text-slate-700 marker:text-blue-500 marker:font-semibold">
                  {children}
                </ol>
              ),
              li: ({ children }) => (
                <li className="leading-relaxed pl-0.5">
                  {children}
                </li>
              ),
              blockquote: ({ children }) => (
                <blockquote className="my-2 pl-3 py-1 bg-emerald-50/70 border-l-3 border-emerald-500 text-slate-700 rounded-r-lg italic text-[11px]">
                  {children}
                </blockquote>
              ),
              hr: () => (
                <hr className="my-2.5 border-t border-slate-200/80" />
              ),
              table: ({ children }) => (
                <div className="overflow-x-auto my-2 rounded-xl border border-slate-200/80 shadow-2xs">
                  <table className="w-full text-left border-collapse text-[11px]">
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200/90 font-mono text-[10.5px]">
                  {children}
                </thead>
              ),
              tbody: ({ children }) => (
                <tbody className="divide-y divide-slate-100 bg-white">
                  {children}
                </tbody>
              ),
              tr: ({ children }) => (
                <tr className="hover:bg-slate-50/80 transition-colors">
                  {children}
                </tr>
              ),
              th: ({ children }) => (
                <th className="px-3 py-2 font-semibold">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="px-3 py-2 text-slate-700 font-sans">
                  {children}
                </td>
              ),
              code: ({ children, className }) => {
                const isBlock = className?.includes('language-');
                if (isBlock) {
                  return (
                    <pre className="p-2.5 my-1.5 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto border border-slate-800 shadow-inner">
                      <code>{children}</code>
                    </pre>
                  );
                }
                return (
                  <code className="px-1.5 py-0.5 mx-0.5 rounded bg-slate-100 text-purple-700 font-mono text-[11px] font-semibold border border-slate-200/60">
                    {children}
                  </code>
                );
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
};
