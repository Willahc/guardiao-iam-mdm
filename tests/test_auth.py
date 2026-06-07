def test_registro_empresa_cria_admin(client, empresa_admin):
    assert empresa_admin["status"] == "sucesso"
    assert empresa_admin["empresa_id"] > 0


def test_login_sucesso(client, empresa_admin):
    resp = client.post("/auth/login", json={"email": "admin@acme.com", "senha": "senha123"})
    assert resp.status_code == 200
    assert "access_token" in resp.json()


def test_login_senha_errada(client, empresa_admin):
    resp = client.post("/auth/login", json={"email": "admin@acme.com", "senha": "errada"})
    assert resp.status_code == 401


def test_slug_duplicado(client, empresa_admin):
    resp = client.post("/api/v1/empresas/registrar", json={
        "nome_empresa": "Outra",
        "slug": "acme",
        "nome_admin": "X",
        "email_admin": "x@y.com",
        "senha_admin": "abc",
    })
    assert resp.status_code == 409


def test_rota_protegida_sem_token(client):
    resp = client.get("/api/v1/tickets")
    assert resp.status_code == 401
