---
name: automatizaciones-n8n
description: Automatizaciones con n8n para clientes - self-hosted en Docker vs Cloud, licencia, webhooks, credenciales, errores y respaldos, cuándo conviene un script y plantillas vendibles (leads, respuestas, reportes). Usa con n8n, workflow, Zapier.
---

# Automatizaciones con n8n que se pueden vender

El error que corrige: Claude monta n8n sin pensar si un script era mejor, ignora la licencia (y propone revender n8n como servicio), pega API keys dentro de nodos Code, no configura un flujo de errores y entrega un workflow que falla en silencio el primer fin de semana.

## Regla 0: verifica antes de confiar

- n8n cambia rápido (nombres de nodos, rutas de la doc, variables de entorno). Antes de configurar algo, abre la página en docs.n8n.io agregando `.md` a la URL, o usa Context7.
- Fija la versión de la imagen de Docker en producción y lee las notas de versión antes de actualizar.
- Explícale al usuario cada decisión en 1–3 frases ("Lo hago en n8n porque el cliente quiere ver y mover el flujo él mismo; la lógica es simple").

## 1. ¿n8n o un script?

| Usa n8n cuando | Usa un script (Python/TS) cuando |
|---|---|
| Pegas apps con OAuth (Gmail, Sheets, CRM, Calendar) | La lógica es compleja o necesita pruebas automatizadas |
| El cliente quiere ver el flujo y entender qué pasa | Alto volumen o tiempo real (trading, websockets, miles de eventos/min) |
| Cambios frecuentes y pequeños | Quieres git, code review y despliegues repetibles |
| Volumen bajo o medio (cientos a miles de ejecuciones/mes) | En n8n Cloud te cobrarían demasiadas ejecuciones |

Regla práctica: si el flujo necesita más de ~30 líneas en nodos Code, sácalo a un servicio propio y llámalo desde n8n con HTTP Request.

## 2. Licencia: qué sí puedes cobrar (a nov 2026)

n8n self-hosted (Community Edition) usa la **Sustainable Use License**: no es open source. Según la FAQ oficial:

**Permitido**
- Construir automatizaciones para tus clientes **en tu instancia**, siempre que ellos no puedan crearlas ni editarlas.
- Cobrar por crear, configurar y mantener workflows, y por capacitación o consultoría.
- Usar credenciales del cliente (sus OAuth o API keys) en tu instancia, si no acceden al editor.
- Usar n8n "por detrás" de tu propio producto, si los usuarios solo disparan flujos que tú hiciste.

**Prohibido sin licencia comercial**
- Hospedar n8n como servicio para que los clientes armen sus propios workflows (aunque sea con tu propia interfaz, API, MCP o un agente de IA).
- White-label (quitar la marca y ofrecer n8n tal cual) o hacer fork para vender tu propio producto de automatización.
- Activar funciones enterprise sin licencia.

Si el cliente quiere editar flujos él mismo: que tenga **su propia** instancia (self-hosted en su servidor o n8n Cloud a su nombre) y tú le cobras el trabajo. En casos grises, escribe a license@n8n.io.

## 3. Self-hosted vs n8n Cloud

| | Self-hosted (Docker) | n8n Cloud |
|---|---|---|
| Costo de software | Gratis (Community Edition) | A nov 2026: Starter 20 €/mes (2,500 ejecuciones), Pro 50 €/mes (10,000), pagando anual. Verifica en n8n.io/pricing |
| Tú te encargas de | Servidor, respaldos, actualizaciones, HTTPS | Nada de infraestructura |
| Ideal para | Tus propios clientes en tu instancia; servidor en casa | Cliente que quiere su cuenta y editar él mismo |

## 4. Instalar self-hosted (Docker)

Comando oficial mínimo (prueba local):

```bash
docker volume create n8n_data
docker run -it --rm --name n8n -p 5678:5678 \
  -e GENERIC_TIMEZONE="America/Mexico_City" -e TZ="America/Mexico_City" \
  -e N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true \
  -v n8n_data:/home/node/.n8n n8nio/n8n
```

Para producción:
1. **Docker Compose** con `restart: unless-stopped`, versión fija (`n8nio/n8n:<versión>`) y Postgres si habrá varios clientes o mucho historial (la doc trae el ejemplo con `DB_TYPE=postgresdb`).
2. **Llave de cifrado**: n8n cifra las credenciales con una llave guardada en `~/.n8n/config` (en Docker, dentro del volumen `n8n_data`). Define `N8N_ENCRYPTION_KEY` propia y guárdala en tu gestor de secretos: **sin esa llave, un respaldo no puede descifrar las credenciales**.
3. **Exponerlo a internet** (para webhooks) con Cloudflare Tunnel (skill `cloudflare-tunnel-y-dominio`). Detrás de un proxy define `N8N_WEBHOOK_URL=https://n8n.tudominio.com/` (reemplaza a `WEBHOOK_URL`, que está deprecada) y `N8N_PROXY_HOPS=1`. Protege el editor con Cloudflare Access; deja públicas solo las rutas de webhook.
4. **Respaldos**: copia el volumen `.n8n` (con n8n detenido si usas SQLite) + la base de Postgres, y exporta en JSON:
   `n8n export:workflow --backup --output=backups/workflows/` y `n8n export:credentials --backup --output=backups/credentials/` (directorios distintos). Ver skill `respaldos` de `cerebro-linux`.
5. **Actualizar**: respaldo completo → `docker compose pull` → `docker compose down` → `docker compose up -d` → probar cada workflow crítico.

## 5. Nodos y reglas clave

- **Webhook**: tiene Test URL (solo mientras pruebas en el editor) y Production URL (se registra al **publicar** el workflow). Error típico: darle al cliente la Test URL. Protege con autenticación por header y responde rápido; para procesos largos responde de inmediato y sigue en segundo plano.
- **Respond to Webhook**: cuando el que llama necesita una respuesta específica.
- **Schedule Trigger** para reportes; revisa la zona horaria de la instancia.
- **HTTP Request** para cualquier API sin nodo propio. Lee la doc de esa API antes (skill `investigar-antes-de-codear`).
- **IF / Switch** para ramas; **Execute Sub-workflow** para reutilizar piezas (ej. "notificar error").
- **Nodos de IA** (Anthropic Chat Model, AI Agent): pide salidas estructuradas y pon un tope de tokens; para herramientas que mandan o borran cosas usa aprobación humana (human-in-the-loop). Costos: skill `apps-con-llms`.
- **Credenciales**: siempre en el gestor de credenciales de n8n, una por cliente, con permisos mínimos. Nunca en nodos Code, expresiones ni notas del workflow.

## 6. Manejo de errores (obligatorio antes de entregar)

1. Crea un workflow "Error Handler" que empiece con **Error Trigger** y mande alerta (Telegram/correo) con nombre del workflow, nodo, mensaje y URL de la ejecución.
2. En cada workflow de cliente: Settings → Error workflow → "Error Handler".
3. En nodos que llaman APIs externas activa reintentos con espera (opción de reintento en Settings del nodo) y decide qué pasa si fallan del todo.
4. **Idempotencia**: si el webhook puede llegar dos veces, guarda un ID procesado (Data Table, base de datos) y descarta duplicados. Nunca mandes dos veces el mismo correo o cobro.
5. Revisa la pestaña Executions después de las primeras 24 h en producción.

## 7. Plantillas vendibles (lo que piden en Workana)

Para cada una entrega: workflow exportado en JSON, diagrama de una página, qué credenciales dio el cliente y cómo revocarlas, y costo mensual estimado.

**A. Captura y seguimiento de leads**
Formulario o anuncio → Webhook → validar y deduplicar (correo/teléfono) → guardar en CRM o Google Sheets → mensaje de bienvenida (correo o plantilla de WhatsApp: ver `chatbots-whatsapp-telegram`) → aviso al vendedor → recordatorio si no hay respuesta en 48 h.

**B. Respuestas asistidas**
Correo o mensaje entrante → LLM clasifica (categoría, urgencia, idioma) con salida estructurada → borrador de respuesta con la info del negocio → **un humano aprueba** → enviar. Empieza con aprobación humana siempre; automatiza el envío solo de categorías que pasaron un eval.

**C. Reportes automáticos**
Schedule (lunes 8:00) → leer ventas/citas/métricas (Sheets, base, API) → calcular en nodos, no con el LLM → LLM redacta resumen corto → enviar por correo, Telegram o PDF.

Cotiza con la skill `propuestas-freelance` de `cerebro-negocio`: precio de construcción + mantenimiento mensual (incluye monitoreo de errores y actualizaciones).

## Antes de decir "listo"

- [ ] Decisión n8n vs script explicada; uso compatible con la licencia.
- [ ] Production URL del webhook probada desde fuera con un request real.
- [ ] Error workflow conectado y probado (forzar un fallo y ver llegar la alerta).
- [ ] Duplicados descartados (mandar el mismo evento dos veces).
- [ ] Credenciales solo en el gestor; `N8N_ENCRYPTION_KEY` respaldada; export JSON en git.

## Cómo comprobarlo tú mismo

Dispara cada flujo con un dato de prueba y revisa la pestaña Executions: cada ejecución debe salir en verde. Luego apaga a propósito una credencial (o pon una URL mala) y confirma que te llega la alerta del Error Handler.

## Fuentes (verificado nov 2026)

- https://docs.n8n.io/n8n-community-license/community-license/license-faq (qué se puede y no se puede cobrar)
- https://docs.n8n.io/sustainable-use-license/
- https://n8n.io/pricing/ (Starter y Pro, precios anuales en euros)
- https://docs.n8n.io/deploy/host-n8n/install-options/install-with-docker.md
- https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/configuration-examples/set-a-custom-encryption-key.md
- https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/configuration-examples/configure-webhook-urls-with-reverse-proxy.md (`N8N_WEBHOOK_URL`, `N8N_PROXY_HOPS`)
- https://docs.n8n.io/deploy/host-n8n/keep-n8n-running/backup-and-restore.md
- https://docs.n8n.io/build/flow-logic/handle-errors-gracefully.md (Error Trigger)
- https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook.md (Test vs Production URL)
- https://docs.n8n.io/build/integrate-ai/ai-examples/human-in-the-loop-for-tools.md
