"""
Double-Entry Accounting Models: Chart of Accounts, Journal Entries, and Journal Lines.
"""

import uuid
from datetime import datetime, date
from sqlalchemy import Column, String, Integer, Boolean, Text, Date, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Account(Base, TimestampMixin):
    """Chart of Accounts defining general ledger accounts."""
    __tablename__ = "chart_of_accounts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    firm_id = Column(String(36), ForeignKey("firms.id"), nullable=False, index=True, default="default_firm")

    code = Column(String(20), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    category = Column(String(50), nullable=False)  # asset, liability, equity, revenue, expense
    normal_balance = Column(String(10), nullable=False)  # debit, credit
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("firm_id", "code", name="uq_account_firm_code"),
    )


class JournalEntry(Base, TimestampMixin):
    """
    Journal Entry header representing a balanced financial transaction.
    Lifecycle: draft -> needs_mapping -> ready_for_review -> ca_approved -> posted
    """
    __tablename__ = "journal_entries"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    firm_id = Column(String(36), ForeignKey("firms.id"), nullable=False, index=True, default="default_firm")

    entry_number = Column(String(50), nullable=False, index=True)
    posting_date = Column(Date, nullable=False, default=date.today)
    
    # Source provenance
    source_type = Column(String(50), nullable=False)  # purchase_invoice, sales_invoice, bank_receipt, bank_payment, manual_adjustment
    source_id = Column(String(36), nullable=True, index=True)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=True, index=True)

    narration = Column(Text, nullable=False)
    status = Column(String(50), default="draft", nullable=False)  # draft, needs_mapping, ready_for_review, ca_approved, posted

    total_debit_paise = Column(Integer, nullable=False, default=0)
    total_credit_paise = Column(Integer, nullable=False, default=0)
    is_balanced = Column(Boolean, nullable=False, default=True)

    reviewer = Column(String(100), nullable=True)
    reviewed_at = Column(String(50), nullable=True)
    posted_at = Column(String(50), nullable=True)
    revision = Column(Integer, default=1, nullable=False)

    lines = relationship("JournalLine", back_populates="entry", cascade="all, delete-orphan", order_by="JournalLine.line_number")
    document = relationship("Document")


class JournalLine(Base, TimestampMixin):
    """
    Individual debit or credit line of a journal entry.
    """
    __tablename__ = "journal_lines"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    entry_id = Column(String(36), ForeignKey("journal_entries.id"), nullable=False, index=True)

    line_number = Column(Integer, nullable=False, default=1)
    account_code = Column(String(20), nullable=False, index=True)
    account_name = Column(String(255), nullable=False)

    # Sub-ledger tracking (Customer / Vendor party)
    subledger_type = Column(String(50), default="none", nullable=False)  # customer, vendor, none
    subledger_name = Column(String(255), nullable=True)

    debit_paise = Column(Integer, nullable=False, default=0)
    credit_paise = Column(Integer, nullable=False, default=0)

    # Tax metadata
    tax_rate_bps = Column(Integer, default=0, nullable=False)  # 1800 = 18%
    tax_type = Column(String(20), default="none", nullable=False)  # cgst, sgst, igst, none

    entry = relationship("JournalEntry", back_populates="lines")
