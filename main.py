from datetime import timedelta

from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.responses import FileResponse
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from auth import (
    hash_senha,
    verificar_senha,
    criar_access_token,
    get_usuario_atual,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    SECRET_KEY,
    ALGORITHM,
)
from database import engine, get_db

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


class RegistroEmpresa(BaseModel):
    nome_empresa: str
    slug: str
    nome_admin: str
    email_admin: str
    senha_admin: str


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
