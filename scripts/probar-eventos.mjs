/**
 * Comprobación de la lógica de eventos del panel (sin base de datos): un evento activo como mucho,
 * los programados esperan su fecha, lo cerrado (por horario o a mano) va al historial, y la regla
 * de un solo evento a la vez.
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

// 1) En curso + futuro + pasado: el QR registra en el activo; el futuro espera; el pasado es historial.
let r = clasificar(ordenar([pasado, enCurso, futuro]));
assert.equal(r.enCurso.nombre, 'Feria 2026');
assert.deepEqual(nombres(r.programados), ['Congreso noviembre']);
assert.deepEqual(nombres(r.anteriores), ['Feria 2025']);

// 2) Nada activo: el pasado NO vuelve a la tarjeta principal, va al historial; el futuro es el próximo.
r = clasificar(ordenar([pasado, futuro]));
assert.equal(r.enCurso, null);
assert.deepEqual(nombres(r.programados), ['Congreso noviembre']);
assert.deepEqual(nombres(r.anteriores), ['Feria 2025']);

// 3) Dos futuros: ordenados por fecha de apertura, no por fecha de creación.
r = clasificar(ordenar([pasado, futuroLejano, futuro]));
assert.deepEqual(nombres(r.programados), ['Congreso noviembre', 'Expo diciembre']);

// 4) "Cerrar ahora" = el cierre pasa al instante actual: el evento deja de estar abierto y cae en el historial.
const cerradoAMano = { ...enCurso, fin: new Date().toISOString() };
assert.equal(eventoAbierto(cerradoAMano), false);
r = clasificar(ordenar([cerradoAMano, futuro]));
assert.equal(r.enCurso, null);
assert.deepEqual(nombres(r.anteriores), ['Feria 2026']);

// 5) "Abrir ahora" = la apertura pasa al instante actual: el programado queda activo.
const abiertoAMano = { ...futuro, inicio: new Date(Date.now() - 1000).toISOString() };
assert.equal(clasificar(ordenar([pasado, abiertoAMano])).enCurso.nombre, 'Congreso noviembre');

// 6) Sin eventos.
assert.deepEqual(clasificar([]), { enCurso: null, programados: [], anteriores: [] });

// 7) Fila antigua forzada abierta manda aunque no tenga fechas.
assert.ok(eventoAbierto(clasificar(ordenar([migrado, pasado])).enCurso));

// 8) Un solo evento a la vez: fechas libres no chocan; cruzarse con el activo sí; un forzado abierto choca con todo.
assert.equal(chocaCon({ inicio: futuro.inicio, fin: futuro.fin, forzar_abierto: null }, [pasado, enCurso]), null);
assert.equal(chocaCon({ inicio: dias(1), fin: dias(3), forzar_abierto: null }, [pasado, enCurso])?.nombre, 'Feria 2026');
assert.equal(chocaCon({ inicio: enCurso.inicio, fin: enCurso.fin, forzar_abierto: null }, [migrado])?.nombre, 'Evento 2026 (migrado)');
// Abrir ahora un programado mientras hay uno activo también choca.
assert.equal(chocaCon({ id: 'c', inicio: new Date().toISOString(), fin: futuro.fin, forzar_abierto: null }, [enCurso, futuro])?.nombre, 'Feria 2026');

console.log('eventos: 8 escenarios ok');
