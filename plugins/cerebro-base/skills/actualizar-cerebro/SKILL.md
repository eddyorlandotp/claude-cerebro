---
name: actualizar-cerebro
description: Actualiza claude-cerebro y todos los plugins curados, e instala los que se hayan agregado al repo. Úsala cuando el usuario diga "actualiza el cerebro".
disable-model-invocation: true
---

# Actualizar claude-cerebro

1. Trae la versión más reciente de las instrucciones de instalación:

   ```bash
   if [ -d ~/claude-cerebro/.git ]; then git -C ~/claude-cerebro pull --ff-only; else git clone --depth 1 https://github.com/eddyorlandotp/claude-cerebro ~/claude-cerebro; fi
   ```

2. Lee `~/claude-cerebro/INSTALAR.md` completo y sigue su sección **"Para actualizar más adelante"**. No vuelvas a preguntar el perfil: usa el que ya está instalado. Revisa `claude plugin list` para saber si ECC está instalado.
3. Instala también los plugins de INSTALAR.md que aún no aparezcan en `claude plugin list`, siempre que pertenezcan al perfil del usuario.
4. Reporta qué se actualizó, qué es nuevo y qué falló, y pide `/reload-plugins`.
