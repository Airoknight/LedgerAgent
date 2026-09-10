import json
from datetime import datetime, timezone
from sqlalchemy import Column, String, ForeignKey, Text, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import generate_uuid

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    firm_id = Column(String(36), ForeignKey("firms.id"), nullable=False, index=True, default="default_firm")
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    role = Column(String(20), nullable=False) # user, assistant, system
    content = Column(Text, nullable=False)
    context_json = Column(Text, default="{}", nullable=False)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    firm = relationship("Firm", back_populates="chat_messages")
    user = relationship("User", back_populates="chat_messages")

    @property
    def context(self) -> dict:
        try:
            return json.loads(self.context_json)
        except Exception:
            return {}

    @context.setter
    def context(self, val: dict):
        self.context_json = json.dumps(val)

