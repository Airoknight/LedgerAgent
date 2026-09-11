"""
Enterprise Role-Based Access Control (RBAC) & Centralized Tenant Authorization.
"""

from enum import Enum
from typing import Set, Optional, Dict, Any
from fastapi import Depends, HTTPException, Header, Query, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.organization import User, BusinessAccount
from app.models.firm import Firm
from app.models.session import SessionRecord
from app.api.v1.auth import get_current_session, get_current_user


class Permission(str, Enum):
    ORG_ADMIN = "org:admin"
    CLIENT_CREATE = "client:create"
    CLIENT_ACCESS = "client:access"
    DOCUMENT_UPLOAD = "document:upload"
    DOCUMENT_DOWNLOAD = "document:download"
    RECORD_EDIT = "record:edit"
    EXCEPTION_OVERRIDE = "exception:override"
    RECONCILE_RUN = "reconcile:run"
    ACCOUNT_MAP = "account:map"
    CA_APPROVE = "ca:approve"
    JOURNAL_POST = "journal:post"
    REPORT_VIEW = "report:view"
    EXPORT_DATA = "export:data"
    AUDIT_VIEW = "audit:view"
    USER_MANAGE = "user:manage"


class Role(str, Enum):
    PLATFORM_ADMIN = "platform_admin"
    ORGANIZATION_ADMIN = "organization_admin"
    CA_REVIEWER = "ca_reviewer"
    ACCOUNTANT = "accountant"
    DOCUMENT_UPLOADER = "document_uploader"
    READ_ONLY_AUDITOR = "read_only_auditor"


# Role-to-Permissions Mapping
ROLE_PERMISSIONS: Dict[str, Set[Permission]] = {
    Role.PLATFORM_ADMIN.value: set(Permission),
    
    Role.ORGANIZATION_ADMIN.value: {
        Permission.ORG_ADMIN,
        Permission.CLIENT_CREATE,
        Permission.CLIENT_ACCESS,
        Permission.DOCUMENT_UPLOAD,
        Permission.DOCUMENT_DOWNLOAD,
        Permission.RECORD_EDIT,
        Permission.EXCEPTION_OVERRIDE,
        Permission.RECONCILE_RUN,
        Permission.ACCOUNT_MAP,
        Permission.CA_APPROVE,
        Permission.JOURNAL_POST,
        Permission.REPORT_VIEW,
        Permission.EXPORT_DATA,
        Permission.AUDIT_VIEW,
        Permission.USER_MANAGE,
    },
    
    Role.CA_REVIEWER.value: {
        Permission.CLIENT_ACCESS,
        Permission.DOCUMENT_UPLOAD,
        Permission.DOCUMENT_DOWNLOAD,
        Permission.RECORD_EDIT,
        Permission.EXCEPTION_OVERRIDE,
        Permission.RECONCILE_RUN,
        Permission.ACCOUNT_MAP,
        Permission.CA_APPROVE,
        Permission.JOURNAL_POST,
        Permission.REPORT_VIEW,
        Permission.EXPORT_DATA,
        Permission.AUDIT_VIEW,
    },
    
    Role.ACCOUNTANT.value: {
        Permission.CLIENT_ACCESS,
        Permission.DOCUMENT_UPLOAD,
        Permission.DOCUMENT_DOWNLOAD,
        Permission.RECORD_EDIT,
        Permission.RECONCILE_RUN,
        Permission.ACCOUNT_MAP,
        Permission.REPORT_VIEW,
        Permission.EXPORT_DATA,
    },
    
    Role.DOCUMENT_UPLOADER.value: {
        Permission.CLIENT_ACCESS,
        Permission.DOCUMENT_UPLOAD,
        Permission.DOCUMENT_DOWNLOAD,
    },
    
    Role.READ_ONLY_AUDITOR.value: {
        Permission.CLIENT_ACCESS,
        Permission.DOCUMENT_DOWNLOAD,
        Permission.REPORT_VIEW,
        Permission.AUDIT_VIEW,
    },
}

# Legacy Role Aliases for 100% Backward Compatibility
LEGACY_ROLE_MAP: Dict[str, str] = {
    "ca_admin": Role.ORGANIZATION_ADMIN.value,
    "admin": Role.ORGANIZATION_ADMIN.value,
    "bookkeeper": Role.ACCOUNTANT.value,
    "uploader": Role.DOCUMENT_UPLOADER.value,
    "reviewer": Role.READ_ONLY_AUDITOR.value,
    "auditor": Role.READ_ONLY_AUDITOR.value,
}


def normalize_role(raw_role: str) -> str:
    """Maps legacy or case-variant role strings to canonical enterprise roles."""
    cleaned = (raw_role or "").lower().strip()
    return LEGACY_ROLE_MAP.get(cleaned, cleaned)


def has_permission(role: str, permission: Permission) -> bool:
    """Verifies whether the given role holds the requested permission."""
    canonical_role = normalize_role(role)
    perms = ROLE_PERMISSIONS.get(canonical_role, set())
    return permission in perms


class TenantContext:
    """Encapsulates authenticated tenant scope and caller permissions."""
    def __init__(
        self,
        organization_id: str,
        client_id: str,
        user: User,
        session: SessionRecord,
        role: str,
        permissions: Set[Permission]
    ):
        self.organization_id = organization_id
        self.client_id = client_id
        self.user = user
        self.session = session
        self.role = role
        self.permissions = permissions

    def require(self, permission: Permission) -> None:
        if permission not in self.permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: Insufficient privileges. Required permission '{permission.value}'."
            )


def get_current_tenant_context(
    request: Request,
    x_client_id: Optional[str] = Header(None, alias="X-Client-ID"),
    client_id_param: Optional[str] = Query(None, alias="client_id"),
    session: SessionRecord = Depends(get_current_session),
    db: Session = Depends(get_db)
) -> TenantContext:
    """
    Centralized tenant resolution & authorization dependency.
    Validates:
      1. Authenticated user & active session
      2. Organization resolution from session (firm_id)
      3. Client validation & cross-tenant isolation enforcement
      4. Attached permissions according to assigned role
    """
    user = session.user
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or inactive user account.")

    org_id = session.firm_id or "default_firm"

    # Requested client ID resolution
    target_client_id = x_client_id or client_id_param

    if target_client_id:
        # Cross-tenant IDOR check: Verify the client belongs to the user's organization
        client = db.query(BusinessAccount).filter(BusinessAccount.id == target_client_id).first()
        if not client:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client account not found.")
        # If client has firm_id/organization_id, ensure it matches
        if hasattr(client, "firm_id") and client.firm_id and client.firm_id != org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Client does not belong to authorized organization."
            )
        active_client_id = client.id
    else:
        # Resolve or seed default business account for the organization
        default_biz = db.query(BusinessAccount).first()
        active_client_id = default_biz.id if default_biz else "default_business"

    canonical_role = normalize_role(user.role)
    user_perms = ROLE_PERMISSIONS.get(canonical_role, set())

    return TenantContext(
        organization_id=org_id,
        client_id=active_client_id,
        user=user,
        session=session,
        role=canonical_role,
        permissions=user_perms
    )


def require_permission(permission: Permission):
    """Factory dependency for declarative endpoint authorization."""
    def dependency(context: TenantContext = Depends(get_current_tenant_context)) -> TenantContext:
        context.require(permission)
        return context
    return dependency
