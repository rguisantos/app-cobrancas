#!/usr/bin/env python3
import subprocess
import time
import sys

build_id = "0a0ddd17-2e86-4a23-a541-5e248fe05870"
max_attempts = 30  # 15 minutos max

print(f">>> Monitorando build {build_id}...")
print(f">>> Verificando a cada 30 segundos...")

for attempt in range(max_attempts):
    try:
        result = subprocess.run(
            ['npx', 'eas-cli', 'build:view', build_id],
            capture_output=True,
            text=True,
            timeout=60,
            cwd='/home/z/my-project/app-cobrancas'
        )
        
        output = result.stdout + result.stderr
        
        # Verificar status
        if 'Status                   finished' in output or 'Status: finished' in output:
            print("\n>>> BUILD FINALIZADA!")
            print(output)
            
            # Extrair URL do APK
            if 'Application Archive URL' in output:
                lines = output.split('\n')
                for line in lines:
                    if 'Application Archive URL' in line:
                        print(f"\n>>> APK URL: {line}")
            
            sys.exit(0)
            
        elif 'Status                   errored' in output or 'error' in output.lower():
            print("\n>>> BUILD COM ERRO!")
            print(output)
            sys.exit(1)
            
        else:
            elapsed = (attempt + 1) * 30
            print(f"[{elapsed}s] Build em progresso... aguardando")
            
    except subprocess.TimeoutExpired:
        print(">>> Timeout ao verificar status, tentando novamente...")
    except Exception as e:
        print(f">>> Erro: {e}")
    
    time.sleep(30)

print("\n>>> Timeout final - build ainda em progresso")
print(">>> Verifique em: https://expo.dev/accounts/rguisantos/projects/app-cobrancas/builds/" + build_id)
