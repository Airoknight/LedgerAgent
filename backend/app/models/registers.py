"""
Normalized category-specific register tables for LedgerAgent.

Each document category gets its own typed table with fixed columns.
All monetary values stored as integer paise (never floating-point).
Raw OCR strings preserved in raw_values_json alongside normalized columns.
"""
import json
from sqlalchemy import Column, String, Integer, Date, Text, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin, generate_uuid


# ---------------------------------------------------------------------------
# 1. Invoice Register
# ---------------------------------------------------------------------------
class Invoice(Base, TimestampMixin):
    __tablename__ = "invoices"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False, index=True)
    firm_id = Column(String(36), ForeignKey("firms.id"), nullable=False, index=True, default="default_firm")

    invoice_subtype = Column(String(50), nullable=False, default="tax_invoice")  # tax_invoice, proforma, debit_note, credit_note
    invoice_number = Column(String(100), nullable=True, index=True)
    invoice_date = Column(Date, nullable=True)
    due_date = Column(Date, nullable=True)

    seller_name = Column(String(255), nullable=True)
    seller_gstin = Column(String(20), nullable=True)
    buyer_name = Column(String(255), nullable=True)
    buyer_gstin = Column(String(20), nullable=True)
    place_of_supply = Column(String(100), nullable=True)

    currency = Column(String(10), nullable=False, default="INR")
    subtotal_paise = Column(Integer, nullable=False, default=0)
    cgst_paise = Column(Integer, nullable=False, default=0)
    sgst_paise = Column(Integer, nullable=False, default=0)
    igst_paise = Column(Integer, nullable=False, default=0)
    total_tax_paise = Column(Integer, nullable=False, default=0)
    round_off_paise = Column(Integer, nullable=False, default=0)
    invoice_total_paise = Column(Integer, nullable=False, default=0)

    # Original OCR strings for every field: {"invoice_total": "Rs. 11,800/-", ...}
    raw_values_json = Column(Text, default="{}", nullable=False)

    document = relationship("Document", back_populates="invoice_record")
    firm = relationship("Firm")
    line_items = relationship("InvoiceLineItem", back_populates="invoice", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_invoices_seller_invno", "seller_name", "invoice_number"),
    )

    @property
    def raw_values(self) -> dict:
        try:
            return json.loads(self.raw_values_json)
        except Exception:
            return {}

    @raw_values.setter
    def raw_values(self, val: dict):
        self.raw_values_json = json.dumps(val)


# ---------------------------------------------------------------------------
# 2. Invoice Line Items
# ---------------------------------------------------------------------------
class InvoiceLineItem(Base, TimestampMixin):
    __tablename__ = "invoice_line_items"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    invoice_id = Column(String(36), ForeignKey("invoices.id"), nullable=False, index=True)

    line_number = Column(Integer, nullable=False, default=1)
    description = Column(Text, nullable=True)
    hsn_sac = Column(String(20), nullable=True)
    quantity_thousandths = Column(Integer, nullable=False, default=1000)  # qty * 1000 for precision
    unit_price_paise = Column(Integer, nullable=False, default=0)
    tax_rate_bps = Column(Integer, nullable=False, default=0)  # basis points: 18% = 1800
    amount_paise = Column(Integer, nullable=False, default=0)

    invoice = relationship("Invoice", back_populates="line_items")


# ---------------------------------------------------------------------------
# 3. Receipt Register
# ---------------------------------------------------------------------------
class Receipt(Base, TimestampMixin):
    __tablename__ = "receipts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False, index=True)
    firm_id = Column(String(36), ForeignKey("firms.id"), nullable=False, index=True, default="default_firm")

    receipt_number = Column(String(100), nullable=True)
    date = Column(Date, nullable=True)
    merchant_name = Column(String(255), nullable=True)
    merchant_gstin = Column(String(20), nullable=True)
    payment_method = Column(String(50), nullable=True)  # cash, upi, card, neft
    expense_category = Column(String(100), nullable=True)  # travel, meals, office, fuel
    description = Column(Text, nullable=True)

    currency = Column(String(10), nullable=False, default="INR")
    subtotal_paise = Column(Integer, nullable=False, default=0)
    tax_paise = Column(Integer, nullable=False, default=0)
    total_paise = Column(Integer, nullable=False, default=0)

    raw_values_json = Column(Text, default="{}", nullable=False)

    document = relationship("Document", back_populates="receipt_record")
    firm = relationship("Firm")

    @property
    def raw_values(self) -> dict:
        try:
            return json.loads(self.raw_values_json)
        except Exception:
            return {}

    @raw_values.setter
    def raw_values(self, val: dict):
        self.raw_values_json = json.dumps(val)


# ---------------------------------------------------------------------------
# 4. Sales Register
# ---------------------------------------------------------------------------
class SalesRecord(Base, TimestampMixin):
    __tablename__ = "sales_records"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False, index=True)
    firm_id = Column(String(36), ForeignKey("firms.id"), nullable=False, index=True, default="default_firm")

    source_row_number = Column(Integer, nullable=True)
    invoice_number = Column(String(100), nullable=True, index=True)
    invoice_date = Column(Date, nullable=True)
    customer_name = Column(String(255), nullable=True)
    customer_gstin = Column(String(20), nullable=True)

    currency = Column(String(10), nullable=False, default="INR")
    taxable_amount_paise = Column(Integer, nullable=False, default=0)
    cgst_paise = Column(Integer, nullable=False, default=0)
    sgst_paise = Column(Integer, nullable=False, default=0)
    igst_paise = Column(Integer, nullable=False, default=0)
    total_tax_paise = Column(Integer, nullable=False, default=0)
    invoice_total_paise = Column(Integer, nullable=False, default=0)

    raw_values_json = Column(Text, default="{}", nullable=False)

    document = relationship("Document", back_populates="sales_record")
    firm = relationship("Firm")

    @property
    def raw_values(self) -> dict:
        try:
            return json.loads(self.raw_values_json)
        except Exception:
            return {}

    @raw_values.setter
    def raw_values(self, val: dict):
        self.raw_values_json = json.dumps(val)


# ---------------------------------------------------------------------------
# 5. Purchase Register
# ---------------------------------------------------------------------------
class PurchaseRecord(Base, TimestampMixin):
    __tablename__ = "purchase_records"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False, index=True)
    firm_id = Column(String(36), ForeignKey("firms.id"), nullable=False, index=True, default="default_firm")

    source_row_number = Column(Integer, nullable=True)
    invoice_number = Column(String(100), nullable=True, index=True)
    invoice_date = Column(Date, nullable=True)
    vendor_name = Column(String(255), nullable=True)
    vendor_gstin = Column(String(20), nullable=True)

    currency = Column(String(10), nullable=False, default="INR")
    taxable_amount_paise = Column(Integer, nullable=False, default=0)
    cgst_paise = Column(Integer, nullable=False, default=0)
    sgst_paise = Column(Integer, nullable=False, default=0)
    igst_paise = Column(Integer, nullable=False, default=0)
    total_tax_paise = Column(Integer, nullable=False, default=0)
    invoice_total_paise = Column(Integer, nullable=False, default=0)

    raw_values_json = Column(Text, default="{}", nullable=False)

    document = relationship("Document", back_populates="purchase_record")
    firm = relationship("Firm")

    @property
    def raw_values(self) -> dict:
        try:
            return json.loads(self.raw_values_json)
        except Exception:
            return {}

    @raw_values.setter
    def raw_values(self, val: dict):
        self.raw_values_json = json.dumps(val)


# ---------------------------------------------------------------------------
# 6. Bank Statement (statement-level metadata)
# ---------------------------------------------------------------------------
class BankStatement(Base, TimestampMixin):
    __tablename__ = "bank_statements_register"  # avoid conflict with document_type name

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False, index=True)
    firm_id = Column(String(36), ForeignKey("firms.id"), nullable=False, index=True, default="default_firm")

    bank_name = Column(String(255), nullable=True)
    account_number_masked = Column(String(30), nullable=True)  # e.g. "XXXX4561"
    statement_start = Column(Date, nullable=True)
    statement_end = Column(Date, nullable=True)

    currency = Column(String(10), nullable=False, default="INR")
    opening_balance_paise = Column(Integer, nullable=False, default=0)
    closing_balance_paise = Column(Integer, nullable=False, default=0)

    raw_values_json = Column(Text, default="{}", nullable=False)

    document = relationship("Document", back_populates="bank_statement_record")
    firm = relationship("Firm")
    transactions = relationship("BankTransaction", back_populates="statement", cascade="all, delete-orphan")

    @property
    def raw_values(self) -> dict:
        try:
            return json.loads(self.raw_values_json)
        except Exception:
            return {}

    @raw_values.setter
    def raw_values(self, val: dict):
        self.raw_values_json = json.dumps(val)


# ---------------------------------------------------------------------------
# 7. Bank Transactions (row-level)
# ---------------------------------------------------------------------------
class BankTransaction(Base, TimestampMixin):
    __tablename__ = "bank_transactions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    statement_id = Column(String(36), ForeignKey("bank_statements_register.id"), nullable=False, index=True)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False, index=True)

    source_row_number = Column(Integer, nullable=True)
    transaction_date = Column(Date, nullable=True)
    value_date = Column(Date, nullable=True)
    description = Column(Text, nullable=True)
    reference = Column(String(100), nullable=True)

    currency = Column(String(10), nullable=False, default="INR")
    debit_paise = Column(Integer, nullable=False, default=0)
    credit_paise = Column(Integer, nullable=False, default=0)
    balance_paise = Column(Integer, nullable=False, default=0)

    statement = relationship("BankStatement", back_populates="transactions")
    document = relationship("Document")


# ---------------------------------------------------------------------------
# 8. Other Documents (flexible JSON — NOT forced into invoice shape)
# ---------------------------------------------------------------------------
class OtherDocument(Base, TimestampMixin):
    __tablename__ = "other_documents"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False, index=True)
    firm_id = Column(String(36), ForeignKey("firms.id"), nullable=False, index=True, default="default_firm")

    title = Column(String(255), nullable=True)
    summary = Column(Text, nullable=True)
    detected_fields_json = Column(Text, default="{}", nullable=False)

    document = relationship("Document", back_populates="other_document_record")
    firm = relationship("Firm")

    @property
    def detected_fields(self) -> dict:
        try:
            return json.loads(self.detected_fields_json)
        except Exception:
            return {}

    @detected_fields.setter
    def detected_fields(self, val: dict):
        self.detected_fields_json = json.dumps(val)
