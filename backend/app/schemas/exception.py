from typing import Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime

class ExceptionItem(BaseModel):
    id: str
    document_id: Optional[str] = None
    exception_type: str
    severity: str
    title: str
    explanation: str
    suggested_action: Optional[str] = None
    status: str
    resolution_note: Optional[str] = None
    resolved_by: Optional[str] = None
    details: Dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True

class ExceptionResolution(BaseModel):
    action: str  # resolve, dismiss, ask_client
    resolution_note: str

