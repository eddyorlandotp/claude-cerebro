// Transcript de Claude Code (JSONL) -> eventos normalizados del contrato.
// Regla de oro: tolerar todo. Una línea rota, un tipo nuevo o un campo que falta
// nunca tiran el parser; simplemente no producen eventos.
import path from 'node:path';

export function recortar(texto, max) {
  const t = String(texto ?? '').replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : t.slice(0, Math.max(0, max - 1)).trimEnd() + '…';
}

/** Recorta por en medio (para comandos y consultas largas). */
function recortarMedio(texto, max) {
  const t = String(texto ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cabeza = Math.ceil((max - 1) * 0.6);
  return t.slice(0, cabeza) + '…' + t.slice(t.length - (max - 1 - cabeza));
}

/** Recorta una ruta conservando el final, que es lo que la identifica. */
function recortarRuta(ruta, max) {
  const t = String(ruta ?? '');
  if (t.length <= max) return t;
  const cola = t.slice(t.length - (max - 1));
  const corte = cola.indexOf('/');
  return '…' + (corte >= 0 && corte < 20 ? cola.slice(corte) : cola);
}

const CLASES = {
  Read: 'leer', NotebookRead: 'leer',
  Grep: 'buscar', Glob: 'buscar', ToolSearch: 'buscar', LS: 'buscar',
  Bash: 'comando', BashOutput: 'comando', KillShell: 'comando', Monitor: 'comando', TaskStop: 'comando', TaskOutput: 'comando',
  Edit: 'editar', Write: 'editar', MultiEdit: 'editar', NotebookEdit: 'editar',
  WebFetch: 'web', WebSearch: 'web',
  Task: 'agente', Agent: 'agente',
  Skill: 'skill',
  TodoWrite: 'tarea', TaskCreate: 'tarea', TaskUpdate: 'tarea',
  AskUserQuestion: 'pregunta',
};

/** Clase de una herramienta según el contrato. */
export function clasificar(nombre) {
  const n = String(nombre ?? '');
  if (n.startsWith('mcp__')) return 'mcp';
  return CLASES[n] ?? 'otro';
}

function rutaRelativa(ruta, cwd) {
  const r = String(ruta ?? '');
  if (cwd && r.startsWith(cwd + '/')) return r.slice(cwd.length + 1);
  return r;
}

const texto = (v) => (typeof v === 'string' ? v : '');

/** Resumen de ≤ 80 caracteres de lo que hace una herramienta: ruta, comando o consulta. */
export function resumir(nombre, input, cwd) {
  const i = input && typeof input === 'object' ? input : {};
  const clase = clasificar(nombre);
  let r = '';
  if (clase === 'leer' || clase === 'editar') {
    r = recortarRuta(rutaRelativa(i.file_path ?? i.notebook_path ?? i.path ?? '', cwd), 80);
  } else if (nombre === 'Bash') {
    r = recortarMedio(texto(i.command), 80);
  } else if (nombre === 'BashOutput' || nombre === 'KillShell' || nombre === 'TaskStop' || nombre === 'TaskOutput') {
    r = recortar(texto(i.bash_id ?? i.shell_id ?? i.task_id), 80);
  } else if (nombre === 'Monitor') {
    r = recortarMedio(texto(i.description) || texto(i.command), 80);
  } else if (nombre === 'SendMessage') {
    // Mensaje a un subagente que ya existe (lo reanuda): se muestra el resumen, no el id del destinatario.
    r = recortar(texto(i.summary) || texto(i.message) || texto(i.content), 80);
  } else if (nombre === 'Grep') {
    r = recortarMedio(texto(i.pattern) + (i.path ? ' en ' + rutaRelativa(i.path, cwd) : i.glob ? ' en ' + i.glob : ''), 80);
  } else if (nombre === 'Glob') {
    r = recortarMedio(texto(i.pattern), 80);
  } else if (nombre === 'LS') {
    r = recortarRuta(rutaRelativa(i.path ?? '', cwd), 80);
  } else if (nombre === 'ToolSearch') {
    r = recortar(texto(i.query), 80);
  } else if (nombre === 'WebFetch') {
    r = recortarMedio(texto(i.url).replace(/^https?:\/\/(www\.)?/, ''), 80);
  } else if (nombre === 'WebSearch') {
    r = recortar(texto(i.query), 80);
  } else if (clase === 'agente') {
    r = recortar(texto(i.description) || texto(i.prompt), 80);
  } else if (clase === 'skill') {
    r = recortar(texto(i.skill ?? i.command ?? i.name).replace(/^\//, ''), 80);
  } else if (nombre === 'TodoWrite') {
    const todos = Array.isArray(i.todos) ? i.todos : [];
    const hechos = todos.filter((t) => t && t.status === 'completed').length;
    r = `${todos.length} tareas, ${hechos} hechas`;
  } else if (nombre === 'TaskCreate') {
    r = recortar(texto(i.subject) || texto(i.description), 80);
  } else if (nombre === 'TaskUpdate') {
    r = recortar(`#${i.taskId ?? '?'}${i.status ? ' → ' + i.status : ''}`, 80);
  } else if (clase === 'pregunta') {
    const q = Array.isArray(i.questions) && i.questions[0] ? i.questions[0].question : i.question;
    r = recortar(texto(q), 80);
  } else {
    // mcp y desconocidas: el primer valor de texto que traiga la entrada
    const primero = Object.values(i).find((v) => typeof v === 'string' && v.trim());
    r = recortarMedio(texto(primero), 80);
  }
  return r;
}

const ESTADOS = { completed: 'hecho', in_progress: 'en_curso', pending: 'pendiente', deleted: 'borrada' };

// Comandos de barra que resuelve la propia terminal: no son un pedido a Claude.
const COMANDOS_LOCALES = new Set([
  'clear', 'compact', 'model', 'help', 'config', 'cost', 'status', 'login', 'logout', 'exit', 'quit', 'resume', 'plugin',
  'plugins', 'mcp', 'permissions', 'memory', 'hooks', 'agents', 'context', 'usage', 'doctor', 'fast', 'effort', 'add-dir',
  'reload-plugins', 'rename', 'export', 'vim', 'theme', 'terminal-setup', 'ide', 'bashes', 'tasks', 'statusline', 'rewind',
  'release-notes', 'upgrade', 'privacy-settings', 'output-style', 'skills', 'cd', 'bug', 'feedback', 'stats', 'todos',
]);

const PREFIJOS_MAQUINA = [
  '<local-command-', '<bash-input>', '<bash-stdout>', '<bash-stderr>', '<task-notification>', '<user-memory-input>',
  '<user-prompt-submit-hook>', 'Caveat: The messages below',
];

function textoDeContenido(contenido) {
  if (typeof contenido === 'string') return contenido;
  if (!Array.isArray(contenido)) return '';
  return contenido.map((b) => (b && b.type === 'text' && typeof b.text === 'string' ? b.text : '')).filter(Boolean).join('\n');
}

/** Quita lo que la terminal agrega alrededor de un pedido (avisos del sistema, envoltura de texto pegado). */
function limpiarPedido(t) {
  return String(t ?? '')
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
    .replace(/<\/?pasted_content[^>]*>/g, ' ')
    .trim();
}

const esVerdadero = (v) => v === true || v === 'true';

function tamanoDe(contenido) {
  if (typeof contenido === 'string') return contenido.length;
  if (!Array.isArray(contenido)) return 0;
  let n = 0;
  for (const b of contenido) if (b && typeof b.text === 'string') n += b.text.length;
  return n;
}

/** Skill que se está cargando "a mano": Read de …/skills/<x>/SKILL.md o Bash `arana leer <id>`. */
export function skillPorRuta(nombre, input) {
  const i = input && typeof input === 'object' ? input : {};
  if (nombre === 'Read' && typeof i.file_path === 'string') {
    const m = /\/skills\/(?:[^/]+\/)*?([^/]+)\/SKILL\.md$/.exec(i.file_path);
    if (m) return { ruta: i.file_path, nombre: m[1] };
  }
  if (nombre === 'Bash' && typeof i.command === 'string') {
    const m = /(?:^|[\s;&|(])(?:\S*\/)?arana(?:\.mjs)?\s+leer\s+["']?([A-Za-z0-9_:.@/-]+)["']?/.exec(i.command);
    if (m) return { id: m[1].replace(/^\//, '') };
  }
  return null;
}

/**
 * Intérprete con estado: recibe líneas del transcript y devuelve eventos normalizados.
 * Un intérprete por sesión; las líneas de subagentes se pasan con `{ agente }`.
 */
export class Interprete {
  /**
   * `ventanas`: { modelo: tokens } con la ventana ya vista para cada modelo en otras sesiones
   * (el transcript no dice el tamaño de la ventana; solo se sabe que es de 1M cuando se pasa de 200k).
   */
  constructor({ sesion = null, ventanas = null } = {}) {
    this.sesion = sesion;
    this.ventanas = ventanas && typeof ventanas === 'object' ? ventanas : {};
    this.info = { proyecto: null, cwd: null, modelo: null, version: null, rama: null };
    this.infoEmitida = '';
    this.abiertas = new Map(); // tool_use_id -> { nombre, clase, ts, agente, input }
    this.turno = { abierto: false, inicio: 0, pasos: 0, numero: 0 };
    this.uso = { entrada: 0, cacheLeida: 0, cacheCreada: 0, salida: 0, costoUSD: null, ventana: 200000 };
    this.acumulado = { entrada: 0, salida: 0, cacheLeida: 0, cacheCreada: 0 };
    this.salidaPorMensaje = new Map(); // id de mensaje -> tokens de salida ya contados
    this.usoEmitido = '';
    this.subagentes = new Map(); // id (= tool_use_id del Agent) -> { tipoAgente, descripcion, prompt, agentId, fondo, cerrado, ultimo }
    this.alias = new Map(); // agentId del archivo -> id del subagente
    this.tareasCreadas = 0;
    this.ultimaCompactacion = 0;
    this.ultimoTs = 0;
  }

  #evento(tipo, ts, campos) {
    return { tipo, ts, sesion: this.sesion, ...campos };
  }

  /** Procesa una línea de texto. Devuelve la lista de eventos (puede ir vacía). Nunca lanza. */
  linea(textoLinea, opciones = {}) {
    const t = typeof textoLinea === 'string' ? textoLinea.trim() : '';
    if (!t || t[0] !== '{') return [];
    let registro;
    try {
      registro = JSON.parse(t);
    } catch {
      return [];
    }
    try {
      return this.registro(registro, opciones);
    } catch {
      return [];
    }
  }

  /** Procesa un registro ya parseado. */
  registro(r, { agente = null, meta = null } = {}) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) return [];
    const salida = [];
    const fecha = typeof r.timestamp === 'string' ? Date.parse(r.timestamp) : NaN;
    const ts = Number.isFinite(fecha) ? fecha : this.ultimoTs || Date.now();
    this.ultimoTs = ts;
    if (!this.sesion && typeof r.sessionId === 'string') this.sesion = r.sessionId;

    const lateral = r.isSidechain === true || agente != null;
    const idAgente = lateral ? this.#resolverAgente(agente ?? r.agentId ?? 'lateral', r, ts, salida, meta) : null;
    if (!lateral) this.#datosDeSesion(r, ts, salida);

    switch (r.type) {
      case 'user':
        this.#usuario(r, ts, idAgente, lateral, salida);
        break;
      case 'assistant':
        this.#asistente(r, ts, idAgente, lateral, salida);
        break;
      case 'system':
        this.#sistema(r, ts, lateral, salida);
        break;
      case 'cost-state':
        if (typeof r.totalCostUSD === 'number' && Number.isFinite(r.totalCostUSD)) {
          this.uso.costoUSD = Math.round(r.totalCostUSD * 10000) / 10000;
          this.#emitirUso(ts, salida);
        }
        break;
      case 'attachment':
        if (!lateral) this.#adjunto(r, ts, salida);
        break;
      default:
        break; // summary, queue-operation, last-prompt, api-request* y lo que venga: se ignora
    }
    return salida;
  }

  #datosDeSesion(r, ts, salida) {
    let cambio = false;
    const poner = (clave, valor) => {
      if (typeof valor === 'string' && valor && this.info[clave] !== valor) {
        this.info[clave] = valor;
        cambio = true;
      }
    };
    poner('cwd', r.cwd);
    poner('version', r.version);
    if (r.gitBranch !== 'HEAD') poner('rama', r.gitBranch); // fuera de un repo de git llega 'HEAD': no es una rama
    if (r.type === 'assistant' && r.message && r.message.model !== '<synthetic>') poner('modelo', r.message.model);
    if (this.info.cwd) this.info.proyecto = path.basename(this.info.cwd);
    if (!cambio) return;
    const firma = JSON.stringify(this.info);
    if (firma === this.infoEmitida) return;
    this.infoEmitida = firma;
    if (this.info.modelo && (/\[1m\]|-1m\b/i.test(this.info.modelo) || this.ventanas[this.info.modelo] >= 1000000)) this.uso.ventana = 1000000;
    salida.push(this.#evento('sesion', ts, { ...this.info }));
  }

  /** Traduce el id de un archivo de subagente al id con el que se anunció (el tool_use del Agent). */
  #resolverAgente(agentId, r, ts, salida, meta = null) {
    const clave = String(agentId);
    const conocido = this.alias.get(clave);
    if (conocido) {
      const s = this.subagentes.get(conocido);
      if (s) {
        s.ultimo = ts;
        // Llegan líneas de un subagente que ya se había dado por terminado (lo reanudaron con
        // SendMessage, o siguió en segundo plano): vuelve a salir.
        if (s.cerrado) this.#reabrir(conocido, s, ts, salida);
      }
      return conocido;
    }
    // Lo seguro: el archivo agent-<id>.meta.json dice qué tool_use lo lanzó.
    const lanzador = meta && typeof meta.toolUseId === 'string' ? meta.toolUseId : null;
    if (lanzador) {
      let s = this.subagentes.get(lanzador);
      if (!s) {
        // Su tool_use todavía no pasó por aquí (p. ej. lo lanzó otro subagente): se anuncia con lo que dice el meta.
        s = { tipoAgente: String(meta.tipoAgente || 'agente'), descripcion: recortar(meta.descripcion ?? '', 80), prompt: '', agentId: clave, fondo: true, cerrado: false, ultimo: ts };
        this.subagentes.set(lanzador, s);
        salida.push(this.#evento('subagente', ts, { id: lanzador, fase: 'inicio', tipoAgente: s.tipoAgente, descripcion: s.descripcion }));
      } else if (s.cerrado) {
        this.#reabrir(lanzador, s, ts, salida);
      }
      s.agentId = clave;
      s.ultimo = ts;
      this.alias.set(clave, lanzador);
      return lanzador;
    }
    // Primero por el texto del encargo; si no, el subagente abierto más viejo que aún no tenga archivo.
    const encargo = r.type === 'user' && r.message ? textoDeContenido(r.message.content).trim() : '';
    let elegido = null;
    for (const [id, s] of this.subagentes) {
      if (s.agentId || s.cerrado) continue;
      if (encargo && s.prompt && s.prompt.trim() === encargo) {
        elegido = id;
        break;
      }
      if (!elegido) elegido = id;
    }
    if (elegido) {
      this.subagentes.get(elegido).agentId = clave;
      this.subagentes.get(elegido).ultimo = ts;
      this.alias.set(clave, elegido);
      return elegido;
    }
    // Nadie lo anunció (formato viejo o se perdió la línea): se anuncia aquí para que la interfaz tenga su inicio.
    this.subagentes.set(clave, { tipoAgente: 'agente', descripcion: '', prompt: '', agentId: clave, fondo: true, cerrado: false, ultimo: ts });
    this.alias.set(clave, clave);
    salida.push(this.#evento('subagente', ts, { id: clave, fase: 'inicio', tipoAgente: 'agente', descripcion: recortar(encargo, 80) }));
    return clave;
  }

  #reabrir(id, s, ts, salida) {
    s.cerrado = false;
    s.fondo = true;
    s.ultimo = ts;
    salida.push(this.#evento('subagente', ts, { id, fase: 'inicio', tipoAgente: s.tipoAgente, descripcion: s.descripcion }));
  }

  /**
   * Da por terminado un subagente (por el id de su archivo o por el de su tool_use). Lo llama el
   * servidor cuando su meta.json marca `finished`. Devuelve los eventos.
   */
  cerrarSubagente(agentId, ts = Date.now()) {
    const id = this.alias.get(String(agentId)) ?? String(agentId);
    const s = this.subagentes.get(id);
    if (!s || s.cerrado) return [];
    s.cerrado = true;
    return [this.#evento('subagente', ts, { id, fase: 'fin', tipoAgente: s.tipoAgente, descripcion: s.descripcion })];
  }

  /** Red de seguridad: cierra los subagentes que llevan más de `ms` sin dar señales. */
  caducarSubagentes(ts = Date.now(), ms = 15 * 60 * 1000) {
    const salida = [];
    for (const [id, s] of this.subagentes) if (!s.cerrado && ts - (s.ultimo ?? 0) > ms) salida.push(...this.cerrarSubagente(id, ts));
    return salida;
  }

  #abrirTurno(ts) {
    this.turno = { abierto: true, inicio: ts, pasos: 0, numero: this.turno.numero + 1 };
  }

  /** Cierra el turno en curso (si lo hay) y devuelve los eventos. También lo usa el servidor con el hook Stop. */
  cerrarTurno(ts = Date.now(), ms = null) {
    const salida = [];
    if (!this.turno.abierto) return salida;
    this.turno.abierto = false;
    const duracion = ms != null && Number.isFinite(ms) ? ms : Math.max(0, ts - this.turno.inicio);
    salida.push(this.#evento('fin_turno', ts, { ms: Math.round(duracion), pasos: this.turno.pasos }));
    // Subagentes en segundo plano que llevan más de un minuto callados se dan por terminados.
    for (const [id, s] of this.subagentes) {
      if (!s.cerrado && s.fondo && ts - (s.ultimo ?? 0) > 60000) {
        s.cerrado = true;
        salida.push(this.#evento('subagente', ts, { id, fase: 'fin', tipoAgente: s.tipoAgente, descripcion: s.descripcion }));
      }
    }
    return salida;
  }

  #usuario(r, ts, idAgente, lateral, salida) {
    const contenido = r.message ? r.message.content : null;
    const bloques = Array.isArray(contenido) ? contenido : [];
    let huboResultado = false;
    for (const b of bloques) {
      if (!b || b.type !== 'tool_result') continue;
      huboResultado = true;
      this.#resultado(b, r, ts, salida);
    }
    if (huboResultado || lateral) return;

    if (r.isCompactSummary === true) {
      this.#compactacion(ts, salida);
      return;
    }
    if (r.isMeta === true) return;
    let t = limpiarPedido(textoDeContenido(contenido));
    if (!t) return;
    if (t.startsWith('[Request interrupted')) {
      salida.push(...this.cerrarTurno(ts));
      return;
    }
    let skillInvocada = null;
    const comando = /<command-name>\s*\/?([^<\s]+)\s*<\/command-name>/.exec(t);
    if (comando) {
      const nombre = comando[1];
      if (COMANDOS_LOCALES.has(nombre)) return;
      const args = /<command-args>([\s\S]*?)<\/command-args>/.exec(t);
      t = `/${nombre}${args && args[1].trim() ? ' ' + args[1].trim() : ''}`;
      skillInvocada = nombre;
    } else if (PREFIJOS_MAQUINA.some((p) => t.startsWith(p)) || /^<command-message>/.test(t)) {
      return;
    }
    salida.push(...this.cerrarTurno(ts));
    this.#abrirTurno(ts);
    salida.push(this.#evento('prompt', ts, { texto: recortar(t, 600) }));
    if (skillInvocada) salida.push(this.#evento('skill_usada', ts, { id: skillInvocada }));
  }

  /**
   * Adjuntos. El único que importa: `queued_command` de origen humano, que es como queda escrito un
   * mensaje que el usuario manda mientras Claude sigue trabajando (no aparece como registro `user`).
   * Es un pedido nuevo dentro del mismo turno: se emite `prompt` con `enCola: true` y el turno no se corta.
   */
  #adjunto(r, ts, salida) {
    const a = r.attachment && typeof r.attachment === 'object' ? r.attachment : null;
    if (!a || a.type !== 'queued_command') return;
    if (!a.origin || a.origin.kind !== 'human' || (a.commandMode && a.commandMode !== 'prompt')) return;
    const t = limpiarPedido(textoDeContenido(a.prompt));
    if (!t) return;
    if (!this.turno.abierto) this.#abrirTurno(ts);
    salida.push(this.#evento('prompt', ts, { texto: recortar(t, 600), enCola: true }));
  }

  #resultado(b, r, ts, salida) {
    const id = typeof b.tool_use_id === 'string' ? b.tool_use_id : null;
    const abierta = id ? this.abiertas.get(id) : null;
    if (!id || !abierta) return; // resultado sin su inicio (p. ej. empezamos a leer a media sesión)
    this.abiertas.delete(id);
    const extra = r.toolUseResult && typeof r.toolUseResult === 'object' ? r.toolUseResult : {};
    const medido = [extra.durationMs, extra.totalDurationMs, extra.duration_ms].find((x) => typeof x === 'number' && Number.isFinite(x));
    const ok = b.is_error !== true;
    const evento = this.#evento('herramienta', ts, {
      id,
      fase: 'fin',
      ok,
      ms: Math.max(0, Math.round(medido ?? ts - abierta.ts)),
      tamano: tamanoDe(b.content),
      agente: abierta.agente,
    });
    if (!ok) {
      const primera = textoDeContenido(b.content).split('\n').map((l) => l.trim()).find(Boolean) ?? '';
      if (primera) evento.detalle = recortar(primera.replace(/<\/?tool_use_error>/g, ''), 120);
    }
    if (abierta.nombre === 'TaskCreate' && ok) {
      const cruda = textoDeContenido(b.content);
      const m = /#(\d+)/.exec(cruda);
      this.tareasCreadas++;
      const idTarea = extra.task?.id ?? extra.taskId ?? (m ? m[1] : String(this.tareasCreadas));
      evento.tareas = { op: 'crear', items: [{ id: String(idTarea), texto: recortar(abierta.input?.subject ?? abierta.input?.description ?? '', 120), estado: 'pendiente' }] };
    }
    salida.push(evento);

    // SendMessage a un subagente lo reanuda: el resultado trae a quién.
    const reanudado = extra.resumedAgentId ?? extra.revivedAgentId;
    if (abierta.nombre === 'SendMessage' && ok && typeof reanudado === 'string') {
      const idSub = this.alias.get(reanudado);
      const sub = idSub ? this.subagentes.get(idSub) : null;
      if (sub && sub.cerrado) this.#reabrir(idSub, sub, ts, salida);
    }

    if (abierta.clase === 'agente') {
      const s = this.subagentes.get(id);
      if (s) {
        if (extra.agentId && !s.agentId) {
          s.agentId = String(extra.agentId);
          this.alias.set(s.agentId, id);
        }
        const sigueEnFondo = s.fondo || extra.status === 'async_launched' || extra.isAsync === true;
        if (sigueEnFondo && ok) {
          s.fondo = true;
          s.ultimo = ts;
        } else {
          s.cerrado = true;
          salida.push(this.#evento('subagente', ts, { id, fase: 'fin', tipoAgente: s.tipoAgente, descripcion: s.descripcion }));
        }
      }
    }
  }

  #asistente(r, ts, idAgente, lateral, salida) {
    const m = r.message && typeof r.message === 'object' ? r.message : null;
    if (!m) return;
    if (!lateral && !this.turno.abierto) this.#abrirTurno(ts); // actividad sin pedido (p. ej. lo despertó una tarea en segundo plano)
    const bloques = Array.isArray(m.content) ? m.content : typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : [];
    for (const b of bloques) {
      if (!b || typeof b !== 'object') continue;
      if (b.type === 'thinking' || b.type === 'redacted_thinking') {
        salida.push(this.#evento('pensamiento', ts, { texto: recortar(b.thinking ?? '', 400), agente: idAgente }));
      } else if (b.type === 'text') {
        const t = recortar(b.text ?? '', 400);
        if (t) salida.push(this.#evento('dicho', ts, { texto: t, agente: idAgente }));
      } else if (b.type === 'tool_use' && typeof b.id === 'string') {
        this.#herramienta(b, ts, idAgente, salida);
      }
    }
    if (m.usage && typeof m.usage === 'object' && m.model !== '<synthetic>') this.#usoDe(m, ts, lateral, salida);
    if (!lateral && m.stop_reason === 'end_turn') salida.push(...this.cerrarTurno(ts));
  }

  #herramienta(b, ts, idAgente, salida) {
    const nombre = String(b.name ?? 'desconocida');
    const clase = clasificar(nombre);
    const input = b.input && typeof b.input === 'object' ? b.input : {};
    if (this.abiertas.has(b.id)) return; // línea repetida
    this.abiertas.set(b.id, { nombre, clase, ts, agente: idAgente, input: clase === 'tarea' ? input : null });
    if (this.abiertas.size > 500) this.abiertas.delete(this.abiertas.keys().next().value);
    this.turno.pasos++;
    const evento = this.#evento('herramienta', ts, {
      id: b.id,
      fase: 'inicio',
      nombre,
      clase,
      resumen: resumir(nombre, input, this.info.cwd),
      agente: idAgente,
    });
    if (nombre === 'TodoWrite' && Array.isArray(input.todos)) {
      evento.tareas = {
        op: 'lista',
        items: input.todos
          .filter((t) => t && (t.content || t.activeForm))
          .map((t) => ({ texto: recortar(t.content ?? t.activeForm, 120), estado: ESTADOS[t.status] ?? 'pendiente' })),
      };
    } else if (nombre === 'TaskUpdate' && input.taskId != null) {
      evento.tareas = {
        op: 'actualizar',
        items: [{ id: String(input.taskId), estado: ESTADOS[input.status] ?? undefined, texto: input.subject ? recortar(input.subject, 120) : undefined }],
      };
    }
    salida.push(evento);

    if (clase === 'skill') {
      const id = String(input.skill ?? input.command ?? input.name ?? '').trim().replace(/^\//, '');
      if (id) salida.push(this.#evento('skill_usada', ts, { id }));
    } else if (clase === 'agente') {
      const s = {
        tipoAgente: String(input.subagent_type ?? input.agent_type ?? 'general'),
        descripcion: recortar(input.description ?? input.prompt ?? '', 80),
        prompt: typeof input.prompt === 'string' ? input.prompt : '',
        agentId: null,
        fondo: esVerdadero(input.run_in_background), // en transcripts reales llega como texto "true"
        cerrado: false,
        ultimo: ts,
      };
      const previo = this.subagentes.get(b.id);
      if (previo) {
        // Ya lo había anunciado su archivo (meta.json): solo se completa lo que faltaba.
        previo.prompt = s.prompt;
        if (!previo.descripcion) previo.descripcion = s.descripcion;
        return;
      }
      this.subagentes.set(b.id, s);
      salida.push(this.#evento('subagente', ts, { id: b.id, fase: 'inicio', tipoAgente: s.tipoAgente, descripcion: s.descripcion }));
    } else if (clase === 'pregunta' && idAgente == null) {
      salida.push(this.#evento('espera', ts, { motivo: 'respuesta' }));
    } else {
      const cargada = skillPorRuta(nombre, input);
      if (cargada) salida.push(this.#evento('skill_usada', ts, cargada.id ? { id: cargada.id } : { id: cargada.nombre, ruta: cargada.ruta }));
    }
  }

  #usoDe(m, ts, lateral, salida) {
    const u = m.usage;
    const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    const idMensaje = typeof m.id === 'string' ? m.id : null;
    // El mismo mensaje llega en varias líneas (una por bloque) con el uso repetido: se cuenta una vez.
    const yaContado = idMensaje ? this.salidaPorMensaje.get(idMensaje) : undefined;
    const salidaNueva = num(u.output_tokens);
    if (yaContado === undefined) {
      this.acumulado.entrada += num(u.input_tokens);
      this.acumulado.cacheLeida += num(u.cache_read_input_tokens);
      this.acumulado.cacheCreada += num(u.cache_creation_input_tokens);
      this.acumulado.salida += salidaNueva;
    } else if (salidaNueva > yaContado) {
      this.acumulado.salida += salidaNueva - yaContado;
    }
    if (idMensaje) {
      this.salidaPorMensaje.set(idMensaje, Math.max(salidaNueva, yaContado ?? 0));
      if (this.salidaPorMensaje.size > 50) this.salidaPorMensaje.delete(this.salidaPorMensaje.keys().next().value);
    }
    if (lateral) return; // la ventana que importa es la del hilo principal
    this.uso.entrada = num(u.input_tokens);
    this.uso.cacheLeida = num(u.cache_read_input_tokens);
    this.uso.cacheCreada = num(u.cache_creation_input_tokens);
    this.#emitirUso(ts, salida);
  }

  #emitirUso(ts, salida) {
    const contexto = this.uso.entrada + this.uso.cacheLeida + this.uso.cacheCreada;
    if (contexto > 200000 && this.uso.ventana < 1000000) {
      this.uso.ventana = 1000000;
      if (this.info.modelo) this.ventanas[this.info.modelo] = 1000000; // el servidor lo guarda para las próximas sesiones
    }
    const campos = {
      entrada: this.uso.entrada,
      salida: this.acumulado.salida,
      cacheLeida: this.uso.cacheLeida,
      cacheCreada: this.uso.cacheCreada,
      contexto,
      ventana: this.uso.ventana,
    };
    if (this.uso.costoUSD != null) campos.costoUSD = this.uso.costoUSD;
    const firma = JSON.stringify(campos);
    if (firma === this.usoEmitido) return;
    this.usoEmitido = firma;
    salida.push(this.#evento('uso', ts, { ...campos, acumulado: { ...this.acumulado } }));
  }

  #sistema(r, ts, lateral, salida) {
    if (lateral) return;
    if (r.subtype === 'compact_boundary') this.#compactacion(ts, salida);
    else if (r.subtype === 'turn_duration') salida.push(...this.cerrarTurno(ts, typeof r.durationMs === 'number' ? r.durationMs : null));
  }

  #compactacion(ts, salida) {
    // El límite de compactación y su resumen llegan seguidos: un solo evento.
    if (ts - this.ultimaCompactacion < 120000) return;
    this.ultimaCompactacion = ts;
    salida.push(this.#evento('compactacion', ts, {}));
  }
}

/** Atajo: convierte un transcript completo (texto) en eventos. */
export function interpretarTexto(contenido, { sesion = null } = {}) {
  const interprete = new Interprete({ sesion });
  const eventos = [];
  for (const l of String(contenido ?? '').split('\n')) eventos.push(...interprete.linea(l));
  return { eventos, interprete };
}
