'use client';

import React, { useState } from 'react';
import { 
  Activity, 
  ChevronUp, 
  ChevronDown, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  FileSearch,
  Check
} from 'lucide-react';

interface PipelineDockProps {
  totalDocs: number;
  passedChecks: number;
  openExceptions: number;
}

export const PipelineDock: React.FC<PipelineDockProps> = ({
  totalDocs,
  passedChecks,
  openExceptions
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border-t border-slate-800 bg-slate-900/90 text-xs text-slate-300 select-none">
      {/* Collapsed Status Bar */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="h-7 px-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/60 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-mono">LedgerAgent Ingestion Engine Active</span>
          </div>

          <span className="text-slate-600">|</span>

          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>Documents Ingested: <strong className="text-slate-200">{totalDocs}</strong></span>
            <span>Automated Checks Passed: <strong className="text-emerald-400">{passedChecks}</strong></span>
            {openExceptions > 0 && (
              <span className="text-amber-400 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                <span>Exceptions Requiring CA Review: {openExceptions}</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
          <span>Pipeline Stages</span>
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </div>
      </div>

      {/* Expanded Multi-stage details */}
      {isExpanded && (
        <div className="px-6 py-3 bg-slate-950/80 border-t border-slate-800/80 grid grid-cols-4 gap-4 text-[11px]">
          <div className="flex items-center gap-2.5 p-2 rounded bg-slate-900 border border-slate-800">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <div className="font-semibold text-slate-200">1. Security & Signatures</div>
              <div className="text-[10px] text-slate-400">SHA-256 Hashed • 0 Quarantined</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-2 rounded bg-slate-900 border border-slate-800">
            <FileSearch className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <div className="font-semibold text-slate-200">2. Preprocessing & Split</div>
              <div className="text-[10px] text-slate-400">{totalDocs}/{totalDocs} Pages Deskewed</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-2 rounded bg-slate-900 border border-slate-800">
            <Activity className="w-4 h-4 text-indigo-400 shrink-0" />
            <div>
              <div className="font-semibold text-slate-200">3. Classification & OCR</div>
              <div className="text-[10px] text-slate-400">Schema-constrained • Bounding boxes</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-2 rounded bg-slate-900 border border-slate-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <div className="font-semibold text-slate-200">4. Deterministic Math</div>
              <div className="text-[10px] text-slate-400">Tax Lines & Decimal Calculations</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

