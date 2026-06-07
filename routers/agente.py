from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session

import models
from auditoria import registrar_auditoria
from auth import criar_agent_token, require_admin, get_usuario_atual, validar_agent_token
from database import get_db
from schemas import AgentePingRequest, BulkLockRequest, RegistrarDispositivoRequest

router = APIRouter(tags=["Agente MDM"], prefix="/api/v1/agente")


@router.post("/registrar")
def registrar_dispositivo(
    dados: RegistrarDispositivoRequest,
    db: Session = Depends(get_db),
    admin: models.Usuario = Depends(require_admin),
):
    existente = db.query(models.Dispositivo).filter(
        models.Dispositivo.serial_placa_mae == dados.serial_placa_mae,
        models.Dispositivo.empresa_id == admin.empresa_id,
    ).first()
    if existente:
        raise HTTPException(status_code=409, detail="Dispositivo já registrado nesta empresa")

    usuario_id = None
    if dados.usuario_email:
        usuario = db.query(models.Usuario).filter(
            models.Usuario.email == dados.usuario_email,
            models.Usuario.empresa_id == admin.empresa_id,
        ).first()
        if not usuario:
            raise HTTPException(status_code=404, detail="Usuário não encontrado nesta empresa")
        usuario_id = usuario.id

    dispositivo = models.Dispositivo(
        empresa_id=admin.empresa_id,
        usuario_id=usuario_id,
        serial_placa_mae=dados.serial_placa_mae,
        hostname=dados.hostname,
        sistema_operacional=dados.sistema_operacional,
    )
    db.add(dispositivo)
    db.commit()
    db.refresh(dispositivo)

    agent_token = criar_agent_token(dados.serial_placa_mae, admin.empresa_id)

    return {
        "status": "sucesso",
        "dispositivo": {
            "id": dispositivo.id,
            "serial_placa_mae": dispositivo.serial_placa_mae,
            "hostname": dispositivo.hostname,
            "status": dispositivo.status,
            "registrado_em": dispositivo.registrado_em.isoformat() if dispositivo.registrado_em else None,
        },
        "agent_token": agent_token,
    }


@router.post("/ping")
def agente_ping(
    dados: AgentePingRequest,
    x_agent_token: str = Header(...),
    db: Session = Depends(get_db),
):
    payload = validar_agent_token(x_agent_token)
    dispositivo = db.query(models.Dispositivo).filter(
        models.Dispositivo.serial_placa_mae == dados.serial_placa_mae,
        models.Dispositivo.empresa_id == payload["empresa_id"],
    ).first()
    if not dispositivo:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado")

    agora = datetime.now(timezone.utc)
    dispositivo.ultimo_heartbeat = agora
    if dados.versao_agente:
        dispositivo.versao_agente = dados.versao_agente
    if dados.hostname:
        dispositivo.hostname = dados.hostname

    if dispositivo.status == "BLOQUEADO":
        db.commit()
        return {"status": "ok", "comando": "LOCK"}

    dispositivo.status = "ATIVO"
    db.commit()
    return {"status": "ok", "comando": None}


@router.post("/lock/{serial}")
def bloquear_dispositivo(
    serial: str,
    db: Session = Depends(get_db),
    admin: models.Usuario = Depends(require_admin),
):
    dispositivo = db.query(models.Dispositivo).filter(
        models.Dispositivo.serial_placa_mae == serial,
        models.Dispositivo.empresa_id == admin.empresa_id,
    ).first()
    if not dispositivo:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado")

    dispositivo.status = "BLOQUEADO"
    db.commit()
    db.refresh(dispositivo)
    registrar_auditoria(db, admin.empresa_id, "DEVICE_LOCK", admin.email, detalhes={"serial": serial, "hostname": dispositivo.hostname})

    return {
        "status": "sucesso",
        "dispositivo": {
            "serial_placa_mae": dispositivo.serial_placa_mae,
            "hostname": dispositivo.hostname,
            "status": dispositivo.status,
        },
        "mensagem": "Dispositivo bloqueado. Próximo heartbeat receberá comando LOCK.",
    }


@router.post("/lock-bulk")
def bloquear_dispositivos_bulk(
    dados: BulkLockRequest,
    db: Session = Depends(get_db),
    admin: models.Usuario = Depends(require_admin),
):
    if not dados.seriais:
        return {"status": "sucesso", "bloqueados": [], "nao_encontrados": []}

    dispositivos = db.query(models.Dispositivo).filter(
        models.Dispositivo.empresa_id == admin.empresa_id,
        models.Dispositivo.serial_placa_mae.in_(dados.seriais),
    ).all()
    encontrados = {d.serial_placa_mae for d in dispositivos}
    bloqueados = []
    for d in dispositivos:
        if d.status != "BLOQUEADO":
            d.status = "BLOQUEADO"
            bloqueados.append({"serial_placa_mae": d.serial_placa_mae, "hostname": d.hostname})
    db.commit()
    nao_encontrados = [s for s in dados.seriais if s not in encontrados]
    registrar_auditoria(
        db, admin.empresa_id, "DEVICE_LOCK_BULK", admin.email,
        detalhes={"seriais": dados.seriais, "bloqueados": len(bloqueados), "nao_encontrados": nao_encontrados},
    )
    return {"status": "sucesso", "bloqueados": bloqueados, "nao_encontrados": nao_encontrados}


@router.post("/unlock/{serial}")
def desbloquear_dispositivo(
    serial: str,
    db: Session = Depends(get_db),
    admin: models.Usuario = Depends(require_admin),
):
    dispositivo = db.query(models.Dispositivo).filter(
        models.Dispositivo.serial_placa_mae == serial,
        models.Dispositivo.empresa_id == admin.empresa_id,
    ).first()
    if not dispositivo:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado")

    dispositivo.status = "ATIVO"
    db.commit()
    db.refresh(dispositivo)
    registrar_auditoria(db, admin.empresa_id, "DEVICE_UNLOCK", admin.email, detalhes={"serial": serial, "hostname": dispositivo.hostname})

    return {
        "status": "sucesso",
        "dispositivo": {
            "serial_placa_mae": dispositivo.serial_placa_mae,
            "hostname": dispositivo.hostname,
            "status": dispositivo.status,
        },
    }


@router.get("/dispositivos")
def listar_dispositivos(
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
    db: Session = Depends(get_db),
    usuario_atual: models.Usuario = Depends(get_usuario_atual),
):
    dispositivos = db.query(models.Dispositivo).filter(
        models.Dispositivo.empresa_id == usuario_atual.empresa_id
    ).order_by(models.Dispositivo.registrado_em.desc()).offset(skip).limit(limit).all()

    agora = datetime.now(timezone.utc)
    resultado = []
    for d in dispositivos:
        hb = d.ultimo_heartbeat
        if hb and hb.tzinfo is None:
            hb = hb.replace(tzinfo=timezone.utc)
        online = hb is not None and (agora - hb).total_seconds() < 600
        resultado.append({
            "id": d.id,
            "serial_placa_mae": d.serial_placa_mae,
            "hostname": d.hostname,
            "sistema_operacional": d.sistema_operacional,
            "versao_agente": d.versao_agente,
            "status": d.status,
            "online": online,
            "ultimo_heartbeat": d.ultimo_heartbeat.isoformat() if d.ultimo_heartbeat else None,
            "registrado_em": d.registrado_em.isoformat() if d.registrado_em else None,
            "usuario_id": d.usuario_id,
        })
    return resultado
