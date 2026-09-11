'use client';

import React, { useState } from 'react';
import { 
  FileText, 
  UploadCloud, 
  BookOpen, 
  Scale, 
  BarChart3, 
  Users, 
  AlertTriangle, 
  CheckCircle2, 
  FileSpreadsheet, 
  TrendingUp, 
  ShoppingBag, 
  Receipt, 
  Landmark, 
  ShieldCheck, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  LogOut,
  Plus,
  Sparkles,
  Layers,
  Filter
} from 'lucide-react';

export interface PreProcessingStats {
  missingIdentifierCount: number;
  missingDateCount: number;
  missingPartyCount: number;
  arithmeticVarianceCount: number;
  duplicateCount: number;
  readyApprovalCount: number;
}

interface SidebarProps {
  activeView: string;
  onSelectView: (view: string) => void;
  onOpenUploadModal: () => void;
  exceptionCount: number;
  documentCount: number;
  preProcessingStats?: PreProcessingStats;
  activeFilter?: string | null;
  onSelectFilter?: (filterId: string | null) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onLogout?: () => void;
  currentUserName?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  onOpenUploadModal,
  exceptionCount,
  documentCount,
  preProcessingStats,
  activeFilter,
  onSelectFilter,
  isCollapsed: externalCollapsed,
  onToggleCollapse,
  onLogout,
  currentUserName = 'CA Hehram'
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = externalCollapsed !== undefined ? externalCollapsed : internalCollapsed;
  const toggleCollapse = onToggleCollapse || (() => setInternalCollapsed(!internalCollapsed));

  const stats = preProcessingStats || {
    missingIdentifierCount: 0,
    missingDateCount: 0,
    missingPartyCount: 0,
    arithmeticVarianceCount: exceptionCount,
    duplicateCount: 0,
    readyApprovalCount: Math.max(0, documentCount - exceptionCount),
  };

  const handleFilterClick = (filterId: string) => {
    if (onSelectFilter) {
      if (activeFilter === filterId) {
        onSelectFilter(null);
      } else {
        onSelectFilter(filterId);
      }
    }
  };

  return (
    <aside 
      className={`bg-[#172332] text-[#DCE5EF] flex flex-col h-full shrink-0 border-r border-[#223247] transition-all duration-200 select-none ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* 1. Profile / Brand Header */}
      <div className="h-14 px-3.5 border-b border-[#223247] flex items-center justify-between shrink-0">
        {!isCollapsed ? (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-[6px] bg-[#1F5D8F] border border-[#A8C6DC]/40 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs">
              CH
            </div>
            <div className="truncate">
              <span className="font-semibold text-xs text-white tracking-tight block truncate">
                {currentUserName}
              </span>
              <span className="text-[10px] text-[#94A3B8] font-medium block -mt-0.5">
                Chartered Accountant (Admin)
              </span>
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 mx-auto rounded-[6px] bg-[#1F5D8F] flex items-center justify-center text-white font-bold text-xs">
            CH
          </div>
        )}

        <button
          onClick={toggleCollapse}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="p-1 rounded-[4px] text-[#94A3B8] hover:text-white hover:bg-[#223247] transition-colors"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* 2. Scrollable Navigation List */}
      <nav className="flex-1 px-2.5 py-3 overflow-y-auto space-y-4 text-xs">
        
        {/* SECTION A: UPLOADS */}
        <div className="space-y-1">
          {!isCollapsed && (
            <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
              Uploads
            </div>
          )}

          <button
            onClick={() => {
              if (onSelectFilter) onSelectFilter(null);
              onSelectView('workspace');
            }}
            title={isCollapsed ? `All Uploaded Documents (${documentCount})` : undefined}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] transition-colors ${
              activeView === 'workspace' && !activeFilter
                ? 'bg-[#2D425C] text-white font-semibold'
                : 'text-[#DCE5EF] hover:bg-[#223247] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <UploadCloud className={`w-4 h-4 shrink-0 ${activeView === 'workspace' && !activeFilter ? 'text-[#A8C6DC]' : 'text-[#94A3B8]'}`} />
              {!isCollapsed && <span className="truncate">All Documents</span>}
            </div>
            {!isCollapsed && (
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#223247] text-[#DCE5EF] border border-[#2D425C]">
                {documentCount}
              </span>
            )}
          </button>

          {!isCollapsed && (
            <button
              type="button"
              onClick={onOpenUploadModal}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-[#1F5D8F] hover:bg-[#174A73] text-white rounded-[6px] font-medium text-xs shadow-xs transition-colors mt-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Upload Documents</span>
            </button>
          )}
        </div>

        {/* SECTION B: ACCOUNTING PIPELINE (ONE SECTION UNDER UPLOADS) */}
        <div className="space-y-0.5 pt-1">
          {!isCollapsed && (
            <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[#A8C6DC] flex items-center gap-1.5">
              <BookOpen className="w-3 h-3 text-[#A8C6DC]" />
              <span>Accounting Pipeline</span>
            </div>
          )}

          {/* 1. Draft Journal Entries */}
          <button
            onClick={() => onSelectView('accounting_journals')}
            title={isCollapsed ? "Draft Journal Entries" : undefined}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] transition-colors ${
              activeView === 'accounting_journals' || (activeView === 'accounting' && !activeFilter)
                ? 'bg-[#2D425C] text-white font-semibold'
                : 'text-[#DCE5EF] hover:bg-[#223247] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <BookOpen className={`w-4 h-4 shrink-0 ${activeView.includes('accounting') ? 'text-[#A8C6DC]' : 'text-[#94A3B8]'}`} />
              {!isCollapsed && <span className="truncate">Draft Journal Entries</span>}
            </div>
            {!isCollapsed && (
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#237A57]/30 text-[#A8D8C1] border border-[#237A57]/50 font-medium">
                Double-Entry
              </span>
            )}
          </button>

          {/* 2. General Ledger */}
          <button
            onClick={() => onSelectView('accounting_ledger')}
            title={isCollapsed ? "General Ledger" : undefined}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] transition-colors ${
              activeView === 'accounting_ledger'
                ? 'bg-[#2D425C] text-white font-semibold'
                : 'text-[#DCE5EF] hover:bg-[#223247] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <Layers className="w-4 h-4 text-[#94A3B8] shrink-0" />
              {!isCollapsed && <span className="truncate">General Ledger</span>}
            </div>
          </button>

          {/* 3. Trial Balance & Reports */}
          <button
            onClick={() => onSelectView('accounting_trial_balance')}
            title={isCollapsed ? "Trial Balance & Statements" : undefined}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] transition-colors ${
              activeView === 'accounting_trial_balance'
                ? 'bg-[#2D425C] text-white font-semibold'
                : 'text-[#DCE5EF] hover:bg-[#223247] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <Scale className="w-4 h-4 text-[#94A3B8] shrink-0" />
              {!isCollapsed && <span className="truncate">Trial Balance & P&L</span>}
            </div>
            {!isCollapsed && (
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#223247] text-[#DCE5EF]">
                Statements
              </span>
            )}
          </button>

          {/* 4. AR & AP Ageing */}
          <button
            onClick={() => onSelectView('accounting_ar_ap')}
            title={isCollapsed ? "Receivables & Payables" : undefined}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] transition-colors ${
              activeView === 'accounting_ar_ap'
                ? 'bg-[#2D425C] text-white font-semibold'
                : 'text-[#DCE5EF] hover:bg-[#223247] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <Users className="w-4 h-4 text-[#94A3B8] shrink-0" />
              {!isCollapsed && <span className="truncate">AR & AP Ageing</span>}
            </div>
          </button>
        </div>

        {/* SECTION C: PRE-PROCESSING & MISSING VALUES (MINIMAL DESIGN SUGGESTIONS) */}
        <div className="space-y-1 pt-1 border-t border-[#223247]">
          {!isCollapsed && (
            <div className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8] flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#E7CA75]" />
                <span>Pre-Processing Checks</span>
              </span>
              {activeFilter && (
                <button
                  onClick={() => onSelectFilter && onSelectFilter(null)}
                  className="text-[9px] text-[#A8C6DC] hover:underline"
                >
                  Clear filter
                </button>
              )}
            </div>
          )}

          {/* Suggestion 1: Missing Invoice # */}
          {stats.missingIdentifierCount > 0 && (
            <button
              onClick={() => handleFilterClick('missing_identifier')}
              title={isCollapsed ? `Missing Invoice # (${stats.missingIdentifierCount})` : undefined}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-xs transition-colors ${
                activeFilter === 'missing_identifier'
                  ? 'bg-[#9A6700]/30 text-white font-semibold border border-[#E7CA75]/60'
                  : 'text-[#DCE5EF] hover:bg-[#223247]'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <AlertTriangle className="w-3.5 h-3.5 text-[#E7CA75] shrink-0" />
                {!isCollapsed && <span className="truncate text-[11px]">Missing Invoice #</span>}
              </div>
              {!isCollapsed && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#FFF5D6] text-[#9A6700] font-semibold">
                  {stats.missingIdentifierCount}
                </span>
              )}
            </button>
          )}

          {/* Suggestion 2: Missing Date */}
          {stats.missingDateCount > 0 && (
            <button
              onClick={() => handleFilterClick('missing_date')}
              title={isCollapsed ? `Missing Date (${stats.missingDateCount})` : undefined}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-xs transition-colors ${
                activeFilter === 'missing_date'
                  ? 'bg-[#9A6700]/30 text-white font-semibold border border-[#E7CA75]/60'
                  : 'text-[#DCE5EF] hover:bg-[#223247]'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <AlertTriangle className="w-3.5 h-3.5 text-[#E7CA75] shrink-0" />
                {!isCollapsed && <span className="truncate text-[11px]">Missing Date</span>}
              </div>
              {!isCollapsed && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#FFF5D6] text-[#9A6700] font-semibold">
                  {stats.missingDateCount}
                </span>
              )}
            </button>
          )}

          {/* Suggestion 3: Missing Counterparty / GSTIN */}
          {stats.missingPartyCount > 0 && (
            <button
              onClick={() => handleFilterClick('missing_party')}
              title={isCollapsed ? `Missing Party / GSTIN (${stats.missingPartyCount})` : undefined}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-xs transition-colors ${
                activeFilter === 'missing_party'
                  ? 'bg-[#9A6700]/30 text-white font-semibold border border-[#E7CA75]/60'
                  : 'text-[#DCE5EF] hover:bg-[#223247]'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <AlertTriangle className="w-3.5 h-3.5 text-[#E7CA75] shrink-0" />
                {!isCollapsed && <span className="truncate text-[11px]">Missing Party/GSTIN</span>}
              </div>
              {!isCollapsed && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#FFF5D6] text-[#9A6700] font-semibold">
                  {stats.missingPartyCount}
                </span>
              )}
            </button>
          )}

          {/* Suggestion 4: Arithmetic Variance */}
          {stats.arithmeticVarianceCount > 0 && (
            <button
              onClick={() => handleFilterClick('arithmetic_variance')}
              title={isCollapsed ? `Arithmetic Variance (${stats.arithmeticVarianceCount})` : undefined}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-xs transition-colors ${
                activeFilter === 'arithmetic_variance'
                  ? 'bg-[#B33A3A]/30 text-white font-semibold border border-[#E8AAAA]/60'
                  : 'text-[#DCE5EF] hover:bg-[#223247]'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <AlertTriangle className="w-3.5 h-3.5 text-[#E8AAAA] shrink-0" />
                {!isCollapsed && <span className="truncate text-[11px]">Arithmetic Variance</span>}
              </div>
              {!isCollapsed && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#FDECEC] text-[#B33A3A] font-semibold">
                  {stats.arithmeticVarianceCount}
                </span>
              )}
            </button>
          )}

          {/* Suggestion 5: Duplicate Document Alerts */}
          {stats.duplicateCount > 0 && (
            <button
              onClick={() => handleFilterClick('duplicates')}
              title={isCollapsed ? `Duplicate Documents (${stats.duplicateCount})` : undefined}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-xs transition-colors ${
                activeFilter === 'duplicates'
                  ? 'bg-[#B33A3A]/30 text-white font-semibold border border-[#E8AAAA]/60'
                  : 'text-[#DCE5EF] hover:bg-[#223247]'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <AlertTriangle className="w-3.5 h-3.5 text-[#E8AAAA] shrink-0" />
                {!isCollapsed && <span className="truncate text-[11px]">Duplicate Files</span>}
              </div>
              {!isCollapsed && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#FDECEC] text-[#B33A3A] font-semibold">
                  {stats.duplicateCount}
                </span>
              )}
            </button>
          )}

          {/* Suggestion 6: Ready for CA Approval */}
          {stats.readyApprovalCount > 0 && (
            <button
              onClick={() => handleFilterClick('ready_approval')}
              title={isCollapsed ? `Ready for CA Sign-off (${stats.readyApprovalCount})` : undefined}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-xs transition-colors ${
                activeFilter === 'ready_approval'
                  ? 'bg-[#237A57]/30 text-white font-semibold border border-[#A8D8C1]/60'
                  : 'text-[#DCE5EF] hover:bg-[#223247]'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#A8D8C1] shrink-0" />
                {!isCollapsed && <span className="truncate text-[11px]">Ready for CA Sign-off</span>}
              </div>
              {!isCollapsed && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#E8F5EE] text-[#237A57] font-semibold">
                  {stats.readyApprovalCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* SECTION D: FINANCIAL REGISTERS */}
        <div className="space-y-0.5 pt-1 border-t border-[#223247]">
          {!isCollapsed && (
            <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
              Registers
            </div>
          )}

          <button
            onClick={() => onSelectView('cat_invoices')}
            title={isCollapsed ? "Invoices" : undefined}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] transition-colors ${
              activeView === 'cat_invoices'
                ? 'bg-[#2D425C] text-white font-semibold'
                : 'text-[#DCE5EF] hover:bg-[#223247] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <FileSpreadsheet className="w-4 h-4 text-[#94A3B8] shrink-0" />
              {!isCollapsed && <span className="truncate">Invoices</span>}
            </div>
          </button>

          <button
            onClick={() => onSelectView('cat_sales')}
            title={isCollapsed ? "Sales Register" : undefined}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] transition-colors ${
              activeView === 'cat_sales'
                ? 'bg-[#2D425C] text-white font-semibold'
                : 'text-[#DCE5EF] hover:bg-[#223247] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <TrendingUp className="w-4 h-4 text-[#94A3B8] shrink-0" />
              {!isCollapsed && <span className="truncate">Sales Register</span>}
            </div>
          </button>

          <button
            onClick={() => onSelectView('cat_purchases')}
            title={isCollapsed ? "Purchase Register" : undefined}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] transition-colors ${
              activeView === 'cat_purchases'
                ? 'bg-[#2D425C] text-white font-semibold'
                : 'text-[#DCE5EF] hover:bg-[#223247] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <ShoppingBag className="w-4 h-4 text-[#94A3B8] shrink-0" />
              {!isCollapsed && <span className="truncate">Purchase Register</span>}
            </div>
          </button>

          <button
            onClick={() => onSelectView('cat_receipts')}
            title={isCollapsed ? "Receipts" : undefined}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] transition-colors ${
              activeView === 'cat_receipts'
                ? 'bg-[#2D425C] text-white font-semibold'
                : 'text-[#DCE5EF] hover:bg-[#223247] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <Receipt className="w-4 h-4 text-[#94A3B8] shrink-0" />
              {!isCollapsed && <span className="truncate">Receipts</span>}
            </div>
          </button>

          <button
            onClick={() => onSelectView('cat_bank')}
            title={isCollapsed ? "Bank Statements" : undefined}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] transition-colors ${
              activeView === 'cat_bank'
                ? 'bg-[#2D425C] text-white font-semibold'
                : 'text-[#DCE5EF] hover:bg-[#223247] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <Landmark className="w-4 h-4 text-[#94A3B8] shrink-0" />
              {!isCollapsed && <span className="truncate">Bank Statements</span>}
            </div>
          </button>
        </div>

        {/* SECTION E: AUDIT & GOVERNANCE */}
        <div className="space-y-0.5 pt-1 border-t border-[#223247]">
          {!isCollapsed && (
            <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
              Governance
            </div>
          )}

          <button
            onClick={() => onSelectView('audit')}
            title={isCollapsed ? "Audit Trail (SHA-256)" : undefined}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] transition-colors ${
              activeView === 'audit'
                ? 'bg-[#2D425C] text-white font-semibold'
                : 'text-[#DCE5EF] hover:bg-[#223247] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <ShieldCheck className="w-4 h-4 text-[#94A3B8] shrink-0" />
              {!isCollapsed && <span className="truncate">Audit Trail (SHA-256)</span>}
            </div>
            {!isCollapsed && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#237A57]"></span>
            )}
          </button>

          <button
            onClick={() => onSelectView('settings')}
            title={isCollapsed ? "Security & Policies" : undefined}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] transition-colors ${
              activeView === 'settings'
                ? 'bg-[#2D425C] text-white font-semibold'
                : 'text-[#DCE5EF] hover:bg-[#223247] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <Settings className="w-4 h-4 text-[#94A3B8] shrink-0" />
              {!isCollapsed && <span className="truncate">Security & Policies</span>}
            </div>
          </button>
        </div>
      </nav>

      {/* 3. Client Context & Sign Out Footer */}
      {!isCollapsed ? (
        <div className="p-3 border-t border-[#223247] bg-[#172332] space-y-2">
          <div className="px-2.5 py-2 rounded-[6px] bg-[#223247] border border-[#2D425C] flex items-center justify-between">
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-white truncate">AiroKnight Studios</p>
              <p className="text-[10px] text-[#94A3B8]">FY 2026–27 • Isolated</p>
            </div>
            <span className="w-2 h-2 rounded-full bg-[#237A57] shrink-0" title="Connected & isolated"></span>
          </div>

          {onLogout && (
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-[#94A3B8] hover:text-white hover:bg-[#223247] rounded-[6px] transition-colors"
            >
              <LogOut className="w-3.5 h-3.5 text-[#E8AAAA]" />
              <span>Sign out</span>
            </button>
          )}
        </div>
      ) : (
        <div className="p-2 border-t border-[#223247] flex flex-col items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#237A57]" title="AiroKnight Studios (Active)"></span>
          {onLogout && (
            <button
              onClick={onLogout}
              title="Sign out"
              className="p-1.5 text-[#94A3B8] hover:text-white hover:bg-[#223247] rounded-[4px]"
            >
              <LogOut className="w-4 h-4 text-[#E8AAAA]" />
            </button>
          )}
        </div>
      )}
    </aside>
  );
};
