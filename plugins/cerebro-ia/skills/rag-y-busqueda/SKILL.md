---
name: rag-y-busqueda
description: Responder con documentos propios (RAG) - cuándo meter todo al contexto, chunking, embeddings, búsqueda híbrida BM25 más vectores, rerank, SQLite, pgvector o Vectorize, citar fuentes y medir recuperación. Usa con RAG, embeddings.
---

# RAG y búsqueda que sí encuentra

El error que corrige: Claude arma un RAG con base vectorial para 30 páginas que cabían en el prompt, corta los documentos cada N caracteres sin metadatos, usa solo vectores (y falla con nombres de producto, SKUs o fechas exactas), no cita la fuente y declara "funciona" con dos preguntas de prueba.

## Regla 0: verifica antes de confiar

- Límites y precios de bases vectoriales y de embeddings cambian. Antes de elegir, abre la doc oficial (Fuentes) o usa Context7. Para código del SDK de Claude usa la skill `claude-api`.
- Explícale al usuario la decisión en 1–3 frases ("Tus 40 páginas caben completas en el prompt con caché; no hace falta base vectorial").

## 1. ¿RAG o todo en el contexto?

Anthropic recomienda: si la base de conocimiento es **menor a ~200k tokens (unas 500 páginas)**, métela completa al prompt sin RAG. Hoy los modelos 5.x tienen 1M de contexto, pero el costo crece con cada token que mandas en cada pregunta.

Haz la cuenta con prompt caching (skill `apps-con-llms`):
- 80k tokens de documentos en caché con Sonnet 5.5: 80,000 × $0.10/M = **$0.008 por pregunta** en lectura de caché. Barato y sin fallos de recuperación.
- Con Haiku 5.5 cuidado: arriba de 100k tokens de prompt sube a la tarifa larga ($0.50/M entrada, $0.05/M caché).

| Situación | Decisión |
|---|---|
| < ~100k tokens, cambia poco | Todo al contexto + caché |
| 100k–1M tokens, pocas preguntas al día | Todo al contexto puede seguir siendo lo más simple; compara costo/mes |
| Más grande, cambia seguido, o miles de preguntas al día | RAG |
| Datos tabulares (precios, inventario) | **No es RAG**: es una consulta SQL que el modelo llama como herramienta |

## 2. Chunking (cómo partir los documentos)

1. Parte por **estructura**, no por caracteres: secciones con encabezado, una pregunta de FAQ, una ficha de producto, un artículo del reglamento. Fragmentos de unos cientos de tokens.
2. Cada chunk lleva metadatos: `doc_id`, `titulo`, `seccion`, `url` o `archivo`, `pagina`, `actualizado_en`, `hash` del texto, `cliente_id` si hay varios clientes.
3. **Contexto del chunk**: un fragmento suelto ("El plazo es de 30 días") no dice de qué habla. Antepón un contexto corto ("Política de devoluciones de la tienda X: ...") escrito por un LLM barato con el documento completo en caché. Anthropic llama a esto Contextual Retrieval: reduce las recuperaciones fallidas 49%, y 67% sumando rerank. Alternativa: el modelo `voyage-context-4`, que genera embeddings contextualizados.
4. Limpia antes de indexar: quita menús, pies de página repetidos, duplicados. Guarda el texto original para poder citar.

## 3. Embeddings

- Anthropic no tiene modelo propio de embeddings; su doc recomienda **Voyage AI**. A nov 2026: `voyage-4` (general, multilingüe), `voyage-4-lite` (barato y rápido), `voyage-4-large` (mejor calidad), `voyage-4-nano` (pesos abiertos para correr en tu GPU). Dimensión por defecto 1024 (también 256, 512, 2048). Verifica precios en voyageai.com.
- Local: Ollama también genera embeddings (`/api/embed`); ver skill `modelos-locales`.
- Usa **el mismo modelo** para indexar y para preguntar. En Voyage indica `input_type="document"` al indexar y `"query"` al buscar.
- Guarda en la base qué modelo y dimensión usaste. Si cambias de modelo, re-embebe todo; nunca mezcles.
- Elige la dimensión según tu base: Cloudflare Vectorize acepta máximo 1536; pgvector indexa `vector` hasta 2,000 dimensiones.

## 4. Búsqueda híbrida + rerank

Solo vectores falla con coincidencias exactas (códigos, nombres propios, números). Haz:
1. **BM25 / texto completo**: SQLite FTS5 (`bm25()`), o full-text de Postgres. Top 20–50.
2. **Vectores**: top 20–50 por similitud coseno.
3. **Fusión** con Reciprocal Rank Fusion: `score = Σ 1/(60 + rank)` sumando cada lista (k = 60 es el valor del paper original). Simple y sin calibrar pesos.
4. **Rerank** opcional: `rerank-3` o `rerank-3-lite` de Voyage sobre los ~20 mejores, y quédate con 5–8 para el prompt.
5. **Filtra por metadatos antes** (cliente, idioma, vigencia), no después: un chatbot nunca debe ver documentos de otro cliente.

## 5. Dónde guardar (opciones baratas)

| Opción | Cuándo | Notas (verifica límites) |
|---|---|---|
| **SQLite + FTS5 + sqlite-vec** | Hasta decenas de miles de chunks, un solo servidor o app local | Todo en un archivo; sqlite-vec es pre-v1 (puede romper compatibilidad): fija la versión |
| **Postgres + pgvector** (local o Supabase) | Ya usas Postgres, varios clientes, filtros SQL | Índice HNSW (`vector_cosine_ops`); `vector` indexable hasta 2,000 dims, `halfvec` hasta 4,000; full-text en la misma base |
| **Cloudflare Vectorize** | El bot ya corre en Workers | Gratis: 5 M dimensiones guardadas (≈ 4,880 vectores de 1024 dims) y 30 M dimensiones consultadas/mes. Paid: 10 M guardadas + 50 M consultadas incluidas. Máx. 1536 dims, `topK` 50 con metadata, 10 KiB de metadata por vector. No trae BM25: combínalo con D1 FTS5 |

Haz la cuenta antes de elegir Vectorize: `chunks × dimensiones` contra 5 M gratis.

## 6. Generar la respuesta y citar

- Pasa los fragmentos con su fuente. Opciones nativas de Claude:
  - **Citations**: documentos con `citations: {"enabled": true}` (todos o ninguno en el request); la respuesta trae `cited_text` que apunta al documento y no cuenta como tokens de salida.
  - **Search result blocks**: devuelve los resultados de tu buscador como bloques `search_result` en el `tool_result`; Claude cita como si fuera búsqueda web.
- Instrucción mínima: "Responde solo con la información de los documentos. Si no está, di que no la tienes y ofrece pasar con una persona."
- Muestra la fuente al usuario final (título + enlace o página).

## 7. Evaluar la recuperación (antes que la respuesta)

1. Arma `evals/recuperacion.jsonl`: 30–50 preguntas reales, cada una con los `chunk_id` que contienen la respuesta. Incluye preguntas con códigos exactos, sinónimos y preguntas sin respuesta.
2. Mide **recall@k** (k = 5, 10, 20): % de preguntas cuyo chunk correcto aparece en los primeros k. Anthropic usó 1 − recall@20 para medir fallas.
3. Compara variantes cambiando **una cosa a la vez** (chunking, contexto, híbrido, rerank) y guarda la tabla.
4. Luego evalúa la respuesta final (correcta, citada, dice "no sé" cuando no hay dato), como en `apps-con-llms`.

## 8. Mantenimiento

- Re-indexa por `hash`: solo los documentos que cambiaron; borra chunks de documentos eliminados.
- Fecha de actualización visible: "Información al 12 nov 2026".
- No indexes datos personales que el bot no necesite.

## Antes de decir "listo"

- [ ] Decisión RAG vs contexto con la cuenta escrita.
- [ ] Chunks con metadatos y contexto; mismo modelo de embeddings en índice y consulta.
- [ ] Búsqueda híbrida (o explicación de por qué no hace falta).
- [ ] recall@k medido con al menos 30 preguntas, con números.
- [ ] Respuestas citan la fuente y dicen "no sé" cuando corresponde.

## Cómo comprobarlo tú mismo

Hazle al bot 5 preguntas cuya respuesta conoces (una con un código exacto y una que no esté en los documentos). Cada respuesta correcta debe mostrar de qué documento salió; la que no está debe responder que no tiene el dato.

## Fuentes (verificado nov 2026)

- https://www.anthropic.com/engineering/contextual-retrieval (200k tokens, 49% / 67%, recall@20)
- https://platform.claude.com/docs/en/build-with-claude/embeddings (modelos Voyage)
- https://platform.claude.com/docs/en/build-with-claude/citations
- https://platform.claude.com/docs/en/build-with-claude/search-results
- https://platform.claude.com/docs/en/about-claude/pricing
- https://developers.cloudflare.com/vectorize/platform/limits/
- https://developers.cloudflare.com/vectorize/platform/pricing/ (actualizada 30 oct 2026)
- https://github.com/pgvector/pgvector (README: HNSW, límites de dimensiones)
- https://github.com/asg017/sqlite-vec (README: pre-v1)
- https://www.sqlite.org/fts5.html (bm25)
- https://docs.ollama.com/capabilities/embeddings
- https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf (Reciprocal Rank Fusion, k = 60)
