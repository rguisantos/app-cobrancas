#!/usr/bin/env python3
import pexpect
import sys

# Comando EAS login primeiro
print(">>> Fazendo login no EAS...")
login_child = pexpect.spawn('npx eas-cli login', encoding='utf-8', timeout=60)
login_child.logfile = sys.stdout

try:
    login_child.expect(['Email or username', 'email', 'Username', pexpect.TIMEOUT], timeout=30)
    print("\n>>> Enviando email...")
    login_child.sendline('rgs@hotmail.com.br')
    
    login_child.expect(['Password', 'password', 'senha', pexpect.TIMEOUT], timeout=30)
    print("\n>>> Enviando senha...")
    login_child.sendline('Rgs@79064120')
    
    login_child.expect(pexpect.EOF, timeout=30)
    print("\n>>> Login realizado!")
except Exception as e:
    print(f"\n>>> Erro no login: {e}")

# Agora fazer o update
print("\n\n>>> Iniciando EAS Update...")
update_child = pexpect.spawn(
    'npx eas-cli update --branch production --message "fix: corrige inconsistencia de deviceKey"',
    encoding='utf-8',
    timeout=180,
    cwd='/home/z/my-project/app-cobrancas'
)
update_child.logfile = sys.stdout

try:
    update_child.expect(pexpect.EOF, timeout=180)
    print("\n>>> Output final do update:")
    print(update_child.before)
except pexpect.TIMEOUT:
    print("\n>>> Timeout - output até agora:")
    print(update_child.before)
except Exception as e:
    print(f"\n>>> Erro no update: {e}")
    print(update_child.before if hasattr(update_child, 'before') else "Sem output")

print("\n>>> Status:", update_child.exitstatus if hasattr(update_child, 'exitstatus') else "Desconhecido")
