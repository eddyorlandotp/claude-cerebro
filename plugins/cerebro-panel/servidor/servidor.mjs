#!/usr/bin/env node
// Servidor local de Telaraña (cerebro-panel): HTTP + SSE + archivos estáticos.
// Solo escucha en 127.0.0.1, no llama a internet ni a ningún modelo, y solo LEE los transcripts.
//
//   node servidor/servidor.mjs [--puerto 4317] [--demo] [--velocidad 1] [--config-dir <ruta>]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Estado } from './lib/estado.mjs';
import { Interprete } from './lib/transcript.mjs';
import { Vigia, Seguidor } from './lib/vigia.mjs';
import { dirConfig, dirDatos, rutas, leerJSON, asegurarDir } from '../arana/lib/rutas.mjs';
import { obtenerIndice, aBiblioteca, buscarSkill } from '../arana/lib/indice.mjs';
import { recomendar } from '../arana/lib/recomendar.mjs';
import { leerModo } from '../arana/lib/modo.mjs';
import { Hilo } from '../arana/lib/hilo.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = leerJSON(path.join(RAIZ, '.claude-plugin', 'plugin.json'), {})?.version ?? '0.0.0';

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json',
};

export function leerArgumentos(argv) {
  const o = { puerto: 4317, demo: false, velocidad: 1, configDir: null, ayuda: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--demo') o.demo = true;
    else if (a === '--ayuda' || a === '--help' || a === '-h') o.ayuda = true;
    else if (a === '--puerto' || a === '--port') o.puerto = Number(argv[++i]);
    else if (a === '--velocidad') o.velocidad = Number(argv[++i]);
    else if (a === '--config-dir') o.configDir = argv[++i];
  }
  if (!Number.isInteger(o.puerto) || o.puerto < 0 || o.puerto > 65535) o.puerto = 4317;
  if (!Number.isFinite(o.velocidad) || o.velocidad <= 0) o.velocidad = 1;
  return o;
}

/**
 * Crea el servidor (sin escuchar todavía). Devuelve { servidor, estado, difundir, escuchar, cerrar }.
 * Se exporta para poder probarlo en un puerto libre.
 */
export function crearServidor({ puerto = 4317, demo = false, velocidad = 1, configDir = null, pausaDemo = 4000, intervaloLatido = 15000 } = {}) {
  const estado = new Estado({ version: VERSION });
  const clientes = new Set();
  const relojes = new Set();
  let cerrado = false;

  const enviar = (res, evento) => {
    try {
      res.write(`data: ${JSON.stringify(evento)}\n\n`);
    } catch {
      clientes.delete(res);
    }
  };

  /** Aplica un evento al estado y lo manda a todos los clientes conectados. */
  const difundir = (evento, { callado = false } = {}) => {
    estado.aplicar(evento);
    if (!callado) for (const c of clientes) enviar(c, evento);
    return evento;
  };

  // ------------------------------------------------------------ HTTP

  const responder = (res, codigo, cuerpo, tipo = 'text/plain; charset=utf-8') => {
    res.writeHead(codigo, { 'Content-Type': tipo, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(cuerpo);
  };

  const servirArchivo = (res, base, relativa, soloCabecera) => {
    let rel;
    try {
      rel = decodeURIComponent(relativa);
    } catch {
      return responder(res, 400, 'Ruta inválida\n');
    }
    if (rel.includes('\0')) return responder(res, 400, 'Ruta inválida\n');
    const destino = path.resolve(base, '.' + path.posix.normalize('/' + rel));
    if (destino !== base && !destino.startsWith(base + path.sep)) return responder(res, 403, 'Prohibido\n');
    fs.stat(destino, (err, st) => {
      if (err || !st.isFile()) return responder(res, 404, 'No encontrado\n');
      res.writeHead(200, {
        'Content-Type': TIPOS[path.extname(destino).toLowerCase()] ?? 'application/octet-stream',
        'Content-Length': st.size,
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      });
      if (soloCabecera) return res.end();
      fs.createReadStream(destino).on('error', () => res.destroy()).pipe(res);
    });
  };

  const servidor = http.createServer((req, res) => {
    // Solo peticiones hechas a 127.0.0.1/localhost: así una página web ajena no puede leer el panel
    // apuntando un dominio suyo a esta máquina (DNS rebinding). Tampoco se mandan cabeceras CORS.
    const anfitrion = String(req.headers.host ?? '').replace(/:\d+$/, '').toLowerCase();
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(anfitrion)) return responder(res, 403, 'Solo local\n');
    if (req.method !== 'GET' && req.method !== 'HEAD') return responder(res, 405, 'Solo GET\n');
    let ruta;
    try {
      ruta = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
    } catch {
      return responder(res, 400, 'Ruta inválida\n');
    }
    if (ruta === '/salud') {
      return responder(res, 200, JSON.stringify({ ok: true, version: VERSION, sesion: estado.sesionId, demo, pid: process.pid }), TIPOS['.json']);
    }
    if (ruta === '/estado') return responder(res, 200, JSON.stringify(estado.instantanea()), TIPOS['.json']);
    if (ruta === '/eventos') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write('retry: 2000\n\n');
      for (const e of estado.iniciales()) enviar(res, e);
      clientes.add(res);
      req.on('close', () => clientes.delete(res));
      return;
    }
    if (ruta === '/demo' || ruta.startsWith('/demo/')) {
      return servirArchivo(res, path.join(RAIZ, 'demo'), ruta.slice(5) || '/', req.method === 'HEAD');
    }
    if (ruta === '/' || ruta === '/index.html') {
      const indice = path.join(RAIZ, 'ui', 'index.html');
      if (!fs.existsSync(indice)) return responder(res, 404, 'La interfaz todavía no está instalada (falta ui/index.html).\n');
      return servirArchivo(res, path.join(RAIZ, 'ui'), '/index.html', req.method === 'HEAD');
    }
    return servirArchivo(res, path.join(RAIZ, 'ui'), ruta, req.method === 'HEAD');
  });
  servidor.on('clientError', (_e, socket) => socket.destroy());

  const latido = setInterval(() => {
    const e = { tipo: 'latido', ts: Date.now(), sesion: estado.sesionId };
    for (const c of clientes) enviar(c, e);
  }, intervaloLatido);
  relojes.add(latido);

  // ------------------------------------------------------------ modo demo

  const iniciarDemo = () => {
    const guion = leerJSON(path.join(RAIZ, 'demo', 'sesion-demo.json'), null);
    if (!guion || !Array.isArray(guion.eventos)) throw new Error('No pude leer demo/sesion-demo.json');
    const eventos = guion.eventos.filter((e) => e && typeof e === 'object').sort((a, b) => (a.t ?? 0) - (b.t ?? 0));
    const vuelta = () => {
      if (cerrado) return;
      estado.reiniciar('demo');
      if (guion.biblioteca) difundir({ ...guion.biblioteca, tipo: 'biblioteca', modo: guion.biblioteca.modo ?? 'completo', ts: Date.now(), sesion: 'demo' });
      let i = 0;
      const inicio = Date.now();
      const siguiente = () => {
        if (cerrado) return;
        if (i >= eventos.length) {
          const r = setTimeout(() => {
            relojes.delete(r);
            vuelta();
          }, pausaDemo);
          relojes.add(r);
          return;
        }
        const { t, ...resto } = eventos[i++];
        const falta = Math.max(0, (t ?? 0) / velocidad - (Date.now() - inicio));
        const r = setTimeout(() => {
          relojes.delete(r);
          difundir({ ...resto, ts: Date.now(), sesion: 'demo' });
          siguiente();
        }, falta);
        relojes.add(r);
      };
      siguiente();
    };
    vuelta();
  };

  // ------------------------------------------------------------ modo real

  let vigia = null;
  const iniciarReal = () => {
    const dir = dirConfig(configDir);
    // Ventana de contexto vista por modelo (el transcript no la trae): se recuerda entre sesiones.
    const rutaVentanas = path.join(dirDatos(), 'ventanas.json');
    const ventanas = leerJSON(rutaVentanas, {}) ?? {};
    let firmaVentanas = JSON.stringify(ventanas);
    const guardarVentanas = () => {
      const firma = JSON.stringify(ventanas);
      if (firma === firmaVentanas) return;
      firmaVentanas = firma;
      try {
        asegurarDir(dirDatos());
        fs.writeFileSync(rutaVentanas, firma);
      } catch {
        // sin guardar: se vuelve a descubrir en la próxima sesión larga
      }
    };
    let interprete = new Interprete({ ventanas });
    let hilo = new Hilo();
    let indice = null;
    let modo = 'completo';
    let firmaBiblioteca = '';
    let alDia = false;
    let compactando = 0;

    const refrescarBiblioteca = () => {
      try {
        modo = leerModo();
        indice = obtenerIndice({ configDir: dir, cwd: interprete.info.cwd });
        const b = aBiblioteca(indice, { modo });
        const firma = JSON.stringify(b);
        if (firma === firmaBiblioteca) return;
        firmaBiblioteca = firma;
        difundir({ ...b, ts: Date.now(), sesion: estado.sesionId });
      } catch {
        // sin índice el panel sigue: solo no hay biblioteca ni sugerencias
      }
    };

    const emitirHilo = (ts, callado) => difundir({ tipo: 'hilo', ts, sesion: estado.sesionId, ...hilo.resumen() }, { callado });

    const procesar = (e, callado) => {
      if (e.tipo === 'skill_usada' && indice) {
        // Se completa el id (p. ej. "pdf" -> "document-skills:pdf") para que la interfaz ubique el punto.
        const { skill } = e.ruta
          ? { skill: indice.plugins.flatMap((p) => p.skills).find((s) => s.ruta === e.ruta) ?? buscarSkill(indice, e.id).skill }
          : buscarSkill(indice, e.id);
        e = { tipo: e.tipo, ts: e.ts, sesion: e.sesion, id: skill ? skill.id : e.id };
      }
      if (e.tipo === 'compactacion') {
        if (Date.now() - compactando < 5 * 60 * 1000) {
          compactando = 0;
          return; // ya la anunció el hook PreCompact
        }
      }
      difundir(e, { callado });
      hilo.ingerir(e);
      if (e.tipo === 'sesion' && e.cwd && (!indice || indice.cwd !== path.resolve(e.cwd))) refrescarBiblioteca();
      if (e.tipo === 'prompt') {
        let skills = [];
        try {
          if (indice) skills = recomendar(indice, e.texto, { k: 4, modo });
        } catch {
          skills = [];
        }
        difundir({
          tipo: 'sugeridas', ts: e.ts, sesion: e.sesion,
          skills: skills.map((s) => ({ id: s.id, puntaje: s.puntaje })),
          apagadas: modo === 'ligero' ? [] : skills.filter((s) => !s.activo).map((s) => s.id),
        }, { callado });
      }
      if (e.tipo === 'fin_turno') emitirHilo(e.ts, callado);
    };

    vigia = new Vigia({ configDir: dir });
    vigia.on('sesion', ({ id }) => {
      interprete = new Interprete({ sesion: id, ventanas });
      hilo = new Hilo();
      alDia = false;
      estado.reiniciar(id);
    });
    vigia.on('linea', ({ texto, agente, meta, historico }) => {
      for (const e of interprete.linea(texto, { agente, meta })) procesar(e, historico || !alDia);
    });
    vigia.on('agente-fin', ({ agente, historico }) => {
      for (const e of interprete.cerrarSubagente(agente, historico ? interprete.ultimoTs || Date.now() : Date.now())) procesar(e, historico || !alDia);
    });
    vigia.on('al-dia', () => {
      alDia = true;
      guardarVentanas();
      // Lo que ya existía se leyó en silencio; ahora los clientes reciben la foto completa.
      emitirHilo(Date.now(), true);
      for (const c of clientes) for (const e of estado.iniciales()) enviar(c, e);
    });
    refrescarBiblioteca();
    vigia.iniciar();
    const relojBiblioteca = setInterval(refrescarBiblioteca, 30000);
    relojes.add(relojBiblioteca);

    // Eventos de los hooks (lo que el transcript no da a tiempo). Solo lo nuevo desde que arrancó el servidor.
    asegurarDir(dirDatos());
    const ganchos = new Seguidor(rutas.eventos(), { desdeElFinal: true });
    const MOTIVOS = { permission_prompt: 'permiso', idle_prompt: 'respuesta', elicitation_dialog: 'respuesta', agent_needs_input: 'respuesta' };
    const relojGanchos = setInterval(() => {
      for (const l of ganchos.leer().lineas) {
        let g;
        try {
          g = JSON.parse(l);
        } catch {
          continue;
        }
        if (!g || typeof g !== 'object') continue;
        if (g.sesion && estado.sesionId && g.sesion !== estado.sesionId) continue;
        const ts = typeof g.ts === 'number' ? g.ts : Date.now();
        if (g.evento === 'Notification' && MOTIVOS[g.clase]) {
          difundir({ tipo: 'espera', ts, sesion: estado.sesionId, motivo: MOTIVOS[g.clase] });
        } else if (g.evento === 'PreCompact') {
          compactando = Date.now();
          difundir({ tipo: 'compactacion', ts, sesion: estado.sesionId });
        } else if (g.evento === 'Stop') {
          for (const e of interprete.cerrarTurno(ts)) procesar(e, false);
        }
      }
    }, 300);
    relojes.add(relojGanchos);

    // Si el turno ya terminó y pasan 2 minutos sin nada, se avisa una vez que está inactivo.
    let avisoInactivo = 0;
    const relojInactivo = setInterval(() => {
      guardarVentanas();
      if (alDia) for (const e of interprete.caducarSubagentes(Date.now())) procesar(e, false);
      const ultimo = estado.ultimoEvento;
      if (!alDia || !ultimo || estado.turno.abierto || estado.espera) return;
      if (Date.now() - ultimo > 120000 && avisoInactivo !== ultimo) {
        avisoInactivo = ultimo;
        const e = { tipo: 'espera', ts: Date.now(), sesion: estado.sesionId, motivo: 'inactivo' };
        estado.espera = e;
        for (const c of clientes) enviar(c, e);
      }
    }, 5000);
    relojes.add(relojInactivo);
  };

  const escuchar = () =>
    new Promise((resolver, rechazar) => {
      servidor.once('error', rechazar);
      servidor.listen(puerto, '127.0.0.1', () => {
        servidor.off('error', rechazar);
        try {
          if (demo) iniciarDemo();
          else iniciarReal();
        } catch (e) {
          return rechazar(e);
        }
        resolver(servidor.address().port);
      });
    });

  const cerrar = () =>
    new Promise((resolver) => {
      cerrado = true;
      for (const r of relojes) {
        clearTimeout(r);
        clearInterval(r);
      }
      relojes.clear();
      vigia?.detener();
      for (const c of clientes) c.end();
      clientes.clear();
      servidor.close(() => resolver());
      servidor.closeAllConnections?.();
    });

  return { servidor, estado, difundir, escuchar, cerrar };
}

// ---------------------------------------------------------------- arranque desde la terminal

const esPrincipal = process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href;
if (esPrincipal) {
  const opciones = leerArgumentos(process.argv.slice(2));
  if (opciones.ayuda) {
    process.stdout.write('Uso: node servidor/servidor.mjs [--puerto 4317] [--demo] [--velocidad 1] [--config-dir <ruta>]\n');
    process.exit(0);
  }
  const panel = crearServidor(opciones);
  const archivoPid = rutas.pid();
  const limpiarPid = () => {
    try {
      const actual = fs.readFileSync(archivoPid, 'utf8').split('\n')[0].trim();
      if (actual === String(process.pid)) fs.rmSync(archivoPid, { force: true });
    } catch {
      // ya no estaba
    }
  };
  const salir = (codigo) => {
    limpiarPid();
    panel.cerrar().finally(() => process.exit(codigo));
    setTimeout(() => process.exit(codigo), 1500).unref();
  };
  process.on('SIGINT', () => salir(0));
  process.on('SIGTERM', () => salir(0));
  try {
    const puerto = await panel.escuchar();
    try {
      asegurarDir(dirDatos());
      fs.writeFileSync(archivoPid, `${process.pid}\n${puerto}\n`);
    } catch {
      // sin archivo de pid el panel funciona igual
    }
    process.stdout.write(`Telaraña ${VERSION} en http://127.0.0.1:${puerto}${opciones.demo ? ' (demo)' : ''}\n`);
  } catch (e) {
    if (e && e.code === 'EADDRINUSE') {
      process.stderr.write(`El puerto ${opciones.puerto} ya está ocupado. ¿El panel ya está corriendo? Prueba otro con --puerto.\n`);
    } else {
      process.stderr.write(`No pude arrancar el panel: ${e?.message ?? e}\n`);
    }
    process.exit(1);
  }
}
