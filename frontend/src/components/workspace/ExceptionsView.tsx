'use client';

import React, { useState } from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  Send, 
  Eye, 
  XCircle, 
  Filter, 
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { FinancialException } from '@/types';

interface ExceptionsViewProps {
  exceptions: FinancialException[];
  onOpenDoc: (docId: string) => void;
  onResolve: (id: string, action: string, note: string) => void;
  onDraftClient: (exc: FinancialException) => void;
}

export const ExceptionsView: React.FC<ExceptionsViewProps> = ({
  exceptions,
  onOpenDoc,
  onResolve,
  onDraftClient
}) => {
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});

  const filtered = exceptions.filter(e => {
    if (filterSeverity === 'all') return true;
    return e.severity === filterSeverity;
  });

  const getSeverityBadge = (severity: FinancialException['severity']) => {
    switch (severity) {
      case 'high':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-rose-950/80 text-rose-300 border border-rose-500/40 font-mono">
            High Severity
          </span>
        );
      case 'medium':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-950/80 text-amber-300 border border-amber-500/40 font-mono">
            Medium Severity
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-blue-950/80 text-blue-300 border border-blue-500/40 font-mono">
            Low
          </span>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Header */}
      <div className="h-12 border-b border-slate-800 bg-slate-900/80 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-semibold text-slate-100">Actionable Financial Exceptions</h2>
            <p className="text-[10px] text-slate-400">
              Prioritized by severity • Requiring Chartered Accountant intervention
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">Filter Severity:</span>
          {(['all', 'high', 'medium', 'low'] as const).map(sev => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              className={`px-2.5 py-1 rounded text-xs capitalize font-medium transition-colors ${
                filterSeverity === sev
                  ? 'bg-slate-800 text-white border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Exception Cards Container */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {filtered.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-8 bg-slate-900/40 border border-dashed border-slate-800 rounded-xl">
            <CheckCircle className="w-10 h-10 text-emerald-400 mb-2" />
            <h3 className="text-sm font-semibold text-slate-200">No Open Exceptions</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              All financial documents and bank records have passed automated deterministic checks.
            </p>
          </div>
        ) : (
          filtered.map(exc => (
            <div 
              key={exc.id}
              className="p-5 bg-slate-900 rounded-xl border border-slate-800 hover:border-slate-700 transition-all shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`w-5 h-5 mt-0.5 shrink-0 ${exc.severity === 'high' ? 'text-rose-400' : 'text-amber-400'}`} />
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-sm font-bold text-slate-100">{exc.title}</h3>
                      {getSeverityBadge(exc.severity)}
                      <span className="text-[10px] text-slate-500 font-mono">ID: {exc.id.slice(0, 8)}</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1.5 leading-relaxed max-w-3xl">
                      {exc.explanation}
                    </p>
                    {exc.suggested_action && (
                      <div className="mt-2 text-xs text-indigo-300 bg-indigo-950/40 border border-indigo-500/30 px-3 py-1.5 rounded-lg flex items-center gap-2">
                        <span className="font-semibold text-indigo-400">Recommended Action:</span>
                        <span>{exc.suggested_action}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status */}
                <div className="text-right">
                  <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded font-mono ${
                    exc.status === 'open' ? 'bg-amber-950 text-amber-300 border border-amber-500/40' : 'bg-emerald-950 text-emerald-300'
                  }`}>
                    {exc.status}
                  </span>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {new Date(exc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {exc.document_id && (
                    <button
                      onClick={() => onOpenDoc(exc.document_id!)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Open Document Reviewer</span>
                    </button>
                  )}
                  <button
                    onClick={() => onDraftClient(exc)}
                    className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Draft Client Inquiry</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onResolve(exc.id, 'resolve', 'Accepted after CA manual verification')}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                  >
                    Mark Resolved
                  </button>
                  <button
                    onClick={() => onResolve(exc.id, 'dismiss', 'Dismissed by CA')}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

