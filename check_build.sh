#!/bin/bash
cd /home/z/my-project/app-cobrancas
for i in {1..20}; do
    echo "=== Check $i ($(date)) ==="
    npx eas-cli build:list --limit 1 2>&1 | grep -E "Status|Application Archive"
    
    # Se encontrou URL de download, sair
    if npx eas-cli build:list --limit 1 2>&1 | grep -q "https://"; then
        echo ">>> BUILD FINALIZADA!"
        npx eas-cli build:list --limit 1 2>&1 | grep "Application Archive URL"
        break
    fi
    
    sleep 30
done
