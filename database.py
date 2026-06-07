import logging
import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()
logger = logging.getLogger(__name__)

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./guardiao.db")

if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif SQLALCHEMY_DATABASE_URL.startswith("postgresql://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

connect_args = {}
pool_kwargs: dict = {}
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False
else:
    pool_kwargs = {"pool_pre_ping": True, "pool_recycle": 1800}

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args, **pool_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


_RUNTIME_INDEXES = [
    ("ix_usuarios_empresa_id", "usuarios", "empresa_id"),
    ("ix_registros_acesso_empresa_id", "registros_acesso", "empresa_id"),
    ("ix_dispositivos_empresa_id", "dispositivos", "empresa_id"),
    ("ix_dispositivos_status", "dispositivos", "status"),
    ("ix_tickets_tarefa_empresa_id", "tickets_tarefa", "empresa_id"),
    ("ix_tickets_tarefa_colaborador_email", "tickets_tarefa", "colaborador_email"),
    ("ix_tickets_tarefa_tipo", "tickets_tarefa", "tipo"),
    ("ix_tickets_tarefa_sistema", "tickets_tarefa", "sistema"),
    ("ix_tickets_tarefa_status", "tickets_tarefa", "status"),
    ("ix_registros_auditoria_empresa_id", "registros_auditoria", "empresa_id"),
    ("ix_registros_auditoria_acao", "registros_auditoria", "acao"),
    ("ix_registros_auditoria_timestamp", "registros_auditoria", "timestamp"),
]


def aplicar_indices_runtime():
    """Cria CREATE INDEX IF NOT EXISTS para índices adicionados após o create_all inicial."""
    with engine.begin() as conn:
        for name, table, col in _RUNTIME_INDEXES:
            try:
                conn.execute(text(f'CREATE INDEX IF NOT EXISTS {name} ON {table} ({col})'))
            except Exception as exc:
                logger.warning("Falha ao criar índice %s: %s", name, exc)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
