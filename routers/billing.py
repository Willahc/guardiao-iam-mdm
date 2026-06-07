from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
from auditoria import PLANOS_CONFIG, registrar_auditoria
from auth import get_usuario_atual, require_admin
from database import get_db
from schemas import UpgradePlanoRequest

router = APIRouter(tags=["Billing"], prefix="/api/v1/billing")


@router.get("/plano")
def obter_plano(
    db: Session = Depends(get_db),
    usuario_atual: models.Usuario = Depends(get_usuario_atual),
):
    plano = db.query(models.PlanoEmpresa).filter(
        models.PlanoEmpresa.empresa_id == usuario_atual.empresa_id,
    ).first()

    usuarios_ativos = db.query(models.Usuario).filter(
        models.Usuario.empresa_id == usuario_atual.empresa_id,
        models.Usuario.ativo == True,  # noqa: E712
    ).count()

    if not plano:
        plano_nome = "STARTER"
        valor = PLANOS_CONFIG["STARTER"]["valor_por_usuario"]
    else:
        plano_nome = plano.plano
        valor = plano.valor_por_usuario

    return {
        "plano": plano_nome,
        "descricao": PLANOS_CONFIG.get(plano_nome, {}).get("descricao", ""),
        "usuarios_ativos": usuarios_ativos,
        "valor_por_usuario_centavos": valor,
        "valor_por_usuario_display": f"R${valor / 100:.2f}",
        "estimativa_mensal_centavos": valor * usuarios_ativos,
        "estimativa_mensal_display": f"R${(valor * usuarios_ativos) / 100:.2f}",
    }


@router.post("/upgrade")
def upgrade_plano(
    dados: UpgradePlanoRequest,
    db: Session = Depends(get_db),
    admin: models.Usuario = Depends(require_admin),
):
    if dados.plano not in PLANOS_CONFIG:
        raise HTTPException(status_code=400, detail=f"Plano inválido. Opções: {', '.join(PLANOS_CONFIG.keys())}")
    if dados.plano == "ENTERPRISE":
        raise HTTPException(status_code=400, detail="Plano Enterprise requer contato comercial")

    config = PLANOS_CONFIG[dados.plano]
    plano = db.query(models.PlanoEmpresa).filter(
        models.PlanoEmpresa.empresa_id == admin.empresa_id,
    ).first()

    proximo = datetime.now(timezone.utc) + timedelta(days=30)
    if plano:
        plano.plano = dados.plano
        plano.valor_por_usuario = config["valor_por_usuario"]
        plano.proximo_vencimento = proximo
        plano.status = "ATIVO"
    else:
        plano = models.PlanoEmpresa(
            empresa_id=admin.empresa_id,
            plano=dados.plano,
            valor_por_usuario=config["valor_por_usuario"],
            proximo_vencimento=proximo,
        )
        db.add(plano)

    db.commit()
    db.refresh(plano)

    usuarios_ativos = db.query(models.Usuario).filter(
        models.Usuario.empresa_id == admin.empresa_id,
        models.Usuario.ativo == True,  # noqa: E712
    ).count()

    registrar_auditoria(db, admin.empresa_id, "BILLING_UPGRADE", admin.email, detalhes={"plano": dados.plano})

    return {
        "status": "sucesso",
        "plano": plano.plano,
        "descricao": config["descricao"],
        "valor_por_usuario_display": f"R${config['valor_por_usuario'] / 100:.2f}",
        "usuarios_ativos": usuarios_ativos,
        "estimativa_mensal_display": f"R${(config['valor_por_usuario'] * usuarios_ativos) / 100:.2f}",
    }


@router.get("/usuarios-ativos")
def contar_usuarios_ativos(
    db: Session = Depends(get_db),
    usuario_atual: models.Usuario = Depends(get_usuario_atual),
):
    count = db.query(models.Usuario).filter(
        models.Usuario.empresa_id == usuario_atual.empresa_id,
        models.Usuario.ativo == True,  # noqa: E712
    ).count()
    return {"usuarios_ativos": count}
