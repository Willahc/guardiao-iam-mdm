import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

import models
from database import aplicar_indices_runtime, engine
from routers import agente, auth, billing, integracoes, lgpd, onboarding, tenant, tickets

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

models.Base.metadata.create_all(bind=engine)
aplicar_indices_runtime()

app = FastAPI(
    title="O Guardião - Enterprise IAM & MDM",
    version="2.7",
    description="Motor central de governança de acessos e blindagem de hardware. Integrações: Slack, GitHub, Jira.",
)

_cors_origins_env = os.getenv("CORS_ORIGINS", "")
_cors_origins = [o.strip() for o in _cors_origins_env.split(",") if o.strip()] or ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=_cors_origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["Interface"])
def exibir_painel_executivo():
    return FileResponse("painel.html")


app.include_router(auth.router)
app.include_router(tenant.router)
app.include_router(onboarding.router)
app.include_router(tickets.router)
app.include_router(integracoes.router)
app.include_router(agente.router)
app.include_router(lgpd.router)
app.include_router(billing.router)
