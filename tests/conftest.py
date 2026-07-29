import os
import sys

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("AGENT_JWT_SECRET", "test-agent-secret")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_guardiao.db")

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import models
from database import Base, engine as app_engine, get_db
from main import app


@pytest.fixture(scope="session")
def engine():
    eng = create_engine("sqlite:///./test_guardiao.db", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=eng)
    yield eng
    Base.metadata.drop_all(bind=eng)
    app_engine.dispose()
    eng.dispose()
    try:
        os.remove("test_guardiao.db")
    except FileNotFoundError:
        pass


@pytest.fixture
def db_session(engine):
    TestSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestSession()
    try:
        yield session
    finally:
        session.close()
        for table in reversed(Base.metadata.sorted_tables):
            with engine.begin() as conn:
                conn.execute(table.delete())


@pytest.fixture
def client(engine, db_session):
    from routers import tenant
    tenant._registro_hits.clear()

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def empresa_admin(client):
    resp = client.post("/api/v1/empresas/registrar", json={
        "nome_empresa": "Acme",
        "slug": "acme",
        "nome_admin": "Admin",
        "email_admin": "admin@acme.com",
        "senha_admin": "senha123",
    })
    assert resp.status_code == 200, resp.text
    return resp.json()


@pytest.fixture
def auth_headers(client, empresa_admin):
    resp = client.post("/auth/login", json={"email": "admin@acme.com", "senha": "senha123"})
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
