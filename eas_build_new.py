#!/usr/bin/env python3
import pexpect
import sys
import time

# Comando EAS build
child = pexpect.spawn('npx eas-cli build --platform android --profile preview', encoding='utf-8', timeout=300)
child.logfile = sys.stdout

print(">>> Iniciando build...")

try:
    # Aguardar finalização
    child.expect(pexpect.EOF, timeout=300)
    print("\n>>> Output final:")
    print(child.before if child.before else "Sem output adicional")
except pexpect.TIMEOUT:
    print("\n>>> Build ainda em progresso...")
    print(child.before if child.before else "")
except Exception as e:
    print(f"\n>>> Erro/Info: {e}")
    print(child.before if hasattr(child, 'before') and child.before else "")

print("\n>>> Verificando status...")
