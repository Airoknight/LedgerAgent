'use client';

import React from 'react';
import { 
  Building2, 
  Calendar, 
  Search, 
  UploadCloud, 
  LogOut, 
  ShieldCheck, 
  Bell, 
  ChevronDown,
  UserCheck
} from 'lucide-react';

interface TopBarProps {
  currentFirmName?: string;
  currentUser?: {
    full_name?: string;
    email?: string;
    role?: string;
  } | null;
  onOpenUpload: () => void;
  onLogout: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  documentCount: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentFirmName = 'AiroKnight Studios',
  currentUser,
  onOpenUpload,
  onLogout,
  searchQuery,
  onSearchChange,
  documentCount,
}) => {
  const roleLabel = currentUser?.role === 'ca_admin' || currentUser?.role === 'CA_REVIEWER'
    ? 'Chartered Accountant'
    : currentUser?.role === 'ACCOUNTANT'
    ? 'Staff Accountant'
    : 'Auditor';

  return (
    <header className="h-14 bg-white border-b border-[#D9E0E7] flex items-center justify-between px-6 shrink-0 z-20">
      {/* Left: Organization & Period Selector Breadcrumb */}
      <div className="flex items-center gap-4 text-xs">
        {/* Client Selector */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-[6px] bg-[#F8FAFC] border border-[#D9E0E7] text-[#17202A] font-medium">
          <Building2 className="w-3.5 h-3.5 text-[#1F5D8F]" />
          <span className="font-semibold">{currentFirmName}</span>
          <span className="text-[#6B7280]">•</span>
          <span className="text-[#237A57] text-[11px] font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#237A57]"></span>
            Active
          </span>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-1.5 text-[#4B5563] text-xs">
          <Calendar className="w-3.5 h-3.5 text-[#6B7280]" />
          <span>Accounting Period:</span>
          <span className="font-semibold text-[#17202A] bg-[#F5F7FA] px-2 py-0.5 rounded-[4px] border border-[#D9E0E7]">
            September 2026 (FY 2026–27)
          </span>
        </div>
      </div>

      {/* Middle: Universal Search Bar */}
      <div className="flex-1 max-w-md mx-6">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search invoices, parties, GSTINs, references..."
            className="w-full pl-8 pr-12 py-1.5 text-xs bg-[#F8FAFC] border border-[#D9E0E7] rounded-[6px] text-[#17202A] placeholder-[#9CA3AF] focus:outline-none focus:border-[#1F5D8F] focus:bg-white transition-colors"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#9CA3AF] bg-white px-1.5 py-0.5 rounded border border-[#D9E0E7]">
            /
          </kbd>
        </div>
      </div>

      {/* Right: Quick Action & User Profile */}
      <div className="flex items-center gap-3">
        {/* Upload Action */}
        <button
          onClick={onOpenUpload}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1F5D8F] hover:bg-[#174A73] text-white rounded-[6px] text-xs font-semibold transition-colors shadow-xs"
        >
          <UploadCloud className="w-3.5 h-3.5" />
          <span>Upload Documents</span>
        </button>

        {/* User Badge */}
        <div className="flex items-center gap-2 pl-3 border-l border-[#D9E0E7]">
          <div className="w-7 h-7 rounded-full bg-[#E8F1F8] border border-[#A8C6DC] flex items-center justify-center text-[#1F5D8F] font-bold text-xs">
            {currentUser?.full_name ? currentUser.full_name.slice(0, 2).toUpperCase() : 'CH'}
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-xs font-semibold text-[#17202A] leading-tight">
              {currentUser?.full_name || 'CA Hehram'}
            </div>
            <div className="text-[11px] text-[#6B7280] leading-none mt-0.5">
              {roleLabel}
            </div>
          </div>

          {/* Sign out button */}
          <button
            onClick={onLogout}
            title="Sign out of workspace"
            className="p-1 text-[#6B7280] hover:text-[#B33A3A] hover:bg-[#FDECEC] rounded-[4px] transition-colors ml-1"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
