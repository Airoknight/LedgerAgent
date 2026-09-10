'use client';

import React from 'react';
import { 
  Inbox, 
  UploadCloud, 
  AlertTriangle, 
  FileSpreadsheet, 
  BarChart3, 
  ShieldCheck, 
  Settings, 
  Building2, 
  UserCheck,
  PlusCircle
} from 'lucide-react';

interface SidebarProps {
  activeView: string;
  onSelectView: (view: string) => void;
  onOpenUploadModal: () => void;
  exceptionCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  onOpenUploadModal,
  exceptionCount
}) => {
  const navItems = [
    { id: 'inbox', label: 'Inbox', icon: Inbox },
    { id: 'uploads', label: 'Uploads', icon: UploadCloud },
    { id: 'exceptions', label: 'Exceptions', icon: AlertTriangle, badge: exceptionCount > 0 ? exceptionCount : null, badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
    { id: 'transactions', label: 'Transactions', icon: FileSpreadsheet },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'audit', label: 'Audit Trail', icon: ShieldCheck },
  ];

  return (
    <aside className="w-64 bg-slate-900/95 border-r border-slate-800 flex flex-col h-full select-none">
      {/* Business Workspace Header */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="overflow-hidden">
            <h1 className="text-sm font-semibold text-white truncate">Alpha Enterprises</h1>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <span>FY 2026–27</span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span className="text-emerald-400 font-medium">Active</span>
            </p>
          </div>
        </div>

        {/* Quick Intake Button */}
        <button
          onClick={onOpenUploadModal}
          className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-900/30 transition-colors"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Document Intake</span>
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase px-3 mb-2">
          Operations
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== null && item.badge !== undefined && (
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        <div className="pt-4 text-[10px] font-semibold tracking-wider text-slate-500 uppercase px-3 mb-2">
          Administration
        </div>
        <button
          onClick={() => onSelectView('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
            activeView === 'settings'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Settings & Policies</span>
        </button>
      </nav>

      {/* CA Profile Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/60">
        <div className="flex items-center space-x-3 px-2 py-1.5 rounded-lg bg-slate-800/40 border border-slate-800">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <UserCheck className="w-4 h-4" />
          </div>
          <div className="overflow-hidden flex-1">
            <p className="text-xs font-medium text-slate-200 truncate">CA Hehram</p>
            <p className="text-[10px] text-emerald-400 font-mono">Role: Accountant (CA)</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

