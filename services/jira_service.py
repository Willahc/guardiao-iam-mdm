import base64
import logging
import os

import requests

logger = logging.getLogger(__name__)

JIRA_TIMEOUT = 10


def _email():
    return os.getenv("JIRA_EMAIL")


def _api_token():
    return os.getenv("JIRA_API_TOKEN")


def _domain():
    return os.getenv("JIRA_DOMAIN", "guardiao-iam.atlassian.net")


def _project_key():
    return os.getenv("JIRA_PROJECT_KEY", "KAN")


def _configurado() -> bool:
    return bool(_email() and _api_token() and _domain())


def _headers():
    cred = base64.b64encode(f"{_email()}:{_api_token()}".encode()).decode()
    return {
        "Authorization": f"Basic {cred}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def _base_url():
    return f"https://{_domain()}"


def criar_issue(summary: str, description: str, tipo: str = "Task") -> dict:
    if not _configurado():
        logger.warning("Jira não configurado — ignorando criação de issue")
        return {"issue_key": None, "url": None, "erro": "Jira não configurado"}
    try:
        payload = {
            "fields": {
                "project": {"key": _project_key()},
                "summary": summary,
                "description": {
                    "type": "doc",
                    "version": 1,
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [{"type": "text", "text": description}],
                        }
                    ],
                },
                "issuetype": {"name": tipo},
            }
        }
        resp = requests.post(
            f"{_base_url()}/rest/api/3/issue",
            headers=_headers(),
            json=payload,
            timeout=JIRA_TIMEOUT,
        )
        if resp.status_code in (200, 201):
            data = resp.json()
            issue_key = data["key"]
            url = f"{_base_url()}/browse/{issue_key}"
            logger.info("Jira issue criada: %s", issue_key)
            return {"issue_key": issue_key, "url": url}
        logger.warning("Jira criar issue falhou: %s %s", resp.status_code, resp.text)
        return {"issue_key": None, "url": None, "erro": f"Erro {resp.status_code}: {resp.text}"}
    except requests.RequestException as exc:
        logger.error("Erro ao criar issue Jira: %s", exc)
        return {"issue_key": None, "url": None, "erro": str(exc)}


def fechar_issue(issue_key: str) -> bool:
    if not _configurado():
        logger.warning("Jira não configurado — ignorando fechamento de issue")
        return False
    try:
        resp = requests.get(
            f"{_base_url()}/rest/api/3/issue/{issue_key}/transitions",
            headers=_headers(),
            timeout=JIRA_TIMEOUT,
        )
        if resp.status_code != 200:
            logger.warning("Jira get transitions falhou: %s", resp.status_code)
            return False

        transitions = resp.json().get("transitions", [])
        done_id = None
        for t in transitions:
            if t["name"].lower() in ("done", "concluído", "concluido"):
                done_id = t["id"]
                break
        if not done_id and transitions:
            done_id = transitions[-1]["id"]
        if not done_id:
            logger.warning("Nenhuma transição encontrada para issue %s", issue_key)
            return False

        resp = requests.post(
            f"{_base_url()}/rest/api/3/issue/{issue_key}/transitions",
            headers=_headers(),
            json={"transition": {"id": done_id}},
            timeout=JIRA_TIMEOUT,
        )
        if resp.status_code == 204:
            logger.info("Jira issue %s fechada", issue_key)
            return True
        logger.warning("Jira fechar issue falhou: %s %s", resp.status_code, resp.text)
        return False
    except requests.RequestException as exc:
        logger.error("Erro ao fechar issue Jira: %s", exc)
        return False


def criar_ticket_offboarding(colaborador_nome: str, email: str, sistemas: list[str]) -> dict:
    lista_sistemas = "\n".join(f"- {s}" for s in sistemas)
    summary = f"OFFBOARDING: {colaborador_nome} ({email})"
    description = (
        f"Revogar acessos do colaborador {colaborador_nome} ({email}) nos seguintes sistemas:\n\n"
        f"{lista_sistemas}\n\n"
        "Prioridade: URGENTE — Executar imediatamente após confirmação do RH."
    )
    return criar_issue(summary, description, tipo="Task")
