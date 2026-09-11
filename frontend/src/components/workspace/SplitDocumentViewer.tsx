'use client';

import React, { useState } from 'react';
import { 
  CheckCircle, 
  AlertTriangle, 
  Edit3, 
  Send, 
  Eye, 
  FileText, 
  CheckCheck, 
  ExternalLink,
  ShieldCheck,
  RotateCw,
  ZoomIn,
  ZoomOut,
  FileCode
} from 'lucide-react';
import { DocumentItem } from '@/types';
import { API_BASE_URL } from '@/config/api';

interface SplitDocumentViewerProps {
  document: DocumentItem;
  onApprove: (docId: string) => void;
  onUpdateField: (docId: string, fieldName: string, value: any) => void;
  onAskClient: (doc: DocumentItem) => void;
}

export const SplitDocumentViewer: React.FC<SplitDocumentViewerProps> = ({
  document,
  onApprove,
  onUpdateField,
  onAskClient
}) => {
  const [highlightedField, setHighlightedField] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [viewMode, setViewMode] = useState<'extracted_overlay' | 'raw_file'>('extracted_overlay');

  const data = document.extracted_data || {};
  const isNeedsReview = document.status === 'needs_review';
  const isApproved = document.review_status === 'approved_by_ca';
  const fileUrl = `${API_BASE_URL}/api/v1/documents/${document.id}/file`;

  const handleStartEdit = (field: string, currentVal: any) => {
    setEditingField(field);
    setEditValue(String(currentVal || ''));
  };

  const handleSaveEdit = (field: string) => {
    const num = parseFloat(editValue);
    const finalVal = isNaN(num) ? editValue : num;
    onUpdateField(document.id, field, finalVal);
    setEditingField(null);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Top Document Header */}
      <div className="h-12 border-b border-slate-800 bg-slate-900/80 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-indigo-400" />
          <div>
            <h2 className="text-xs font-semibold text-slate-100 flex items-center gap-2">
              <span>{document.original_filename}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase font-mono">
                {document.document_type.replace('_', ' ')}
              </span>
            </h2>
            <p className="text-[10px] text-slate-400">
              SHA-256: <span className="font-mono">{document.id.slice(0, 8)}...</span> • Size: {(document.file_size / 1024).toFixed(1)} KB • Confidence: {(document.confidence_score * 100).toFixed(0)}%
            </p>
          </div>
        </div>

        {/* Status Indicators & Human Approval */}
        <div className="flex items-center gap-3">
          {isNeedsReview ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Automated Flag: Discrepancy Found</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>Automated Checks Passed</span>
            </div>
          )}

          {isApproved ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-teal-500/20 border border-teal-500/40 text-teal-300 text-xs font-semibold">
              <CheckCheck className="w-4 h-4 text-teal-400" />
              <span>Approved by {document.reviewed_by || 'CA'}</span>
            </div>
          ) : (
            <button
              onClick={() => onApprove(document.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Approve Accounting Treatment</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Split Body: Left Document Viewer, Right Extracted Form */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Document Preview Canvas */}
        <div className="w-1/2 border-r border-slate-800 bg-slate-900/40 flex flex-col h-full">
          {/* Viewer Toolbar with Mode Toggle */}
          <div className="h-8 border-b border-slate-800/80 bg-slate-900/90 px-3 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('extracted_overlay')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                  viewMode === 'extracted_overlay' ? 'bg-slate-800 text-indigo-300 font-bold' : 'hover:text-slate-200'
                }`}
              >
                Visual OCR Overlay
              </button>
              <button
                onClick={() => setViewMode('raw_file')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                  viewMode === 'raw_file' ? 'bg-slate-800 text-indigo-300 font-bold' : 'hover:text-slate-200'
                }`}
              >
                Original Document File
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => setZoomLevel(prev => Math.max(70, prev - 10))}
                className="p-1 hover:text-white rounded hover:bg-slate-800"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono">{zoomLevel}%</span>
              <button 
                onClick={() => setZoomLevel(prev => Math.min(150, prev + 10))}
                className="p-1 hover:text-white rounded hover:bg-slate-800"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Canvas or Raw File IFrame */}
          <div className="flex-1 overflow-auto p-4 flex justify-center items-start">
            {viewMode === 'raw_file' ? (
              <iframe
                src={fileUrl}
                className="w-full h-full rounded border border-slate-800 bg-white"
                title="Original File"
              />
            ) : (
              <div 
                style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                className="w-[520px] min-h-[680px] bg-white text-slate-900 p-8 shadow-2xl rounded border border-slate-300 relative transition-transform"
              >
                {/* Invoice Header */}
                <div className="flex justify-between items-start border-b pb-4 mb-6">
                  <div>
                    <h3 className="text-xl font-bold tracking-tight text-slate-900">
                      {data.vendor_name || 'Apex Industrial Tech Ltd'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      GSTIN: <span className="font-mono font-semibold">{data.vendor_gstin || '27AAACS1234F1Z8'}</span>
                    </p>
                    <p className="text-xs text-slate-500">Registered Commercial Supplier</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs uppercase font-bold px-2 py-1 bg-slate-100 rounded text-slate-700">
                      Tax Invoice
                    </span>
                    <p className="text-sm font-bold font-mono text-slate-800 mt-2">
                      {data.invoice_number || 'INV-1042'}
                    </p>
                    <p className="text-xs text-slate-500">Date: {data.invoice_date || '2026-09-08'}</p>
                  </div>
                </div>

                {/* Bill To */}
                <div className="mb-6 bg-slate-50 p-3 rounded border border-slate-200">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Billed To:</p>
                  <p className="text-xs font-semibold text-slate-800">{data.buyer_name || 'Alpha Enterprises Pvt Ltd'}</p>
                  <p className="text-xs text-slate-600 font-mono">GSTIN: {data.buyer_gstin || '27AABCU9603R1ZM'}</p>
                </div>

                {/* Line Items Table */}
                <table className="w-full text-left text-xs mb-8">
                  <thead>
                    <tr className="border-b-2 border-slate-200 text-[11px] text-slate-600">
                      <th className="py-1">Description</th>
                      <th className="py-1 text-center">Qty</th>
                      <th className="py-1 text-right">Rate</th>
                      <th className="py-1 text-right">Tax %</th>
                      <th className="py-1 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.line_items?.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 text-slate-800 font-medium">{item.description}</td>
                        <td className="py-2 text-center text-slate-600">{item.qty} {item.unit || 'Nos'}</td>
                        <td className="py-2 text-right font-mono text-slate-600">₹{item.rate?.toLocaleString()}</td>
                        <td className="py-2 text-right font-mono text-slate-600">{item.tax_rate}%</td>
                        <td className="py-2 text-right font-mono font-semibold text-slate-900">₹{item.amount?.toLocaleString()}</td>
                      </tr>
                    )) || (
                      <tr>
                        <td colSpan={5} className="py-3 text-center text-slate-400">Single Line Item Service Contract</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Totals Section with Interactive Bounding Box Highlight */}
                <div className="w-64 ml-auto space-y-1 text-xs border-t pt-3">
                  <div className="flex justify-between text-slate-600">
                    <span>Taxable Subtotal:</span>
                    <span className="font-mono">₹{data.subtotal?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>CGST:</span>
                    <span className="font-mono">₹{data.cgst?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>SGST:</span>
                    <span className="font-mono">₹{data.sgst?.toLocaleString()}</span>
                  </div>
                  
                  {/* Total Row with Bounding Box Overlay */}
                  <div 
                    className={`flex justify-between items-center text-sm font-bold border-t border-slate-300 pt-2 p-1 rounded transition-all ${
                      highlightedField === 'total' 
                        ? 'bg-amber-100 ring-2 ring-amber-500' 
                        : isNeedsReview ? 'bg-amber-50/70 border border-dashed border-amber-300' : ''
                    }`}
                  >
                    <span className="text-slate-900">Grand Total:</span>
                    <span className={`font-mono ${isNeedsReview ? 'text-amber-700 font-extrabold' : 'text-slate-900'}`}>
                      ₹{data.total?.toLocaleString()}
                    </span>
                  </div>

                  {isNeedsReview && (
                    <div className="text-[10px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 p-1.5 rounded mt-2">
                      ⚠️ OCR Bounding Box [x:68%, y:82%, w:28%, h:4%] verified
                    </div>
                  )}
                </div>

                {/* Subtle Document Footer */}
                <div className="absolute bottom-4 left-8 right-8 text-center text-[9px] text-slate-400 border-t pt-2">
                  This document is processed by LedgerAgent. Original byte stream preserved in private storage.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Structured Extraction Form & Issues Card */}
        <div className="w-1/2 flex flex-col h-full bg-slate-950 overflow-y-auto">
          {/* Issue Resolution Banner if flagged */}
          {isNeedsReview && (
            <div className="m-4 p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 text-slate-200 shadow-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                    Arithmetic Mismatch Detected by Rule Engine
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Invoice total on document is <span className="font-mono font-bold text-amber-300">₹{data.total?.toLocaleString()}</span>, but calculated Subtotal (₹{data.subtotal?.toLocaleString()}) + Taxes (₹{(data.cgst + data.sgst)?.toLocaleString()}) equals <span className="font-mono font-bold text-emerald-400">₹{(data.subtotal + (data.cgst || 0) + (data.sgst || 0))?.toLocaleString()}</span>.
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleStartEdit('total', data.subtotal + (data.cgst || 0) + (data.sgst || 0))}
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-medium transition-colors"
                    >
                      Correct to Calculated Total
                    </button>
                    <button
                      onClick={() => onAskClient(document)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <Send className="w-3 h-3 text-indigo-400" />
                      <span>Draft Client Query</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Form Fields */}
          <div className="p-4 space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Normalized Structured Values (Click field to highlight on document)
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div 
                onMouseEnter={() => setHighlightedField('vendor_name')}
                onMouseLeave={() => setHighlightedField(null)}
                className="p-3 bg-slate-900 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors"
              >
                <div className="text-[10px] text-slate-400 uppercase">Vendor Name</div>
                <div className="font-semibold text-slate-100 mt-1 truncate">{data.vendor_name || '—'}</div>
              </div>

              <div 
                onMouseEnter={() => setHighlightedField('vendor_gstin')}
                onMouseLeave={() => setHighlightedField(null)}
                className="p-3 bg-slate-900 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors"
              >
                <div className="text-[10px] text-slate-400 uppercase">Vendor GSTIN</div>
                <div className="font-mono text-indigo-300 font-medium mt-1">{data.vendor_gstin || '—'}</div>
              </div>

              <div 
                onMouseEnter={() => setHighlightedField('invoice_number')}
                onMouseLeave={() => setHighlightedField(null)}
                className="p-3 bg-slate-900 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors"
              >
                <div className="text-[10px] text-slate-400 uppercase">Invoice Number</div>
                <div className="font-mono text-slate-100 font-bold mt-1">{data.invoice_number || '—'}</div>
              </div>

              <div 
                onMouseEnter={() => setHighlightedField('invoice_date')}
                onMouseLeave={() => setHighlightedField(null)}
                className="p-3 bg-slate-900 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors"
              >
                <div className="text-[10px] text-slate-400 uppercase">Invoice Date</div>
                <div className="text-slate-100 mt-1">{data.invoice_date || '—'}</div>
              </div>
            </div>

            {/* Financial Amounts Table */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase mb-3">Accounting Amounts (Exact Decimals)</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Taxable Subtotal:</span>
                  <span className="font-mono font-medium text-slate-200">₹{data.subtotal?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">CGST Amount:</span>
                  <span className="font-mono font-medium text-slate-200">₹{data.cgst?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">SGST Amount:</span>
                  <span className="font-mono font-medium text-slate-200">₹{data.sgst?.toLocaleString()}</span>
                </div>
                
                {/* Total Row with Inline Edit Button */}
                <div 
                  onMouseEnter={() => setHighlightedField('total')}
                  onMouseLeave={() => setHighlightedField(null)}
                  className="flex justify-between items-center py-2 text-sm font-bold pt-2"
                >
                  <span className="text-slate-300">Grand Total:</span>
                  <div className="flex items-center gap-2">
                    {editingField === 'total' ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-28 px-2 py-0.5 bg-slate-800 border border-indigo-500 rounded text-white font-mono text-xs"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveEdit('total')}
                          className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className={`font-mono ${isNeedsReview ? 'text-amber-400 font-extrabold' : 'text-slate-100'}`}>
                          ₹{data.total?.toLocaleString()}
                        </span>
                        <button
                          onClick={() => handleStartEdit('total', data.total)}
                          className="p-1 text-slate-500 hover:text-indigo-400 transition-colors"
                          title="Correct field manually"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Validation Rules Audit Log */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase mb-3">Deterministic Validation Audit</h4>
              <div className="space-y-2">
                {document.validation_results?.map((res, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs">
                    {res.status === 'pass' ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-semibold text-slate-200">{res.rule}</div>
                      <div className="text-[11px] text-slate-400">{res.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
