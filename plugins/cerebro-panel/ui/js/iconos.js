// iconos.js — íconos propios en SVG, un solo estilo: trazo de 1.5 px, esquinas rectas,
// rejilla de 24. Las clases m-* las anima css/zonas.css (el "monito" de lo que hace Claude).

const svg = (dentro) => `<svg viewBox="0 0 24 24" aria-hidden="true">${dentro}</svg>`;

export const MONITO = {
  // lupa que barre
  buscar: svg('<g class="m-barre"><circle cx="10.5" cy="10.5" r="5.5"/><path d="M14.6 14.6 20 20"/></g><path d="M3 22h18" opacity=".35"/>'),
  // hoja cuyos renglones pasan
  leer: svg('<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><g class="m-hoja"><path d="M9 11h7M9 14h7M9 17h4"/></g>'),
  // cursor de terminal que parpadea
  comando: svg('<path d="M3 5h18v14H3z"/><path d="M7 10l3 2.5L7 15"/><path class="m-cursor" d="M12.5 15h4.5"/>'),
  // lápiz
  editar: svg('<g class="m-lapiz"><path d="M5 19l1-4L16 5l3 3L9 18z"/><path d="M14 7l3 3"/></g><path d="M4 22h16" opacity=".35"/>'),
  // globo
  web: svg('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><g class="m-gira"><ellipse cx="12" cy="12" rx="3.6" ry="8.5"/></g>'),
  // reloj de arena (ámbar: te toca)
  esperando: svg('<g class="m-arena"><path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9"/></g>'),
  // tres puntos: pensando
  pensando: svg('<circle cx="6" cy="12" r="1.4"/><circle class="m-late" cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/>'),
  // dos caritas: delegando
  agente: svg('<circle cx="8.5" cy="10" r="5"/><circle cx="17.5" cy="16" r="3.2"/><path class="m-late" d="M7 9v2M10 9v2"/>'),
  // paquete: skill
  skill: svg('<path d="M5 5h14v14H5z"/><path class="m-late" d="M9 9h6v6H9z"/>'),
  // globo de diálogo: hablando
  hablando: svg('<path d="M4 5h16v11h-9l-4 4v-4H4z"/><path class="m-hoja" d="M8 9h8M8 12h5"/>'),
  // casilla: tareas
  tarea: svg('<path d="M5 5h14v14H5z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>'),
  // tropiezo
  tropezo: svg('<path d="M12 4l9 16H3z"/><path d="M12 10v5M12 17.5v.5"/>'),
  otro: svg('<circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="8" opacity=".5"/>'),
};

export const ICO = {
  rama: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="7" cy="5" r="2.2"/><circle cx="7" cy="19" r="2.2"/><circle cx="17" cy="9" r="2.2"/><path d="M7 7.2v9.6M17 11.2c0 4-10 2-10 5.6"/></svg>',
  carpeta: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h7l2 3h9v10H3z"/></svg>',
  modelo: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h12v12H6z"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/></svg>',
};
