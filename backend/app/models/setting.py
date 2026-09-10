import json
from datetime import datetime, timezone
from sqlalchemy import Column, String, ForeignKey, Text, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base

class Setting(Base):
    __tablename__ = "settings"

    id = Column(String(36), primary_key=True)
    firm_id = Column(String(36), ForeignKey("firms.id"), nullable=False, index=True, default="default_firm")
    key = Column(String(100), nullable=False, index=True)
    value_json = Column(Text, default="{}", nullable=False)
    updated_by = Column(String(255), nullable=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    firm = relationship("Firm", back_populates="settings")

    @property
    def value(self):
        try:
            return json.loads(self.value_json)
        except Exception:
            return self.value_json

    @value.setter
    def value(self, val):
        self.value_json = json.dumps(val)

