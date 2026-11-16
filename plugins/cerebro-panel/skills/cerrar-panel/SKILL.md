---
name: cerrar-panel
description: Cierra Telaraña - detiene el servidor local del panel y cierra su ventana.
disable-model-invocation: true
---

# Cerrar el panel (Telaraña)

1. Corre:
   ```bash
   bash "${CLAUDE_PLUGIN_ROOT}/servidor/abrir.sh" cerrar
   ```
2. Dile al usuario en una línea lo que imprimió (`Panel detenido.` o `El panel no estaba corriendo.`).

El script solo detiene el proceso cuyo pid guardó al arrancar y que responde como panel en `/salud`, y solo cierra la ventana de navegador que él mismo abrió (la del perfil propio del panel). No toca el navegador del usuario ni ningún otro proceso.

Si el usuario abrió el panel a mano en una pestaña de su navegador, esa pestaña no se cierra sola: dile que la cierre; verá el aviso de conexión perdida.

Para ver si sigue corriendo: `bash "${CLAUDE_PLUGIN_ROOT}/servidor/abrir.sh" estado`.

Cerrar el panel no apaga a la araña: las sugerencias de skills y el hilo de la sesión siguen funcionando, porque son hooks del plugin y no dependen del servidor.
