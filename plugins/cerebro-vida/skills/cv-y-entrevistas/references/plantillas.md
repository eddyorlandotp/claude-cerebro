# Plantillas para cv-y-entrevistas

Rellena solo con datos reales de `datos-base.md`. Lo que falte queda como `[FALTA: …]`.

## datos-base.md

```markdown
# Datos base (privado, no subir a ningún repo)
Actualizado: AAAA-MM-DD

## Contacto
- Nombre:
- Ciudad:
- Correo:
- Teléfono:
- Enlaces (portafolio, LinkedIn, GitHub):

## Disponibilidad
- Turno / días / horario:
- Desde:

## Estudios
- Escuela, nivel, semestre, horario de clases:

## Proyectos y experiencia (todo, luego se filtra)
### <Proyecto o trabajo>
- Qué era:
- Qué hice yo:
- Herramientas:
- Resultado real (número solo si es verificable):
- Evidencia (enlace, captura, referencia):
- Fechas:

## Habilidades (con dónde las usé)
## Idiomas (nivel honesto + evidencia)
## Cursos y certificados (institución, año)
```

## cv-base.md (una página)

```markdown
# NOMBRE APELLIDO
Ciudad · correo · teléfono · enlace-portafolio · linkedin

## Perfil
[2–3 líneas: qué sabes hacer + prueba + disponibilidad. Ej.: "Estudiante de … con experiencia creando
… para clientes reales. Disponible turno matutino a partir de …"]

## Proyectos y experiencia
**[Rol] — [Proyecto/negocio]** · [mes año]–[mes año / actual]
- [Verbo] [qué] con [herramienta]; [resultado real]. [enlace]
- …

**[Rol] — [Proyecto/negocio]** · [fechas]
- …

## Habilidades
- Herramientas: …
- Técnicas: …

## Educación
**[Escuela]** — [nivel], [semestre/estado] · [años]

## Idiomas
- Español: nativo
- Inglés: [nivel honesto + evidencia]
```

## carta.md (120–180 palabras)

```markdown
Asunto: Postulación — [Puesto] — [Nombre Apellido]

Hola, [nombre del reclutador o "equipo de [Empresa]"]:

Vi la vacante de [puesto] en [portal]. Me interesa porque [algo concreto de la vacante o la empresa].

[Prueba: 1–2 proyectos reales con resultado y enlace, conectados a un requisito de la vacante.]

Tengo disponibilidad [turno/días] a partir de [fecha]. Adjunto mi CV; ¿podemos agendar una llamada
esta semana?

Saludos,
[Nombre] · [teléfono]
```

## entrevista.md

```markdown
# Entrevista — [Empresa] — [Puesto] — [fecha y hora, modalidad, dirección o enlace]

## Háblame de ti (60–90 s)
Presente: … / Pasado: … / Futuro: …

## Historias STAR
### 1. [Título corto] — sirve para: [preguntas]
- S:
- T:
- A:
- R:

## Preguntas probables y mi idea de respuesta
| Pregunta | Historia / respuesta clave |
|---|---|

## Sueldo
Vacantes comparables (portal, ciudad, sueldo publicado): …
Rango que voy a decir: …

## Mis preguntas para ellos
1.
2.
3.

## Logística
Documentos que llevar (si los piden): CV impreso, identificación. Llegar 10 min antes.
```

## Mensaje de agradecimiento (mismo día)

```
Hola [nombre], gracias por la entrevista de hoy para [puesto]. Me quedó claro que [algo que dijeron]
y me entusiasma poder aportar con [habilidad/proyecto]. Quedo atento a los siguientes pasos.
[Nombre]
```

## Seguimiento (si no dieron fecha, a la semana)

```
Hola [nombre], te escribo para dar seguimiento a mi postulación a [puesto] del [fecha].
Sigo muy interesado; si necesitan algo más de mi parte, con gusto lo envío. Saludos, [Nombre]
```

## postulaciones.csv

```csv
fecha,empresa,puesto,portal,enlace,estado,siguiente_paso,fecha_seguimiento,notas
```
