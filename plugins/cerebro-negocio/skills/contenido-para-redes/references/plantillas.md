# Plantillas de contenido

Copia estas estructuras tal cual. Reemplaza lo que está entre `[ ]`. No agregues secciones de relleno.

## 1. Guion — `contenido/guiones/AAAA-MM-DD-slug.md`

```markdown
# [Título interno corto]
- Proyecto: [nombre]   - Formato: [demo | build in public | antes/después | fallo y arreglo | respuesta | tutorial]
- Duración objetivo: [20] s   - Para: [persona concreta]   - CTA: [una sola acción]
- Qué grabar: [pantalla del celular | pantalla de PC | cara a cámara | mixto]

## Ganchos (graba los 3 inicios)
| # | Texto en pantalla (≤ 8 palabras) | Lo que dices (1 frase) | Lo que se ve |
|---|---|---|---|
| A | | | |
| B | | | |
| C | | | |

## Guion
| Tiempo | Se ve | Se dice | Texto en pantalla |
|---|---|---|---|
| 0–2 s | (gancho elegido) | | |
| 2–5 s | | [contexto en 1 frase] | |
| 5–15 s | | [paso 1, paso 2] | |
| 15–20 s | [resultado visible] | [payoff] | |
| final | | [CTA] | |

## Checklist antes de publicar
- [ ] El gancho pasa en ≤ 2 s y se entiende sin audio
- [ ] Algo cambia en pantalla cada 2–4 s
- [ ] Subtítulos quemados y revisados (nombres bien escritos)
- [ ] Nada importante en la zona tapada (arriba ~14 %, abajo ~35 %, columna derecha)
- [ ] Sin llaves, seed, API keys, direcciones de billetera ni saldos en pantalla
- [ ] (cripto) Sin promesas de ganancia ni "compra X"

## Publicación
- TikTok: [caption] [3-5 hashtags de nicho]
- Reels: [caption; la primera línea es la que se ve]
- Shorts (título ≤ 60 car.): [título con palabra clave]
- X: [1 frase + video] o enlace a hilo
```

## 2. Calendario semanal — `contenido/calendario-AAAA-semNN.md`

```markdown
# Semana [NN] — [proyecto]
Objetivo de la semana: [ej. probar 3 ganchos de "fallo y arreglo"]
Variable que cambia esta semana: [solo una]
Aprendizajes de la semana pasada (de registro.csv):
1. 
2. 
3. 

| Día | Plataformas | Formato | Gancho (A) | Guion | Graba | Publica | Estado |
|---|---|---|---|---|---|---|---|
| Lun | TT, IG, YT | demo | | guiones/AAAA-MM-DD-slug.md | dom 18:00 | 19:00 | pendiente |
| Mié | TT, IG, YT, X | build in public | | | | | |
| Vie | TT, IG, YT | fallo y arreglo | | | | | |
| Sáb | X | hilo | | | — | 11:00 | |

Bloque de grabación: [día y hora en que se graban todos juntos]
```

Calcula fechas reales con `date` (no las adivines): `date -d 'next monday' +%F` y `date +%G-sem%V`.

## 3. Registro de métricas — `contenido/registro.csv`

```csv
fecha,plataforma,slug,formato,gancho,duracion_s,vistas_48h,prom_visto_s,retencion_inicio_pct,vistas_completas_pct,compartidos,guardados,visitas_perfil,clics_link,registros,nota
2026-11-17,tiktok,demo-alertas,demo,A,22,,,,,,,,,,
```
- `retencion_inicio_pct`: YouTube "Stayed to watch"; en TikTok usa prom_visto_s / duracion_s como aproximación.
- Deja vacío lo que la plataforma no da; no lo estimes.
- Para resumir: `column -s, -t < contenido/registro.csv | less -S`

## 4. Hilo de X para un producto (cripto o no)

```text
1/ [Gancho: problema concreto o algo que construiste]. Hilo de cómo funciona 🧵   (≤ 280 car.)
2/ El problema: [en una frase, con un dato verificable si lo hay]
3/ Lo que hice: [función 1] + captura/video
4/ [función 2] + captura/video
5/ Lo que todavía no hace / lo que sigue: [honesto]
6/ Qué es: [producto] para [persona]. [link]
   Operar memecoins es de alto riesgo; puedes perder todo lo que pongas.   (solo si es cripto)
```

Ejemplo de primer post SIN promesa (bien):
`Llevo 3 semanas construyendo una terminal para operar memecoins en Solana sin saber programar. Hoy terminé las alertas de liquidez. Así funciona 🧵`

Ejemplo CON promesa (mal, no lo escribas):
`Con mi terminal vas a cazar los próximos x100 antes que nadie 🚀💰`
