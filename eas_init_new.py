#!/usr/bin/env python3
import pexpect
import sys
import os

os.environ['EXPO_TOKEN'] = 't9fdwUupuznwM_oNSQKYhwGTgDWJBjBKrq1SOwJ4'

child = pexpect.spawn('npx --yes eas-cli init', encoding='utf-8', timeout=120, cwd='/home/z/my-project/app-cobrancas')
child.logfile = sys.stdout

print(">>> Iniciando configuração do projeto EAS...")

patterns = [
    'Would you like to create',
    'Generate a new Android Keystore',
    'y/N',
    'Y/n',
    'yes',
    'no',
    pexpect.TIMEOUT,
    pexpect.EOF
]

try:
    while True:
        index = child.expect(patterns, timeout=60)

        if index == 0:  # Would you like to create
            print("\n>>> Respondendo sim para criar projeto...")
            child.sendline('y')
        elif index in [1, 2, 3, 4, 5]:  # Prompts de sim/não
            print("\n>>> Respondendo sim...")
            child.sendline('y')
        elif index == 6:  # TIMEOUT
            print("\n>>> Aguardando...")
            continue
        elif index == 7:  # EOF
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
