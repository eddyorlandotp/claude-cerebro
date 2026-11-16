import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizar, tokenizar, terminos, raiz, sinonimos, recortar, descCorta, STOPWORDS } from '../lib/texto.mjs';

test('normalizar quita acentos y mayúsculas', () => {
  assert.equal(normalizar('Página RÁPIDA con Ñandú'), 'pagina rapida con nandu');
});

test('tokenizar separa por todo lo que no sea letra o número', () => {
  assert.deepEqual(tokenizar('copy-trading: ¿24/7?'), ['copy', 'trading', '24', '7']);
});

test('terminos quita stopwords, números y letras sueltas', () => {
  const t = terminos('hola, quiero que el bot tarde 2 segundos o menos por favor');
  assert.ok(t.includes('bot'));
  assert.ok(!t.includes('hola') && !t.includes('2') && !t.includes('quiero'));
  assert.deepEqual(terminos('hola'), []);
  assert.deepEqual(terminos('ok gracias'), []);
});

test('raiz junta variantes en español e inglés', () => {
  assert.equal(raiz('tarda'), raiz('tardar'));
  assert.equal(raiz('copiar'), raiz('copia'));
  assert.equal(raiz('juegos'), raiz('juego'));
  assert.equal(raiz('miniaturas'), raiz('miniatura'));
  assert.equal(raiz('tests'), raiz('testing'));
  assert.equal(raiz('trades'), raiz('trading'));
  assert.equal(raiz('debugging'), 'debug');
  assert.equal(raiz('transacciones'), raiz('transaccion'));
  assert.equal(raiz('redes'), 'red');
});

test('raiz no mezcla palabras distintas que se parecen', () => {
  assert.notEqual(raiz('pago'), raiz('pages'));
  assert.notEqual(raiz('base'), raiz('bot'));
  assert.equal(raiz('api'), 'api');
  assert.equal(raiz('d1'), 'd1');
});

test('sinonimos conecta el vocabulario del usuario', () => {
  const s = sinonimos();
  assert.ok(s.get(raiz('tarda')).has(raiz('latencia')));
  assert.ok(s.get(raiz('lento')).has(raiz('rendimiento')));
  assert.ok(s.get(raiz('comprar')).has(raiz('swap')));
  assert.ok(s.get(raiz('publicar')).has(raiz('deploy')));
  assert.ok(s.get(raiz('roblox')).has(raiz('luau')));
  assert.ok(s.get(raiz('landing')).has(raiz('pagina')));
  assert.ok(s.get(raiz('contexto')).has(raiz('token')));
  assert.ok(s.get(raiz('copiar')).has(raiz('copy')));
});

test('recortar y descCorta respetan el máximo', () => {
  assert.equal(recortar('a  b\n c', 10), 'a b c');
  assert.equal(recortar('x'.repeat(50), 10).length, 10);
  const d = descCorta('Bot de Discord que no se cae ni lo banean - discord.js o discord.py, intents mínimos', 90);
  assert.equal(d, 'Bot de Discord que no se cae ni lo banean');
  assert.ok(descCorta('y'.repeat(300), 90).length <= 90);
});

test('las stopwords cubren saludos y muletillas', () => {
  for (const p of ['hola', 'gracias', 'porfa', 'the', 'quiero']) assert.ok(STOPWORDS.has(p), p);
});
