#!/usr/bin/env bash
# Muestra el costo de contexto "siempre activo" de cada plugin habilitado, de mayor a menor.
# Uso: bash costo-plugins.sh
set -u
command -v claude >/dev/null || { echo "No encuentro 'claude'"; exit 1; }
lista=$(claude plugin list --json 2>/dev/null | python3 -c '
import json,sys
d=json.load(sys.stdin)
items=d if isinstance(d,list) else d.get("plugins",[])
for x in items:
    pid=x.get("id") or x.get("name")
    en=x.get("enabled", x.get("status","enabled"))
    if en in (True,"enabled","✔ enabled"): print(pid)
')
for p in $lista; do
  t=$(claude plugin details "${p%@*}" 2>/dev/null | grep -oP 'Always-on:\s+~\K[0-9.,]+k?' | head -1 | tr -d ,)
  t=${t:-0}
  case "$t" in *k) n=$(python3 -c "print(int(float('${t%k}')*1000))");; *) n=$t;; esac
  printf '%6s  %s\n' "$n" "$p"
done | sort -rn | awk '{print; t+=$1} END {print "------"; printf "%6d  TOTAL siempre activo (tokens aprox. por mensaje, antes de caché)\n", t}'
