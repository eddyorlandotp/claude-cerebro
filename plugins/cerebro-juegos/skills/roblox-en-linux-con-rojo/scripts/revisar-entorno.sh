#!/usr/bin/env bash
# Revisa qué herramientas de desarrollo de Roblox hay instaladas en Linux.
# Solo lee: no instala ni cambia nada. Uso: bash revisar-entorno.sh [carpeta-del-proyecto]

proyecto="${1:-.}"

ok()   { printf '  [OK]    %s\n' "$1"; }
falta(){ printf '  [FALTA] %s\n' "$1"; }

echo "== Herramientas de linea de comandos"
for herr in rokit rojo wally stylua selene luau-lsp git; do
  if command -v "$herr" >/dev/null 2>&1; then
    version="$("$herr" --version 2>/dev/null | head -n1)"
    ok "$herr ${version}"
  else
    falta "$herr"
  fi
done

if command -v aftman >/dev/null 2>&1; then
  echo "  [AVISO] aftman instalado: esta abandonado, usa rokit en proyectos nuevos"
fi

echo
echo "== Roblox Studio (Vinegar)"
if command -v flatpak >/dev/null 2>&1 && flatpak info org.vinegarhq.Vinegar >/dev/null 2>&1; then
  ok "Vinegar (Flatpak) $(flatpak info org.vinegarhq.Vinegar 2>/dev/null | awk -F': *' '/Version/{print $2; exit}')"
elif command -v vinegar >/dev/null 2>&1; then
  ok "Vinegar (paquete nativo)"
else
  falta "Vinegar: flatpak install flathub org.vinegarhq.Vinegar"
fi

echo
echo "== Archivos del proyecto en: $proyecto"
for f in default.project.json rokit.toml wally.toml stylua.toml selene.toml .luaurc .gitignore; do
  if [ -e "$proyecto/$f" ]; then ok "$f"; else falta "$f"; fi
done

if [ -e "$proyecto/aftman.toml" ] || [ -e "$proyecto/foreman.toml" ]; then
  echo "  [AVISO] hay aftman.toml/foreman.toml: rokit los lee, pero migra a rokit.toml"
fi

if [ -e "$proyecto/default.project.json" ] && command -v python3 >/dev/null 2>&1; then
  if python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$proyecto/default.project.json" 2>/dev/null; then
    ok "default.project.json es JSON valido"
  else
    falta "default.project.json NO es JSON valido"
  fi
fi
exit 0
