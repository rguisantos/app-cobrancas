#!/usr/bin/env python3
import pexpect
import sys

# Comando EAS build com profile preview (APK)
child = pexpect.spawn('npx eas-cli build --platform android --profile preview --clear-cache', encoding='utf-8', timeout=600)
child.logfile = sys.stdout

print(">>> Iniciando nova build com correções...")

patterns = [
    'Generate a new Android Keystore',
    'Would you like',
    'y/N',
    'Y/n',
    'yes',
    'no',
    'continue',
    'Proceed',
    pexpect.TIMEOUT,
    pexpect.EOF
]

try:
    while True:
        index = child.expect(patterns, timeout=300)
        
        if index == 0:  # Generate keystore
            print("\n>>> Respondendo sim para keystore...")
            child.sendline('y')
        elif index in [1, 2, 3, 4, 5]:  # Prompts de sim/não
            print("\n>>> Respondendo sim...")
            child.sendline('y')
        elif index == len(patterns) - 1:  # EOF
            print("\n>>> Build finalizada!")
            break
        elif index == len(patterns) - 2:  # TIMEOUT
            print("\n>>> Aguardando mais...")
            continue
            
except pexpect.TIMEOUT:
    print("\n>>> Timeout - verificando status...")
except pexpect.EOF:
    print("\n>>> Processo finalizado!")
except Exception as e:
    print(f"\n>>> Info: {e}")

print("\n>>> Output final:")
print(child.before if child.before else "Sem output adicional")
