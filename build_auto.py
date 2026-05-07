#!/usr/bin/env python3
"""
Script para criar projeto EAS e fazer build
"""

import os
import subprocess
import sys

# Configurar token
os.environ['EXPO_TOKEN'] = 't9OHl19nUtLrGoxrnsL-zKt_TbqZl-afUeRCiNOh'

# Diretório do projeto
project_dir = '/home/z/my-project/app-cobrancas'

# Comando de build com auto-create
cmd = [
    'npx', 'eas-cli', 'build',
    '--platform', 'android',
    '--profile', 'preview',
    '--non-interactive'
]

print(f"🔧 Criando projeto e iniciando build no diretório: {project_dir}")

# Executar
result = subprocess.run(
    cmd,
    cwd=project_dir,
    env=os.environ,
    capture_output=False,
    text=True
)

sys.exit(result.returncode)
