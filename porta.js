/* ═══════════════════════════════════════════════════════════════
   A PORTA — o motor da página.

   Uma página só serve todas as edições. Quem escolhe a edição é a URL:
     /?ed=004        → abre a porta da edição 004
     /?ed=004&c=1    → já veio capturado (ManyChat): pula o formulário
     /?ed=004&j=cadu → veio pelo jornaleiro "cadu": o código vai no checkout

   Edição nova = uma entrada no edicoes.json + rodar o converter.sh.
   Este arquivo não muda.
   ═══════════════════════════════════════════════════════════════ */

(() => {
'use strict';

const $ = s => document.querySelector(s);
const url = new URLSearchParams(location.search);

const CHAVE_LEAD = 'eter_lead';
const CHAVE_ZOOM = 'eter_zoom';
const posicaoChave = ed => `eter_pos_${ed}`;

/* onde a oferta interrompe a leitura (índice da página) */
const INTERVALO_EM = 6;
/* quanto o texto cresce ao aproximar: leva os 10px de uma A4 no celular para ~17px */
const ZOOM = 1.65;

let DADOS, EDICAO, PASSE, CFG, TOTAL = 0;
/* De onde vêm as imagens. Vazio = da mesma pasta do site. Com endereço = de um
   CDN — o site fica leve em qualquer hospedagem e as páginas pesadas moram fora. */
let BASE = '';
let paginaAtual = 1, maximaLida = 0;

/* ── telemetria ────────────────────────────────────────────────
   Cada evento vai para o console (para você conferir), para o dataLayer
   (GTM/GA4) e para o Pixel, se existir. Sem dependência externa. */
function evento(nome, dados = {}) {
  const carga = { evento: nome, edicao: EDICAO?.n, jornaleiro: url.get('j') || null, ...dados };
  console.log('[porta]', nome, carga);
  (window.dataLayer = window.dataLayer || []).push(carga);
  if (window.fbq) {
    const padrao = EVENTO_META[nome];
    if (padrao) fbq('track', padrao, { content_name: `ED${carga.edicao}` });
    else fbq('trackCustom', nome, carga);
  }
  if (window.gtag) gtag('event', nome, carga);
  fila.push({ ...carga, t: Date.now() });
}

/* Os eventos saem em lote quando a aba fecha ou vai para segundo plano.
   É a única forma de registrar até onde a pessoa leu antes de sair — e a
   profundidade de leitura é o sinal de intenção mais forte que a página mede.
   Nunca vai dado pessoal aqui: só o que aconteceu, e a edição. */
const fila = [];
function despachar() {
  if (!fila.length || !CFG?.webhookEventos) return;
  const lote = fila.splice(0);
  try {
    navigator.sendBeacon(CFG.webhookEventos, new Blob(
      [JSON.stringify({ edicao: EDICAO?.n, maxima: maximaLida, eventos: lote })],
      { type: 'application/json' }
    ));
  } catch { /* nunca atrapalhar a leitura por causa de telemetria */ }
}
addEventListener('pagehide', despachar);
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') despachar(); });

/* ── o lead: guardado no aparelho para não pedir duas vezes ───── */
const leadSalvo = () => { try { return JSON.parse(localStorage.getItem(CHAVE_LEAD)); } catch { return null; } };
const jaCapturado = () => url.get('c') === '1' || !!leadSalvo();

/* ── o link do checkout, com o rastro de onde a pessoa veio ─────
   Dos campos de rastreio que a Guru aceita (ref, sck, src, subid, trk, utm_*),
   SÓ src, sck e os utm_* voltam no webhook. Por isso a edição vai em `src` e
   a origem + o jornaleiro vão em `sck`. Nada de subid/ref/trk: some no caminho.

   E nada de nome ou telefone na URL: dado pessoal não anda em query string. */

/* qualquer utm_* que chegar na URL da porta atravessa inteiro — crie quantas
   campanhas quiser por edição, a página não filtra nada */
function utmsDaUrl() {
  const u = {};
  for (const [k, v] of url) if (k.startsWith('utm_') && v) u[k] = v;
  return u;
}

function linkCheckout(origem) {
  const base = CFG.checkoutPasse;
  const j = url.get('j');
  const p = new URLSearchParams({
    src: `ed${EDICAO.n}`,
    sck: j ? `${origem}-${j}` : origem,
    utm_source: 'porta',
    utm_medium: origem,
    utm_campaign: `ed${EDICAO.n}`,
    ...utmsDaUrl(),
  });
  return base + (base.includes('?') ? '&' : '?') + p;
}

/* Todo caminho para o checkout passa por aqui. Se a pessoa ainda não é lead,
   ela vira lead ANTES de ir pagar — senão quem abandona o checkout some, e é
   justamente esse o público de recuperação. */
function irParaCheckout(origem) {
  evento('clicou_passe', { origem, pagina: paginaAtual, profundidade: pct() });

  if (CFG.capturaAntesDoCheckout !== false && !jaCapturado()) {
    pedirDados(`checkout-${origem}`, () => seguirParaCheckout(origem));
    return;
  }
  seguirParaCheckout(origem);
}

function seguirParaCheckout(origem) {
  const destino = linkCheckout(origem);
  evento('foi_ao_checkout', { origem });
  despachar();   /* garante a telemetria antes de sair da página */
  if (CFG.checkoutPasse.includes('SEU-CHECKOUT')) {
    alert('Checkout ainda não configurado.\n\nColoque o link do Guru em edicoes.json → config.checkoutPasse\n\nIria para:\n' + destino);
    return;
  }
  location.href = destino;
}

const pct = () => TOTAL ? Math.round((maximaLida / TOTAL) * 100) : 0;

/* ═══ ARRANQUE ═════════════════════════════════════════════════ */
async function iniciar() {
  DADOS = await (await fetch('edicoes.json?v=202608211056')).json();
  CFG = DADOS.config;
  PASSE = DADOS.passe;

  BASE = CFG.baseImagens || '';
  EDICAO = DADOS.edicoes.find(e => e.n === url.get('ed')) || DADOS.edicoes[0];
  TOTAL = EDICAO.paginas;

  document.title = `${EDICAO.titulo} · Revista ETER`;
  ligarPixel();
  montarCapa();
  montarPasse();
  montarIndiceDeEdicoes();
  ligarBotoes();

  evento('viu_porta', { titulo: EDICAO.titulo, capturado: jaCapturado() });
}

/* ── Pixel da Meta e GA4 ───────────────────────────────────────
   É daqui que saem os públicos de remarketing. Sem isto, você só consegue
   falar com quem deixou o WhatsApp; com isto, você também alcança quem leu
   trinta páginas e foi embora sem deixar nada.

   Os eventos-padrão que a Meta reconhece são disparados nos momentos certos:
   ViewContent ao abrir a leitura, Lead ao capturar, InitiateCheckout ao ir pagar. */
function ligarPixel() {
  if (CFG.pixelMeta) {
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', CFG.pixelMeta);
    fbq('track', 'PageView');
  }

  if (CFG.ga4) {
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${CFG.ga4}`;
    document.head.appendChild(s);
    window.gtag = function () { dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', CFG.ga4);
  }
}

/* traduz os eventos da casa para o vocabulário que a Meta entende */
const EVENTO_META = {
  abriu_leitura: 'ViewContent',
  virou_lead: 'Lead',
  foi_ao_checkout: 'InitiateCheckout',
};

/* ═══ TELA 1 · A CAPA ══════════════════════════════════════════ */
function montarCapa() {
  const img = $('#capa-img');
  img.src = `${BASE}edicoes/${EDICAO.n}/capa.webp`;
  img.alt = `Capa da edição ${EDICAO.n} — ${EDICAO.titulo}`;
  img.onerror = () => { img.style.visibility = 'hidden'; };

  $('#edicao-n').textContent = `Edição ${EDICAO.n}`;
  $('#edicao-titulo').textContent = EDICAO.titulo;
  $('#edicao-sub').textContent = EDICAO.subtitulo;

  const partes = [];
  if (EDICAO.capitulos) partes.push(`${EDICAO.capitulos.length} capítulos`);
  if (TOTAL) partes.push(`${TOTAL} páginas`);
  $('#edicao-ficha').textContent = TOTAL ? partes.join(' · ') : 'páginas ainda não convertidas';

  $('#btn-ler').disabled = !TOTAL;
  if (!TOTAL) {
    $('#btn-ler').textContent = 'Edição ainda não publicada';
    $('.rodape-btn').textContent = 'Rode o converter.sh para esta edição.';
  }
}

function montarPasse() {
  $('#passe-rot').textContent = PASSE.rotulo;
  $('#passe-itens').innerHTML = PASSE.itens.map(([t, g]) => `<li><b>${t}</b>${g}</li>`).join('');
  $('#passe-preco').textContent = CFG.precoPasse;
  $('#passe-cond').textContent = PASSE.condicao;
  $('#passe-credito').textContent = PASSE.credito;
  $('#barra-txt').innerHTML = `Gostou? <b>O passe abre o acervo inteiro</b> e os encontros de quarta — ${CFG.precoPasse}.`;
}

function montarIndiceDeEdicoes() {
  $('#indice-lista').innerHTML = DADOS.edicoes.map(e => `
    <li><a href="?ed=${e.n}">
      <span class="num">${e.n}</span>
      <span class="tit">${e.titulo}${e.paginas ? '' : ' <em style="opacity:.45;font-size:.8em">(em breve)</em>'}</span>
    </a></li>`).join('');
}

/* ═══ TELA 2 · A LEITURA ═══════════════════════════════════════ */
let leitorMontado = false;

function abrirLeitura() {
  $('#tela-capa').hidden = true;
  $('#tela-leitura').hidden = false;
  $('#progresso').hidden = false;
  $('#leitor-tit').textContent = EDICAO.titulo;
  document.body.classList.add('lendo');
  scrollTo(0, 0);

  if (!leitorMontado) { montarLeitor(); leitorMontado = true; }
  oferecerRetomada();
  evento('abriu_leitura');
}

function voltarCapa() {
  $('#tela-leitura').hidden = true;
  $('#progresso').hidden = true;
  $('#tela-capa').hidden = false;
  document.body.classList.remove('lendo');
  scrollTo(0, 0);
}

function montarLeitor() {
  const caixa = $('#paginas');
  atualizarContador(1);

  const frag = document.createDocumentFragment();

  for (let i = 1; i <= TOTAL; i++) {
    const base = `${BASE}edicoes/${EDICAO.n}/paginas/p${String(i).padStart(3, '0')}`;
    const img = document.createElement('img');
    img.className = 'pagina';
    img.dataset.pagina = i;
    img.alt = `Página ${i} de ${TOTAL}`;
    img.width = 1400; img.height = 1979;

    /* ATENÇÃO à ordem: loading e decoding vêm ANTES do src. Se o src vier
       primeiro, o navegador começa a baixar na hora e a edição inteira desce
       de uma vez — megabytes em vez dos 90 KB da primeira página. */
    img.loading = i <= 2 ? 'eager' : 'lazy';
    img.decoding = 'async';
    if (i === 1) img.fetchPriority = 'high';

    img.sizes = '(min-width: 52rem) 44rem, 100vw';
    img.srcset = `${base}@800.webp 800w, ${base}@1400.webp 1400w`;
    img.src = `${base}@800.webp`;

    /* cada página mora numa folha própria: é a folha que rola de lado
       quando a pessoa aproxima, sem atrapalhar a rolagem da leitura */
    const folha = document.createElement('div');
    folha.className = 'folha';
    folha.dataset.pagina = i;
    const dentro = document.createElement('div');
    dentro.className = 'folha-in';
    dentro.appendChild(img);
    folha.appendChild(dentro);
    frag.appendChild(folha);

    if (i === INTERVALO_EM) frag.appendChild(blocoIntervalo());
  }

  frag.appendChild(blocoFinal());
  caixa.appendChild(frag);

  montarPortao();
  montarCapitulos();
  observarProfundidade();
  controlarBarra();
  ligarZoom();
  ligarTeclado();

  /* o zoom que a pessoa escolheu da última vez volta sozinho */
  const salvo = parseFloat(localStorage.getItem(CHAVE_ZOOM));
  if (salvo > 1.02) aplicarZoom(salvo, 'memoria');
  else if (!localStorage.getItem(CHAVE_ZOOM)) mostrarDica();
}

/* ── os blocos de oferta que interrompem a leitura ───────────── */
function blocoIntervalo() {
  const d = document.createElement('div');
  d.className = 'intervalo';
  d.innerHTML = `
    <p class="rot">Uma pausa de dez segundos</p>
    <h3>Esta é uma de dez edições</h3>
    <p class="corpo">Toda quarta nasce uma revista nova, e todas as anteriores continuam abertas para quem tem o passe. Você pode seguir lendo esta aqui de graça.</p>
    <button class="btn btn-passe" data-passe="intervalo">Ver o passe — ${CFG.precoPasse}</button>`;
  return d;
}

function blocoFinal() {
  const d = document.createElement('div');
  d.className = 'intervalo';
  d.innerHTML = `
    <p class="rot">Você chegou ao fim</p>
    <h3>A próxima sai quarta</h3>
    <p class="corpo">Esta edição você leu inteira, sem pagar nada. O passe abre as próximas quatro, os encontros ao vivo e todo o acervo.</p>
    <section class="passe">
      <p class="passe-rot">${PASSE.rotulo}</p>
      <ul class="passe-itens">${PASSE.itens.map(([t, g]) => `<li><b>${t}</b>${g}</li>`).join('')}</ul>
      <p class="passe-preco"><b>${CFG.precoPasse}</b> <span>${PASSE.condicao}</span></p>
      <button class="btn btn-passe" data-passe="fim">Comprar o passe</button>
      <p class="passe-credito">${PASSE.credito}</p>
    </section>`;
  return d;
}

/* ── índice de capítulos: orienta e deixa saltar ─────────────── */
function montarCapitulos() {
  const caps = EDICAO.capitulos;
  if (!caps?.length) { $('#btn-capitulos').hidden = true; return; }

  $('#capitulos-lista').innerHTML = caps.map(([nome, pag], i) => `
    <li><a href="#" data-pagina="${pag}">
      <span class="num">${String(i + 1).padStart(2, '0')}</span>
      <span class="tit">${nome}</span>
      <span class="pag">${pag}</span>
    </a></li>`).join('');

  $('#capitulos-lista').addEventListener('click', e => {
    const a = e.target.closest('a[data-pagina]');
    if (!a) return;
    e.preventDefault();
    $('#capitulos-dialog').close();
    irParaPagina(+a.dataset.pagina);
    evento('saltou_capitulo', { pagina: +a.dataset.pagina });
  });
}

function irParaPagina(n) {
  const alvo = document.querySelector(`.folha[data-pagina="${n}"]`);
  if (alvo) alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── retomar de onde parou ─────────────────────────────────────
   Ninguém lê 50 páginas de uma sentada. Sem isto, quem volta cai na
   página 1 e desiste — e o abandono parece falta de interesse. */
function oferecerRetomada() {
  const salvo = +localStorage.getItem(posicaoChave(EDICAO.n)) || 0;
  if (salvo < 4) return;

  const caixa = $('#retomar');
  $('#retomar-txt').textContent = `Você parou na página ${salvo} de ${TOTAL}.`;
  caixa.hidden = false;

  $('#btn-retomar').onclick = () => {
    caixa.hidden = true;
    irParaPagina(salvo);
    evento('retomou', { pagina: salvo });
  };
  $('#btn-recomecar').onclick = () => {
    caixa.hidden = true;
    evento('recomecou');
  };
}

/* ── profundidade de leitura: o sinal de compra mais forte ───── */
function observarProfundidade() {
  const marcos = new Set([25, 50, 75, 100]);
  let guardando;

  const obs = new IntersectionObserver(entradas => {
    for (const e of entradas) {
      if (!e.isIntersecting) continue;
      const p = +e.target.dataset.pagina;
      atualizarContador(p);
      carregarVizinhas(p);

      if (p <= maximaLida) continue;
      maximaLida = p;
      $('#progresso i').style.width = pct() + '%';

      clearTimeout(guardando);
      guardando = setTimeout(() => localStorage.setItem(posicaoChave(EDICAO.n), maximaLida), 700);

      for (const m of [...marcos]) {
        if (pct() >= m) { marcos.delete(m); evento('leu_ate', { porcento: m, pagina: p }); }
      }
    }
  }, { rootMargin: '-45% 0px -45% 0px' });

  document.querySelectorAll('.pagina').forEach(el => obs.observe(el));
}

function atualizarContador(p) {
  paginaAtual = p;
  let txt = `${p} / ${TOTAL}`;
  /* o tempo restante só entra depois de um quarto lido: aí ele puxa
     para a frente. Mostrado de cara, o número grande só assusta. */
  if (EDICAO.minutos && p / TOTAL > 0.25) {
    const faltam = Math.max(1, Math.round(EDICAO.minutos * (1 - p / TOTAL)));
    txt += ` · ${faltam} min`;
  }
  $('#contador').textContent = txt;
}

/* deixa as próximas páginas prontas antes de a pessoa chegar nelas */
function carregarVizinhas(p) {
  for (let i = p + 1; i <= Math.min(p + 3, TOTAL); i++) {
    const im = document.querySelector(`.pagina[data-pagina="${i}"]`);
    if (im && im.loading === 'lazy') im.loading = 'eager';
  }
}

/* ── a barra recolhe ao descer e volta assim que a pessoa para ── */
function controlarBarra() {
  const barra = $('#barra');
  let ultimo = scrollY, parado;

  addEventListener('scroll', () => {
    const y = scrollY;
    barra.classList.toggle('oculta', y > ultimo + 8 && y > 400);
    ultimo = y;
    clearTimeout(parado);
    parado = setTimeout(() => barra.classList.remove('oculta'), 900);
  }, { passive: true });
}

/* ── o zoom é do leitor ───────────────────────────────────────
   Contínuo e manual: pinça na tela, roda (ou pinça do trackpad) no desktop,
   e os botões − / + no topo. O toque na página continua sendo o atalho
   rápido: alterna entre o tamanho natural e o último zoom usado.
   O nível escolhido vale para a edição inteira e fica lembrado. */
let fator = 1;
let ultimoFator = 1.65;
let guardandoZoom;

function aplicarZoom(novo, origem) {
  fator = Math.min(3, Math.max(1, novo));
  if (fator > 1.02) ultimoFator = fator;

  document.querySelectorAll('.folha-in').forEach(el => { el.style.width = (fator * 100) + '%'; });
  $('#btn-lupa')?.classList.toggle('ativo', fator > 1.02);

  /* nitidez: o navegador escolhe o arquivo pelo atributo sizes — ele precisa
     saber que a página agora ocupa mais que a tela, senão estica o pequeno */
  const larguraReal = Math.round(Math.min(innerWidth, 704) * fator);
  document.querySelectorAll('.pagina').forEach(im => { im.sizes = larguraReal + 'px'; });

  clearTimeout(guardandoZoom);
  guardandoZoom = setTimeout(() => {
    localStorage.setItem(CHAVE_ZOOM, String(fator.toFixed(2)));
    evento('ajustou_zoom', { fator: +fator.toFixed(2), origem, pagina: paginaAtual });
  }, 600);
}

function ligarZoom() {
  const caixa = $('#paginas');

  /* toque: atalho entre 100% e o último zoom */
  caixa.addEventListener('click', e => {
    if (e.target.closest('.intervalo')) return;   /* os botões da oferta são clicáveis */
    if (!e.target.closest('.folha')) return;
    aplicarZoom(fator > 1.02 ? 1 : ultimoFator, 'toque');
    if (fator > 1.02) setTimeout(centralizarFolhas, 280);
  });

  /* botões − / + e a lupa como alternância */
  $('#btn-mais').addEventListener('click', () => aplicarZoom(fator + 0.25, 'botao'));
  $('#btn-menos').addEventListener('click', () => aplicarZoom(fator - 0.25, 'botao'));
  $('#btn-lupa').addEventListener('click', () => aplicarZoom(fator > 1.02 ? 1 : ultimoFator, 'lupa'));

  /* pinça no celular: dois dedos sobre a revista ajustam à vontade */
  let d0 = 0, f0 = 1;
  const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  caixa.addEventListener('touchstart', e => {
    if (e.touches.length === 2) { d0 = dist(e.touches); f0 = fator; }
  }, { passive: true });
  caixa.addEventListener('touchmove', e => {
    if (e.touches.length !== 2 || !d0) return;
    e.preventDefault();   /* senão o navegador dá zoom na página inteira, barra junto */
    aplicarZoom(f0 * (dist(e.touches) / d0), 'pinca');
  }, { passive: false });
  caixa.addEventListener('touchend', () => { d0 = 0; }, { passive: true });

  /* desktop: pinça do trackpad ou Ctrl+roda (o gesto padrão de zoom) */
  addEventListener('wheel', e => {
    if (!e.ctrlKey || $('#tela-leitura').hidden) return;
    e.preventDefault();
    aplicarZoom(fator * (1 - e.deltaY * 0.01), 'roda');
  }, { passive: false });
}

function centralizarFolhas() {
  document.querySelectorAll('.folha').forEach(f => {
    f.scrollLeft = (f.scrollWidth - f.clientWidth) / 2;
  });
}

function mostrarDica() {
  const d = document.createElement('div');
  d.className = 'dica';
  d.textContent = 'Pinça ajusta o zoom · toque aproxima';
  document.body.appendChild(d);
  setTimeout(() => d.classList.add('some'), 4000);
  setTimeout(() => d.remove(), 4800);
  localStorage.setItem(CHAVE_ZOOM, '1');
}

/* ── teclado: no desktop, ler de revista se faz com as setas ─── */
function ligarTeclado() {
  addEventListener('keydown', e => {
    if ($('#tela-leitura').hidden) return;
    if (document.querySelector('dialog[open]')) return;

    const passo = { ArrowRight: 1, PageDown: 1, ArrowLeft: -1, PageUp: -1 };
    if (e.key === ' ') { e.preventDefault(); irParaPagina(Math.min(paginaAtual + 1, TOTAL)); }
    else if (e.key in passo) { e.preventDefault(); irParaPagina(Math.min(Math.max(paginaAtual + passo[e.key], 1), TOTAL)); }
    else if (e.key === 'Home') { e.preventDefault(); irParaPagina(1); }
    else if (e.key === 'End') { e.preventDefault(); irParaPagina(TOTAL); }
    else if (e.key === 'Escape') voltarCapa();
  });
}

/* ═══ CAPTURA ══════════════════════════════════════════════════
   Duas decisões independentes, ambas no edicoes.json:

   ONDE  (config.gateNaPagina) — 0 pede o dado antes de abrir a revista;
         N libera até a página N e só então cobra. A evidência publicada
         favorece o N: abrir o conteúdo AUMENTA a chance de assinar, e
         mostrar só o começo REDUZ o clique em assinar.

   COMO  (config.modoCaptura) — 'whatsapp' manda a pessoa iniciar a conversa,
         o que abre a janela de 24 horas e deixa toda mensagem sua sair de
         graça. 'formulario' pega os dados na página, mas NÃO abre janela
         nenhuma: depois disso cada mensagem sua é um template pago. */

function comecarLeitura() {
  const portao = +CFG.gateNaPagina || 0;
  /* com portão adiante, a revista abre livre e a cobrança vem no meio */
  if (portao > 0 || jaCapturado()) { abrirLeitura(); return; }
  pedirDados('capa');
}

/* o que fazer depois que a pessoa entregar os dados */
let aoTerminar = null;

const COPY_FORM = {
  leitura: ['Falta um passo', 'Para onde mandamos a edição?',
    'A leitura abre na hora, aqui mesmo. O WhatsApp é para você receber a próxima quarta.'],
  portao: ['Continua', 'Para onde mandamos o resto?',
    'As páginas abrem na hora. O WhatsApp é para você receber a próxima quarta.'],
  checkout: ['Antes de pagar', 'Para onde mandamos o seu acesso?',
    'Confirmando aqui, o passe cai no seu WhatsApp assim que o pagamento entrar — e você não perde o acesso se algo falhar no caminho.'],
};

function pedirDados(onde, depois = null) {
  if (jaCapturado()) { depois?.(); return true; }
  aoTerminar = depois;

  if (CFG.modoCaptura === 'whatsapp') {
    evento('foi_para_whatsapp', { onde });
    open(`https://wa.me/${CFG.whatsappNumero}?text=${encodeURIComponent(`ED${EDICAO.n}`)}`, '_blank', 'noopener');
    return false;
  }

  const chave = onde.startsWith('checkout') ? 'checkout' : (onde === 'portao' ? 'portao' : 'leitura');
  const [rot, titulo, dek] = COPY_FORM[chave];
  $('.form-rot').textContent = rot;
  $('#form-lead h2').textContent = titulo;
  $('.form-dek').textContent = dek;
  $('#btn-enviar').textContent = chave === 'checkout' ? 'Continuar para o pagamento' : 'Abrir a edição';

  const dlg = $('#form-dialog');
  dlg.dataset.onde = onde;
  dlg.showModal();
  evento('viu_formulario', { onde });
  return false;
}

/* ── o portão no meio da leitura ─────────────────────────────── */
function montarPortao() {
  const n = +CFG.gateNaPagina || 0;
  if (!n || jaCapturado()) return;

  document.querySelectorAll('.folha').forEach(f => {
    if (+f.dataset.pagina > n) f.classList.add('trancada');
  });

  const d = document.createElement('div');
  d.className = 'intervalo portao';
  d.id = 'portao';
  d.innerHTML = `
    <p class="rot">Continua</p>
    <h3>O resto da edição é seu</h3>
    <p class="corpo">Você leu ${n} páginas. Faltam ${TOTAL - n}, e elas abrem agora — só precisamos saber para onde mandar a próxima quarta.</p>
    <button class="btn btn-ler" id="btn-abrir-portao">Liberar o resto da edição</button>`;

  const alvo = document.querySelector(`.folha[data-pagina="${n}"]`);
  alvo.after(d);
  d.querySelector('#btn-abrir-portao').addEventListener('click', () => pedirDados('portao'));
}

function abrirPortao() {
  document.querySelectorAll('.folha.trancada').forEach(f => f.classList.remove('trancada'));
  $('#portao')?.remove();
}

const soDigitos = s => s.replace(/\D/g, '');

function mascaraTelefone(e) {
  const d = soDigitos(e.target.value).slice(0, 11);
  e.target.value = d.length <= 2 ? d
    : d.length <= 7 ? `(${d.slice(0, 2)}) ${d.slice(2)}`
    : `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

async function enviarLead(e) {
  e.preventDefault();
  const erro = $('#form-erro');
  const falhar = msg => { erro.textContent = msg; erro.hidden = false; };

  const nome = $('#f-nome').value.trim();
  const zap = soDigitos($('#f-zap').value);
  if (nome.length < 2) return falhar('Escreva seu nome.');
  if (zap.length < 10 || zap.length > 11) return falhar('O WhatsApp precisa ter DDD e 8 ou 9 dígitos.');

  const lead = {
    nome, whatsapp: '55' + zap,
    edicao: EDICAO.n,
    onde: $('#form-dialog').dataset.onde || 'capa',
    jornaleiro: url.get('j') || null,
    utm_source: '', utm_medium: '', utm_campaign: '',
    ...utmsDaUrl(),
    pagina: paginaAtual,
    referrer: document.referrer || '',
    em: new Date().toISOString(),
  };

  const botao = $('#btn-enviar');
  botao.disabled = true;
  botao.textContent = 'Abrindo…';

  if (CFG.webhookLead) {
    try {
      /* text/plain de propósito: com application/json o navegador manda antes
         uma verificação (preflight) que o Apps Script do Google não responde,
         e o lead se perde. Em text/plain a requisição vai direto, e o Apps
         Script lê o corpo do mesmo jeito. */
      await fetch(CFG.webhookLead, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(lead),
        keepalive: true,
      });
    } catch (err) {
      /* o lead não pode travar a leitura: se o destino cair, ela abre igual */
      console.warn('[porta] webhook falhou, seguindo assim mesmo', err);
    }
  }

  localStorage.setItem(CHAVE_LEAD, JSON.stringify(lead));
  evento('virou_lead', { onde: $('#form-dialog').dataset.onde || 'capa' });
  $('#form-dialog').close();
  botao.disabled = false;

  /* quem veio do botão de compra segue para o pagamento; o resto vai ler */
  if (aoTerminar) { const f = aoTerminar; aoTerminar = null; f(); return; }
  if ($('#tela-leitura').hidden) abrirLeitura();
  else abrirPortao();
}

/* ═══ LIGAÇÕES ═════════════════════════════════════════════════ */
function ligarBotoes() {
  $('#btn-ler').addEventListener('click', comecarLeitura);
  $('#btn-voltar').addEventListener('click', voltarCapa);
  $('#btn-passe-capa').addEventListener('click', () => irParaCheckout('capa'));
  $('#btn-passe-barra').addEventListener('click', () => irParaCheckout('barra'));
  $('#btn-fechar').addEventListener('click', () => {
    evento('desistiu_do_formulario', { onde: $('#form-dialog').dataset.onde });
    aoTerminar = null;
    $('#form-dialog').close();
  });
  $('#btn-fechar-indice').addEventListener('click', () => $('#indice-dialog').close());
  $('#btn-fechar-cap').addEventListener('click', () => $('#capitulos-dialog').close());
  $('#form-lead').addEventListener('submit', enviarLead);
  $('#f-zap').addEventListener('input', mascaraTelefone);

  $('#btn-capitulos').addEventListener('click', () => {
    $('#capitulos-dialog').showModal();
    evento('abriu_capitulos', { pagina: paginaAtual });
  });

  $('#link-outras').addEventListener('click', e => { e.preventDefault(); $('#indice-dialog').showModal(); });

  /* os botões de oferta nascidos dentro da leitura */
  $('#tela-leitura').addEventListener('click', e => {
    const b = e.target.closest('[data-passe]');
    if (b) irParaCheckout(b.dataset.passe);
  });

  /* página dupla, só faz sentido em tela larga */
  const btnModo = $('#btn-modo');
  if (matchMedia('(min-width: 64rem)').matches) {
    btnModo.hidden = false;
    btnModo.addEventListener('click', () => {
      const duplo = $('#paginas').classList.toggle('duplo');
      btnModo.classList.toggle('ativo', duplo);
      evento('trocou_modo', { modo: duplo ? 'duplo' : 'unico' });
    });
  }
}

iniciar().catch(err => {
  console.error(err);
  document.body.innerHTML = '<p style="padding:2rem;font-family:sans-serif">Não consegui carregar o catálogo. Rode a página por um servidor local — ver o LEIA.md.</p>';
});

})();
