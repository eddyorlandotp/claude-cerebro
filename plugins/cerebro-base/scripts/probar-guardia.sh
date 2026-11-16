#!/usr/bin/env bash
# Pruebas del hook guardia.py. Uso: bash scripts/probar-guardia.sh
# Crea repos git temporales fuera del plugin, simula payloads PreToolUse y
# ejecuta el MISMO comando que hooks/hooks.json (via sh -c) para comprobar
# deny / ask / allow. Sale con 1 si alguna prueba falla.
set -u

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export CLAUDE_PLUGIN_ROOT="$RAIZ"
HOOK_CMD="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["hooks"]["PreToolUse"][0]["hooks"][0]["command"])' "$RAIZ/hooks/hooks.json")"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
G=(git -c user.name=prueba -c user.email=prueba@example.invalid -c init.defaultBranch=main)

# Piezas partidas para que este archivo no contenga patrones de llave real.
PEM="-----BEGIN PRIV""ATE KEY-----
MIIfalsofalsofalso
-----END PRIV""ATE KEY-----"
ARREGLO="$(python3 -c 'import json,os;print(json.dumps(list(os.urandom(64))))')"

nuevo_repo() { # $1 = nombre
  local d="$TMP/$1"; mkdir -p "$d"; (cd "$d" && "${G[@]}" init -q && echo "hola" > README.md \
    && "${G[@]}" add README.md && "${G[@]}" commit -qm inicial); echo "$d"
}

R_LIMPIO="$(nuevo_repo limpio)"; echo "X=" > "$R_LIMPIO/.env.example"; (cd "$R_LIMPIO" && git add .env.example)
R_IGNORA="$(nuevo_repo ignora)"; printf '.env\n' > "$R_IGNORA/.gitignore"; echo "K=secreto" > "$R_IGNORA/.env"; echo "y" > "$R_IGNORA/app.js"
R_ENV="$(nuevo_repo env)"; echo "K=secreto" > "$R_ENV/.env"; (cd "$R_ENV" && git add .env)
R_ENVSUELTO="$(nuevo_repo envsuelto)"; echo "K=secreto" > "$R_ENVSUELTO/.env"
R_KEYPAIR="$(nuevo_repo keypair)"; mkdir -p "$R_KEYPAIR/config"; echo "$ARREGLO" > "$R_KEYPAIR/config/wallet.json"; (cd "$R_KEYPAIR" && git add config/wallet.json)
R_KPSUELTO="$(nuevo_repo kpsuelto)"; echo "$ARREGLO" > "$R_KPSUELTO/bot-keypair.json"
R_WALLET="$(nuevo_repo wallet)"; python3 -c 'import json,os;print(json.dumps(list(os.urandom(64)),indent=2))' > "$R_WALLET/wallet.json"
R_PEM="$(nuevo_repo pem)"; echo "$PEM" > "$R_PEM/llave.txt"; (cd "$R_PEM" && git add llave.txt)
R_TRACK="$(nuevo_repo track)"; echo "$PEM" >> "$R_TRACK/README.md"
R_BORRA="$(nuevo_repo borra)"; echo "K=1" > "$R_BORRA/.env"; (cd "$R_BORRA" && "${G[@]}" add -f .env && "${G[@]}" commit -qm oops && git rm -q --cached .env)
R_RAMA="$(nuevo_repo rama)"; (cd "$R_RAMA" && git checkout -qb feature)
NO_REPO="$TMP/norepo"; mkdir -p "$NO_REPO"

PASAN=0; FALLAN=0
caso() { # $1=esperado(deny|ask|allow) $2=cwd $3=comando
  local esperado="$1" cwd="$2" cmd="$3" payload salida obtenido
  payload="$(python3 -c 'import json,sys;print(json.dumps({"hook_event_name":"PreToolUse","tool_name":"Bash","cwd":sys.argv[1],"tool_input":{"command":sys.argv[2]}}))' "$cwd" "$cmd")"
  salida="$(printf '%s' "$payload" | sh -c "$HOOK_CMD")"; local codigo=$?
  obtenido="$(printf '%s' "$salida" | python3 -c 'import json,sys
t=sys.stdin.read().strip()
print(json.loads(t)["hookSpecificOutput"]["permissionDecision"] if t else "allow")' 2>/dev/null || echo "SALIDA-INVALIDA")"
  if [ "$obtenido" = "$esperado" ] && [ $codigo -eq 0 ]; then
    PASAN=$((PASAN+1)); printf 'ok    %-5s %s\n' "$esperado" "$cmd"
  else
    FALLAN=$((FALLAN+1)); printf 'FALLA esperado=%s obtenido=%s codigo=%s :: %s\n' "$esperado" "$obtenido" "$codigo" "$cmd"
  fi
}

echo "== Catastroficos (deny)"
caso deny  "$NO_REPO" 'rm -rf /'
caso deny  "$NO_REPO" 'rm -rf ~'
caso deny  "$NO_REPO" 'rm -rf $HOME'
caso deny  "$NO_REPO" 'rm -rf "$HOME"/*'
caso deny  "$NO_REPO" 'sudo rm -fr /* --no-preserve-root'
caso deny  "$NO_REPO" 'rm -r -f ~/'
caso deny  "$NO_REPO" 'echo hola && rm -rf / ; ls'
caso deny  "$NO_REPO" 'bash -c "rm -rf ~"'
caso deny  "$NO_REPO" 'mkfs.ext4 /dev/sdb1'
caso deny  "$NO_REPO" 'sudo dd if=imagen.iso of=/dev/sda bs=4M'
caso deny  "$NO_REPO" 'dd if=/dev/zero of=/dev/nvme0n1'
echo "== Secretos en git (deny)"
caso deny  "$R_ENVSUELTO" 'git add .env'
caso deny  "$R_ENVSUELTO" 'git add -A'
caso deny  "$R_ENVSUELTO" 'git add . && git commit -m "wip"'
caso deny  "$R_ENV" 'git commit -m "actualiza .env.example"'
caso deny  "$TMP" "cd $R_ENV && git commit -m x"
caso deny  "$TMP" "git -C $R_ENV commit -m x"
caso deny  "$R_KEYPAIR" 'git commit -m "config"'
caso deny  "$R_KPSUELTO" 'git add .'
caso deny  "$R_KPSUELTO" 'git add id.json'
caso deny  "$R_WALLET" 'git add wallet.json'
caso deny  "$R_PEM" 'git commit -m llave'
caso deny  "$R_TRACK" 'git commit -am "docs"'
caso deny  "$R_LIMPIO" 'git add servidor.pem'
echo "== Confirmacion (ask)"
caso ask   "$R_LIMPIO" 'git push --force origin main'
caso ask   "$R_LIMPIO" 'git push -f'
caso ask   "$R_LIMPIO" 'git push --force-with-lease origin master'
caso ask   "$R_LIMPIO" 'git push origin +main'
caso ask   "$R_LIMPIO" 'git reset --hard HEAD~1'
caso ask   "$R_LIMPIO" 'git clean -fd'
caso ask   "$NO_REPO" 'psql -c "DROP TABLE usuarios;"'
caso ask   "$NO_REPO" 'npx wrangler d1 execute mi-db --command "drop database x"'
echo "== Permitidos (allow)"
caso allow "$NO_REPO" 'ls -la'
caso allow "$NO_REPO" 'rm -rf ./node_modules'
caso allow "$NO_REPO" 'rm -rf node_modules dist .next'
caso allow "$NO_REPO" 'rm -f ~/descargas/archivo.zip'
caso allow "$R_LIMPIO" 'git commit -m "actualiza .env.example"'
caso allow "$R_LIMPIO" 'git add .env.example'
caso allow "$R_IGNORA" 'git add . && git commit -m "app"'
caso allow "$R_BORRA" 'git commit -m "saca .env del repo"'
caso allow "$R_RAMA" 'git push --force origin feature'
caso allow "$R_RAMA" 'git push -f'
caso allow "$R_LIMPIO" 'git push -u origin main'
caso allow "$R_LIMPIO" 'git clean -n -d'
caso allow "$R_LIMPIO" 'git reset --soft HEAD~1'
caso allow "$NO_REPO" 'grep -rn "DROP TABLE" src/'
caso allow "$NO_REPO" 'git commit -m "x"'
caso allow "$NO_REPO" 'echo "comillas sin cerrar'

echo "== Fail-open"
for raro in 'esto no es json' '{"tool_name":"Write","tool_input":{"file_path":"/x"}}' '' '[1,2,3]'; do
  salida="$(printf '%s' "$raro" | sh -c "$HOOK_CMD")"; c=$?
  if [ $c -eq 0 ] && [ -z "$salida" ]; then PASAN=$((PASAN+1)); echo "ok    payload raro -> sale 0 sin salida"; else FALLAN=$((FALLAN+1)); echo "FALLA payload raro: codigo=$c salida=$salida"; fi
done
salida="$(printf '%s' '{"tool_name":"Bash","tool_input":{"command":"rm -rf /"}}' | PATH=/nonexistent /bin/sh -c "$HOOK_CMD")"; c=$?
if [ $c -eq 0 ] && [ -z "$salida" ]; then PASAN=$((PASAN+1)); echo "ok    sin python3 -> sale 0 sin bloquear"; else FALLAN=$((FALLAN+1)); echo "FALLA sin python3: codigo=$c salida=$salida"; fi

echo
echo "Resultado: $PASAN pasan, $FALLAN fallan"
[ "$FALLAN" -eq 0 ]
