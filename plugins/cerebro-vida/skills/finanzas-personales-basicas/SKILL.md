---
name: finanzas-personales-basicas
description: Finanzas personales en México con ingreso variable - presupuesto CSV, script que categoriza el CSV del banco, fondo de emergencia, separar negocio y personal, tarjeta (pago total, CAT), tope para trading. Usa con presupuesto, gastos, ahorro.
---

# Finanzas personales básicas

El error que corrige: Claude da consejos genéricos ("ahorra el 20%"), recomienda productos o bancos concretos, ignora que el ingreso de un emprendedor sube y baja, y mezcla el dinero del negocio con el personal. Aquí el resultado es un presupuesto en archivo hecho con los movimientos reales del usuario, con reglas simples que él decide.

## Reglas duras

1. **Información general, no asesoría personalizada.** No recomiendes bancos, tarjetas, fondos, acciones, cripto ni ningún producto de inversión concreto, ni digas "te conviene X". Explica cómo comparar (CAT, comisiones, protección IPAB) y remite a Condusef o a un asesor/contador para decidir.
2. **Nunca pidas ni escribas** números completos de tarjeta, CLABE, NIP, contraseñas, tokens ni códigos. Si el CSV del banco trae números de cuenta, no los copies a los archivos de salida ni al chat.
3. **Archivos de finanzas fuera de cualquier repo** (y si por error están en uno, agrégalos a `.gitignore` antes del siguiente commit). Por defecto `~/vida/finanzas/`; pregunta una vez.
4. **No muevas dinero ni hagas operaciones.** Tú haces cuentas y archivos; el usuario ejecuta en su banco.
5. **Explica cada cifra** que pongas: de dónde salió (qué meses, qué archivo). Nada estimado sin decir que es estimado.

## Flujo

1. **Datos reales primero.** Pide al usuario exportar de su banca en línea los movimientos de los últimos 3 meses en CSV (cuenta de débito y cada tarjeta). Si su banco solo da PDF, usa la skill de lectura de PDF para extraer la tabla, o pídele capturar los movimientos en CSV.
2. **Categoriza con el script** (abajo). Revisa con él la lista "sin categoría" y agrega reglas hasta que quede casi vacía.
3. **Presupuesto** del mes siguiente con el método de ingreso base (abajo).
4. **Revisión mensual**: vuelve a correr el script con el mes cerrado y compara plan vs real.

## Herramienta: categorizar el CSV del banco

```bash
mkdir -p ~/vida/finanzas && cp -n "${CLAUDE_SKILL_DIR}/scripts/reglas-ejemplo.csv" ~/vida/finanzas/reglas.csv   # una sola vez
python3 "${CLAUDE_SKILL_DIR}/scripts/categorizar_gastos.py" movimientos.csv \
  --reglas ~/vida/finanzas/reglas.csv --salida ~/vida/finanzas/2026-11
```

- Detecta solo el separador (`,` `;` tab), la codificación (UTF-8 o Windows/Latin-1, común en bancos mexicanos), líneas de título antes del encabezado y columnas `Fecha / Concepto o Descripción / Monto` o `Cargo` + `Abono`.
- Convención: **gasto negativo, ingreso positivo**. Si el banco exporta cargos como positivos en una sola columna, agrega `--gastos-positivos`. Comprueba siempre el signo con 2–3 movimientos que el usuario reconozca.
- `--desde AAAA-MM-DD --hasta AAAA-MM-DD` para recortar un periodo.
- Reglas (`patron,categoria,ambito`): expresión regular sin mayúsculas ni acentos; gana la primera. `ambito` = `personal`, `negocio` o `transferencia`. Marca como **transferencia** los traspasos entre cuentas propias y el pago de la tarjeta desde débito: el script los excluye de los totales para no contar dos veces el mismo gasto.
- Salida: `<archivo>_categorizado.csv` y `<archivo>_resumen.md` (por mes, por categoría, personal vs negocio y lista de "sin categoría").
- Si el script falla con un formato nuevo, lee el error (dice qué columnas vio) y ajusta los nombres de columna en el script o pide otro formato de exportación. No adivines montos.
- Si el usuario quiere fórmulas y gráficas, convierte el resultado a `.xlsx` con la skill `xlsx` de document-skills.

## Presupuesto con ingreso variable

Archivo `presupuesto-AAAA-MM.csv`:

```csv
concepto,tipo,plan,real,nota
Ingreso base,ingreso,0,,el mes más bajo de los últimos 3-6
Renta/aportación a la casa,fijo,0,,
Celular,fijo,0,,
Transporte,variable,0,,
Comida fuera,variable,0,,
Suscripciones,fijo,0,,
Fondo de emergencia,ahorro,0,,se aparta el día que entra el dinero
Apartado para impuestos,negocio,0,,porcentaje que diga el contador según su régimen
Trading (tope),riesgo,0,,dinero que se puede perder completo
```

Método de **ingreso base**:
1. Del resumen del script, toma el ingreso personal de los últimos 3–6 meses y usa **el mes más bajo** como ingreso base. Si hay sueldo fijo, ese es el piso.
2. Con el ingreso base cubre, en este orden: gastos fijos → fondo de emergencia → variables → todo lo demás.
3. Lo que entre por encima del ingreso base en un mes bueno va primero a completar el fondo de emergencia y luego a un "colchón de meses malos". No sube el nivel de gasto hasta que el colchón cubra al menos un mes base.
4. Llena `real` con el resumen del mes cerrado y escribe en `nota` por qué se desvió. Ajusta el plan siguiente con base en eso, no en buenos deseos.

## Separar dinero del negocio y personal

- **Cuentas distintas**: todo cobro del negocio entra a una cuenta del negocio; todo gasto del negocio sale de ahí.
- El negocio le paga al usuario un **"sueldo" fijo** (transferencia a la cuenta personal, misma fecha cada mes). Así el presupuesto personal no depende del mes del negocio.
- Del dinero del negocio aparta impuestos **antes** de pagarte; el porcentaje depende del régimen fiscal: eso lo define un contador (ver `tramites-mexico`).
- En el script, las reglas de herramientas y hosting van con `ambito=negocio`; si salen de la cuenta personal, el resumen lo hace visible para corregir el hábito.

## Fondo de emergencia

- Condusef recomienda **de 3 a 6 meses de gastos**; con ingreso irregular (freelance, emprendimiento) puede necesitarse más.
- Dónde: cuenta **separada** de la del día a día, de fácil acceso, sin volatilidad (no acciones, no cripto) y sin comisiones o con comisiones bajas.
- Protección: el IPAB protege depósitos hasta **400 mil UDIS por persona y por banco** (el equivalente en pesos cambia con la UDI). No cubre cajas de ahorro, SOFIPOs, cooperativas, casas de bolsa ni aseguradoras. Antes de que el usuario elija dónde, que confirme que la institución aparece en la lista oficial de bancos protegidos del IPAB.
- Meta inicial realista: un mes de gastos base; luego subir.

## Tarjeta de crédito

- **Paga el "pago para no generar intereses" completo** antes de la fecha límite. Pagar solo el mínimo hace que la deuda crezca y tarde mucho más en liquidarse.
- **Fecha de corte** = el banco suma lo gastado del periodo; **fecha límite de pago** = último día para pagar sin intereses. Anota ambas en el presupuesto.
- **CAT (Costo Anual Total)**: indicador de cuánto cuesta realmente el crédito (intereses, comisiones, anualidad). Úsalo para comparar, no para elegir por el usuario.
- Comisiones típicas a vigilar: disposición de efectivo, pago tardío, reposición, uso en el extranjero.
- Regla práctica: usa la tarjeta solo para gastos que ya tienes en débito; si un mes no puedes pagar el total, deja de usarla hasta liquidar.
- Si ya hay deuda que no puede pagar: Condusef tiene la guía "¿Debes y ya no puedes pagar?". No negocies tú con el banco.

## Dinero para trading

- **Solo dinero que se puede perder completo.** Es una línea `riesgo` con tope fijo en el presupuesto, decidido a principio de mes, y no se rellena a mitad de mes si se pierde.
- Nunca de: fondo de emergencia, apartado de impuestos, dinero del negocio, tarjeta de crédito ni préstamos.
- Las ganancias de trading no son ingreso base. Si hubo ganancia, el usuario decide cuánto sacar a la cuenta personal; lo que saque cuenta como ingreso extra (punto 3 del método).
- Riesgo técnico de tokens y bots: usa `riesgo-memecoins` y `bot-copy-trading` de cerebro-solana. Cómo declarar ganancias: contador.

## Al terminar

Entrega: (1) archivos creados y dónde, (2) 3 números clave del mes (ingreso, gasto, cuánto fue al fondo), (3) el siguiente paso concreto con fecha, (4) cómo comprobarlo él mismo: comparar el total de gastos del resumen contra el estado de cuenta del banco del mismo periodo.

## Verifica antes de confiar

Montos de protección, recomendaciones de Condusef y condiciones de productos cambian. Antes de citar un número, ábrelo con WebFetch en la fuente oficial; si no carga, dilo y da el enlace. Para cualquier decisión con su dinero: "confírmalo con Condusef, tu banco o un asesor/contador".

## Fuentes (verificado nov 2026)

- https://revista.condusef.gob.mx/ahorro-general/2024/09/fondo-de-emergencia/ (3 a 6 meses, cuenta separada, sin volatilidad)
- https://revista.condusef.gob.mx/credito/2026/07/anatomia-de-tu-tdc/ (pago mínimo vs pago para no generar intereses, CAT, fecha de corte y límite, comisiones)
- https://revista.condusef.gob.mx/usuario-inteligente/tu-bolsillo/2024/09/ipab/ (400 mil UDIS por persona por banco; qué no cubre)
- https://www.gob.mx/ipab/acciones-y-programas/bancos-con-productos-protegidos-por-el-ipab (lista oficial de bancos protegidos)
- https://www.condusef.gob.mx/documentos/311663_Conduguia-Debes_y_ya_no_puedes_pagar.pdf
