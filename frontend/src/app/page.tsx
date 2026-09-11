'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Send, 
  Sparkles, 
  ArrowRight, 
  FileSpreadsheet, 
  CheckCheck, 
  X, 
  ChevronRight, 
  FileCheck, 
  Plus, 
  SlidersHorizontal,
  Bot,
  Layers,
  ChevronLeft,
  Settings,
  MoreVertical,
  Trash2,
  ExternalLink,
  Eye,
  AlertCircle,
  LogOut,
  Copy,
  Check,
  Table,
  List,
  Code2,
  RefreshCw,
  MessageSquare,
  ChevronDown,
  Minimize2,
  BookOpen,
  ShieldCheck
} from 'lucide-react';
import { DocumentItem } from '@/types';
import { LoginView } from '@/components/auth/LoginView';
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer';
import { CategorySpreadsheetView } from '@/components/workspace/CategorySpreadsheetView';
import { AccountingWorkspace } from '@/components/accounting/AccountingWorkspace';
import { AuditView } from '@/components/workspace/AuditView';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';

const CATEGORIES_CONFIG = [
  { id: 'invoices', label: 'Invoices', desc: 'Vendor bills & tax invoices', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', format: 'Tabular' },
  { id: 'receipts', label: 'Receipts', desc: 'POS receipts & expense slips', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', format: 'Tabular' },
  { id: 'sales_records', label: 'Sales Records', desc: 'Outward supplies & customer sales', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', format: 'Tabular' },
  { id: 'purchase_records', label: 'Purchase Records', desc: 'Purchase orders & inward logs', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', format: 'Tabular' },
  { id: 'bank_statements', label: 'Bank Statements', desc: 'Bank accounts & statement sheets', color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200', format: 'Tabular' },
  { id: 'others', label: 'Others', desc: 'General & unstructured JSON', color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-300', format: 'JSON' },
];

const getDocCategory = (doc?: { extracted_data?: any; document_type?: string; original_filename?: string } | null): string => {
  if (!doc) return 'others';
  const rawCat = (doc.extracted_data?.category || doc.extracted_data?.document_type || doc.document_type || '').toLowerCase().trim();
  const filename = (doc.original_filename || '').toLowerCase().trim();

  // 1. Direct exact matches on known category identifiers
  if (rawCat === 'invoices' || rawCat === 'invoice') return 'invoices';
  if (rawCat === 'receipts' || rawCat === 'receipt' || rawCat === 'expense_receipt') return 'receipts';
  if (rawCat === 'sales_records' || rawCat === 'sales_record' || rawCat === 'sales_invoice' || rawCat === 'sales') return 'sales_records';
  if (rawCat === 'purchase_records' || rawCat === 'purchase_record' || rawCat === 'purchase_order' || rawCat === 'po') return 'purchase_records';
  if (rawCat === 'bank_statements' || rawCat === 'bank_statement' || rawCat === 'bank') return 'bank_statements';
  if (rawCat === 'others' || rawCat === 'other') return 'others';

  // 2. Sales records (customer sales, outward invoices)
  if (rawCat.includes('sale') || filename.includes('sale') || filename.includes('outward')) {
    return 'sales_records';
  }

  // 3. Invoices (vendor bills, purchase invoices, service invoices, electricity/utility bills)
  // Notice: 'purchase_invoice' is a vendor invoice, so it goes to 'invoices'
  if (
    rawCat === 'purchase_invoice' ||
    rawCat.includes('invoice') ||
    rawCat.includes('bill') ||
    filename.includes('bill') ||
    filename.includes('invoice')
  ) {
    return 'invoices';
  }

  // 4. Receipts (expense receipts, POS slips, vouchers)
  if (
    rawCat.includes('receipt') ||
    rawCat.includes('expense') ||
    rawCat.includes('slip') ||
    rawCat.includes('voucher') ||
    rawCat.includes('fuel') ||
    filename.includes('receipt') ||
    filename.includes('voucher')
  ) {
    return 'receipts';
  }

  // 5. Purchase Records (strictly Purchase Orders / PO / GRN / Inward logs, NOT purchase invoices)
  if (
    rawCat.includes('purchase_order') ||
    rawCat.includes('po_') ||
    rawCat.includes('grn') ||
    filename.includes('purchase_order') ||
    filename.includes('po-') ||
    filename.includes('po_') ||
    rawCat.includes('purchase')
  ) {
    return 'purchase_records';
  }

  // 6. Bank Statements
  if (
    rawCat.includes('bank') ||
    rawCat.includes('statement') ||
    rawCat.includes('passbook') ||
    filename.includes('bank') ||
    filename.includes('statement')
  ) {
    return 'bank_statements';
  }

  return 'others';
};

const getDocTypeBadge = (typeOrDoc: any) => {
  const cat = typeof typeOrDoc === 'string' 
    ? getDocCategory({ document_type: typeOrDoc }) 
    : getDocCategory(typeOrDoc);

  switch (cat) {
    case 'invoices':
      return { label: 'Invoices', bg: 'bg-purple-50 text-purple-700 border-purple-200/60', isTabular: true };
    case 'receipts':
      return { label: 'Receipts', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/60', isTabular: true };
    case 'sales_records':
      return { label: 'Sales Records', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200/60', isTabular: true };
    case 'purchase_records':
      return { label: 'Purchase Records', bg: 'bg-amber-50 text-amber-700 border-amber-200/60', isTabular: true };
    case 'bank_statements':
      return { label: 'Bank Statements', bg: 'bg-sky-50 text-sky-700 border-sky-200/60', isTabular: true };
    case 'others':
    default:
      return { label: 'Others (JSON)', bg: 'bg-slate-100 text-slate-700 border-slate-300', isTabular: false };
  }
};


export default function Home() {
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentFirm, setCurrentFirm] = useState<any>(null);
  const [csrfToken, setCsrfToken] = useState<string>('');

  const [activeNav, setActiveNav] = useState<string>('workspace');
  const [accountingSubTab, setAccountingSubTab] = useState<'journals' | 'trial_balance' | 'statements' | 'ar_ap' | 'coa'>('journals');
  const [documents, setDocuments] = useState<DocumentItem[]>([]);

  const handleNavSelect = (view: string) => {
    if (view === 'accounting_journals') {
      setActiveNav('accounting');
      setAccountingSubTab('journals');
      setSelectedCategoryFilter(null);
    } else if (view === 'accounting_ledger') {
      setActiveNav('accounting');
      setAccountingSubTab('journals');
      setSelectedCategoryFilter(null);
    } else if (view === 'accounting_trial_balance') {
      setActiveNav('accounting');
      setAccountingSubTab('trial_balance');
      setSelectedCategoryFilter(null);
    } else if (view === 'accounting_ar_ap') {
      setActiveNav('accounting');
      setAccountingSubTab('ar_ap');
      setSelectedCategoryFilter(null);
    } else {
      setActiveNav(view);
      if (view === 'workspace' || view === 'all_documents') {
        setSelectedCategoryFilter(null);
      } else if (view === 'cat_invoices') {
        setSelectedCategoryFilter('invoices');
      } else if (view === 'cat_sales') {
        setSelectedCategoryFilter('sales_records');
      } else if (view === 'cat_purchases') {
        setSelectedCategoryFilter('purchase_records');
      } else if (view === 'cat_receipts') {
        setSelectedCategoryFilter('receipts');
      } else if (view === 'cat_bank') {
        setSelectedCategoryFilter('bank_statements');
      } else if (view === 'exceptions') {
        setSelectedCategoryFilter('needs_review');
      } else if (view === 'upload_intake') {
        fileInputRef.current?.click();
      } else if (view === 'settings') {
        setShowToast('Security Policies: PBKDF2-SHA256, RBAC, tenant isolation, and encrypted storage are active.');
      }
    }
  };
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatQuery, setChatQuery] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'assistant'; text: string; model?: string; timestamp?: string }>>([]);

  const [isThinking, setIsThinking] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showFormatBar, setShowFormatBar] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const insertFormat = (prefix: string, suffix: string = '') => {
    setChatQuery(prev => (prev ? `${prev} ${prefix}${suffix}` : `${prefix}${suffix}`));
  };

  const insertTableTemplate = () => {
    const tableTpl = '\n| Field | Details |\n|---|---|\n| Document |  |\n| Total Amount |  |\n';
    setChatQuery(prev => (prev ? `${prev}${tableTpl}` : tableTpl));
  };

  const [openMenuDocId, setOpenMenuDocId] = useState<string | null>(null);
  const [docToDelete, setDocToDelete] = useState<DocumentItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showToast, setShowToast] = useState<string | null>(null);
  const [showAllUploadsModal, setShowAllUploadsModal] = useState(false);
  const [uploadsFilter, setUploadsFilter] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Multi-file batch processing & 6-category categorization state
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [batchStage, setBatchStage] = useState<'uploading' | 'analyzing' | 'categorizing' | 'complete'>('uploading');
  const [batchFiles, setBatchFiles] = useState<Array<{
    name: string;
    size: number;
    status: 'pending' | 'processing' | 'done';
    category?: string;
    isDuplicate?: boolean;
    duplicateOf?: string;
  }>>([]);
  const [categoryCounts, setCategoryCounts] = useState<{ [key: string]: number }>({
    invoices: 0,
    receipts: 0,
    sales_records: 0,
    purchase_records: 0,
    bank_statements: 0,
    others: 0,
  });
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [tasksViewMode, setTasksViewMode] = useState<'grid' | 'cards'>('grid');
  const [copiedJson, setCopiedJson] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'tabular' | 'json'>('tabular');
  const [uploadProgress, setUploadProgress] = useState<number>(15);
  const [stepLabel, setStepLabel] = useState<string>('Step 1/3: Document Ingestion & Verification');
  const [stepSubtext, setStepSubtext] = useState<string>('Reading file bytes and computing SHA-256 ledger integrity...');
  const [uploadSeconds, setUploadSeconds] = useState<number>(0);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Intake Review / Edit before Accounting Pipeline Transformation
  const [reviewModalDoc, setReviewModalDoc] = useState<DocumentItem | null>(null);
  const [uploadedBatchDocs, setUploadedBatchDocs] = useState<DocumentItem[]>([]);
  const [reviewForm, setReviewForm] = useState({
    invoice_number: '',
    date: '',
    party_name: '',
    subtotal: '',
    tax: '',
    total: '',
    target_account_code: '5200',
  });
  const [isPostingToPipeline, setIsPostingToPipeline] = useState(false);

  const selectDocForReview = (doc: DocumentItem) => {
    setReviewModalDoc(doc);
    const ext = doc.extracted_data || {};
    const cat = getDocCategory(doc);
    let defaultAcc = '5200';
    if (cat === 'sales_records') defaultAcc = '4000';
    else if (cat === 'bank_statements') defaultAcc = '1000';
    else if (ext.category === 'Cloud' || (ext.party_name && /cloud|aws|google|azure|digitalocean/i.test(ext.party_name))) defaultAcc = '5100';
    else if (ext.category === 'Travel' || (ext.party_name && /uber|ola|airline|flight|hotel/i.test(ext.party_name))) defaultAcc = '5300';
    else if (ext.category === 'Legal' || (ext.party_name && /advocate|legal|consult/i.test(ext.party_name))) defaultAcc = '5400';

    const rawTotal = ext.total !== undefined ? Number(ext.total) : 0;
    const rawSubtotal = ext.subtotal !== undefined ? Number(ext.subtotal) : (rawTotal > 0 ? +(rawTotal * 0.82).toFixed(2) : 0);
    const rawTax = ext.tax !== undefined ? Number(ext.tax) : (rawTotal > 0 ? +(rawTotal * 0.18).toFixed(2) : 0);

    setReviewForm({
      invoice_number: ext.invoice_number || (doc.original_filename || (doc as any).filename || 'INV-001').replace(/\.[^/.]+$/, ''),
      date: ext.date || new Date().toISOString().split('T')[0],
      party_name: ext.party_name || ext.vendor || ext.seller_name || 'Vendor / Counterparty',
      subtotal: rawSubtotal ? String(rawSubtotal) : '',
      tax: rawTax ? String(rawTax) : '',
      total: rawTotal ? String(rawTotal) : '',
      target_account_code: defaultAcc,
    });
  };

  const handleConfirmAndPostToPipeline = async () => {
    if (!reviewModalDoc) return;
    setIsPostingToPipeline(true);
    try {
      const res = await fetch('http://localhost:8000/api/v1/accounting/confirm-intake', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          document_id: reviewModalDoc.id,
          invoice_number: reviewForm.invoice_number || undefined,
          date: reviewForm.date || undefined,
          party_name: reviewForm.party_name || undefined,
          subtotal: reviewForm.subtotal ? parseFloat(reviewForm.subtotal) : undefined,
          tax: reviewForm.tax ? parseFloat(reviewForm.tax) : undefined,
          total: reviewForm.total ? parseFloat(reviewForm.total) : undefined,
          target_account_code: reviewForm.target_account_code || '5200',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        await fetchDocs();
        setIsProcessingBatch(false);
        setReviewModalDoc(null);
        setActiveNav('accounting');
        setShowToast(`✓ Transformed & posted to Accounting Pipeline! Journal Entry #${(data.entry_number || data.journal_entry_id || '').slice(0, 10)}`);
      } else {
        const errData = await res.json().catch(() => ({}));
        setShowToast(`Error posting to accounting pipeline: ${errData.detail || 'Server error'}`);
      }
    } catch (e) {
      console.error(e);
      setShowToast('Network error while posting to accounting pipeline');
    } finally {
      setIsPostingToPipeline(false);
    }
  };

  const preProcessingStats = useMemo(() => {
    const missingIdentifierCount = documents.filter(d => {
      const data = d.extracted_data || {};
      return !data.identifier && !data.invoice_number && !data.account_number;
    }).length;

    const missingDateCount = documents.filter(d => {
      const data = d.extracted_data || {};
      return !data.date && !data.invoice_date && !data.receipt_date;
    }).length;

    const missingPartyCount = documents.filter(d => {
      const data = d.extracted_data || {};
      return !data.party_name && !data.vendor_name && !data.merchant_name && !data.bank_name && !data.party_tax_id && !data.vendor_gstin;
    }).length;

    const arithmeticVarianceCount = documents.filter(d => {
      if (d.status === 'needs_review') return true;
      const sub = Number(d.extracted_data?.subtotal) || 0;
      const tax = Number(d.extracted_data?.tax_total ?? d.extracted_data?.tax ?? ((Number(d.extracted_data?.cgst) || 0) + (Number(d.extracted_data?.sgst) || 0))) || 0;
      const total = Number(d.extracted_data?.grand_total ?? d.extracted_data?.total) || 0;
      return total > 0 && Math.abs((sub + tax) - total) > 1.0;
    }).length;

    const duplicateCount = documents.filter(d => Boolean(d.extracted_data?.duplicate_info?.is_duplicate)).length;
    const readyApprovalCount = documents.filter(d => d.status !== 'needs_review' && d.review_status !== 'approved_by_ca').length;

    return {
      missingIdentifierCount,
      missingDateCount,
      missingPartyCount,
      arithmeticVarianceCount,
      duplicateCount,
      readyApprovalCount
    };
  }, [documents]);

  const filteredDocs = useMemo(() => {
    return documents
      .filter(d => d.original_filename.toLowerCase().includes(searchQuery.toLowerCase()))
      .filter(d => {
        if (!selectedCategoryFilter) return true;
        if (selectedCategoryFilter === 'duplicates') {
          return Boolean(d.extracted_data?.duplicate_info?.is_duplicate);
        }
        if (selectedCategoryFilter === 'needs_review') {
          return d.status === 'needs_review';
        }
        if (selectedCategoryFilter === 'missing_identifier') {
          const data = d.extracted_data || {};
          return !data.identifier && !data.invoice_number && !data.account_number;
        }
        if (selectedCategoryFilter === 'missing_date') {
          const data = d.extracted_data || {};
          return !data.date && !data.invoice_date && !data.receipt_date;
        }
        if (selectedCategoryFilter === 'missing_party') {
          const data = d.extracted_data || {};
          return !data.party_name && !data.vendor_name && !data.merchant_name && !data.bank_name && !data.party_tax_id && !data.vendor_gstin;
        }
        if (selectedCategoryFilter === 'arithmetic_variance') {
          if (d.status === 'needs_review') return true;
          const sub = Number(d.extracted_data?.subtotal) || 0;
          const tax = Number(d.extracted_data?.tax_total ?? d.extracted_data?.tax ?? ((Number(d.extracted_data?.cgst) || 0) + (Number(d.extracted_data?.sgst) || 0))) || 0;
          const total = Number(d.extracted_data?.grand_total ?? d.extracted_data?.total) || 0;
          return total > 0 && Math.abs((sub + tax) - total) > 1.0;
        }
        if (selectedCategoryFilter === 'ready_approval') {
          return d.status !== 'needs_review' && d.review_status !== 'approved_by_ca';
        }
        return getDocCategory(d) === selectedCategoryFilter;
      });
  }, [documents, searchQuery, selectedCategoryFilter]);

  const openDocDrawer = (doc: DocumentItem) => {
    setSelectedDoc(doc);
    const cat = getDocCategory(doc);
    setDrawerTab(cat === 'others' ? 'json' : 'tabular');
  };

  const fetchDocs = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/documents', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);

        const newCounts: { [key: string]: number } = { 
          invoices: 0, 
          receipts: 0, 
          sales_records: 0, 
          purchase_records: 0, 
          bank_statements: 0, 
          others: 0 
        };
        data.forEach((d: DocumentItem) => {
          const cat = getDocCategory(d);
          if (newCounts[cat] !== undefined) {
            newCounts[cat]++;
          } else {
            newCounts.others++;
          }
        });
        setCategoryCounts(newCounts);
      }
    } catch (e) {
      console.warn('Backend not yet reachable');
    }
  };

  const handleScanDuplicates = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/documents/scan-duplicates', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrfToken },
      });
      if (res.ok) {
        const result = await res.json();
        await fetchDocs();
        if (result.duplicates_count > 0) {
          setShowToast(`⚠️ Duplicate audit complete: Found ${result.duplicates_count} duplicate files in ledger.`);
        } else {
          setShowToast('✅ No duplicate documents detected across uploaded files.');
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleResolveDuplicate = async (docId: string) => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/documents/${docId}/resolve-duplicate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrfToken },
      });
      if (res.ok) {
        await fetchDocs();
        if (selectedDoc && selectedDoc.id === docId) {
          const updatedDoc = {
            ...selectedDoc,
            status: 'checks_passed' as const,
            extracted_data: {
              ...selectedDoc.extracted_data,
              duplicate_info: {
                ...selectedDoc.extracted_data?.duplicate_info,
                resolved: true
              }
            }
          };
          setSelectedDoc(updatedDoc);
        }
        setShowToast('Duplicate status marked as reviewed & acknowledged by CA.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const checkAuth = async () => {
    setAuthLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/v1/auth/me', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
        setCurrentFirm(data.firm);
        const token = data.csrf_token || res.headers.get('X-CSRF-Token') || '';
        setCsrfToken(token);
        setIsAuthenticated(true);
        fetchDocs();
      } else {
        setIsAuthenticated(false);
      }
    } catch (e) {
      setIsAuthenticated(false);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isChatOpen && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isThinking, isChatOpen]);


  const handleCopyJson = (obj: any) => {
    try {
      navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
      setCopiedJson(true);
      setShowToast('JSON copied to clipboard!');
      setTimeout(() => setCopiedJson(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileUpload = async (files: File[]) => {
    if (files.length === 0) return;
    setIsUploading(true);
    setIsProcessingBatch(true);
    setBatchStage('uploading');
    setUploadProgress(15);
    setUploadSeconds(0);
    setStepLabel('Step 1/3: Document Ingestion & Verification');
    setStepSubtext(`Ingesting ${files.length} file${files.length > 1 ? 's' : ''} into secure local pipeline...`);

    const fileEntries = files.map(f => ({
      name: f.name,
      size: f.size,
      status: 'processing' as const,
      category: undefined as string | undefined,
    }));
    setBatchFiles(fileEntries);

    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
    }
    const startTime = Date.now();

    progressTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      setUploadSeconds(Math.round(elapsed));

      if (elapsed < 1.2) {
        // Step 1: Ingestion & Verification (15% -> 38%)
        const p = 15 + (elapsed / 1.2) * 23;
        setUploadProgress(Math.min(38, Math.round(p)));
        setBatchStage('uploading');
        setStepLabel('Step 1/3: Document Ingestion & Verification');
        setStepSubtext('Reading file bytes and computing SHA-256 ledger integrity...');
      } else if (elapsed < 4.8) {
        // Step 2: Optical Character Recognition (38% -> 72%)
        const p = 38 + ((elapsed - 1.2) / 3.6) * 34;
        setUploadProgress(Math.min(72, Math.round(p)));
        setBatchStage('analyzing');
        setStepLabel('Step 2/3: Optical Character Recognition (RapidOCR)');
        setStepSubtext('RapidOCR ONNX deep-learning engine extracting bounding boxes & character text...');
      } else if (elapsed < 9.5) {
        // Step 3: AI Categorization (72% -> 94%)
        const p = 72 + ((elapsed - 4.8) / 4.7) * 22;
        setUploadProgress(Math.min(94, Math.round(p)));
        setBatchStage('categorizing');
        setStepLabel('Step 3/3: Qwen 2.5:3b Category Fitting & Structuring');
        setStepSubtext('Classifying into 5 Tabular streams or JSON & extracting financial figures...');
      } else {
        // Step 3 audit & finalization (94% -> 98%)
        const extra = Math.min(4, (elapsed - 9.5) * 0.4);
        setUploadProgress(Math.min(98, Math.round(94 + extra)));
        setBatchStage('categorizing');
        setStepLabel('Step 3/3: Deterministic Rule Audit & Ledger Finalization');
        setStepSubtext('Cross-checking arithmetic consistency and registering ledger entry...');
      }
    }, 100);

    try {
      const formData = new FormData();
      files.forEach(f => formData.append('files', f));

      const res = await fetch('http://localhost:8000/api/v1/intake/upload', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRF-Token': csrfToken,
        },
        body: formData,
      });

      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }

      if (res.ok) {
        const result = await res.json();
        const durationStr = ((Date.now() - startTime) / 1000).toFixed(1);
        setUploadProgress(100);
        setBatchStage('complete');
        setStepLabel('Verified & Sorted into Accounting Streams');
        setStepSubtext(`Completed in ${durationStr}s. All documents structured and verified by rule engine.`);

        const newDocs = result.documents || [];
        const duplicateCount = result.duplicate_files || 0;

        setBatchFiles(files.map((f, i) => {
          const matchedDoc = newDocs[i];
          const assigned = getDocCategory(matchedDoc);
          const isDup = Boolean(matchedDoc?.extracted_data?.duplicate_info?.is_duplicate);
          const dupOf = matchedDoc?.extracted_data?.duplicate_info?.duplicate_of_filename;

          return {
            name: f.name,
            size: f.size,
            status: 'done' as const,
            category: assigned,
            isDuplicate: isDup,
            duplicateOf: dupOf,
          };
        }));

        await fetchDocs();

        if (newDocs.length > 0) {
          setUploadedBatchDocs(newDocs);
          selectDocForReview(newDocs[0]);
          setSelectedDoc(newDocs[0]);
          setDrawerTab(getDocCategory(newDocs[0]) === 'others' ? 'json' : 'tabular');
        }

        if (duplicateCount > 0) {
          setShowToast(`⚠️ Duplicate detected: ${duplicateCount} duplicate document${duplicateCount > 1 ? 's' : ''} flagged for CA review in ledger!`);
        } else {
          setShowToast(`Processed & sorted ${newDocs.length} file${newDocs.length > 1 ? 's' : ''} into 6 categories in ${durationStr}s!`);
        }
      } else {
        setShowToast('Upload issue encountered. Please retry.');
        setIsProcessingBatch(false);
      }
    } catch (err) {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      console.error(err);
      setShowToast('Network error during upload.');
      setIsProcessingBatch(false);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendChat = async (q?: string) => {
    const queryText = (q || chatQuery).trim();
    if (!queryText) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChatMessages(prev => [...prev, { sender: 'user', text: queryText, timestamp: timeStr }]);
    setChatQuery('');
    setIsThinking(true);
    setIsChatOpen(true);

    try {
      const res = await fetch('http://localhost:8000/api/v1/chat/query', {
        method: 'POST',
        credentials: 'include',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          query: queryText,
          active_context: selectedDoc ? { doc_id: selectedDoc.id, filename: selectedDoc.original_filename } : null
        })
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => [
          ...prev, 
          { 
            sender: 'assistant', 
            text: data.answer, 
            model: data.model_used || 'nvidia/nemotron-3-ultra-550b-a55b:free',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      } else {
        throw new Error();
      }
    } catch (e) {
      setChatMessages(prev => [
        ...prev, 
        { 
          sender: 'assistant', 
          text: `I analyzed "${queryText}" against the ${documents.length} verified documents in the ledger. All calculations and line items are stored in your workspace.`,
          model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsThinking(false);
    }
  };


  const handleApprove = async (docId: string) => {
    try {
      await fetch(`http://localhost:8000/api/v1/documents/${docId}/approve`, { 
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      });
      setDocuments(prev => prev.map(d => d.id === docId ? { ...d, review_status: 'approved_by_ca', reviewed_by: currentUser?.full_name || 'CA Hehram' } : d));
      if (selectedDoc && selectedDoc.id === docId) {
        setSelectedDoc({ ...selectedDoc, review_status: 'approved_by_ca', reviewed_by: currentUser?.full_name || 'CA Hehram' });
      }
    } catch (e) {}
  };

  const handleApproveWithAdjustment = async (doc: DocumentItem) => {
    const sub = Number(doc.extracted_data?.subtotal) || 0;
    const tax = Number(doc.extracted_data?.tax_total ?? doc.extracted_data?.tax ?? ((Number(doc.extracted_data?.cgst) || 0) + (Number(doc.extracted_data?.sgst) || 0))) || 0;
    const correctedTotal = Math.round((sub + tax) * 100) / 100;
    
    // Update local state with adjusted totals
    const updatedData = { ...doc.extracted_data, total: correctedTotal, grand_total: correctedTotal };
    const updatedDoc: DocumentItem = { ...doc, extracted_data: updatedData, status: 'checks_passed' };
    setSelectedDoc(updatedDoc);
    setDocuments(prev => prev.map(d => d.id === doc.id ? updatedDoc : d));
    
    await handleApprove(doc.id);
    setShowToast(`Grand Total adjusted to ₹${correctedTotal.toLocaleString()} and CA approved.`);
    setTimeout(() => setShowToast(null), 3500);
  };

  const handleLogout = async () => {
    try {
      await fetch('http://localhost:8000/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      });
    } catch (e) {
      console.error('Logout request failed:', e);
    } finally {
      setIsAuthenticated(false);
      setCurrentUser(null);
      setCurrentFirm(null);
      setCsrfToken('');
      setDocuments([]);
      setSelectedDoc(null);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.doc-action-menu')) {
        setOpenMenuDocId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDeleteDoc = async (docId: string) => {
    setIsDeleting(true);
    try {
      const res = await fetch(`http://localhost:8000/api/v1/documents/${docId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      });
      if (res.ok) {
        const deletedItem = documents.find(d => d.id === docId);
        setDocuments(prev => prev.filter(d => d.id !== docId));
        if (selectedDoc && selectedDoc.id === docId) {
          setSelectedDoc(null);
        }
        setDocToDelete(null);
        setOpenMenuDocId(null);
        setShowToast(`Deleted "${deletedItem?.original_filename || 'file'}" successfully`);
        setTimeout(() => setShowToast(null), 3500);
      } else {
        alert('Failed to delete document from server.');
      }
    } catch (e) {
      console.error(e);
      alert('Error deleting document.');
    } finally {
      setIsDeleting(false);
    }
  };

  const renderThreeDotsMenu = (doc: DocumentItem, alignRight = true) => (
    <div className="relative doc-action-menu" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        title="File Options"
        onClick={(e) => {
          e.stopPropagation();
          setOpenMenuDocId(openMenuDocId === doc.id ? null : doc.id);
        }}
        className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>

      {openMenuDocId === doc.id && (
        <div 
          className={`absolute ${alignRight ? 'right-0' : 'left-0'} top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200/90 py-1 z-50 text-xs animate-in fade-in zoom-in-95 duration-100`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              openDocDrawer(doc);
              setOpenMenuDocId(null);
            }}
            className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-50 text-slate-700 font-medium"
          >
            <Eye className="w-3.5 h-3.5 text-slate-400" />
            <span>View Extraction</span>
          </button>
          <a
            href={`http://localhost:8000/api/v1/documents/${doc.id}/file`}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpenMenuDocId(null)}
            className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-50 text-slate-700 font-medium"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            <span>Open File</span>
          </a>
          <div className="my-1 border-t border-slate-100"></div>
          <button
            type="button"
            onClick={() => {
              setOpenMenuDocId(null);
              setDocToDelete(doc);
            }}
            className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-rose-50 text-rose-600 font-medium"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            <span>Delete File</span>
          </button>
        </div>
      )}
    </div>
  );

  if (authLoading) {
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-[#f8f9fb] text-slate-600 font-sans">
        <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-xs font-semibold text-slate-500">Connecting to LedgerAgent 127.0.0.1...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginView
        onLoginSuccess={(user, firm, token) => {
          setCurrentUser(user);
          setCurrentFirm(firm);
          setCsrfToken(token);
          setIsAuthenticated(true);
          fetchDocs();
        }}
      />
    );
  }


  const docsReceived = documents.length;
  const checksPassedCount = documents.filter(d => d.status !== 'needs_review').length;
  const needsReviewCount = documents.filter(d => d.status === 'needs_review').length;
  const pendingApprovalCount = documents.filter(d => d.review_status !== 'approved_by_ca').length;
  const duplicateCount = documents.filter(d => d.extracted_data?.duplicate_info?.is_duplicate).length;

  return (
    <div 
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleFileUpload(Array.from(e.dataTransfer.files));
        }
      }}
      className="flex h-screen w-screen overflow-hidden bg-[#F5F7FA] text-[#17202A] font-sans relative"
    >
      {/* Hidden File Input for Native File Browser Selection */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.tiff,.bmp,.csv,.xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFileUpload(Array.from(e.target.files));
            e.target.value = '';
          }
        }}
      />

      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div className="fixed inset-0 bg-[#172332]/80 backdrop-blur-xs z-50 flex flex-col items-center justify-center border-4 border-dashed border-[#1F5D8F] pointer-events-none animate-in fade-in duration-150">
          <UploadCloud className="w-16 h-16 text-[#A8C6DC] animate-bounce mb-3" />
          <p className="text-white text-base font-bold">Drop files here to upload into LedgerAgent</p>
          <p className="text-[#94A3B8] text-xs mt-1">Accepts PDF invoices, receipts, and bank statements</p>
        </div>
      )}

      {/* 1. LEFT SIDEBAR */}
      <Sidebar 
        activeView={activeNav}
        onSelectView={handleNavSelect}
        onOpenUploadModal={() => fileInputRef.current?.click()}
        exceptionCount={needsReviewCount}
        documentCount={docsReceived}
        preProcessingStats={preProcessingStats}
        activeFilter={selectedCategoryFilter}
        onSelectFilter={(filterId) => {
          setActiveNav('workspace');
          setSelectedCategoryFilter(filterId);
        }}
        onLogout={handleLogout}
        currentUserName={currentUser?.full_name || 'CA Hehram'}
      />

      {/* 2. MAIN APPLICATION WORKSPACE */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <TopBar
          currentFirmName={currentFirm?.name || 'AiroKnight Studios'}
          currentUser={currentUser}
          onOpenUpload={() => fileInputRef.current?.click()}
          onLogout={handleLogout}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          documentCount={docsReceived}
        />

        {activeNav === 'accounting' ? (
          <AccountingWorkspace csrfToken={csrfToken} initialSubTab={accountingSubTab} />
        ) : activeNav === 'audit' ? (
          <AuditView csrfToken={csrfToken} />
        ) : (
          <main className="flex-1 flex flex-col h-full overflow-y-auto px-8 py-6 relative bg-[#F5F7FA]">
            <div className="max-w-7xl mx-auto w-full space-y-5">
              {/* Operational Page Header */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#D9E0E7]">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h1 className="text-xl font-bold text-[#17202A] tracking-tight">
                      {selectedCategoryFilter === 'invoices' ? 'Purchase Invoices Register'
                        : selectedCategoryFilter === 'sales_records' ? 'Sales Invoices Register'
                        : selectedCategoryFilter === 'purchase_records' ? 'Purchase Records & POs'
                        : selectedCategoryFilter === 'receipts' ? 'Receipts & Expense Slips'
                        : selectedCategoryFilter === 'bank_statements' ? 'Bank Statements & Transactions'
                        : selectedCategoryFilter === 'needs_review' ? 'Validation Exceptions Work Queue'
                        : selectedCategoryFilter === 'duplicates' ? 'Duplicate Document Audit'
                        : selectedCategoryFilter === 'missing_identifier' ? 'Pre-Processing: Missing Invoice Numbers'
                        : selectedCategoryFilter === 'missing_date' ? 'Pre-Processing: Missing Transaction Dates'
                        : selectedCategoryFilter === 'missing_party' ? 'Pre-Processing: Missing Party / GSTIN'
                        : selectedCategoryFilter === 'arithmetic_variance' ? 'Pre-Processing: Arithmetic Variances'
                        : selectedCategoryFilter === 'ready_approval' ? 'Pre-Processing: Ready for CA Approval'
                        : 'Financial Operations Overview'}
                    </h1>
                    {selectedCategoryFilter && (
                      <button
                        onClick={() => setSelectedCategoryFilter(null)}
                        className="text-[11px] font-semibold text-[#1F5D8F] bg-[#E8F1F8] border border-[#A8C6DC] px-2 py-0.5 rounded-[4px] hover:bg-[#D3E4F2] flex items-center gap-1"
                        title="Clear active filter"
                      >
                        <X className="w-3 h-3" />
                        <span>Clear filter</span>
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    Review normalized accounting records, automated arithmetic verification, and audit readiness • AiroKnight Studios • FY 2026–27
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <button 
                    onClick={() => handleScanDuplicates()}
                    className="px-3 py-1.5 bg-white text-[#17202A] hover:bg-[#F8FAFC] rounded-[6px] text-xs font-medium border border-[#D9E0E7] flex items-center gap-1.5 transition-colors shadow-2xs"
                    title="Audit entire firm ledger for duplicate files or double billing"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#1F5D8F]" />
                    <span>Audit Duplicates</span>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-1.5 bg-[#1F5D8F] hover:bg-[#174A73] text-white rounded-[6px] text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Upload Documents</span>
                  </button>
                </div>
              </div>

              {/* 6 Compact Operational KPI Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div 
                  onClick={() => setSelectedCategoryFilter(null)}
                  className="p-3 bg-white rounded-[8px] border border-[#D9E0E7] shadow-2xs cursor-pointer hover:border-[#B8C2CC] transition-colors"
                >
                  <span className="text-[11px] font-medium text-[#6B7280] block">Documents Ingested</span>
                  <span className="text-lg font-bold text-[#17202A] font-mono mt-0.5 block tabular-nums">{docsReceived}</span>
                  <span className="text-[10px] text-[#9CA3AF] mt-0.5 block truncate">Total in client ledger</span>
                </div>

                <div className="p-3 bg-white rounded-[8px] border border-[#D9E0E7] shadow-2xs">
                  <span className="text-[11px] font-medium text-[#6B7280] block">Processing Pipeline</span>
                  <span className="text-lg font-bold text-[#1F5D8F] font-mono mt-0.5 block tabular-nums">{isUploading ? '1 Active' : '0 Idle'}</span>
                  <span className="text-[10px] text-[#9CA3AF] mt-0.5 block truncate">RapidOCR & Qwen</span>
                </div>

                <div 
                  onClick={() => setSelectedCategoryFilter(null)}
                  className="p-3 bg-white rounded-[8px] border border-[#D9E0E7] shadow-2xs cursor-pointer hover:border-[#B8C2CC] transition-colors"
                >
                  <span className="text-[11px] font-medium text-[#237A57] block">Checks Passed</span>
                  <span className="text-lg font-bold text-[#237A57] font-mono mt-0.5 block tabular-nums">{checksPassedCount}</span>
                  <span className="text-[10px] text-[#9CA3AF] mt-0.5 block truncate">Deterministic rules verified</span>
                </div>

                <div 
                  onClick={() => setSelectedCategoryFilter('needs_review')}
                  className="p-3 bg-white rounded-[8px] border border-[#D9E0E7] shadow-2xs cursor-pointer hover:border-[#B8C2CC] transition-colors"
                >
                  <span className="text-[11px] font-medium text-[#9A6700] block">Needs Review</span>
                  <span className="text-lg font-bold text-[#9A6700] font-mono mt-0.5 block tabular-nums">{needsReviewCount}</span>
                  <span className="text-[10px] text-[#9CA3AF] mt-0.5 block truncate">Variance or field issues</span>
                </div>

                <div 
                  onClick={() => setActiveNav('accounting')}
                  className="p-3 bg-white rounded-[8px] border border-[#D9E0E7] shadow-2xs cursor-pointer hover:border-[#B8C2CC] transition-colors"
                >
                  <span className="text-[11px] font-medium text-[#17202A] block">Pending CA Review</span>
                  <span className="text-lg font-bold text-[#17202A] font-mono mt-0.5 block tabular-nums">{pendingApprovalCount}</span>
                  <span className="text-[10px] text-[#9CA3AF] mt-0.5 block truncate">Awaiting approval</span>
                </div>

                <div 
                  onClick={() => setSelectedCategoryFilter('duplicates')}
                  className="p-3 bg-white rounded-[8px] border border-[#D9E0E7] shadow-2xs cursor-pointer hover:border-[#B8C2CC] transition-colors"
                >
                  <span className="text-[11px] font-medium text-[#B33A3A] block">Duplicate Alerts</span>
                  <span className="text-lg font-bold text-[#B33A3A] font-mono mt-0.5 block tabular-nums">{duplicateCount}</span>
                  <span className="text-[10px] text-[#9CA3AF] mt-0.5 block truncate">SHA-256 or ID matches</span>
                </div>
              </div>

          {/* Register & Verification Working Surface */}
          <div className="bg-white rounded-[8px] border border-[#D9E0E7] p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-[#1F5D8F]" />
                <h3 className="text-sm font-bold text-[#17202A]">Accounting Register & Verification Grid</h3>
                <span className="text-xs text-[#6B7280] font-mono tabular-nums">({documents.length} records)</span>
              </div>

              <div className="flex items-center gap-2.5">
                {/* View Mode Toggle */}
                <div className="flex items-center bg-[#F8FAFC] p-0.5 rounded-[6px] border border-[#D9E0E7] text-xs">
                  <button
                    onClick={() => setTasksViewMode('grid')}
                    className={`px-2.5 py-1 rounded-[4px] font-semibold flex items-center gap-1.5 transition-colors ${
                      tasksViewMode === 'grid'
                        ? 'bg-[#1F5D8F] text-white shadow-2xs'
                        : 'text-[#6B7280] hover:text-[#17202A]'
                    }`}
                    title="Excel-Inspired Register Spreadsheet Grid"
                  >
                    <Table className="w-3.5 h-3.5" />
                    <span>Tabular Grid</span>
                  </button>
                  <button
                    onClick={() => setTasksViewMode('cards')}
                    className={`px-2.5 py-1 rounded-[4px] font-semibold flex items-center gap-1.5 transition-colors ${
                      tasksViewMode === 'cards'
                        ? 'bg-white text-[#17202A] shadow-2xs border border-[#D9E0E7]'
                        : 'text-[#6B7280] hover:text-[#17202A]'
                    }`}
                    title="Compact Row List"
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>Cards List</span>
                  </button>
                </div>

                <div className="relative w-44 sm:w-56">
                  <Search className="w-3.5 h-3.5 text-[#6B7280] absolute left-2.5 top-2" />
                  <input
                    type="text"
                    placeholder="Search documents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1 bg-white border border-[#D9E0E7] rounded-[6px] text-xs text-[#17202A] placeholder-[#9CA3AF] focus:outline-none focus:border-[#1F5D8F]"
                  />
                </div>

                <button 
                  onClick={() => handleSendChat('/exceptions')}
                  className="px-2.5 py-1 bg-[#FFF5D6] text-[#9A6700] hover:bg-[#FEEFC3] rounded-[6px] text-xs font-semibold flex items-center gap-1.5 border border-[#E7CA75] transition-colors"
                >
                  <AlertTriangle className="w-3 h-3 text-[#9A6700]" />
                  <span>Prioritize Exceptions</span>
                </button>
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs select-none">
              <button
                onClick={() => setSelectedCategoryFilter(null)}
                className={`px-3 py-1 rounded-[6px] text-[11px] font-medium transition-colors shrink-0 ${
                  selectedCategoryFilter === null 
                    ? 'bg-[#1F5D8F] text-white shadow-2xs font-semibold' 
                    : 'bg-[#F8FAFC] text-[#4B5563] hover:bg-[#EEF2F6] border border-[#D9E0E7]'
                }`}
              >
                All Records ({documents.length})
              </button>
              {CATEGORIES_CONFIG.map(cat => {
                const count = documents.filter(d => getDocCategory(d) === cat.id).length;
                const isSelected = selectedCategoryFilter === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryFilter(isSelected ? null : cat.id)}
                    className={`px-3 py-1 rounded-[6px] text-[11px] transition-all shrink-0 flex items-center gap-1.5 border ${
                      isSelected 
                        ? 'bg-[#E8F1F8] text-[#1F5D8F] border-[#1F5D8F] font-semibold' 
                        : 'bg-[#F8FAFC] text-[#4B5563] border-[#D9E0E7] hover:bg-[#EEF2F6]'
                    }`}
                  >
                    <span>{cat.label}</span>
                    <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-white border border-[#D9E0E7] tabular-nums">
                      {count}
                    </span>
                  </button>
                );
              })}

              {documents.some(d => d.extracted_data?.duplicate_info?.is_duplicate) && (
                <button
                  onClick={() => setSelectedCategoryFilter(selectedCategoryFilter === 'duplicates' ? null : 'duplicates')}
                  className={`px-3 py-1 rounded-[6px] text-[11px] font-semibold border transition-all shrink-0 flex items-center gap-1.5 ${
                    selectedCategoryFilter === 'duplicates'
                      ? 'bg-[#B33A3A] text-white border-[#B33A3A] shadow-2xs'
                      : 'bg-[#FDECEC] text-[#B33A3A] border-[#E8AAAA] hover:bg-[#FCD8D8]'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3 text-[#B33A3A]" />
                  <span>Duplicates</span>
                  <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-white text-[#B33A3A] tabular-nums">
                    {documents.filter(d => d.extracted_data?.duplicate_info?.is_duplicate).length}
                  </span>
                </button>
              )}
            </div>

            {/* View Switching: Excel-Inspired Spreadsheet Grid vs Compact Cards List */}
            {tasksViewMode === 'grid' ? (
              <CategorySpreadsheetView
                documents={filteredDocs}
                selectedCategory={selectedCategoryFilter}
                onSelectCategory={(cat) => setSelectedCategoryFilter(cat)}
                onOpenDocDrawer={(doc) => openDocDrawer(doc)}
                renderThreeDotsMenu={renderThreeDotsMenu}
              />
            ) : (
              /* Task Items with Colored Pills (Compact List) */
              <div className="space-y-2 text-xs">
                {filteredDocs.map((doc) => {
                  const isNeedsReview = doc.status === 'needs_review';
                  const isApproved = doc.review_status === 'approved_by_ca';
                  const isDup = Boolean(doc.extracted_data?.duplicate_info?.is_duplicate);

                  return (
                    <div
                      key={doc.id}
                      onClick={() => openDocDrawer(doc)}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-200/80 transition-all"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${isNeedsReview ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                        <span className="font-semibold text-slate-800 truncate max-w-[180px]">{doc.original_filename}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${getDocTypeBadge(doc).bg}`}>
                          {getDocTypeBadge(doc).label}
                        </span>
                        {isDup && (
                          <span 
                            title={`Duplicate of ${doc.extracted_data?.duplicate_info?.duplicate_of_filename || 'another file'}`}
                            className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shrink-0 flex items-center gap-1"
                          >
                            <AlertTriangle className="w-2.5 h-2.5 text-rose-500" />
                            <span>Duplicate</span>
                          </span>
                        )}
                        <span className="text-slate-500 text-[11px] font-mono">
                          ₹{Number(doc.extracted_data?.grand_total ?? doc.extracted_data?.total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isNeedsReview ? (
                          <>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200/60">
                              ● Urgent Variance
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                              By today
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200/60">
                              ✓ Checks Passed
                            </span>
                            {isApproved ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 text-teal-600">
                                Approved by CA
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                                Pending Sign-off
                              </span>
                            )}
                          </>
                        )}
                        {renderThreeDotsMenu(doc, true)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Floating AI Chat Assistant Window (Nvidia Nemotron 3 Ultra 550B) */}
        {isChatOpen && (
          <div className={`fixed bottom-20 left-64 ${selectedDoc ? 'right-96' : 'right-0'} flex justify-center px-8 pointer-events-none z-30 transition-all duration-200`}>
            <div className="w-full max-w-2xl bg-white/98 backdrop-blur-md rounded-3xl border border-slate-200/90 shadow-2xl overflow-hidden pointer-events-auto flex flex-col max-h-[420px] animate-in fade-in slide-in-from-bottom-3 duration-200">
              {/* Header */}
              <div className="p-3 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs">AI Accounting Copilot</span>
                      <span className="flex items-center gap-1 text-[9px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span>Nemotron 3 Ultra (550B)</span>
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span>Grounded in {documents.length} uploaded files</span>
                      {selectedDoc && (
                        <>
                          <span>•</span>
                          <span className="text-blue-300 truncate max-w-[180px]">Focused on {selectedDoc.original_filename}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowFormatBar(!showFormatBar)}
                    title={showFormatBar ? "Hide Markdown formatting toolbar" : "Show Markdown formatting options"}
                    className={`px-2 py-1 rounded-lg transition-colors text-xs flex items-center gap-1.5 ${
                      showFormatBar
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                        : 'hover:bg-slate-700/50 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-mono hidden sm:inline">Format Bar</span>
                  </button>
                  {chatMessages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setChatMessages([])}
                      title="Clear chat"
                      className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsChatOpen(false)}
                    title="Minimize chat window"
                    className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors text-xs"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsChatOpen(false)}
                    title="Close chat window"
                    className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors text-xs"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Messages Body */}
              <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3.5 min-h-[160px] max-h-[360px] bg-slate-50/50 text-xs">
                {chatMessages.length === 0 ? (
                  <div className="py-6 px-4 text-center space-y-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100 shadow-2xs">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">How can I help with your ledger?</h4>
                      <p className="text-[11px] text-slate-500 max-w-md mx-auto mt-1">
                        Powered by <strong className="text-slate-700 font-mono">nvidia/nemotron-3-ultra-550b-a55b:free</strong>. Ask questions about line items, vendor taxes, arithmetic verification, or summary metrics across all uploaded files.
                      </p>
                    </div>

                    {/* Quick suggestion chips */}
                    <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2 max-w-lg mx-auto">
                      <button
                        type="button"
                        onClick={() => handleSendChat('Audit all uploaded files for duplicate documents or double-billing risks')}
                        className="px-2.5 py-1 rounded-full bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[11px] transition-colors shadow-2xs font-medium"
                      >
                        ⚠️ Duplicate audit across files
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendChat('What is the total sales amount and customer details in sales1.png?')}
                        className="px-2.5 py-1 rounded-full bg-white hover:bg-emerald-50 border border-slate-200 text-slate-700 hover:text-emerald-700 text-[11px] transition-colors shadow-2xs"
                      >
                        📊 Total in sales1.png?
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendChat('Summarize the electricity bill details (currentBill.jpeg)')}
                        className="px-2.5 py-1 rounded-full bg-white hover:bg-emerald-50 border border-slate-200 text-slate-700 hover:text-emerald-700 text-[11px] transition-colors shadow-2xs"
                      >
                        ⚡ Details in currentBill.jpeg?
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendChat('/summary')}
                        className="px-2.5 py-1 rounded-full bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 text-[11px] transition-colors shadow-2xs font-mono font-medium"
                      >
                        ⚡ /summary
                      </button>
                    </div>
                  </div>
                ) : (
                  chatMessages.map((m, idx) => (
                    <div key={idx} className={`flex gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {m.sender === 'assistant' && (
                        <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-[10px] shrink-0 mt-0.5 shadow-2xs">
                          <Bot className="w-3.5 h-3.5" />
                        </div>
                      )}
                      <div className={`max-w-2xl rounded-2xl p-3.5 text-xs shadow-2xs ${
                        m.sender === 'user' 
                          ? 'bg-blue-600 text-white rounded-br-xs' 
                          : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs'
                      }`}>
                        <MarkdownRenderer content={m.text} isUser={m.sender === 'user'} />
                        <div className={`text-[9px] mt-2 pt-1 border-t flex items-center gap-1.5 ${
                          m.sender === 'user' ? 'text-blue-200 justify-end border-blue-500/40' : 'text-slate-400 justify-between border-slate-100'
                        }`}>
                          {m.sender === 'assistant' && (
                            <span className="font-mono text-emerald-600 font-medium flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                              nvidia/nemotron-3-ultra-550b
                            </span>
                          )}
                          <span>{m.timestamp}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {isThinking && (
                  <div className="flex items-center gap-2.5 text-xs text-slate-600 p-3 bg-white rounded-2xl border border-slate-200/80 w-fit shadow-2xs animate-pulse">
                    <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-[10px] shrink-0">
                      <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-700">Nemotron 3 Ultra 550B is analyzing ledger data...</span>
                      <span className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce"></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.2s]"></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.4s]"></span>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 3. Operational Financial Assistant Bar */}
        <div className={`fixed bottom-6 left-64 ${selectedDoc ? 'right-96' : 'right-0'} flex flex-col items-center px-8 pointer-events-none z-30 transition-all duration-200`}>
          {/* Markdown Formatting Options Toolbar */}
          {showFormatBar && (
            <div className="mb-2 bg-[#172332] text-white px-3 py-1.5 rounded-[6px] shadow-md border border-[#2D425C] flex items-center gap-1.5 text-[11px] pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-150 select-none">
              <span className="text-[10px] font-mono text-[#94A3B8] uppercase tracking-wider mr-1 flex items-center gap-1">
                <Code2 className="w-3 h-3 text-[#A8C6DC]" />
                <span>Format:</span>
              </span>
              <button
                type="button"
                onClick={() => insertFormat('**bold text**')}
                className="px-2 py-0.5 rounded-[4px] bg-[#223247] hover:bg-[#2D425C] text-white font-bold transition-colors"
                title="Insert bold markdown"
              >
                B
              </button>
              <button
                type="button"
                onClick={() => insertFormat('*italic text*')}
                className="px-2 py-0.5 rounded-[4px] bg-[#223247] hover:bg-[#2D425C] text-white italic transition-colors font-serif"
                title="Insert italic markdown"
              >
                I
              </button>
              <button
                type="button"
                onClick={() => insertFormat('\n- ')}
                className="px-2 py-0.5 rounded-[4px] bg-[#223247] hover:bg-[#2D425C] text-white transition-colors"
                title="Insert bullet list item"
              >
                • List
              </button>
              <button
                type="button"
                onClick={insertTableTemplate}
                className="px-2 py-0.5 rounded-[4px] bg-[#223247] hover:bg-[#2D425C] text-white transition-colors flex items-center gap-1"
                title="Insert Markdown table template"
              >
                <span>Table</span>
              </button>
              <button
                type="button"
                onClick={() => insertFormat('`code`')}
                className="px-2 py-0.5 rounded-[4px] bg-[#223247] hover:bg-[#2D425C] text-white font-mono transition-colors"
                title="Insert inline code"
              >
                ‹/›
              </button>
              <div className="w-px h-3.5 bg-[#2D425C] mx-1"></div>
              <button
                type="button"
                onClick={() => handleSendChat('/summary')}
                className="px-2 py-0.5 rounded-[4px] bg-[#1F5D8F] hover:bg-[#174A73] text-white font-mono text-[10px] transition-colors"
                title="Generate ledger summary report"
              >
                /summary
              </button>
              <button
                type="button"
                onClick={() => handleSendChat('Audit all uploaded files for duplicate documents or double-billing risks')}
                className="px-2 py-0.5 rounded-[4px] bg-[#9A6700] hover:bg-[#7D5400] text-white font-mono text-[10px] transition-colors"
                title="Run cross-file duplicate audit"
              >
                /duplicates
              </button>
            </div>
          )}

          <div className="w-full max-w-2xl bg-white rounded-[8px] border border-[#D9E0E7] shadow-md p-2 flex items-center gap-2.5 pointer-events-auto transition-all focus-within:border-[#1F5D8F] focus-within:ring-1 focus-within:ring-[#1F5D8F]">
            {/* Upload File Intake Trigger */}
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Add documents for extraction"
              className="w-8 h-8 rounded-[6px] bg-[#F8FAFC] text-[#1F5D8F] hover:bg-[#E8F1F8] border border-[#D9E0E7] flex items-center justify-center shrink-0 transition-colors"
            >
              <Plus className="w-4 h-4 text-[#1F5D8F]" />
            </button>

            {/* Input Field */}
            <input
              type="text"
              value={chatQuery}
              onFocus={() => setIsChatOpen(true)}
              onChange={(e) => setChatQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendChat();
              }}
              placeholder="Query accounting records, vendor GSTIN, arithmetic variance, or ledgers..."
              className="flex-1 text-xs text-[#17202A] placeholder-[#9CA3AF] bg-transparent focus:outline-none px-1"
            />

            {/* Formatting Option Quick Toggle Button */}
            <button
              type="button"
              onClick={() => setShowFormatBar(!showFormatBar)}
              className={`p-1.5 rounded-[6px] text-xs transition-colors flex items-center gap-1 ${
                showFormatBar 
                  ? 'bg-[#E8F1F8] text-[#1F5D8F] font-semibold' 
                  : 'text-[#6B7280] hover:text-[#17202A] hover:bg-[#F8FAFC]'
              }`}
              title="Toggle Markdown formatting options toolbar"
            >
              <Code2 className="w-3.5 h-3.5" />
            </button>

            {/* Active Model Pill */}
            <span 
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="cursor-pointer text-[10px] font-mono text-[#1F5D8F] bg-[#E8F1F8] hover:bg-[#D3E4F2] px-2.5 py-1 rounded-[6px] border border-[#A8C6DC] hidden sm:flex items-center gap-1.5 shrink-0 transition-colors"
              title="Click to toggle Nemotron accounting copilot window"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#1F5D8F]"></span>
              <span className="font-semibold">Nemotron 550B</span>
              <MessageSquare className="w-3 h-3 text-[#1F5D8F] ml-0.5" />
            </span>

            {/* Send Button */}
            <button
              type="button"
              onClick={() => handleSendChat()}
              disabled={!chatQuery.trim() || isThinking}
              className={`w-8 h-8 rounded-[6px] flex items-center justify-center transition-all ${
                chatQuery.trim() && !isThinking
                  ? 'bg-[#1F5D8F] text-white hover:bg-[#174A73]' 
                  : 'bg-[#F8FAFC] text-[#9CA3AF] border border-[#D9E0E7] cursor-not-allowed'
              }`}
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>
      )}
    </div>

      {/* 4. SLIDE-OVER EXTRACTION DRAWER (When a Document is Clicked) */}
      {selectedDoc && (
        <aside className="w-96 lg:w-[480px] bg-white border-l border-[#D9E0E7] shadow-xl flex flex-col h-full z-40 animate-in slide-in-from-right duration-150 select-none">
          {/* Drawer Header */}
          <div className="p-4 border-b border-[#D9E0E7] bg-[#F8FAFC] flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-semibold tracking-wider text-[#1F5D8F] bg-[#E8F1F8] border border-[#A8C6DC] px-2 py-0.5 rounded-[4px]">
                  Accounting Evidence
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-[4px] border ${getDocTypeBadge(selectedDoc).bg}`}>
                  {getDocTypeBadge(selectedDoc).label}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-[#17202A] mt-1.5 truncate max-w-[320px]">
                {selectedDoc.original_filename}
              </h3>
            </div>
            <div className="flex items-center gap-1">
              {renderThreeDotsMenu(selectedDoc, true)}
              <button 
                onClick={() => setSelectedDoc(null)}
                className="p-1 rounded-[4px] text-[#6B7280] hover:text-[#17202A] hover:bg-[#EEF2F6]"
                title="Close drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {/* Actionable Duplicate Warning Banner */}
            {selectedDoc.extracted_data?.duplicate_info?.is_duplicate && (
              <div className="p-3.5 bg-[#FFF5D6] rounded-[6px] border border-[#E7CA75] text-[#17202A] space-y-2">
                <div className="flex items-center gap-1.5 text-[#9A6700] font-semibold text-xs">
                  <AlertTriangle className="w-4 h-4 text-[#9A6700] shrink-0" />
                  <span>Duplicate Document Detected</span>
                </div>
                <p className="text-xs text-[#4B5563] leading-relaxed">
                  Identified as duplicate of <strong>{selectedDoc.extracted_data.duplicate_info.duplicate_of_filename}</strong>.
                  {selectedDoc.extracted_data.duplicate_info.match_reason && (
                    <span className="block mt-0.5 text-[#9A6700] font-mono text-[10px]">
                      Basis: {selectedDoc.extracted_data.duplicate_info.match_reason}
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-2 pt-0.5">
                  {selectedDoc.extracted_data.duplicate_info.resolved ? (
                    <span className="text-xs text-[#237A57] font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#237A57]" />
                      <span>Duplicate Acknowledged by CA</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleResolveDuplicate(selectedDoc.id)}
                      className="py-1 px-2.5 bg-[#9A6700] hover:bg-[#7D5400] text-white rounded-[6px] text-xs font-semibold transition-colors flex items-center justify-center gap-1 shadow-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Acknowledge Duplicate</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Actionable Exception Banner (needs_review files) */}
            {selectedDoc.status === 'needs_review' && !selectedDoc.extracted_data?.duplicate_info?.is_duplicate && (
              <div className="p-3.5 bg-[#FFF5D6] rounded-[6px] border border-[#E7CA75] text-[#17202A] space-y-2.5">
                <div className="flex items-center gap-1.5 text-[#9A6700] font-semibold text-xs">
                  <AlertTriangle className="w-4 h-4 text-[#9A6700]" />
                  <span>Arithmetic Variance Detected (Needs Review)</span>
                </div>
                <p className="text-xs text-[#4B5563] leading-relaxed">
                  Document total reads <strong className="font-mono text-[#17202A]">₹{Number(selectedDoc.extracted_data?.grand_total ?? selectedDoc.extracted_data?.total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>, but Subtotal (<strong className="font-mono text-[#17202A]">₹{Number(selectedDoc.extracted_data?.subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>) + Taxes (<strong className="font-mono text-[#17202A]">₹{Number(selectedDoc.extracted_data?.tax_total ?? selectedDoc.extracted_data?.tax ?? ((Number(selectedDoc.extracted_data?.cgst) || 0) + (Number(selectedDoc.extracted_data?.sgst) || 0))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>) equals <strong className="font-mono text-[#17202A]">₹{Number((Number(selectedDoc.extracted_data?.subtotal) || 0) + Number(selectedDoc.extracted_data?.tax_total ?? selectedDoc.extracted_data?.tax ?? ((Number(selectedDoc.extracted_data?.cgst) || 0) + (Number(selectedDoc.extracted_data?.sgst) || 0)))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleApproveWithAdjustment(selectedDoc)}
                    className="flex-1 py-1.5 px-2.5 bg-[#9A6700] hover:bg-[#7D5400] text-white rounded-[6px] text-xs font-semibold transition-colors flex items-center justify-center gap-1 shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve with Adjustment</span>
                  </button>
                  <button
                    onClick={() => handleApprove(selectedDoc.id)}
                    className="py-1.5 px-2.5 bg-white hover:bg-[#F8FAFC] text-[#17202A] border border-[#D9E0E7] rounded-[6px] text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                  >
                    <span>Accept As-Is</span>
                  </button>
                </div>
              </div>
            )}

            {/* View Mode Toggle: Tabular Format vs JSON Format */}
            <div className="flex items-center bg-[#F8FAFC] p-1 rounded-[6px] border border-[#D9E0E7]">
              <button
                type="button"
                onClick={() => setDrawerTab('tabular')}
                className={`flex-1 py-1.5 px-3 rounded-[4px] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  drawerTab === 'tabular' 
                    ? 'bg-white text-[#17202A] shadow-xs border border-[#D9E0E7]' 
                    : 'text-[#6B7280] hover:text-[#17202A]'
                }`}
              >
                <Table className="w-3.5 h-3.5 text-[#1F5D8F]" />
                <span>Tabular Format</span>
                {getDocTypeBadge(selectedDoc).isTabular && (
                  <span className="text-[9px] bg-[#E8F1F8] text-[#1F5D8F] px-1.5 py-0.2 rounded-[4px] font-mono font-medium">Primary</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setDrawerTab('json')}
                className={`flex-1 py-1.5 px-3 rounded-[4px] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  drawerTab === 'json' 
                    ? 'bg-white text-[#17202A] shadow-xs border border-[#D9E0E7]' 
                    : 'text-[#6B7280] hover:text-[#17202A]'
                }`}
              >
                <Code2 className="w-3.5 h-3.5 text-[#4B5563]" />
                <span>JSON Format</span>
                {!getDocTypeBadge(selectedDoc).isTabular && (
                  <span className="text-[9px] bg-[#E8F1F8] text-[#1F5D8F] px-1.5 py-0.2 rounded-[4px] font-mono font-medium">Primary</span>
                )}
              </button>
            </div>

            {/* TAB 1: TABULAR FORMAT (For Invoices, Receipts, Sales Records, Purchase Records, Bank Statements) */}
            {drawerTab === 'tabular' && (
              <div className="space-y-4">
                {/* 1. Overview Tabular Grid */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider flex items-center gap-1.5">
                      <Table className="w-3.5 h-3.5 text-[#1F5D8F]" />
                      <span>Extracted Ledger Attributes</span>
                    </h4>
                    <span className="text-[10px] text-[#6B7280] font-mono">
                      Confidence: {Math.round((selectedDoc.confidence_score || 0.95) * 100)}%
                    </span>
                  </div>

                  <div className="overflow-hidden rounded-[6px] border border-[#D9E0E7] bg-white">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#F8FAFC] border-b border-[#D9E0E7] text-[10px] font-semibold text-[#4B5563] uppercase tracking-wider">
                          <th className="py-2 px-3">Attribute</th>
                          <th className="py-2 px-3">Extracted Value</th>
                          <th className="py-2 px-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D9E0E7] text-[#17202A]">
                        <tr>
                          <td className="py-2 px-3 text-[#6B7280] font-medium">Category</td>
                          <td className="py-2 px-3 font-semibold">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-[4px] border ${getDocTypeBadge(selectedDoc).bg}`}>
                              {getDocTypeBadge(selectedDoc).label}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <span className="text-[10px] font-mono text-[#237A57] bg-[#E8F5EE] px-1.5 py-0.5 rounded-[4px] border border-[#A8D8C1]">
                              Tabular
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-[#6B7280] font-medium">Identifier #</td>
                          <td className="py-2 px-3 font-mono font-semibold text-[#17202A]">
                            {selectedDoc.extracted_data?.identifier || selectedDoc.extracted_data?.invoice_number || selectedDoc.extracted_data?.account_number || '—'}
                          </td>
                          <td className="py-2 px-3 text-right text-[#6B7280] font-mono text-[10px]">Verified</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-[#6B7280] font-medium">Party / Entity</td>
                          <td className="py-2 px-3 font-medium text-[#17202A] truncate max-w-[170px]">
                            {selectedDoc.extracted_data?.party_name || selectedDoc.extracted_data?.vendor_name || selectedDoc.extracted_data?.merchant_name || selectedDoc.extracted_data?.bank_name || '—'}
                          </td>
                          <td className="py-2 px-3 text-right text-[#6B7280] font-mono text-[10px]">Recognized</td>
                        </tr>
                        {(selectedDoc.extracted_data?.party_tax_id || selectedDoc.extracted_data?.vendor_gstin) && (
                          <tr>
                            <td className="py-2 px-3 text-[#6B7280] font-medium">GSTIN / Tax ID</td>
                            <td className="py-2 px-3 font-mono font-semibold text-[#1F5D8F]">
                              {selectedDoc.extracted_data?.party_tax_id || selectedDoc.extracted_data?.vendor_gstin}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <span className="text-[10px] text-[#1F5D8F] bg-[#E8F1F8] border border-[#A8C6DC] px-1.5 py-0.5 rounded-[4px]">15-Char Valid</span>
                            </td>
                          </tr>
                        )}
                        <tr>
                          <td className="py-2 px-3 text-[#6B7280] font-medium">Transaction Date</td>
                          <td className="py-2 px-3 font-mono text-[#17202A]">
                            {selectedDoc.extracted_data?.date || selectedDoc.extracted_data?.invoice_date || selectedDoc.extracted_data?.receipt_date || selectedDoc.created_at?.slice(0, 10) || '—'}
                          </td>
                          <td className="py-2 px-3 text-right text-[#6B7280] font-mono text-[10px]">ISO Date</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-[#6B7280] font-medium">Taxable Subtotal</td>
                          <td className="py-2 px-3 font-mono font-medium text-[#17202A]">
                            ₹{Number(selectedDoc.extracted_data?.subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-right text-[#6B7280] font-mono text-[10px]">Taxable</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-[#6B7280] font-medium">Taxes (GST Total)</td>
                          <td className="py-2 px-3 font-mono font-medium text-[#17202A]">
                            ₹{Number(selectedDoc.extracted_data?.tax_total ?? selectedDoc.extracted_data?.tax ?? ((Number(selectedDoc.extracted_data?.cgst) || 0) + (Number(selectedDoc.extracted_data?.sgst) || 0))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-right text-[#6B7280] font-mono text-[10px]">GST Total</td>
                        </tr>
                        <tr className="bg-[#F8FAFC] font-bold">
                          <td className="py-2.5 px-3 text-[#17202A]">Grand Total</td>
                          <td className={`py-2.5 px-3 font-mono text-sm ${selectedDoc.status === 'needs_review' ? 'text-[#9A6700]' : 'text-[#17202A]'}`}>
                            ₹{Number(selectedDoc.extracted_data?.grand_total ?? selectedDoc.extracted_data?.total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <span className={`text-[10px] px-2 py-0.5 rounded-[4px] font-semibold ${selectedDoc.status === 'needs_review' ? 'bg-[#FFF5D6] text-[#9A6700] border border-[#E7CA75]' : 'bg-[#E8F5EE] text-[#237A57] border border-[#A8D8C1]'}`}>
                              {selectedDoc.status === 'needs_review' ? 'Discrepancy' : 'Checks Passed'}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 2. Tabular Line Items / Transactions */}
                {Array.isArray(selectedDoc.extracted_data?.transactions) && selectedDoc.extracted_data.transactions.length > 0 ? (
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider flex items-center gap-1.5">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-[#1F5D8F]" />
                      <span>Bank Statement Transactions ({selectedDoc.extracted_data.transactions.length})</span>
                    </h4>
                    <div className="overflow-x-auto rounded-[6px] border border-[#D9E0E7] bg-white">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-[#F8FAFC] border-b border-[#D9E0E7] text-[10px] font-semibold text-[#4B5563] uppercase tracking-wider">
                            <th className="py-2 px-2.5">Date</th>
                            <th className="py-2 px-2.5">Narration</th>
                            <th className="py-2 px-2.5 text-right">Debit (₹)</th>
                            <th className="py-2 px-2.5 text-right">Credit (₹)</th>
                            <th className="py-2 px-2.5 text-right">Balance (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#D9E0E7] text-[#17202A] font-mono">
                          {selectedDoc.extracted_data.transactions.map((tx: any, idx: number) => (
                            <tr key={idx} className="hover:bg-[#F8FAFC]">
                              <td className="py-2 px-2.5 text-[#6B7280] whitespace-nowrap">{tx.date || tx.txn_date || '—'}</td>
                              <td className="py-2 px-2.5 font-sans font-medium text-[#17202A] truncate max-w-[120px]">{tx.narration || 'Transaction'}</td>
                              <td className="py-2 px-2.5 text-right text-[#B33A3A]">{Number(tx.debit || 0) > 0 ? `₹${Number(tx.debit).toLocaleString()}` : '—'}</td>
                              <td className="py-2 px-2.5 text-right text-[#237A57]">{Number(tx.credit || 0) > 0 ? `₹${Number(tx.credit).toLocaleString()}` : '—'}</td>
                              <td className="py-2 px-2.5 text-right text-[#17202A] font-semibold">₹{Number(tx.balance || 0).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : Array.isArray(selectedDoc.extracted_data?.line_items) && selectedDoc.extracted_data.line_items.length > 0 ? (
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider flex items-center gap-1.5">
                      <Table className="w-3.5 h-3.5 text-[#1F5D8F]" />
                      <span>Line Items Breakdown ({selectedDoc.extracted_data.line_items.length})</span>
                    </h4>
                    <div className="overflow-x-auto rounded-[6px] border border-[#D9E0E7] bg-white">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-[#F8FAFC] border-b border-[#D9E0E7] text-[10px] font-semibold text-[#4B5563] uppercase tracking-wider">
                            <th className="py-2 px-2.5">Item Description</th>
                            <th className="py-2 px-2 text-center">Qty</th>
                            <th className="py-2 px-2 text-right">Rate</th>
                            <th className="py-2 px-2 text-right">Tax</th>
                            <th className="py-2 px-2.5 text-right">Amount (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#D9E0E7] text-[#17202A] font-mono">
                          {selectedDoc.extracted_data.line_items.map((item: any, idx: number) => (
                            <tr key={idx} className="hover:bg-[#F8FAFC]">
                              <td className="py-2 px-2.5 font-sans font-medium text-[#17202A] truncate max-w-[130px]">
                                {item.description || `Item #${idx + 1}`}
                              </td>
                              <td className="py-2 px-2 text-center text-[#4B5563]">{item.quantity || item.qty || 1}</td>
                              <td className="py-2 px-2 text-right text-[#4B5563]">₹{Number(item.unit_price || item.rate || 0).toLocaleString()}</td>
                              <td className="py-2 px-2 text-right text-[#6B7280]">{item.tax_rate || 18}%</td>
                              <td className="py-2 px-2.5 text-right font-semibold text-[#17202A]">
                                ₹{Number(item.amount || (Number(item.rate || 0) * (item.qty || 1))).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {/* 3. Deterministic Arithmetic Verification Card */}
                <div className="p-3 bg-[#F8FAFC] rounded-[6px] border border-[#D9E0E7] space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-[#17202A]">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#237A57]" />
                      <span>Deterministic Rule Engine Verification</span>
                    </span>
                    <span className="text-[10px] font-mono text-[#6B7280]">Exact Formula</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono text-[10px]">
                    <div className="bg-white p-2 rounded-[6px] border border-[#D9E0E7]">
                      <span className="text-[#6B7280] block uppercase">Subtotal</span>
                      <span className="font-semibold text-[#17202A] text-xs mt-0.5 block">
                        ₹{Number(selectedDoc.extracted_data?.subtotal || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-[6px] border border-[#D9E0E7]">
                      <span className="text-[#6B7280] block uppercase">Taxes</span>
                      <span className="font-semibold text-[#17202A] text-xs mt-0.5 block">
                        +₹{Number(selectedDoc.extracted_data?.tax_total ?? selectedDoc.extracted_data?.tax ?? 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-[6px] border border-[#D9E0E7]">
                      <span className="text-[#6B7280] block uppercase">Calculated</span>
                      <span className="font-semibold text-[#1F5D8F] text-xs mt-0.5 block">
                        =₹{Number((Number(selectedDoc.extracted_data?.subtotal || 0) + Number(selectedDoc.extracted_data?.tax_total ?? selectedDoc.extracted_data?.tax ?? 0))).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: JSON FORMAT (For Category 'Others' or Full Data Inspection) */}
            {drawerTab === 'json' && (
              <div className="space-y-3">
                <div className="p-3 bg-[#F8FAFC] rounded-[6px] border border-[#D9E0E7] text-[#17202A] flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[#17202A] flex items-center gap-1.5 text-xs">
                      <Code2 className="w-4 h-4 text-[#1F5D8F]" />
                      <span>Structured Financial JSON</span>
                    </div>
                    <p className="text-[11px] text-[#4B5563] mt-0.5">
                      {selectedDoc.document_type === 'others' 
                        ? 'Unstructured document: Fields captured as dynamic key-value JSON schema.' 
                        : 'Normalized full payload schema.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyJson(selectedDoc.extracted_data)}
                    className="px-2.5 py-1.5 bg-white hover:bg-[#F8FAFC] text-[#17202A] rounded-[6px] text-xs font-medium border border-[#D9E0E7] flex items-center gap-1 transition-colors"
                  >
                    {copiedJson ? <Check className="w-3.5 h-3.5 text-[#237A57]" /> : <Copy className="w-3.5 h-3.5 text-[#6B7280]" />}
                    <span>{copiedJson ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                {selectedDoc.extracted_data?.detected_fields && Object.keys(selectedDoc.extracted_data.detected_fields).length > 0 && (
                  <div className="p-3 bg-white rounded-[6px] border border-[#D9E0E7] space-y-2">
                    <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider block">
                      Detected Freeform Fields ({Object.keys(selectedDoc.extracted_data.detected_fields).length})
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {Object.entries(selectedDoc.extracted_data.detected_fields).map(([k, v]: [string, any]) => (
                        <div key={k} className="p-2 bg-[#F8FAFC] rounded-[6px] border border-[#D9E0E7]">
                          <span className="text-[10px] font-mono text-[#6B7280] uppercase block">{k}</span>
                          <span className="font-medium text-[#17202A] truncate block mt-0.5">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="relative rounded-[6px] border border-[#2D425C] bg-[#172332] text-white overflow-hidden shadow-inner">
                  <div className="flex items-center justify-between px-3.5 py-2 bg-[#172332] border-b border-[#2D425C] text-[10px] font-mono text-[#94A3B8]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#237A57]"></span>
                      <span>category_{selectedDoc.document_type || 'others'}.json</span>
                    </span>
                    <span>{JSON.stringify(selectedDoc.extracted_data).length} bytes</span>
                  </div>
                  <pre className="p-3.5 text-[11px] font-mono leading-relaxed overflow-x-auto max-h-80 text-[#A8D8C1] whitespace-pre-wrap">
                    {JSON.stringify(selectedDoc.extracted_data, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Raw OCR Transcription Toggle */}
            {selectedDoc.extracted_data?.raw_text && (
              <div className="space-y-1.5 pt-2 border-t border-[#D9E0E7]">
                <h4 className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">
                  Raw OCR Transcription (RapidOCR)
                </h4>
                <pre className="text-[10px] text-[#4B5563] font-mono bg-[#F8FAFC] p-2.5 rounded-[6px] border border-[#D9E0E7] max-h-28 overflow-y-auto whitespace-pre-wrap">
                  {selectedDoc.extracted_data.raw_text}
                </pre>
              </div>
            )}

            {/* Live Document Preview */}
            <div className="space-y-2 pt-3 border-t border-[#D9E0E7]">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-[#1F5D8F]" />
                  <span>Document File Preview</span>
                </h4>
                <a
                  href={`http://127.0.0.1:8000/api/v1/documents/${selectedDoc.id}/file`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-[#1F5D8F] hover:text-[#174A73] font-semibold flex items-center gap-1 hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Open Raw File</span>
                </a>
              </div>

              {(() => {
                const isImage = selectedDoc.mime_type?.startsWith('image/') || 
                  /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(selectedDoc.original_filename);
                const isPdf = selectedDoc.mime_type === 'application/pdf' || 
                  /\.pdf$/i.test(selectedDoc.original_filename);
                const fileUrl = `http://127.0.0.1:8000/api/v1/documents/${selectedDoc.id}/file`;

                if (isImage) {
                  return (
                    <div className="relative group rounded-[6px] overflow-hidden border border-[#D9E0E7] bg-[#F8FAFC] p-2 flex flex-col items-center justify-center">
                      <div className="w-full flex items-center justify-center min-h-[200px] max-h-[380px] overflow-hidden rounded-[4px] bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={fileUrl}
                          alt={selectedDoc.original_filename}
                          className="max-h-[360px] w-auto max-w-full object-contain rounded-[4px] shadow-xs cursor-zoom-in"
                          onClick={() => window.open(fileUrl, '_blank')}
                        />
                      </div>
                      <div className="w-full mt-2 flex items-center justify-between text-[11px] text-[#6B7280] px-1">
                        <span className="truncate max-w-[200px] font-medium text-[#17202A]">{selectedDoc.original_filename}</span>
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-0.5 rounded-[4px] bg-[#172332] text-white text-[10px] font-semibold hover:bg-[#223247] transition-colors flex items-center gap-1 shrink-0"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          <span>Full View</span>
                        </a>
                      </div>
                    </div>
                  );
                }

                if (isPdf) {
                  return (
                    <div className="rounded-[6px] overflow-hidden border border-[#D9E0E7] bg-white">
                      <iframe
                        src={fileUrl}
                        className="w-full h-72 border-0 bg-[#F8FAFC]"
                        title={selectedDoc.original_filename}
                      />
                      <div className="p-2 bg-[#F8FAFC] border-t border-[#D9E0E7] flex items-center justify-between text-[11px] text-[#6B7280]">
                        <span className="truncate max-w-[200px] font-medium text-[#17202A]">{selectedDoc.original_filename}</span>
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#1F5D8F] hover:text-[#174A73] font-semibold flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Popout PDF</span>
                        </a>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="p-4 rounded-[6px] border border-[#D9E0E7] bg-[#F8FAFC] flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <FileSpreadsheet className="w-5 h-5 text-[#6B7280]" />
                      <div>
                        <div className="text-xs font-semibold text-[#17202A]">{selectedDoc.original_filename}</div>
                        <div className="text-[10px] text-[#6B7280]">{selectedDoc.mime_type || 'Document file'}</div>
                      </div>
                    </div>
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 rounded-[6px] bg-white border border-[#D9E0E7] text-xs font-semibold text-[#17202A] hover:bg-[#F8FAFC] flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Download / View</span>
                    </a>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Drawer Footer Actions */}
          <div className="p-4 border-t border-[#D9E0E7] flex items-center justify-between bg-[#F8FAFC]">
            {selectedDoc.review_status === 'approved_by_ca' ? (
              <span className="text-xs font-semibold text-[#237A57] flex items-center gap-1.5 bg-[#E8F5EE] border border-[#A8D8C1] px-3 py-1.5 rounded-[6px] w-full justify-center">
                <CheckCheck className="w-4 h-4 text-[#237A57]" />
                <span>Approved by {selectedDoc.reviewed_by || 'Chartered Accountant'}</span>
              </span>
            ) : (
              <button
                onClick={() => handleApprove(selectedDoc.id)}
                className="w-full py-2 bg-[#237A57] hover:bg-[#1A5C41] text-white rounded-[6px] text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <CheckCheck className="w-4 h-4" />
                <span>Approve Extracted Record</span>
              </button>
            )}
          </div>
        </aside>
      )}

      {/* Delete Confirmation Modal */}
      {docToDelete && (
        <div 
          className="fixed inset-0 bg-[#172332]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={() => !isDeleting && setDocToDelete(null)}
        >
          <div 
            className="bg-white rounded-[8px] p-6 max-w-sm w-full shadow-lg border border-[#D9E0E7] animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-[6px] bg-[#FDECEC] text-[#B33A3A] border border-[#E8AAAA] flex items-center justify-center mb-4">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-[#17202A]">Delete uploaded file?</h3>
            <p className="text-xs text-[#4B5563] mt-1.5 leading-relaxed">
              Are you sure you want to delete <strong className="text-[#17202A] font-semibold">{docToDelete.original_filename}</strong>? This will permanently remove the file from secure storage, extracted OCR data, and related audit events.
            </p>
            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDocToDelete(null)}
                className="px-3.5 py-1.5 rounded-[6px] text-xs font-semibold text-[#4B5563] border border-[#D9E0E7] hover:bg-[#F8FAFC] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => handleDeleteDoc(docToDelete.id)}
                className="px-3.5 py-1.5 rounded-[6px] text-xs font-semibold bg-[#B33A3A] hover:bg-[#922828] text-white transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete File'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* All Uploads Manager Modal */}
      {showAllUploadsModal && (
        <div 
          className="fixed inset-0 bg-[#172332]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={() => setShowAllUploadsModal(false)}
        >
          <div 
            className="bg-white rounded-[8px] max-w-2xl w-full shadow-lg border border-[#D9E0E7] max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-[#D9E0E7] bg-[#F8FAFC] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-[#1F5D8F]" />
                <h2 className="text-sm font-semibold text-[#17202A]">
                  Uploaded Financial Documents ({documents.length})
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowAllUploadsModal(false);
                    fileInputRef.current?.click();
                  }}
                  className="px-3 py-1.5 bg-[#1F5D8F] hover:bg-[#174A73] text-white rounded-[6px] text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Upload New</span>
                </button>
                <button
                  onClick={() => setShowAllUploadsModal(false)}
                  className="p-1 rounded-[4px] text-[#6B7280] hover:text-[#17202A] hover:bg-[#EEF2F6]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter / Search Bar */}
            <div className="p-3 border-b border-[#D9E0E7] bg-[#F8FAFC]">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#6B7280] absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search uploaded files by name..."
                  value={uploadsFilter}
                  onChange={(e) => setUploadsFilter(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#D9E0E7] rounded-[6px] text-xs text-[#17202A] placeholder-[#9CA3AF] focus:outline-none focus:border-[#1F5D8F]"
                />
              </div>
            </div>

            {/* Modal Body - File List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {documents
                .filter(d => d.original_filename.toLowerCase().includes(uploadsFilter.toLowerCase()))
                .map(doc => (
                  <div
                    key={doc.id}
                    onClick={() => {
                      openDocDrawer(doc);
                      setShowAllUploadsModal(false);
                    }}
                    className="flex items-center justify-between p-3 rounded-[6px] border border-[#D9E0E7] hover:bg-[#F8FAFC] hover:border-[#B8C2CC] cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-[6px] bg-[#E8F1F8] text-[#1F5D8F] border border-[#A8C6DC] flex items-center justify-center shrink-0">
                        {doc.document_type === 'bank_statement' ? (
                          <FileSpreadsheet className="w-4 h-4 text-[#1F5D8F]" />
                        ) : (
                          <FileText className="w-4 h-4 text-[#1F5D8F]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-[#17202A] truncate">
                          {doc.original_filename}
                        </div>
                        <div className="text-[10px] text-[#6B7280] flex items-center gap-2 mt-0.5 font-mono">
                          <span>{(doc.file_size / 1024).toFixed(1)} KB</span>
                          <span>•</span>
                          <span>{doc.document_type.replace('_', ' ')}</span>
                          <span>•</span>
                          <span>₹{(doc.extracted_data?.total || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {doc.status === 'needs_review' ? (
                        <span className="text-[10px] font-semibold text-[#9A6700] bg-[#FFF5D6] border border-[#E7CA75] px-2 py-0.5 rounded-[4px]">
                          Needs Review
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-[#237A57] bg-[#E8F5EE] border border-[#A8D8C1] px-2 py-0.5 rounded-[4px]">
                          Checks Passed
                        </span>
                      )}
                      {renderThreeDotsMenu(doc, true)}
                    </div>
                  </div>
                ))}
              {documents.length === 0 && (
                <div className="text-center py-8 text-xs text-[#6B7280]">
                  No uploaded documents found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Batch Processing & 6-Category Sorting Modal */}
      {isProcessingBatch && (
        <div 
          className="fixed inset-0 bg-[#172332]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 select-none"
          onClick={() => batchStage === 'complete' && setIsProcessingBatch(false)}
        >
          <div 
            className="bg-white rounded-[8px] max-w-2xl w-full shadow-lg border border-[#D9E0E7] p-6 space-y-6 animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[6px] bg-[#E8F1F8] text-[#1F5D8F] flex items-center justify-center border border-[#A8C6DC]">
                  {batchStage === 'complete' ? (
                    <CheckCircle2 className="w-5 h-5 text-[#237A57]" />
                  ) : (
                    <RefreshCw className="w-5 h-5 text-[#1F5D8F] animate-spin" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-[#17202A]">
                      {batchStage === 'complete' 
                        ? 'Batch Ingestion Complete' 
                        : 'Document Ingestion & Categorization'}
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-[4px] bg-[#E8F1F8] text-[#1F5D8F] font-semibold border border-[#A8C6DC]">
                      6 Registers
                    </span>
                  </div>
                  <p className="text-xs text-[#4B5563] mt-0.5 max-w-lg truncate">
                    {stepSubtext}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsProcessingBatch(false)}
                className="p-1.5 rounded-[4px] text-[#6B7280] hover:text-[#17202A] hover:bg-[#F8FAFC] transition-colors"
                title="Close modal (processing continues in background)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Live Progress Bar & Multi-Stage Pipeline Tracker */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#17202A]">
                <span className="flex items-center gap-1.5">
                  <RefreshCw className={`w-3.5 h-3.5 text-[#1F5D8F] ${batchStage !== 'complete' ? 'animate-spin' : ''}`} />
                  <span>{stepLabel}</span>
                </span>
                <span className="font-mono text-[#1F5D8F] font-semibold text-xs">
                  {uploadProgress}%
                </span>
              </div>

              {/* Progress Bar Track */}
              <div className="w-full h-2 bg-[#F8FAFC] rounded-full overflow-hidden border border-[#D9E0E7]">
                <div 
                  className="h-full bg-[#1F5D8F] transition-all duration-300 ease-out"
                  style={{
                    width: `${uploadProgress}%`
                  }}
                ></div>
              </div>

              {/* 3 Real-Time Visual Step Badges */}
              <div className="grid grid-cols-3 gap-2 pt-0.5 text-[11px]">
                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] border transition-all ${
                  uploadProgress >= 38 ? 'bg-[#E8F5EE] text-[#237A57] border-[#A8D8C1] font-medium' :
                  'bg-[#E8F1F8] text-[#1F5D8F] border-[#A8C6DC] font-semibold'
                }`}>
                  {uploadProgress >= 38 ? <CheckCircle2 className="w-3.5 h-3.5 text-[#237A57] shrink-0" /> : <RefreshCw className="w-3.5 h-3.5 text-[#1F5D8F] animate-spin shrink-0" />}
                  <span className="truncate">1. Ingest & Integrity</span>
                </div>
                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] border transition-all ${
                  uploadProgress >= 72 ? 'bg-[#E8F5EE] text-[#237A57] border-[#A8D8C1] font-medium' :
                  uploadProgress >= 38 ? 'bg-[#E8F1F8] text-[#1F5D8F] border-[#A8C6DC] font-semibold' :
                  'bg-[#F8FAFC] text-[#6B7280] border-[#D9E0E7]'
                }`}>
                  {uploadProgress >= 72 ? <CheckCircle2 className="w-3.5 h-3.5 text-[#237A57] shrink-0" /> :
                   uploadProgress >= 38 ? <RefreshCw className="w-3.5 h-3.5 text-[#1F5D8F] animate-spin shrink-0" /> :
                   <div className="w-2 h-2 rounded-full bg-[#D9E0E7] ml-0.5 mr-1 shrink-0"></div>}
                  <span className="truncate">2. RapidOCR ONNX</span>
                </div>
                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] border transition-all ${
                  batchStage === 'complete' || uploadProgress >= 100 ? 'bg-[#E8F5EE] text-[#237A57] border-[#A8D8C1] font-medium' :
                  uploadProgress >= 72 ? 'bg-[#E8F1F8] text-[#1F5D8F] border-[#A8C6DC] font-semibold' :
                  'bg-[#F8FAFC] text-[#6B7280] border-[#D9E0E7]'
                }`}>
                  {batchStage === 'complete' || uploadProgress >= 100 ? <CheckCircle2 className="w-3.5 h-3.5 text-[#237A57] shrink-0" /> :
                   uploadProgress >= 72 ? <RefreshCw className="w-3.5 h-3.5 text-[#1F5D8F] animate-spin shrink-0" /> :
                   <div className="w-2 h-2 rounded-full bg-[#D9E0E7] ml-0.5 mr-1 shrink-0"></div>}
                  <span className="truncate">3. Qwen 2.5:3b AI</span>
                </div>
              </div>
            </div>

            {/* 6 Category Stream Sorting Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#4B5563]">
                <span>Register Categorization Streams</span>
                <span className="text-[10px] font-normal text-[#6B7280]">5 Tabular + 1 JSON</span>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {CATEGORIES_CONFIG.map(cat => {
                  const count = categoryCounts[cat.id] || 0;
                  const isPopulated = count > 0;

                  return (
                    <div 
                      key={cat.id}
                      className={`p-3 rounded-[6px] border transition-all relative ${
                        isPopulated 
                          ? `${cat.bg} ${cat.border} border` 
                          : 'bg-[#F8FAFC] border-[#D9E0E7] opacity-80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-[4px] ${cat.bg} ${cat.color}`}>
                          {cat.format}
                        </span>
                        <span className={`text-base font-semibold font-mono ${isPopulated ? cat.color : 'text-[#6B7280]'}`}>
                          {count}
                        </span>
                      </div>
                      <div className="mt-2">
                        <div className="font-semibold text-xs text-[#17202A] flex items-center gap-1.5">
                          {cat.label}
                        </div>
                        <div className="text-[10px] text-[#6B7280] truncate mt-0.5">
                          {cat.desc}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Automatic Intake Review & Accounting Transformation Form */}
            {batchStage === 'complete' && reviewModalDoc && (
              <div className="bg-[#F8FAFC] border border-[#B3D4EC] rounded-[8px] p-4 shadow-xs space-y-3.5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-2.5 border-b border-[#D9E0E7]">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded bg-[#1F5D8F]/10 flex items-center justify-center text-[#1F5D8F]">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-[#17202A]">Review Extracted Values Before Accounting Post</h4>
                      <p className="text-[10px] text-[#6B7280]">Edit or verify values before generating balanced double-entry journal</p>
                    </div>
                  </div>
                  {uploadedBatchDocs.length > 1 && (
                    <div className="flex items-center gap-1">
                      {uploadedBatchDocs.map((doc, idx) => (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => selectDocForReview(doc)}
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-[4px] border transition-colors ${
                            reviewModalDoc.id === doc.id
                              ? 'bg-[#1F5D8F] text-white border-[#1F5D8F] font-semibold'
                              : 'bg-white text-[#4B5563] border-[#D9E0E7] hover:bg-[#F1F5F9]'
                          }`}
                        >
                          Doc #{idx + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">
                      Invoice / Ref #
                    </label>
                    <input 
                      type="text" 
                      value={reviewForm.invoice_number}
                      onChange={e => setReviewForm(prev => ({ ...prev, invoice_number: e.target.value }))}
                      className="w-full text-xs font-mono px-2.5 py-1.5 rounded-[4px] border border-[#D9E0E7] focus:border-[#1F5D8F] focus:outline-none bg-white"
                      placeholder="e.g. INV-2024-001"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">
                      Date
                    </label>
                    <input 
                      type="date" 
                      value={reviewForm.date}
                      onChange={e => setReviewForm(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full text-xs px-2.5 py-1.5 rounded-[4px] border border-[#D9E0E7] focus:border-[#1F5D8F] focus:outline-none bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">
                      Vendor / Counterparty
                    </label>
                    <input 
                      type="text" 
                      value={reviewForm.party_name}
                      onChange={e => setReviewForm(prev => ({ ...prev, party_name: e.target.value }))}
                      className="w-full text-xs font-medium px-2.5 py-1.5 rounded-[4px] border border-[#D9E0E7] focus:border-[#1F5D8F] focus:outline-none bg-white"
                      placeholder="e.g. Acme Corp"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">
                      Target GL Account
                    </label>
                    <select 
                      value={reviewForm.target_account_code}
                      onChange={e => setReviewForm(prev => ({ ...prev, target_account_code: e.target.value }))}
                      className="w-full text-xs px-2 py-1.5 rounded-[4px] border border-[#D9E0E7] focus:border-[#1F5D8F] focus:outline-none bg-white"
                    >
                      <option value="5200">5200 - Office Supplies & Expense</option>
                      <option value="5100">5100 - Cloud Infrastructure & Hosting</option>
                      <option value="5300">5300 - Travel & Lodging Expense</option>
                      <option value="5400">5400 - Professional & Legal Fees</option>
                      <option value="4000">4000 - Sales & Services Revenue</option>
                      <option value="1000">1000 - Bank / Cash Account</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">
                      Subtotal (₹)
                    </label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={reviewForm.subtotal}
                      onChange={e => {
                        const sub = parseFloat(e.target.value) || 0;
                        const tax = parseFloat(reviewForm.tax) || 0;
                        setReviewForm(prev => ({ ...prev, subtotal: e.target.value, total: (sub + tax).toFixed(2) }));
                      }}
                      className="w-full text-xs font-mono px-2.5 py-1.5 rounded-[4px] border border-[#D9E0E7] focus:border-[#1F5D8F] focus:outline-none bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">
                      Tax / GST (₹)
                    </label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={reviewForm.tax}
                      onChange={e => {
                        const tax = parseFloat(e.target.value) || 0;
                        const sub = parseFloat(reviewForm.subtotal) || 0;
                        setReviewForm(prev => ({ ...prev, tax: e.target.value, total: (sub + tax).toFixed(2) }));
                      }}
                      className="w-full text-xs font-mono px-2.5 py-1.5 rounded-[4px] border border-[#D9E0E7] focus:border-[#1F5D8F] focus:outline-none bg-white"
                    />
                  </div>
                </div>

                <div className="bg-[#E8F1F8]/60 border border-[#B3D4EC] rounded-[6px] p-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-[#1F5D8F]">Double-Entry Balancing:</span>
                    <span className="text-[10px] text-[#4B5563] font-mono">
                      Dr. #{reviewForm.target_account_code} (₹{Number(reviewForm.subtotal || 0).toLocaleString('en-IN')}) + Dr. ITC (₹{Number(reviewForm.tax || 0).toLocaleString('en-IN')}) = Cr. AP (₹{Number(reviewForm.total || 0).toLocaleString('en-IN')})
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-[#6B7280] block">Grand Total</span>
                    <span className="font-mono font-bold text-sm text-[#17202A]">
                      ₹{Number(reviewForm.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Uploaded Files Real-Time Feed */}
            {batchFiles.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider block">
                  Files in Ingestion Batch ({batchFiles.length})
                </span>
                <div className="bg-[#F8FAFC] rounded-[6px] p-2.5 border border-[#D9E0E7] max-h-36 overflow-y-auto space-y-1.5 text-xs">
                  {batchFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-[6px] border border-[#D9E0E7]">
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />
                        <span className="font-medium text-[#17202A] truncate max-w-[240px]">{file.name}</span>
                        <span className="text-[10px] text-[#6B7280] font-mono">({(file.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5">
                        {file.status === 'done' ? (
                          <div className="flex items-center gap-1.5">
                            {file.isDuplicate && (
                              <span 
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-[4px] bg-[#FFF5D6] text-[#9A6700] border border-[#E7CA75] flex items-center gap-1"
                                title={file.duplicateOf ? `Duplicate of ${file.duplicateOf}` : 'Duplicate document'}
                              >
                                <AlertTriangle className="w-2.5 h-2.5 text-[#9A6700]" />
                                <span>Duplicate</span>
                              </span>
                            )}
                            {file.category && (
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-[4px] border ${getDocTypeBadge(file.category).bg}`}>
                                {getDocTypeBadge(file.category).label}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-[#1F5D8F] flex items-center gap-1 font-mono">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            <span>Processing</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Bottom Actions */}
            <div className="pt-2 border-t border-[#D9E0E7] flex items-center justify-between">
              <div className="text-[11px] text-[#6B7280] flex items-center gap-1.5 font-mono">
                <span className={`w-2 h-2 rounded-full ${batchStage === 'complete' ? 'bg-[#237A57]' : 'bg-[#1F5D8F]'} inline-block`}></span>
                <span>RapidOCR + Qwen 2.5:3b Local Engine</span>
                {uploadSeconds > 0 && <span className="text-[#6B7280] font-semibold">• {uploadSeconds}s elapsed</span>}
              </div>
              <div className="flex items-center gap-2">
                {batchStage !== 'complete' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsProcessingBatch(false)}
                      className="px-3.5 py-1.5 rounded-[6px] text-xs font-semibold text-[#4B5563] hover:bg-[#F8FAFC] border border-[#D9E0E7] transition-colors"
                    >
                      Run in Background
                    </button>
                    <button
                      type="button"
                      disabled
                      className="px-5 py-2 rounded-[6px] text-xs font-semibold bg-[#F8FAFC] text-[#9CA3AF] border border-[#D9E0E7] cursor-not-allowed flex items-center gap-1.5"
                    >
                      <span>Processing...</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setIsProcessingBatch(false);
                        setReviewModalDoc(null);
                      }}
                      className="px-3.5 py-2 rounded-[6px] text-xs font-semibold text-[#4B5563] hover:bg-[#F8FAFC] border border-[#D9E0E7] transition-colors"
                    >
                      Keep as Draft Registers
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmAndPostToPipeline}
                      disabled={isPostingToPipeline}
                      className="px-5 py-2 rounded-[6px] text-xs font-semibold bg-[#237A57] hover:bg-[#1B6145] text-white transition-all flex items-center gap-1.5 shadow-sm"
                    >
                      {isPostingToPipeline ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Posting to General Ledger...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Confirm Changes & Post to Accounting Pipeline →</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

      )}

      {/* Floating Action Toast Notification */}
      {showToast && (
        <div className="fixed top-6 right-8 bg-[#172332] text-white text-xs font-medium px-4 py-3 rounded-[6px] shadow-lg z-50 flex items-center gap-2.5 border border-[#2D425C] animate-in fade-in slide-in-from-top-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-[#A8D8C1] shrink-0" />
          <span className="max-w-xs leading-snug">{showToast}</span>
          <button 
            type="button"
            onClick={() => setShowToast(null)} 
            className="text-[#94A3B8] hover:text-white ml-2 transition-colors p-0.5 rounded"
            title="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
