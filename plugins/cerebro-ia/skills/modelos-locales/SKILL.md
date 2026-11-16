---
name: modelos-locales
description: Correr LLMs y embeddings en la PC con NVIDIA (RTX 5070, 12 GB) en Arch/CachyOS - Ollama, llama.cpp o vLLM, qué modelo y cuantización cabe en VRAM, contexto, KV cache y local vs API. Usa con Ollama, llama.cpp, GGUF, VRAM.
---

# Modelos locales en la RTX 5070

El error que corrige: Claude recomienda un modelo de 32B "porque es mejor" sin hacer la cuenta de VRAM, instala con el script genérico en vez del paquete de Arch, deja el contexto en el default bajo y no revisa si el modelo terminó corriendo en CPU (10 veces más lento), o promete que un modelo local reemplaza a Claude para un cliente.

## Regla 0: verifica antes de confiar

- Versiones y paquetes cambian cada semana en Arch/CachyOS. Antes de instalar: `pacman -Si ollama-cuda llama-cpp ggml-cuda` y revisa la skill `cachyos-hyprland-fish` de `cerebro-linux` (reglas para instalar, actualizar y tocar drivers NVIDIA).
- Confirma la GPU y la memoria real, no la supongas: `nvidia-smi --query-gpu=name,memory.total,memory.used,driver_version --format=csv`.
- Antes de usar un flag o variable, revísalo en la doc oficial (Fuentes) o con `--help`.

## 1. La GPU (verificado nov 2026)

- GeForce RTX 5070: **12 GB GDDR7**, arquitectura Blackwell, compute capability 12.0. (La 5070 Ti tiene 16 GB: confirma cuál es con `nvidia-smi`.)
- Ollama soporta compute capability 5.0+ con driver NVIDIA 550 o más nuevo; vLLM pide 7.5+.
- El escritorio (Hyprland, navegador, juego abierto) también usa VRAM: mira `memory.used` antes de cargar un modelo y cuenta solo lo libre.

## 2. ¿Cabe? Haz la cuenta antes de descargar

**Pesos ≈ parámetros × bits por peso ÷ 8.** Bits por peso medidos por llama.cpp: Q4_K_M ≈ 4.89, Q5_K_M ≈ 5.70, Q6_K ≈ 6.56, Q8_0 ≈ 8.50, F16 = 16. Ejemplo oficial: un modelo de 8B en Q4_K_M pesa 4.9 GB.

Además de los pesos va el **KV cache**, que crece con el contexto, más ~1 GB de sobrecarga. Con ~10 GB útiles de 12:

| Tamaño del modelo | Cuantización razonable | Resultado esperado en 12 GB |
|---|---|---|
| 3–4B | Q8_0 | Holgado, contexto grande |
| 7–9B | Q4_K_M a Q8_0 | Cabe completo con buen contexto |
| 12–14B | Q4_K_M / Q5_K_M | Cabe; vigila el contexto |
| 20–32B densos | Q4_K_M | **No cabe completo**: parte se va a CPU y se vuelve lento |
| MoE grandes | Q4 con expertos en CPU (`--cpu-moe` en llama.cpp) | Funciona pero más lento; mide antes de prometer |

Reglas:
1. Prefiere un modelo más chico en mejor cuantización que uno grande que no cabe. Por debajo de Q4 la calidad cae notablemente.
2. Antes de descargar, revisa el **tamaño del archivo** del tag exacto en ollama.com/library o en Hugging Face, y súmale el KV cache.
3. Confirma después: `ollama ps` debe decir **100% GPU** en la columna PROCESSOR. Si dice CPU/GPU, no cupo: baja tamaño, cuantización o contexto.

## 3. Ollama (lo más simple) en Arch/CachyOS

```bash
sudo pacman -S ollama ollama-cuda      # CachyOS los trae optimizados en sus repos
sudo systemctl enable --now ollama.service
ollama --version
ollama run <modelo:tag>                # descarga y abre chat
ollama ps                              # ¿100% GPU? ¿qué contexto?
```

- No uses el `install.sh` genérico en Arch: usa los paquetes.
- **Contexto**: el default es bajo (la FAQ dice 4096 tokens). Para agentes, código o RAG la doc pide al menos 64000 si cabe. Configúralo en el servicio: `sudo systemctl edit ollama.service` y agrega
  ```
  [Service]
  Environment="OLLAMA_CONTEXT_LENGTH=32768"
  Environment="OLLAMA_KV_CACHE_TYPE=q8_0"
  ```
  luego `sudo systemctl restart ollama`. `q8_0` usa ~la mitad de memoria que `f16` con pérdida casi imperceptible; `q4_0` ~un cuarto con pérdida mayor. Es global para todos los modelos.
- Por defecto escucha solo en `127.0.0.1:11434`. No lo abras a la red (`OLLAMA_HOST=0.0.0.0`) sin firewall o túnel con autenticación.
- APIs: nativa (`/api/chat`, `/api/embed`), compatible con OpenAI (`/v1/chat/completions`) y con Anthropic (`/v1/messages`): el mismo código del SDK de Anthropic puede apuntar a `base_url="http://localhost:11434"` para pruebas.
- Si después de suspender la PC Ollama cae a CPU: `sudo rmmod nvidia_uvm && sudo modprobe nvidia_uvm` (bug de driver documentado por Ollama).

## 4. llama.cpp (más control)

En Arch/CachyOS: `sudo pacman -S llama-cpp ggml-cuda` (el backend CUDA va en `ggml-cuda`). Incluye `llama-server`, `llama-cli` y `llama-bench`.

```bash
llama-server -hf <usuario>/<repo-gguf>:Q4_K_M -c 16384 -ngl all -ctk q8_0 -ctv q8_0 --host 127.0.0.1
```

- Puerto por defecto **9931** (no 8080; cámbialo con `--port`). Trae interfaz web y APIs compatibles con OpenAI (`/v1/chat/completions`) y Anthropic (`/v1/messages`).
- `-ngl` capas en GPU (`auto` por defecto); `-c` contexto; `-fa` flash attention (auto); `--api-key` si lo expones.
- `llama-bench -m modelo.gguf` para medir tokens/s reales antes de comprometerte.
- Úsalo cuando necesites controlar offload, cuantización del KV o MoE con expertos en CPU.

## 5. vLLM (solo si sirves a muchos usuarios a la vez)

- Pensado para alto throughput con muchas peticiones simultáneas; con una sola GPU de 12 GB y un usuario, Ollama o llama.cpp son más simples.
- Requisitos (nov 2026): Linux, Python 3.11–3.14, compute capability 7.5+. Instalación oficial en un entorno virtual: `uv pip install vllm --torch-backend=auto` y luego `vllm download-kernels`. No lo mezcles con el Python del sistema.

## 6. ¿Local o API?

| Local conviene | API conviene |
|---|---|
| Datos que no deben salir de la PC | Calidad máxima (atención a clientes, código, agentes) |
| Volumen alto de tareas simples (clasificar, extraer, embeddings) donde la calidad local alcanza | El cliente necesita disponibilidad 24/7 sin depender de tu PC |
| Experimentar sin costo por token | Poco volumen: Haiku 5.5 cuesta centavos por miles de mensajes (skill `apps-con-llms`) |
| Sin internet o latencia local | No quieres mantener drivers, modelos ni servidor |

Regla: **decide con un eval, no con benchmarks de internet**. Corre los mismos 20–50 casos (skill `apps-con-llms`, sección de evals) en el modelo local y en la API, y compara calidad, latencia y costo (luz incluida). Para un cliente, no prometas un modelo local sin esa tabla.

- Embeddings locales para RAG: ver `rag-y-busqueda`.
- Para entrenar tus propios modelos (el cazador) la GPU se usa distinto: ver `ml-series-de-tiempo`. No corras entrenamiento y un LLM grande al mismo tiempo en 12 GB.
- Para dejarlo como servicio 24/7: skill `servicios-24-7`.

## Antes de decir "listo"

- [ ] Cuenta de VRAM escrita (pesos + KV cache + escritorio) antes de descargar.
- [ ] `ollama ps` (o el log de llama.cpp) muestra el modelo 100% en GPU con el contexto deseado.
- [ ] Tokens/s medidos y anotados.
- [ ] El servidor escucha solo en localhost o está protegido.
- [ ] Si es para un cliente: tabla local vs API con el mismo eval.

## Cómo comprobarlo tú mismo

Con el modelo cargado corre `ollama ps` y `nvidia-smi`: debe decir 100% GPU y la memoria usada no debe llegar al límite. Hazle la misma pregunta 3 veces y mira que responda rápido (varias palabras por segundo, no una).

## Fuentes (verificado nov 2026)

- https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5070-family/ (12 GB GDDR7)
- https://docs.ollama.com/gpu (compute capability 12.0, driver 550+, bug de suspensión)
- https://docs.ollama.com/faq (contexto 4096 por defecto, OLLAMA_HOST, OLLAMA_KV_CACHE_TYPE)
- https://docs.ollama.com/context-length (64000 para agentes, `ollama ps`)
- https://docs.ollama.com/api/anthropic-compatibility
- https://wiki.archlinux.org/title/Ollama (`ollama` + `ollama-cuda`, `ollama.service`)
- https://archlinux.org/packages/ y https://packages.cachyos.org/ (`ollama-cuda` 0.40.16, `llama-cpp` 0.9.0, `ggml-cuda` 0.29.0 en extra y repos CachyOS, nov 2026)
- https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md (flags, puerto 9931, APIs)
- https://github.com/ggml-org/llama.cpp/blob/master/tools/quantize/README.md (bits por peso, 8B Q4_K_M = 4.9 GB)
- https://docs.vllm.ai/en/latest/getting_started/installation/gpu/
