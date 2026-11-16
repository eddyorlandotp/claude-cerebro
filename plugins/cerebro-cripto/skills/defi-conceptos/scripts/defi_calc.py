#!/usr/bin/env python3
"""Calculadora DeFi sin dependencias (solo python3).

Uso:
  python3 defi_calc.py swap  <reserva_entrada> <reserva_salida> <monto_entrada> [fee_bps=30]
  python3 defi_calc.py il    <precio_final/precio_inicial>
  python3 defi_calc.py minout <monto_cotizado> <slippage_bps>
  python3 defi_calc.py hf    <colateral_usd> <umbral_liquidacion_0a1> <deuda_usd>
  python3 defi_calc.py test

Todo en unidades "humanas" (no raw). Para montos on-chain reales usa enteros
(BigInt / int) con los decimales del token; esto es para razonar y comprobar.
"""
import math
import sys


def swap_cp(rin: float, rout: float, amt_in: float, fee_bps: float = 30):
    """AMM de producto constante (x*y=k, estilo Uniswap v2) con fee sobre la entrada."""
    if min(rin, rout, amt_in) <= 0:
        raise ValueError("reservas y monto deben ser > 0")
    amt_fee = amt_in * (1 - fee_bps / 10_000)
    out = rout * amt_fee / (rin + amt_fee)
    spot = rout / rin                 # precio antes del trade (salida por 1 de entrada)
    ejec = out / amt_in               # precio que realmente obtuviste (incluye fee)
    impacto = 1 - ejec / spot         # price impact + fee, en fracción
    nuevo_spot = (rout - out) / (rin + amt_in)
    return {"salida": out, "precio_spot": spot, "precio_ejecucion": ejec,
            "impacto_total_pct": impacto * 100, "precio_spot_despues": nuevo_spot}


def impermanent_loss(r: float):
    """IL de un LP 50/50 en x*y=k cuando el precio relativo cambia por factor r.
    Valor LP / valor de solo holdear = 2*sqrt(r)/(1+r). IL = eso - 1 (negativo = pérdida).
    No incluye fees ganadas."""
    if r <= 0:
        raise ValueError("r debe ser > 0")
    return 2 * math.sqrt(r) / (1 + r) - 1


def min_out(cotizado: float, slippage_bps: float):
    """Mínimo aceptable que debe ir en la tx (amountOutMin / minOut)."""
    return cotizado * (1 - slippage_bps / 10_000)


def health_factor(colateral_usd: float, umbral: float, deuda_usd: float):
    """Estilo Aave: (colateral * umbral de liquidación) / deuda. < 1 => liquidable."""
    if deuda_usd <= 0:
        return math.inf
    return colateral_usd * umbral / deuda_usd


def _tests():
    # x*y=k se conserva (sin fee)
    r = swap_cp(1000, 1000, 10, 0)
    assert abs((1000 + 10) * (1000 - r["salida"]) - 1000 * 1000) < 1e-6
    # trade pequeño => impacto ~ fee (0.3%)
    assert abs(swap_cp(1e9, 1e9, 1, 30)["impacto_total_pct"] - 0.30) < 1e-3
    # trade del 10% de la reserva sin fee => impacto ~9.09%
    assert abs(swap_cp(1000, 1000, 100, 0)["impacto_total_pct"] - 100 / 11) < 1e-9
    # IL conocidos: 2x => -5.72%, 4x => -20%, sin cambio => 0
    assert abs(impermanent_loss(2) - (-0.05719)) < 1e-4
    assert abs(impermanent_loss(4) - (-0.2)) < 1e-12
    assert impermanent_loss(1) == 0
    # IL simétrico en r y 1/r
    assert abs(impermanent_loss(3) - impermanent_loss(1 / 3)) < 1e-12
    assert min_out(100, 50) == 99.5
    assert health_factor(1000, 0.8, 800) == 1.0
    print("OK: todas las pruebas pasan")


def main(a):
    if not a or a[0] in ("-h", "--help"):
        print(__doc__)
        return
    cmd, nums = a[0], [float(x) for x in a[1:]]
    if cmd == "swap":
        for k, v in swap_cp(*nums).items():
            print(f"{k}: {v:.10g}")
    elif cmd == "il":
        print(f"IL: {impermanent_loss(nums[0]) * 100:.4f}% (sin contar fees)")
    elif cmd == "minout":
        print(f"minOut: {min_out(*nums):.10g}")
    elif cmd == "hf":
        hf = health_factor(*nums)
        print(f"health factor: {hf:.4f} -> {'LIQUIDABLE' if hf < 1 else 'ok'}")
    elif cmd == "test":
        _tests()
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main(sys.argv[1:])
