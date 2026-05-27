import logging
import os
import platform
import subprocess
import sys
import time

import requests
from dotenv import load_dotenv

load_dotenv(".agent.env")
load_dotenv()

AGENT_TOKEN = os.getenv("AGENT_TOKEN", "")
SERVER_URL = os.getenv("SERVER_URL", "http://127.0.0.1:8000")
HEARTBEAT_INTERVAL = int(os.getenv("HEARTBEAT_INTERVAL", "300"))
VERSION = "1.0.0"

logging.basicConfig(
    filename="agente.log",
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("guardiao-agente")
logger.addHandler(logging.StreamHandler(sys.stdout))


def obter_serial_placa_mae() -> str:
    sistema = platform.system()
    try:
        if sistema == "Windows":
            result = subprocess.run(
                ["wmic", "baseboard", "get", "serialnumber"],
                capture_output=True, text=True, timeout=10,
            )
            lines = [l.strip() for l in result.stdout.strip().splitlines() if l.strip()]
            return lines[-1] if len(lines) > 1 else "DESCONHECIDO"
        elif sistema == "Linux":
            result = subprocess.run(
                ["cat", "/sys/class/dmi/id/board_serial"],
                capture_output=True, text=True, timeout=10,
            )
            serial = result.stdout.strip()
            return serial if serial else "DESCONHECIDO"
        elif sistema == "Darwin":
            result = subprocess.run(
                ["ioreg", "-l"],
                capture_output=True, text=True, timeout=10,
            )
            for line in result.stdout.splitlines():
                if "IOPlatformSerialNumber" in line:
                    return line.split('"')[-2]
    except Exception as e:
        logger.warning("Falha ao obter serial: %s", e)
    return "DESCONHECIDO"


def travar_estacao():
    sistema = platform.system()
    logger.warning("Comando LOCK recebido — travando estação")
    try:
        if sistema == "Windows":
            import ctypes
            ctypes.windll.user32.LockWorkStation()
        elif sistema == "Linux":
            subprocess.run(["loginctl", "lock-sessions"], timeout=10)
        elif sistema == "Darwin":
            subprocess.run(
                ["/System/Library/CoreServices/Menu Extras/User.menu/Contents/Resources/CGSession", "-suspend"],
                timeout=10,
            )
    except Exception as e:
        logger.error("Falha ao travar estação: %s", e)


def heartbeat(serial: str):
    url = f"{SERVER_URL}/api/v1/agente/ping"
    payload = {
        "serial_placa_mae": serial,
        "versao_agente": VERSION,
        "hostname": platform.node(),
    }
    headers = {"X-Agent-Token": AGENT_TOKEN}

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        logger.info("Heartbeat OK — comando: %s", data.get("comando"))
        if data.get("comando") == "LOCK":
            travar_estacao()
    except requests.RequestException as e:
        logger.error("Heartbeat falhou: %s", e)


def iniciar_agente():
    if not AGENT_TOKEN:
        logger.error("AGENT_TOKEN não configurado. Defina em .agent.env ou variável de ambiente.")
        sys.exit(1)

    serial = obter_serial_placa_mae()
    logger.info("Agente iniciado — serial=%s, servidor=%s, intervalo=%ds", serial, SERVER_URL, HEARTBEAT_INTERVAL)

    while True:
        heartbeat(serial)
        time.sleep(HEARTBEAT_INTERVAL)


if __name__ == "__main__":
    iniciar_agente()
