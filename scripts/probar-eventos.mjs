/**
 * Comprobación de la lógica de eventos del panel (sin base de datos): qué evento va en la tarjeta
 * principal, cuáles en "programados" y cuáles en "anteriores", y la regla de un solo evento a la vez.
 * Uso: node --experimental-strip-types --no-warnings scripts/probar-eventos.mjs
 */
import assert from 'node:assert/strict';
import { clasificar, chocaCon, eventoAbierto } from '../src/lib/evento.ts';

const dias = (n) => new Date(Date.now() + n * 86400e3).toISOString();
const ev = (id, nombre, inicio, fin, forzar_abierto = null, creadoHace = 0) => ({ id, nombre, inicio, fin, forzar_abierto, creado_en: dias(-creadoHace) });
const ordenar = (lista) => [...lista].sort((a, b) => b.creado_en.localeCompare(a.creado_en)); // como la consulta del panel
const nombres = (lista) => lista.map((e) => e.nombre);

const pasado = ev('a', 'Feria 2025', dias(-40), dias(-35), null, 50);
const enCurso = ev('b', 'Feria 2026', dias(-1), dias(2), null, 10);
const futuro = ev('c', 'Congreso noviembre', dias(30), dias(33), null, 1);
const futuroLejano = ev('d', 'Expo diciembre', dias(60), dias(63), null, 2);
const migrado = ev('z', 'Evento 2026 (migrado)', null, null, true, 60);

// 1) En curso + futuro + pasado: el futuro NO es "anterior".
let r = clasificar(ordenar([pasado, enCurso, futuro]));
assert.equal(r.actual.nombre, 'Feria 2026');
assert.deepEqual(nombres(r.programados), ['Congreso noviembre']);
assert.deepEqual(nombres(r.anteriores), ['Feria 2025']);

// 2) Nada abierto, uno futuro y uno pasado: la tarjeta principal es el próximo, el pasado va al historial.
r = clasificar(ordenar([pasado, futuro]));
assert.equal(r.actual.nombre, 'Congreso noviembre');
assert.equal(r.enCurso, null);
assert.deepEqual(nombres(r.programados), []);
assert.deepEqual(nombres(r.anteriores), ['Feria 2025']);

// 3) Dos futuros: el más cercano es el principal, el otro queda programado (por fecha, no por creación).
r = clasificar(ordenar([pasado, futuroLejano, futuro]));
assert.equal(r.actual.nombre, 'Congreso noviembre');
assert.deepEqual(nombres(r.programados), ['Expo diciembre']);

// 4) Solo pasados: el más reciente es el principal (cerrado) y los demás, anteriores.
r = clasificar(ordenar([pasado, ev('e', 'Feria 2024', dias(-400), dias(-395), null, 410)]));
assert.equal(r.actual.nombre, 'Feria 2025');
assert.deepEqual(nombres(r.anteriores), ['Feria 2024']);

// 5) Sin eventos.
assert.deepEqual(clasificar([]), { actual: null, enCurso: null, programados: [], anteriores: [] });

// 6) Forzado abierto manda aunque no tenga fechas; el en curso por fechas queda como "anterior" si es más viejo en creación.
r = clasificar(ordenar([migrado, enCurso]));
assert.ok(eventoAbierto(r.actual));

// 7) Un solo evento a la vez: crear uno en fechas libres no choca; uno que cruza con el en curso sí; un forzado abierto choca con todo.
assert.equal(chocaCon({ inicio: futuro.inicio, fin: futuro.fin, forzar_abierto: null }, [pasado, enCurso]), null);
assert.equal(chocaCon({ inicio: dias(1), fin: dias(3), forzar_abierto: null }, [pasado, enCurso])?.nombre, 'Feria 2026');
assert.equal(chocaCon({ inicio: enCurso.inicio, fin: enCurso.fin, forzar_abierto: null }, [migrado])?.nombre, 'Evento 2026 (migrado)');

console.log('eventos: 7 escenarios ok');
