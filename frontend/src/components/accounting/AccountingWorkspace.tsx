'use client';

import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Scale, 
  BarChart3, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Layers, 
  TrendingUp,
  Download,
  Check,
  CheckCheck,
  Building2,
  Sparkles
} from 'lucide-react';

interface JournalLine {
  line_number: number;
  account_code: string;
  account_name: string;
  subledger_type: string;
  subledger_name?: string;
  debit: string;
  credit: string;
  tax_type: string;
}

interface JournalEntry {
  id: string;
  entry_number: string;
  posting_date: string;
  source_type: string;
  source_id?: string;
  document_id?: string;
  narration: string;
  status: 'draft' | 'needs_mapping' | 'ready_for_review' | 'ca_approved' | 'posted';
  total_debit: string;
  total_credit: string;
  is_balanced: boolean;
  reviewer?: string;
  reviewed_at?: string;
  posted_at?: string;
  lines: JournalLine[];
}

interface TrialBalanceRow {
  account_code: string;
  account_name: string;
  category: string;
  debit: string;
  credit: string;
}

interface FinancialStatements {
  disclaimer: string;
  period: string;
  profit_and_loss: {
    revenue_items: Array<{ code: string; name: string; amount: string }>;
    total_revenue: string;
    expense_items: Array<{ code: string; name: string; amount: string }>;
    total_expenses: string;
    net_profit: string;
    is_profitable: boolean;
  };
  balance_sheet: {
    as_of_date: string;
    assets: Array<{ code: string; name: string; amount: string }>;
    total_assets: string;
    liabilities: Array<{ code: string; name: string; amount: string }>;
    total_liabilities: string;
    equity: Array<{ code: string; name: string; amount: string }>;
    total_equity: string;
    total_liabilities_and_equity: string;
    is_balanced: boolean;
  };
  gst_summary: {
    input_tax_credit: { cgst: string; sgst: string; igst: string; total_itc: string };
    output_tax_liability: { cgst: string; sgst: string; igst: string; total_output: string };
    net_gst_position: { net_payable: string; net_refundable: string; status: string };
  };
}

interface ArApItem {
  invoice_id: string;
  customer?: string;
  vendor?: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: string;
  received_amount?: string;
  paid_amount?: string;
  outstanding_amount: string;
  days_outstanding: number;
  ageing_bucket: string;
  status: string;
}

interface AccountingWorkspaceProps {
  csrfToken?: string;
  initialSubTab?: 'journals' | 'trial_balance' | 'statements' | 'ar_ap' | 'coa';
}

export const AccountingWorkspace: React.FC<AccountingWorkspaceProps> = ({ 
  csrfToken: initialCsrfToken,
  initialSubTab = 'journals'
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'journals' | 'trial_balance' | 'statements' | 'ar_ap' | 'coa'>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeCsrfToken, setActiveCsrfToken] = useState<string>(initialCsrfToken || '');

  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [trialBalance, setTrialBalance] = useState<{ is_balanced: boolean; total_debit: string; total_credit: string; rows: TrialBalanceRow[] } | null>(null);
  const [finStatements, setFinStatements] = useState<FinancialStatements | null>(null);
  const [arAp, setArAp] = useState<{ accounts_receivable: { total_outstanding: string; items: ArApItem[] }; accounts_payable: { total_outstanding: string; items: ArApItem[] } } | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [includeDrafts, setIncludeDrafts] = useState<boolean>(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    if (initialCsrfToken) {
      setActiveCsrfToken(initialCsrfToken);
    } else {
      fetch(`${API_BASE}/api/v1/auth/me`, { credentials: 'include' })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.csrf_token) setActiveCsrfToken(data.csrf_token);
        })
        .catch(() => {});
    }
  }, [initialCsrfToken, API_BASE]);

  const fetchData = async (overrideDrafts?: boolean) => {
    setLoading(true);
    const useDrafts = overrideDrafts !== undefined ? overrideDrafts : includeDrafts;
    const q = useDrafts ? '?include_drafts=true' : '';
    try {
      const [jeRes, tbRes, fsRes, arapRes, coaRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/accounting/journal-entries`, { credentials: 'include' }),
        fetch(`${API_BASE}/api/v1/accounting/trial-balance${q}`, { credentials: 'include' }),
        fetch(`${API_BASE}/api/v1/accounting/financial-statements${q}`, { credentials: 'include' }),
        fetch(`${API_BASE}/api/v1/accounting/ar-ap`, { credentials: 'include' }),
        fetch(`${API_BASE}/api/v1/accounting/coa`, { credentials: 'include' })
      ]);

      if (jeRes.ok) setJournalEntries(await jeRes.json());
      if (tbRes.ok) setTrialBalance(await tbRes.json());
      if (fsRes.ok) setFinStatements(await fsRes.json());
      if (arapRes.ok) setArAp(await arapRes.json());
      if (coaRes.ok) setAccounts(await coaRes.json());
    } catch (e) {
      console.error('Error fetching accounting data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleGenerateDrafts = async () => {
    setActionLoading('generate');
    try {
      const res = await fetch(`${API_BASE}/api/v1/accounting/generate-drafts`, { 
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': activeCsrfToken }
      });
      if (res.ok) await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePostAll = async () => {
    setActionLoading('post_all');
    try {
      const res = await fetch(`${API_BASE}/api/v1/accounting/post-all?auto_map=true`, { 
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': activeCsrfToken }
      });
      if (res.ok) await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveEntry = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/accounting/journal-entries/${id}/approve`, { 
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': activeCsrfToken }
      });
      if (res.ok) await fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handlePostEntry = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/accounting/journal-entries/${id}/post`, { 
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': activeCsrfToken }
      });
      if (res.ok) await fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemapLine = async (entryId: string, lineNumber: number, newAccountCode: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/accounting/journal-entries/${entryId}/lines/${lineNumber}/map`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': activeCsrfToken
        },
        body: JSON.stringify({ account_code: newAccountCode })
      });
      if (res.ok) await fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F5F7FA] text-[#17202A] overflow-hidden">
      {/* 1. Page Header */}
      <div className="px-8 py-5 border-b border-[#D9E0E7] bg-white flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-[#17202A] tracking-tight flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#1F5D8F]" />
              <span>Double-Entry Journals & Accounting Reports</span>
            </h1>
            <span className="px-2 py-0.5 rounded-[4px] text-[11px] font-semibold bg-[#E8F1F8] text-[#1F5D8F] border border-[#A8C6DC]">
              CA Review Mode
            </span>
          </div>
          <p className="text-xs text-[#6B7280] mt-1">
            Automated journal transformation, double-entry verification, and draft financial statements • AiroKnight Studios
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="p-1.5 bg-white hover:bg-[#F8FAFC] text-[#4B5563] rounded-[6px] text-xs font-medium border border-[#D9E0E7] transition-colors shadow-2xs"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleGenerateDrafts}
            disabled={actionLoading === 'generate'}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1F5D8F] hover:bg-[#174A73] text-white rounded-[6px] text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{actionLoading === 'generate' ? 'Generating...' : 'Generate Draft Journals'}</span>
          </button>

          <button
            onClick={handlePostAll}
            disabled={actionLoading === 'post_all'}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#237A57] hover:bg-[#1B5E43] text-white rounded-[6px] text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>{actionLoading === 'post_all' ? 'Posting...' : 'Post All Approved'}</span>
          </button>
        </div>
      </div>

      {/* 2. Sub-Navigation Tabs */}
      <div className="px-8 border-b border-[#D9E0E7] bg-white flex items-center space-x-2 shrink-0">
        {[
          { id: 'journals', label: 'Journal Register', icon: BookOpen, count: journalEntries.length },
          { id: 'trial_balance', label: 'Trial Balance', icon: Scale },
          { id: 'statements', label: 'Financial Statements (P&L & BS)', icon: BarChart3 },
          { id: 'ar_ap', label: 'AR & AP Ageing', icon: Users },
          { id: 'coa', label: 'Chart of Accounts', icon: Layers, count: accounts.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-[#1F5D8F] text-[#1F5D8F] font-semibold bg-[#F8FAFC]'
                  : 'border-transparent text-[#6B7280] hover:text-[#17202A] hover:bg-[#F8FAFC]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-[#E8F1F8] text-[#1F5D8F]' : 'bg-[#EEF2F6] text-[#6B7280]'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 3. Main Tab Content Canvas */}
      <div className="flex-1 overflow-y-auto p-8">
        {/* TAB 1: JOURNAL ENTRIES */}
        {activeSubTab === 'journals' && (
          <div className="max-w-6xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#17202A] flex items-center gap-2">
                <span>Journal Entries</span>
                <span className="text-xs font-normal text-[#6B7280]">({journalEntries.length} total entries)</span>
              </h2>
            </div>

            {journalEntries.length === 0 ? (
              <div className="border border-dashed border-[#D9E0E7] bg-white rounded-[8px] p-12 text-center">
                <BookOpen className="w-10 h-10 text-[#9CA3AF] mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-[#17202A]">No Journal Entries Generated</h3>
                <p className="text-xs text-[#6B7280] max-w-sm mx-auto mt-1 mb-4">
                  Click &quot;Generate Draft Journals&quot; to translate your validated invoices and bank transactions into balanced double-entry accounting records.
                </p>
                <button
                  onClick={handleGenerateDrafts}
                  className="px-4 py-2 bg-[#1F5D8F] hover:bg-[#174A73] text-white rounded-[6px] text-xs font-semibold shadow-xs"
                >
                  Generate First Drafts
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {journalEntries.map((je) => (
                  <div 
                    key={je.id}
                    className="bg-white border border-[#D9E0E7] rounded-[8px] p-4 shadow-xs transition-all hover:border-[#B8C2CC]"
                  >
                    {/* Header Row */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#D9E0E7]">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold text-[#1F5D8F] bg-[#E8F1F8] px-2 py-0.5 rounded border border-[#A8C6DC]">
                          {je.entry_number}
                        </span>
                        <span className="text-xs text-[#6B7280] font-mono">{je.posting_date}</span>
                        <span className="text-xs font-semibold text-[#17202A]">{je.narration}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Status Badge */}
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                          je.status === 'posted'
                            ? 'bg-[#E8F5EE] text-[#237A57] border border-[#A8D8C1]'
                            : je.status === 'ca_approved'
                            ? 'bg-[#E8F1F8] text-[#1F5D8F] border border-[#A8C6DC]'
                            : je.status === 'needs_mapping'
                            ? 'bg-[#FFF5D6] text-[#9A6700] border border-[#E7CA75]'
                            : 'bg-[#EEF2F6] text-[#6B7280] border border-[#D9E0E7]'
                        }`}>
                          {je.status.replace('_', ' ')}
                        </span>

                        {/* Action buttons */}
                        {je.status === 'ready_for_review' && (
                          <button
                            onClick={() => handleApproveEntry(je.id)}
                            className="px-2.5 py-1 bg-[#E8F1F8] hover:bg-[#D4E6F4] text-[#1F5D8F] border border-[#A8C6DC] rounded-[4px] text-[11px] font-semibold transition-colors"
                          >
                            CA Approve
                          </button>
                        )}
                        {(je.status === 'ca_approved' || je.status === 'ready_for_review') && (
                          <button
                            onClick={() => handlePostEntry(je.id)}
                            className="px-2.5 py-1 bg-[#E8F5EE] hover:bg-[#D5EFE1] text-[#237A57] border border-[#A8D8C1] rounded-[4px] text-[11px] font-semibold transition-colors"
                          >
                            Post to GL
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Journal Lines Table */}
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="text-[11px] font-semibold text-[#4B5563] border-b border-[#D9E0E7] bg-[#F8FAFC]">
                            <th className="py-1.5 px-3 w-20">Account</th>
                            <th className="py-1.5 px-3">Account Title</th>
                            <th className="py-1.5 px-3">Sub-ledger / Party</th>
                            <th className="py-1.5 px-3 text-right w-32">Debit (₹)</th>
                            <th className="py-1.5 px-3 text-right w-32">Credit (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#D9E0E7] font-mono">
                          {je.lines.map((l, idx) => (
                            <tr key={idx} className="hover:bg-[#F8FAFC]">
                              <td className="py-2 px-3 text-[#1F5D8F] font-semibold">{l.account_code}</td>
                              <td className="py-2 px-3 text-[#17202A] font-sans">
                                {l.account_code === '5900' && je.status !== 'posted' ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[#9A6700] font-medium">{l.account_name}</span>
                                    <select
                                      onChange={(e) => handleRemapLine(je.id, l.line_number, e.target.value)}
                                      defaultValue=""
                                      className="bg-white border border-[#E7CA75] text-[#9A6700] text-[11px] rounded px-2 py-0.5 focus:outline-none focus:border-[#9A6700] cursor-pointer"
                                    >
                                      <option value="" disabled>Map to COA...</option>
                                      {accounts.map(a => (
                                        <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                ) : (
                                  l.account_name
                                )}
                              </td>
                              <td className="py-2 px-3 text-[#6B7280] font-sans">
                                {l.subledger_name || '—'}
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums text-[#237A57] font-medium">
                                {l.debit !== '—' ? `₹${l.debit}` : '—'}
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums text-[#17202A] font-medium">
                                {l.credit !== '—' ? `₹${l.credit}` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-[#D9E0E7] bg-[#F8FAFC] font-semibold font-mono text-[#17202A]">
                            <td colSpan={3} className="py-2 px-3 text-right font-sans text-[#4B5563]">Total Balance:</td>
                            <td className="py-2 px-3 text-right tabular-nums text-[#237A57]">₹{je.total_debit}</td>
                            <td className="py-2 px-3 text-right tabular-nums text-[#17202A]">₹{je.total_credit}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TRIAL BALANCE */}
        {activeSubTab === 'trial_balance' && (
          <div className="max-w-6xl mx-auto space-y-4">
            {/* Audit & Posting Ledger Status Banner */}
            <div className="bg-white rounded-[8px] border border-[#D9E0E7] p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="flex items-center gap-2.5">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${includeDrafts ? 'bg-[#9A6700]' : 'bg-[#237A57]'}`}></span>
                <div>
                  <span className="font-semibold text-[#17202A]">
                    {includeDrafts 
                      ? `Draft Working Forecast (${journalEntries.length} Total Journals Preview)` 
                      : `Final General Ledger (${journalEntries.filter(e => e.status === 'posted').length} Posted Transactions)`}
                  </span>
                  <p className="text-[11px] text-[#6B7280] mt-0.5">
                    {journalEntries.filter(e => e.status !== 'posted').length > 0
                      ? `${journalEntries.filter(e => e.status !== 'posted').length} journal entries are currently in draft / awaiting posting into the permanent general ledger.`
                      : 'All journal entries are posted to the General Ledger.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-[#F8FAFC] p-0.5 rounded-[6px] border border-[#D9E0E7] text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setIncludeDrafts(false);
                      fetchData(false);
                    }}
                    className={`px-3 py-1 rounded-[4px] font-semibold transition-colors ${
                      !includeDrafts 
                        ? 'bg-[#1F5D8F] text-white shadow-2xs' 
                        : 'text-[#6B7280] hover:text-[#17202A]'
                    }`}
                  >
                    Posted Only ({journalEntries.filter(e => e.status === 'posted').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIncludeDrafts(true);
                      fetchData(true);
                    }}
                    className={`px-3 py-1 rounded-[4px] font-semibold transition-colors ${
                      includeDrafts 
                        ? 'bg-[#1F5D8F] text-white shadow-2xs' 
                        : 'text-[#6B7280] hover:text-[#17202A]'
                    }`}
                  >
                    All Journals Preview ({journalEntries.length})
                  </button>
                </div>

                {journalEntries.filter(e => e.status !== 'posted').length > 0 && (
                  <button
                    type="button"
                    onClick={handlePostAll}
                    disabled={actionLoading === 'post_all'}
                    className="px-3.5 py-1.5 bg-[#237A57] hover:bg-[#1B5E43] text-white rounded-[6px] text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                    title="Batch post all balanced journal entries to the permanent General Ledger"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>{actionLoading === 'post_all' ? 'Posting...' : `Post All (${journalEntries.filter(e => e.status !== 'posted').length}) to Ledger`}</span>
                  </button>
                )}
              </div>
            </div>
            {trialBalance && (
              <div className={`p-4 rounded-[8px] border flex items-center justify-between ${
                trialBalance.is_balanced
                  ? 'bg-[#E8F5EE] border-[#A8D8C1] text-[#237A57]'
                  : 'bg-[#FDECEC] border-[#E8AAAA] text-[#B33A3A]'
              }`}>
                <div className="flex items-center gap-3">
                  {trialBalance.is_balanced ? (
                    <CheckCircle2 className="w-5 h-5 text-[#237A57]" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-[#B33A3A]" />
                  )}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider">
                      {trialBalance.is_balanced ? 'Trial Balance In Equilibrium' : 'Trial Balance Variance Detected'}
                    </h3>
                    <p className="text-[11px] text-[#4B5563] mt-0.5">
                      Total Debit: ₹{trialBalance.total_debit} = Total Credit: ₹{trialBalance.total_credit}
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-white text-[#237A57] border border-[#A8D8C1]">
                  MATHEMATICALLY BALANCED
                </span>
              </div>
            )}

            <div className="bg-white border border-[#D9E0E7] rounded-[8px] overflow-hidden shadow-xs">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F8FAFC] border-b border-[#D9E0E7] text-[#4B5563]">
                  <tr className="font-semibold text-[11px]">
                    <th className="py-2.5 px-4">Account Code</th>
                    <th className="py-2.5 px-4">Account Title</th>
                    <th className="py-2.5 px-4">Classification</th>
                    <th className="py-2.5 px-4 text-right">Debit Balance (₹)</th>
                    <th className="py-2.5 px-4 text-right">Credit Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D9E0E7] font-mono">
                  {trialBalance?.rows.map((r, idx) => (
                    <tr key={idx} className="hover:bg-[#F8FAFC]">
                      <td className="py-2.5 px-4 text-[#1F5D8F] font-bold">{r.account_code}</td>
                      <td className="py-2.5 px-4 text-[#17202A] font-sans font-medium">{r.account_name}</td>
                      <td className="py-2.5 px-4 text-[#6B7280] uppercase text-[10px] font-sans tracking-wider">{r.category}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-[#237A57] font-medium">
                        {r.debit !== '—' ? `₹${r.debit}` : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-[#17202A] font-medium">
                        {r.credit !== '—' ? `₹${r.credit}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {trialBalance && (
                  <tfoot className="bg-[#F8FAFC] border-t-2 border-[#D9E0E7] font-mono font-bold text-sm">
                    <tr>
                      <td colSpan={3} className="py-3 px-4 text-right font-sans text-[#4B5563]">Equilibrium Sum:</td>
                      <td className="py-3 px-4 text-right tabular-nums text-[#237A57]">₹{trialBalance.total_debit}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-[#17202A]">₹{trialBalance.total_credit}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: FINANCIAL STATEMENTS */}
        {activeSubTab === 'statements' && finStatements && (
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Audit & Posting Ledger Status Banner */}
            <div className="bg-white rounded-[8px] border border-[#D9E0E7] p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="flex items-center gap-2.5">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${includeDrafts ? 'bg-[#9A6700]' : 'bg-[#237A57]'}`}></span>
                <div>
                  <span className="font-semibold text-[#17202A]">
                    {includeDrafts 
                      ? `Draft Working Forecast (${journalEntries.length} Total Journals Preview)` 
                      : `Final General Ledger (${journalEntries.filter(e => e.status === 'posted').length} Posted Transactions)`}
                  </span>
                  <p className="text-[11px] text-[#6B7280] mt-0.5">
                    {journalEntries.filter(e => e.status !== 'posted').length > 0
                      ? `${journalEntries.filter(e => e.status !== 'posted').length} journal entries are in draft. Switch to "All Journals Preview" or click "Post All" to include them in P&L.`
                      : 'All journal entries are posted to the General Ledger.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-[#F8FAFC] p-0.5 rounded-[6px] border border-[#D9E0E7] text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setIncludeDrafts(false);
                      fetchData(false);
                    }}
                    className={`px-3 py-1 rounded-[4px] font-semibold transition-colors ${
                      !includeDrafts 
                        ? 'bg-[#1F5D8F] text-white shadow-2xs' 
                        : 'text-[#6B7280] hover:text-[#17202A]'
                    }`}
                  >
                    Posted Only ({journalEntries.filter(e => e.status === 'posted').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIncludeDrafts(true);
                      fetchData(true);
                    }}
                    className={`px-3 py-1 rounded-[4px] font-semibold transition-colors ${
                      includeDrafts 
                        ? 'bg-[#1F5D8F] text-white shadow-2xs' 
                        : 'text-[#6B7280] hover:text-[#17202A]'
                    }`}
                  >
                    All Journals Preview ({journalEntries.length})
                  </button>
                </div>

                {journalEntries.filter(e => e.status !== 'posted').length > 0 && (
                  <button
                    type="button"
                    onClick={handlePostAll}
                    disabled={actionLoading === 'post_all'}
                    className="px-3.5 py-1.5 bg-[#237A57] hover:bg-[#1B5E43] text-white rounded-[6px] text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                    title="Batch post all balanced journal entries to the permanent General Ledger"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>{actionLoading === 'post_all' ? 'Posting...' : `Post All (${journalEntries.filter(e => e.status !== 'posted').length}) to Ledger`}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-[#6B7280] pb-2 border-b border-[#D9E0E7]">
              <span className="font-semibold text-[#17202A]">{finStatements.period}</span>
              <span className="italic text-[#9A6700]">{finStatements.disclaimer}</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Profit & Loss */}
              <div className="bg-white border border-[#D9E0E7] rounded-[8px] p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-[#D9E0E7] pb-3">
                  <h3 className="text-sm font-bold text-[#17202A] flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#237A57]" />
                    <span>Profit & Loss Statement</span>
                  </h3>
                  <span className="text-xs font-mono font-bold text-[#237A57]">
                    Net Profit: ₹{finStatements.profit_and_loss.net_profit}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="text-[11px] font-bold text-[#4B5563] uppercase tracking-wider">Revenue</div>
                  {finStatements.profit_and_loss.revenue_items.map((it, idx) => (
                    <div key={idx} className="flex justify-between py-1 text-[#4B5563] font-mono">
                      <span className="font-sans">{it.name}</span>
                      <span className="tabular-nums">₹{it.amount}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-1.5 border-t border-[#D9E0E7] font-bold font-mono text-[#237A57]">
                    <span className="font-sans">Total Revenue:</span>
                    <span className="tabular-nums">₹{finStatements.profit_and_loss.total_revenue}</span>
                  </div>

                  <div className="pt-3 text-[11px] font-bold text-[#4B5563] uppercase tracking-wider">Operating Expenses</div>
                  {finStatements.profit_and_loss.expense_items.map((it, idx) => (
                    <div key={idx} className="flex justify-between py-1 text-[#4B5563] font-mono">
                      <span className="font-sans">{it.name}</span>
                      <span className="tabular-nums">₹{it.amount}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-1.5 border-t border-[#D9E0E7] font-bold font-mono text-[#B33A3A]">
                    <span className="font-sans">Total Expenses:</span>
                    <span className="tabular-nums">₹{finStatements.profit_and_loss.total_expenses}</span>
                  </div>
                </div>

                <div className="p-3 bg-[#F8FAFC] rounded-[6px] flex items-center justify-between font-bold text-xs border border-[#D9E0E7]">
                  <span className="text-[#17202A]">Net Profit / (Loss):</span>
                  <span className="text-[#237A57] font-mono text-sm tabular-nums">₹{finStatements.profit_and_loss.net_profit}</span>
                </div>
              </div>

              {/* Balance Sheet */}
              <div className="bg-white border border-[#D9E0E7] rounded-[8px] p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-[#D9E0E7] pb-3">
                  <h3 className="text-sm font-bold text-[#17202A] flex items-center gap-2">
                    <Scale className="w-4 h-4 text-[#1F5D8F]" />
                    <span>Balance Sheet</span>
                  </h3>
                  <span className="text-xs font-mono font-bold text-[#1F5D8F]">
                    Assets: ₹{finStatements.balance_sheet.total_assets}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="text-[11px] font-bold text-[#4B5563] uppercase tracking-wider">Assets</div>
                  {finStatements.balance_sheet.assets.map((it, idx) => (
                    <div key={idx} className="flex justify-between py-1 text-[#4B5563] font-mono">
                      <span className="font-sans">{it.name}</span>
                      <span className="tabular-nums">₹{it.amount}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-1.5 border-t border-[#D9E0E7] font-bold font-mono text-[#1F5D8F]">
                    <span className="font-sans">Total Assets:</span>
                    <span className="tabular-nums">₹{finStatements.balance_sheet.total_assets}</span>
                  </div>

                  <div className="pt-3 text-[11px] font-bold text-[#4B5563] uppercase tracking-wider">Liabilities & Equity</div>
                  {finStatements.balance_sheet.liabilities.map((it, idx) => (
                    <div key={idx} className="flex justify-between py-1 text-[#4B5563] font-mono">
                      <span className="font-sans">{it.name}</span>
                      <span className="tabular-nums">₹{it.amount}</span>
                    </div>
                  ))}
                  {finStatements.balance_sheet.equity.map((it, idx) => (
                    <div key={idx} className="flex justify-between py-1 text-[#4B5563] font-mono">
                      <span className="font-sans">{it.name}</span>
                      <span className="tabular-nums">₹{it.amount}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-1.5 border-t border-[#D9E0E7] font-bold font-mono text-[#1F5D8F]">
                    <span className="font-sans">Total Liabilities & Equity:</span>
                    <span className="tabular-nums">₹{finStatements.balance_sheet.total_liabilities_and_equity}</span>
                  </div>
                </div>

                <div className="p-3 bg-[#F8FAFC] rounded-[6px] flex items-center justify-between font-bold text-xs border border-[#D9E0E7]">
                  <span className="text-[#17202A]">Equilibrium Check:</span>
                  <span className="text-[#237A57] font-mono">
                    {finStatements.balance_sheet.is_balanced ? '✓ Assets = Liabilities + Equity' : 'Variance Detected'}
                  </span>
                </div>
              </div>
            </div>

            {/* GST Summary */}
            <div className="bg-white border border-[#D9E0E7] rounded-[8px] p-5 shadow-xs">
              <h3 className="text-sm font-bold text-[#17202A] mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#1F5D8F]" />
                <span>Statutory GST Position Summary</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
                <div className="p-3.5 bg-[#F8FAFC] rounded-[6px] border border-[#D9E0E7]">
                  <span className="text-[11px] font-sans text-[#6B7280] block mb-1">Input Tax Credit (ITC Available)</span>
                  <span className="text-base font-bold text-[#237A57] tabular-nums">
                    ₹{finStatements.gst_summary.input_tax_credit.total_itc}
                  </span>
                  <p className="text-[10px] font-sans text-[#9CA3AF] mt-1">Paid on verified vendor purchase bills</p>
                </div>

                <div className="p-3.5 bg-[#F8FAFC] rounded-[6px] border border-[#D9E0E7]">
                  <span className="text-[11px] font-sans text-[#6B7280] block mb-1">Output Tax Liability (Collected)</span>
                  <span className="text-base font-bold text-[#B33A3A] tabular-nums">
                    ₹{finStatements.gst_summary.output_tax_liability.total_output}
                  </span>
                  <p className="text-[10px] font-sans text-[#9CA3AF] mt-1">Collected on client sales invoices</p>
                </div>

                <div className="p-3.5 bg-[#E8F1F8] rounded-[6px] border border-[#A8C6DC]">
                  <span className="text-[11px] font-sans text-[#1F5D8F] block mb-1 font-semibold">Net GST Position</span>
                  <span className="text-base font-bold text-[#1F5D8F] tabular-nums">
                    ₹{finStatements.gst_summary.net_gst_position.net_payable}
                  </span>
                  <p className="text-[10px] font-sans text-[#1F5D8F] mt-1 font-semibold">
                    {finStatements.gst_summary.net_gst_position.status}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: AR & AP AGEING */}
        {activeSubTab === 'ar_ap' && arAp && (
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Accounts Receivable */}
            <div className="bg-white border border-[#D9E0E7] rounded-[8px] p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#17202A] flex items-center gap-2">
                  <ArrowDownLeft className="w-4 h-4 text-[#237A57]" />
                  <span>Accounts Receivable (Customer Outstandings)</span>
                </h3>
                <span className="text-xs font-mono font-bold text-[#237A57] tabular-nums">
                  Total Outstanding: ₹{arAp.accounts_receivable.total_outstanding}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-[11px] font-semibold text-[#4B5563] border-b border-[#D9E0E7] bg-[#F8FAFC]">
                    <tr>
                      <th className="py-2 px-3">Customer</th>
                      <th className="py-2 px-3">Invoice #</th>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3 text-right">Invoice Total</th>
                      <th className="py-2 px-3 text-right">Received</th>
                      <th className="py-2 px-3 text-right">Outstanding</th>
                      <th className="py-2 px-3 text-center">Ageing Bucket</th>
                      <th className="py-2 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D9E0E7] font-mono">
                    {arAp.accounts_receivable.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-[#F8FAFC]">
                        <td className="py-2 px-3 font-sans font-medium text-[#17202A]">{it.customer}</td>
                        <td className="py-2 px-3 text-[#1F5D8F]">{it.invoice_number}</td>
                        <td className="py-2 px-3 text-[#6B7280]">{it.invoice_date}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#4B5563]">₹{it.total_amount}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#237A57]">₹{it.received_amount || '0.00'}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-bold text-[#17202A]">₹{it.outstanding_amount}</td>
                        <td className="py-2 px-3 text-center text-[#6B7280] text-[11px] font-sans">{it.ageing_bucket}</td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold ${
                            it.status === 'Paid' ? 'bg-[#E8F5EE] text-[#237A57] border border-[#A8D8C1]' : 'bg-[#FFF5D6] text-[#9A6700] border border-[#E7CA75]'
                          }`}>
                            {it.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Accounts Payable */}
            <div className="bg-white border border-[#D9E0E7] rounded-[8px] p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#17202A] flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-[#B33A3A]" />
                  <span>Accounts Payable (Vendor Liabilities)</span>
                </h3>
                <span className="text-xs font-mono font-bold text-[#B33A3A] tabular-nums">
                  Total Outstanding: ₹{arAp.accounts_payable.total_outstanding}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-[11px] font-semibold text-[#4B5563] border-b border-[#D9E0E7] bg-[#F8FAFC]">
                    <tr>
                      <th className="py-2 px-3">Vendor</th>
                      <th className="py-2 px-3">Invoice #</th>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3 text-right">Invoice Total</th>
                      <th className="py-2 px-3 text-right">Paid</th>
                      <th className="py-2 px-3 text-right">Outstanding</th>
                      <th className="py-2 px-3 text-center">Ageing Bucket</th>
                      <th className="py-2 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D9E0E7] font-mono">
                    {arAp.accounts_payable.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-[#F8FAFC]">
                        <td className="py-2 px-3 font-sans font-medium text-[#17202A]">{it.vendor}</td>
                        <td className="py-2 px-3 text-[#1F5D8F]">{it.invoice_number}</td>
                        <td className="py-2 px-3 text-[#6B7280]">{it.invoice_date}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#4B5563]">₹{it.total_amount}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#B33A3A]">₹{it.paid_amount || '0.00'}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-bold text-[#17202A]">₹{it.outstanding_amount}</td>
                        <td className="py-2 px-3 text-center text-[#6B7280] text-[11px] font-sans">{it.ageing_bucket}</td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold ${
                            it.status === 'Paid' ? 'bg-[#E8F5EE] text-[#237A57] border border-[#A8D8C1]' : 'bg-[#FFF5D6] text-[#9A6700] border border-[#E7CA75]'
                          }`}>
                            {it.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: CHART OF ACCOUNTS */}
        {activeSubTab === 'coa' && (
          <div className="max-w-6xl mx-auto bg-white border border-[#D9E0E7] rounded-[8px] overflow-hidden shadow-xs">
            <div className="p-4 border-b border-[#D9E0E7] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#17202A]">Configured Chart of Accounts</h3>
              <span className="text-xs text-[#6B7280]">Standard Indian Accounting & GST Schema</span>
            </div>
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F8FAFC] border-b border-[#D9E0E7] text-[#4B5563]">
                <tr className="font-semibold text-[11px]">
                  <th className="py-2.5 px-4">Account Code</th>
                  <th className="py-2.5 px-4">Account Title</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4">Normal Balance</th>
                  <th className="py-2.5 px-4">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D9E0E7]">
                {accounts.map((a, idx) => (
                  <tr key={idx} className="hover:bg-[#F8FAFC]">
                    <td className="py-2.5 px-4 font-mono font-bold text-[#1F5D8F]">{a.code}</td>
                    <td className="py-2.5 px-4 font-medium text-[#17202A]">{a.name}</td>
                    <td className="py-2.5 px-4 text-[#6B7280] uppercase text-[10px] tracking-wider">{a.category}</td>
                    <td className="py-2.5 px-4 text-[#17202A] capitalize font-mono text-[11px]">{a.normal_balance}</td>
                    <td className="py-2.5 px-4 text-[#6B7280] text-[11px]">{a.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
