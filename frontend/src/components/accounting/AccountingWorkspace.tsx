'use client';

import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Scale, 
  BarChart3, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Send, 
  CheckCheck, 
  RefreshCw, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Layers, 
  FileText, 
  Sparkles,
  ChevronRight,
  TrendingUp,
  Download,
  Filter
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
}

export const AccountingWorkspace: React.FC<AccountingWorkspaceProps> = ({ csrfToken: initialCsrfToken }) => {
  const [activeSubTab, setActiveSubTab] = useState<'journals' | 'trial_balance' | 'statements' | 'ar_ap' | 'ledgers' | 'coa'>('journals');
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeCsrfToken, setActiveCsrfToken] = useState<string>(initialCsrfToken || '');

  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [trialBalance, setTrialBalance] = useState<{ is_balanced: boolean; total_debit: string; total_credit: string; rows: TrialBalanceRow[] } | null>(null);
  const [finStatements, setFinStatements] = useState<FinancialStatements | null>(null);
  const [arAp, setArAp] = useState<{ accounts_receivable: { total_outstanding: string; items: ArApItem[] }; accounts_payable: { total_outstanding: string; items: ArApItem[] } } | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // Ensure CSRF token is available
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

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [jeRes, tbRes, fsRes, arapRes, coaRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/accounting/journal-entries`, { credentials: 'include' }),
        fetch(`${API_BASE}/api/v1/accounting/trial-balance`, { credentials: 'include' }),
        fetch(`${API_BASE}/api/v1/accounting/financial-statements`, { credentials: 'include' }),
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

  // Action: Generate Drafts
  const handleGenerateDrafts = async () => {
    setActionLoading('generate');
    try {
      const res = await fetch(`${API_BASE}/api/v1/accounting/generate-drafts`, { 
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRF-Token': activeCsrfToken
        }
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  // Action: Post All Approved
  const handlePostAll = async () => {
    setActionLoading('post_all');
    try {
      const res = await fetch(`${API_BASE}/api/v1/accounting/post-all`, { 
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRF-Token': activeCsrfToken
        }
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  // Action: Approve Single Entry
  const handleApproveEntry = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/accounting/journal-entries/${id}/approve`, { 
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRF-Token': activeCsrfToken
        }
      });
      if (res.ok) await fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  // Action: Post Single Entry
  const handlePostEntry = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/accounting/journal-entries/${id}/post`, { 
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRF-Token': activeCsrfToken
        }
      });
      if (res.ok) await fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  // Action: Remap Account Line
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
    <div className="flex-1 flex flex-col h-full bg-slate-900 text-slate-100 overflow-hidden">
      {/* Top Header Bar */}
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-400" />
              <span>Double-Entry Accounting & Ledger</span>
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              CA Review Mode
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Automated journal transformation, trial balance verification, and draft financial statements
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors border border-slate-700"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleGenerateDrafts}
            disabled={actionLoading === 'generate'}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-900/30 transition-all disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{actionLoading === 'generate' ? 'Generating...' : 'Generate Draft Journals'}</span>
          </button>

          <button
            onClick={handlePostAll}
            disabled={actionLoading === 'post_all'}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-emerald-900/30 transition-all disabled:opacity-50"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>{actionLoading === 'post_all' ? 'Posting...' : 'Post All Approved'}</span>
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="px-6 border-b border-slate-800 bg-slate-900/80 flex items-center space-x-1">
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
              className={`flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-all ${
                isActive
                  ? 'border-indigo-500 text-indigo-400 bg-slate-800/40'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/20'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-500'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Tab Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* ================================================================= */}
        {/* TAB 1: JOURNAL REGISTER */}
        {/* ================================================================= */}
        {activeSubTab === 'journals' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <span>Journal Entries</span>
                <span className="text-xs font-normal text-slate-400">({journalEntries.length} total entries)</span>
              </h2>
            </div>

            {journalEntries.length === 0 ? (
              <div className="border border-dashed border-slate-800 rounded-xl p-12 text-center">
                <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-slate-300">No Journal Entries Yet</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                  Click "Generate Draft Journals" to translate your validated invoices and bank transactions into double-entry accounting records.
                </p>
                <button
                  onClick={handleGenerateDrafts}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold"
                >
                  Generate First Drafts
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {journalEntries.map((je) => (
                  <div 
                    key={je.id}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-4 transition-all hover:border-slate-700"
                  >
                    {/* Header Row */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-950/50 px-2 py-1 rounded border border-indigo-900/60">
                          {je.entry_number}
                        </span>
                        <span className="text-xs text-slate-400">{je.posting_date}</span>
                        <span className="text-xs font-medium text-slate-200">{je.narration}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Status Badge */}
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                          je.status === 'posted'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : je.status === 'ca_approved'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                            : je.status === 'needs_mapping'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {je.status.replace('_', ' ')}
                        </span>

                        {/* Action buttons */}
                        {je.status === 'ready_for_review' && (
                          <button
                            onClick={() => handleApproveEntry(je.id)}
                            className="px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded text-[11px] font-semibold transition-colors"
                          >
                            CA Approve
                          </button>
                        )}
                        {(je.status === 'ca_approved' || je.status === 'ready_for_review') && (
                          <button
                            onClick={() => handlePostEntry(je.id)}
                            className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded text-[11px] font-semibold transition-colors"
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
                          <tr className="text-[11px] text-slate-500 border-b border-slate-900">
                            <th className="py-1 px-2 font-medium w-16">Account</th>
                            <th className="py-1 px-2 font-medium">Account Description</th>
                            <th className="py-1 px-2 font-medium">Sub-ledger / Party</th>
                            <th className="py-1 px-2 font-medium text-right w-28">Debit (₹)</th>
                            <th className="py-1 px-2 font-medium text-right w-28">Credit (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900/40 font-mono">
                          {je.lines.map((l, idx) => (
                            <tr key={idx} className="hover:bg-slate-900/30">
                              <td className="py-1.5 px-2 text-indigo-400 font-semibold">{l.account_code}</td>
                              <td className="py-1.5 px-2 text-slate-300 font-sans">
                                {l.account_code === '5900' && je.status !== 'posted' ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-amber-400 font-medium">{l.account_name}</span>
                                    <select
                                      onChange={(e) => handleRemapLine(je.id, l.line_number, e.target.value)}
                                      defaultValue=""
                                      className="bg-slate-900 border border-amber-500/40 text-amber-200 text-[11px] rounded px-2 py-0.5 focus:outline-none focus:border-amber-400 cursor-pointer"
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
                              <td className="py-1.5 px-2 text-slate-400 font-sans">
                                {l.subledger_name || '—'}
                              </td>
                              <td className="py-1.5 px-2 text-right text-emerald-400 font-medium">
                                {l.debit !== '—' ? `₹${l.debit}` : '—'}
                              </td>
                              <td className="py-1.5 px-2 text-right text-slate-300 font-medium">
                                {l.credit !== '—' ? `₹${l.credit}` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-slate-800 font-semibold font-mono text-slate-300">
                            <td colSpan={3} className="py-1.5 px-2 text-right font-sans text-slate-400">Total:</td>
                            <td className="py-1.5 px-2 text-right text-emerald-400">₹{je.total_debit}</td>
                            <td className="py-1.5 px-2 text-right text-emerald-400">₹{je.total_credit}</td>
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

        {/* ================================================================= */}
        {/* TAB 2: TRIAL BALANCE */}
        {/* ================================================================= */}
        {activeSubTab === 'trial_balance' && (
          <div className="space-y-4">
            {/* Equilibrium Banner */}
            {trialBalance && (
              <div className={`p-4 rounded-xl border flex items-center justify-between ${
                trialBalance.is_balanced
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
              }`}>
                <div className="flex items-center gap-3">
                  {trialBalance.is_balanced ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-400" />
                  )}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider">
                      {trialBalance.is_balanced ? 'Trial Balance In Equilibrium' : 'Trial Balance Variance Detected'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Total Debit: ₹{trialBalance.total_debit} = Total Credit: ₹{trialBalance.total_credit}
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  MATHEMATICALLY BALANCED
                </span>
              </div>
            )}

            {/* Trial Balance Table */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Account Code</th>
                    <th className="py-2.5 px-4 font-semibold">Account Title</th>
                    <th className="py-2.5 px-4 font-semibold">Classification</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Debit Balance (₹)</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Credit Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {trialBalance?.rows.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40">
                      <td className="py-2.5 px-4 text-indigo-400 font-bold">{r.account_code}</td>
                      <td className="py-2.5 px-4 text-slate-200 font-sans font-medium">{r.account_name}</td>
                      <td className="py-2.5 px-4 text-slate-400 uppercase text-[10px] font-sans tracking-wider">{r.category}</td>
                      <td className="py-2.5 px-4 text-right text-emerald-400 font-medium">
                        {r.debit !== '—' ? `₹${r.debit}` : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-300 font-medium">
                        {r.credit !== '—' ? `₹${r.credit}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {trialBalance && (
                  <tfoot className="bg-slate-900/90 border-t-2 border-slate-700 font-mono font-bold text-sm">
                    <tr>
                      <td colSpan={3} className="py-3 px-4 text-right font-sans text-slate-300">Sum Total:</td>
                      <td className="py-3 px-4 text-right text-emerald-400">₹{trialBalance.total_debit}</td>
                      <td className="py-3 px-4 text-right text-emerald-400">₹{trialBalance.total_credit}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: FINANCIAL STATEMENTS */}
        {/* ================================================================= */}
        {activeSubTab === 'statements' && finStatements && (
          <div className="space-y-6">
            <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
              <span className="font-semibold text-slate-300">{finStatements.period}</span>
              <span className="italic text-amber-400/90">{finStatements.disclaimer}</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 1. Profit & Loss Statement */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span>Profit & Loss Statement</span>
                  </h3>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    Net Profit: ₹{finStatements.profit_and_loss.net_profit}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Revenue</div>
                  {finStatements.profit_and_loss.revenue_items.map((it, idx) => (
                    <div key={idx} className="flex justify-between py-1 text-slate-300 font-mono">
                      <span className="font-sans">{it.name}</span>
                      <span>₹{it.amount}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-1 border-t border-slate-800/80 font-bold font-mono text-emerald-400">
                    <span className="font-sans">Total Revenue:</span>
                    <span>₹{finStatements.profit_and_loss.total_revenue}</span>
                  </div>

                  <div className="pt-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Operating Expenses</div>
                  {finStatements.profit_and_loss.expense_items.map((it, idx) => (
                    <div key={idx} className="flex justify-between py-1 text-slate-300 font-mono">
                      <span className="font-sans">{it.name}</span>
                      <span>₹{it.amount}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-1 border-t border-slate-800/80 font-bold font-mono text-rose-400">
                    <span className="font-sans">Total Expenses:</span>
                    <span>₹{finStatements.profit_and_loss.total_expenses}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-900 rounded-lg flex items-center justify-between font-bold text-xs border border-slate-800">
                  <span className="text-slate-200">Net Profit / (Loss):</span>
                  <span className="text-emerald-400 font-mono text-sm">₹{finStatements.profit_and_loss.net_profit}</span>
                </div>
              </div>

              {/* 2. Balance Sheet */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Scale className="w-4 h-4 text-indigo-400" />
                    <span>Balance Sheet</span>
                  </h3>
                  <span className="text-xs font-mono font-bold text-indigo-400">
                    Assets: ₹{finStatements.balance_sheet.total_assets}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Assets</div>
                  {finStatements.balance_sheet.assets.map((it, idx) => (
                    <div key={idx} className="flex justify-between py-1 text-slate-300 font-mono">
                      <span className="font-sans">{it.name}</span>
                      <span>₹{it.amount}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-1 border-t border-slate-800/80 font-bold font-mono text-indigo-400">
                    <span className="font-sans">Total Assets:</span>
                    <span>₹{finStatements.balance_sheet.total_assets}</span>
                  </div>

                  <div className="pt-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Liabilities & Equity</div>
                  {finStatements.balance_sheet.liabilities.map((it, idx) => (
                    <div key={idx} className="flex justify-between py-1 text-slate-300 font-mono">
                      <span className="font-sans">{it.name}</span>
                      <span>₹{it.amount}</span>
                    </div>
                  ))}
                  {finStatements.balance_sheet.equity.map((it, idx) => (
                    <div key={idx} className="flex justify-between py-1 text-slate-300 font-mono">
                      <span className="font-sans">{it.name}</span>
                      <span>₹{it.amount}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-1 border-t border-slate-800/80 font-bold font-mono text-indigo-400">
                    <span className="font-sans">Total Liabilities & Equity:</span>
                    <span>₹{finStatements.balance_sheet.total_liabilities_and_equity}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-900 rounded-lg flex items-center justify-between font-bold text-xs border border-slate-800">
                  <span className="text-slate-200">Equilibrium Check:</span>
                  <span className="text-emerald-400 font-mono">
                    {finStatements.balance_sheet.is_balanced ? '✓ Assets = Liabilities + Equity' : 'Variance Detected'}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. GST Summary Position */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-sky-400" />
                <span>Statutory GST Position Summary</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                  <span className="text-[11px] font-sans text-slate-400 block mb-1">Input Tax Credit (ITC Available)</span>
                  <span className="text-base font-bold text-emerald-400">
                    ₹{finStatements.gst_summary.input_tax_credit.total_itc}
                  </span>
                  <p className="text-[10px] font-sans text-slate-500 mt-1">Paid on verified vendor purchase bills</p>
                </div>

                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                  <span className="text-[11px] font-sans text-slate-400 block mb-1">Output Tax Liability (Collected)</span>
                  <span className="text-base font-bold text-rose-400">
                    ₹{finStatements.gst_summary.output_tax_liability.total_output}
                  </span>
                  <p className="text-[10px] font-sans text-slate-500 mt-1">Collected on client sales invoices</p>
                </div>

                <div className="p-3 bg-indigo-950/30 rounded-lg border border-indigo-500/30">
                  <span className="text-[11px] font-sans text-indigo-300 block mb-1">Net GST Position</span>
                  <span className="text-base font-bold text-indigo-200">
                    ₹{finStatements.gst_summary.net_gst_position.net_payable}
                  </span>
                  <p className="text-[10px] font-sans text-indigo-400 mt-1 font-semibold">
                    {finStatements.gst_summary.net_gst_position.status}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: AR & AP AGEING */}
        {/* ================================================================= */}
        {activeSubTab === 'ar_ap' && arAp && (
          <div className="space-y-6">
            {/* Accounts Receivable */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                  <span>Accounts Receivable (Customer Outstandings)</span>
                </h3>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  Total Outstanding: ₹{arAp.accounts_receivable.total_outstanding}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-[11px] text-slate-500 border-b border-slate-800">
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
                  <tbody className="divide-y divide-slate-900 font-mono">
                    {arAp.accounts_receivable.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/40">
                        <td className="py-2 px-3 font-sans font-medium text-slate-200">{it.customer}</td>
                        <td className="py-2 px-3 text-indigo-400">{it.invoice_number}</td>
                        <td className="py-2 px-3 text-slate-400">{it.invoice_date}</td>
                        <td className="py-2 px-3 text-right text-slate-300">₹{it.total_amount}</td>
                        <td className="py-2 px-3 text-right text-emerald-400">₹{it.received_amount || '0.00'}</td>
                        <td className="py-2 px-3 text-right font-bold text-white">₹{it.outstanding_amount}</td>
                        <td className="py-2 px-3 text-center text-slate-400 text-[11px] font-sans">{it.ageing_bucket}</td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            it.status === 'Paid' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
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
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-rose-400" />
                  <span>Accounts Payable (Vendor Liabilities)</span>
                </h3>
                <span className="text-xs font-mono font-bold text-rose-400">
                  Total Outstanding: ₹{arAp.accounts_payable.total_outstanding}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-[11px] text-slate-500 border-b border-slate-800">
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
                  <tbody className="divide-y divide-slate-900 font-mono">
                    {arAp.accounts_payable.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/40">
                        <td className="py-2 px-3 font-sans font-medium text-slate-200">{it.vendor}</td>
                        <td className="py-2 px-3 text-indigo-400">{it.invoice_number}</td>
                        <td className="py-2 px-3 text-slate-400">{it.invoice_date}</td>
                        <td className="py-2 px-3 text-right text-slate-300">₹{it.total_amount}</td>
                        <td className="py-2 px-3 text-right text-rose-400">₹{it.paid_amount || '0.00'}</td>
                        <td className="py-2 px-3 text-right font-bold text-white">₹{it.outstanding_amount}</td>
                        <td className="py-2 px-3 text-center text-slate-400 text-[11px] font-sans">{it.ageing_bucket}</td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            it.status === 'Paid' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
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

        {/* ================================================================= */}
        {/* TAB 5: CHART OF ACCOUNTS */}
        {/* ================================================================= */}
        {activeSubTab === 'coa' && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Configured Chart of Accounts</h3>
              <span className="text-xs text-slate-400">Standard Indian Accounting & GST Schema</span>
            </div>
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900 border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Account Code</th>
                  <th className="py-2.5 px-4 font-semibold">Account Title</th>
                  <th className="py-2.5 px-4 font-semibold">Category</th>
                  <th className="py-2.5 px-4 font-semibold">Normal Balance</th>
                  <th className="py-2.5 px-4 font-semibold">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {accounts.map((a, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/40">
                    <td className="py-2.5 px-4 font-mono font-bold text-indigo-400">{a.code}</td>
                    <td className="py-2.5 px-4 font-medium text-slate-200">{a.name}</td>
                    <td className="py-2.5 px-4 text-slate-400 uppercase text-[10px] tracking-wider">{a.category}</td>
                    <td className="py-2.5 px-4 text-slate-300 capitalize font-mono text-[11px]">{a.normal_balance}</td>
                    <td className="py-2.5 px-4 text-slate-400 text-[11px]">{a.description}</td>
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
