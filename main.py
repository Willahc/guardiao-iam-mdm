from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import engine, get_db
import models
from datetime import datetime, timezone
from fastapi.responses import FileResponse

# Cria o banco de dados
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="O Guardião - IAM/MDM Engine")

# Liberação de acesso para o Painel HTML (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# SCHEMAS (Atualizado com Departamento)
# ==========================================
class OnboardingRequest(BaseModel):
    name: str
    email: str
    device_serial: str
    department: str # Novo campo obrigatório

class OffboardingRequest(BaseModel):
    email: str

# ==========================================
# ROTAS DA API
# ==========================================
@app.get("/")
def read_root():
    return {"status": "O Guardião está online!"}

# --- ROTA 1: ONBOARDING INTELIGENTE (RBAC) ---
@app.post("/api/v1/onboarding")
def executar_onboarding(request: OnboardingRequest, db: Session = Depends(get_db)):
    # 1. Criação do dispositivo no banco
    novo_device = models.Device(
        serial=request.device_serial,
        so_type="windows", 
        status="active"
    )
    db.add(novo_device)
    db.commit()
    db.refresh(novo_device)

    # 2. Criação do usuário vinculado ao dispositivo
    novo_usuario = models.User(
        name=request.name,
        email=request.email,
        device_id=novo_device.id, 
        status="active"
    )
    db.add(novo_usuario)
    db.commit()
    db.refresh(novo_usuario)

    # 3. Lógica de Perfis de Acesso por Departamento (RBAC)
    if request.department.lower() == "ti":
        logs_simulados = [
            f"🌐 Google Workspace: E-mail {request.email} adicionado ao grupo 'TI-Admin'.",
            f"💬 Slack: Canais técnicos vinculados automaticamente: #infra, #dev-ops e #seguranca.",
            f"🚀 AWS Console: Acesso IAM criado com permissão de 'AdministratorAccess'.",
            f"🛡️ MDM: Máquina física {request.device_serial} configurada com privilégios de Admin local e PowerShell liberado."
        ]
    elif request.department.lower() == "vendas":
        logs_simulados = [
            f"🌐 Google Workspace: E-mail {request.email} adicionado às listas de distribuição 'Comercial-BR'.",
            f"💬 Slack: Canais de negócios vinculados automaticamente: #vendas-geral, #leads e #metas.",
            f"📊 CRM HubSpot: Conta criada com perfil estrito de 'Visualização e Edição de Carteira Própria'.",
            f"🛡️ MDM: Máquina física {request.device_serial} bloqueada por GPO: Proibido instalar softwares de terceiros e USB de armazenamento desativado."
        ]
    else:
        logs_simulados = [
            f"🌐 Google Workspace: E-mail {request.email} criado no grupo Geral.",
            f"💬 Slack: Canais padrão vinculados: #geral e #avisos.",
            f"🛡️ MDM: Máquina física {request.device_serial} registrada com políticas padrão de usuário comum."
        ]

    return {
        "message": f"Onboarding de {request.name} ({request.department}) concluído com sucesso!",
        "logs": logs_simulados
    }

# --- ROTA 2: OFFBOARDING ---
@app.post("/api/v1/offboarding")
def executar_offboarding(request: OffboardingRequest, db: Session = Depends(get_db)):
    usuario = db.query(models.User).filter(models.User.email == request.email).first()
    
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado no sistema.")

    device = db.query(models.Device).filter(models.Device.id == usuario.device_id).first()
    usuario.status = "suspended"
    
    if device:
        device.status = "locked"
        device.locked_at = datetime.now(timezone.utc)
    
    db.commit()

    logs_simulados = [
        f"🚨 Comando MDM: Tela do notebook serial '{device.serial if device else 'Desconhecido'}' bloqueada remotamente.",
        f"🚫 Google Workspace: Sessão derrubada e conta {request.email} suspensa.",
        f"🚫 Slack: Acesso revogado do workspace.",
        f"🚫 GitHub/HubSpot: Credenciais e tokens de acesso revogados imediatamente."
    ]

    return {
        "message": f"Offboarding crítico executado com sucesso para {usuario.name}.",
        "logs": logs_simulados
    }

# --- ROTA 3: COMUNICAÇÃO DO AGENTE ---
@app.get("/api/v1/agent/status/{serial}")
def verificar_status_maquina(serial: str, db: Session = Depends(get_db)):
    device = db.query(models.Device).filter(models.Device.serial == serial).first()
    if not device:
        return {"status": "desconhecido"}
    return {"status": device.status}
# ==========================================
# SCHEMA DE LOGIN (Zero Trust)
# ==========================================
class LoginRequest(BaseModel):
    email: str
    password: str # Na vida real seria validado, aqui vamos focar no dispositivo
    agent_serial: str # O segredo: o agente injeta isso no login invisivelmente

# --- ROTA 4: LOGIN COM ACESSO CONDICIONAL (ZERO TRUST) ---
@app.post("/api/v1/login")
def simular_login_sso(request: LoginRequest, db: Session = Depends(get_db)):
    # 1. Verifica se o usuário existe e está ativo
    usuario = db.query(models.User).filter(models.User.email == request.email).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    
    if usuario.status != "active":
        raise HTTPException(status_code=403, detail="Conta suspensa pelo RH.")

    # 2. Busca o dispositivo oficial amarrado a este usuário
    device_oficial = db.query(models.Device).filter(models.Device.id == usuario.device_id).first()

    # 3. A REGRA DE OURO (Zero Trust): Compara o serial enviado com o oficial
    if not request.agent_serial or request.agent_serial != device_oficial.serial:
        # TENTATIVA DE ACESSO POR COMPUTADOR PESSOAL / SEM AGENTE
        return {
            "status": "bloqueado",
            "message": "🔒 ACESSO NEGADO: Dispositivo não gerenciado.",
            "detalhe": "Você está tentando acessar dados corporativos fora de um equipamento homologado. O login foi bloqueado por segurança."
        }

    # 4. Verifica se o dispositivo não foi bloqueado no botão vermelho
    if device_oficial.status != "active":
        return {
            "status": "bloqueado",
            "message": "🔒 ACESSO NEGADO: Dispositivo bloqueado.",
            "detalhe": "Este equipamento teve o acesso revogado pela administração."
        }

    # 5. SUCESSO: Usuário correto + Dispositivo correto e com Agente
    return {
        "status": "permitido",
        "message": "✅ ACESSO LIBERADO: Ambiente Seguro.",
        "detalhe": f"Login autorizado para {usuario.name}. Dispositivo {device_oficial.serial} validado em conformidade."
    }

from fastapi import Header

# ==========================================
# SCHEMA DO WEBHOOK DE RH (Nível Enterprise)
# ==========================================
class PayloadRH(BaseModel):
    nome_completo: str
    email_corporativo: str
    departamento: str
    evento_rh: str 

CHAVE_SECRETA_SISTEMA_RH = "Bearer rh_token_ultra_secreto_777"

# --- ROTA 5: INTEGRAÇÃO INVISÍVEL COM SISTEMA DE FOLHA ---
@app.post("/api/v1/integracoes/rh/webhook")
def processar_pulso_do_rh(payload: PayloadRH, authorization: str = Header(None), db: Session = Depends(get_db)):
    
    # Barreira de Segurança
    if authorization != CHAVE_SECRETA_SISTEMA_RH:
        raise HTTPException(status_code=401, detail="🚨 Invasão detectada: Token inválido.")

    if payload.evento_rh == "ADMISSAO":
        return {
            "status": "sucesso", 
            "acao": "Onboarding Zero Trust iniciado",
            "detalhe": f"Provisionando licenças dinâmicas para {payload.nome_completo} ({payload.departamento})"
        }
        
    elif payload.evento_rh == "DEMISSAO":
        return {
            "status": "sucesso", 
            "acao": "Offboarding Crítico acionado",
            "detalhe": f"Sessões de {payload.email_corporativo} derrubadas. Notebook travado."
        }
    
    else:
        raise HTTPException(status_code=400, detail="Evento de RH não reconhecido.")

# --- ROTA RAIZ: SERVIR O PAINEL VISUAL ---
@app.get("/")
def exibir_painel():
    return FileResponse("painel.html")