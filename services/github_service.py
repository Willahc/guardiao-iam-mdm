import logging
import os

import requests

logger = logging.getLogger(__name__)

GITHUB_TIMEOUT = 10
_is_org_cache: dict[str, bool] = {}


def _token():
    return os.getenv("GITHUB_TOKEN")


def _owner():
    return os.getenv("GITHUB_ORG", "Willahc")


def _repo():
    return os.getenv("GITHUB_REPO", "guardiao-iam-mdm")


def _headers():
    return {
        "Authorization": f"Bearer {_token()}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _is_org() -> bool:
    owner = _owner()
    if owner in _is_org_cache:
        return _is_org_cache[owner]
    try:
        resp = requests.get(
            f"https://api.github.com/users/{owner}",
            headers=_headers(),
            timeout=GITHUB_TIMEOUT,
        )
        if resp.status_code == 200:
            result = resp.json().get("type") == "Organization"
            _is_org_cache[owner] = result
            logger.info("GitHub %s detectado como %s", owner, "Organization" if result else "User")
            return result
    except requests.RequestException as exc:
        logger.error("Erro ao detectar tipo GitHub: %s", exc)
    _is_org_cache[owner] = False
    return False


def adicionar_membro_org(username: str) -> dict:
    if not _token():
        logger.warning("GITHUB_TOKEN não configurado — ignorando adição de membro")
        return {"sucesso": False, "mensagem": "GITHUB_TOKEN não configurado"}
    try:
        if _is_org():
            resp = requests.put(
                f"https://api.github.com/orgs/{_owner()}/memberships/{username}",
                headers=_headers(),
                json={"role": "member"},
                timeout=GITHUB_TIMEOUT,
            )
            if resp.status_code in (200, 201):
                state = resp.json().get("state", "unknown")
                return {"sucesso": True, "mensagem": f"Convite org enviado para {username} (state: {state})"}
        else:
            resp = requests.put(
                f"https://api.github.com/repos/{_owner()}/{_repo()}/collaborators/{username}",
                headers=_headers(),
                json={"permission": "push"},
                timeout=GITHUB_TIMEOUT,
            )
            if resp.status_code == 201:
                return {"sucesso": True, "mensagem": f"Convite de collaborator enviado para {username} no repo {_repo()}"}
            if resp.status_code == 204:
                return {"sucesso": True, "mensagem": f"{username} já é collaborator do repo {_repo()}"}

        logger.warning("GitHub add member falhou: %s %s", resp.status_code, resp.text)
        msg = resp.json().get("message", resp.text) if resp.text else resp.text
        return {"sucesso": False, "mensagem": f"Erro {resp.status_code}: {msg}"}
    except requests.RequestException as exc:
        logger.error("Erro ao adicionar membro GitHub: %s", exc)
        return {"sucesso": False, "mensagem": str(exc)}


def remover_membro_org(username: str) -> dict:
    if not _token():
        logger.warning("GITHUB_TOKEN não configurado — ignorando remoção de membro")
        return {"sucesso": False, "mensagem": "GITHUB_TOKEN não configurado"}
    try:
        if _is_org():
            resp = requests.delete(
                f"https://api.github.com/orgs/{_owner()}/members/{username}",
                headers=_headers(),
                timeout=GITHUB_TIMEOUT,
            )
        else:
            resp = requests.delete(
                f"https://api.github.com/repos/{_owner()}/{_repo()}/collaborators/{username}",
                headers=_headers(),
                timeout=GITHUB_TIMEOUT,
            )

        if resp.status_code == 204:
            return {"sucesso": True, "mensagem": f"{username} removido com sucesso"}
        logger.warning("GitHub remove member falhou: %s %s", resp.status_code, resp.text)
        msg = resp.json().get("message", resp.text) if resp.text else resp.text
        return {"sucesso": False, "mensagem": f"Erro {resp.status_code}: {msg}"}
    except requests.RequestException as exc:
        logger.error("Erro ao remover membro GitHub: %s", exc)
        return {"sucesso": False, "mensagem": str(exc)}


def listar_membros_org() -> list:
    if not _token():
        logger.warning("GITHUB_TOKEN não configurado — retornando lista vazia")
        return []
    try:
        if _is_org():
            url = f"https://api.github.com/orgs/{_owner()}/members"
        else:
            url = f"https://api.github.com/repos/{_owner()}/{_repo()}/collaborators"

        resp = requests.get(url, headers=_headers(), timeout=GITHUB_TIMEOUT)
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
