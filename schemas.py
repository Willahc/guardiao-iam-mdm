from typing import Optional

from pydantic import BaseModel


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
    serial_placa_mae: Optional[str] = None


class RegistroEmpresa(BaseModel):
    nome_empresa: str
    slug: str
    nome_admin: str
    email_admin: str
    senha_admin: str


class GerarTicketsRequest(BaseModel):
    colaborador_nome: str
    colaborador_email: str
    tipo: str
    departamento: str
    sistemas: list[str]


class RegistrarDispositivoRequest(BaseModel):
    serial_placa_mae: str
    hostname: str
    sistema_operacional: Optional[str] = None
    usuario_email: Optional[str] = None


class AgentePingRequest(BaseModel):
    serial_placa_mae: str
    versao_agente: Optional[str] = None
    hostname: Optional[str] = None


class UpgradePlanoRequest(BaseModel):
    plano: str


class SlackBoasVindasRequest(BaseModel):
    email: str
    nome: str
    departamento: str


class GitHubAdicionarRequest(BaseModel):
    github_username: str


class JiraTicketRequest(BaseModel):
    colaborador_nome: str
    email: str
    tipo: str
    sistemas: list[str]


class BulkLockRequest(BaseModel):
    seriais: list[str]


class VincularDispositivoRequest(BaseModel):
    usuario_email: str
