import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { temporal, escribir, skill } from '../ayudas-de-prueba.mjs';

// Cada prueba usa su propia carpeta de datos para no tocar la del usuario.
const base = temporal();
process.env.XDG_STATE_HOME = path.join(base, 'estado');
const { leerFrontmatter, construirIndice, obtenerIndice, todasLasSkills, buscarSkill, aBiblioteca } = await import('../lib/indice.mjs');

test('leerFrontmatter: valores simples, comillas, bloques y continuaciones', () => {
  const { datos, cuerpo } = leerFrontmatter(
    '---\nname: mi-skill\ndescription: "Con: dos puntos y \\"comillas\\""\nwhen_to_use: >\n  línea uno\n  línea dos\nallowed-tools:\n  - Bash\n  - Read\nlarga: empieza aquí\n  y sigue acá\ndisable-model-invocation: true\n---\n\n# Título\ntexto\n',
  );
  assert.equal(datos.name, 'mi-skill');
  assert.equal(datos.description, 'Con: dos puntos y "comillas"');
  assert.equal(datos.when_to_use, 'línea uno línea dos');
  assert.equal(datos.larga, 'empieza aquí y sigue acá');
  assert.equal(datos['disable-model-invocation'], 'true');
  assert.match(cuerpo, /^\n# Título/);
});

test('leerFrontmatter tolera archivos sin frontmatter o sin cierre', () => {
  assert.deepEqual(leerFrontmatter('# solo cuerpo').datos, {});
  assert.deepEqual(leerFrontmatter('---\nname: x\nsin cierre').datos, {});
  assert.deepEqual(leerFrontmatter('').datos, {});
});

/** Instalación falsa con todos los casos raros que se vieron en una instalación real. */
function instalacion() {
  const raiz = temporal();
  const configDir = path.join(raiz, '.claude');
  const cache = path.join(configDir, 'plugins', 'cache');
  // Plugin normal, prendido, con hooks, MCP y agentes
  const alfa = path.join(cache, 'tienda', 'alfa', '1.0.0');
  escribir(path.join(alfa, '.claude-plugin', 'plugin.json'), { name: 'alfa', version: '1.0.0' });
  skill(path.join(alfa, 'skills'), 'uno', 'Primera skill de alfa. Usa con websockets.');
  escribir(path.join(alfa, 'skills', 'otra-carpeta', 'SKILL.md'), '---\nname: nombre-distinto\ndescription: >\n  Descripción en bloque\n  de dos líneas.\n---\ncuerpo\n');
  escribir(path.join(alfa, 'skills', 'sin-skill', 'notas.md'), 'no es skill');
  escribir(path.join(alfa, 'commands', 'hacer.md'), '---\ndescription: Hace algo\n---\ncuerpo del comando\n');
  escribir(path.join(alfa, 'commands', 'db', 'migrar.md'), 'Migra la base\n');
  escribir(path.join(alfa, 'hooks', 'hooks.json'), { hooks: {} });
  escribir(path.join(alfa, '.mcp.json'), { mcpServers: {} });
  escribir(path.join(alfa, 'agents', 'revisor.md'), '---\nname: revisor\n---\n');
  // Plugin apagado, con skill manual y skills extra declaradas en el manifiesto
  const beta = path.join(cache, 'tienda', 'beta', '2.0.0');
  escribir(path.join(beta, '.claude-plugin', 'plugin.json'), { name: 'beta', skills: ['./extra/'] });
  skill(path.join(beta, 'skills'), 'dos', 'Skill de beta', 'disable-model-invocation: true\n');
  skill(path.join(beta, 'extra'), 'tres', 'Skill en carpeta extra');
  // Dos plugins "strict: false" que comparten la misma copia: el marketplace dice qué skill es de quién
  for (const n of ['docs', 'api']) {
    const dir = path.join(cache, 'ejemplos', n, 'abc123');
    for (const s of ['pdf', 'xlsx', 'claude-api']) skill(path.join(dir, 'skills'), s, `Skill ${s}`);
  }
  const mkt = path.join(configDir, 'plugins', 'marketplaces', 'ejemplos');
  escribir(path.join(mkt, '.claude-plugin', 'marketplace.json'), {
    name: 'ejemplos',
    plugins: [
      { name: 'docs', source: './', strict: false, skills: ['./skills/pdf', './skills/xlsx'] },
      { name: 'api', source: './', strict: false, skills: ['./skills/claude-api'] },
    ],
  });
  // Plugin de marketplace de carpeta local: se carga en sitio, no desde la caché
  const local = path.join(raiz, 'mi-marketplace');
  escribir(path.join(local, '.claude-plugin', 'marketplace.json'), { name: 'local', plugins: [{ name: 'gama', source: './plugins/gama' }] });
  escribir(path.join(local, 'plugins', 'gama', '.claude-plugin', 'plugin.json'), { name: 'gama' });
  skill(path.join(local, 'plugins', 'gama', 'skills'), 'en-sitio', 'Skill leída en sitio');
  skill(path.join(cache, 'local', 'gama', '0.1.0', 'skills'), 'copia-vieja', 'No debería salir');

  const reg = (p) => [{ scope: 'user', installPath: p, version: path.basename(p) }];
  escribir(path.join(configDir, 'plugins', 'installed_plugins.json'), {
    version: 2,
    plugins: {
      'alfa@tienda': reg(alfa),
      'beta@tienda': reg(beta),
      'docs@ejemplos': reg(path.join(cache, 'ejemplos', 'docs', 'abc123')),
      'api@ejemplos': reg(path.join(cache, 'ejemplos', 'api', 'abc123')),
      'gama@local': reg(path.join(cache, 'local', 'gama', '0.1.0')),
      'fantasma@tienda': reg(path.join(cache, 'tienda', 'fantasma', '9.9.9')),
    },
  });
  escribir(path.join(configDir, 'plugins', 'known_marketplaces.json'), {
    ejemplos: { source: { source: 'github', repo: 'x/y' }, installLocation: mkt },
    local: { source: { source: 'directory', path: local }, installLocation: local },
  });
  escribir(path.join(configDir, 'settings.json'), {
    enabledPlugins: { 'alfa@tienda': true, 'beta@tienda': false, 'docs@ejemplos': true, 'api@ejemplos': true, 'gama@local': true },
  });
  // Skill personal y skill de proyecto
  skill(path.join(configDir, 'skills'), 'personal', 'Skill personal');
  const proyecto = path.join(raiz, 'proyecto');
  skill(path.join(proyecto, '.claude', 'skills'), 'del-proyecto', 'Skill del proyecto');
  return { raiz, configDir, proyecto, alfa, beta };
}

test('construirIndice: plugins, estado, extras, rutas y casos raros', () => {
  const { configDir, proyecto, alfa } = instalacion();
  const indice = construirIndice({ configDir, cwd: proyecto });
  const por = Object.fromEntries(indice.plugins.map((p) => [p.nombre, p]));
  assert.deepEqual(Object.keys(por).sort(), ['alfa', 'api', 'beta', 'docs', 'gama', 'personales', 'proyecto']);

  assert.equal(por.alfa.activo, true);
  assert.equal(por.alfa.marketplace, 'tienda');
  assert.deepEqual(por.alfa.extras, { hooks: true, mcp: true, agentes: true });
  assert.deepEqual(por.alfa.skills.map((s) => s.id), ['alfa:db:migrar', 'alfa:hacer', 'alfa:nombre-distinto', 'alfa:uno']);
  const uno = por.alfa.skills.find((s) => s.nombre === 'uno');
  assert.equal(uno.ruta, path.join(alfa, 'skills', 'uno', 'SKILL.md'));
  assert.equal(uno.dir, path.join(alfa, 'skills', 'uno'));
  assert.equal(uno.plugin, 'alfa');
  assert.equal(por.alfa.skills.find((s) => s.nombre === 'nombre-distinto').desc, 'Descripción en bloque de dos líneas.');
  assert.equal(por.alfa.skills.find((s) => s.id === 'alfa:db:migrar').desc, 'Migra la base');
  assert.equal(por.alfa.skills.find((s) => s.id === 'alfa:hacer').tipo, 'comando');

  // Apagado a nivel usuario, pero indexado igual (la caché sigue en disco)
  assert.equal(por.beta.activo, false);
  assert.deepEqual(por.beta.skills.map((s) => s.id), ['beta:dos', 'beta:tres']);
  assert.equal(por.beta.skills[0].manual, true);
  assert.deepEqual(por.beta.extras, { hooks: false, mcp: false, agentes: false });

  // strict: false -> cada plugin solo con sus skills
  assert.deepEqual(por.docs.skills.map((s) => s.id), ['docs:pdf', 'docs:xlsx']);
  assert.deepEqual(por.api.skills.map((s) => s.id), ['api:claude-api']);

  // Marketplace de carpeta: en sitio
  assert.deepEqual(por.gama.skills.map((s) => s.id), ['gama:en-sitio']);

  assert.deepEqual(por.personales.skills.map((s) => s.id), ['personal']);
  assert.deepEqual(por.proyecto.skills.map((s) => s.id), ['del-proyecto']);
  assert.equal(todasLasSkills(indice).filter((s) => !s.activo).length, 2);
});

test('los settings de proyecto y local ganan a los de usuario', () => {
  const { configDir, proyecto } = instalacion();
  escribir(path.join(proyecto, '.claude', 'settings.json'), { enabledPlugins: { 'beta@tienda': true, 'alfa@tienda': false } });
  let por = Object.fromEntries(construirIndice({ configDir, cwd: proyecto }).plugins.map((p) => [p.nombre, p.activo]));
  assert.equal(por.beta, true);
  assert.equal(por.alfa, false);
  escribir(path.join(proyecto, '.claude', 'settings.local.json'), { enabledPlugins: { 'beta@tienda': false } });
  por = Object.fromEntries(construirIndice({ configDir, cwd: proyecto }).plugins.map((p) => [p.nombre, p.activo]));
  assert.equal(por.beta, false);
  // Fuera del proyecto mandan los de usuario
  por = Object.fromEntries(construirIndice({ configDir, cwd: '/' }).plugins.map((p) => [p.nombre, p.activo]));
  assert.equal(por.alfa, true);
});

test('obtenerIndice guarda la copia y la reconstruye cuando algo cambia', () => {
  const { configDir, proyecto, alfa } = instalacion();
  const a = obtenerIndice({ configDir, cwd: proyecto, forzar: true });
  const archivo = path.join(process.env.XDG_STATE_HOME, 'cerebro-panel', 'indice.json');
  assert.ok(fs.existsSync(archivo));
  const b = obtenerIndice({ configDir, cwd: proyecto });
  assert.equal(b.generado, a.generado, 'sin cambios se usa la copia');
  // Skill nueva -> cambia el mtime de la carpeta skills/
  skill(path.join(alfa, 'skills'), 'nueva', 'Recién agregada');
  const futuro = new Date(Date.now() + 5000);
  fs.utimesSync(path.join(alfa, 'skills'), futuro, futuro);
  const c = obtenerIndice({ configDir, cwd: proyecto });
  assert.ok(c.plugins.find((p) => p.nombre === 'alfa').skills.some((s) => s.id === 'alfa:nueva'));
  // Apagar un plugin (cambia settings.json) también se nota
  escribir(path.join(configDir, 'settings.json'), { enabledPlugins: { 'alfa@tienda': false } });
  fs.utimesSync(path.join(configDir, 'settings.json'), futuro, futuro);
  const d = obtenerIndice({ configDir, cwd: proyecto });
  assert.equal(d.plugins.find((p) => p.nombre === 'alfa').activo, false);
  // Una copia de más de un día se descarta
  const viejo = JSON.parse(fs.readFileSync(archivo, 'utf8'));
  viejo.generado = Date.now() - 25 * 60 * 60 * 1000;
  fs.writeFileSync(archivo, JSON.stringify(viejo));
  assert.ok(obtenerIndice({ configDir, cwd: proyecto }).generado > viejo.generado);
});

test('sin instalación no truena: índice vacío', () => {
  const vacio = temporal();
  const indice = construirIndice({ configDir: path.join(vacio, 'nada'), cwd: vacio });
  assert.deepEqual(indice.plugins, []);
  assert.deepEqual(aBiblioteca(indice).plugins, []);
});

test('archivos corruptos se ignoran', () => {
  const { configDir, proyecto } = instalacion();
  fs.writeFileSync(path.join(configDir, 'settings.json'), '{ esto no es json');
  fs.writeFileSync(path.join(configDir, 'plugins', 'known_marketplaces.json'), 'null');
  const indice = construirIndice({ configDir, cwd: proyecto });
  assert.ok(indice.plugins.length >= 4);
  assert.ok(indice.plugins.filter((p) => p.marketplace).every((p) => p.activo === false), 'sin settings nadie está prendido');
});

test('buscarSkill: por id, por nombre, por carpeta y ambiguo', () => {
  const { configDir, proyecto } = instalacion();
  const indice = construirIndice({ configDir, cwd: proyecto });
  assert.equal(buscarSkill(indice, 'alfa:uno').skill.id, 'alfa:uno');
  assert.equal(buscarSkill(indice, '/alfa:uno').skill.id, 'alfa:uno');
  assert.equal(buscarSkill(indice, 'tres').skill.id, 'beta:tres');
  assert.equal(buscarSkill(indice, 'otra-carpeta').skill.id, 'alfa:nombre-distinto');
  assert.equal(buscarSkill(indice, 'no-existe-xyz').skill, null);
  assert.equal(buscarSkill(indice, '').skill, null);
});

test('aBiblioteca: forma del evento y modo ligero', () => {
  const { configDir, proyecto } = instalacion();
  const indice = construirIndice({ configDir, cwd: proyecto });
  const completo = aBiblioteca(indice);
  assert.equal(completo.tipo, 'biblioteca');
  assert.equal(completo.modo, 'completo');
  assert.equal(completo.plugins.find((p) => p.nombre === 'beta').activo, false);
  assert.deepEqual(Object.keys(completo.plugins[0].skills[0]).sort(), ['desc', 'id', 'nombre']);
  const ligero = aBiblioteca(indice, { modo: 'ligero' });
  assert.equal(ligero.modo, 'ligero');
  assert.ok(ligero.plugins.every((p) => p.activo === true));
});
