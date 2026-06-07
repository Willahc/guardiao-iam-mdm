from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

import models
from auditoria import registrar_auditoria
from auth import get_usuario_atual
from database import get_db
from schemas import GerarTicketsRequest
from services.email import enviar_notificacao_ticket
from services.tickets import gerar_tickets_sem_api

router = APIRouter(tags=["Tickets"])


@router.post("/api/v1/tickets/gerar")
def gerar_tickets(
    dados: GerarTicketsRequest,
    db: Session = Depends(get_db),
    usuario_atual: models.Usuario = Depends(get_usuario_atual),
):
    if dados.tipo not in ("ADMISSAO", "DEMISSAO"):
        raise HTTPException(status_code=400, detail="Tipo deve ser ADMISSAO ou DEMISSAO")
    if not dados.sistemas:
        raise HTTPException(status_code=400, detail="Informe ao menos um sistema")

    tickets = gerar_tickets_sem_api(
        colaborador_nome=dados.colaborador_nome,
        colaborador_email=dados.colaborador_email,
        tipo=dados.tipo,
        empresa_id=usuario_atual.empresa_id,
        departamento=dados.departamento,
        sistemas=dados.sistemas,
        db=db,
    )

    for ticket in tickets:
        enviar_notificacao_ticket(ticket, usuario_atual.email)

    return {
        "status": "sucesso",
        "tickets": [
            {
                "id": t.id,
                "sistema": t.sistema,
                "tipo": t.tipo,
                "instrucoes": t.instrucoes,
                "status": t.status,
                "criado_em": t.criado_em.isoformat() if t.criado_em else None,
            }
            for t in tickets
        ],
    }


@router.get("/api/v1/tickets")
def listar_tickets(
    status: Optional[str] = Query(None),
    tipo: Optional[str] = Query(None),
    sistema: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    usuario_atual: models.Usuario = Depends(get_usuario_atual),
):
    query = db.query(models.TicketTarefa).filter(
        models.TicketTarefa.empresa_id == usuario_atual.empresa_id
    )
    if status:
        query = query.filter(models.TicketTarefa.status == status)
    if tipo:
        query = query.filter(models.TicketTarefa.tipo == tipo)
    if sistema:
        query = query.filter(models.TicketTarefa.sistema == sistema)

    tickets = query.order_by(models.TicketTarefa.criado_em.desc()).offset(skip).limit(limit).all()

    return [
        {
            "id": t.id,
            "colaborador_nome": t.colaborador_nome,
            "colaborador_email": t.colaborador_email,
            "tipo": t.tipo,
            "sistema": t.sistema,
            "instrucoes": t.instrucoes,
            "status": t.status,
            "criado_em": t.criado_em.isoformat() if t.criado_em else None,
            "fechado_em": t.fechado_em.isoformat() if t.fechado_em else None,
            "fechado_por": t.fechado_por,
        }
        for t in tickets
    ]


@router.patch("/api/v1/tickets/{ticket_id}/fechar")
def fechar_ticket(
    ticket_id: str,
    db: Session = Depends(get_db),
    usuario_atual: models.Usuario = Depends(get_usuario_atual),
):
    ticket = db.query(models.TicketTarefa).filter(
        models.TicketTarefa.id == ticket_id,
        models.TicketTarefa.empresa_id == usuario_atual.empresa_id,
    ).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket não encontrado")
    if ticket.status == "FECHADO":
        raise HTTPException(status_code=400, detail="Ticket já está fechado")

    ticket.status = "FECHADO"
    ticket.fechado_em = datetime.now(timezone.utc)
    ticket.fechado_por = usuario_atual.email
    db.commit()
    db.refresh(ticket)
    registrar_auditoria(
        db, usuario_atual.empresa_id, "TICKET_FECHADO", usuario_atual.email,
        ticket.colaborador_email, {"ticket_id": ticket.id, "sistema": ticket.sistema},
    )

    return {
        "id": ticket.id,
        "sistema": ticket.sistema,
        "status": ticket.status,
        "fechado_em": ticket.fechado_em.isoformat(),
        "fechado_por": ticket.fechado_por,
    }


@router.get("/api/v1/tickets/stats")
def stats_tickets(
    db: Session = Depends(get_db),
    usuario_atual: models.Usuario = Depends(get_usuario_atual),
):
    base = db.query(models.TicketTarefa).filter(
        models.TicketTarefa.empresa_id == usuario_atual.empresa_id
    )
    total = base.count()
    abertos = base.filter(models.TicketTarefa.status == "ABERTO").count()
    em_andamento = base.filter(models.TicketTarefa.status == "EM_ANDAMENTO").count()
    fechados = base.filter(models.TicketTarefa.status == "FECHADO").count()

    return {
        "total": total,
        "abertos": abertos,
        "em_andamento": em_andamento,
        "fechados": fechados,
    }
