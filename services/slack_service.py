import logging
import os

import requests

logger = logging.getLogger(__name__)

SLACK_BOT_TOKEN = os.getenv("SLACK_BOT_TOKEN")
SLACK_TIMEOUT = 10


def _headers():
    return {"Authorization": f"Bearer {SLACK_BOT_TOKEN}", "Content-Type": "application/json"}


def buscar_usuario_por_email(email: str) -> dict | None:
    if not SLACK_BOT_TOKEN:
        logger.warning("SLACK_BOT_TOKEN não configurado — ignorando busca de usuário")
        return None
    try:
        resp = requests.get(
            "https://slack.com/api/users.lookupByEmail",
            params={"email": email},
            headers=_headers(),
            timeout=SLACK_TIMEOUT,
        )
        data = resp.json()
        if data.get("ok"):
            return data["user"]
        logger.warning("Slack lookupByEmail falhou: %s", data.get("error"))
        return None
    except requests.RequestException as exc:
        logger.error("Erro ao buscar usuário Slack: %s", exc)
        return None


def enviar_mensagem_boas_vindas(email: str, nome: str, departamento: str) -> bool:
    if not SLACK_BOT_TOKEN:
        logger.warning("SLACK_BOT_TOKEN não configurado — ignorando boas-vindas")
        return False
    user = buscar_usuario_por_email(email)
    if not user:
        return False
    user_id = user["id"]
    texto = f"Bem-vindo(a) {nome}! Você foi adicionado(a) ao time de {departamento}."
    try:
        resp = requests.post(
            "https://slack.com/api/chat.postMessage",
            headers=_headers(),
            json={"channel": user_id, "text": texto},
            timeout=SLACK_TIMEOUT,
        )
        data = resp.json()
        if data.get("ok"):
            logger.info("Boas-vindas enviadas para %s no Slack", email)
            return True
        logger.warning("Slack postMessage falhou: %s", data.get("error"))
        return False
    except requests.RequestException as exc:
        logger.error("Erro ao enviar mensagem Slack: %s", exc)
        return False


def notificar_offboarding(email: str, nome: str) -> bool:
    if not SLACK_BOT_TOKEN:
        logger.warning("SLACK_BOT_TOKEN não configurado — ignorando notificação offboarding")
        return False
    user = buscar_usuario_por_email(email)
    if not user:
        return False
    user_id = user["id"]
    texto = "Seus acessos foram revogados. Em caso de dúvidas, contate RH."
    try:
        resp = requests.post(
            "https://slack.com/api/chat.postMessage",
            headers=_headers(),
            json={"channel": user_id, "text": texto},
            timeout=SLACK_TIMEOUT,
        )
        data = resp.json()
        if data.get("ok"):
            logger.info("Notificação offboarding enviada para %s no Slack", email)
            return True
        logger.warning("Slack postMessage offboarding falhou: %s", data.get("error"))
        return False
    except requests.RequestException as exc:
        logger.error("Erro ao notificar offboarding Slack: %s", exc)
        return False
