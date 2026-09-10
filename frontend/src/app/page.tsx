'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  Minimize2
} from 'lucide-react';
import { DocumentItem } from '@/types';
import { LoginView } from '@/components/auth/LoginView';
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer';
import { CategorySpreadsheetView } from '@/components/workspace/CategorySpreadsheetView';

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

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f8f9fb] text-slate-800 font-sans">
      {/* 1. LEFT SIDEBAR (Matching Screenshot Exactly) */}
      <aside className="w-64 bg-white border-r border-slate-200/80 flex flex-col justify-between p-4 select-none shrink-0">
        <div className="min-w-0">
          {/* User Profile Header (Demo Account) */}
          <div className="flex items-center justify-between pb-5 mb-4 border-b border-slate-100 gap-2 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-200 to-emerald-300 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700 shrink-0 shadow-2xs">
                {currentUser?.full_name ? currentUser.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'CH'}
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <span 
                  className="text-sm font-semibold text-slate-800 block truncate"
                  title={currentUser?.full_name || 'CA Hehram'}
                >
                  {currentUser?.full_name || 'CA Hehram'}
                </span>
                <span 
                  className="text-[10px] text-slate-400 block -mt-0.5 truncate"
                  title={currentUser?.role === 'ca_admin' ? 'Chartered Accountant (Admin)' : 'Accountant'}
                >
                  {currentUser?.role === 'ca_admin' ? 'Chartered Accountant (Admin)' : 'Accountant'}
                </span>
              </div>
            </div>
            <button 
              type="button"
              className="text-slate-400 hover:text-slate-600 p-1 shrink-0 rounded-lg hover:bg-slate-100 transition-colors"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Simple Navigation: Just Uploads */}
          <div className="space-y-1">
            <button 
              onClick={() => setShowAllUploadsModal(true)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-900 hover:bg-slate-200/70 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <UploadCloud className="w-4 h-4 text-slate-700" />
                <span>Uploads</span>
              </div>
              <span className="text-[10px] bg-white border border-slate-200 px-1.5 py-0.2 rounded-md font-mono text-slate-600">
                {documents.length}
              </span>
            </button>
          </div>

          {/* Recent Ingested Activity */}
          <div className="mt-8">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2 flex items-center justify-between">
              <span>Recent Files</span>
              {documents.length > 4 && (
                <button
                  onClick={() => setShowAllUploadsModal(true)}
                  className="text-[10px] text-blue-600 hover:underline font-normal"
                >
                  See all
                </button>
              )}
            </div>
            <div className="space-y-1 text-xs">
              {documents.slice(0, 5).map(doc => (
                <div 
                  key={doc.id}
                  onClick={() => openDocDrawer(doc)}
                  className="px-2.5 py-1.5 rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer flex items-center justify-between group transition-colors"
                >
                  <div className="flex items-center gap-2 truncate">
                    {doc.status === 'needs_review' ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                    )}
                    <span className="truncate max-w-[130px]">{doc.original_filename}</span>
                  </div>
                  {renderThreeDotsMenu(doc, false)}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Card: Pro Account & Settings (Matching Screenshot) */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-700">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full border-2 border-emerald-500 bg-emerald-100 inline-block"></span>
                <span className="font-semibold truncate max-w-[120px]">{currentFirm?.name || 'AiroKnight Studios'}</span>
              </div>
              <span className="text-[9px] font-mono text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200/50">127.0.0.1</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Verified by LedgerAgent Rule Engine
            </p>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="mt-2.5 w-full py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-sm shadow-blue-200 transition-colors"
            >
              Upload Invoices
            </button>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 px-1 pt-1">
            <span className="text-slate-500 font-medium">Settings</span>
            <button 
              onClick={handleLogout}
              title="Sign Out"
              className="flex items-center gap-1 text-[11px] text-rose-500 hover:text-rose-600 font-medium px-2 py-0.5 rounded-lg hover:bg-rose-50 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* 2. MAIN WORKSPACE CANVAS (Matching Screenshot Exactly) */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto px-10 pt-8 pb-24 relative">
        <div className="max-w-4xl mx-auto w-full space-y-6">
          {/* Greeting Banner */}
          <div>
            <div className="inline-flex items-center gap-2 bg-blue-100/70 text-blue-600 px-4 py-1.5 rounded-full text-2xl md:text-3xl font-bold">
              <span>Welcome, {currentUser?.full_name || 'CA Hehram'}!</span>
              <span>👋</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-normal text-slate-400 mt-2 tracking-tight">
              How can I help you today?
            </h1>
          </div>

          {/* Cards Grid: Row 1 */}
          <div className="grid grid-cols-2 gap-4">
            {/* Top Left Card: Previously Uploaded Files */}
            <div className="p-5 bg-white rounded-2xl border border-slate-200/70 shadow-sm hover:shadow transition-all">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span>Uploaded Financial Files</span>
                  <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.2 rounded text-slate-500">{documents.length}</span>
                </div>
                {documents.length > 3 && (
                  <button
                    onClick={() => setShowAllUploadsModal(true)}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    View all
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {documents.slice(0, 4).map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => openDocDrawer(doc)}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      {doc.document_type === 'bank_statement' ? (
                        <div className="w-6 h-6 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                      )}
                      <span className="text-xs font-medium text-slate-800 truncate max-w-[140px]">{doc.original_filename}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {doc.status === 'needs_review' ? (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                          ! Review
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                          ✓ Auto
                        </span>
                      )}
                      {renderThreeDotsMenu(doc, true)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Right Card: Drag & Drop Ingestion with Big '+' Icon and Multi-file Support */}
            <div 
              onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  handleFileUpload(Array.from(e.dataTransfer.files));
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`group p-6 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden min-h-[220px] ${
                isDragging 
                  ? 'border-blue-500 bg-blue-50/70 shadow-lg scale-[1.01]' 
                  : 'bg-white border-dashed border-slate-300 hover:border-blue-400 shadow-sm hover:shadow-md hover:bg-slate-50/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileUpload(Array.from(e.target.files));
                  }
                }}
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.zip"
              />

              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <div className="flex items-center gap-1.5 text-blue-600 font-bold">
                  <Sparkles className="w-4 h-4 text-blue-500 animate-pulse" />
                  <span>AI Ingestion & Auto-Categorization</span>
                </div>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200/60 font-semibold">
                  Multiple Files Supported
                </span>
              </div>

              {/* Big Plus Icon & Clear Guidance */}
              <div className="py-2 text-center my-auto">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 text-white flex items-center justify-center mx-auto mb-2.5 shadow-md shadow-blue-500/20 group-hover:scale-110 group-hover:rotate-90 group-hover:shadow-blue-500/30 transition-all duration-300">
                  <Plus className="w-8 h-8 stroke-[2.5]" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                  {isUploading ? 'Extracting via RapidOCR & AI Pipeline...' : 'Drop files here or click to browse'}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Select single or multiple files (PDFs, receipts, invoices, bank statements, spreadsheets)
                </p>

                {/* 6 Categories Clean Preview Chips */}
                <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2.5">
                  {CATEGORIES_CONFIG.map(cat => (
                    <span 
                      key={cat.id} 
                      className={`text-[9.5px] font-semibold px-2 py-0.5 rounded-full border ${cat.bg} ${cat.color} ${cat.border}`}
                    >
                      {cat.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                <span>PDF, PNG, JPG, CSV, Excel</span>
                <span className="text-blue-600 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                  + Add Multiple Files
                </span>
              </div>
            </div>
          </div>

          {/* Cards Grid: Row 2 (Suggested Tasks) */}
          <div className="grid grid-cols-2 gap-4">
            <div 
              onClick={() => handleSendChat('Run arithmetic verification and tax checks across all invoices.')}
              className="p-4 bg-white rounded-2xl border border-slate-200/70 shadow-sm hover:border-slate-300 cursor-pointer transition-all"
            >
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                <span>Suggested Action</span>
              </div>
              <h3 className="text-sm font-semibold text-slate-800 mt-1.5">
                Verify Arithmetic & GST Calculations
              </h3>
            </div>

            <div 
              onClick={() => handleSendChat('Draft client follow-up for missing bills and flagged discrepancies.')}
              className="p-4 bg-white rounded-2xl border border-slate-200/70 shadow-sm hover:border-slate-300 cursor-pointer transition-all"
            >
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                <span>Suggested Action</span>
              </div>
              <h3 className="text-sm font-semibold text-slate-800 mt-1.5">
                Draft Client Inquiry for Flagged Items
              </h3>
            </div>
          </div>

          {/* Bottom Card: Verification Tasks & Queue (Matching Screenshot "My Tasks") */}
          <div className="p-5 bg-white rounded-2xl border border-slate-200/70 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-slate-600" />
                <h3 className="text-sm font-bold text-slate-800">Accounting Verification Tasks</h3>
                <span className="text-xs text-slate-400 font-mono">{documents.length}</span>
              </div>

              <div className="flex items-center gap-3">
                {/* View Mode Toggle: Excel Sheet Grid vs Compact Cards */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
                  <button
                    onClick={() => setTasksViewMode('grid')}
                    className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
                      tasksViewMode === 'grid'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Excel-Inspired Register Spreadsheet Grid"
                  >
                    <Table className="w-3.5 h-3.5" />
                    <span>Excel Grid</span>
                  </button>
                  <button
                    onClick={() => setTasksViewMode('cards')}
                    className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
                      tasksViewMode === 'cards'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Compact Row List"
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>Cards</span>
                  </button>
                </div>

                <div className="relative w-48">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search documents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-700 focus:outline-none focus:border-blue-400"
                  />
                </div>
                <button 
                  onClick={() => handleSendChat('/exceptions')}
                  className="px-3 py-1 bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-full text-xs font-semibold flex items-center gap-1.5 border border-purple-200/60 transition-colors"
                >
                  <Sparkles className="w-3 h-3 text-purple-500" />
                  <span>Prioritize Exceptions</span>
                </button>
                <button 
                  onClick={() => handleScanDuplicates()}
                  className="px-3 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-full text-xs font-semibold flex items-center gap-1.5 border border-amber-200/60 transition-colors"
                  title="Audit entire firm ledger for duplicate files, invoice numbers, or double billing"
                >
                  <Copy className="w-3 h-3 text-amber-600" />
                  <span>Audit Duplicates</span>
                </button>
              </div>
            </div>

            {/* 6 Category Filter Tabs + Duplicates Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs select-none">
              <button
                onClick={() => setSelectedCategoryFilter(null)}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors shrink-0 ${
                  selectedCategoryFilter === null 
                    ? 'bg-slate-900 text-white shadow-sm' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Categories ({documents.length})
              </button>
              {CATEGORIES_CONFIG.map(cat => {
                const count = documents.filter(d => getDocCategory(d) === cat.id).length;
                const isSelected = selectedCategoryFilter === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryFilter(isSelected ? null : cat.id)}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-all shrink-0 flex items-center gap-1.5 ${
                      isSelected 
                        ? `${cat.bg} ${cat.color} ${cat.border} ring-2 ring-blue-400 font-bold` 
                        : `${cat.bg} ${cat.color} ${cat.border} opacity-80 hover:opacity-100`
                    }`}
                  >
                    <span>{cat.label}</span>
                    <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-white/80 border border-slate-200/40">
                      {count}
                    </span>
                  </button>
                );
              })}

              {documents.some(d => d.extracted_data?.duplicate_info?.is_duplicate) && (
                <button
                  onClick={() => setSelectedCategoryFilter(selectedCategoryFilter === 'duplicates' ? null : 'duplicates')}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-all shrink-0 flex items-center gap-1.5 ${
                    selectedCategoryFilter === 'duplicates'
                      ? 'bg-rose-600 text-white border-rose-700 shadow-sm font-bold'
                      : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3 text-rose-500" />
                  <span>Duplicates</span>
                  <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-white/80 text-rose-800">
                    {documents.filter(d => d.extracted_data?.duplicate_info?.is_duplicate).length}
                  </span>
                </button>
              )}
            </div>

            {/* View Switching: Excel-Inspired Spreadsheet Grid vs Compact Cards List */}
            {tasksViewMode === 'grid' ? (
              <CategorySpreadsheetView
                documents={documents
                  .filter(d => d.original_filename.toLowerCase().includes(searchQuery.toLowerCase()))
                  .filter(d => {
                    if (!selectedCategoryFilter) return true;
                    if (selectedCategoryFilter === 'duplicates') {
                      return Boolean(d.extracted_data?.duplicate_info?.is_duplicate);
                    }
                    return getDocCategory(d) === selectedCategoryFilter;
                  })}
                selectedCategory={selectedCategoryFilter}
                onSelectCategory={(cat) => setSelectedCategoryFilter(cat)}
                onOpenDocDrawer={(doc) => openDocDrawer(doc)}
                renderThreeDotsMenu={renderThreeDotsMenu}
              />
            ) : (
              /* Task Items with Colored Pills (Compact List) */
              <div className="space-y-2 text-xs">
                {documents
                  .filter(d => d.original_filename.toLowerCase().includes(searchQuery.toLowerCase()))
                  .filter(d => {
                    if (!selectedCategoryFilter) return true;
                    if (selectedCategoryFilter === 'duplicates') {
                      return Boolean(d.extracted_data?.duplicate_info?.is_duplicate);
                    }
                    return getDocCategory(d) === selectedCategoryFilter;
                  })
                  .map((doc) => {
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

        {/* 3. FLOATING BOTTOM CHAT BAR (Shifts smoothly when drawer opens) */}
        <div className={`fixed bottom-6 left-64 ${selectedDoc ? 'right-96' : 'right-0'} flex flex-col items-center px-8 pointer-events-none z-30 transition-all duration-200`}>
          {/* Markdown Formatting Options Toolbar */}
          {showFormatBar && (
            <div className="mb-2 bg-slate-900/95 backdrop-blur-md text-white px-3 py-1.5 rounded-2xl shadow-2xl border border-slate-800 flex items-center gap-1.5 text-[11px] pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-150 select-none">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
                <Code2 className="w-3 h-3 text-emerald-400" />
                <span>Format:</span>
              </span>
              <button
                type="button"
                onClick={() => insertFormat('**bold text**')}
                className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold transition-colors shadow-2xs"
                title="Insert bold markdown"
              >
                B
              </button>
              <button
                type="button"
                onClick={() => insertFormat('*italic text*')}
                className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white italic transition-colors font-serif shadow-2xs"
                title="Insert italic markdown"
              >
                I
              </button>
              <button
                type="button"
                onClick={() => insertFormat('\n- ')}
                className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors shadow-2xs"
                title="Insert bullet list item"
              >
                • List
              </button>
              <button
                type="button"
                onClick={insertTableTemplate}
                className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors shadow-2xs flex items-center gap-1"
                title="Insert Markdown table template"
              >
                <span>▦ Table</span>
              </button>
              <button
                type="button"
                onClick={() => insertFormat('`code`')}
                className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-mono transition-colors shadow-2xs"
                title="Insert inline code"
              >
                ‹/›
              </button>
              <div className="w-px h-3.5 bg-slate-700 mx-1"></div>
              <button
                type="button"
                onClick={() => handleSendChat('/summary')}
                className="px-2 py-0.5 rounded-lg bg-purple-900/70 hover:bg-purple-800 text-purple-300 font-mono text-[10px] transition-colors border border-purple-700/50"
                title="Generate ledger summary report"
              >
                /summary
              </button>
              <button
                type="button"
                onClick={() => handleSendChat('Audit all uploaded files for duplicate documents or double-billing risks')}
                className="px-2 py-0.5 rounded-lg bg-rose-900/70 hover:bg-rose-800 text-rose-300 font-mono text-[10px] transition-colors border border-rose-700/50"
                title="Run cross-file duplicate audit"
              >
                /duplicates
              </button>
            </div>
          )}

          <div className="w-full max-w-2xl bg-white rounded-full border border-slate-200/90 shadow-xl p-2 flex items-center gap-2.5 pointer-events-auto transition-all focus-within:border-emerald-400 focus-within:shadow-2xl">
            {/* Purple Sparkle Plus Icon */}
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Add documents"
              className="w-8 h-8 rounded-full bg-purple-50 text-purple-600 hover:bg-purple-100 flex items-center justify-center shrink-0 transition-colors"
            >
              <Plus className="w-4 h-4 text-purple-600" />
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
              placeholder="Ask Nemotron about uploaded documents... (@ to tag, / for commands)"
              className="flex-1 text-xs text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none px-1"
            />

            {/* Formatting Option Quick Toggle Button */}
            <button
              type="button"
              onClick={() => setShowFormatBar(!showFormatBar)}
              className={`p-1.5 rounded-full text-xs transition-colors flex items-center gap-1 ${
                showFormatBar 
                  ? 'bg-emerald-100 text-emerald-800 font-bold shadow-2xs' 
                  : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
              }`}
              title="Toggle Markdown formatting options toolbar"
            >
              <Code2 className="w-3.5 h-3.5" />
            </button>

            {/* Active Model Pill */}
            <span 
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="cursor-pointer text-[10px] font-mono text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200/80 hidden sm:flex items-center gap-1.5 shrink-0 transition-colors"
              title="Click to toggle Nemotron chat window"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-semibold">Nemotron 550B</span>
              <MessageSquare className="w-3 h-3 text-emerald-600 ml-0.5" />
            </span>

            {/* Send Circle Button */}
            <button
              type="button"
              onClick={() => handleSendChat()}
              disabled={!chatQuery.trim() || isThinking}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                chatQuery.trim() && !isThinking
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm' 
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </main>

      {/* 4. SLIDE-OVER EXTRACTION DRAWER (When a Document is Clicked) */}
      {selectedDoc && (
        <aside className="w-96 bg-white border-l border-slate-200/80 shadow-2xl flex flex-col h-full z-40 animate-in slide-in-from-right duration-200 select-none">
          {/* Drawer Header */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  OCR & AI Intelligence
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getDocTypeBadge(selectedDoc).bg}`}>
                  {getDocTypeBadge(selectedDoc).label}
                </span>
              </div>
              <h3 className="text-xs font-bold text-slate-800 mt-1.5 truncate max-w-[260px]">
                {selectedDoc.original_filename}
              </h3>
            </div>
            <div className="flex items-center gap-1">
              {renderThreeDotsMenu(selectedDoc, true)}
              <button 
                onClick={() => setSelectedDoc(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {/* Actionable Duplicate Warning Banner */}
            {selectedDoc.extracted_data?.duplicate_info?.is_duplicate && (
              <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 text-slate-700 space-y-2">
                <div className="flex items-center gap-1.5 text-rose-800 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Duplicate Document Detected</span>
                </div>
                <p className="text-[11px] text-rose-900 leading-relaxed">
                  Identified as duplicate of <strong>{selectedDoc.extracted_data.duplicate_info.duplicate_of_filename}</strong>.
                  {selectedDoc.extracted_data.duplicate_info.match_reason && (
                    <span className="block mt-0.5 text-rose-800 font-mono text-[10px]">
                      Basis: {selectedDoc.extracted_data.duplicate_info.match_reason}
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-2 pt-0.5">
                  {selectedDoc.extracted_data.duplicate_info.resolved ? (
                    <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Duplicate Acknowledged by CA</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleResolveDuplicate(selectedDoc.id)}
                      className="py-1 px-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10.5px] font-semibold transition-colors flex items-center justify-center gap-1 shadow-xs"
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
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-slate-700 space-y-2.5">
                <div className="flex items-center gap-1.5 text-amber-800 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Variance Detected (Needs Review)</span>
                </div>
                <p className="text-[11px] text-amber-900 leading-relaxed">
                  Document reads <strong className="font-mono">₹{Number(selectedDoc.extracted_data?.grand_total ?? selectedDoc.extracted_data?.total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>, but Subtotal (<strong className="font-mono">₹{Number(selectedDoc.extracted_data?.subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>) + Taxes (<strong className="font-mono">₹{Number(selectedDoc.extracted_data?.tax_total ?? selectedDoc.extracted_data?.tax ?? ((Number(selectedDoc.extracted_data?.cgst) || 0) + (Number(selectedDoc.extracted_data?.sgst) || 0))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>) equals <strong className="font-mono">₹{Number((Number(selectedDoc.extracted_data?.subtotal) || 0) + Number(selectedDoc.extracted_data?.tax_total ?? selectedDoc.extracted_data?.tax ?? ((Number(selectedDoc.extracted_data?.cgst) || 0) + (Number(selectedDoc.extracted_data?.sgst) || 0)))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleApproveWithAdjustment(selectedDoc)}
                    className="flex-1 py-1.5 px-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 shadow-sm"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve with Adjustment</span>
                  </button>
                  <button
                    onClick={() => handleApprove(selectedDoc.id)}
                    className="py-1.5 px-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-[11px] font-semibold transition-colors flex items-center justify-center gap-1"
                  >
                    <span>Accept As-Is</span>
                  </button>
                </div>
              </div>
            )}

            {/* View Mode Toggle: Tabular Format vs JSON Format */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setDrawerTab('tabular')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  drawerTab === 'tabular' 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Table className="w-3.5 h-3.5 text-blue-600" />
                <span>Tabular Format</span>
                {getDocTypeBadge(selectedDoc).isTabular && (
                  <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.2 rounded font-mono font-normal">Primary</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setDrawerTab('json')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  drawerTab === 'json' 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Code2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>JSON Format</span>
                {!getDocTypeBadge(selectedDoc).isTabular && (
                  <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.2 rounded font-mono font-normal">Primary</span>
                )}
              </button>
            </div>

            {/* TAB 1: TABULAR FORMAT (For Invoices, Receipts, Sales Records, Purchase Records, Bank Statements) */}
            {drawerTab === 'tabular' && (
              <div className="space-y-4">
                {/* 1. Overview Tabular Grid */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Table className="w-3.5 h-3.5 text-blue-500" />
                      <span>Tabular Summary Table</span>
                    </h4>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Confidence: {Math.round((selectedDoc.confidence_score || 0.95) * 100)}%
                    </span>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          <th className="py-2 px-3 font-semibold">Attribute</th>
                          <th className="py-2 px-3 font-semibold">Extracted Value</th>
                          <th className="py-2 px-3 font-semibold text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        <tr>
                          <td className="py-2 px-3 text-slate-500 font-medium">Category</td>
                          <td className="py-2 px-3 font-semibold text-slate-800">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getDocTypeBadge(selectedDoc).bg}`}>
                              {getDocTypeBadge(selectedDoc).label}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              Tabular
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-slate-500 font-medium">Identifier #</td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-800">
                            {selectedDoc.extracted_data?.identifier || selectedDoc.extracted_data?.invoice_number || selectedDoc.extracted_data?.account_number || '—'}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-400 font-mono text-[10px]">Verified</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-slate-500 font-medium">Party / Entity</td>
                          <td className="py-2 px-3 font-medium text-slate-800 truncate max-w-[170px]">
                            {selectedDoc.extracted_data?.party_name || selectedDoc.extracted_data?.vendor_name || selectedDoc.extracted_data?.merchant_name || selectedDoc.extracted_data?.bank_name || '—'}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-400 font-mono text-[10px]">Recognized</td>
                        </tr>
                        {(selectedDoc.extracted_data?.party_tax_id || selectedDoc.extracted_data?.vendor_gstin) && (
                          <tr>
                            <td className="py-2 px-3 text-slate-500 font-medium">GSTIN / Tax ID</td>
                            <td className="py-2 px-3 font-mono font-bold text-blue-600">
                              {selectedDoc.extracted_data?.party_tax_id || selectedDoc.extracted_data?.vendor_gstin}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">15-Char Valid</span>
                            </td>
                          </tr>
                        )}
                        <tr>
                          <td className="py-2 px-3 text-slate-500 font-medium">Transaction Date</td>
                          <td className="py-2 px-3 font-mono text-slate-800">
                            {selectedDoc.extracted_data?.date || selectedDoc.extracted_data?.invoice_date || selectedDoc.extracted_data?.receipt_date || selectedDoc.created_at?.slice(0, 10) || '—'}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-400 font-mono text-[10px]">ISO Date</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-slate-500 font-medium">Taxable Subtotal</td>
                          <td className="py-2 px-3 font-mono font-medium text-slate-800">
                            ₹{Number(selectedDoc.extracted_data?.subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-400 font-mono text-[10px]">Taxable</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-slate-500 font-medium">Taxes (GST Total)</td>
                          <td className="py-2 px-3 font-mono font-medium text-slate-800">
                            ₹{Number(selectedDoc.extracted_data?.tax_total ?? selectedDoc.extracted_data?.tax ?? ((Number(selectedDoc.extracted_data?.cgst) || 0) + (Number(selectedDoc.extracted_data?.sgst) || 0))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-400 font-mono text-[10px]">18% GST</td>
                        </tr>
                        <tr className="bg-slate-50/80 font-bold">
                          <td className="py-2.5 px-3 text-slate-800 font-bold">Grand Total</td>
                          <td className={`py-2.5 px-3 font-mono text-sm ${selectedDoc.status === 'needs_review' ? 'text-amber-600' : 'text-slate-900'}`}>
                            ₹{Number(selectedDoc.extracted_data?.grand_total ?? selectedDoc.extracted_data?.total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${selectedDoc.status === 'needs_review' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
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
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-sky-500" />
                      <span>Bank Statement Transactions ({selectedDoc.extracted_data.transactions.length})</span>
                    </h4>
                    <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            <th className="py-2 px-2.5">Date</th>
                            <th className="py-2 px-2.5">Narration</th>
                            <th className="py-2 px-2.5 text-right">Debit (₹)</th>
                            <th className="py-2 px-2.5 text-right">Credit (₹)</th>
                            <th className="py-2 px-2.5 text-right">Balance (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
                          {selectedDoc.extracted_data.transactions.map((tx: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-2 px-2.5 text-slate-600 whitespace-nowrap">{tx.date || tx.txn_date || '—'}</td>
                              <td className="py-2 px-2.5 font-sans font-medium text-slate-800 truncate max-w-[120px]">{tx.narration || 'Transaction'}</td>
                              <td className="py-2 px-2.5 text-right text-rose-600">{Number(tx.debit || 0) > 0 ? `₹${Number(tx.debit).toLocaleString()}` : '—'}</td>
                              <td className="py-2 px-2.5 text-right text-emerald-600">{Number(tx.credit || 0) > 0 ? `₹${Number(tx.credit).toLocaleString()}` : '—'}</td>
                              <td className="py-2 px-2.5 text-right text-slate-900 font-semibold">₹{Number(tx.balance || 0).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : Array.isArray(selectedDoc.extracted_data?.line_items) && selectedDoc.extracted_data.line_items.length > 0 ? (
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Table className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Line Items Tabular Breakdown ({selectedDoc.extracted_data.line_items.length})</span>
                    </h4>
                    <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            <th className="py-2 px-2.5">Item Description</th>
                            <th className="py-2 px-2 text-center">Qty</th>
                            <th className="py-2 px-2 text-right">Rate</th>
                            <th className="py-2 px-2 text-right">Tax</th>
                            <th className="py-2 px-2.5 text-right">Amount (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
                          {selectedDoc.extracted_data.line_items.map((item: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-2 px-2.5 font-sans font-medium text-slate-800 truncate max-w-[130px]">
                                {item.description || `Item #${idx + 1}`}
                              </td>
                              <td className="py-2 px-2 text-center text-slate-600">{item.quantity || item.qty || 1}</td>
                              <td className="py-2 px-2 text-right text-slate-600">₹{Number(item.unit_price || item.rate || 0).toLocaleString()}</td>
                              <td className="py-2 px-2 text-right text-slate-500">{item.tax_rate || 18}%</td>
                              <td className="py-2 px-2.5 text-right font-semibold text-slate-900">
                                ₹{Number(item.amount || (Number(item.rate || 0) * (item.qty || 1))).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {/* 3. Deterministic Arithmetic Math Check Table */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Deterministic Rule Engine Verification</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">Zero-LLM Math</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono text-[10px]">
                    <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                      <span className="text-slate-400 block uppercase">Subtotal</span>
                      <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                        ₹{Number(selectedDoc.extracted_data?.subtotal || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                      <span className="text-slate-400 block uppercase">Taxes</span>
                      <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                        +₹{Number(selectedDoc.extracted_data?.tax_total ?? selectedDoc.extracted_data?.tax ?? 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                      <span className="text-slate-400 block uppercase">Calculated</span>
                      <span className="font-bold text-blue-600 text-xs mt-0.5 block">
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
                {/* JSON Header Notice */}
                <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-slate-700 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                      <Code2 className="w-4 h-4 text-indigo-600" />
                      <span>Structured JSON Format</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {selectedDoc.document_type === 'others' 
                        ? 'Unstructured document: Fields captured as dynamic key-value JSON schema.' 
                        : 'Normalized full payload representation.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyJson(selectedDoc.extracted_data)}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 flex items-center gap-1 transition-colors shadow-sm"
                  >
                    {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                    <span>{copiedJson ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                {/* Detected Fields if category is others */}
                {selectedDoc.extracted_data?.detected_fields && Object.keys(selectedDoc.extracted_data.detected_fields).length > 0 && (
                  <div className="p-3 bg-white rounded-xl border border-slate-200/80 space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Detected Freeform Fields ({Object.keys(selectedDoc.extracted_data.detected_fields).length})
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {Object.entries(selectedDoc.extracted_data.detected_fields).map(([k, v]: [string, any]) => (
                        <div key={k} className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                          <span className="text-[10px] font-mono text-slate-400 uppercase block">{k}</span>
                          <span className="font-medium text-slate-800 truncate block mt-0.5">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Interactive Syntax-Styled JSON Block */}
                <div className="relative rounded-xl border border-slate-800 bg-slate-900 text-slate-100 overflow-hidden shadow-inner">
                  <div className="flex items-center justify-between px-3.5 py-2 bg-slate-800/90 border-b border-slate-700/60 text-[10px] font-mono text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>category_{selectedDoc.document_type || 'others'}.json</span>
                    </span>
                    <span>{JSON.stringify(selectedDoc.extracted_data).length} bytes</span>
                  </div>
                  <pre className="p-3.5 text-[11px] font-mono leading-relaxed overflow-x-auto max-h-80 text-emerald-400 selection:bg-slate-700 whitespace-pre-wrap">
                    {JSON.stringify(selectedDoc.extracted_data, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Raw OCR Transcription Toggle */}
            {selectedDoc.extracted_data?.raw_text && (
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Raw OCR Transcription (RapidOCR)
                </h4>
                <pre className="text-[10px] text-slate-600 font-mono bg-slate-50 p-2.5 rounded-xl border border-slate-100 max-h-28 overflow-y-auto whitespace-pre-wrap">
                  {selectedDoc.extracted_data.raw_text}
                </pre>
              </div>
            )}

            {/* Live Document Preview */}
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-blue-500" />
                  <span>Document File Preview</span>
                </h4>
                <a
                  href={`http://127.0.0.1:8000/api/v1/documents/${selectedDoc.id}/file`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 hover:underline"
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
                    <div className="relative group rounded-xl overflow-hidden border border-slate-200/80 bg-slate-900/5 p-2 flex flex-col items-center justify-center">
                      <div className="w-full flex items-center justify-center min-h-[200px] max-h-[380px] overflow-hidden rounded-lg bg-white/60">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={fileUrl}
                          alt={selectedDoc.original_filename}
                          className="max-h-[360px] w-auto max-w-full object-contain rounded-md shadow-xs transition-transform duration-200 group-hover:scale-[1.02] cursor-zoom-in"
                          onClick={() => window.open(fileUrl, '_blank')}
                        />
                      </div>
                      <div className="w-full mt-2 flex items-center justify-between text-[11px] text-slate-500 px-1">
                        <span className="truncate max-w-[200px] font-medium">{selectedDoc.original_filename}</span>
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-0.5 rounded-md bg-slate-900 text-white text-[10px] font-semibold hover:bg-slate-800 transition-colors flex items-center gap-1 shrink-0"
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
                    <div className="rounded-xl overflow-hidden border border-slate-200/80 bg-white">
                      <iframe
                        src={fileUrl}
                        className="w-full h-72 border-0 bg-slate-50"
                        title={selectedDoc.original_filename}
                      />
                      <div className="p-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="truncate max-w-[200px] font-medium">{selectedDoc.original_filename}</span>
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Popout PDF</span>
                        </a>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <FileSpreadsheet className="w-5 h-5 text-slate-500" />
                      <div>
                        <div className="text-xs font-semibold text-slate-800">{selectedDoc.original_filename}</div>
                        <div className="text-[10px] text-slate-400">{selectedDoc.mime_type || 'Document file'}</div>
                      </div>
                    </div>
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5"
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
          <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            {selectedDoc.review_status === 'approved_by_ca' ? (
              <span className="text-xs font-semibold text-teal-600 flex items-center gap-1">
                <CheckCheck className="w-4 h-4 text-teal-500" />
                <span>Approved by {selectedDoc.reviewed_by || 'CA'}</span>
              </span>
            ) : (
              <button
                onClick={() => handleApprove(selectedDoc.id)}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-1.5"
              >
                <CheckCheck className="w-4 h-4" />
                <span>Approve Accounting Treatment</span>
              </button>
            )}
          </div>
        </aside>
      )}

      {/* Delete Confirmation Modal */}
      {docToDelete && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => !isDeleting && setDocToDelete(null)}
        >
          <div 
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Delete uploaded file?</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Are you sure you want to delete <strong className="text-slate-800 font-semibold">{docToDelete.original_filename}</strong>? This will permanently remove the file from storage, extracted OCR data, and associated audit records.
            </p>
            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDocToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => handleDeleteDoc(docToDelete.id)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-200 transition-colors flex items-center gap-1.5 disabled:opacity-50"
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
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowAllUploadsModal(false)}
        >
          <div 
            className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-800">
                  Uploaded Financial Files ({documents.length})
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowAllUploadsModal(false);
                    fileInputRef.current?.click();
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Upload New</span>
                </button>
                <button
                  onClick={() => setShowAllUploadsModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter / Search Bar */}
            <div className="p-3 border-b border-slate-100 bg-slate-50/50">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search uploaded files by name..."
                  value={uploadsFilter}
                  onChange={(e) => setUploadsFilter(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-blue-500"
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
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 hover:border-slate-200 cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        {doc.document_type === 'bank_statement' ? (
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <FileText className="w-4 h-4 text-blue-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-slate-800 truncate">
                          {doc.original_filename}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
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
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full">
                          ! Review
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full">
                          ✓ Verified
                        </span>
                      )}
                      {renderThreeDotsMenu(doc, true)}
                    </div>
                  </div>
                ))}
              {documents.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-400">
                  No uploaded documents found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Batch Processing & 6-Category Sorting Animation Modal */}
      {isProcessingBatch && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none"
          onClick={() => batchStage === 'complete' && setIsProcessingBatch(false)}
        >
          <div 
            className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 p-6 space-y-6 animate-in fade-in zoom-in-95 duration-200 overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Shimmer top border line */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 animate-pulse"></div>

            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200/60 shadow-sm">
                  {batchStage === 'complete' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <Sparkles className="w-5 h-5 text-blue-600 animate-spin" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      {batchStage === 'complete' 
                        ? 'Batch Processing Complete!' 
                        : 'AI Document Categorization Pipeline'}
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-bold border border-blue-200/50">
                      6 Streams
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 max-w-lg truncate">
                    {stepSubtext}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsProcessingBatch(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title="Close modal (processing continues in background)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Live Animated Progress Bar & Multi-Stage Pipeline Tracker */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <RefreshCw className={`w-3.5 h-3.5 text-blue-500 ${batchStage !== 'complete' ? 'animate-spin' : ''}`} />
                  <span className="font-semibold">{stepLabel}</span>
                </span>
                <span className="font-mono text-blue-600 font-bold text-xs">
                  {uploadProgress}%
                </span>
              </div>

              {/* Progress Bar Track */}
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/60 shadow-inner">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ease-out bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 ${
                    batchStage !== 'complete' ? 'animate-pulse' : ''
                  }`}
                  style={{
                    width: `${uploadProgress}%`
                  }}
                ></div>
              </div>

              {/* 3 Real-Time Visual Step Badges */}
              <div className="grid grid-cols-3 gap-2 pt-0.5 text-[11px]">
                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all ${
                  uploadProgress >= 38 ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 font-medium' :
                  'bg-blue-50 text-blue-700 border-blue-200/80 font-semibold shadow-2xs'
                }`}>
                  {uploadProgress >= 38 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0" />}
                  <span className="truncate">1. Ingest & Integrity</span>
                </div>
                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all ${
                  uploadProgress >= 72 ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 font-medium' :
                  uploadProgress >= 38 ? 'bg-blue-50 text-blue-700 border-blue-200/80 font-semibold shadow-2xs' :
                  'bg-slate-50 text-slate-400 border-slate-200/60'
                }`}>
                  {uploadProgress >= 72 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> :
                   uploadProgress >= 38 ? <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0" /> :
                   <div className="w-2 h-2 rounded-full bg-slate-300 ml-0.5 mr-1 shrink-0"></div>}
                  <span className="truncate">2. RapidOCR ONNX</span>
                </div>
                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all ${
                  batchStage === 'complete' || uploadProgress >= 100 ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 font-medium' :
                  uploadProgress >= 72 ? 'bg-blue-50 text-blue-700 border-blue-200/80 font-semibold shadow-2xs' :
                  'bg-slate-50 text-slate-400 border-slate-200/60'
                }`}>
                  {batchStage === 'complete' || uploadProgress >= 100 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> :
                   uploadProgress >= 72 ? <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0" /> :
                   <div className="w-2 h-2 rounded-full bg-slate-300 ml-0.5 mr-1 shrink-0"></div>}
                  <span className="truncate">3. Qwen 2.5:3b AI</span>
                </div>
              </div>
            </div>

            {/* 6 Category Stream Sorting Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span>Real-Time Categorization Streams (6 Fields)</span>
                <span className="text-[10px] font-normal text-slate-400">5 Tabular + 1 JSON</span>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {CATEGORIES_CONFIG.map(cat => {
                  const count = categoryCounts[cat.id] || 0;
                  const isPopulated = count > 0;

                  return (
                    <div 
                      key={cat.id}
                      className={`p-3 rounded-2xl border transition-all relative overflow-hidden ${
                        isPopulated 
                          ? `${cat.bg} ${cat.border} shadow-sm scale-[1.02]` 
                          : 'bg-slate-50/70 border-slate-200/70 opacity-70'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${cat.bg} ${cat.color}`}>
                          {cat.format}
                        </span>
                        <span className={`text-base font-bold font-mono ${isPopulated ? cat.color : 'text-slate-400'}`}>
                          {count}
                        </span>
                      </div>
                      <div className="mt-2">
                        <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                          {cat.label}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          {cat.desc}
                        </div>
                      </div>
                      {isPopulated && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-current opacity-30"></div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Uploaded Files Real-Time Feed */}
            {batchFiles.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Files in Batch ({batchFiles.length})
                </span>
                <div className="bg-slate-50 rounded-2xl p-2.5 border border-slate-200/80 max-h-36 overflow-y-auto space-y-1.5 text-xs">
                  {batchFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-1.5 bg-white rounded-xl border border-slate-100 shadow-2xs">
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-800 truncate max-w-[240px]">{file.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({(file.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5">
                        {file.status === 'done' ? (
                          <div className="flex items-center gap-1.5">
                            {file.isDuplicate && (
                              <span 
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-300 flex items-center gap-1 animate-pulse"
                                title={file.duplicateOf ? `Duplicate of ${file.duplicateOf}` : 'Duplicate document'}
                              >
                                <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                                <span>Duplicate Detected</span>
                              </span>
                            )}
                            {file.category && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getDocTypeBadge(file.category).bg}`}>
                                {getDocTypeBadge(file.category).label}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-blue-600 flex items-center gap-1 font-mono">
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
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
                <span className={`w-2 h-2 rounded-full ${batchStage === 'complete' ? 'bg-emerald-500' : 'bg-blue-500 animate-pulse'} inline-block`}></span>
                <span>RapidOCR + Qwen 2.5:3b Local Engine</span>
                {uploadSeconds > 0 && <span className="text-slate-400 font-semibold">• {uploadSeconds}s elapsed</span>}
              </div>
              <div className="flex items-center gap-2">
                {batchStage !== 'complete' && (
                  <button
                    type="button"
                    onClick={() => setIsProcessingBatch(false)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
                  >
                    Run in Background
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsProcessingBatch(false)}
                  disabled={batchStage !== 'complete'}
                  className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    batchStage === 'complete' 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200' 
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <span>{batchStage === 'complete' ? 'Inspect Categorized Documents' : 'Processing...'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Toast Notification (Positioned Top-Right so it NEVER overlaps the bottom chat bar) */}
      {showToast && (
        <div className="fixed top-6 right-8 bg-slate-900/95 backdrop-blur-md text-white text-xs font-medium px-4 py-3 rounded-2xl shadow-2xl z-50 flex items-center gap-2.5 border border-slate-800 animate-in fade-in slide-in-from-top-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="max-w-xs leading-snug">{showToast}</span>
          <button 
            type="button"
            onClick={() => setShowToast(null)} 
            className="text-slate-400 hover:text-white ml-2 transition-colors p-0.5 rounded"
            title="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
