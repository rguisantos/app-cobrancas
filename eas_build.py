#!/usr/bin/env python3
import pexpect
import sys

# Comando EAS build
child = pexpect.spawn('npx eas-cli build --platform android --profile preview', encoding='utf-8', timeout=300)

# Log para debug
child.logfile = sys.stdout

try:
    # Esperar diferentes prompts possíveis
    patterns = [
        'Generate a new Android Keystore',
        'Would you like to automatically create an EAS project',
        'y/N',
        'Y/n',
        'project id',
        pexpect.TIMEOUT
    ]
    
    index = child.expect(patterns, timeout=60)
    
    if index == 0:  # Generate keystore
        print("\n>>> Respondendo sim para keystore...")
        child.sendline('y')
    elif index == 1 or index == 2:  # Create EAS project
        print("\n>>> Respondendo sim para criar projeto EAS...")
        child.sendline('y')
    elif index == 3:  # Y/n
        print("\n>>> Respondendo sim...")
        child.sendline('Y')
    
    # Continuar esperando por mais prompts
    while True:
        try:
            child.expect(['y/N', 'Y/n', 'yes', 'no', 'Continue', pexpect.TIMEOUT], timeout=30)
            print("\n>>> Respondendo sim...")
            child.sendline('y')
        except:
            break
    
    # Esperar resultado final
    child.expect(pexpect.EOF, timeout=240)
    print("\n>>> Output final:")
    print(child.before)
    
except pexpect.TIMEOUT:
    print("\n>>> Timeout - output até agora:")
    print(child.before)
except Exception as e:
    print(f"\n>>> Erro: {e}")
    print(child.before if hasattr(child, 'before') else "Sem output")

print("\n>>> Status:", child.exitstatus if hasattr(child, 'exitstatus') else "Desconhecido")
