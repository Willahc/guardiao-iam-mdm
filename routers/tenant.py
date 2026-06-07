from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

import models
from auth import hash_senha
from database import get_db
from schemas import RegistroEmpresa

router = APIRouter(tags=["Tenant"])

_registro_hits: dict[str, list[datetime]] = {}
REGISTRO_LIMITE = 5
REGISTRO_JANELA_SEG = 3600


def _checar_rate_limit_registro(ip: str):
    agora = datetime.now(timezone.utc)
    janela_inicio = agora - timedelta(seconds=REGISTRO_JANELA_SEG)
    hits = [t for t in _registro_hits.get(ip, []) if t > janela_inicio]
    if len(hits) >= REGISTRO_LIMITE:
        raise HTTPException(status_code=429, detail="Muitas tentativas de registro. Tente novamente em 1h.")
    hits.append(agora)
    _registro_hits[ip] = hits


@router.post("/api/v1/empresas/registrar")
def registrar_empresa(dados: RegistroEmpresa, request: Request, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else "desconhecido"
    _checar_rate_limit_registro(ip)
    if db.query(models.Empresa).filter(models.Empresa.slug == dados.slug).first():
        raise HTTPException(status_code=409, detail="Slug já existe")
    if db.query(models.Usuario).filter(models.Usuario.email == dados.email_admin).first():
        raise HTTPException(status_code=409, detail="Email já cadastrado")

    empresa = models.Empresa(nome=dados.nome_empresa, slug=dados.slug)
    db.add(empresa)
    db.flush()

    admin = models.Usuario(
        empresa_id=empresa.id,
        nome=dados.nome_admin,
        email=dados.email_admin,
        senha_hash=hash_senha(dados.senha_admin),
        role="admin",
    )
    db.add(admin)
    db.commit()

    return {
        "status": "sucesso",
        "empresa_id": empresa.id,
        "mensagem": f"Empresa '{dados.nome_empresa}' criada com admin {dados.email_admin}",
    }
