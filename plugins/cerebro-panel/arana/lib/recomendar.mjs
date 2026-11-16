// Recomendador de skills sin IA: BM25 sobre nombre + descripción + plugin, con sinónimos.
// Elige por palabras, no entiende; por eso existe un umbral (para callar cuando no hay
// coincidencia clara) y `buscar` (sin umbral) para cuando Claude quiere preguntar.
import { terminos, sinonimos, alias } from './texto.mjs';

const K1 = 1.2;
const B = 0.6;
const PESO_SINONIMO = 0.5;
const PESO_ALIAS = 0.85;
const ESCALA = 7; // puntaje = 1 - exp(-bm25 / ESCALA)
export const UMBRAL = 0.6;
const RELATIVO = 0.72; // una sugerida debe llegar al menos a esta fracción de la mejor
const CASTIGO_APAGADA = 0.85; // en modo completo una skill apagada debe ganar por más margen

function pesosDe(skill, prefijo) {
  if (skill.terminos) return skill.terminos;
  const t = {};
  const sumar = (texto, peso) => {
    for (const r of terminos(texto)) t[r] = (t[r] ?? 0) + peso;
  };
  sumar(skill.nombre ?? '', 3);
  if (prefijo) sumar(prefijo, 1);
  sumar(skill.desc ?? '', 1);
  return t;
}

/** Aplana el índice y calcula las estadísticas del corpus (se guarda en el propio objeto para no repetir). */
function corpus(indice) {
  if (indice && indice.__corpus) return indice.__corpus;
  const docs = [];
  const df = new Map();
  let total = 0;
  for (const p of indice?.plugins ?? []) {
    const esSuelto = p.nombre === 'personales' || p.nombre === 'proyecto';
    for (const s of p.skills ?? []) {
      const pesos = pesosDe(s, esSuelto ? '' : p.nombre);
      let largo = 0;
      for (const [t, w] of Object.entries(pesos)) {
        largo += w;
        df.set(t, (df.get(t) ?? 0) + 1);
      }
      total += largo;
      docs.push({
        id: s.id,
        nombre: s.nombre,
        desc: s.desc ?? '',
        activo: p.activo !== false,
        manual: s.manual === true,
        plugin: p.nombre,
        clavePlugin: p.clave ?? p.nombre,
        extras: p.extras ?? null,
        ruta: s.ruta ?? null,
        enNombre: new Set(terminos(s.nombre ?? '')),
        pesos,
        largo,
      });
    }
  }
  const c = { docs, df, n: docs.length, medio: docs.length ? total / docs.length : 1 };
  if (indice && typeof indice === 'object') Object.defineProperty(indice, '__corpus', { value: c, enumerable: false });
  return c;
}

/** Términos de la consulta con peso: 1 los que escribió el usuario, 0.5 sus sinónimos. */
function consulta(texto) {
  const propios = [...new Set(terminos(texto))];
  const mapa = sinonimos();
  const q = new Map(); // término -> { peso, origen (término original que lo trajo) }
  for (const t of propios) q.set(t, { peso: 1, origen: t });
  const extra = alias();
  for (const t of propios) {
    for (const s of extra.get(t) ?? []) {
      if (!q.has(s)) q.set(s, { peso: PESO_ALIAS, origen: t });
    }
  }
  for (const t of propios) {
    for (const s of mapa.get(t) ?? []) {
      if (!q.has(s)) q.set(s, { peso: PESO_SINONIMO, origen: t });
    }
  }
  return { propios, q };
}

/**
 * Puntúa todas las skills contra un texto. Devuelve la lista ordenada con detalle
 * (conceptos distintos de la consulta que tocó cada skill y si alguno cayó en el nombre).
 */
export function puntuar(indice, texto) {
  const { docs, df, n, medio } = corpus(indice);
  const { propios, q } = consulta(texto);
  if (!propios.length || !n) return [];
  const salida = [];
  for (const d of docs) {
    let suma = 0;
    const conceptos = new Set();
    let nombreDirecto = false;
    let nombreSinonimo = false;
    for (const [t, { peso, origen }] of q) {
      const tf = d.pesos[t];
      if (!tf) continue;
      // En instalaciones con pocas skills se calcula como si hubiera al menos 50, para que el umbral signifique lo mismo.
      const idf = Math.log(1 + (Math.max(n, 50) - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
      suma += peso * idf * ((tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * d.largo) / medio)));
      conceptos.add(origen);
      if (d.enNombre.has(t)) {
        if (peso === 1) nombreDirecto = true;
        else nombreSinonimo = true;
      }
    }
    if (suma <= 0) continue;
    salida.push({
      id: d.id,
      puntaje: Math.round((1 - Math.exp(-suma / ESCALA)) * 100) / 100,
      bruto: suma,
      activo: d.activo,
      manual: d.manual,
      conceptos: conceptos.size,
      enNombre: nombreDirecto,
      enNombreSinonimo: nombreSinonimo,
      conceptosConsulta: propios.length,
      desc: d.desc,
      plugin: d.plugin,
      clavePlugin: d.clavePlugin,
      extras: d.extras,
      ruta: d.ruta,
    });
  }
  salida.sort((a, b) => b.bruto - a.bruto || a.id.localeCompare(b.id));
  return salida;
}

/**
 * Skills recomendadas para un texto.
 * - `k`: máximo de resultados. `umbral`: puntaje mínimo (0..1).
 * - modo 'completo': a lo mucho una skill de plugin apagado, y solo si gana con margen.
 * - modo 'ligero': todas compiten igual (todo lo instalado está al alcance de la araña).
 * Devuelve [{ id, puntaje, activo }] (más `desc`, `clavePlugin`, `extras`, `ruta` para quien los quiera).
 */
export function recomendar(indice, texto, { k = 3, umbral = UMBRAL, modo = 'completo', incluirManuales = false } = {}) {
  const candidatas = puntuar(indice, texto).filter((c) => {
    if (c.manual && !incluirManuales) return false;
    // Coincidencia clara: dos conceptos distintos del mensaje, o uno solo si cae en el nombre de la skill
    // (por sinónimo solo cuenta en mensajes cortos, donde no hay más de dónde agarrarse).
    return c.conceptos >= 2 || c.enNombre || (c.enNombreSinonimo && c.conceptosConsulta <= 2);
  });
  const ligero = modo === 'ligero';
  const salida = [];
  const porPlugin = new Map();
  const maxPorPlugin = Math.max(2, k - 1);
  let apagadas = 0;
  let mejor = 0;
  const mejorActiva = candidatas.find((c) => c.activo)?.puntaje ?? 0;
  for (const c of candidatas) {
    if (salida.length >= k) break;
    let puntaje = c.puntaje;
    if (!ligero && !c.activo) {
      puntaje = Math.round(puntaje * CASTIGO_APAGADA * 100) / 100;
      if (apagadas >= 1 || puntaje < mejorActiva * 0.9) continue;
    }
    // Además del umbral fijo, nada que quede muy por debajo de la mejor.
    if (puntaje < umbral || puntaje < mejor * RELATIVO) continue;
    const usados = porPlugin.get(c.clavePlugin) ?? 0;
    if (usados >= maxPorPlugin) continue;
    porPlugin.set(c.clavePlugin, usados + 1);
    if (!salida.length) mejor = puntaje;
    if (!c.activo) apagadas++;
    salida.push({ id: c.id, puntaje, activo: c.activo, desc: c.desc, clavePlugin: c.clavePlugin, extras: c.extras, ruta: c.ruta });
  }
  salida.sort((a, b) => b.puntaje - a.puntaje);
  return salida;
}

/** Como recomendar pero sin umbral ni filtro de claridad: para `arana buscar`. */
export function buscar(indice, texto, { k = 5 } = {}) {
  return puntuar(indice, texto)
    .slice(0, k)
    .map((c) => ({ id: c.id, puntaje: c.puntaje, activo: c.activo, manual: c.manual, desc: c.desc, clavePlugin: c.clavePlugin, extras: c.extras, ruta: c.ruta }));
}
