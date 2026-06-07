def _registrar_dispositivo(client, auth_headers, serial="TEST-001"):
    resp = client.post("/api/v1/agente/registrar", headers=auth_headers, json={
        "serial_placa_mae": serial,
        "hostname": "host-teste",
        "sistema_operacional": "Linux",
    })
    assert resp.status_code == 200, resp.text
    return resp.json()["dispositivo"]


def test_vincular_dispositivo_sucesso(client, auth_headers):
    disp = _registrar_dispositivo(client, auth_headers)
    assert disp["status"] == "PENDENTE"

    resp = client.patch(
        f"/api/v1/agente/dispositivo/{disp['serial_placa_mae']}/vincular",
        headers=auth_headers,
        json={"usuario_email": "admin@acme.com"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["dispositivo"]["status"] == "ATIVO"
    assert body["dispositivo"]["usuario_email"] == "admin@acme.com"
    assert body["dispositivo"]["usuario_id"] is not None


def test_vincular_usuario_inexistente(client, auth_headers):
    disp = _registrar_dispositivo(client, auth_headers, serial="TEST-002")
    resp = client.patch(
        f"/api/v1/agente/dispositivo/{disp['serial_placa_mae']}/vincular",
        headers=auth_headers,
        json={"usuario_email": "ninguem@empresa.com"},
    )
    assert resp.status_code == 404
    assert "não encontrado" in resp.json()["detail"]


def test_vincular_dispositivo_inexistente(client, auth_headers):
    resp = client.patch(
        "/api/v1/agente/dispositivo/SERIAL-FAKE/vincular",
        headers=auth_headers,
        json={"usuario_email": "admin@acme.com"},
    )
    assert resp.status_code == 404
