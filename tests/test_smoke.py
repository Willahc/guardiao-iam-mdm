def test_painel_serve(client):
    resp = client.get("/")
    assert resp.status_code == 200


def test_openapi_acessivel(client):
    resp = client.get("/openapi.json")
    assert resp.status_code == 200
    spec = resp.json()
    assert spec["info"]["title"] == "O Guardião - Enterprise IAM & MDM"
