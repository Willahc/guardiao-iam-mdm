import logging

from fastapi import APIRouter, Depends, Header, HTTPException
from jose import JWTError, jwt
from sqlalchemy.orm import Session

import models
from auditoria import registrar_auditoria
from auth import ALGORITHM, SECRET_KEY, get_usuario_atual
from database import get_db
from schemas import ComandoMDM, FuncionarioPOC, PayloadRH
from services.jira_service import criar_ticket_offboarding
from services.slack_service import enviar_mensagem_boas_vindas, notificar_offboarding

logger = logging.getLogger(__name__)
router = APIRouter(tags=["IAM/MDM"])


@router.post("/api/v1/onboarding")
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

    integ_log: dict = {}
    try:
        enviado = enviar_mensagem_boas_vindas(dados.email, dados.email, dados.departamento)
        integ_log["slack"] = "enviado" if enviado else "usuário não encontrado no Slack"
    except Exception as exc:
        logger.error("Falha integração Slack onboarding: %s", exc)
        integ_log["slack"] = f"erro: {exc}"

    registrar_auditoria(
        db, usuario_atual.empresa_id, "ONBOARDING", usuario_atual.email, dados.email,
        {"departamento": dados.departamento, "integracoes": integ_log},
    )
    return {
        "status": "sucesso",
        "email": dados.email,
        "departamento": dados.departamento,
        "integracoes": integ_log,
    }


@router.post("/api/v1/travar")
def acionar_guilhotina_mdm(
    comando: ComandoMDM,
    db: Session = Depends(get_db),
    usuario_atual: models.Usuario = Depends(get_usuario_atual),
):
    integ_log: dict = {}
    dispositivo = db.query(models.Dispositivo).filter(
        models.Dispositivo.serial_placa_mae == comando.serial_placa_mae,
        models.Dispositivo.empresa_id == usuario_atual.empresa_id,
    ).first()

    colaborador_email = None
    colaborador_nome = None
    if dispositivo and dispositivo.usuario_id:
        usuario_disp = db.query(models.Usuario).filter(models.Usuario.id == dispositivo.usuario_id).first()
        if usuario_disp:
            colaborador_email = usuario_disp.email
            colaborador_nome = usuario_disp.nome
            try:
                slack_ok = notificar_offboarding(colaborador_email, colaborador_nome)
                integ_log["slack"] = "notificado" if slack_ok else "usuário não encontrado no Slack"
            except Exception as exc:
                logger.error("Falha integração Slack offboarding: %s", exc)
                integ_log["slack"] = f"erro: {exc}"
            try:
                jira_result = criar_ticket_offboarding(
                    colaborador_nome, colaborador_email, ["Dispositivo MDM", "Rede corporativa"],
                )
                integ_log["jira"] = jira_result.get("issue_key") or jira_result.get("erro", "falha")
            except Exception as exc:
                logger.error("Falha integração Jira offboarding: %s", exc)
                integ_log["jira"] = f"erro: {exc}"

    registrar_auditoria(
        db, usuario_atual.empresa_id, "DEVICE_LOCK_OFFBOARDING", usuario_atual.email,
        colaborador_email, {"serial": comando.serial_placa_mae, "integracoes": integ_log},
    )
    return {
        "status": "sucesso",
        "alerta": f"Comando de bloqueio absoluto enviado para o hardware {comando.serial_placa_mae}.",
        "integracoes": integ_log,
    }


@router.post("/api/v1/integracoes/rh/webhook", tags=["Integração Invisível"])
def processar_pulso_do_rh(
    payload: PayloadRH,
    authorization: str = Header(None),
    db: Session = Depends(get_db),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token não fornecido")
    token = authorization.replace("Bearer ", "", 1)
    try:
        claims = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido ou expirado")

    empresa_id = claims.get("empresa_id")
    if not empresa_id:
        raise HTTPException(status_code=401, detail="Token sem empresa_id")

    integ_log: dict = {}

    if payload.evento_rh == "ADMISSAO":
        db.add(models.RegistroAcesso(
            email=payload.email_corporativo,
            setor=payload.departamento,
            status="ATIVO",
            empresa_id=empresa_id,
        ))
        db.commit()
        try:
            ok = enviar_mensagem_boas_vindas(
                payload.email_corporativo, payload.nome_completo, payload.departamento,
            )
            integ_log["slack"] = "enviado" if ok else "usuário não encontrado no Slack"
        except Exception as exc:
            logger.error("Webhook RH ADMISSAO slack falhou: %s", exc)
            integ_log["slack"] = f"erro: {exc}"

        registrar_auditoria(
            db, empresa_id, "RH_WEBHOOK_ADMISSAO", "webhook-rh",
            payload.email_corporativo, {"departamento": payload.departamento, "integracoes": integ_log},
        )
        return {"status": "sucesso", "acao": "ADMISSAO", "integracoes": integ_log}

    if payload.evento_rh == "DEMISSAO":
        usuario = db.query(models.Usuario).filter(
            models.Usuario.email == payload.email_corporativo,
            models.Usuario.empresa_id == empresa_id,
        ).first()
        if usuario:
            usuario.ativo = False
            dispositivos = db.query(models.Dispositivo).filter(
                models.Dispositivo.usuario_id == usuario.id,
                models.Dispositivo.empresa_id == empresa_id,
            ).all()
            for d in dispositivos:
                d.status = "BLOQUEADO"
            db.commit()
            integ_log["dispositivos_bloqueados"] = len(dispositivos)

        try:
            ok = notificar_offboarding(payload.email_corporativo, payload.nome_completo)
            integ_log["slack"] = "notificado" if ok else "usuário não encontrado no Slack"
        except Exception as exc:
            logger.error("Webhook RH DEMISSAO slack falhou: %s", exc)
            integ_log["slack"] = f"erro: {exc}"

        try:
            jira_result = criar_ticket_offboarding(
                payload.nome_completo, payload.email_corporativo,
                ["Dispositivo MDM", "Rede corporativa"],
            )
            integ_log["jira"] = jira_result.get("issue_key") or jira_result.get("erro", "falha")
        except Exception as exc:
            logger.error("Webhook RH DEMISSAO jira falhou: %s", exc)
            integ_log["jira"] = f"erro: {exc}"

        registrar_auditoria(
            db, empresa_id, "RH_WEBHOOK_DEMISSAO", "webhook-rh",
            payload.email_corporativo, {"integracoes": integ_log},
        )
        return {"status": "sucesso", "acao": "DEMISSAO", "integracoes": integ_log}

    raise HTTPException(status_code=400, detail="Evento de RH não documentado.")
