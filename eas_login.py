#!/usr/bin/env python3
import pexpect
import sys

# Comando EAS login
child = pexpect.spawn('npx eas-cli login', encoding='utf-8', timeout=60)

# Log para debug
child.logfile = sys.stdout

try:
    # Esperar prompt de email
    child.expect(['Email or username', 'email', 'Username', pexpect.TIMEOUT], timeout=30)
    print("\n>>> Enviando email...")
    child.sendline('rgs@hotmail.com.br')
    
    # Esperar prompt de senha
    child.expect(['Password', 'password', 'senha', pexpect.TIMEOUT], timeout=30)
    print("\n>>> Enviando senha...")
    child.sendline('Rgs@79064120')
    
    # Esperar resultado
    child.expect(pexpect.EOF, timeout=30)
    print("\n>>> Output final:")
    print(child.before)
    
except pexpect.TIMEOUT:
    print("\n>>> Timeout - output até agora:")
    print(child.before)
except Exception as e:
    print(f"\n>>> Erro: {e}")
    print(child.before if hasattr(child, 'before') else "Sem output")

print("\n>>> Status:", child.exitstatus if hasattr(child, 'exitstatus') else "Desconhecido")
