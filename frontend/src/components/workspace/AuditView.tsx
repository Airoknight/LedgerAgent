'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw, Download, Lock, Check } from 'lucide-react';

interface AuditEventItem {
  id: string;
  timestamp: string;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: any;
  request_id?: string;
  source_ip?: string;
  previous_event_hash?: string;
  event_hash?: string;
}

interface VerifyResult {
  verified: boolean;
  total_events: number;
  verified_count?: number;
  latest_hash?: string;
  status: string;
  error?: string;
}

interface AuditViewProps {
  csrfToken?: string;
}

export const AuditView: React.FC<AuditViewProps> = ({ csrfToken }) => {
  const [events, setEvents] = useState<AuditEventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/v1/audit/events?limit=100', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch (e) {
      console.error('Failed to load audit events', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyChain = async () => {
    setIsVerifying(true);
    try {
      const res = await fetch('http://localhost:8000/api/v1/audit/verify-chain', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setVerifyResult(data);
      }
    } catch (e) {
      console.error('Failed to verify audit chain', e);
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F5F7FA] overflow-y-auto px-8 py-6 text-[#17202A]">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        {/* Page Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-[6px] bg-[#E8F1F8] border border-[#A8C6DC] flex items-center justify-center text-[#1F5D8F]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold text-[#17202A]">Tamper-Evident Audit Trail</h1>
            </div>
            <p className="text-xs text-[#6B7280] mt-1">
              Cryptographically chained append-only ledger tracking all authentication, OCR extraction, corrections, and CA approvals.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleVerifyChain}
              disabled={isVerifying}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1F5D8F] hover:bg-[#174A73] text-white rounded-[6px] text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
              <span>{isVerifying ? 'Verifying Chain...' : 'Verify Hash Chain'}</span>
            </button>

            <a
              href="http://localhost:8000/api/v1/reports/export/csv"
              download
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-[#D9E0E7] hover:bg-[#F8FAFC] text-[#17202A] rounded-[6px] text-xs font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-[#1F5D8F]" />
              <span>Export CSV (Formula-Safe)</span>
            </a>
          </div>
        </div>

        {/* Verification Result Banner */}
        {verifyResult && (
          <div className={`p-4 rounded-[8px] border flex items-start gap-3 transition-all ${
            verifyResult.verified 
              ? 'bg-[#E8F5EE] border-[#A8D8C1] text-[#237A57]' 
              : 'bg-[#FDECEC] border-[#E8AAAA] text-[#B33A3A]'
          }`}>
            {verifyResult.verified ? (
              <CheckCircle2 className="w-5 h-5 text-[#237A57] shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-[#B33A3A] shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-xs">
              <p className="font-bold">
                {verifyResult.verified 
                  ? `Cryptographic Chain Verified Intact (${verifyResult.total_events} sequential events verified)` 
                  : 'Tamper Alert: Cryptographic Integrity Verification Failed!'}
              </p>
              <p className="mt-0.5 font-mono text-[11px] truncate text-[#4B5563]">
                {verifyResult.latest_hash ? `Current Chain Tip Hash: ${verifyResult.latest_hash}` : verifyResult.error}
              </p>
            </div>
          </div>
        )}

        {/* Audit Events Table */}
        <div className="bg-white rounded-[8px] border border-[#D9E0E7] shadow-xs overflow-hidden">
          <div className="px-5 py-3 border-b border-[#D9E0E7] flex items-center justify-between bg-[#F8FAFC]">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#4B5563]">Immutable Event History</h2>
            <span className="text-xs text-[#6B7280] font-mono tabular-nums">{events.length} records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#D9E0E7] text-[#4B5563] font-semibold text-[11px]">
                  <th className="px-4 py-2.5">Timestamp</th>
                  <th className="px-4 py-2.5">Action</th>
                  <th className="px-4 py-2.5">Actor</th>
                  <th className="px-4 py-2.5">Target Entity</th>
                  <th className="px-4 py-2.5">Previous SHA-256</th>
                  <th className="px-4 py-2.5">Event Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D9E0E7] text-[#17202A]">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[#6B7280]">Loading audit events...</td>
                  </tr>
                ) : events.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[#6B7280]">No audit events recorded yet.</td>
                  </tr>
                ) : (
                  events.map((ev) => (
                    <tr key={ev.id} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="px-4 py-2.5 text-[#6B7280] font-mono text-[11px] whitespace-nowrap">
                        {ev.timestamp ? new Date(ev.timestamp).toLocaleString() : 'N/A'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-semibold px-2 py-0.5 rounded-[4px] text-[10.5px] bg-[#EEF2F6] text-[#17202A] border border-[#D9E0E7]">
                          {ev.action}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-medium text-[#17202A]">
                        {ev.actor_name}
                      </td>
                      <td className="px-4 py-2.5 text-[#4B5563] font-mono text-[11px]">
                        {ev.entity_type} <span className="text-[#9CA3AF]">({ev.entity_id?.slice(0, 8)}...)</span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[10.5px] text-[#6B7280]">
                        {ev.previous_event_hash ? `${ev.previous_event_hash.slice(0, 10)}...` : '0000000000...'}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[10.5px] text-[#237A57] font-semibold">
                        {ev.event_hash ? `${ev.event_hash.slice(0, 12)}...` : 'pending'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
