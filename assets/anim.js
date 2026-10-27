/* Tiamisia — animaciones del sitio (GSAP 3.12 + ScrollTrigger).
   Intro de textos y revelados al hacer scroll. La nave 3D está en nave3d.js.
   ?t=N congela la intro en el segundo N (revisión visual). ?reduce=1 fuerza movimiento reducido. */
(() => {
  const root = document.documentElement;
  const nav = document.querySelector('.nav');
  const onScroll = () => nav.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  if (!window.gsap || !root.classList.contains('anim')) { root.classList.remove('anim'); return; }
  gsap.registerPlugin(ScrollTrigger);
  const $ = (s, c = document) => [...c.querySelectorAll(s)];

  // Título en palabras, cada una dentro de una máscara
  const h1 = document.querySelector('.hero h1');
  const wrapWords = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType !== 3) { wrapWords(n); return; }
      const frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach((t) => {
        if (!t) return;
        if (/^\s+$/.test(t)) { frag.append(t); return; }
        const w = document.createElement('span'); w.className = 'w';
        const i = document.createElement('span'); i.className = 'wi'; i.textContent = t;
        w.append(i); frag.append(w);
      });
      n.replaceWith(frag);
    });
  };
  wrapWords(h1);
  gsap.set(h1, { visibility: 'visible' });

  // Textos del hero (la nave 3D lleva su propia secuencia en nave3d.js)
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  tl.fromTo('.hero .eyebrow', { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.5 }, 0.15)
    .from('.hero .wi', { yPercent: 105, duration: 0.8, stagger: 0.045, ease: 'power4.out' }, 0.2)
    .fromTo('.hero .lead', { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.7 }, 0.75)
    .fromTo('.hero .cta', { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.7 }, 0.95)
    .fromTo('.facts > div', { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.08 }, 1.4);

  // Seek harness para capturas
  const t = new URLSearchParams(location.search).get('t');
  if (t !== null) { tl.pause(); tl.seek(parseFloat(t)); }

  // Revelados al hacer scroll; en listas, cada elemento entra escalonado
  const groups = { '.cards': 'article', '.vals': 'li', '.contact': 'li' };
  $('[data-r]').forEach((el) => {
    const childSel = Object.entries(groups).find(([k]) => el.matches(k))?.[1];
    const targets = childSel ? $(':scope > ' + childSel, el) : [el];
    gsap.set(el, { visibility: 'visible' });
    gsap.fromTo(targets, { autoAlpha: 0, y: 22 }, {
      autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.08, ease: 'power3.out',
      scrollTrigger: {
        trigger: el, start: 'top 88%', once: true,
        onEnter: () => [el, ...targets].forEach((x) => x.classList.add('in')),
      },
    });
  });

  // Proceso: la línea de avance sigue al scroll y enciende cada paso
  const steps = $('.steps li');
  if (matchMedia('(max-width: 900px)').matches) {
    steps.forEach((li) => li.classList.add('on'));
  } else {
    gsap.to('.track .fill', {
      scaleX: 1, ease: 'none',
      scrollTrigger: {
        trigger: '#proceso', start: 'top 65%', end: 'bottom 70%', scrub: 0.6,
        onUpdate: (st) => steps.forEach((li, i) => li.classList.toggle('on', st.progress >= i / steps.length)),
      },
    });
  }

  window.__ready = true;
})();
