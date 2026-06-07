import uuid

from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, JSON, Index
from sqlalchemy.sql import func

from database import Base


class Empresa(Base):
    __tablename__ = "empresas"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    plano = Column(String, default="STARTER")
    ativo = Column(Boolean, default=True)
    criado_em = Column(DateTime(timezone=True), server_default=func.now())


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id"), nullable=False, index=True)
    nome = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    senha_hash = Column(String, nullable=False)
    departamento = Column(String, nullable=True)
    role = Column(String, default="user")
    ativo = Column(Boolean, default=True)


class RegistroAcesso(Base):
    __tablename__ = "registros_acesso"

    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id"), nullable=True, index=True)
    email = Column(String, index=True)
    setor = Column(String)
    status = Column(String, default="ATIVO")
    criado_em = Column(DateTime(timezone=True), server_default=func.now())


class Dispositivo(Base):
    __tablename__ = "dispositivos"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    empresa_id = Column(Integer, ForeignKey("empresas.id"), nullable=False, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    serial_placa_mae = Column(String, nullable=False, index=True)
    hostname = Column(String, nullable=False)
    sistema_operacional = Column(String, nullable=True)
    versao_agente = Column(String, nullable=True)
    status = Column(String, default="PENDENTE", index=True)
    ultimo_heartbeat = Column(DateTime(timezone=True), nullable=True)
    registrado_em = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_dispositivos_empresa_serial", "empresa_id", "serial_placa_mae"),
    )


class TicketTarefa(Base):
    __tablename__ = "tickets_tarefa"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    empresa_id = Column(Integer, ForeignKey("empresas.id"), nullable=False, index=True)
    colaborador_nome = Column(String, nullable=False)
    colaborador_email = Column(String, nullable=False, index=True)
    tipo = Column(String, nullable=False, index=True)
    sistema = Column(String, nullable=False, index=True)
    instrucoes = Column(String, nullable=False)
    status = Column(String, default="ABERTO", index=True)
    criado_em = Column(DateTime(timezone=True), server_default=func.now())
    fechado_em = Column(DateTime(timezone=True), nullable=True)
    fechado_por = Column(String, nullable=True)

    __table_args__ = (
        Index("ix_tickets_empresa_status", "empresa_id", "status"),
    )


class RegistroAuditoria(Base):
    __tablename__ = "registros_auditoria"

    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id"), nullable=False, index=True)
    acao = Column(String, nullable=False, index=True)
    executado_por = Column(String, nullable=False)
    colaborador_email = Column(String, nullable=True)
    detalhes = Column(JSON, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class PlanoEmpresa(Base):
    __tablename__ = "planos_empresa"

    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id"), nullable=False, unique=True)
    plano = Column(String, default="STARTER")
    usuarios_ativos = Column(Integer, default=0)
    valor_por_usuario = Column(Integer, default=2900)
    proximo_vencimento = Column(DateTime(timezone=True), nullable=True)
    status = Column(String, default="ATIVO")
