from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON
from sqlalchemy.sql import func
from database import Base

class Cargo(Base):
    __tablename__ = "cargos"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    tools_rbac = Column(JSON) # Ex: {"apps": ["google", "slack", "github"]}

class Device(Base):
    __tablename__ = "devices"
    
    id = Column(Integer, primary_key=True, index=True)
    serial = Column(String, unique=True, index=True)
    so_type = Column(String) # windows, macos, linux
    status = Column(String, default="active") # active, lost, locked
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    locked_at = Column(DateTime(timezone=True), nullable=True)

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    cargo_id = Column(Integer, ForeignKey("cargos.id"))
    device_id = Column(Integer, ForeignKey("devices.id"), unique=True)
    status = Column(String, default="active") # active, suspended

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    performed_by = Column(String)
    target_user = Column(String)
    action_type = Column(String) # onboarding, offboarding, device_lock
    details = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())