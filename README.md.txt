# 🛡️ O Guardião: IAM, MDM & Zero Trust Engine

![Python](https://img.shields.io/badge/Python-3.14-blue?style=for-the-badge&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi)
![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?style=for-the-badge&logo=sqlite)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css)

## 📌 Visão Executiva
O **Guardião** é uma Prova de Conceito (POC) de arquitetura corporativa desenvolvida para unificar a Governança de Identidades (IAM) e o Gerenciamento de Dispositivos (MDM) sob o paradigma **Zero Trust (Confiança Zero)**.

Em cenários de alta criticidade — como a proteção de plantas de engenharia, mapeamentos de obras e dados sensíveis de clientes corporativos —, não basta proteger a senha do usuário. O Guardião garante que o acesso aos sistemas em nuvem só seja concedido se a identidade do colaborador coincidir com um hardware corporativo homologado e em conformidade.

## 🚀 Funcionalidades Principais

* **Provisionamento RBAC (Role-Based Access Control):** Automação na criação de acessos e permissões com base no departamento do colaborador (ex: liberação de CRM para Vendas, e privilégios de Admin na AWS para TI).
* **Agente Físico Invisível:** Um executável nativo em background que monitora a máquina local e executa comandos de bloqueio remoto do sistema operacional.
* **Acesso Condicional (Zero Trust):** Interceptação de tentativas de login via Single Sign-On (SSO). Bloqueia automaticamente o acesso caso o usuário tente utilizar um dispositivo não gerenciado (PC pessoal), independentemente da senha estar correta.
* **Offboarding Crítico de 1 Clique:** Revogação síncrona de acessos em nuvem (Google, Slack, GitHub) e trancamento imediato da tela do notebook físico vinculado ao ex-colaborador.

## 🧠 Arquitetura Técnica
A solução foi desenhada separando o motor lógico, o banco de dados e as interfaces de usuário e máquina:

1. **Backend (FastAPI):** API RESTful assíncrona responsável pelo roteamento de comandos, regras de RBAC e validação de Acesso Condicional.
2. **Database (SQLite + SQLAlchemy):** Armazenamento relacional garantindo a integridade e unicidade dos números de série dos hardwares (prevenção de duplicidade) e o status das contas.
3. **Frontend (HTML5 + Tailwind CSS):** Painel de controle responsivo e assíncrono para o time de RH/TI, com console de logs integrados em tempo real.
4. **Agente Local (Python compilado via PyInstaller):** Script empacotado (`.exe`) operando em modo *headless* (sem console) que realiza o *heartbeat* da máquina e executa rotinas a nível de Sistema Operacional.

## ⚙️ Como Executar a POC

**Pré-requisitos:** Python 3 instalado e ambiente virtual configurado.

**1. Subindo o Motor (API):**
```bash
pip install fastapi uvicorn sqlalchemy pydantic
uvicorn main:app --reload