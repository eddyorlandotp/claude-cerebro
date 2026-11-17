// frases.js — lo que dice la cara cuando despierta un momento estando dormida.
// Edita con confianza: una frase corta por renglón (máx ~40 caracteres para que quepa en una
// burbuja chica). Se elige una al azar sin repetir la anterior. Nunca se muestran en ámbar:
// el ámbar es solo para cuando Claude de verdad espera tu permiso o tu respuesta.

export const FRASES = {
  // con una sesión abierta pero sin actividad desde hace rato
  reposo: [
    '¿sigues ahí?',
    'aquí ando',
    'cuando quieras',
    'todo en orden por acá',
    'la araña sigue leyendo',
    'solo estiraba los ojos',
    'sin prisa',
    'nada nuevo que contar',
  ],
  // sin ninguna sesión de Claude Code abierta
  sinSesion: [
    'abre Claude Code y despierto',
    'nadie en casa todavía',
    'la biblioteca sí está despierta',
    'aquí espero',
  ],
};

let ultima = '';
/** Devuelve una frase al azar de la lista pedida, distinta de la anterior. */
export function frase(lista = 'reposo') {
  const ops = (FRASES[lista] || FRASES.reposo).filter((f) => f !== ultima);
  ultima = ops[Math.floor(Math.random() * ops.length)] || '…';
  return ultima;
}
