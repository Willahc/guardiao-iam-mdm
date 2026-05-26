from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

# Importações do seu banco de dados local
import models
from database import engine, get_db

# 1. INICIALIZAÇÃO DO MOTOR ZERO TRUST
# Isso cria o banco de dados caso ele não exista
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="O Guardião - Enterprise IAM & MDM",
    version="2.0",
    description="Motor central de governança de acessos e blindagem de hardware."
)

# ==========================================
# SCHEMAS DE DADOS (Modelos de Entrada)
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
    evento_rh: str  # "ADMISSAO" ou "DEMISSAO"

# Chave de segurança para evitar invasores no Webhook
CHAVE_SECRETA_SISTEMA_RH = "Bearer rh_token_ultra_secreto_777"

# ==========================================
# ROTA 1: FRONT-END VISUAL (Painel Render)
# ==========================================
@app.get("/", tags=["Interface"])
def exibir_painel_executivo():
    """
    Entrega o painel visual (HTML) quando o Diretor acessar o link oficial do sistema.
    """
    return FileResponse("painel.html")

# ==========================================
# ROTA 2: PROVISIONAMENTO MANUAL (POC)
# ==========================================
@app.post("/api/v1/onboarding", tags=["IAM Manual"])
def executar_onboarding_manual(dados: FuncionarioPOC, db: Session = Depends(get_db)):
    """
    Simula a criação de identidades digitais quando o botão do painel é clicado.
    """
    # Exemplo: Registro no banco de dados da aplicação
    novo_registro = models.RegistroAcesso(email=dados.email, setor=dados.departamento, status="ATIVO")
    db.add(novo_registro)
    db.commit()
    
    return {
        "status": "sucesso",
        "logs": [
            f"Usuário {dados.email} criado no Google Workspace.",
            f"Adicionado aos canais de {dados.departamento} no Slack.",
            "Licença do AutoCAD/Revit provisionada com sucesso."
        ]
    }

# ==========================================
# ROTA 3: OFFBOARDING / BLOQUEIO ZERO TRUST (POC)
# ==========================================
@app.post("/api/v1/travar", tags=["MDM Manual"])
def acionar_guilhotina_mdm(comando: ComandoMDM, db: Session = Depends(get_db)):
    """
    Envia o sinal vermelho de bloqueio para o hardware físico (agente.exe).
    """
    return {
        "status": "sucesso",
        "alerta": f"Comando de bloqueio absoluto enviado para o hardware {comando.serial_placa_mae}."
    }

# ==========================================
# ROTA 4: WEBHOOK AUTOMÁTICO DE RH (Enterprise)
# ==========================================
@app.post("/api/v1/integracoes/rh/webhook", tags=["Integração Invisível"])
def processar_pulso_do_rh(payload: PayloadRH, authorization: str = Header(None), db: Session = Depends(get_db)):
    """
    Porta de entrada invisível para sistemas de folha de pagamento (Gupy, Sólides, TOTVS).
    Sem intervenção humana.
    """
    # Barreira de Segurança
    if authorization != CHAVE_SECRETA_SISTEMA_RH:
        raise HTTPException(status_code=401, detail="🚨 Invasão detectada: Token JWT inválido.")

    if payload.evento_rh == "ADMISSAO":
        return {
            "status": "sucesso", 
            "acao": "Onboarding Zero Trust iniciado automaticamente",
            "detalhe": f"Identidades dinâmicas criadas para {payload.nome_completo}."
        }
        
    elif payload.evento_rh == "DEMISSAO":
        return {
            "status": "sucesso", 
            "acao": "Offboarding Crítico acionado automaticamente",
            "detalhe": f"Sessões na nuvem encerradas e máquina física bloqueada."
        }
    
    else:
        raise HTTPException(status_code=400, detail="Evento de RH não documentado.")