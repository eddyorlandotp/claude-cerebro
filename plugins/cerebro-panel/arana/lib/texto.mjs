// Utilidades de texto para la araña: normalizar, tokenizar, stopwords es/en,
// raíces ligeras (stemming) y un diccionario chico de sinónimos.
// Todo es determinista y local: aquí no hay modelos ni red.

/** Minúsculas y sin acentos (ñ -> n). */
export function normalizar(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

const STOP_ES = `
a al algo algun alguna algunas alguno algunos ante antes aqui asi aun aunque bien bueno cada casi como con contra cual
cuales cuando de del desde donde dos el ella ellas ello ellos en entonces entre era eran eres es esa esas ese eso esos
esta estaba estan estar estas este esto estos estoy fue fueron ha habia hace hacen hacer hacia han has hasta hay haz
hazlo hazme he hola igual la las le les lo los luego mas me mejor mi mia mio mis mucho muy nada ni no nos nosotros o
ok okay os otra otras otro otros para pero poco por porfa porque pues que quien se sea ser si sido sin sobre solo son
soy su sus tal tambien tan tanto te tengo tiene tienen toda todas todo todos tu tus un una unas uno unos usted va vale
vamos van voy ya yo
quiero quieres quisiera necesito necesitas puedes puedo podrias podria favor gracias oye mira dame dime ponme ayuda
ayudame ahora ahorita rato cosa cosas tipo parte vez veces manera forma tema ejemplo
usa usar usala usalo usando uso
revisa revisar revisalo arregla arreglar arreglalo crea crear agrega agregar pon poner cambia cambiar quita quitar
muestra mostrar checa checar explica explicame sabes falta nuevo nueva quede queda menos
`;

const STOP_EN = `
a an and any are as at be been but by can could did do does for from had has have how i if in into is it its just
me my no not of on or our out please so some than that the their them then there these they this to too up use used
using was we were what when where which who why will with would you your
`;

export const STOPWORDS = new Set((STOP_ES + ' ' + STOP_EN).split(/\s+/).filter(Boolean));

// Sufijos que se quitan, del más largo al más corto. La raíz que queda debe tener al menos 3 letras.
const SUFIJOS = [
  'amientos', 'imientos', 'amiento', 'imiento', 'aciones', 'adores', 'adoras', 'idades', 'mente', 'acion', 'adora',
  'ables', 'ibles', 'istas', 'ments', 'ador', 'idad', 'able', 'ible', 'ista', 'ando', 'endo', 'aron', 'eron', 'aban',
  'arse', 'erse', 'irse', 'adas', 'ados', 'idas', 'idos', 'itud', 'ment', 'ada', 'ado', 'ida', 'ido', 'ing', 'ar',
  'er', 'ir', 'ed', 'ly', 'a', 'o', 'e',
];

const cacheRaices = new Map();

/** Raíz ligera compartida para español e inglés (no es lingüística fina: solo junta variantes). */
export function raiz(token) {
  const previa = cacheRaices.get(token);
  if (previa !== undefined) return previa;
  let t = token;
  if (t.length > 3 && !/\d/.test(t)) {
    // 1) plural
    if (t.length >= 6 && /[^aeiou]es$/.test(t)) t = t.slice(0, -2);
    else if (t.length === 5 && /[dlnrz]es$/.test(t)) t = t.slice(0, -2);
    else if (t.length >= 4 && t.endsWith('s') && !/(ss|us|is)$/.test(t)) t = t.slice(0, -1);
    // 2) un sufijo (una sola vocal final solo se quita si quedan 4 letras o más: "pago" no es "pages")
    for (const s of SUFIJOS) {
      const minimo = s.length === 1 ? 4 : 3;
      if (t.length - s.length >= minimo && t.endsWith(s)) {
        t = t.slice(0, -s.length);
        break;
      }
    }
    // 3) consonante doble al final ("debugg" -> "debug") y terminación -i de verbos ("copi" se queda)
    if (t.length > 3 && /([b-df-hj-np-tv-z])\1$/.test(t)) t = t.slice(0, -1);
  }
  cacheRaices.set(token, t);
  return t;
}

/** Parte un texto en palabras normalizadas (sin filtrar). */
export function tokenizar(texto) {
  return normalizar(texto).split(/[^a-z0-9]+/).filter(Boolean);
}

/** Palabras útiles de un texto, ya en raíz: sin stopwords, sin números sueltos, sin letras sueltas. */
// "copia/copias" como sustantivo (copias de documentación, copia de seguridad, copias locales) no es
// "copiar" operaciones: se reescribe a respaldo/espejo antes de sacar raíces, para que no jale copy trading.
const COPIA_SUSTANTIVO = /\bcopias?\s+(locales?|de\s+(seguridad|respaldo|documentacion|docs|archivos?|datos|la|las|los|mis?|tus?|sus?|el))\b/g;

export function terminos(texto) {
  texto = normalizar(texto).replace(COPIA_SUSTANTIVO, 'respaldo espejo $1');
  const salida = [];
  for (const t of tokenizar(texto)) {
    if (t.length < 2 || STOPWORDS.has(t) || /^\d+$/.test(t)) continue;
    salida.push(raiz(t));
  }
  return salida;
}

// Grupos de palabras que este usuario usa como equivalentes. Una palabra de un grupo
// también busca (con menos peso) las demás del mismo grupo.
const GRUPOS = [
  'lento lenta lentitud tarda tardar tardando demora demorar retraso lag latencia rendimiento performance optimizar rapido rapida velocidad slow fast speed tiempo',
  'swap swaps intercambio intercambiar comprar compra compras vender venta buy sell trade tradear quote cotizacion',
  'deploy desplegar despliegue publicar subir sube subelo subo produccion lanzar release',
  'copiar copia copias copy copytrading trader seguir tracker detectar deteccion',
  'roblox luau studio rojo',
  'landing pagina sitio website page web',
  'token tokens contexto context compactar compact',
  'test tests prueba pruebas probar testing vitest pytest',
  'error errores bug bugs falla fallo fallando crash truena trono rompe roto debug debugging depurar',
  'database db bd sql sqlite postgres datos data',
  'billetera billeteras wallet wallets cartera phantom',
  'memecoin memecoins shitcoin pump rug',
  'pago pagos cobro cobros cobrar suscripcion suscripciones stripe mercadopago payment checkout',
  'miniatura miniaturas thumbnail thumbnails portada capsula icono banner',
  'logo logos marca branding favicon',
  'imagen imagenes foto fotos image png webp',
  'video videos clip clips ffmpeg',
  'juego juegos game games jugar gameplay',
  'servidor servidores server vps',
  'minecraft bedrock',
  'wifi router red internet network lan',
  'respaldo respaldos respaldar backup backups restaurar',
  'contrasena contrasenas password passwords 2fa hackearon hackeo',
  'secreto secretos secret secrets apikey llave llaves credencial credenciales env',
  'git commit commits rama branch revert github',
  'cv curriculum empleo vacante entrevista trabajo',
  'sat rfc impuestos factura cfdi tramite tramites',
  'estudiar examen tarea escuela aprender clase',
  'dinero presupuesto gastos ahorro finanzas',
  'app apps aplicacion movil celular iphone android expo',
  'escritorio desktop tauri electron exe',
  'extension extensiones chrome navegador browser',
  'whatsapp telegram chatbot chatbots mensajes',
  'ia ai llm llms inteligencia',
  'scraping scraper scrapear crawl crawler',
  'docker contenedor contenedores container compose',
  'python pip venv uv',
  'typescript ts node nodejs javascript js',
  'react next nextjs frontend componente componentes',
  'api apis endpoint endpoints rest',
  'webhook webhooks',
  'seo google buscadores posicionamiento',
  'diseno design ui ux interfaz pantalla pantallas dashboard',
  'contenido tiktok reels shorts post posts redes',
  'idea ideas validar negocio producto',
  'hyprland monitor monitores fish pacman arch cachyos linux',
  'systemd servicio servicios daemon demonio',
  'dominio tunnel tunel cloudflared dns ssl https',
  'cloudflare workers worker pages wrangler',
  'solana sol lamports spl',
  'evm ethereum eth',
  'contrato contratos solidity',
  'senal senales backtest backtesting estrategia',
  'entrenar entrenamiento dataset lightgbm xgboost',
  'obsidian notas boveda',
  'plan planear planea planeacion planning brainstorm brainstorming',
  'refactor refactorizar limpiar reescribir legacy heredado',
  'seguridad security vulnerabilidad vulnerabilidades exploit trampas cheat',
  'steam wishlist wishlists',
  'godot gdscript',
  'blender lowpoly 3d mesh',
  'excel xlsx spreadsheet hoja',
  'word docx',
  'powerpoint pptx presentacion diapositivas slides',
  'pdf pdfs',
  'review revision pr pullrequest',
  'transaccion transacciones transaction transactions tx txs',
];

// Alias de una sola dirección: lo que este usuario casi siempre necesita cuando menciona la palabra de la izquierda.
const ALIAS = {
  'copiar copia copias copy copytrading': 'helius envio enviar',
  'prenda prender arranque arrancar reinicie reiniciar': 'systemd servicio',
  'cae caiga caido tumba': 'reconexion error',
};

let mapaSinonimos = null;

/** Mapa raíz -> conjunto de raíces equivalentes (sin incluirse a sí misma). */
export function sinonimos() {
  if (mapaSinonimos) return mapaSinonimos;
  mapaSinonimos = new Map();
  for (const linea of GRUPOS) {
    const raices = [...new Set(linea.split(/\s+/).filter(Boolean).map((p) => raiz(normalizar(p))))];
    for (const r of raices) {
      let conjunto = mapaSinonimos.get(r);
      if (!conjunto) mapaSinonimos.set(r, (conjunto = new Set()));
      for (const otra of raices) if (otra !== r) conjunto.add(otra);
    }
  }
  return mapaSinonimos;
}

let mapaAlias = null;

/** Mapa raíz -> raíces que casi siempre acompañan a esa palabra para este usuario (una sola dirección). */
export function alias() {
  if (mapaAlias) return mapaAlias;
  mapaAlias = new Map();
  for (const [origenes, destinos] of Object.entries(ALIAS)) {
    const extra = destinos.split(/\s+/).map((p) => raiz(normalizar(p)));
    for (const o of origenes.split(/\s+/)) {
      const r = raiz(normalizar(o));
      let conjunto = mapaAlias.get(r);
      if (!conjunto) mapaAlias.set(r, (conjunto = new Set()));
      for (const e of extra) if (e !== r) conjunto.add(e);
    }
  }
  return mapaAlias;
}

/** Recorta un texto a `max` caracteres con puntos suspensivos; colapsa espacios. */
export function recortar(texto, max) {
  const t = String(texto ?? '').replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : t.slice(0, Math.max(0, max - 1)).trimEnd() + '…';
}

/** Primera idea de una descripción (antes de " - ", ":" largo o el primer punto), recortada. */
export function descCorta(desc, max = 90) {
  let t = String(desc ?? '').replace(/\s+/g, ' ').trim();
  const cortes = [t.indexOf(' - '), t.indexOf(' — '), t.search(/\. [A-ZÁÉÍÓÚÑ]/)].filter((i) => i >= 12);
  if (cortes.length) t = t.slice(0, Math.min(...cortes));
  return recortar(t.replace(/[.;,:]$/, ''), max);
}
