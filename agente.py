import time
import requests
import ctypes
import sys

# ==========================================
# CONFIGURAÇÕES DO AGENTE
# ==========================================
URL_API = "http://127.0.0.1:8000/api/v1/agent/status"
MEU_SERIAL = "DELL-XYZ123" # O serial que usamos no teste de Onboarding
TEMPO_VERIFICACAO = 5 # O agente vai perguntar para a API a cada 5 segundos

def trancar_tela_windows():
    print("\n🚨 [ALERTA DE SEGURANÇA] Dispositivo bloqueado pela TI!")
    print("🔒 Trancando a área de trabalho do Windows...\n")
    # Este é o comando nativo do Windows (C++) que joga o usuário para a tela de senha
    ctypes.windll.user32.LockWorkStation()

def rodar_agente():
    print(f"🛡️ Agente do Guardião iniciado.")
    print(f"💻 Monitorando a máquina física (Serial: {MEU_SERIAL})")
    print("Pressione CTRL+C para parar o agente.\n")
    
    while True:
        try:
            # Bate na porta da nossa API perguntando o status
            resposta = requests.get(f"{URL_API}/{MEU_SERIAL}")
            dados = resposta.json()
            
            status_atual = dados.get("status")
            
            if status_atual == "locked":
                trancar_tela_windows()
                # Opcional: break para o agente parar de rodar após bloquear, 
                # ou deixa rodando para manter a máquina travada se o usuário tentar logar de novo.
                sys.exit() 
            else:
                print(f"✅ [{time.strftime('%H:%M:%S')}] Status OK. Acesso permitido.")
                
        except requests.exceptions.ConnectionError:
            print("⚠️ Sem conexão com o servidor do Guardião. Tentando novamente...")
            
        # Espera 5 segundos e repete o loop
        time.sleep(TEMPO_VERIFICACAO)

if __name__ == "__main__":
    rodar_agente()