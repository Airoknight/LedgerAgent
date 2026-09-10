'use client';

import React from 'react';
import { 
  X, 
  FileText, 
  Table, 
  AlertTriangle, 
  BarChart, 
  Inbox, 
  CheckCircle2, 
  Loader2 
} from 'lucide-react';
import { WorkspaceTab } from '@/types';

interface TabManagerProps {
  tabs: WorkspaceTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string, e: React.MouseEvent) => void;
  onOpenUploadModal: () => void;
}

export const TabManager: React.FC<TabManagerProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onOpenUploadModal,
}) => {
  const getTabIcon = (type: WorkspaceTab['type']) => {
    switch (type) {
      case 'invoice':
        return <FileText className="w-3.5 h-3.5 text-blue-400" />;
      case 'spreadsheet':
        return <Table className="w-3.5 h-3.5 text-emerald-400" />;
      case 'exception':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
      case 'report':
        return <BarChart className="w-3.5 h-3.5 text-purple-400" />;
      default:
        return <Inbox className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const getStatusBadge = (status?: WorkspaceTab['status']) => {
    if (!status) return null;
    switch (status) {
      case 'checks_passed':
        return (
          <span className="flex items-center text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-1.5 py-0.2 rounded font-mono">
            ✓ Auto
          </span>
        );
      case 'approved':
        return (
          <span className="flex items-center text-[10px] text-teal-300 bg-teal-950/60 border border-teal-500/40 px-1.5 py-0.2 rounded font-mono">
            ✓ CA
          </span>
        );
      case 'needs_review':
        return (
          <span className="flex items-center text-[10px] text-amber-300 bg-amber-950/70 border border-amber-500/50 px-1.5 py-0.2 rounded font-mono font-bold animate-pulse">
            ! Review
          </span>
        );
      case 'processing':
        return (
          <span className="flex items-center text-[10px] text-blue-300 bg-blue-950/70 border border-blue-500/50 px-1.5 py-0.2 rounded font-mono">
            <Loader2 className="w-2.5 h-2.5 animate-spin mr-1" /> Queued
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-10 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-2 overflow-x-auto select-none">
      {/* Scrollable Tabs */}
      <div className="flex items-center space-x-1 flex-1 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = activeTabId === tab.id;
          return (
            <div
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`group flex items-center gap-2 h-8 px-3 rounded-t-md text-xs font-medium cursor-pointer border-t border-x transition-colors min-w-[140px] max-w-[220px] ${
                isActive
                  ? 'bg-slate-950 text-slate-100 border-slate-700 border-b-slate-950 shadow-sm'
                  : 'bg-slate-900/60 text-slate-400 border-transparent hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              {getTabIcon(tab.type)}
              <span className="truncate flex-1">{tab.title}</span>
              {getStatusBadge(tab.status)}
              {tab.id !== 'dashboard' && (
                <button
                  onClick={(e) => onCloseTab(tab.id, e)}
                  className="opacity-40 group-hover:opacity-100 hover:text-red-400 p-0.5 rounded transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Ingest Button on right */}
      <div className="pl-2">
        <button
          onClick={onOpenUploadModal}
          className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1 rounded border border-slate-700 flex items-center gap-1.5 font-medium transition-colors"
        >
          <span>+ Upload Files</span>
        </button>
      </div>
    </div>
  );
};

