#!/usr/bin/env python3
"""
Script para fazer build do APK
"""

import os
import subprocess
import sys

# Configurar token
os.environ['EXPO_TOKEN'] = 't9OHl19nUtLrGoxrnsL-zKt_TbqZl-afUeRCiNOh'

# Diretório do projeto
project_dir = '/home/z/my-project/app-cobrancas'

# Fazer build
print("📦 Iniciando build...")
build_cmd = [
    'npx', 'eas-cli', 'build',
    '--platform', 'android',
    '--profile', 'preview',
    '--non-interactive',
    '--wait'
]

result = subprocess.run(
    build_cmd,
    cwd=project_dir,
    env=os.environ,
    capture_output=False,
    text=True
)

sys.exit(result.returncode)
