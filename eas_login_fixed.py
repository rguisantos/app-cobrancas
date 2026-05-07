#!/usr/bin/env python3
import pexpect
import sys

# Comando EAS login
child = pexpect.spawn('npx --yes eas-cli login', encoding='utf-8', timeout=120)
child.logfile = sys.stdout

print(">>> Iniciando login EAS...")

patterns = [
    'Email or username',
    'Email',
    'email',
    'Username',
    'Password',
    'password',
    'senha',
    'Logged in',
    'Success',
    pexpect.TIMEOUT,
    pexpect.EOF
]

try:
    while True:
        index = child.expect(patterns, timeout=60)
        
        if index in [0, 1, 2, 3]:  # Email prompt
            print("\n>>> Enviando email...")
            child.sendline('rgs@hotmail.com.br')
        elif index in [4, 5, 6]:  # Password prompt
            print("\n>>> Enviando senha...")
            child.sendline('Rgs@79064120')
        elif index in [7, 8]:  # Logged in / Success
            print("\n>>> Login realizado com sucesso!")
            break
        elif index == 9:  # TIMEOUT
            print("\n>>> Aguardando...")
            continue
        elif index == 10:  # EOF
            print("\n>>> Processo finalizado!")
            break
            
except pexpect.TIMEOUT:
    print("\n>>> Timeout - output até agora:")
    print(child.before)
except pexpect.EOF:
    print("\n>>> Processo finalizado!")
except Exception as e:
    print(f"\n>>> Info: {e}")

print("\n>>> Output final:")
print(child.before if child.before else "Sem output adicional")
