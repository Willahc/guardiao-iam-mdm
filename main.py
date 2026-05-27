import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Header, Query
from fastapi.responses import FileResponse
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func

import models
from auth import (
    hash_senha,
    verificar_senha,
    criar_access_token,
    criar_agent_token,
    validar_agent_token,
    get_usuario_atual,
    require_admin,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    SECRET_KEY,
    ALGORITHM,
)
from database import engine, get_db
from services.tickets import gerar_tickets_sem_api
from services.email import enviar_notificacao_ticket

logger = logging.getLogger(__name__)

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="O Guardião - Enterprise IAM & MDM",
    version="2.0",
    description="Motor central de governança de acessos e blindagem de hardware.",
)


# ==========================================
# SCHEMAS DE DADOS
# ==========================================
class FuncionarioPOC(BaseModel):
    email: str
    departamento: str


class ComandoMDM(BaseModel):
    serial_placa_mae: str


class PayloadRH(BaseModel):
    nome_completo: str
    email_corporativo: str
    departamento: str
    evento_rh: str


class LoginRequest(BaseModel):
    email: str
    senha: str
    serial_placa_mae: Optional[str] = None


class RegistroEmpresa(BaseModel):
    nome_empresa: str
    slug: str
    nome_admin: str
    email_admin: str
    senha_admin: str


class GerarTicketsRequest(BaseModel):
    colaborador_nome: str
    colaborador_email: str
    tipo: str
    departamento: str
    sistemas: list[str]


class RegistrarDispositivoRequest(BaseModel):
    serial_placa_mae: str
    hostname: str
    sistema_operacional: Optional[str] = None
    usuario_email: Optional[str] = None


class AgentePingRequest(BaseModel):
    serial_placa_mae: str
    versao_agente: Optional[str] = None
    hostname: Optional[str] = None


# ==========================================
# ROTA: FRONT-END VISUAL (sem auth)
# ==========================================
@app.get("/", tags=["Interface"])
def exibir_painel_executivo():
    return FileResponse("painel.html")


# ==========================================
# ROTA: AUTENTICAÇÃO
# ==========================================
@app.post("/auth/login", tags=["Auth"])
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
    return {"access_token": access_token, "token_type": "bearer"}


# ==========================================
# ROTA: REGISTRO DE TENANT
# ==========================================
@app.post("/api/v1/empresas/registrar", tags=["Tenant"])
def registrar_empresa(dados: RegistroEmpresa, db: Session = Depends(get_db)):
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


# ==========================================
# ROTA: ONBOARDING (protegida)
# ==========================================
@app.post("/api/v1/onboarding", tags=["IAM Manual"])
def executar_onboarding_manual(
    dados: FuncionarioPOC,
    db: Session = Depends(get_db),
    usuario_atual: models.Usuario = Depends(get_usuario_atual),
):
    novo_registro = models.RegistroAcesso(
        email=dados.email,
        setor=dados.departamento,
        status="ATIVO",
        empresa_id=usuario_atual.empresa_id,
    )
    db.add(novo_registro)
    db.commit()

    return {
        "status": "sucesso",
        "logs": [
            f"Usuário {dados.email} criado no Google Workspace.",
            f"Adicionado aos canais de {dados.departamento} no Slack.",
            "Licença do AutoCAD/Revit provisionada com sucesso.",
        ],
    }


# ==========================================
# ROTA: BLOQUEIO MDM (protegida)
# ==========================================
@app.post("/api/v1/travar", tags=["MDM Manual"])
def acionar_guilhotina_mdm(
    comando: ComandoMDM,
    db: Session = Depends(get_db),
    usuario_atual: models.Usuario = Depends(get_usuario_atual),
):
    return {
        "status": "sucesso",
        "alerta": f"Comando de bloqueio absoluto enviado para o hardware {comando.serial_placa_mae}.",
    }


# ==========================================
# ROTA: WEBHOOK DE RH (verificação JWT)
# ==========================================
@app.post("/api/v1/integracoes/rh/webhook", tags=["Integração Invisível"])
def processar_pulso_do_rh(
    payload: PayloadRH,
    authorization: str = Header(None),
    db: Session = Depends(get_db),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token não fornecido")
    token = authorization.replace("Bearer ", "", 1)
    try:
        jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido ou expirado")

    if payload.evento_rh == "ADMISSAO":
        return {
            "status": "sucesso",
            "acao": "Onboarding Zero Trust iniciado automaticamente",
            "detalhe": f"Identidades dinâmicas criadas para {payload.nome_completo}.",
        }
    elif payload.evento_rh == "DEMISSAO":
        return {
            "status": "sucesso",
            "acao": "Offboarding Crítico acionado automaticamente",
            "detalhe": "Sessões na nuvem encerradas e máquina física bloqueada.",
        }
    else:
        raise HTTPException(status_code=400, detail="Evento de RH não documentado.")


# ==========================================
# ROTAS: TICKETS DE TAREFA
# ==========================================
@app.post("/api/v1/tickets/gerar", tags=["Tickets"])
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


@app.get("/api/v1/tickets", tags=["Tickets"])
def listar_tickets(
    status: Optional[str] = Query(None),
    tipo: Optional[str] = Query(None),
    sistema: Optional[str] = Query(None),
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

    tickets = query.order_by(models.TicketTarefa.criado_em.desc()).all()

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


@app.patch("/api/v1/tickets/{ticket_id}/fechar", tags=["Tickets"])
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

    return {
        "id": ticket.id,
        "sistema": ticket.sistema,
        "status": ticket.status,
        "fechado_em": ticket.fechado_em.isoformat(),
        "fechado_por": ticket.fechado_por,
    }


@app.get("/api/v1/tickets/stats", tags=["Tickets"])
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


# ==========================================
# ROTAS: AGENTE MDM
# ==========================================
@app.post("/api/v1/agente/registrar", tags=["Agente MDM"])
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


@app.post("/api/v1/agente/ping", tags=["Agente MDM"])
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

    if dispositivo.status == "BLOQUEADO":
        dispositivo.ultimo_heartbeat = datetime.now(timezone.utc)
        if dados.versao_agente:
            dispositivo.versao_agente = dados.versao_agente
        if dados.hostname:
            dispositivo.hostname = dados.hostname
        db.commit()
        return {"status": "ok", "comando": "LOCK"}

    dispositivo.ultimo_heartbeat = datetime.now(timezone.utc)
    dispositivo.status = "ATIVO"
    if dados.versao_agente:
        dispositivo.versao_agente = dados.versao_agente
    if dados.hostname:
        dispositivo.hostname = dados.hostname
    db.commit()

    return {"status": "ok", "comando": None}


@app.post("/api/v1/agente/lock/{serial}", tags=["Agente MDM"])
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

    return {
        "status": "sucesso",
        "dispositivo": {
            "serial_placa_mae": dispositivo.serial_placa_mae,
            "hostname": dispositivo.hostname,
            "status": dispositivo.status,
        },
        "mensagem": "Dispositivo bloqueado. Próximo heartbeat receberá comando LOCK.",
    }


@app.post("/api/v1/agente/unlock/{serial}", tags=["Agente MDM"])
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

    return {
        "status": "sucesso",
        "dispositivo": {
            "serial_placa_mae": dispositivo.serial_placa_mae,
            "hostname": dispositivo.hostname,
            "status": dispositivo.status,
        },
    }


@app.get("/api/v1/agente/dispositivos", tags=["Agente MDM"])
def listar_dispositivos(
    db: Session = Depends(get_db),
    usuario_atual: models.Usuario = Depends(get_usuario_atual),
):
    dispositivos = db.query(models.Dispositivo).filter(
        models.Dispositivo.empresa_id == usuario_atual.empresa_id
    ).all()

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
