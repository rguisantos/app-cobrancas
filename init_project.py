#!/usr/bin/env python3
"""
Script para inicializar projeto EAS e fazer build
"""

import os
import subprocess
import sys

# Configurar token
os.environ['EXPO_TOKEN'] = 't9OHl19nUtLrGoxrnsL-zKt_TbqZl-afUeRCiNOh'

# Diretório do projeto
project_dir = '/home/z/my-project/app-cobrancas'

# 1. Inicializar projeto
print("🔧 Passo 1: Inicializando projeto EAS...")
init_cmd = ['npx', 'eas-cli', 'init', '--force', '--non-interactive']
result = subprocess.run(
    init_cmd,
    cwd=project_dir,
    env=os.environ,
    capture_output=True,
    text=True
)
print("STDOUT:", result.stdout)
print("STDERR:", result.stderr)

if result.returncode != 0:
    print("❌ Erro ao inicializar projeto")
    sys.exit(1)

print("✅ Projeto inicializado!")

# 2. Fazer build
print("\n📦 Passo 2: Iniciando build...")
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
