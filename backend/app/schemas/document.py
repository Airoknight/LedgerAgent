from typing import Optional, List, Any, Dict
from pydantic import BaseModel
from datetime import datetime

class DocumentItem(BaseModel):
    id: str
    original_filename: str
    file_size: int
    mime_type: str
    document_type: str
    status: str
    review_status: str
    reviewed_by: Optional[str] = None
    confidence_score: float
    is_quarantined: bool
    quarantine_reason: Optional[str] = None
    intake_message: Optional[str] = None
    created_at: datetime
    extracted_data: Dict[str, Any]
    validation_results: List[Dict[str, Any]]
    ocr_text: Optional[str] = None
    revision: Optional[int] = 1

    class Config:
        from_attributes = True

class DocumentFieldUpdate(BaseModel):
    field_name: str
    updated_value: Any
    reason: Optional[str] = "Manual correction by CA"
    expected_revision: Optional[int] = None

class BatchUploadResponse(BaseModel):
    batch_id: str
    total_files: int
    accepted_files: int
    rejected_files: int
    duplicate_files: int
    documents: List[DocumentItem]

