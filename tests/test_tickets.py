def test_gerar_e_listar_ticket(client, auth_headers):
    resp = client.post("/api/v1/tickets/gerar", headers=auth_headers, json={
        "colaborador_nome": "Joao",
        "colaborador_email": "joao@acme.com",
        "tipo": "ADMISSAO",
        "departamento": "Vendas",
        "sistemas": ["TOTVS", "Sankhya"],
    })
    assert resp.status_code == 200
    tickets = resp.json()["tickets"]
    assert len(tickets) == 2

    listagem = client.get("/api/v1/tickets", headers=auth_headers)
    assert listagem.status_code == 200
    assert len(listagem.json()) == 2


def test_stats_tickets(client, auth_headers):
    client.post("/api/v1/tickets/gerar", headers=auth_headers, json={
        "colaborador_nome": "Maria",
        "colaborador_email": "maria@acme.com",
        "tipo": "ADMISSAO",
        "departamento": "TI",
        "sistemas": ["TOTVS"],
    })
    stats = client.get("/api/v1/tickets/stats", headers=auth_headers)
    assert stats.status_code == 200
    body = stats.json()
    assert body["total"] >= 1
    assert body["abertos"] >= 1


def test_fechar_ticket(client, auth_headers):
    r = client.post("/api/v1/tickets/gerar", headers=auth_headers, json={
        "colaborador_nome": "Ana",
        "colaborador_email": "ana@acme.com",
        "tipo": "DEMISSAO",
        "departamento": "RH",
        "sistemas": ["TOTVS"],
    })
    ticket_id = r.json()["tickets"][0]["id"]
    fechar = client.patch(f"/api/v1/tickets/{ticket_id}/fechar", headers=auth_headers)
    assert fechar.status_code == 200
    assert fechar.json()["status"] == "FECHADO"


def test_tipo_invalido(client, auth_headers):
    resp = client.post("/api/v1/tickets/gerar", headers=auth_headers, json={
        "colaborador_nome": "X",
        "colaborador_email": "x@y.com",
        "tipo": "OUTRO",
        "departamento": "TI",
        "sistemas": ["TOTVS"],
    })
    assert resp.status_code == 400
