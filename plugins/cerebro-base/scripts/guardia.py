#!/usr/bin/env python3
"""guardia.py - hook PreToolUse (matcher Bash) del plugin cerebro-base.

Lee el payload JSON de stdin y decide:
  - deny: comandos catastroficos y commits/adds que meterian secretos al repo.
  - ask:  force-push a main/master, git reset --hard, git clean -f, DROP DATABASE/TABLE.
  - nada: todo lo demas (sale 0 sin imprimir).

Es fail-open: ante cualquier error sale 0 sin bloquear.
Formato de salida verificado en https://code.claude.com/docs/en/hooks (nov 2026):
{"hookSpecificOutput": {"hookEventName": "PreToolUse",
  "permissionDecision": "deny|ask", "permissionDecisionReason": "..."}}
"""

import json
import os
import re
import shlex
import subprocess
import sys

SEPARADORES = {";", "&&", "||", "|", "&", "(", ")", "\n", "|&", ";;"}
REDIRECCIONES = {">", ">>", "<", ">&", "&>", "<<", "<<<", ">|", "<&", "&>>"}
ENVOLTORIOS = {"sudo", "doas", "env", "nohup", "time", "nice", "command", "exec", "builtin"}
SHELLS = {"bash", "sh", "zsh", "dash", "fish"}
BUSCADORES = {"grep", "egrep", "fgrep", "rg", "ag", "ack"}

PERMITIDOS_ENV = {"example", "sample", "template"}
RE_LLAVE_PEM = re.compile(r"-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----")
RE_ARREGLO_64 = re.compile(r"\[\s*(?:\d{1,3}\s*,\s*){63}\d{1,3}\s*\]")
RE_DROP = re.compile(r"\bDROP\s+(?:DATABASE|TABLE|SCHEMA)\b", re.IGNORECASE)
RE_DISCO = re.compile(r"^/dev/(?:sd[a-z]|nvme\d|mmcblk\d|vd[a-z]|hd[a-z])")

MAX_BYTES = 5 * 1024 * 1024


class Resultado:
    def __init__(self):
        self.denegar = []
        self.preguntar = []


# ---------------------------------------------------------------- utilidades

def git(args, cwd):
    """Corre git y devuelve stdout (str) o None si falla."""
    try:
        p = subprocess.run(
            ["git"] + args,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            timeout=8,
            env=dict(os.environ, GIT_OPTIONAL_LOCKS="0", LC_ALL="C"),
        )
    except Exception:
        return None
    if p.returncode != 0:
        return None
    return p.stdout[:MAX_BYTES].decode("utf-8", "replace")


def es_archivo_sensible(ruta):
    base = os.path.basename(ruta.rstrip("/")).lower()
    for prefijo in (".env", ".dev.vars"):
        if base == prefijo:
            return True
        if base.startswith(prefijo + "."):
            sufijo = base[len(prefijo) + 1:]
            return sufijo not in PERMITIDOS_ENV
    if base == "id.json":
        return True
    if "keypair" in base and base.endswith(".json"):
        return True
    if base.endswith(".pem"):
        return True
    return False


def tiene_llave_privada(texto):
    if RE_LLAVE_PEM.search(texto):
        return "un bloque 'BEGIN ... PRIVATE KEY'"
    for m in RE_ARREGLO_64.finditer(texto):
        numeros = [int(n) for n in re.findall(r"\d+", m.group(0))]
        if len(numeros) == 64 and all(0 <= n <= 255 for n in numeros):
            return "un arreglo de 64 números 0-255 (formato de keypair de Solana)"
    return None


def lineas_agregadas(diff):
    """Solo las lineas '+' de un diff (sin las cabeceras '+++')."""
    out = []
    for linea in diff.splitlines():
        if linea.startswith("+") and not linea.startswith("+++"):
            out.append(linea[1:])
    return "\n".join(out)


def tokenizar(comando):
    lex = shlex.shlex(comando, posix=True, punctuation_chars=";&|()<>\n")
    lex.whitespace = " \t\r"
    lex.commenters = ""
    lex.whitespace_split = True
    return list(lex)


def segmentar(tokens):
    """Divide en comandos simples; quita comentarios y redirecciones.
    Devuelve lista de (argv, destinos_de_redireccion)."""
    segmentos, actual, redir = [], [], []
    i, comentario = 0, False
    while i < len(tokens):
        t = tokens[i]
        if comentario:
            if t == "\n":
                comentario = False
            else:
                i += 1
                continue
        if t in SEPARADORES:
            if actual or redir:
                segmentos.append((actual, redir))
            actual, redir = [], []
        elif t in REDIRECCIONES:
            if actual and actual[-1].isdigit():
                actual.pop()
            if i + 1 < len(tokens):
                redir.append(tokens[i + 1])
            i += 1
        elif t.startswith("#"):
            comentario = True
        else:
            actual.append(t)
        i += 1
    if actual or redir:
        segmentos.append((actual, redir))
    return segmentos


def quitar_envoltorios(argv):
    """Quita VAR=valor, sudo, env, nohup, etc. del inicio."""
    i = 0
    while i < len(argv):
        t = argv[i]
        if re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", t):
            i += 1
            continue
        nombre = os.path.basename(t)
        if nombre in ENVOLTORIOS:
            i += 1
            while i < len(argv) and argv[i].startswith("-"):
                if argv[i] in ("-u", "-g", "-n", "-C") and nombre in ("sudo", "doas", "nice"):
                    i += 1
                i += 1
            continue
        break
    return argv[i:]


# ---------------------------------------------------------------- reglas

def objetivo_catastrofico(objetivo, cwd):
    home = os.path.expanduser("~")
    t = objetivo.strip()
    for var in ("${HOME}", "$HOME"):
        if t.startswith(var):
            t = "~" + t[len(var):]
    t_norm = re.sub(r"/+", "/", t)
    if t_norm in ("/", "/*", "/.", "/..", "~", "~/", "~/*", "~/.", "~/.*"):
        return True
    if t_norm.rstrip("/*") in (home.rstrip("/"),) and home not in ("", "/"):
        return True
    if t_norm in ("*", ".", "./", "./*", ".*"):
        try:
            real = os.path.realpath(cwd)
            return real in ("/", os.path.realpath(home))
        except Exception:
            return False
    return False


def revisar_rm(argv, cwd, res):
    recursivo = False
    objetivos = []
    fin_opciones = False
    for t in argv[1:]:
        if not fin_opciones and t == "--":
            fin_opciones = True
        elif not fin_opciones and t.startswith("--"):
            if t == "--recursive":
                recursivo = True
        elif not fin_opciones and t.startswith("-") and len(t) > 1:
            if "r" in t or "R" in t:
                recursivo = True
        else:
            objetivos.append(t)
    if not recursivo:
        return
    for obj in objetivos:
        if objetivo_catastrofico(obj, cwd):
            res.denegar.append(
                "Bloqueado: 'rm' recursivo sobre '%s' borraría el sistema o toda tu carpeta personal. "
                "Borra solo la carpeta concreta que necesitas (ej. ./node_modules)." % obj
            )
            return


def revisar_disco(argv, redir, res):
    nombre = os.path.basename(argv[0]) if argv else ""
    if nombre.startswith("mkfs"):
        res.denegar.append(
            "Bloqueado: '%s' formatea un disco o partición y borra todo su contenido. "
            "Si de verdad hace falta, que el usuario lo corra a mano." % nombre
        )
        return
    if nombre == "dd":
        for t in argv[1:]:
            if t.startswith("of=") and RE_DISCO.match(t[3:]):
                res.denegar.append(
                    "Bloqueado: 'dd' escribiendo directo a %s sobrescribe un disco completo. "
                    "Si de verdad hace falta, que el usuario lo corra a mano." % t[3:]
                )
                return
    for destino in redir:
        if RE_DISCO.match(destino):
            res.denegar.append(
                "Bloqueado: redirigir salida a %s sobrescribe un disco completo." % destino
            )
            return


def opciones_globales_git(argv, cwd):
    """Procesa 'git -C dir -c k=v ...'. Devuelve (subcomando, args, cwd)."""
    i = 1
    while i < len(argv):
        t = argv[i]
        if t == "-C" and i + 1 < len(argv):
            cwd = os.path.join(cwd, os.path.expanduser(argv[i + 1]))
            i += 2
        elif t in ("-c", "--git-dir", "--work-tree", "--namespace") and i + 1 < len(argv):
            i += 2
        elif t.startswith("-"):
            i += 1
        else:
            return t, argv[i + 1:], cwd
    return None, [], cwd


def razon_archivo(ruta):
    return (
        "Bloqueado: vas a meter '%s' a git y parece un archivo de secretos "
        "(.env, .dev.vars, id.json, *keypair*.json o *.pem). Agrégalo a .gitignore; si ya está "
        "en stage, sácalo con 'git restore --staged %s' (o 'git rm --cached %s' si ya estaba "
        "en un commit). Si es solo un ejemplo sin valores reales, renómbralo a .env.example."
        % (ruta, ruta, ruta)
    )


def razon_contenido(que, donde):
    return (
        "Bloqueado: %s contiene %s. Nunca subas llaves privadas a git. Sácalo del stage "
        "('git restore --staged <archivo>'), mueve la llave a un archivo ignorado o a un secret, "
        "y si ya se subio a un remoto, considérala comprometida: mueve fondos/rota la llave primero."
        % (donde, que)
    )


def revisar_git_add(args, cwd, res):
    interactivas = {"-p", "--patch", "-i", "--interactive", "-e", "--edit"}
    explicitos = [a for a in args if not a.startswith("-")]
    for ruta in explicitos:
        if es_archivo_sensible(ruta):
            res.denegar.append(razon_archivo(ruta))
            return
    seguros = [a for a in args if a not in interactivas and a not in ("-n", "--dry-run")]
    salida = git(["add", "--dry-run", "--ignore-missing"] + seguros, cwd)
    if salida is None:
        salida = git(["add", "--dry-run"] + seguros, cwd)
    if salida is None:
        return
    archivos = []
    for linea in salida.splitlines():
        m = re.match(r"^add '(.*)'$", linea)
        if m:
            archivos.append(m.group(1))
    for ruta in archivos:
        if es_archivo_sensible(ruta):
            res.denegar.append(razon_archivo(ruta))
            return
    raiz = git(["rev-parse", "--show-toplevel"], cwd)
    base = raiz.strip() if raiz else cwd
    for ruta in archivos[:500]:
        completa = os.path.join(base, ruta)
        try:
            if os.path.getsize(completa) > 1024 * 1024:
                continue
            with open(completa, "rb") as f:
                texto = f.read().decode("utf-8", "replace")
        except Exception:
            continue
        que = tiene_llave_privada(texto)
        if que:
            res.denegar.append(razon_contenido(que, "'%s'" % ruta))
            return


def revisar_git_commit(args, cwd, res):
    con_valor = {"-m", "--message", "-F", "--file", "-C", "--reuse-message", "-c",
                 "--reedit-message", "-t", "--template", "--author", "--date",
                 "--fixup", "--squash", "--cleanup", "--trailer", "--pathspec-from-file"}
    todo = False
    rutas = []
    i = 0
    while i < len(args):
        t = args[i]
        if t == "--":
            rutas.extend(args[i + 1:])
            break
        if t in con_valor:
            i += 2
            continue
        if t.startswith("--"):
            if t in ("--all",):
                todo = True
        elif t.startswith("-") and len(t) > 1:
            letras = t[1:]
            for j, c in enumerate(letras):
                if c == "a":
                    todo = True
                if c in "mFCct":
                    if j == len(letras) - 1:
                        i += 1
                    break
        else:
            rutas.append(t)
        i += 1

    nombres = git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"], cwd)
    diff = git(["diff", "--cached", "--no-color", "--no-ext-diff", "-U0"], cwd)
    if nombres is None and diff is None:
        return
    nombres = nombres or ""
    diff = diff or ""
    if todo:
        nombres += "\n" + (git(["diff", "--name-only", "--diff-filter=ACMR"], cwd) or "")
        diff += "\n" + (git(["diff", "--no-color", "--no-ext-diff", "-U0"], cwd) or "")
    if rutas:
        nombres += "\n" + (git(["diff", "HEAD", "--name-only", "--diff-filter=ACMR", "--"] + rutas, cwd) or "")
        diff += "\n" + (git(["diff", "HEAD", "--no-color", "--no-ext-diff", "-U0", "--"] + rutas, cwd) or "")
        for r in rutas:
            if es_archivo_sensible(r) and os.path.exists(os.path.join(cwd, r)):
                res.denegar.append(razon_archivo(r))
                return
    for ruta in nombres.splitlines():
        ruta = ruta.strip()
        if ruta and es_archivo_sensible(ruta):
            res.denegar.append(razon_archivo(ruta))
            return
    que = tiene_llave_privada(lineas_agregadas(diff))
    if que:
        res.denegar.append(razon_contenido(que, "Lo que vas a commitear"))


def revisar_git_push(args, cwd, res):
    forzado = False
    borrar = False
    posicionales = []
    for t in args:
        if t in ("--force", "--force-with-lease", "--force-if-includes") or t.startswith("--force-with-lease="):
            forzado = True
        elif t in ("--delete",):
            borrar = True
        elif t in ("--all", "--mirror", "--branches"):
            posicionales.append("*TODAS*")
        elif t.startswith("--"):
            continue
        elif t.startswith("-") and len(t) > 1:
            if "f" in t[1:]:
                forzado = True
            if "d" in t[1:]:
                borrar = True
        else:
            posicionales.append(t)
    refspecs = posicionales[1:] if posicionales and posicionales[0] != "*TODAS*" else posicionales
    destinos = []
    for r in refspecs:
        if r.startswith("+"):
            forzado = True
            r = r[1:]
        if r.startswith(":"):
            borrar = True
        destino = r.split(":", 1)[1] if ":" in r else r
        if destino == "HEAD" or destino == "":
            actual = git(["rev-parse", "--abbrev-ref", "HEAD"], cwd)
            destino = actual.strip() if actual else destino
        destinos.append(destino.replace("refs/heads/", ""))
    if not refspecs:
        actual = git(["rev-parse", "--abbrev-ref", "HEAD"], cwd)
        destinos.append(actual.strip() if actual else "?")
    criticos = [d for d in destinos if d in ("main", "master", "*TODAS*", "?")]
    if not criticos:
        return
    if forzado:
        res.preguntar.append(
            "Confirmación: esto hace force-push a main/master (o a todas las ramas). Reescribe la "
            "historia remota y puede borrar trabajo de forma permanente. Normalmente nunca se hace en main."
        )
    elif borrar:
        res.preguntar.append("Confirmación: esto BORRA la rama main/master del remoto.")


def revisar_git(argv, cwd, res):
    sub, args, cwd = opciones_globales_git(argv, cwd)
    if sub == "add":
        revisar_git_add(args, cwd, res)
    elif sub == "commit":
        revisar_git_commit(args, cwd, res)
    elif sub == "push":
        revisar_git_push(args, cwd, res)
    elif sub == "reset" and "--hard" in args:
        res.preguntar.append(
            "Confirmación: 'git reset --hard' descarta para siempre los cambios sin commitear. "
            "Alternativa segura: 'git stash' primero."
        )
    elif sub == "clean":
        cortas = "".join(a[1:] for a in args if a.startswith("-") and not a.startswith("--"))
        if ("f" in cortas or "--force" in args) and "n" not in cortas and "--dry-run" not in args:
            res.preguntar.append(
                "Confirmación: 'git clean -f' borra para siempre archivos no rastreados (no hay papelera). "
                "Revisa antes con 'git clean -n -d'."
            )
    return cwd


def analizar(comando, cwd, res, profundidad=0):
    if profundidad > 3:
        return
    try:
        tokens = tokenizar(comando)
    except ValueError:
        # Comillas sin cerrar: solo revisiones por regex.
        if RE_DROP.search(comando):
            res.preguntar.append("Confirmación: el comando contiene DROP DATABASE/TABLE (borra datos).")
        return
    for argv, redir in segmentar(tokens):
        argv = quitar_envoltorios(argv)
        texto = " ".join(argv)
        nombre = os.path.basename(argv[0]) if argv else ""
        if nombre not in BUSCADORES and RE_DROP.search(texto):
            res.preguntar.append(
                "Confirmación: el comando contiene DROP DATABASE/TABLE/SCHEMA, que borra datos "
                "de forma permanente. Haz un respaldo antes."
            )
        revisar_disco(argv, redir, res)
        if not argv:
            continue
        if nombre == "cd" and len(argv) > 1:
            cwd = os.path.join(cwd, os.path.expanduser(argv[1]))
        elif nombre == "rm":
            revisar_rm(argv, cwd, res)
        elif nombre == "git":
            revisar_git(argv, cwd, res)
        elif nombre in SHELLS or nombre == "eval":
            if nombre == "eval":
                analizar(" ".join(argv[1:]), cwd, res, profundidad + 1)
            elif "-c" in argv:
                k = argv.index("-c")
                if k + 1 < len(argv):
                    analizar(argv[k + 1], cwd, res, profundidad + 1)


def main():
    try:
        payload = json.loads(sys.stdin.read() or "{}")
        if not isinstance(payload, dict) or payload.get("tool_name") != "Bash":
            return
        comando = (payload.get("tool_input") or {}).get("command")
        if not isinstance(comando, str) or not comando.strip():
            return
        cwd = payload.get("cwd") or os.getcwd()
        if not os.path.isdir(cwd):
            cwd = os.getcwd()
        res = Resultado()
        analizar(comando, cwd, res)
        if res.denegar:
            decision, razon = "deny", res.denegar[0]
        elif res.preguntar:
            decision, razon = "ask", res.preguntar[0]
        else:
            return
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": decision,
                "permissionDecisionReason": "[cerebro-base/guardia] " + razon,
            }
        }, ensure_ascii=False))
    except Exception:
        return  # fail-open


if __name__ == "__main__":
    main()
    sys.exit(0)
