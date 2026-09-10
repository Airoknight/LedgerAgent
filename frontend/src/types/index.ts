export type DocumentStatus = 
  | 'queued' 
  | 'preprocessing' 
  | 'extracted' 
  | 'checks_passed' 
  | 'needs_review' 
  | 'quarantined' 
  | 'failed';

export type ReviewStatus = 'pending_review' | 'approved_by_ca' | 'rejected';

export type FinancialDocType = 
  | 'invoices'
  | 'receipts'
  | 'sales_records'
  | 'purchase_records'
  | 'bank_statements'
  | 'others'
  | 'purchase_invoice'
  | 'sales_invoice'
  | 'expense_receipt'
  | 'credit_note'
  | 'debit_note'
  | 'bank_statement'
  | 'payroll_register'
  | 'payroll_roster'
  | 'gstr_2b'
  | 'gstr_1'
  | 'purchase_order'
  | 'delivery_challan'
  | 'vendor_master'
  | 'customer_master'
  | 'unknown';

export interface DocumentItem {
  id: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  document_type: FinancialDocType;
  status: DocumentStatus;
  review_status: ReviewStatus;
  reviewed_by?: string;
  confidence_score: number;
  is_quarantined: boolean;
  quarantine_reason?: string;
  intake_message?: string;
  created_at: string;
  extracted_data: Record<string, any>;
  validation_results: Array<{
    rule: string;
    status: 'pass' | 'fail' | 'warning';
    message: string;
  }>;
}

export interface FinancialException {
  id: string;
  document_id?: string;
  exception_type: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  explanation: string;
  suggested_action?: string;
  status: 'open' | 'resolved' | 'dismissed' | 'client_followup_drafted';
  resolution_note?: string;
  resolved_by?: string;
  details: Record<string, any>;
  created_at: string;
}

export interface WorkspaceTab {
  id: string;
  title: string;
  type: 'invoice' | 'spreadsheet' | 'exception' | 'report' | 'inbox' | 'upload_history';
  documentId?: string;
  status?: 'checks_passed' | 'needs_review' | 'approved' | 'processing';
  isDirty?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  contextUsed?: string;
  actionType?: string;
  suggestedActions?: string[];
}

