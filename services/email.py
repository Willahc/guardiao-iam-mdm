import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASS = os.getenv("SMTP_PASS")


def enviar_notificacao_ticket(ticket, destinatario_email: str) -> bool:
    if not all([SMTP_HOST, SMTP_USER, SMTP_PASS]):
        logger.warning(
            "Variáveis SMTP não configuradas. Notificação de ticket %s não enviada.",
            ticket.id,
        )
        return False

    tipo_label = "Admissão" if ticket.tipo == "ADMISSAO" else "Demissão"
    assunto = f"[Guardião] Ticket {tipo_label} - {ticket.sistema} - {ticket.colaborador_nome}"

    html = f"""\
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #2c3e50;">Guardião IAM — Ticket de Tarefa</h2>
        <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
            <tr><td style="padding: 8px; font-weight: bold;">Sistema:</td><td style="padding: 8px;">{ticket.sistema}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Colaborador:</td><td style="padding: 8px;">{ticket.colaborador_nome} ({ticket.colaborador_email})</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Tipo:</td><td style="padding: 8px;">{tipo_label}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Status:</td><td style="padding: 8px;">{ticket.status}</td></tr>
        </table>
        <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-left: 4px solid #3498db;">
            <strong>Instruções:</strong><br>{ticket.instrucoes}
        </div>
        <p style="margin-top: 20px;">
            <a href="#" style="background: #27ae60; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                Marcar como Fechado
            </a>
        </p>
        <p style="color: #999; font-size: 12px;">Ticket ID: {ticket.id}</p>
    </body>
    </html>"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = assunto
    msg["From"] = SMTP_USER
    msg["To"] = destinatario_email
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_USER, destinatario_email, msg.as_string())
        logger.info("Email enviado para %s (ticket %s)", destinatario_email, ticket.id)
        return True
    except Exception:
        logger.exception("Falha ao enviar email para %s (ticket %s)", destinatario_email, ticket.id)
        return False
