import logging
import os

import requests

logger = logging.getLogger(__name__)

GITHUB_TIMEOUT = 10


def _token():
    return os.getenv("GITHUB_TOKEN")


def _org():
    return os.getenv("GITHUB_ORG", "Willahc")


def _headers():
    return {
        "Authorization": f"Bearer {_token()}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def adicionar_membro_org(username: str) -> dict:
    if not _token():
        logger.warning("GITHUB_TOKEN não configurado — ignorando adição de membro")
        return {"sucesso": False, "mensagem": "GITHUB_TOKEN não configurado"}
    try:
        resp = requests.put(
            f"https://api.github.com/orgs/{_org()}/memberships/{username}",
            headers=_headers(),
            json={"role": "member"},
            timeout=GITHUB_TIMEOUT,
        )
        if resp.status_code in (200, 201):
            state = resp.json().get("state", "unknown")
            logger.info("Membro %s adicionado à org %s (state=%s)", username, _org(), state)
            return {"sucesso": True, "mensagem": f"Convite enviado para {username} (state: {state})"}
        logger.warning("GitHub add member falhou: %s %s", resp.status_code, resp.text)
        return {"sucesso": False, "mensagem": f"Erro {resp.status_code}: {resp.json().get('message', resp.text)}"}
    except requests.RequestException as exc:
        logger.error("Erro ao adicionar membro GitHub: %s", exc)
        return {"sucesso": False, "mensagem": str(exc)}


def remover_membro_org(username: str) -> dict:
    if not _token():
        logger.warning("GITHUB_TOKEN não configurado — ignorando remoção de membro")
        return {"sucesso": False, "mensagem": "GITHUB_TOKEN não configurado"}
    try:
        resp = requests.delete(
            f"https://api.github.com/orgs/{_org()}/members/{username}",
            headers=_headers(),
            timeout=GITHUB_TIMEOUT,
        )
        if resp.status_code == 204:
            logger.info("Membro %s removido da org %s", username, _org())
            return {"sucesso": True, "mensagem": f"{username} removido da organização {_org()}"}
        logger.warning("GitHub remove member falhou: %s %s", resp.status_code, resp.text)
        return {"sucesso": False, "mensagem": f"Erro {resp.status_code}: {resp.json().get('message', resp.text)}"}
    except requests.RequestException as exc:
        logger.error("Erro ao remover membro GitHub: %s", exc)
        return {"sucesso": False, "mensagem": str(exc)}


def listar_membros_org() -> list:
    if not _token():
        logger.warning("GITHUB_TOKEN não configurado — retornando lista vazia")
        return []
    try:
        resp = requests.get(
            f"https://api.github.com/orgs/{_org()}/members",
            headers=_headers(),
            timeout=GITHUB_TIMEOUT,
        )
        if resp.status_code == 200:
            return [
                {"login": m["login"], "avatar_url": m["avatar_url"], "html_url": m["html_url"]}
                for m in resp.json()
            ]
        logger.warning("GitHub list members falhou: %s %s", resp.status_code, resp.text)
        return []
    except requests.RequestException as exc:
        logger.error("Erro ao listar membros GitHub: %s", exc)
        return []
