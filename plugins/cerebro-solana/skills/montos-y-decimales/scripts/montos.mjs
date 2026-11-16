// Utilidades de montos para Solana sin floats. Copia las funciones al proyecto
// (o importa este archivo) y corre `node montos.mjs --test` para ver las pruebas.
// Todo monto on-chain es un entero (BigInt) en unidades mínimas: lamports o "raw".

export const LAMPORTS_PER_SOL = 1_000_000_000n;
export const BPS = 10_000n;

/** Texto decimal de usuario ("1.5", "0.000001") -> BigInt raw. Nunca usa Number. */
export function toRaw(ui, decimals) {
  if (typeof ui !== "string") throw new TypeError("toRaw espera string, no number (evita floats)");
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) throw new RangeError("decimals inválido");
  const s = ui.trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error(`monto inválido: "${ui}"`);
  const [ent, frac = ""] = s.split(".");
  if (frac.length > decimals) throw new Error(`"${ui}" tiene más de ${decimals} decimales`);
  return BigInt(ent + frac.padEnd(decimals, "0"));
}

/** BigInt raw -> texto decimal exacto (sin perder precisión). */
export function toUi(raw, decimals) {
  if (typeof raw !== "bigint") throw new TypeError("toUi espera BigInt");
  const neg = raw < 0n;
  const abs = (neg ? -raw : raw).toString().padStart(decimals + 1, "0");
  const ent = abs.slice(0, abs.length - decimals);
  const frac = decimals ? abs.slice(abs.length - decimals).replace(/0+$/, "") : "";
  return (neg ? "-" : "") + ent + (frac ? "." + frac : "");
}

/** amount * bps / 10000. Redondeo hacia abajo por defecto (nunca gastar de más). */
export function mulBps(amount, bps, redondeo = "abajo") {
  const b = BigInt(bps);
  if (b < 0n) throw new RangeError("bps negativo");
  const num = amount * b;
  if (redondeo === "abajo") return num / BPS;
  if (redondeo === "arriba") return (num + BPS - 1n) / BPS;
  throw new Error("redondeo debe ser 'abajo' o 'arriba'");
}

/** Proporción a/b en bps, hacia abajo. Para "% del balance que usó el trader". */
export function ratioBps(a, b) {
  if (b <= 0n) throw new RangeError("denominador debe ser > 0");
  return (a * BPS) / b;
}

/** Salida mínima aceptable dado un slippage en bps (hacia abajo = más estricto para ti). */
export function minOutConSlippage(outAmount, slippageBps) {
  return mulBps(outAmount, BPS - BigInt(slippageBps), "abajo");
}

/** ¿precio a/b es mayor que c/d? Comparación en cruz, sin dividir. */
export function precioMayor(aIn, aOut, cIn, cOut) {
  return aIn * cOut > cIn * aOut;
}

function test() {
  const eq = (a, b, m) => { if (a !== b) { console.error("FALLA:", m, "esperado", b, "obtuve", a); process.exitCode = 1; } else console.log("ok  ", m); };
  const lanza = (fn, m) => { try { fn(); console.error("FALLA:", m, "no lanzó"); process.exitCode = 1; } catch { console.log("ok  ", m); } };

  eq(toRaw("1.5", 9), 1_500_000_000n, "1.5 SOL a lamports");
  eq(toRaw("0.1", 9), 100_000_000n, "0.1 sin error de float");
  eq(toRaw("0.000001", 6), 1n, "unidad mínima con 6 decimales");
  eq(toRaw("123", 0), 123n, "token con 0 decimales");
  lanza(() => toRaw(0.1, 9), "rechaza number (float)");
  lanza(() => toRaw("1.0000001", 6), "rechaza más decimales que el mint");
  lanza(() => toRaw("1e9", 9), "rechaza notación científica");
  eq(toUi(1_500_000_000n, 9), "1.5", "lamports a SOL");
  eq(toUi(1n, 6), "0.000001", "raw mínimo a UI");
  eq(toUi(5n, 0), "5", "0 decimales");
  eq(toUi(toRaw("98765.4321", 8), 8), "98765.4321", "ida y vuelta exacta");
  eq(mulBps(1_000_000_000n, 2550), 255_000_000n, "25.5% de 1 SOL");
  eq(mulBps(3n, 5000), 1n, "redondeo hacia abajo");
  eq(mulBps(3n, 5000, "arriba"), 2n, "redondeo hacia arriba");
  eq(ratioBps(250_000_000n, 1_000_000_000n), 2500n, "trader usó 25% de su SOL");
  eq(minOutConSlippage(1_000_000n, 50), 995_000n, "slippage 0.5%");
  eq(precioMayor(110n, 100n, 100n, 100n), true, "1.10 > 1.00 en cruz");
  // El bug clásico: con floats 0.1 + 0.2 != 0.3; con BigInt raw sí cuadra.
  eq(toRaw("0.1", 9) + toRaw("0.2", 9), toRaw("0.3", 9), "0.1 + 0.2 == 0.3 en raw");
  // Un mint de 6 decimales tratado como 9 multiplica por 1000 el monto:
  eq(toRaw("1", 9) / toRaw("1", 6), 1000n, "asumir 9 en vez de 6 = error x1000");
  if (!process.exitCode) console.log("\nTodas las pruebas pasaron.");
}

if (process.argv.includes("--test")) test();
