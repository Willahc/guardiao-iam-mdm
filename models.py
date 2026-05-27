import uuid

from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, JSON
from sqlalchemy.sql import func

from database import Base


class Empresa(Base):
    __tablename__ = "empresas"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    plano = Column(String, default="free")
    ativo = Column(Boolean, default=True)
    criado_em = Column(DateTime(timezone=True), server_default=func.now())


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id"), nullable=False)
    nome = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    senha_hash = Column(String, nullable=False)
    departamento = Column(String, nullable=True)
    role = Column(String, default="user")
    ativo = Column(Boolean, default=True)


class RegistroAcesso(Base):
    __tablename__ = "registros_acesso"

    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id"), nullable=True)
    email = Column(String, index=True)
    setor = Column(String)
    status = Column(String, default="ATIVO")
    criado_em = Column(DateTime(timezone=True), server_default=func.now())


class Cargo(Base):
    __tablename__ = "cargos"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    tools_rbac = Column(JSON)


class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    serial = Column(String, unique=True, index=True)
    so_type = Column(String)
    status = Column(String, default="active")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    locked_at = Column(DateTime(timezone=True), nullable=True)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    cargo_id = Column(Integer, ForeignKey("cargos.id"))
    device_id = Column(Integer, ForeignKey("devices.id"), unique=True)
    status = Column(String, default="active")


class TicketTarefa(Base):
    __tablename__ = "tickets_tarefa"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    empresa_id = Column(Integer, ForeignKey("empresas.id"), nullable=False)
    colaborador_nome = Column(String, nullable=False)
    colaborador_email = Column(String, nullable=False)
    tipo = Column(String, nullable=False)
    sistema = Column(String, nullable=False)
    instrucoes = Column(String, nullable=False)
    status = Column(String, default="ABERTO")
    criado_em = Column(DateTime(timezone=True), server_default=func.now())
    fechado_em = Column(DateTime(timezone=True), nullable=True)
    fechado_por = Column(String, nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    performed_by = Column(String)
    target_user = Column(String)
    action_type = Column(String)
    details = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
