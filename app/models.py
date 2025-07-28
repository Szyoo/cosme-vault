from sqlalchemy import Column, Integer, String
from .database import Base

class Prize(Base):
    __tablename__ = "prizes"

    id = Column(Integer, primary_key=True, index=True)
    text = Column(String, nullable=False)
