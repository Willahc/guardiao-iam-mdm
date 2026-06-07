import hashlib

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

import models
from auditoria import registrar_auditoria
from auth import require_admin
from database import get_db

router = APIRouter(tags=["LGPD"], prefix="/api/v1/lgpd")


@router.delete("/titular/{email}")
def anonimizar_titular(
    email: str,
    db: Session = Depends(get_db),
    admin: models.Usuario = Depends(require_admin),
):
    email_hash = hashlib.sha256(email.encode()).hexdigest()[:16] + "@anonimizado"
    count = 0

    registros = db.query(models.RegistroAcesso).filter(
        models.RegistroAcesso.email == email,
        models.RegistroAcesso.empresa_id == admin.empresa_id,
    ).all()
    for r in registros:
        r.email = email_hash
        count += 1

    tickets = db.query(models.TicketTarefa).filter(
        models.TicketTarefa.colaborador_email == email,
        models.TicketTarefa.empresa_id == admin.empresa_id,
    ).all()
    for t in tickets:
        t.colaborador_nome = "ANONIMIZADO"
        t.colaborador_email = email_hash
        t.instrucoes = "Dados anonimizados por solicitação LGPD"
        count += 1

    dispositivos = db.query(models.Dispositivo).filter(
        models.Dispositivo.empresa_id == admin.empresa_id,
    ).join(models.Usuario, models.Dispositivo.usuario_id == models.Usuario.id).filter(
        models.Usuario.email == email,
    ).all()
    for d in dispositivos:
        d.usuario_id = None
        count += 1

    usuario = db.query(models.Usuario).filter(
        models.Usuario.email == email,
        models.Usuario.empresa_id == admin.empresa_id,
    ).first()
    if usuario:
        usuario.nome = "ANONIMIZADO"
        usuario.email = email_hash
        usuario.ativo = False
        count += 1

    db.commit()
    registrar_auditoria(db, admin.empresa_id, "LGPD_ANONIMIZACAO", admin.email, email, {"registros_anonimizados": count})
    return {"status": "sucesso", "anonimizados": count, "email_hash": email_hash}


@router.get("/exportar/{email}")
def exportar_dados_titular(
    email: str,
    db: Session = Depends(get_db),
    admin: models.Usuario = Depends(require_admin),
):
    usuario = db.query(models.Usuario).filter(
        models.Usuario.email == email,
        models.Usuario.empresa_id == admin.empresa_id,
    ).first()

    registros = db.query(models.RegistroAcesso).filter(
        models.RegistroAcesso.email == email,
        models.RegistroAcesso.empresa_id == admin.empresa_id,
    ).all()

    tickets = db.query(models.TicketTarefa).filter(
        models.TicketTarefa.colaborador_email == email,
        models.TicketTarefa.empresa_id == admin.empresa_id,
    ).all()

    dispositivos = []
    if usuario:
        dispositivos = db.query(models.Dispositivo).filter(
            models.Dispositivo.usuario_id == usuario.id,
            models.Dispositivo.empresa_id == admin.empresa_id,
        ).all()

    registrar_auditoria(db, admin.empresa_id, "LGPD_EXPORTACAO", admin.email, email)

    return {
        "titular": email,
        "dados_pessoais": {
            "nome": usuario.nome if usuario else None,
            "email": usuario.email if usuario else email,
            "departamento": usuario.departamento if usuario else None,
            "role": usuario.role if usuario else None,
            "ativo": usuario.ativo if usuario else None,
        },
        "registros_acesso": [
            {"email": r.email, "setor": r.setor, "status": r.status, "criado_em": r.criado_em.isoformat() if r.criado_em else None}
            for r in registros
        ],
        "tickets": [
            {"id": t.id, "tipo": t.tipo, "sistema": t.sistema, "status": t.status, "criado_em": t.criado_em.isoformat() if t.criado_em else None}
            for t in tickets
        ],
        "dispositivos": [
            {"id": d.id, "hostname": d.hostname, "serial_placa_mae": d.serial_placa_mae, "status": d.status}
            for d in dispositivos
        ],
    }


@router.get("/auditoria")
def listar_auditoria(
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    admin: models.Usuario = Depends(require_admin),
):
    registros = db.query(models.RegistroAuditoria).filter(
        models.RegistroAuditoria.empresa_id == admin.empresa_id,
    ).order_by(models.RegistroAuditoria.timestamp.desc()).offset(skip).limit(limit).all()

    return [
        {
            "id": r.id,
            "acao": r.acao,
            "executado_por": r.executado_por,
            "colaborador_email": r.colaborador_email,
            "detalhes": r.detalhes,
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
        }
        for r in registros
    ]
