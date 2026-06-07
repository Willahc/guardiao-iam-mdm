from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
from auditoria import registrar_auditoria
from auth import get_usuario_atual
from database import get_db
from schemas import GitHubAdicionarRequest, JiraTicketRequest, SlackBoasVindasRequest
from services.github_service import adicionar_membro_org, listar_membros_org, remover_membro_org
from services.jira_service import criar_issue as jira_criar_issue
from services.jira_service import criar_ticket_offboarding
from services.slack_service import enviar_mensagem_boas_vindas

router = APIRouter(tags=["Integrações"], prefix="/api/v1/integracoes")


@router.post("/slack/boas-vindas")
def slack_boas_vindas(
    dados: SlackBoasVindasRequest,
    db: Session = Depends(get_db),
    usuario_atual: models.Usuario = Depends(get_usuario_atual),
):
    enviado = enviar_mensagem_boas_vindas(dados.email, dados.nome, dados.departamento)
    registrar_auditoria(
        db, usuario_atual.empresa_id, "SLACK_BOAS_VINDAS", usuario_atual.email,
        dados.email, {"enviado": enviado, "departamento": dados.departamento},
    )
    return {
        "enviado": enviado,
        "mensagem": "Mensagem enviada com sucesso" if enviado else "Usuário não encontrado no Slack ou token não configurado",
    }


@router.post("/github/adicionar")
def github_adicionar(
    dados: GitHubAdicionarRequest,
    db: Session = Depends(get_db),
    usuario_atual: models.Usuario = Depends(get_usuario_atual),
):
    resultado = adicionar_membro_org(dados.github_username)
    registrar_auditoria(
        db, usuario_atual.empresa_id, "GITHUB_ADD_MEMBER", usuario_atual.email,
        detalhes={"username": dados.github_username, "resultado": resultado},
    )
    return resultado


@router.delete("/github/remover/{username}")
def github_remover(
    username: str,
    db: Session = Depends(get_db),
    usuario_atual: models.Usuario = Depends(get_usuario_atual),
):
    resultado = remover_membro_org(username)
    registrar_auditoria(
        db, usuario_atual.empresa_id, "GITHUB_REMOVE_MEMBER", usuario_atual.email,
        detalhes={"username": username, "resultado": resultado},
    )
    return resultado


@router.get("/github/membros")
def github_membros(
    usuario_atual: models.Usuario = Depends(get_usuario_atual),
):
    return listar_membros_org()


@router.post("/jira/ticket")
def jira_ticket(
    dados: JiraTicketRequest,
    db: Session = Depends(get_db),
    usuario_atual: models.Usuario = Depends(get_usuario_atual),
):
    if dados.tipo not in ("ADMISSAO", "DEMISSAO"):
        raise HTTPException(status_code=400, detail="Tipo deve ser ADMISSAO ou DEMISSAO")
    if not dados.sistemas:
        raise HTTPException(status_code=400, detail="Informe ao menos um sistema")

    if dados.tipo == "DEMISSAO":
        resultado = criar_ticket_offboarding(dados.colaborador_nome, dados.email, dados.sistemas)
    else:
        lista = ", ".join(dados.sistemas)
        resultado = jira_criar_issue(
            summary=f"ADMISSÃO: {dados.colaborador_nome} ({dados.email})",
            description=f"Provisionar acessos para {dados.colaborador_nome} ({dados.email}) nos sistemas: {lista}",
        )

    registrar_auditoria(
        db, usuario_atual.empresa_id, "JIRA_TICKET_CRIADO", usuario_atual.email,
        dados.email, {"tipo": dados.tipo, "issue_key": resultado.get("issue_key"), "sistemas": dados.sistemas},
    )
    return resultado
