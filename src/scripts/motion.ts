/**
 * Sistema de movimiento de GEMPRO.
 * GSAP + ScrollTrigger + SplitText para las entradas, Lenis para el desplazamiento suave.
 *
 * Contrato por atributos (los componentes solo marcan el HTML):
 *   data-reveal="up|left|right|zoom|fade"   aparece al entrar en pantalla (data-delay="0.2" opcional)
 *   data-reveal-group                        sus hijos directos aparecen en cascada
 *   data-split                               titular que entra línea por línea con máscara
 *   data-count="60" data-prefix="+" data-suffix=""   contador numérico
 *   data-parallax="12"                       desplazamiento vertical sutil ligado al scroll (en %)
 *   data-draw                                <path> SVG que se dibuja solo
 *   data-nav                                 cabecera: se oculta al bajar y reaparece al subir
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText);

let lenis: Lenis | null = null;
let ctx: gsap.Context | null = null;
let tickerFn: ((time: number) => void) | null = null;

const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function setupLenis() {
  if (lenis || prefersReduced()) return;
  lenis = new Lenis({ lerp: 0.11, smoothWheel: true, wheelMultiplier: 0.95 });
  lenis.on('scroll', ScrollTrigger.update);
  tickerFn = (time) => lenis?.raf(time * 1000);
  gsap.ticker.add(tickerFn);
  gsap.ticker.lagSmoothing(0);
}

function teardownLenis() {
  if (tickerFn) gsap.ticker.remove(tickerFn);
  tickerFn = null;
  lenis?.destroy();
  lenis = null;
}

/** Desplazamiento a anclas internas con Lenis (o nativo si no hay Lenis). */
function anchorLinks() {
  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"], a[href^="/#"]').forEach((a) => {
    a.addEventListener('click', (ev) => {
      const href = a.getAttribute('href') || '';
      const id = href.replace(/^\/?#/, '');
      if (!id) return;
      const target = document.getElementById(id);
      if (!target) return; // deja que el navegador navegue a otra página
      ev.preventDefault();
      const offset = -72;
      if (lenis) lenis.scrollTo(target, { offset, duration: 1.2 });
      else target.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth' });
      history.pushState(null, '', `#${id}`);
    });
  });
}

function reveals() {
  gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
    const dir = el.dataset.reveal || 'up';
    const from: gsap.TweenVars = {
      opacity: 0,
      y: dir === 'up' ? 40 : 0,
      x: dir === 'left' ? -48 : dir === 'right' ? 48 : 0,
      scale: dir === 'zoom' ? 0.94 : 1,
    };
    gsap.fromTo(el, from, {
      opacity: 1, x: 0, y: 0, scale: 1,
      duration: 1.05,
      ease: 'power3.out',
      delay: Number(el.dataset.delay || 0),
      clearProps: 'transform',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });

  gsap.utils.toArray<HTMLElement>('[data-reveal-group]').forEach((group) => {
    const items = Array.from(group.children) as HTMLElement[];
    if (!items.length) return;
    gsap.fromTo(items, { opacity: 0, y: 44 }, {
      opacity: 1, y: 0,
      duration: 0.95,
      ease: 'power3.out',
      stagger: Number(group.dataset.stagger || 0.1),
      clearProps: 'transform',
      scrollTrigger: { trigger: group, start: 'top 86%', once: true },
    });
  });
}

function splitHeadlines() {
  gsap.utils.toArray<HTMLElement>('[data-split]').forEach((el) => {
    // aria: 'none' evita que SplitText añada aria-label a <span> (atributo prohibido en elementos genéricos).
    const split = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'split-line', autoSplit: true, aria: 'none' });
    el.style.visibility = 'visible';
    gsap.from(split.lines, {
      yPercent: 115,
      duration: 1.15,
      ease: 'power4.out',
      stagger: 0.09,
      delay: Number(el.dataset.delay || 0),
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });
}

function counters() {
  gsap.utils.toArray<HTMLElement>('[data-count]').forEach((el) => {
    const target = parseFloat(el.dataset.count || '0');
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const state = { v: 0 };
    el.textContent = `${prefix}0${suffix}`;
    gsap.to(state, {
      v: target,
      duration: 1.0,
      ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 85%', once: true },
      onUpdate: () => { el.textContent = `${prefix}${Math.round(state.v)}${suffix}`; },
    });
  });
}

function parallax() {
  gsap.utils.toArray<HTMLElement>('[data-parallax]').forEach((el) => {
    const amount = Number(el.dataset.parallax || 12);
    const scroller = el.closest<HTMLElement>('[data-parallax-scope]') || el.parentElement || el;
    gsap.fromTo(el, { yPercent: -amount / 2 }, {
      yPercent: amount / 2,
      ease: 'none',
      scrollTrigger: { trigger: scroller, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });
}

function drawPaths() {
  gsap.utils.toArray<SVGPathElement>('path[data-draw]').forEach((path) => {
    const length = path.getTotalLength();
    gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
    gsap.to(path, {
      strokeDashoffset: 0,
      duration: Number(path.dataset.draw || 2.4),
      ease: 'power2.inOut',
      scrollTrigger: { trigger: path, start: 'top 95%', once: true },
    });
  });
}

function navBehaviour() {
  const nav = document.querySelector<HTMLElement>('[data-nav]');
  if (!nav) return;
  ScrollTrigger.create({
    start: 'top -60',
    end: 'max',
    onUpdate: (self) => {
      nav.classList.toggle('is-scrolled', self.scroll() > 60);
      nav.classList.toggle('is-hidden', self.direction === 1 && self.scroll() > 320);
    },
  });
  // Barra de progreso de lectura
  const bar = document.querySelector<HTMLElement>('[data-progress]');
  if (bar) {
    gsap.to(bar, { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });
  }
}

/** Botones que se inclinan hacia el cursor (solo con puntero fino). */
function magnetic() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
    const strength = Number(el.dataset.magnetic || 0.35);
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) * strength;
      const y = (e.clientY - (r.top + r.height / 2)) * strength;
      gsap.to(el, { x, y, duration: 0.5, ease: 'power3.out' });
    };
    const leave = () => gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.45)' });
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
  });
}

function init() {
  const root = document.documentElement;
  const run = () => {
    setupLenis();
    ctx = gsap.context(() => {
      if (!prefersReduced()) {
        splitHeadlines();
        reveals();
        counters();
        parallax();
        drawPaths();
        magnetic();
      } else {
        document.querySelectorAll<HTMLElement>('[data-split]').forEach((el) => { el.style.visibility = 'visible'; });
        document.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
          el.textContent = `${el.dataset.prefix || ''}${el.dataset.count || ''}${el.dataset.suffix || ''}`;
        });
      }
      navBehaviour();
    });
    anchorLinks();
    root.classList.add('motion-ready');
    ScrollTrigger.refresh();
  };
  // Las líneas del titular dependen de la fuente ya cargada.
  if (document.fonts?.ready) document.fonts.ready.then(run, run);
  else run();
}

function destroy() {
  ctx?.revert();
  ctx = null;
  ScrollTrigger.getAll().forEach((t) => t.kill());
  teardownLenis();
  document.documentElement.classList.remove('motion-ready');
}

// Astro View Transitions: reinicia en cada página.
document.addEventListener('astro:page-load', init);
document.addEventListener('astro:before-swap', destroy);
window.addEventListener('resize', () => ScrollTrigger.refresh());
