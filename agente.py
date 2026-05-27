import logging
import os
import platform
import socket
import subprocess
import sys
import time
import uuid

import requests
from dotenv import load_dotenv

load_dotenv(".agent.env")
load_dotenv()

AGENT_TOKEN = os.getenv("AGENT_TOKEN", "")
SERVER_URL = os.getenv("SERVER_URL", "http://127.0.0.1:8000")
HEARTBEAT_INTERVAL = int(os.getenv("HEARTBEAT_INTERVAL", "300"))
SERIAL_OVERRIDE = os.getenv("SERIAL_OVERRIDE", "")
VERSION = "1.1.0"

logging.basicConfig(
    filename="agente.log",
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("guardiao-agente")
logger.addHandler(logging.StreamHandler(sys.stdout))


def _fallback_serial() -> str:
    return f"{socket.gethostname()}-{uuid.getnode():012x}"


def obter_serial_placa_mae() -> str:
    if SERIAL_OVERRIDE:
        logger.info("Usando SERIAL_OVERRIDE: %s", SERIAL_OVERRIDE)
        return SERIAL_OVERRIDE

    sistema = platform.system()
    try:
        if sistema == "Windows":
            for cmd in [
                ["powershell", "-Command", "(Get-WmiObject Win32_ComputerSystemProduct).UUID"],
                ["powershell", "-Command", "(Get-CimInstance Win32_BaseBoard).SerialNumber"],
            ]:
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
                serial = result.stdout.strip()
                if serial and serial not in ("", "None", "To Be Filled By O.E.M."):
                    return serial
            return _fallback_serial()
        elif sistema == "Linux":
            for path in ["/sys/class/dmi/id/board_serial", "/sys/class/dmi/id/product_uuid"]:
                try:
                    result = subprocess.run(
                        ["cat", path],
                        capture_output=True, text=True, timeout=10,
                    )
                    serial = result.stdout.strip()
                    if serial and serial not in ("", "None"):
                        return serial
                except Exception:
                    continue
            return _fallback_serial()
        elif sistema == "Darwin":
            result = subprocess.run(
                ["ioreg", "-l"],
                capture_output=True, text=True, timeout=10,
            )
            for line in result.stdout.splitlines():
                if "IOPlatformSerialNumber" in line:
                    return line.split('"')[-2]
            return _fallback_serial()
    except Exception as e:
        logger.warning("Falha ao obter serial: %s", e)
    return _fallback_serial()


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
