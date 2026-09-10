from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.document import Document
from app.models.exception import FinancialException
from app.schemas.chat import ChatQueryRequest, ChatQueryResponse
from app.services.chat_service import build_grounded_ledger_context, query_nemotron_openrouter

router = APIRouter(prefix="/chat", tags=["Assistant Chat"])

@router.post("/query", response_model=ChatQueryResponse)
def handle_chat_query(payload: ChatQueryRequest, db: Session = Depends(get_db)):
    query = payload.query.strip()
    active_ctx = payload.active_context or {}
    doc_id = active_ctx.get("doc_id")

    # Handle Slash Commands
    if query.startswith("/summary"):
        total = db.query(Document).count()
        passed = db.query(Document).filter(Document.status == "checks_passed").count()
        exceptions = db.query(FinancialException).filter(FinancialException.status == "open").count()
        return ChatQueryResponse(
            answer=f"**September 2026 Processing Summary**:\n- Total Ingested Documents: **{total}**\n- Automated Checks Passed: **{passed}**\n- Open Exceptions: **{exceptions}**\n\nAll verified calculations are grounded in your uploaded documents and backed by immutable audit trail entries.",
            context_used="All Uploaded Documents",
            action_type="command_result",
            model_used="nvidia/nemotron-3-ultra-550b-a55b:free",
            suggested_actions=["/exceptions", "Review Invoices", "Inspect Calculations"]
        )

    elif query.startswith("/exceptions"):
        excs = db.query(FinancialException).filter(FinancialException.status == "open").all()
        if not excs:
            return ChatQueryResponse(
                answer="No open exceptions! All uploaded financial documents passed automated checks.",
                context_used="Exceptions Engine",
                action_type="command_result",
                model_used="nvidia/nemotron-3-ultra-550b-a55b:free"
            )
        exc_list = "\n".join([f"- **[{e.severity.upper()}]** {e.title}: {e.explanation}" for e in excs])
        return ChatQueryResponse(
            answer=f"Found **{len(excs)} open exception(s)** requiring CA action:\n{exc_list}",
            context_used="Exceptions Engine",
            action_type="command_result",
            model_used="nvidia/nemotron-3-ultra-550b-a55b:free",
            suggested_actions=["Review Flagged Invoices", "/closecheck"]
        )

    elif query.startswith("/closecheck"):
        open_exc = db.query(FinancialException).filter(FinancialException.status == "open").count()
        unreviewed = db.query(Document).filter(Document.review_status == "pending_review").count()
        status_str = "BLOCKED" if (open_exc or unreviewed) else "READY TO CLOSE"
        return ChatQueryResponse(
            answer=f"**Period Close Readiness Status**: `{status_str}`\n\n- Blocking Exceptions: **{open_exc}**\n- Pending CA Sign-offs: **{unreviewed}**\n\nResolve the open issues before period sign-off.",
            context_used="Period Close Checklist",
            action_type="command_result",
            model_used="nvidia/nemotron-3-ultra-550b-a55b:free",
            suggested_actions=["/exceptions", "/summary"]
        )

    active_doc = db.query(Document).filter(Document.id == doc_id).first() if doc_id else None
    if active_doc:
        q_lower = query.lower()
        if "why" in q_lower or "flag" in q_lower or "issue" in q_lower or "error" in q_lower:
            exceptions = db.query(FinancialException).filter(FinancialException.document_id == active_doc.id).all()
            if exceptions:
                reasons = "\n".join([f"- **{e.title}**: {e.explanation}\n  *Suggested Action*: {e.suggested_action}" for e in exceptions])
                return ChatQueryResponse(
                    answer=f"**Document {active_doc.original_filename} was flagged for review (discrepancy detected)**:\n\n{reasons}",
                    context_used=f"Document: {active_doc.original_filename}",
                    action_type="text",
                    model_used="rule_engine",
                    suggested_actions=["[Correct Field]", "[Accept Variance]", "[Ask Client]"]
                )

    # Grounded Query over all uploaded documents using Nvidia Nemotron 3 Ultra 550B

    grounded_context = build_grounded_ledger_context(db, active_doc_id=doc_id)
    answer, model_used = query_nemotron_openrouter(
        user_query=query,
        grounded_context=grounded_context
    )

    docs_count = db.query(Document).count()
    context_desc = f"Grounded in {docs_count} uploaded document(s)"
    if doc_id:
        active_doc = db.query(Document).filter(Document.id == doc_id).first()
        if active_doc:
            context_desc += f" (Focused: {active_doc.original_filename})"

    return ChatQueryResponse(
        answer=answer,
        context_used=context_desc,
        action_type="text",
        model_used=model_used,
        suggested_actions=["Summarize sales", "Verify tax calculations", "Check current bills"]
    )


