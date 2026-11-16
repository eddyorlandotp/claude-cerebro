---
name: cv-y-entrevistas
description: CV de una página para primer empleo en México sin experiencia formal, adaptado a cada vacante, carta corta, perfiles en OCC/Computrabajo/LinkedIn/Indeed, entrevista (STAR) y seguimiento. Usa con CV, currículum, vacante, entrevista.
---

# CV y entrevistas (primer empleo en México)

El error que corrige: Claude escribe CVs genéricos de dos páginas, inventa logros ("aumenté ventas 30%"), infla el inglés, llena de habilidades blandas sin prueba y nunca adapta el CV a la vacante. Aquí todo sale de un archivo de datos reales, cada línea tiene evidencia y el entregable es un PDF de una página que un ATS puede leer.

## Reglas duras

1. **Cero inventos.** No escribas cifras, empresas, certificados, niveles de idioma ni fechas que el usuario no te dio. Si falta un dato, pregunta o deja `[FALTA: …]` visible. Un CV con mentiras se cae en la entrevista.
2. **Una página.** Sin experiencia formal, dos páginas solo diluyen. Compruébalo con `pdfinfo cv.pdf | grep Pages`.
3. **Sin datos sensibles en el CV:** nada de CURP, RFC, NSS, número de INE, dirección completa, estado civil, religión, salud. Basta ciudad, correo, teléfono y enlaces. Esos documentos se entregan hasta que te contratan (los reclutadores falsos piden datos y documentos para robar identidad).
4. **El usuario decide qué se envía.** Tú no postulas, no mandas correos ni mensajes a reclutadores sin un "sí" explícito por cada envío.
5. **Explica en 1–3 frases** cada decisión de contenido ("Pongo tus proyectos arriba de la escuela porque son tu prueba de que sabes hacer cosas").

## Estructura de archivos (entregables)

Pregunta una vez dónde guardar; por defecto `~/vida/empleo/`. Nunca dentro de un repo público.

```
empleo/
  datos-base.md            fuente única de verdad: todo lo real, sin filtrar
  cv-base.md               CV maestro de una página
  postulaciones.csv        seguimiento de cada vacante
  vacantes/<empresa>-<puesto>/
    vacante.md             texto de la vacante tal cual (pegado por el usuario)
    cv.md / cv.pdf / cv.docx
    carta.md
    entrevista.md          preguntas probables + historias STAR + preguntas para ellos
```

Plantillas de cada archivo: lee `references/plantillas.md` antes de crear el primero.

## Paso 1 — Entrevista al usuario para `datos-base.md`

Haz las preguntas en bloques de 3–4, no 20 de golpe:
- Contacto: nombre, ciudad, correo (que se vea profesional), teléfono, LinkedIn/portafolio/GitHub.
- Estudios: escuela, nivel, semestre actual, horario de clases (define la disponibilidad real).
- **Disponibilidad**: turno, días, desde cuándo. Para quien estudia es lo primero que filtra el reclutador.
- Proyectos propios y emprendimientos: qué hiciste tú, con qué herramientas, para quién, resultado medible **real** (clientes atendidos, ventas, usuarios, páginas publicadas) y enlace de evidencia.
- Trabajo informal: negocio familiar, ventas, freelance, ayudar en eventos. Cuenta como experiencia si dices qué hacías.
- Habilidades verificables: herramientas que de verdad usó (y para qué), idiomas con nivel honesto (si no hay certificado, describe: "leo documentación técnica en inglés").
- Cursos o certificados con institución y año.

## Paso 2 — Qué poner sin experiencia formal

Orden recomendado para primer empleo: **Encabezado → Perfil (2–3 líneas) → Proyectos y experiencia → Habilidades → Educación → Idiomas**.

- **Proyectos como experiencia.** Formato por viñeta: verbo en pasado + qué + con qué + resultado/evidencia.
  - Bien: "Diseñé y publiqué páginas web para 3 negocios locales con [herramienta]; mantenimiento mensual. Ejemplo: [enlace]."
  - Mal: "Persona proactiva con gran capacidad de liderazgo y trabajo en equipo."
- **Emprendimientos sí, traducidos al puesto.** Para un puesto de atención al cliente destaca trato con clientes y cobros; para soporte técnico, lo técnico. No cuentes lo que asuste ("trading de memecoins") salvo que el puesto lo valore.
- **Habilidades: máximo 8–10**, agrupadas (Herramientas / Técnicas / Idiomas). Solo las que puede demostrar en una prueba.
- **Perfil** de 2–3 líneas escrito para ESE tipo de puesto, incluyendo disponibilidad ("Disponible turno matutino a partir de …").
- **Foto**: opcional; si la pone, fondo liso y ropa formal. En portales que la piden por campo, súbela ahí y no en el PDF.

## Paso 3 — Adaptar a cada vacante (siempre)

1. Pide el texto completo de la vacante y guárdalo en `vacante.md`.
2. Extrae una tabla: requisito → evidencia del usuario → dónde aparece en el CV. Requisito sin evidencia = di la verdad ("no lo tienes; menciona que lo estás aprendiendo solo si es cierto").
3. Usa las palabras exactas de la vacante cuando describan algo que el usuario sí hizo (los ATS filtran por palabras clave). No pegues listas de palabras sin contexto.
4. Reordena viñetas: lo más relevante para esa vacante, arriba.
5. Formato ATS: una columna, títulos estándar (Experiencia, Educación, Habilidades), sin tablas, íconos, barras de nivel ni texto en imágenes. Comprueba con `pdftotext cv.pdf - | head -40`: si el texto sale revuelto, el ATS también lo verá así.

## Paso 4 — Carta corta

120–180 palabras, tres párrafos: por qué esa empresa/puesto (algo concreto de la vacante), qué prueba tienes (1–2 proyectos con resultado), disponibilidad y cierre con llamada a la acción. Va en el cuerpo del correo o en el campo de mensaje del portal, no como adjunto extra si no la piden. Para que no suene a IA usa la skill `copy-espanol-mx` de cerebro-negocio si está instalada.

## Paso 5 — Exportar a PDF/DOCX

1. Usa las skills de documentos (`docx` y `pdf` de document-skills de Anthropic) para generar `cv.docx` y `cv.pdf` desde `cv.md`: tipografía legible (10.5–11 pt), márgenes ~2 cm, nombre grande, sin colores chillones.
2. Sin esas skills: `pandoc cv.md -o cv.docx` y `soffice --headless --convert-to pdf cv.docx` (si no están instalados, dile al usuario qué instalar y pide permiso; en Arch busca el nombre con `pacman -Ss pandoc`).
3. Verifica: `pdfinfo cv.pdf | grep Pages` → 1; `pdftotext` legible; renderiza la página (`pdftoppm -png -r 80 cv.pdf prev`) y míralo antes de decir que quedó.
4. Nombre del archivo: `CV-Nombre-Apellido-Puesto.pdf`, sin acentos ni espacios.

## Perfiles en portales (a nov 2026)

Las bolsas de empleo y LinkedIn empatan como canal donde los trabajadores encuentran vacantes (49% cada uno según el Termómetro Laboral de OCC, ago 2026). Prioriza:

| Portal | Para qué | Nota |
|---|---|---|
| OCC Mundial | Vacantes formales, muchas de oficina | Completa el perfil al 100%; sube el PDF |
| Computrabajo | Mucho volumen de vacantes operativas y de primer empleo | Filtra por ciudad y "sin experiencia" |
| Indeed | Agrega vacantes de muchos sitios | Revisa en qué sitio termina la postulación |
| LinkedIn | Visibilidad y contacto directo con reclutadores | Titular claro + disponibilidad + enlaces a proyectos |

- Un mismo texto base para todos los perfiles, sacado de `cv-base.md`, para que no se contradigan.
- Programa público para 18–29 años que **no estudian ni trabajan**: Jóvenes Construyendo el Futuro (apoyo mensual y seguro IMSS; registro en https://jovenesconstruyendoelfuturo.stps.gob.mx/aprendiz). Si el usuario estudia, no cumple ese requisito: dilo.
- **Señales de fraude** (Fiscalía de Chihuahua): sueldo exagerado, te piden depósito por "gastos de reclutamiento", correo de Gmail/Hotmail en vez de dominio de la empresa, urgencia ("oportunidad única"), piden documentos antes de entrevistarte. Nunca pagues para obtener un empleo.

## Paso 6 — Preparar la entrevista (`entrevista.md`)

1. **Preguntas probables**: "Háblame de ti", "¿Por qué quieres trabajar aquí?", "¿Por qué deberíamos contratarte sin experiencia?", "Cuéntame de un problema que resolviste", "¿Un error que cometiste?", "¿Cómo manejas a un cliente molesto?", "¿Cómo vas a combinar escuela y trabajo?", "¿Cuáles son tus expectativas salariales?", y 2–3 sacadas de la vacante.
2. **5 historias STAR** del material real (proyectos, negocio, escuela): **S**ituación (1 frase), **T**area (qué te tocaba), **A**cción (lo que hiciste TÚ, en detalle), **R**esultado (medible si hay número real + qué aprendiste). Cada historia sirve para varias preguntas; anota cuáles.
3. **"Háblame de ti"** en 60–90 segundos: presente (estudias, qué haces) → pasado (proyecto que lo prueba) → futuro (por qué este puesto).
4. **Sueldo**: no inventes rangos. Pide al usuario buscar 5–10 vacantes iguales en su ciudad en los portales y anota los sueldos publicados en `entrevista.md`; responde con un rango basado en eso.
5. **3 preguntas para ellos** (horario real, capacitación, cómo miden el desempeño).
6. **Simulacro**: ofrece hacer de entrevistador. Una pregunta a la vez, espera su respuesta, retroalimenta en 3 puntos (qué funcionó, qué faltó, versión mejorada corta). No respondas por él.

## Paso 7 — Seguimiento (`postulaciones.csv`)

Columnas: `fecha,empresa,puesto,portal,enlace,estado,siguiente_paso,fecha_seguimiento,notas`. Estados: `por enviar, enviada, entrevista, prueba, oferta, rechazada, sin respuesta`.
- Tras cada entrevista: mensaje de agradecimiento el mismo día (3–4 líneas) y anota la fecha que te dieron para respuesta.
- Si no dieron fecha, un seguimiento amable después de una semana; si no responden al segundo, marca `sin respuesta` y sigue.
- Revisa el CSV cada semana con el usuario: cuántas enviadas, cuántas respuestas. Si hay 15+ enviadas y 0 respuestas, el problema es el CV o el tipo de vacante: revisa ambos antes de mandar más.

## Al terminar

Dile al usuario: (1) qué archivos quedaron y dónde, (2) qué datos marcaste como `[FALTA]`, (3) cómo comprobarlo él mismo: abrir el PDF, confirmar que es una página, copiar el texto del PDF a un bloc de notas y ver que se lee en orden.

## Verifica antes de confiar

Portales, programas públicos y montos cambian. Antes de afirmar que un portal o programa existe o cuánto paga, ábrelo con WebFetch o búscalo; si no puedes verificar, dilo.

## Fuentes (verificado nov 2026)

- https://idconline.mx/laboral/2026/08/06/publicar-vacantes-en-bolsas-de-trabajo-o-linkedin-que-canal-prefieren-los-candidatos (Termómetro Laboral OCC 314: 49% bolsas de empleo, 49% LinkedIn)
- https://idconline.mx/laboral/2026/07/06/como-hacer-un-curriculum-vitae-11-elementos-que-no-pueden-faltar (palabras clave y ATS)
- https://www.elimparcial.com/dinero/2026/10/14/jovenes-construyendo-el-futuro-asi-puedes-registrarte-y-esto-recibiras-de-apoyo-economico/ (requisitos JCF 2026)
- https://chihuahua.gob.mx/prensa/emite-fiscalia-recomendaciones-para-evitar-ser-victima-de-fraude-laboral (señales de fraude laboral)
- https://mx.computrabajo.com/ · https://www.occ.com.mx/ · https://mx.indeed.com/ · https://www.linkedin.com/
