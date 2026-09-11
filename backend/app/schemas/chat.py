from typing import Optional, Dict, Any, List
from pydantic import BaseModel

class ChatQueryRequest(BaseModel):
    query: str
    active_tab_id: Optional[str] = None
    active_context: Optional[Dict[str, Any]] = None  # e.g. {"doc_id": "...", "doc_type": "purchase_invoice"}
    history: Optional[List[Dict[str, str]]] = None

class ChatQueryResponse(BaseModel):
    answer: str
    context_used: Optional[str] = None
    action_type: str = "text"  # text, report_preview, command_result
    data: Optional[Dict[str, Any]] = None
    suggested_actions: Optional[List[str]] = None
    model_used: Optional[str] = None


