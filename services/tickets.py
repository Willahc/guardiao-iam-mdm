from sqlalchemy.orm import Session

import models

INSTRUCOES_TEMPLATES = {
    "ADMISSAO": (
        "Criar usuário {nome} ({email}) no {sistema}. "
        "Departamento: {departamento}. Prazo: 24h."
    ),
    "DEMISSAO": (
        "Revogar todos os acessos de {nome} ({email}) no {sistema} imediatamente. "
        "Confirmar via e-mail para RH."
    ),
}


def gerar_tickets_sem_api(
    colaborador_nome: str,
    colaborador_email: str,
    tipo: str,
    empresa_id: int,
    departamento: str,
    sistemas: list[str],
    db: Session,
) -> list[models.TicketTarefa]:
    template = INSTRUCOES_TEMPLATES.get(tipo)
    if not template:
        raise ValueError(f"Tipo inválido: {tipo}. Use ADMISSAO ou DEMISSAO.")

    tickets = []
    for sistema in sistemas:
        instrucoes = template.format(
            nome=colaborador_nome,
            email=colaborador_email,
            sistema=sistema,
            departamento=departamento,
        )
        ticket = models.TicketTarefa(
            empresa_id=empresa_id,
            colaborador_nome=colaborador_nome,
            colaborador_email=colaborador_email,
            tipo=tipo,
            sistema=sistema,
            instrucoes=instrucoes,
        )
        db.add(ticket)
        tickets.append(ticket)

    db.commit()
    for ticket in tickets:
        db.refresh(ticket)
    return tickets
