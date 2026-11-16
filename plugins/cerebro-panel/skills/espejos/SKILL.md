---
name: espejos
description: Descarga copias locales de repos de documentación (Solana, Jupiter, Cloudflare, Roblox, Godot…) para consultarlas sin internet, y las mantiene al día.
disable-model-invocation: true
argument-hint: "[listar | agregar <nombre o url> | actualizar]"
---

# Espejos locales de documentación

Un espejo es un clon superficial (`git clone --depth 1`) de un repo público de documentación, guardado en una carpeta que elige el usuario. Sirve para buscar en la doc con `grep` sin gastar búsquedas web ni depender de internet. Es lo único de este plugin que usa la red, y solo cuando el usuario lo pide.

Lo que pidió el usuario: `$ARGUMENTS` (vacío = recorre el flujo completo).

## Flujo

1. **¿Ya hay carpeta?**
   ```bash
   arana espejo ruta
   ```
   - Si imprime una ruta, salta al paso 3.
   - Si imprime la lista de unidades montadas con su espacio libre (sale con código 3), sigue al paso 2.
2. **Pregunta dónde guardarlos.** Con AskUserQuestion, ofrece las unidades que salieron (punto de montaje y espacio libre) y deja que escriba otra ruta. Recomienda una con al menos 5 GB libres que no sea un USB que se desconecte. Nunca elijas tú. Luego configura una subcarpeta propia, no la raíz de la unidad:
   ```bash
   arana espejo ruta /ruta/elegida/espejos-docs
   ```
3. **Muestra qué hay y qué se sugiere:**
   ```bash
   arana espejo listar
   ```
   Enseña la lista de sugeridos con su tamaño y pregunta cuáles quiere (varios a la vez). Los que dicen `no medido` son repos grandes: avísale antes de bajarlos y que puede tardar.
4. **Descarga los elegidos**, uno por uno, y reporta cada resultado:
   ```bash
   arana espejo agregar solana
   arana espejo agregar https://github.com/dueño/repo
   ```
   Acepta un nombre de la lista o cualquier URL `https://` de un repo público. Si un repo falla, dilo y sigue con los demás. No reintentes en bucle.
5. **Actualizar** (cuando lo pida, o si un espejo tiene más de un mes según la fecha de `listar`):
   ```bash
   arana espejo actualizar          # todos
   arana espejo actualizar jupiter  # uno
   ```

## Cómo usarlos después

Antes de ir a internet por documentación de algo que tenga espejo, busca primero ahí:

```bash
dir="$(arana espejo ruta)"
grep -rIl --include='*.md' --include='*.mdx' --include='*.rst' -i "priority fee" "$dir/solana" | head
```

- Usa la herramienta Grep con `path` = la carpeta del espejo, y luego Read solo del archivo que haga falta (no leas carpetas enteras).
- Di de qué archivo salió el dato y la fecha del espejo (`arana espejo listar`). Si el espejo tiene más de un mes y el dato es de los que cambian (precios, límites, versiones, nombres de endpoints), confírmalo en la doc en línea o actualiza el espejo antes de depender de él.
- Si en el espejo no aparece, entonces sí usa Context7 o WebFetch.
- Si quieres que esto se recuerde en un proyecto, agrega una línea a su `CLAUDE.md`: "Documentación local en `<carpeta>`: busca ahí con grep antes de ir a internet".

## Reglas

- No cambies la carpeta de espejos ni borres espejos sin que el usuario lo pida.
- No descargues repos que no sean de documentación ni repos privados. El script rechaza todo lo que no sea `https://`.
- La carpeta queda anotada en `~/.local/state/cerebro-panel/config.json` (`espejos.dir`).
