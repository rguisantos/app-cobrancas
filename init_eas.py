#!/usr/bin/env python3
"""
Script para inicializar projeto EAS
"""

import os
import subprocess
import sys

# Configurar token
os.environ['EXPO_TOKEN'] = 't9OHl19nUtLrGoxrnsL-zKt_TbqZl-afUeRCiNOh'

# Diretório do projeto
project_dir = '/home/z/my-project/app-cobrancas'

# Comando de init
cmd = ['npx', 'eas-cli', 'init', '--id']

print(f"🔧 Inicializando projeto EAS no diretório: {project_dir}")

# Executar
result = subprocess.run(
    cmd,
    cwd=project_dir,
    env=os.environ,
    capture_output=True,
    text=True
)

print("STDOUT:", result.stdout)
print("STDERR:", result.stderr)

sys.exit(result.returncode)
