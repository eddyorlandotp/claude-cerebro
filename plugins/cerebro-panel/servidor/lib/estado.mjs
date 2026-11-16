// Estado agregado del panel: lo que /estado devuelve y lo que un cliente nuevo recibe al conectarse.
// Se alimenta solo de eventos normalizados (los mismos que viajan por SSE).

const MAX_TURNO = 200;
const HILO_VACIO = { objetivo: '', ultimoPedido: '', archivos: [], comandos: [], errores: [], pendientes: [], turnos: 0 };

export class Estado {
  constructor({ version = '0.0.0' } = {}) {
    this.version = version;
    this.biblioteca = { tipo: 'biblioteca', modo: 'completo', plugins: [] };
    this.reiniciar(null);
  }

  /** Borra todo lo que pertenece a una sesión (la biblioteca se conserva). */
  reiniciar(sesion) {
    this.sesionId = sesion;
    this.sesion = null; // último evento `sesion`
    this.hilo = null; // último evento `hilo`
    this.uso = null; // último evento `uso`
    this.espera = null; // último `espera` aún vigente
    this.sugeridas = null; // último `sugeridas`
    this.usadas = []; // ids de skills usadas en la sesión
    this.turno = { numero: 0, abierto: false, inicio: null, pasos: 0, ms: null };
    this.eventosTurno = []; // eventos desde el último `prompt` (máx 200)
    this.subagentes = new Map(); // activos
    this.ultimoEvento = null;
  }

  /** Aplica un evento al estado. Devuelve el mismo evento. */
  aplicar(e) {
    if (!e || typeof e !== 'object') return e;
    if (e.tipo === 'latido') return e;
    if (e.tipo === 'biblioteca') {
      this.biblioteca = e;
      return e;
    }
    this.ultimoEvento = e.ts ?? Date.now();
    switch (e.tipo) {
      case 'sesion':
        this.sesion = e;
        if (e.sesion) this.sesionId = e.sesion;
        return e;
      case 'hilo':
        this.hilo = e;
        return e;
      case 'uso':
        this.uso = e;
        return e;
      case 'prompt':
        this.turno = { numero: this.turno.numero + 1, abierto: true, inicio: e.ts ?? null, pasos: 0, ms: null };
        this.eventosTurno = [];
        this.sugeridas = null;
        this.espera = null;
        break;
      case 'sugeridas':
        this.sugeridas = e;
        break;
      case 'skill_usada':
        if (e.id && !this.usadas.includes(e.id)) this.usadas.push(e.id);
        break;
      case 'herramienta':
        if (e.fase === 'inicio') {
          this.turno.pasos++;
          if (!this.turno.abierto) this.turno = { ...this.turno, abierto: true, inicio: this.turno.inicio ?? e.ts ?? null, ms: null };
        }
        this.espera = e.clase === 'pregunta' && e.fase === 'inicio' ? this.espera : null;
        break;
      case 'subagente':
        if (e.fase === 'inicio') this.subagentes.set(e.id, { id: e.id, tipoAgente: e.tipoAgente, descripcion: e.descripcion });
        else this.subagentes.delete(e.id);
        break;
      case 'espera':
        this.espera = e;
        break;
      case 'fin_turno':
        this.turno = { ...this.turno, abierto: false, ms: e.ms ?? null, pasos: e.pasos ?? this.turno.pasos };
        break;
      case 'pensamiento':
      case 'dicho':
        this.espera = null;
        break;
      default:
        break;
    }
    this.eventosTurno.push(e);
    if (this.eventosTurno.length > MAX_TURNO) this.eventosTurno.splice(0, this.eventosTurno.length - MAX_TURNO);
    return e;
  }

  #base(tipo, campos) {
    return { tipo, ts: Date.now(), sesion: this.sesionId, ...campos };
  }

  /** Eventos que recibe un cliente al conectarse: sesion, biblioteca, hilo, uso y lo último del turno. */
  iniciales() {
    const salida = [];
    if (this.sesion) salida.push(this.sesion);
    salida.push({ ...this.biblioteca, ts: Date.now(), sesion: this.sesionId });
    salida.push(this.hilo ?? this.#base('hilo', HILO_VACIO));
    if (this.uso) salida.push(this.uso);
    salida.push(...this.eventosTurno);
    return salida;
  }

  /** JSON de /estado. */
  instantanea() {
    return {
      version: this.version,
      sesion: this.sesion ? { ...this.sesion, tipo: undefined } : null,
      biblioteca: { modo: this.biblioteca.modo ?? 'completo', plugins: this.biblioteca.plugins ?? [] },
      hilo: this.hilo ? { ...this.hilo, tipo: undefined } : { ...HILO_VACIO },
      uso: this.uso ? { ...this.uso, tipo: undefined } : null,
      turno: { ...this.turno },
      espera: this.espera ? this.espera.motivo : null,
      sugeridas: this.sugeridas ? { skills: this.sugeridas.skills, apagadas: this.sugeridas.apagadas } : null,
      usadas: [...this.usadas],
      subagentes: [...this.subagentes.values()],
      ultimoEvento: this.ultimoEvento,
      eventos: [...this.eventosTurno],
    };
  }
}
