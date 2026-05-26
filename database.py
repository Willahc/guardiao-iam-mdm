from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Cria um arquivo local chamado guardiao.db
SQLALCHEMY_DATABASE_URL = "sqlite:///./guardiao.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Função para injetar o banco nas rotas da API
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()