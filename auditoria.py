from sqlalchemy.orm import Session

import models


def registrar_auditoria(
    db: Session,
    empresa_id: int,
    acao: str,
    executado_por: str,
    colaborador_email: str | None = None,
    detalhes: dict | None = None,
):
    registro = models.RegistroAuditoria(
        empresa_id=empresa_id,
        acao=acao,
        executado_por=executado_por,
        colaborador_email=colaborador_email,
        detalhes=detalhes,
    )
    db.add(registro)
    db.commit()


PLANOS_CONFIG = {
    "STARTER": {"valor_por_usuario": 2900, "descricao": "Tickets + Agente Básico"},
    "PRO": {"valor_por_usuario": 4900, "descricao": "+ LGPD + Auditoria + Dispositivos Ilimitados"},
    "ENTERPRISE": {"valor_por_usuario": 0, "descricao": "Sob consulta"},
}
