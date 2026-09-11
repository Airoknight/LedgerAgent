'use client';

import React, { useState } from 'react';
import { Lock, Mail, ShieldCheck, ArrowRight, AlertCircle, Building2 } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (user: any, firm: any, csrfToken: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('ca.hehram@ledgeragent.io');
  const [password, setPassword] = useState('AiroKnight2026!Secure');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('http://localhost:8000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          setErrorMsg(data.detail || 'Account temporarily locked due to too many failed attempts. Please try again later.');
        } else {
          setErrorMsg(data.detail || 'Invalid email or password. Please verify credentials.');
        }
        return;
      }

      const csrfToken = data.csrf_token || res.headers.get('X-CSRF-Token') || '';
      onLoginSuccess(data.user, data.firm, csrfToken);
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMsg('Unable to connect to LedgerAgent backend. Ensure the server is running on 127.0.0.1:8000.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-[#F5F7FA] p-4 text-[#17202A] font-sans">
      <div className="w-full max-w-md bg-white rounded-[8px] border border-[#D9E0E7] shadow-xs p-8 sm:p-10 relative">
        {/* Brand Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#D9E0E7]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[6px] bg-[#172332] flex items-center justify-center text-white font-bold text-sm">
              LA
            </div>
            <div>
              <h1 className="text-base font-bold text-[#17202A] leading-tight">LedgerAgent</h1>
              <p className="text-[11px] text-[#6B7280]">Financial Operations Platform</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#E8F5EE] border border-[#A8D8C1] rounded-[4px] text-[11px] font-semibold text-[#237A57]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#237A57]"></span>
            <span>Secure Local</span>
          </div>
        </div>

        {/* Firm / Client Context */}
        <div className="mb-6 p-3 bg-[#F8FAFC] border border-[#D9E0E7] rounded-[6px] flex items-center gap-3">
          <div className="w-8 h-8 rounded-[4px] bg-[#E8F1F8] border border-[#A8C6DC] flex items-center justify-center text-[#1F5D8F] shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="overflow-hidden">
            <span className="text-xs font-semibold text-[#17202A] block truncate">AiroKnight Studios</span>
            <span className="text-[11px] text-[#6B7280] block">Accounting Workspace • FY 2026–27</span>
          </div>
        </div>

        {/* Title */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-[#17202A]">Sign in to your account</h2>
          <p className="text-xs text-[#6B7280] mt-1">
            Enter your Chartered Accountant or staff credentials to proceed.
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-5 p-3 bg-[#FDECEC] border border-[#E8AAAA] rounded-[6px] flex items-start gap-2.5 text-xs text-[#B33A3A]">
            <AlertCircle className="w-4 h-4 text-[#B33A3A] shrink-0 mt-0.5" />
            <div className="flex-1 leading-snug">{errorMsg}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#17202A] mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ca.hehram@ledgeragent.io"
                className="w-full pl-9 pr-3 py-2 bg-white border border-[#D9E0E7] rounded-[6px] text-xs font-normal text-[#17202A] placeholder-[#9CA3AF] focus:outline-none focus:border-[#1F5D8F] transition-colors"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#17202A]">
                Password
              </label>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full pl-9 pr-3 py-2 bg-white border border-[#D9E0E7] rounded-[6px] text-xs font-normal text-[#17202A] placeholder-[#9CA3AF] focus:outline-none focus:border-[#1F5D8F] transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 px-4 bg-[#1F5D8F] hover:bg-[#174A73] disabled:opacity-50 text-white rounded-[6px] text-xs font-semibold transition-colors flex items-center justify-center gap-2 mt-2 shadow-xs"
          >
            {isLoading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Sign In to Workspace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Security Footer Notice */}
        <div className="mt-6 pt-4 border-t border-[#D9E0E7] flex items-center justify-between text-[11px] text-[#6B7280]">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#1F5D8F]" />
            <span>PBKDF2-SHA256 • Tenant Isolated</span>
          </div>
          <span className="text-[#9CA3AF]">v1.0.0</span>
        </div>
      </div>
    </div>
  );
};
