# backend/blockchain_form/script/REDEPLOYE.sh
#!/usr/bin/env bash
set -e

# déploie DANS le conteneur backend (Node 24)
OUT="$(docker compose exec -T backend sh -lc '
  cd /home/nodejs/app/blockchain_form &&
  npm ci --include=dev &&
  npx hardhat compile &&
  npx hardhat run script/deploy.js --network fuji
')"

echo "$OUT"

# ➜ récupérer UNIQUEMENT la ligne "Contrat ScoreStorage déployé..." (ou "ScoreStorage deployed")
ADDR="$(printf "%s\n" "$OUT" | grep -E 'Contrat ScoreStorage déployé|ScoreStorage deployed' | grep -Eo '0x[0-9a-fA-F]{40}' | head -n1)"
[ -n "$ADDR" ] || { echo "adresse de contrat non trouvée"; exit 1; }

# ➜ mettre à jour l'adresse dans le service
sed -i -E 's|(const CONTRACT_ADDRESS = ")[^"]+(")|\1'"$ADDR"'\2|' backend/services/blockchainService.js

echo "CONTRACT_ADDRESS mis à jour -> $ADDR"