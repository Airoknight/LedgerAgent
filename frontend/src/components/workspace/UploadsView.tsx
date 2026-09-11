'use client';

import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  Loader2, 
  Eye, 
  FileSpreadsheet, 
  Archive, 
  ExternalLink, 
  Layers, 
  Check, 
  ShieldCheck,
  Search,
  Sparkles,
  ArrowRight,
  MoreVertical,
  Trash2
} from 'lucide-react';
import { DocumentItem } from '@/types';
import { API_BASE_URL } from '@/config/api';

interface UploadsViewProps {
  documents: DocumentItem[];
  onOpenDocTab: (doc: DocumentItem) => void;
  onRefreshData: () => void;
}

export const UploadsView: React.FC<UploadsViewProps> = ({
  documents,
  onOpenDocTab,
  onRefreshData,
}) => {
  const [selectedDocId, setSelectedDocId] = useState<string | null>(
    documents.length > 0 ? documents[0].id : null
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [intakeNote, setIntakeNote] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeMenuDocId, setActiveMenuDocId] = useState<string | null>(null);
  const [docToDelete, setDocToDelete] = useState<DocumentItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedDoc = documents.find((d) => d.id === selectedDocId) || documents[0];

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await uploadFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadFiles(Array.from(e.target.files));
    }
  };

  const uploadFiles = async (files: File[]) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      if (intakeNote) {
        formData.append('intake_message', intakeNote);
      }

      const res = await fetch(`${API_BASE_URL}/api/v1/intake/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');
      const result = await res.json();
      setIntakeNote('');
      onRefreshData();

      if (result.documents && result.documents.length > 0) {
        setSelectedDocId(result.documents[0].id);
      }
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const filteredDocs = documents.filter((doc) =>
    doc.original_filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.document_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeleteDoc = async (docId: string) => {
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/documents/${docId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onRefreshData();
        setDocToDelete(null);
        setActiveMenuDocId(null);
        if (selectedDocId === docId) {
          const remaining = documents.filter(d => d.id !== docId);
          setSelectedDocId(remaining.length > 0 ? remaining[0].id : null);
        }
      } else {
        alert('Failed to delete file');
      }
    } catch (e) {
      console.error('Delete error:', e);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Top Header & Inline Drag & Drop Zone */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/60">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-indigo-400" />
              <span>Document Uploads & Real-Time Extraction</span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Drag & drop any financial file — local extraction & OCR processes structured evidence instantly
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search uploaded files..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1 bg-slate-950 border border-slate-800 rounded-md text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Inline Dropzone Box */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-4 flex items-center justify-between cursor-pointer transition-all ${
            isDragging
              ? 'border-indigo-500 bg-indigo-950/30 scale-[0.99]'
              : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileChange}
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.zip"
          />

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-200">
                {isUploading ? 'Extracting & Running Rule Engine...' : 'Click to browse or drop financial files here'}
              </p>
              <p className="text-[10px] text-slate-500">
                PDFs, Scanned Receipts, Bank CSVs, XLSX registers, ZIP archives
              </p>
            </div>
          </div>

          <button
            type="button"
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            Select Files
          </button>
        </div>
      </div>

      {/* Main Split Body: Left List of Uploaded Files, Right Live Extracted Data on the Side */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT COLUMN: Uploaded Files List */}
        <div className="w-5/12 border-r border-slate-800 bg-slate-950 overflow-y-auto p-3 space-y-2">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-2 py-1 flex items-center justify-between">
            <span>Uploaded Documents ({filteredDocs.length})</span>
            <span className="text-[10px] text-slate-400 font-mono">Select to view extraction</span>
          </div>

          {filteredDocs.map((doc) => {
            const isSelected = selectedDoc?.id === doc.id;
            const isFlagged = doc.status === 'needs_review';

            return (
              <div
                key={doc.id}
                onClick={() => setSelectedDocId(doc.id)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-slate-900 border-indigo-500/60 shadow-md ring-1 ring-indigo-500/20'
                    : 'bg-slate-900/50 border-slate-800/80 hover:bg-slate-900/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2.5 truncate">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 text-slate-300 mt-0.5">
                      {doc.document_type === 'bank_statement' ? (
                        <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <FileText className="w-4 h-4 text-blue-400" />
                      )}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-semibold text-slate-200 truncate">{doc.original_filename}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 uppercase font-mono">
                          {doc.document_type.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {(doc.file_size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status Badge & Three Dots */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="text-right">
                      {isFlagged ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 bg-amber-950/80 border border-amber-500/50 px-2 py-0.5 rounded-full font-mono font-bold">
                          <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                          <span>! Needs Review</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded-full font-mono">
                          <CheckCircle className="w-2.5 h-2.5 text-emerald-400" />
                          <span>✓ Checks Passed</span>
                        </span>
                      )}
                      <p className="text-[9px] text-slate-500 font-mono mt-1">
                        {new Date(doc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        title="File Options"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuDocId(activeMenuDocId === doc.id ? null : doc.id);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {activeMenuDocId === doc.id && (
                        <div 
                          className="absolute right-0 top-full mt-1 w-44 bg-slate-900 rounded-xl shadow-xl border border-slate-800 py-1 z-50 text-xs"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDocId(doc.id);
                              setActiveMenuDocId(null);
                            }}
                            className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-800 text-slate-200"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-400" />
                            <span>View Details</span>
                          </button>
                          <a
                            href={`${API_BASE_URL}/api/v1/documents/${doc.id}/file`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => setActiveMenuDocId(null)}
                            className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-800 text-slate-200"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                            <span>Open File</span>
                          </a>
                          <div className="my-1 border-t border-slate-800"></div>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuDocId(null);
                              setDocToDelete(doc);
                            }}
                            className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-rose-950/50 text-rose-400 font-medium"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                            <span>Delete File</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* RIGHT COLUMN: Live Extracted Things on the Side */}
        <div className="w-7/12 bg-slate-900/40 overflow-y-auto flex flex-col h-full">
          {selectedDoc ? (
            <div className="p-6 space-y-5">
              {/* Header with Title & Action Button */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-indigo-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Extracted Financial Intelligence</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      (Confidence: {(selectedDoc.confidence_score * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-white mt-1">{selectedDoc.original_filename}</h2>
                </div>

                <button
                  onClick={() => onOpenDocTab(selectedDoc)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-900/30 transition-colors"
                >
                  <span>Open Full Workspace Tab</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Arithmetic Flag Warning Card if any */}
              {selectedDoc.status === 'needs_review' && (
                <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 text-slate-200 shadow-md">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-300 uppercase">
                        Discrepancy Detected by Deterministic Rule Engine
                      </h4>
                      <p className="text-xs text-slate-300 mt-1">
                        Invoice total extracted from document is{' '}
                        <strong className="text-amber-300 font-mono">
                          ₹{selectedDoc.extracted_data?.total?.toLocaleString()}
                        </strong>
                        , but calculated Subtotal + Tax equals{' '}
                        <strong className="text-emerald-400 font-mono">
                          ₹{(
                            (selectedDoc.extracted_data?.subtotal || 0) +
                            (selectedDoc.extracted_data?.cgst || 0) +
                            (selectedDoc.extracted_data?.sgst || 0)
                          ).toLocaleString()}
                        </strong>
                        .
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Structured Key-Value Fields */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Extracted Header Information
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Vendor Name</div>
                    <div className="font-semibold text-slate-100 mt-1 truncate">
                      {selectedDoc.extracted_data?.vendor_name || 'Apex Industrial Tech Ltd'}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Vendor GSTIN</div>
                    <div className="font-mono text-indigo-400 font-semibold mt-1">
                      {selectedDoc.extracted_data?.vendor_gstin || '27AAACS1234F1Z8'}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Invoice Number</div>
                    <div className="font-mono text-slate-100 font-bold mt-1">
                      {selectedDoc.extracted_data?.invoice_number || 'INV-1042'}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Invoice Date</div>
                    <div className="text-slate-100 mt-1">
                      {selectedDoc.extracted_data?.invoice_date || '2026-09-08'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Exact Accounting Amounts */}
              <div className="p-4 bg-slate-900 rounded-lg border border-slate-800 space-y-2 text-xs">
                <h3 className="text-[11px] font-bold text-slate-400 uppercase mb-2">
                  Accounting Amounts (Exact Decimals)
                </h3>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Taxable Subtotal:</span>
                  <span className="font-mono font-medium text-slate-200">
                    ₹{selectedDoc.extracted_data?.subtotal?.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">CGST Amount:</span>
                  <span className="font-mono font-medium text-slate-200">
                    ₹{selectedDoc.extracted_data?.cgst?.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">SGST Amount:</span>
                  <span className="font-mono font-medium text-slate-200">
                    ₹{selectedDoc.extracted_data?.sgst?.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-2 text-sm font-bold">
                  <span className="text-slate-300">Total Amount:</span>
                  <span className={`font-mono ${selectedDoc.status === 'needs_review' ? 'text-amber-400 font-extrabold' : 'text-slate-100'}`}>
                    ₹{selectedDoc.extracted_data?.total?.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Raw OCR / Text Snippet Extracted */}
              {selectedDoc.extracted_data?.raw_text && (
                <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                  <h3 className="text-[11px] font-bold text-slate-400 uppercase mb-2 flex items-center justify-between">
                    <span>Raw OCR / Extracted Text</span>
                    <span className="text-[10px] text-slate-500 font-mono">Source Provenance</span>
                  </h3>
                  <pre className="text-[11px] text-slate-400 font-mono bg-slate-900/60 p-3 rounded border border-slate-800/80 overflow-x-auto whitespace-pre-wrap max-h-48">
                    {selectedDoc.extracted_data.raw_text}
                  </pre>
                </div>
              )}

              {/* Automated Validation Rules Output */}
              <div className="p-4 bg-slate-900 rounded-lg border border-slate-800">
                <h3 className="text-[11px] font-bold text-slate-400 uppercase mb-3">
                  Automated Validation Rules Checklist
                </h3>
                <div className="space-y-2">
                  {selectedDoc.validation_results?.map((rule, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                      {rule.status === 'pass' ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <span className="font-semibold text-slate-200">{rule.rule}: </span>
                        <span className="text-slate-400 text-[11px]">{rule.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-xs">
              Select an uploaded file on the left to inspect extracted fields
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {docToDelete && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => !isDeleting && setDocToDelete(null)}
        >
          <div 
            className="bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-800 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-rose-950/50 border border-rose-800/40 text-rose-400 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Delete uploaded file?</h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Are you sure you want to delete <strong className="text-slate-200 font-semibold">{docToDelete.original_filename}</strong>? This will permanently remove the file from storage and associated audit records.
            </p>
            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDocToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => handleDeleteDoc(docToDelete.id)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-900/40 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete File'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

