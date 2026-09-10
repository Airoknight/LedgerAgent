import json
from sqlalchemy import Column, String, Integer, Float, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin, generate_uuid

class Document(Base, TimestampMixin):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    firm_id = Column(String(36), ForeignKey("firms.id"), nullable=False, index=True, default="default_firm")
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=True, index=True)
    business_id = Column(String(36), ForeignKey("business_accounts.id"), nullable=True, index=True)
    
    intake_batch_id = Column(String(36), nullable=True, index=True)
    intake_message = Column(String(500), nullable=True)
    
    storage_key = Column(String(255), unique=True, nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_hash = Column(String(64), index=True, nullable=False)  # SHA-256
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=False)
    page_count = Column(Integer, default=1, nullable=False)
    
    # Classification: purchase_invoice, sales_invoice, expense_receipt, bank_statement, etc.
    document_type = Column(String(50), default="unknown", nullable=False, index=True)
    
    # Automated status: queued, preprocessing, extracted, checks_passed, needs_review, quarantined, failed
    status = Column(String(50), default="queued", nullable=False, index=True)
    
    # Human CA status: pending_review, approved_by_ca, rejected
    review_status = Column(String(50), default="pending_review", nullable=False, index=True)
    reviewed_by = Column(String(255), nullable=True)
    reviewed_at = Column(String(50), nullable=True)
    
    confidence_score = Column(Float, default=1.0, nullable=False)
    is_quarantined = Column(Boolean, default=False, nullable=False)
    quarantine_reason = Column(String(255), nullable=True)

    # Serialized structured data and rule results
    extracted_data_json = Column(Text, default="{}", nullable=False)
    validation_results_json = Column(Text, default="[]", nullable=False)
    ocr_text = Column(Text, nullable=True)
    revision = Column(Integer, default=1, nullable=False)

    firm = relationship("Firm", back_populates="documents")
    organization = relationship("Organization", back_populates="documents")
    business = relationship("BusinessAccount", back_populates="documents")
    pages = relationship("DocumentPage", back_populates="document", cascade="all, delete-orphan")
    fields = relationship("ExtractedField", back_populates="document", cascade="all, delete-orphan")
    exceptions = relationship("FinancialException", back_populates="document", cascade="all, delete-orphan")
    extracted_records = relationship("ExtractedRecord", back_populates="document", cascade="all, delete-orphan")
    validation_exceptions = relationship("ValidationException", back_populates="document", cascade="all, delete-orphan")
    approvals = relationship("Approval", back_populates="document", cascade="all, delete-orphan")

    # Normalized canonical register relationships
    invoice_record = relationship("Invoice", back_populates="document", uselist=False, cascade="all, delete-orphan")
    receipt_record = relationship("Receipt", back_populates="document", uselist=False, cascade="all, delete-orphan")
    sales_record = relationship("SalesRecord", back_populates="document", uselist=False, cascade="all, delete-orphan")
    purchase_record = relationship("PurchaseRecord", back_populates="document", uselist=False, cascade="all, delete-orphan")
    bank_statement_record = relationship("BankStatement", back_populates="document", uselist=False, cascade="all, delete-orphan")
    other_document_record = relationship("OtherDocument", back_populates="document", uselist=False, cascade="all, delete-orphan")

    @property
    def extracted_data(self) -> dict:
        try:
            return json.loads(self.extracted_data_json)
        except Exception:
            return {}

    @extracted_data.setter
    def extracted_data(self, val: dict):
        self.extracted_data_json = json.dumps(val)

    @property
    def validation_results(self) -> list:
        try:
            return json.loads(self.validation_results_json)
        except Exception:
            return []

    @validation_results.setter
    def validation_results(self, val: list):
        self.validation_results_json = json.dumps(val)

class DocumentPage(Base, TimestampMixin):
    __tablename__ = "document_pages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False, index=True)
    page_number = Column(Integer, nullable=False)
    image_storage_key = Column(String(255), nullable=True)
    ocr_text = Column(Text, nullable=True)
    quality_score = Column(Float, default=1.0, nullable=False)

    document = relationship("Document", back_populates="pages")

class ExtractedField(Base, TimestampMixin):
    __tablename__ = "extracted_fields"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False, index=True)
    field_name = Column(String(100), nullable=False, index=True)
    raw_value = Column(Text, nullable=True)
    normalized_value = Column(Text, nullable=True)
    confidence = Column(Float, default=1.0, nullable=False)
    page_number = Column(Integer, default=1, nullable=False)
    # Bounding box coordinates in normalized percentages [x, y, w, h] (0 to 100)
    bbox_json = Column(String(255), nullable=True)

    document = relationship("Document", back_populates="fields")

