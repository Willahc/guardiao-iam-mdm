import wmi
import time
import requests
import ctypes

def obter_serial_da_placa_mae():
    """
    Entra no núcleo do Windows (WMI) e extrai o número de série físico da BIOS.
    """
    try:
        computador = wmi.WMI()
        for bios in computador.Win32_BIOS():
            return bios.SerialNumber.strip()
    except Exception:
        return "HARDWARE_NAO_IDENTIFICADO"

MEU_SERIAL_REAL = obter_serial_da_placa_mae()

def travar_tela():
    ctypes.windll.user32.LockWorkStation()

def iniciar_agente():
    # Loop infinito rodando em background
    while True:
        try:
            # Em um cenário real, o agente faria um "GET" na API enviando o MEU_SERIAL_REAL
            # para checar se ele recebeu um comando de bloqueio.
            # Ex: resposta = requests.get(f"http://127.0.0.1:8000/api/v1/status/{MEU_SERIAL_REAL}")
            pass
        except:
            pass
        
        time.sleep(5) # Pausa de 5 segundos para não sobrecarregar o processador

if __name__ == "__main__":
    iniciar_agente()