/* ═══════════════════════════════════════════════════════════════
   A PORTA PREMIUM — o motor.
   Mesmo funil, mesmas regras de rastreio. O que muda é a forma:
   cerimônia na chegada, física de papel na leitura, selo na oferta.
   ═══════════════════════════════════════════════════════════════ */

(() => {
'use strict';

const $ = s => document.querySelector(s);
const url = new URLSearchParams(location.search);

const CHAVE_LEAD = 'eter_lead';
const CHAVE_ZOOM = 'eter_zoom';
const posChave = ed => `eter_pos_${ed}`;

let DADOS, EDICAO, PASSE, CFG, BASE = '', TOTAL = 0;
let paginaAtual = 1, maximaLida = 0, capAtual = -1;
let fator = 1, ultimoFator = 1.6;
const fila = [];

/* ── telemetria (idêntica à porta original: nada se perde) ────── */
const EVENTO_META = { abriu_leitura: 'ViewContent', virou_lead: 'Lead', foi_ao_checkout: 'InitiateCheckout' };

function evento(nome, dados = {}) {
  const carga = { evento: nome, edicao: EDICAO?.n, jornaleiro: url.get('j') || null, ...dados };
  console.log('[porta]', nome, carga);
  (window.dataLayer = window.dataLayer || []).push(carga);
  if (window.fbq) {
    const p = EVENTO_META[nome];
    p ? fbq('track', p, { content_name: `ED${carga.edicao}` }) : fbq('trackCustom', nome, carga);
  }
  if (window.gtag) gtag('event', nome, carga);
  fila.push({ ...carga, t: Date.now() });
}

function despachar() {
  if (!fila.length || !CFG?.webhookEventos) return;
  const lote = fila.splice(0);
  try {
    navigator.sendBeacon(CFG.webhookEventos, new Blob(
      [JSON.stringify({ edicao: EDICAO?.n, maxima: maximaLida, eventos: lote })], { type: 'application/json' }));
  } catch {}
}
addEventListener('pagehide', despachar);
addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && despachar());

/* ── lead e checkout ──────────────────────────────────────────── */
const leadSalvo = () => { try { return JSON.parse(localStorage.getItem(CHAVE_LEAD)); } catch { return null; } };
const jaCapturado = () => url.get('c') === '1' || !!leadSalvo();

function utmsDaUrl() {
  const u = {};
  for (const [k, v] of url) if (k.startsWith('utm_') && v) u[k] = v;
  return u;
}

function linkCheckout(origem) {
  const base = CFG.checkoutPasse, j = url.get('j');
  const p = new URLSearchParams({
    src: `ed${EDICAO.n}`,
    sck: j ? `${origem}-${j}` : origem,
    utm_source: 'porta', utm_medium: origem, utm_campaign: `ed${EDICAO.n}`,
    ...utmsDaUrl(),
  });
  return base + (base.includes('?') ? '&' : '?') + p;
}

function irParaCheckout(origem) {
  evento('clicou_passe', { origem, pagina: paginaAtual, profundidade: pct() });
  if (CFG.capturaAntesDoCheckout !== false && !jaCapturado()) {
    pedirDados(`checkout-${origem}`, () => seguir(origem));
    return;
  }
  seguir(origem);
}

function seguir(origem) {
  const destino = linkCheckout(origem);
  evento('foi_ao_checkout', { origem });
  despachar();
  if (CFG.checkoutPasse.includes('SEU-CHECKOUT')) {
    alert('Checkout não configurado.\n\nIria para:\n' + destino); return;
  }
  location.href = destino;
}

const pct = () => TOTAL ? Math.round((maximaLida / TOTAL) * 100) : 0;

/* ═══ ARRANQUE ═════════════════════════════════════════════════ */
async function iniciar() {
  DADOS = await (await fetch('../edicoes.json')).json();
  CFG = DADOS.config; PASSE = DADOS.passe;
  BASE = CFG.baseImagens || '../';

  EDICAO = DADOS.edicoes.find(e => e.n === url.get('ed')) || DADOS.edicoes.find(e => e.paginas) || DADOS.edicoes[0];
  TOTAL = EDICAO.paginas;

  document.title = `${EDICAO.titulo} · ETER`;
  ligarPixel();
  montarChegada();
  ligarLeque();
  ligar();
  evento('viu_porta', { titulo: EDICAO.titulo, capturado: jaCapturado() });
}

function ligarPixel() {
  if (CFG.pixelMeta) {
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', CFG.pixelMeta); fbq('track', 'PageView');
  }
  if (CFG.ga4) {
    const s = document.createElement('script');
    s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${CFG.ga4}`;
    document.head.appendChild(s);
    window.gtag = function () { dataLayer.push(arguments); };
    gtag('js', new Date()); gtag('config', CFG.ga4);
  }
}

/* ═══ TELA 1 · A CHEGADA ═══════════════════════════════════════ */
function montarChegada() {
  const capa = $('#capa');
  capa.src = `${BASE}edicoes/${EDICAO.n}/capa.webp`;
  capa.alt = `Capa da edição ${EDICAO.n} — ${EDICAO.titulo}`;
  capa.onerror = () => capa.style.visibility = 'hidden';

  /* o leque: as aberturas de capítulo espiam atrás da capa e dão curiosidade */
  const caps = EDICAO.capitulos || [];
  const espiar = [caps[1]?.[1], caps[2]?.[1], caps[3]?.[1]].filter(Boolean).slice(0, 3);
  espiar.forEach((p, i) => {
    const im = $(`#espia${i + 1}`);
    im.src = `${BASE}edicoes/${EDICAO.n}/paginas/p${String(p).padStart(3, '0')}@800.webp`;
  });
  if (!espiar.length) $('#folhear').hidden = true;

  $('#numero').textContent = `Edição N° ${EDICAO.n}`;

  /* a última palavra do título vira caligrafia, como nas capas da revista */
  const partes = EDICAO.titulo.split(' ');
  const fecho = partes.pop();
  $('#titulo').innerHTML = partes.length ? `${partes.join(' ')}<em>${fecho}</em>` : fecho;

  /* a promessa é o "Nesta Edição" da própria revista, verbatim */
  $('#promessa').textContent = EDICAO.nestaEdicao || EDICAO.subtitulo;
  if (EDICAO.convite) {
    $('#convite-frase').textContent = EDICAO.convite;
    $('#convite-frase').hidden = false;
  }

  const f = [];
  if (caps.length) f.push(`<b>${caps.length}</b> capítulos`);
  if (TOTAL) f.push(`<b>${TOTAL}</b> páginas`);
  if (EDICAO.minutos) f.push(`<b>${EDICAO.minutos}</b> min`);
  $('#ficha').innerHTML = f.map(t => `<span>${t}</span>`).join('');

  $('#passe-rot').textContent = PASSE.rotulo.replace('Passe ETER · ', 'Passe · ');
  $('#passe-preco').textContent = CFG.precoPasse;
  $('#passe-itens').innerHTML = PASSE.itens.map(([t, g]) => `<li><b>${t}</b>${g}</li>`).join('');
  $('#passe-nota').textContent = PASSE.condicao + ' ' + PASSE.credito;
  $('#barra-txt').innerHTML = `O passe abre <b>todo o acervo</b> — ${CFG.precoPasse}`;

  if (!TOTAL) {
    $('#btn-ler').disabled = true;
    $('#btn-ler').firstChild.textContent = 'Em breve';
    $('#sub-ler').textContent = 'esta edição ainda não foi publicada';
  }

  $('#acervo').innerHTML = DADOS.edicoes.map(e => `
    <li><a href="?ed=${e.n}">
      <span class="alg">${e.n}</span>
      <span class="nom">${e.titulo}</span>
      <span class="pg">${e.paginas ? e.paginas + ' pág' : 'em breve'}</span>
    </a></li>`).join('');
}

/* ── o leque de páginas: espiar dentro sem sair da capa ───────── */
function ligarLeque() {
  const pilha = $('#pilha'), bt = $('#folhear'), txt = $('#folhear-txt');
  const alternar = () => {
    const aberto = pilha.classList.toggle('aberta');
    txt.textContent = aberto ? 'Fechar' : 'Espiar por dentro';
    if (aberto) evento('espiou_dentro');
  };
  bt.addEventListener('click', alternar);
  pilha.addEventListener('click', alternar);
}

/* ═══ TELA 2 · A LEITURA ═══════════════════════════════════════ */
let montado = false;

function abrirLeitura() {
  $('#chegada').style.display = 'none';
  $('#leitura').classList.add('aberta');
  document.body.classList.add('lendo');
  document.querySelector('meta[name=theme-color]').content = '#181009';
  $('#cromo-tit').textContent = EDICAO.titulo;
  scrollTo(0, 0);

  if (!montado) { montarLeitor(); montado = true; }

  const salvo = +localStorage.getItem(posChave(EDICAO.n)) || 0;
  if (salvo > 3) setTimeout(() => irPara(salvo), 350);

  evento('abriu_leitura');
}

function voltar() {
  $('#leitura').classList.remove('aberta');
  $('#chegada').style.display = '';
  document.body.classList.remove('lendo');
  document.querySelector('meta[name=theme-color]').content = '#E7E1D4';
  scrollTo(0, 0);
}

function montarLeitor() {
  const caixa = $('#paginas');
  const frag = document.createDocumentFragment();
  const caps = EDICAO.capitulos || [];

  /* a régua: um segmento por capítulo, larguras proporcionais */
  $('#regua').innerHTML = (caps.length ? caps : [['', 1]])
    .map((c, i) => {
      const ini = c[1] || 1;
      const fim = caps[i + 1] ? caps[i + 1][1] : TOTAL + 1;
      return `<i style="flex:${fim - ini}" data-cap="${i}"></i>`;
    }).join('');

  for (let i = 1; i <= TOTAL; i++) {
    const b = `${BASE}edicoes/${EDICAO.n}/paginas/p${String(i).padStart(3, '0')}`;
    const img = document.createElement('img');
    img.className = 'pag';
    img.dataset.pagina = i;
    img.alt = `Página ${i}`;
    img.width = 1400; img.height = 1979;

    /* loading antes do src: sem isso a edição inteira desce de uma vez */
    img.loading = i <= 2 ? 'eager' : 'lazy';
    img.decoding = 'async';
    if (i === 1) img.fetchPriority = 'high';
    img.sizes = '(min-width: 56rem) 46rem, 100vw';
    img.srcset = `${b}@800.webp 800w, ${b}@1400.webp 1400w`;
    img.src = `${b}@800.webp`;
    img.addEventListener('load', () => img.classList.add('carregada'), { once: true });

    const folha = document.createElement('div');
    folha.className = 'folha-p';
    folha.dataset.pagina = i;
    const dentro = document.createElement('div');
    dentro.className = 'folha-in';
    dentro.appendChild(img);
    folha.appendChild(dentro);
    frag.appendChild(folha);

    /* o convite do meio cai numa fronteira de capítulo, nunca no meio da ideia */
    if (caps.length > 2 && i === (caps[2]?.[1] || 0) - 1) frag.appendChild(blocoMeio());
  }

  frag.appendChild(blocoFim());
  caixa.appendChild(frag);

  montarSumario();
  observar();
  controlarCromo();
  ligarZoom();

  const z = parseFloat(localStorage.getItem(CHAVE_ZOOM));
  if (z > 1.02) aplicarZoom(z, 'memoria');
}

function blocoMeio() {
  const d = document.createElement('div');
  d.className = 'intervalo papel';
  d.innerHTML = `
    <img class="mono" src="monograma.webp" alt="" width="256" height="256">
    <p class="rot">Um intervalo</p>
    <h3 class="relevo">Toda quarta nasce uma <em>nova</em></h3>
    <p>Esta você lê inteira, de graça. O passe abre as próximas quatro, os encontros ao vivo e o acervo completo — e você segue lendo esta aqui do mesmo jeito.</p>
    <button class="btn btn-passe" data-passe="intervalo">Adquirir passe — ${CFG.precoPasse}</button>`;
  return d;
}

function blocoFim() {
  const d = document.createElement('div');
  d.className = 'intervalo papel';
  d.innerHTML = `
    <img class="mono" src="monograma.webp" alt="" width="256" height="256">
    <p class="rot">Contracapa</p>
    <h3 class="relevo">A próxima sai <em>quarta</em></h3>
    <p>Você acabou de ler ${TOTAL} páginas de uma revista de ${CFG.precoCheio} por ano, sem pagar nada. O que muda do lado de dentro é a continuidade.</p>
    <section class="passe">
      <div class="passe-topo">
        <span class="passe-rot">${PASSE.rotulo.replace('Passe ETER · ', 'Passe · ')}</span>
        <span class="passe-preco">${CFG.precoPasse}</span>
      </div>
      <ul class="passe-itens">${PASSE.itens.map(([t, g]) => `<li><b>${t}</b>${g}</li>`).join('')}</ul>
      <button class="btn btn-passe" data-passe="fim">Adquirir passe</button>
      <p class="passe-nota">${PASSE.condicao} ${PASSE.credito}</p>
    </section>`;
  return d;
}

function montarSumario() {
  const caps = EDICAO.capitulos;
  if (!caps?.length) { $('#btn-sumario').hidden = true; return; }
  $('#sum-tit').textContent = EDICAO.titulo;
  $('#sum-leg').textContent = `Edição N° ${EDICAO.n} · ${TOTAL} páginas`;
  $('#caps').innerHTML = caps.map(([nome, pag], i) => `
    <li><a href="#" data-pagina="${pag}" data-cap="${i}">
      <span class="alg">${String(i + 1).padStart(2, '0')}</span>
      <span class="nom">${nome}</span>
      <span class="pg">${pag}</span>
    </a></li>`).join('');

  $('#caps').addEventListener('click', e => {
    const a = e.target.closest('a[data-pagina]');
    if (!a) return;
    e.preventDefault();
    $('#sumario-dialog').close();
    irPara(+a.dataset.pagina);
    evento('saltou_capitulo', { pagina: +a.dataset.pagina });
  });
}

const irPara = n => document.querySelector(`.folha-p[data-pagina="${n}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

/* ── profundidade, régua e o selo de capítulo ─────────────────── */
function observar() {
  const caps = EDICAO.capitulos || [];
  const marcos = new Set([25, 50, 75, 100]);
  let guardando;

  const obs = new IntersectionObserver(es => {
    for (const e of es) {
      if (!e.isIntersecting) continue;
      const p = +e.target.dataset.pagina;
      paginaAtual = p;
      $('#pagina-n').textContent = `${p}/${TOTAL}`;

      /* a régua: preenche o segmento do capítulo corrente */
      const iCap = caps.findLastIndex(c => p >= c[1]);
      $('#regua').querySelectorAll('i').forEach((seg, i) => {
        const ini = caps[i]?.[1] || 1;
        const fim = caps[i + 1]?.[1] || TOTAL + 1;
        seg.style.setProperty('--f', i < iCap ? 1 : i === iCap ? Math.min(1, (p - ini + 1) / (fim - ini)) : 0);
      });

      /* entrou num capítulo novo: a cerimônia de duas linhas */
      if (iCap >= 0 && iCap !== capAtual) {
        capAtual = iCap;
        mostrarSelo(iCap, caps[iCap][0]);
        $('#caps')?.querySelectorAll('a').forEach(a => a.classList.toggle('atual', +a.dataset.cap === iCap));
      }

      /* pré-carrega as próximas: a página nunca chega em branco */
      for (let i = p + 1; i <= Math.min(p + 3, TOTAL); i++) {
        const im = document.querySelector(`.pag[data-pagina="${i}"]`);
        if (im && im.loading === 'lazy') im.loading = 'eager';
      }

      if (p <= maximaLida) continue;
      maximaLida = p;
      clearTimeout(guardando);
      guardando = setTimeout(() => localStorage.setItem(posChave(EDICAO.n), maximaLida), 700);
      for (const m of [...marcos]) if (pct() >= m) { marcos.delete(m); evento('leu_ate', { porcento: m, pagina: p }); }
    }
  }, { rootMargin: '-45% 0px -45% 0px' });

  document.querySelectorAll('.pag').forEach(el => obs.observe(el));
}

let seloTimer;
function mostrarSelo(i, nome) {
  const s = $('#selo-cap');
  $('#selo-alg').textContent = ['I','II','III','IV','V','VI','VII','VIII','IX','X'][i] || (i + 1);
  $('#selo-nom').textContent = nome;
  s.classList.add('ver');
  clearTimeout(seloTimer);
  seloTimer = setTimeout(() => s.classList.remove('ver'), 1700);
}

/* ── o cromo some enquanto se lê e volta ao parar ─────────────── */
function controlarCromo() {
  const cromo = $('#cromo'), barra = $('#barra');
  let ultimo = scrollY, parado;

  addEventListener('scroll', () => {
    const y = scrollY, descendo = y > ultimo + 6 && y > 300;
    cromo.classList.toggle('oculto', descendo);
    barra.classList.toggle('oculta', descendo);
    ultimo = y;
    clearTimeout(parado);
    parado = setTimeout(() => {
      cromo.classList.remove('oculto');
      barra.classList.remove('oculta');
    }, 800);
  }, { passive: true });
}

/* ── o zoom ───────────────────────────────────────────────────
   O que estava ruim: um toque na página alternava o zoom, então rolar
   com o dedo disparava zoom sem querer. Agora o toque simples não faz
   nada; quem manda é a PINÇA (o gesto que todo mundo já conhece), o
   DUPLO TOQUE (que aproxima na coluna onde o dedo está) e a lupa. */
function aplicarZoom(novo, origem, ancoraX) {
  const antes = fator;
  fator = Math.min(3, Math.max(1, novo));
  if (fator > 1.02) ultimoFator = fator;

  document.querySelectorAll('.folha-in').forEach(el => el.style.width = (fator * 100) + '%');
  const larg = Math.round(Math.min(innerWidth, 736) * fator);
  document.querySelectorAll('.pag').forEach(im => im.sizes = larg + 'px');
  $('#btn-zoom').classList.toggle('ativo', fator > 1.02);

  /* mantém sob o dedo o ponto que estava sob o dedo */
  requestAnimationFrame(() => {
    document.querySelectorAll('.folha-p').forEach(f => {
      const max = f.scrollWidth - f.clientWidth;
      if (max <= 0) { f.scrollLeft = 0; return; }
      f.scrollLeft = ancoraX != null
        ? Math.max(0, Math.min(max, (f.scrollLeft + ancoraX) * (fator / antes) - ancoraX))
        : max / 2;
    });
  });

  clearTimeout(aplicarZoom.t);
  aplicarZoom.t = setTimeout(() => {
    localStorage.setItem(CHAVE_ZOOM, fator.toFixed(2));
    evento('ajustou_zoom', { fator: +fator.toFixed(2), origem, pagina: paginaAtual });
  }, 600);
}

function ligarZoom() {
  const caixa = $('#paginas');

  /* a lupa alterna entre a página inteira e o último zoom usado */
  $('#btn-zoom').addEventListener('click', () => aplicarZoom(fator > 1.02 ? 1 : ultimoFator, 'lupa'));

  /* duplo toque: aproxima onde o dedo tocou, como num mapa */
  let ultimoToque = 0, ultimoX = 0;
  caixa.addEventListener('pointerup', e => {
    if (e.target.closest('.intervalo') || !e.target.closest('.folha-p')) return;
    const agora = Date.now();
    if (agora - ultimoToque < 320 && Math.abs(e.clientX - ultimoX) < 40) {
      e.preventDefault();
      aplicarZoom(fator > 1.02 ? 1 : ultimoFator, 'duplo-toque', e.clientX);
      ultimoToque = 0;
    } else { ultimoToque = agora; ultimoX = e.clientX; }
  });

  /* pinça: o gesto natural, com âncora no meio dos dois dedos */
  let d0 = 0, f0 = 1, cx = 0;
  const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  caixa.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      d0 = dist(e.touches); f0 = fator;
      cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    }
  }, { passive: true });
  caixa.addEventListener('touchmove', e => {
    if (e.touches.length !== 2 || !d0) return;
    e.preventDefault();
    aplicarZoom(f0 * (dist(e.touches) / d0), 'pinca', cx);
  }, { passive: false });
  caixa.addEventListener('touchend', () => d0 = 0, { passive: true });

  /* desktop: pinça do trackpad ou Ctrl+roda */
  addEventListener('wheel', e => {
    if (!e.ctrlKey || !$('#leitura').classList.contains('aberta')) return;
    e.preventDefault();
    aplicarZoom(fator * (1 - e.deltaY * 0.012), 'roda', e.clientX);
  }, { passive: false });

  addEventListener('keydown', e => {
    if (!$('#leitura').classList.contains('aberta') || document.querySelector('dialog[open]')) return;
    const passo = { ArrowRight: 1, PageDown: 1, ArrowLeft: -1, PageUp: -1 };
    if (e.key === ' ') { e.preventDefault(); irPara(Math.min(paginaAtual + 1, TOTAL)); }
    else if (e.key in passo) { e.preventDefault(); irPara(Math.min(Math.max(paginaAtual + passo[e.key], 1), TOTAL)); }
    else if (e.key === 'Home') { e.preventDefault(); irPara(1); }
    else if (e.key === 'End') { e.preventDefault(); irPara(TOTAL); }
    else if (e.key === '+' || e.key === '=') aplicarZoom(fator + 0.25, 'teclado');
    else if (e.key === '-') aplicarZoom(fator - 0.25, 'teclado');
    else if (e.key === 'Escape') voltar();
  });
}

/* ═══ CAPTURA ══════════════════════════════════════════════════ */
let aoTerminar = null;

const COPY = {
  leitura: ['Para onde mandamos a edição?', 'A leitura abre na hora, aqui mesmo. O WhatsApp é para você receber a próxima quarta.', 'Abrir a edição'],
  checkout: ['Para onde mandamos seu acesso?', 'Confirmando aqui, o passe cai no seu WhatsApp assim que o pagamento entrar.', 'Continuar para o pagamento'],
};

function pedirDados(onde, depois = null) {
  if (jaCapturado()) { depois?.(); return true; }
  aoTerminar = depois;
  const [tit, dek, bt] = COPY[onde.startsWith('checkout') ? 'checkout' : 'leitura'];
  $('#form-tit').textContent = tit;
  $('#form-dek').textContent = dek;
  $('#btn-enviar').textContent = bt;
  $('#form-dialog').dataset.onde = onde;
  $('#form-dialog').showModal();
  setTimeout(() => $('#f-nome').focus(), 120);
  evento('viu_formulario', { onde });
  return false;
}

const soDigitos = s => s.replace(/\D/g, '');

function mascara(e) {
  const d = soDigitos(e.target.value).slice(0, 11);
  e.target.value = d.length <= 2 ? d
    : d.length <= 7 ? `(${d.slice(0, 2)}) ${d.slice(2)}`
    : `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  $('#c-zap').classList.remove('erro');
}

async function enviar(e) {
  e.preventDefault();
  const nome = $('#f-nome').value.trim();
  const zap = soDigitos($('#f-zap').value);
  let falhou = false;

  $('#c-nome').classList.toggle('erro', nome.length < 2);
  $('#c-zap').classList.toggle('erro', zap.length < 10 || zap.length > 11);
  if (nome.length < 2) { $('#f-nome').focus(); falhou = true; }
  else if (zap.length < 10 || zap.length > 11) { $('#f-zap').focus(); falhou = true; }
  if (!$('#f-ok').checked) { $('#f-ok').focus(); falhou = true; }
  if (falhou) return;

  const lead = {
    nome, whatsapp: '55' + zap, edicao: EDICAO.n,
    onde: $('#form-dialog').dataset.onde || 'capa',
    jornaleiro: url.get('j') || null,
    utm_source: '', utm_medium: '', utm_campaign: '', ...utmsDaUrl(),
    pagina: paginaAtual, referrer: document.referrer || '', em: new Date().toISOString(),
  };

  const bt = $('#btn-enviar');
  bt.disabled = true; bt.textContent = 'Abrindo…';

  if (CFG.webhookLead) {
    try {
      await fetch(CFG.webhookLead, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(lead), keepalive: true,
      });
    } catch (err) { console.warn('[porta] webhook falhou, seguindo', err); }
  }

  localStorage.setItem(CHAVE_LEAD, JSON.stringify(lead));
  evento('virou_lead', { onde: lead.onde });
  $('#form-dialog').close();
  bt.disabled = false;

  if (aoTerminar) { const f = aoTerminar; aoTerminar = null; f(); return; }
  abrirLeitura();
}

/* ═══ LIGAÇÕES ═════════════════════════════════════════════════ */
function ligar() {
  $('#btn-ler').addEventListener('click', () => jaCapturado() ? abrirLeitura() : pedirDados('leitura'));
  $('#btn-voltar').addEventListener('click', voltar);
  $('#btn-sumario').addEventListener('click', () => { $('#sumario-dialog').showModal(); evento('abriu_sumario', { pagina: paginaAtual }); });
  $('#ver-edicoes').addEventListener('click', e => { e.preventDefault(); $('#acervo-dialog').showModal(); });
  $('#form').addEventListener('submit', enviar);
  $('#f-zap').addEventListener('input', mascara);
  $('#f-nome').addEventListener('input', () => $('#c-nome').classList.remove('erro'));

  document.querySelectorAll('[data-fecha]').forEach(b =>
    b.addEventListener('click', () => {
      if (b.dataset.fecha === 'form-dialog') { evento('desistiu_do_formulario', { onde: $('#form-dialog').dataset.onde }); aoTerminar = null; }
      $('#' + b.dataset.fecha).close();
    }));

  document.body.addEventListener('click', e => {
    const b = e.target.closest('[data-passe]');
    if (b) irParaCheckout(b.dataset.passe);
  });
}

iniciar().catch(err => {
  console.error(err);
  document.body.innerHTML = '<p style="padding:2rem;font-family:sans-serif">Não consegui carregar o catálogo.</p>';
});

})();
