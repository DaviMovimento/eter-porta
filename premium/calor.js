/* ═══ O SENSOR DO MAPA DE CALOR ════════════════════════════════
   Mede três coisas, e só três: onde a pessoa TOCA, até onde ela ROLA,
   e por quais degraus do funil ela passa. Os pontos viajam em lotes
   para o coletor da casa (calor.php) — nenhum terceiro no meio.
   Coordenadas em fração do documento, para o mapa desenhar por cima
   da página em qualquer largura de tela. */
(() => {
  const COLETOR = '/revista/calor.php';
  const q = k => new URLSearchParams(location.search).get(k) || '';

  /* a sessão: um carimbo por navegador, para costurar a jornada */
  let sid;
  try {
    sid = localStorage.getItem('eter_sid');
    if (!sid) { sid = Date.now().toString(36) + Math.random().toString(36).slice(2, 8); localStorage.setItem('eter_sid', sid); }
  } catch (e) { sid = 'anon'; }

  const base = () => ({
    s: sid, p: location.pathname, em: Date.now(),
    vw: innerWidth, cel: innerWidth < 960 ? 1 : 0,
    us: q('utm_source'), um: q('utm_medium'), uc: q('utm_campaign'), j: q('j'),
  });

  const fila = [];
  const marca = (tipo, dados) => { fila.push({ t: tipo, ...base(), ...dados }); if (fila.length >= 40) despacha(); };

  function despacha() {
    if (!fila.length) return;
    const corpo = JSON.stringify({ e: fila.splice(0, 50) });
    /* sendBeacon sobrevive à saída da página; fetch cobre o resto */
    if (!(navigator.sendBeacon && navigator.sendBeacon(COLETOR, new Blob([corpo], { type: 'text/plain' })))) {
      fetch(COLETOR, { method: 'POST', body: corpo, keepalive: true }).catch(() => {});
    }
  }

  /* 1. a vista da página */
  marca('vista', { ref: (document.referrer || '').slice(0, 120) });

  /* 2. os toques — posição em fração do DOCUMENTO, não da janela */
  addEventListener('click', ev => {
    const dw = document.documentElement.scrollWidth || 1;
    const dh = Math.max(document.documentElement.scrollHeight, 1);
    const alvo = ev.target.closest('a,button,[data-passe]');
    marca('toque', {
      x: +(((ev.pageX || 0) / dw).toFixed(4)),
      y: +(((ev.pageY || 0) / dh).toFixed(4)),
      dh,
      alvo: alvo ? (alvo.id || alvo.className || alvo.tagName).toString().slice(0, 40) : '',
      txt: alvo ? (alvo.textContent || '').trim().slice(0, 30) : '',
    });
  }, { capture: true, passive: true });

  /* 3. até onde rolou — o máximo, entregue na saída */
  let fundo = 0;
  addEventListener('scroll', () => {
    const dh = document.documentElement.scrollHeight - innerHeight;
    if (dh > 0) fundo = Math.max(fundo, Math.min(1, scrollY / dh));
  }, { passive: true });

  /* 4. os degraus do funil: tudo que o site empurra para o dataLayer
     (clicou_ler, virou_lead, abriu_oferta, foi_ao_checkout…) passa por
     aqui também — o rastro de ponta a ponta num arquivo só */
  window.dataLayer = window.dataLayer || [];
  const empurraOriginal = window.dataLayer.push.bind(window.dataLayer);
  window.dataLayer.push = (...itens) => {
    itens.forEach(i => { if (i && i.event) marca('funil', { ev: i.event, origem: i.origem || '', ed: i.edicao || '' }); });
    return empurraOriginal(...itens);
  };
  window.__calor = (nome, dados) => marca('funil', { ev: nome, ...((dados && { origem: dados.origem || '', ed: dados.edicao || '' }) || {}) });

  addEventListener('pagehide', () => { marca('rolou', { ate: +fundo.toFixed(3) }); despacha(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') despacha(); });
  setInterval(despacha, 6000);
})();
