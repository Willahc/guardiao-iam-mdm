from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
from auditoria import registrar_auditoria
from auth import ACCESS_TOKEN_EXPIRE_MINUTES, criar_access_token, verificar_senha
from database import get_db
from schemas import LoginRequest

router = APIRouter(tags=["Auth"])


@router.post("/auth/login")
def login(dados: LoginRequest, db: Session = Depends(get_db)):
    usuario = db.query(models.Usuario).filter(models.Usuario.email == dados.email).first()
    if not usuario or not verificar_senha(dados.senha, usuario.senha_hash):
        raise HTTPException(status_code=401, detail="Email ou senha incorretos")
    if not usuario.ativo:
        raise HTTPException(status_code=403, detail="Usuário desativado")

    if dados.serial_placa_mae:
        dispositivo = db.query(models.Dispositivo).filter(
            models.Dispositivo.serial_placa_mae == dados.serial_placa_mae,
            models.Dispositivo.empresa_id == usuario.empresa_id,
        ).first()
        heartbeat_limite = datetime.now(timezone.utc) - timedelta(minutes=10)
        hb = dispositivo.ultimo_heartbeat if dispositivo else None
        if hb and hb.tzinfo is None:
            hb = hb.replace(tzinfo=timezone.utc)
        if (
            not dispositivo
            or dispositivo.status != "ATIVO"
            or not hb
            or hb < heartbeat_limite
        ):
            raise HTTPException(
                status_code=403,
                detail="Acesso negado: dispositivo não gerenciado ou fora de conformidade.",
            )

    access_token = criar_access_token(
        data={"sub": usuario.email, "empresa_id": usuario.empresa_id, "role": usuario.role},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    registrar_auditoria(db, usuario.empresa_id, "LOGIN", usuario.email)
    return {"access_token": access_token, "token_type": "bearer"}
