/* ═══════════════════════════════════════════════════════════════
   A PORTA PREMIUM — v3
   A revista fica espiável na própria chegada: o visor mostra a página,
   a faixa deixa deslizar por todas, e tocar numa delas leva à leitura
   NAQUELA página — passando pela captura só uma vez.
   ═══════════════════════════════════════════════════════════════ */

(() => {
'use strict';

/* Este arquivo é servido de dois lugares — /e/ e /e/premium/ — então o
   catálogo precisa ser achado a partir de onde o SCRIPT mora, não de onde a
   página está. currentScript só existe enquanto o arquivo avalia: por isso
   guardo agora, não depois. */
const ONDE_MORO = document.currentScript?.src || location.href;
/* A PASTA DOS ATIVOS DA CASA, em endereço absoluto. O código escolhia o
   prefixo perguntando se ONDE_MORO continha '/premium/' — e como ele é o
   src do PRÓPRIO script, que mora em premium/, a resposta era sempre sim
   e o caminho saía relativo à PÁGINA. Em /revista/007/ isso virava
   /revista/007/logo.webp: a logo e o mockup da caixa da oferta nunca
   apareceram em nenhuma página de edição. Derivar da URL do script
   acerta em todas as pastas de uma vez. */
const CASA = ONDE_MORO.replace(/[^/]*$/, '');

const $ = s => document.querySelector(s);

/* ═══ A COPY APROVADA ═════════════════════════════════════════
   Vem do dossiê de 23/08, fechado sobre 103 compradores e 1.472 leads.
   Está aqui, junta e nomeada pelo número do dossiê, porque copy aprovada
   espalhada pelo código é copy que ninguém acha para revisar. O que muda
   por edição continua vindo do catálogo; o que é da casa mora aqui. */
const COPY_CASA = {
  topo:      'A revista de quem vive das próprias ideias',           // 1.1
  apresenta: 'Inteligência cultural e repertório polímata para quem vive ou quer viver das próprias ideias.',
  apresentaSub:
    'A revista semanal e a comunidade que lê e traduz o futuro da nova economia ' +
    'em clareza, direção e ferramentas aplicáveis, para você se posicionar de ' +
    'forma única e monetizar o seu conteúdo autoral.',                // 1.2
  polimataTit: 'O que é um repertório polímata?',
  polimata: [
    'Polímata era como se chamavam os homens e as mulheres do Renascimento: ' +
    'pensadores, empreendedores e artistas que dominavam diferentes áreas do ' +
    'conhecimento para criar obras autorais.',
    'Na era da inteligência artificial, em que todos estudam os mesmos assuntos, ' +
    'usam as mesmas ferramentas e repetem os mesmos clichês, o ativo mais raro, ' +
    'e por isso o mais valioso, passou a ser a capacidade de articular áreas ' +
    'distintas do próprio repertório para criar e monetizar ideias, conteúdos e ' +
    'marcas autorais.',
  ],                                                                  // 1.3
  /* Os botões ficaram só com a linha principal. A segunda linha dividia a
     atenção no exato ponto em que a página pede UMA decisão — e o que ela
     dizia (minutos, "um mês de acesso") já está dito na oferta logo abaixo. */
  lerTit: 'LER ESTA EDIÇÃO INTEIRA, DE GRAÇA',
  lerSub: () => '',                                                    // 1.4
  /* O BOTÃO NÃO LEVA PREÇO EM LUGAR NENHUM. Dentro da oferta o número
     já está no alto do card, em verde, três linhas acima — repeti-lo no
     rótulo era ler o mesmo R$97 duas vezes na mesma caixa. Fora dela o
     botão ainda não explicou o que se compra. Uma aparição, no card. */
  passeTit: 'ADQUIRIR O PASSE',
  passeTitCurto: 'ADQUIRIR O PASSE',
  chamadaOferta: 'Você começa hoje pela edição que quiser, e o mês corre com a ETER inteira aberta.',
  passeSub: '',
  espiada: 'Complete seu cadastro para ler a edição completa',
  /* 1.5, com um ajuste: "tudo aberto" foi reprovado no botão, e deixar a
     expressão viva aqui faria a página dizer duas coisas sobre a mesma
     oferta. Vale "acesso total", que é a redação que ficou. */
  /* a contagem sai do catálogo: escrita à mão ela erra hoje (são OUTRAS
     sete, não oito) e volta a errar a cada edição publicada */
  portao: () => `As outras ${porExtenso(publicadas() - 1)} estão aqui, e uma nova chega toda semana.\n`
          + `Um mês de acesso total: ${CFG.precoPasse}, ${CFG.porEdicao || 'R$24'} por edição.`,  // 1.5
  trava: (data) => `Você já leu a sua edição deste mês.\nVolte em ${data}, ou abra tudo agora por R$97.`, // 1.6
  cadeadoTit: 'O resto da edição',
  cadeadoSub: 'complete seu cadastro · leitura gratuita',
};

/* O `·` não existe na Futura dos rótulos: onde o texto vira HTML, ele vira
   um ponto desenhado em CSS; onde é texto puro, vira travessão. */
const pontilhar = t => String(t).replace(/ · /g, ' <i class="pt"></i> ');
const url = new URLSearchParams(location.search);

/* A edição pode vir de dois lugares: do endereço bonito (/revista/007) ou
   do parâmetro (?ed=007). O caminho tem prioridade, porque é ele que a
   pessoa vê e compartilha. Os dois viram '007', que é como o catálogo
   nomeia as edições. */
(() => {
  const doCaminho = location.pathname.match(/\/(\d{1,3})\/?$/);
  const e = (doCaminho && doCaminho[1]) || url.get('ed');
  if (e && /^\d{1,3}$/.test(e)) url.set('ed', e.padStart(3, '0'));
})();

/* quantas edições estão publicadas de verdade — a contagem do acervo
   sai daqui, nunca escrita à mão no meio de uma frase */
const publicadas = () => DADOS.edicoes.filter(e => e.paginas).length;

const CHAVE_LEAD = 'eter_lead';
const posChave = ed => `eter_pos_${ed}`;

/* quem pediu menos movimento no sistema não pode levar rolagem animada
   nem ficar esperando uma animação que o CSS já desligou */
const semMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const rolar = (el, opcoes = {}) =>
  el?.scrollIntoView({ behavior: semMovimento() ? 'auto' : 'smooth', block: 'start', ...opcoes });

let DADOS, EDICAO, PASSE, CFG, BASE = '', TOTAL = 0;
/* a espiada vive num fecho; isto é a maçaneta que ela deixa de fora, para
   a animação automática poder virar a folha sem furar o encapsulamento */
let ESPIADA = null;
let paginaAtual = 1, maximaLida = 0, capAtual = -1;
const fila = [];

const pag = (n, tam) => pagDe(EDICAO.n, n, tam);
const pagDe = (ed, n, tam) => `${BASE}edicoes/${ed}/paginas/p${String(n).padStart(3, '0')}@${tam}.webp`;

/* ── telemetria ───────────────────────────────────────────────── */
const EVENTO_META = { abriu_leitura: 'ViewContent', virou_lead: 'Lead', foi_ao_checkout: 'InitiateCheckout' };

function evento(nome, dados = {}) {
  const carga = { evento: nome, edicao: EDICAO?.n, jornaleiro: url.get('j') || null, ...dados };
  console.log('[porta]', nome, carga);
  /* o GTM só enxerga a chave 'event'; mando as duas para não quebrar
     nada que já leia 'evento' */
  (window.dataLayer = window.dataLayer || []).push({ event: nome, ...carga });
  if (window.fbq) {
    const p = EVENTO_META[nome];
    p ? fbq('track', p, { content_name: `ED${carga.edicao}` }) : fbq('trackCustom', nome, carga);
  }
  if (window.gtag) gtag('event', nome, carga);
  /* sem webhook a fila nunca era drenada e crescia até a aba morrer */
  if (CFG?.webhookEventos) { fila.push({ ...carga, t: Date.now() }); if (fila.length > 400) fila.splice(0, 200); }
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

/* Capturado é quem entregou nome, e-mail E telefone. Um cadastro antigo,
   feito antes de o e-mail existir, não vale — senão essa pessoa nunca
   daria o e-mail. E ?reset=1 limpa tudo, para testar como visitante novo. */
/* ?reset=1 limpa UMA vez, ao carregar — não a cada consulta. Se apagasse
   sempre, o cadastro feito depois do reset nunca colaria e a pessoa levaria
   o popup na cara de novo. */
if (url.get('reset') === '1') {
  localStorage.removeItem(CHAVE_LEAD);
  /* tira o parâmetro da barra: senão cada recarga limpa de novo e o cadastro
     feito depois do reset nunca cola */
  const limpa = new URL(location.href); limpa.searchParams.delete('reset');
  history.replaceState(null, '', limpa);
}

/* Capturado é quem entregou nome, e-mail E telefone. Um cadastro antigo,
   feito antes de o e-mail existir, não vale — senão essa pessoa nunca
   daria o e-mail. */
const jaCapturado = () => {
  if (url.get('c') === '1') return true;
  const l = leadSalvo();
  return !!(l && l.nome && l.email && l.whatsapp);
};

function utmsDaUrl() {
  const u = {};
  for (const [k, v] of url) if (k.startsWith('utm_') && v) u[k] = v;
  return u;
}

function linkCheckout(origem) {
  const base = CFG.checkoutPasse, j = url.get('j');
  const p = new URLSearchParams({
    src: `ed${EDICAO.n}`, sck: j ? `${origem}-${j}` : origem,
    /* os UTMs da URL entram antes: a origem do botão é o dado mais preciso
       e não pode ser apagada pelo utm_medium que veio do anúncio */
    utm_source: 'porta', utm_campaign: `ed${EDICAO.n}`, ...utmsDaUrl(), utm_medium: origem,
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
  if (CFG.checkoutPasse.includes('SEU-CHECKOUT')) { alert('Checkout não configurado.\n\n' + destino); return; }
  location.href = destino;
}

const pct = () => TOTAL ? Math.round((maximaLida / TOTAL) * 100) : 0;

/* ═══ ARRANQUE ═════════════════════════════════════════════════ */
async function iniciar() {
  DADOS = await (await fetch(new URL('../edicoes.json?v=202608211117', ONDE_MORO))).json();
  CFG = DADOS.config; PASSE = DADOS.passe;
  BASE = CFG.baseImagens || '../';

  EDICAO = DADOS.edicoes.find(e => e.n === url.get('ed')) || DADOS.edicoes.find(e => e.paginas) || DADOS.edicoes[0];
  TOTAL = EDICAO.paginas;

  document.title = `${EDICAO.titulo} — ETER`;
  /* 1.1 — a assinatura da casa, ao lado do logo */
  saudacaoDeChegada();
  const marca = document.querySelector('.topo-marca');
  if (marca && !document.querySelector('.topo-tag')) {
    const tag = document.createElement('span');
    tag.className = 'topo-tag';
    /* a saudação da casa, com "Vanguarda" na cursiva da marca — a mesma
       Sloop que assina os títulos das capas. É o cumprimento do deck, dito
       na tipografia do deck. */
    tag.innerHTML = 'Bem-vindo à <em>Vanguarda</em>';
    marca.after(tag);
  }

  ligarPixel();
  tarjaDemo();
  aquecerPorteiro();
  calcularLimite();      /* antes do mosaico: ele também obedece ao cadeado */
  const ct = document.querySelector('.tranca-tit'), cs = document.querySelector('.tranca-sub');
  if (ct) ct.textContent = COPY_CASA.cadeadoTit;
  if (cs) cs.innerHTML = COPY_CASA.cadeadoSub.replace(' · ', ' <i class="pt"></i> ');

  montarChegada();
  montarEspiada();
  ligar();
  espiadaSozinha();
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
  const caps = EDICAO.capitulos || [];

  $('#numero').textContent = `Edição ${EDICAO.n}`;

  const partes = EDICAO.titulo.split(' ');
  const fecho = partes.pop();
  $('#titulo').innerHTML = partes.length ? `${partes.join(' ')} <em>${fecho}</em>` : fecho;

  $('#promessa').textContent = EDICAO.nestaEdicao || EDICAO.subtitulo;
  if (EDICAO.convite) { $('#convite-frase').textContent = EDICAO.convite; $('#convite-frase').hidden = false; }

  /* Aqui ficava a ficha técnica — capítulos, páginas, minutos. Contagem
     não é valor: ninguém compra uma revista porque ela tem 59 páginas, e
     dizer o tamanho antes de dizer a promessa mede o esforço em vez do
     ganho. No lugar entra o SUBTÍTULO, que é a promessa da edição em uma
     linha, logo abaixo do título — manchete e olho, como em revista. */
  const olho = $('#ficha');
  olho.className = 'dek-ed';
  olho.textContent = EDICAO.subtitulo || '';
  olho.hidden = !EDICAO.subtitulo;

  /* 1.4 — os dois botões, na redação aprovada. O `{minutos}` já existia no
     catálogo e nunca aparecia na tela: é a prova de esforço baixo mais
     barata que o sistema tem, e ela custava zero para ser dita. */
  const btLer = $('#btn-ler');
  btLer.firstChild.textContent = COPY_CASA.lerTit + ' ';
  $('#sub-ler').remove();
  document.querySelectorAll('[data-passe="capa"]').forEach(b => {
    b.textContent = COPY_CASA.passeTitCurto;
  });

  /* O mockup do deck entra ACIMA do preço, nas três aparições da oferta:
     é a coisa que mostra o que se compra antes de dizer quanto custa. */
  const caixaPasse = document.querySelector('.passe');
  if (caixaPasse && !caixaPasse.querySelector('.mock-passe')) {
    const f = document.createElement('figure');
    f.className = 'mock-passe';
    f.innerHTML = `<img src="${CASA}mockup-assinatura.webp?v=202608232149"
      alt="Tudo que você acessa: a revista, o acervo, os encontros ao vivo e a comunidade"
      width="794" height="485" decoding="async">`;
    /* FORA do card, ACIMA dele. Dentro, o mockup é preto sobre marrom
       escuro e some — os aparelhos são pretos e as capas são escuras.
       Sobre o papel bege ele tem o contraste que a peça precisa. */
    caixaPasse.before(f);
    f.querySelector('img').decode?.().catch(() => {});
  }

  $('#passe-rot').innerHTML = pontilhar(PASSE.rotulo.replace('Passe ETER · ', 'Passe · '));
  $('#passe-preco').textContent = CFG.precoPasse;
  $('#passe-itens').innerHTML = PASSE.itens.map(([t, g]) => `<li><b>${t}</b>${g}</li>`).join('');
  $('#passe-nota').textContent = [PASSE.condicao, PASSE.credito].filter(Boolean).join(' ');
  $('#barra-txt').innerHTML = `O passe abre <b>todo o acervo</b> — ${CFG.precoPasse}`;

  if (!TOTAL) {
    $('#btn-ler').disabled = true;
    $('#btn-ler').firstChild.textContent = 'Em breve';
    $('#sub-ler').textContent = 'esta edição ainda não foi publicada';
  }

  /* a capa de cada edição na lista: dá para escolher pelo que se vê,
     não por um número. E o link preserva utm e embaixador. */
  /* O link do acervo tem de trocar o CAMINHO, não o parâmetro: quem manda
     na edição é a pasta (/revista/007/), e mexer só no ?ed deixava a pessoa
     presa na mesma revista por mais que clicasse. A busca inteira viaja
     junto para não perder utm nem código de embaixador. */
  const comEdicao = n => {
    const u = new URL(`../${n}/`, location.href);
    u.search = location.search;
    u.searchParams.delete('ed');
    return u.pathname + u.search;
  };

  /* O ACERVO. Estava só da mais nova para a mais antiga, e quem chega
     querendo conhecer a revista quer começar do começo. Agora abre na
     ordem de leitura (001 → 008) e tem o botão que inverte — porque as
     duas ordens servem a duas pessoas diferentes: quem vai conhecer lê
     do início, quem já é de casa quer ver a última. E cada linha ganha o
     subtítulo, que é o que faz escolher: o número não diz nada. */
  let acervoCrescente = true;
  const pintarAcervo = () => {
    const eds = DADOS.edicoes.slice().sort((a, b) =>
      acervoCrescente ? a.n.localeCompare(b.n) : b.n.localeCompare(a.n));
    $('#acervo').innerHTML = eds.map(e => `
      <li><a href="${comEdicao(e.n)}" class="${e.n === EDICAO.n ? 'atual' : ''}">
        <span class="capinha">${e.paginas
          ? `<img src="${BASE}edicoes/${e.n}/paginas/p001@240.webp" alt="" loading="lazy" decoding="async" width="240" height="339">`
          : '<i class="embreve">em breve</i>'}</span>
        <span class="alg">${e.n}</span>
        <span class="nom">${e.titulo}</span>
        <span class="sub-ed">${e.subtitulo || ''}</span>
      </a></li>`).join('');
    const b = $('#ordem-acervo');
    if (b) b.textContent = acervoCrescente ? 'da mais antiga para a mais nova' : 'da mais nova para a mais antiga';
  };
  const cxAcervo = $('#acervo')?.parentElement;
  if (cxAcervo && !$('#ordem-acervo')) {
    const b = document.createElement('button');
    b.id = 'ordem-acervo'; b.className = 'ordem-acervo'; b.type = 'button';
    b.addEventListener('click', () => { acervoCrescente = !acervoCrescente; pintarAcervo(); });
    $('#acervo').before(b);
  }
  pintarAcervo();

  montarFundo();
  montarTempos();

}

/* ═══ A OFERTA, NUMA CAIXA ════════════════════════════════════
   O botão do topo mandava direto para o pagamento — pedia a compra antes
   de dizer o que era a compra. Agora ele abre a oferta inteira numa caixa:
   a promessa da casa, o que entra no passe, o preço, a revista em imagem,
   e só então o botão que leva ao checkout. É a mesma ordem da página, em
   um quadro só, para quem decidiu antes de rolar. */
function abrirOferta(origem) {
  let cx = $('#oferta-dialog');
  if (!cx) {
    cx = document.createElement('dialog');
    cx.id = 'oferta-dialog';
    cx.innerHTML = `
      <div class="painel oferta">
        <button type="button" class="fechar" data-fecha="oferta-dialog" aria-label="Fechar">×</button>
        <img class="marca-oferta" src="${CASA}logo.webp"
          alt="ETER" width="900" height="240">
        <figure class="mock-passe">
          <img src="${CASA}mockup-assinatura.webp?v=202608232149"
            alt="Tudo que você acessa ao assinar" width="794" height="485" decoding="async">
        </figure>
        <p class="oferta-chamada">${COPY_CASA.chamadaOferta}</p>
        <p class="oferta-rot">${pontilhar(PASSE.rotulo.replace('Passe ETER · ', 'Passe · '))}
          <b>${CFG.precoPasse}</b></p>
        <ul class="oferta-itens">
          ${PASSE.itens.map(([a, b]) => `<li><b>${a}</b>${b ? `<span>${b}</span>` : ''}</li>`).join('')}
        </ul>
        <button class="btn btn-passe" data-passe="oferta">${COPY_CASA.passeTit}</button>
        <p class="oferta-pe">${PASSE.condicao || ''}</p>
      </div>`;
    document.body.append(cx);
    cx.querySelector('[data-fecha]').addEventListener('click', () => cx.close());
    /* sem listener próprio aqui: o <dialog> é filho do body e o delegado
       de [data-passe] já apanha este clique — os dois juntos disparavam
       o checkout duas vezes e contavam a intenção em dobro */
    cx.addEventListener('click', ev => { if (ev.target === cx) cx.close(); });
    cx.querySelectorAll('img').forEach(i => i.decode?.().catch(() => {}));
  }
  cx.showModal();
  evento('abriu_oferta', { origem });
}

/* ═══ A ESPIADA QUE ANDA SOZINHA ══════════════════════════════
   Ninguém clica numa revista fechada: ela parece uma imagem. Dois segundos
   depois de a página abrir, ela vira sozinha para o sumário — que é o
   primeiro lugar onde a revista mostra que TEM coisa dentro — e daí em
   diante vira de três em três segundos, até bater no cadeado. Lá ela para,
   porque o cadeado é o argumento, não um obstáculo a atravessar.

   Qualquer toque da pessoa cancela: a partir do momento em que ela assume
   o controle, a página não mexe mais sozinha. E quem pediu menos movimento
   no sistema não recebe nada disto. */
function espiadaSozinha() {
  if (semMovimento() || !TOTAL) return;

  let relogio = null, morta = false;
  const parar = () => { morta = true; clearTimeout(relogio); };

  /* o primeiro gesto da pessoa manda: seta, miniatura, arraste, tecla */
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev =>
    addEventListener(ev, parar, { once: true, passive: true }));

  const passo = () => {
    if (morta || !ESPIADA || document.body.classList.contains('lendo')) return;
    const proxima = ESPIADA.atual() + 1;
    if (proxima > ESPIADA.maxima()) return;   /* bateu no cadeado: fica */
    ESPIADA.ir(proxima, 'sozinha');
    relogio = setTimeout(passo, 3000);
  };
  relogio = setTimeout(passo, 2000);
}

/* ═══ OS TRÊS TEMPOS ══════════════════════════════════════════
   A página parou de empilhar camadas e passou a organizar tempos, que é
   como revista funciona. TEMPO 1, a capa: a arte da edição é o chão, e
   sobre ela flutuam o objeto (a revista), a manchete e o botão — nada
   mais. TEMPO 2, o miolo: papel, o índice de páginas e a fileira de
   frameworks. TEMPO 3, a oferta: papel, o preço.

   Aqui a capa ganha uma caixa própria, porque ela precisa medir uma tela
   inteira; os outros dois seguem no fluxo, sobre papel. Mover os nós é
   mais honesto do que duplicar marcação: a fonte continua sendo uma só. */
function montarTempos() {
  const folha = document.querySelector('#chegada .folha');
  if (!folha || folha.querySelector('.capa')) return;

  const capa = document.createElement('section');
  capa.className = 'capa';
  folha.prepend(capa);
  /* A ordem da capa é a ordem em que a decisão se forma: quem é (número),
     o que é (título), o que promete (subtítulo), do que trata (a sinopse),
     como é (a revista) e o que fazer (o botão). No celular a sinopse desce
     para depois do botão — ver o CSS —, porque lá ela empurraria o preview
     e a ação para fora da primeira dobra. */
  ['#numero', '#titulo', '#ficha', '#promessa', '#revista']
    .forEach(s => { const e = folha.querySelector(s); if (e) capa.append(e); });

  /* OS DOIS BOTÕES, juntos. O do passe só existia no card lá embaixo — quem
     já estava decidido a comprar tinha de rolar a página inteira para achar
     onde. Agora as duas saídas ficam lado a lado no desktop e empilhadas no
     celular, com o gratuito dominante: ele é o evento que captura, e o pago
     é a saída de quem já sabe o que quer. */
  const acoes = document.createElement('div');
  acoes.className = 'acoes';
  acoes.append(folha.querySelector('#btn-ler') || capa.querySelector('#btn-ler'));
  const bp = document.createElement('button');
  bp.className = 'btn btn-passe btn-passe-hero';
  bp.dataset.passe = 'capa';
  bp.textContent = COPY_CASA.passeTitCurto;
  acoes.append(bp);
  capa.append(acoes);

  /* o índice de páginas desce para o miolo: sobre a arte ele era ruído,
     sobre papel ele é o que deixa escolher por onde entrar */
  /* a dica volta para DEBAIXO do preview, que é onde ela é lida: no pé da
     página ela chegava depois da decisão. E deixa de anunciar o que é
     livre para dizer o que fazer. */
  const dicaCapa = folha.querySelector('.dica-faixa');
  /* quem já se cadastrou não pode continuar sendo mandado se cadastrar:
     o texto só era reposto por destravar(), que roda depois do envio */
  if (dicaCapa) {
    dicaCapa.textContent = jaCapturado() ? '' : COPY_CASA.espiada;
    capa.append(dicaCapa);
  }

  const miolo = document.createElement('section');
  miolo.className = 'miolo';
  ['#pulso-n', '#trilho'];
  const pulso = folha.querySelector('.pulso') || capa.querySelector('.pulso');
  const faixa = capa.querySelector('.faixa') || folha.querySelector('.faixa');
  [pulso, faixa].forEach(e => e && miolo.append(e));
  miolo.append($('#mosaico'));
  capa.after(miolo);

  /* 1.2 e 1.3 — a apresentação da casa entra DEPOIS dos botões, e a ordem
     tem razão: quem chega na página de uma edição veio por aquele tema, e
     o institucional só responde a pergunta que ele passa a ter depois de
     ver o específico. */
  const casa = document.createElement('section');
  casa.className = 'casa';
  casa.innerHTML = `
    <p class="casa-lede">${COPY_CASA.apresenta}</p>
    <p class="casa-sub">${COPY_CASA.apresentaSub}</p>
    <div class="casa-polimata">
      <h2>${COPY_CASA.polimataTit}</h2>
      ${COPY_CASA.polimata.map(p => `<p>${p}</p>`).join('')}
    </div>`;
  miolo.after(casa);
}

/* ═══ A COR DA EDIÇÃO ═════════════════════════════════════════
   O fundo da casa é fixo — a malha da revista, o monograma, o brilho.
   O que muda de edição para edição é a COR, e ela não é escolhida por
   ninguém: sai da capa. Amostro a capa num canvas de 24×34, jogo fora o
   que é papel e o que é sombra, e fico com o tom que domina o que sobra.
   A ED007 devolve o dourado da máscara, a ED005 o verde da folhagem, a
   ED002 o vermelho do quadro. Uma linha de CSS lê o resultado.

   Se a amostragem falhar por qualquer motivo, o CSS já tem um padrão e
   a página não muda de aparência — o fundo simplesmente não se veste. */
function corDaEdicao() {
  const im = new Image();
  im.crossOrigin = 'anonymous';
  im.onload = () => {
    try {
      const L = 24, A = 34;
      const cv = document.createElement('canvas');
      cv.width = L; cv.height = A;
      const cx = cv.getContext('2d', { willReadFrequently: true });
      cx.drawImage(im, 0, 0, L, A);
      const px = cx.getImageData(0, 0, L, A).data;

      /* 24 caixas de 15° cada, com peso pela saturação: o pixel mais
         colorido pesa mais que o quase-cinza que só faz volume */
      const caixas = new Float64Array(24), somaH = new Float64Array(24);
      for (let i = 0; i < px.length; i += 4) {
        const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
        if (l < .1 || l > .88) continue;              /* sombra e estouro fora */
        const d = mx - mn;
        if (!d) continue;
        const s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
        if (s < .14) continue;                        /* cinza não tem cor */
        let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h = (h * 60 + 360) % 360;
        const c = Math.floor(h / 15);
        caixas[c] += s; somaH[c] += h * s;
      }
      let melhor = -1, pico = 0;
      for (let c = 0; c < 24; c++) if (caixas[c] > pico) { pico = caixas[c]; melhor = c; }
      if (melhor < 0 || pico < 1) return;             /* capa sem cor dominante */
      const h = Math.round(somaH[melhor] / caixas[melhor]);
      document.documentElement.style.setProperty('--cor-edicao-h', h);
    } catch (err) { console.warn('[porta] cor da edição indisponível', err); }
  };
  im.src = pag(1, 240);
}

/* ═══ A REVISTA ESPIÁVEL ═══════════════════════════════════════ */
/* ═══ O FUNDO ═════════════════════════════════════════════════
   Cada edição traz o seu próprio ambiente, sem ninguém escolher nada:
   a CAPA, gigante e desfocada, dá a temperatura de cor da página — a
   ED007 é preta e dourada, a ED005 é outra coisa, e a página inteira
   se veste disso. À direita, e só à direita, um trilho estreito com as
   páginas de framework DESTA edição, derivando devagar como provas numa
   parede de gráfica. O véu devolve o silêncio onde mora a leitura. */
function montarFundo() {
  if (!TOTAL) return;

  /* O FUNDO. Eram três peças soltas sobre um gradiente, e davam sensação de
     FALTA — parte da tela sem nada. Agora é uma parede: vinte e duas páginas
     da própria edição em grade de tijolo, giradas e sobrepostas, cobrindo
     cada canto. E ela é nítida porque cada ladrilho entra em resolução quase
     nativa (800px num quadro de 2560), em vez de uma foto esticada. */
  const atm = $('#atmosfera');
  const parede = `${BASE}edicoes/${EDICAO.n}/parede.webp?v=202608232149`;
  const teste = new Image();
  teste.onload = () => {
    atm.style.backgroundImage = `url("${parede}")`;
    atm.classList.add('parede', 'ver');
  };
  teste.onerror = () => { atm.classList.add('chao', 'ver'); };
  teste.src = parede;
  teste.decode?.().catch(() => {});

  corDaEdicao();

  /* AS PROVAS. Não é mais um sorteio de páginas quaisquer: cada edição
     declara em `destaques` as suas páginas de FRAMEWORK — quadro, painel,
     gráfico, exercício —, as que provam que a revista entrega método e não
     opinião. Quem abre a ED005 vê os gráficos DA ED005. A página fala da
     edição que está vendendo, e de nenhuma outra. */
  const provas = (EDICAO.destaques || []).filter(n => n <= TOTAL);
  if (!provas.length) return;

  /* O mesmo material, dois desenhos. No desktop sobra margem à esquerda e
     as provas viram parede: duas colunas desencontradas, subindo devagar,
     com a folha de leitura apoiada por cima. No celular não existe margem
     nenhuma — então a parede deita e vira uma FAIXA que corre de lado,
     colocada no lugar do funil onde ela argumenta: depois da espiada e do
     botão de graça, logo antes do preço. */
  /* AS PROVAS. Era uma tira infinita com catorze imagens vivas numa só
     camada animada: 48 MB de bitmap que o compositor não aguentava, e as
     páginas apareciam como caixas brancas. E, por ser infinita, nunca
     mostrava a página inteira — sempre havia uma entrando e uma saindo.
     Agora são QUATRO, paradas, completas e nítidas: provas sobre a mesa. */
  const mosaico = $('#mosaico');
  mosaico.className = 'provas';
  mosaico.innerHTML = provas.slice(0, 4).map((n, i) =>
    `<figure class="prova p${i + 1}">
       <img src="${pag(n, 800)}" alt="" width="800" height="1131">
     </figure>`).join('');

  /* SEM `lazy`, e com decodificação FORÇADA. O defeito era este: a imagem
     baixava (`complete` verdadeiro, `naturalWidth` certo) e mesmo assim o
     Chrome não a rasterizava — a prova aparecia como retângulo branco com
     sombra. Chamar `decode()` na mão pinta na hora; conferido ao vivo, as
     três apareceram no mesmo quadro. São quatro arquivos de ~60 KB: não
     há nada a economizar adiando. */
  mosaico.querySelectorAll('img').forEach(i => i.decode?.().catch(() => {}));

  /* só acende quando há o que mostrar — nada de piscar papel vazio */
  const primeira = mosaico.querySelector('img');
  const acender = () => mosaico.classList.add('ver');
  if (primeira && primeira.complete) acender();
  else primeira?.addEventListener('load', acender, { once: true });
  setTimeout(acender, 2500);               /* rede de segurança */
}

let limiteEspiada = Infinity;      /* última página livre antes do cadeado */
let paginaEmFoco = 0;              /* a página que a espiada está mostrando */

/* O primeiro capítulo é livre; o cadeado começa onde o segundo começa.
   Sem o capítulo 2 mapeado o portão FECHA num terço da revista — falhar
   aberto seria entregar a edição inteira por causa de um dado faltando. */
function calcularLimite() {
  const caps = EDICAO.capitulos || [];
  limiteEspiada = caps[1] ? caps[1][1] - 1 : Math.max(4, Math.ceil(TOTAL / 3));
}
let destravar = () => {};          /* preenchida quando a espiada monta */

function montarEspiada() {
  if (!TOTAL) { $('#revista').hidden = true; return; }

  const caps = EDICAO.capitulos || [];
  const nomeDe = n => {
    const i = caps.findLastIndex(c => n >= c[1]);
    return i >= 0 ? caps[i][0] : '';
  };

  /* A revista é física: a capa fica sozinha, e daí em diante as páginas
     andam em pares, como numa revista aberta na mesa. */
  const folhaDe   = n => (n <= 1 ? 0 : Math.floor(n / 2));
  const paginasDe = k => (k === 0 ? [null, 1] : [2 * k, 2 * k + 1]);
  const existe    = n => n !== null && n >= 1 && n <= TOTAL;
  const ultimaFolha = folhaDe(TOTAL);

  const livre      = n => jaCapturado() || n <= limiteEspiada;
  const folhaLivre = k => paginasDe(k).every(n => !existe(n) || livre(n));
  /* Quando o limite cai em página par, a última livre divide a folha com a
     primeira travada. Em vez de embaçar as duas (o que comia uma página do
     capítulo 1 em três edições), embaça só a metade travada: o leitor vê a
     parede exatamente onde ela está. */
  const folhaMaxima = () => (jaCapturado() ? ultimaFolha
                                           : Math.min(ultimaFolha, folhaDe(limiteEspiada + 1)));

  const spread  = $('#spread');
  const slotEsq = $('#pg-esq'), slotDir = $('#pg-dir');
  const virador = $('#virador');
  const vFrente = $('#vira-frente'), vVerso = $('#vira-verso');
  const faixa   = $('#faixa');

  let folha = 0, virando = false, pendente = null;

  /* ── a faixa de miniaturas ─────────────────────────────────── */
  function pintarFaixa() {
    faixa.innerHTML = Array.from({ length: TOTAL }, (_, i) => {
      const n = i + 1;
      /* 40 paradas de tabulação antes do botão de ler era um labirinto:
         a faixa é UM alvo, e as setas do teclado andam por ela */
      return `<button class="mini${livre(n) ? '' : ' travada'}" data-p="${n}" tabindex="-1"
        aria-label="Página ${n}${livre(n) ? '' : ' — trancada'}">
        <img src="${pag(n, 240)}" alt="" loading="lazy" decoding="async">
        <span class="n">${n === 1 ? 'capa' : n}</span>
      </button>`;
    }).join('');
    marcarAtivas();
  }

  function marcarAtivas(origem) {
    const [e, d] = paginasDe(folha);
    faixa.querySelectorAll('.mini').forEach(m => {
      const n = +m.dataset.p;
      m.classList.toggle('ativa', n === e || n === d);
    });
    /* a faixa acompanha quem folheia — menos quando foi ela quem mandou */
    if (origem && origem !== 'faixa') {
      const alvo = faixa.querySelector(`.mini[data-p="${existe(e) ? e : d}"]`);
      /* scrollIntoView arrastava a página inteira junto; centralizar na mão
         mexe só na faixa */
      if (alvo) {
        const rf = faixa.getBoundingClientRect(), ra = alvo.getBoundingClientRect();
        /* 'smooth' briga com o scroll-snap da faixa e ela volta pro zero;
           instantâneo o snap respeita */
        faixa.scrollTo({
          left: faixa.scrollLeft + (ra.left - rf.left) - (rf.width - ra.width) / 2,
          behavior: 'auto',
        });
      }
    }
  }

  /* ── pintar uma folha, com ou sem virada ───────────────────── */
  const carregar = n => new Promise(ok => {
    if (!existe(n)) return ok('');
    const im = new Image();
    im.onload = im.onerror = () => ok(pag(n, 800));
    im.src = pag(n, 800);
  });

  function por(slot, n) {
    if (existe(n)) { slot.src = pag(n, 800); slot.style.visibility = 'visible'; }
    else { slot.removeAttribute('src'); slot.style.visibility = 'hidden'; }
  }

  /* embaça só o lado que está travado, e leva o cartão para esse lado */
  function marcarTravas(k) {
    const [e, d] = paginasDe(k);
    const eTrav = existe(e) && !livre(e), dTrav = existe(d) && !livre(d);
    spread.classList.toggle('travado', eTrav || dTrav);
    slotEsq.parentElement.classList.toggle('travado', eTrav);
    slotDir.parentElement.classList.toggle('travado', dTrav);
    virador.classList.toggle('travado', dTrav || eTrav);
    $('#tranca').classList.toggle('so-direita', dTrav && !eTrav);
  }

  function legendar(origem) {
    const [e, d] = paginasDe(folha);
    const trancada = !folhaLivre(folha);
    const visiveis = [e, d].filter(existe);
    $('#pulso-n').textContent = folha === 0 ? 'Capa'
      : visiveis.length > 1 ? `Páginas ${visiveis[0]}–${visiveis[1]}` : `Página ${visiveis[0]}`;
    $('#pulso-cap').textContent = trancada ? '' : nomeDe(visiveis[visiveis.length - 1]);
    $('#trilho').style.setProperty('--f', (visiveis[visiveis.length - 1] / TOTAL).toFixed(3));

    spread.classList.toggle('fechada', folha === 0);
    marcarTravas(folha);
    $('#tranca').hidden = !trancada;
    /* a trava só existia em pixels: quem usa leitor de tela não sabia */
    $('#aviso-trava').textContent = trancada
      ? `Daqui em diante a edição está trancada. O primeiro capítulo vai até a página ${limiteEspiada}.`
      : '';

    paginaEmFoco = visiveis[visiveis.length - 1];
    $('#seta-esq').disabled = folha <= 0;
    $('#seta-dir').disabled = folha >= folhaMaxima();
    marcarAtivas(origem);
  }

  async function irParaFolha(k, origem) {
    k = Math.max(0, Math.min(folhaMaxima(), k));

    /* Clicar rápido na seta jogava o segundo clique fora, e a revista parecia
       travada. Agora o pedido fica na fila: se foi "próxima", guarda a
       DIREÇÃO, porque quando a vez dele chegar a folha já será outra. */
    if (virando) {
      /* a faixa rola sozinha quando a revista vira (marcarAtivas centraliza
         a miniatura), e essa rolagem pedia outra folha — era o que fazia a
         página virar e voltar. Pedido da faixa não entra na fila. */
      if (origem === 'faixa') return;
      const passo = k - folha;
      /* clique repetido SOMA: seis toques rápidos avançam seis folhas, e
         a virada acumulada vira um pulo seco em vez de seis animações */
      pendente = (pendente && Math.abs(passo) === 1 && Math.abs(pendente.passo) >= 1
                  && Math.sign(pendente.passo) === Math.sign(passo))
        ? { alvo: k, passo: pendente.passo + passo }
        : { alvo: k, passo };
      return;
    }
    if (k === folha) return;

    const salto = Math.abs(k - folha) > 1;
    const [e0, d0] = paginasDe(folha);
    const [e1, d1] = paginasDe(k);

    /* pulo largo (veio da faixa): troca seca, virar 8 folhas seria teatro —
       mas espera a imagem existir, senão a legenda anuncia uma página que
       ainda não está na tela */
    if (salto) {
      virando = true;
      await Promise.all([carregar(e1), carregar(d1)]);
      folha = k; por(slotEsq, e1); por(slotDir, d1);
      virando = false; legendar(origem); anunciar(origem); seguirPendente(); return;
    }

    virando = true;
    const frente = k > folha;

    /* o embaçado tem que entrar ANTES do giro: a legenda só roda no fim, e
       durante os 950ms da virada a página travada apareceria limpa na folha */
    marcarTravas(k);

    if (frente) {
      /* a folha da direita levanta: na frente o que sai, no verso o que entra */
      await Promise.all([carregar(d0), carregar(e1), carregar(d1)]);
      vFrente.src = existe(d0) ? pag(d0, 800) : '';
      vVerso.src  = existe(e1) ? pag(e1, 800) : '';
      por(slotDir, d1);                       /* aparece por baixo, ao levantar */
      folha = k;
      spread.classList.remove('fechada');     /* a revista abre */
      spread.classList.add('virando-frente');
      virador.classList.add('ativo', 'avanca');
    } else {
      /* voltando: a folha da esquerda se levanta e deita sobre a direita */
      await Promise.all([carregar(e0), carregar(d1), carregar(e1)]);
      vVerso.src  = existe(e0) ? pag(e0, 800) : '';
      vFrente.src = existe(d1) ? pag(d1, 800) : '';
      por(slotEsq, e1);
      folha = k;
      /* abrir tira a classe no início; fechar tem que devolver no início
         também, senão a volta para a capa custa o dobro do tempo */
      if (k === 0) spread.classList.add('fechada');
      spread.classList.add('virando-tras');
      virador.classList.add('ativo', 'volta');
    }

    setTimeout(() => {
      if (frente) por(slotEsq, e1); else por(slotDir, d1);
      virador.classList.remove('ativo', 'avanca', 'volta');
      spread.classList.remove('virando-frente', 'virando-tras');
      virando = false;
      legendar(origem);
      anunciar(origem);
      seguirPendente();
    }, semMovimento() ? 20 : 960);   /* a virada dura 950ms; sem movimento, quase nada */
  }

  ESPIADA = { atual: () => folha, maxima: folhaMaxima, ir: irParaFolha };

  function seguirPendente() {
    if (!pendente) return;
    const p = pendente; pendente = null;
    /* o alvo guardado foi calculado com a folha ANTIGA e já não vale nada:
       o que continua valendo é o passo — "tantas para a frente a partir
       de onde eu estiver agora". */
    irParaFolha(p.passo ? folha + p.passo : p.alvo, 'fila');
  }

  const anunciar = origem => { if (origem) evento('espiou', { folha, pagina: paginasDe(folha)[1], origem }); };

  const irParaPagina = (n, origem) => irParaFolha(folhaDe(n), origem);

  /* ── gestos e cliques ──────────────────────────────────────── */
  let quieto;
  faixa.addEventListener('scroll', () => {
    clearTimeout(quieto);
    quieto = setTimeout(() => {
      const meio = faixa.getBoundingClientRect().left + faixa.clientWidth / 2;
      let perto = null, dist = Infinity;
      faixa.querySelectorAll('.mini').forEach(m => {
        const r = m.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - meio);
        if (d < dist) { dist = d; perto = m; }
      });
      if (perto) irParaPagina(+perto.dataset.p, 'faixa');
    }, 100);
  }, { passive: true });

  faixa.addEventListener('click', e => {
    const m = e.target.closest('.mini');
    if (!m) return;
    const n = +m.dataset.p;
    if (!livre(n)) { abrirNaPagina(n); return; }        /* trancada: pede o cadastro */
    if (paginasDe(folha).includes(n)) abrirNaPagina(n); /* já está à vista: vai ler */
    else irParaPagina(n, 'toque');
  });

  /* clicar na revista abre a leitura na página em que o dedo caiu */
  $('#visor').addEventListener('click', ev => {
    const [e, d] = paginasDe(folha);
    const r = spread.getBoundingClientRect();
    const ladoEsq = ev.clientX < r.left + r.width / 2;
    const alvo = (ladoEsq && existe(e)) ? e : (existe(d) ? d : e);
    abrirNaPagina(alvo);
  });
  $('#tranca-btn').addEventListener('click', ev => {
    ev.stopPropagation();
    /* abre na página que ele está OLHANDO, não na primeira travada da
       revista — quem bateu duas folhas adiante volta ao lugar errado */
    const alvo = paginasDe(folha).filter(n => existe(n) && !livre(n))[0] || limiteEspiada + 1;
    evento('bateu_no_cadeado', { pagina: alvo });
    abrirNaPagina(alvo);
  });

  /* as setas moram dentro do visor: sem parar a propagação, clicar nelas
     virava a página E abria a leitura de uma vez */
  $('#seta-esq').addEventListener('click', e => { e.stopPropagation(); irParaFolha(folha - 1, 'seta'); });
  $('#seta-dir').addEventListener('click', e => { e.stopPropagation(); irParaFolha(folha + 1, 'seta'); });

  /* arrastar a revista com o dedo, como se vira papel */
  let x0 = null;
  $('#visor').addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  $('#visor').addEventListener('touchend', e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) < 45) return;
    arrastouEm = Date.now();
    irParaFolha(folha + (dx < 0 ? 1 : -1), 'arrasto');
  }, { passive: true });

  /* Marca a HORA do arrasto em vez de levantar uma bandeira: se o navegador
     não disparar o clique sintético (o normal quando o dedo andou), a bandeira
     ficava levantada e engolia o toque seguinte — o do cadeado, inclusive. */
  let arrastouEm = 0;
  $('#visor').addEventListener('click', e => {
    if (Date.now() - arrastouEm < 400) { e.stopImmediatePropagation(); arrastouEm = 0; }
  }, true);

  addEventListener('keydown', e => {
    if (!$('#leitura').classList.contains('aberta') && !document.querySelector('dialog[open]')) {
      if (e.key === 'ArrowRight') { e.preventDefault(); irParaFolha(folha + 1, 'seta'); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); irParaFolha(folha - 1, 'seta'); }
    }
  });

  /* quando o cadastro entra, a revista inteira abre sem recarregar a página */
  destravar = () => {
    if (!jaCapturado()) return;
    pintarFaixa();
    legendar('destravou');       /* recentra a faixa, que o repinte zerou */
    $('#dica-faixa').innerHTML = 'deslize para espiar <i class="pt"></i> <b>toque para ler a partir dali</b>';
  };

  pintarFaixa();
  por(slotEsq, null); por(slotDir, 1);
  legendar();

  if (!jaCapturado() && limiteEspiada < TOTAL) {
    $('#dica-faixa').innerHTML = `o capítulo 1 é livre <i class="pt"></i> <b>o resto abre com seu cadastro</b>`;
  }
}

/* quem espiou e quis ler cai exatamente na página que estava vendo */
function abrirNaPagina(n) {
  const ir = async () => {
    if (!await liberadoParaLer()) return;
    abrirLeitura(); setTimeout(() => irPara(n), 420);
  };
  if (jaCapturado()) { evento('leu_da_espiada', { pagina: n }); ir(); return; }
  pedirDados(n > limiteEspiada ? 'trancada' : 'espiada', ir);
}

/* ═══ TELA 2 · A LEITURA ═══════════════════════════════════════ */
let montado = false;

function abrirLeitura() {
  $('#chegada').style.display = 'none';
  $('#leitura').classList.add('aberta');
  document.body.classList.add('lendo');
  document.querySelector('meta[name=theme-color]').content = '#0F0C09';
  $('#cromo-tit').textContent = EDICAO.titulo;
  scrollTo(0, 0);
  if (!montado) { montarLeitor(); montado = true; }
  evento('abriu_leitura');
}

function voltar() {
  $('#leitura').classList.remove('aberta');
  $('#chegada').style.display = '';
  document.body.classList.remove('lendo');
  document.querySelector('meta[name=theme-color]').content = '#F2EEE6';
  scrollTo(0, 0);
}

function montarLeitor() {
  const caixa = $('#paginas');
  const frag = document.createDocumentFragment();
  const caps = EDICAO.capitulos || [];

  $('#regua').innerHTML = (caps.length ? caps : [['', 1]]).map((c, i) => {
    const ini = c[1] || 1, fim = caps[i + 1] ? caps[i + 1][1] : TOTAL + 1;
    return `<i style="flex:${fim - ini}" data-cap="${i}"></i>`;
  }).join('');

  for (let i = 1; i <= TOTAL; i++) {
    const img = document.createElement('img');
    img.className = 'pag';
    img.dataset.pagina = i;
    img.alt = `Página ${i}`;
    img.width = 1400; img.height = 1979;
    img.loading = i <= 2 ? 'eager' : 'lazy';
    img.decoding = 'async';
    if (i === 1) img.fetchPriority = 'high';
    /* O zoom agora é do navegador, e ele NÃO busca uma imagem melhor ao
       ampliar — usa a que já baixou. Por isso a leitura carrega direto a
       maior que temos: no computador isso dobra a nitidez no zoom. */
    img.sizes = '1400px';
    img.srcset = `${pag(i, 800)} 800w, ${pag(i, 1400)} 1400w`;
    img.src = pag(i, 1400);
    img.addEventListener('load', () => img.classList.add('carregada'), { once: true });
    /* rede quebrando no meio da leitura não pode virar ícone de imagem
       quebrada: a folha vira papel em branco com o número da página */
    img.addEventListener('error', () => {
      folha.classList.add('falhou');
      folha.dataset.n = i;
    }, { once: true });

    const folha = document.createElement('div');
    folha.className = 'folha-p';
    folha.dataset.pagina = i;
    const dentro = document.createElement('div');
    dentro.className = 'folha-in';
    dentro.appendChild(img);
    folha.appendChild(dentro);
    frag.appendChild(folha);

    if (caps.length > 2 && i === (caps[2]?.[1] || 0) - 1) frag.appendChild(blocoMeio());
  }
  frag.appendChild(blocoFim());
  caixa.appendChild(frag);

  montarSumario();
  observar();
  controlarCromo();
  ancorarBarra();

  /* onde ele parou da última vez: guardado desde sempre, nunca usado */
  const parou = parseInt(localStorage.getItem(posChave(EDICAO.n)), 10);
  if (parou > 2 && parou <= TOTAL) {
    maximaLida = parou;
    setTimeout(() => { irPara(parou); evento('retomou_leitura', { pagina: parou }); }, 500);
  }
}

function blocoMeio() {
  const d = document.createElement('div');
  d.className = 'intervalo';
  d.innerHTML = `
    <img class="mono" src="${CASA}monograma.webp" alt="" width="256" height="256">
    <p class="rot">Um intervalo</p>
    <h3>Toda semana nasce uma <em>nova</em></h3>
    <p>Esta você lê inteira, de graça. O passe abre as próximas quatro, os encontros ao vivo e o acervo completo — e você segue lendo esta aqui do mesmo jeito.</p>
    <button class="btn btn-passe" data-passe="intervalo">Adquirir passe — ${CFG.precoPasse}</button>`;
  return d;
}

function blocoFim() {
  const d = document.createElement('div');
  d.className = 'intervalo';
  d.innerHTML = `
    <img class="mono" src="${CASA}monograma.webp" alt="" width="256" height="256">
    <p class="rot">Contracapa</p>
    <h3>A próxima sai <em>semana que vem</em></h3>
    <p>${COPY_CASA.portao().replace('\n', '<br>')}</p>
    <section class="passe">
      <figure class="mock-passe"><img src="${CASA}mockup-assinatura.webp?v=202608232149"
        alt="Tudo que você acessa" width="794" height="485" decoding="async"></figure>
      <div class="passe-topo">
        <span class="passe-rot">${pontilhar(PASSE.rotulo.replace('Passe ETER · ', 'Passe · '))}</span>
        <span class="passe-preco">${CFG.precoPasse}</span>
      </div>
      <ul class="passe-itens">${PASSE.itens.map(([a, g]) => `<li><b>${a}</b>${g ? `<span>${g}</span>` : ''}</li>`).join('')}</ul>
      <button class="btn btn-passe" data-passe="fim">${COPY_CASA.passeTit}</button>
      <p class="passe-nota">${[PASSE.condicao, PASSE.credito].filter(Boolean).join(' ')}</p>
    </section>`;
  return d;
}

function montarSumario() {
  const caps = EDICAO.capitulos;
  if (!caps?.length) { $('#btn-sumario').hidden = true; return; }
  $('#sum-tit').textContent = EDICAO.titulo;
  $('#sum-leg').textContent = `Edição ${EDICAO.n}`;
  $('#caps').innerHTML = caps.map(([nome, p], i) => `
    <li><a href="#" data-pagina="${p}" data-cap="${i}">
      <span class="alg">${String(i + 1).padStart(2, '0')}</span>
      <span class="nom">${nome}</span><span class="pg">${p}</span>
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

const irPara = n => rolar(document.querySelector(`.folha-p[data-pagina="${n}"]`));

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

      const iCap = caps.findLastIndex(c => p >= c[1]);
      $('#regua').querySelectorAll('i').forEach((seg, i) => {
        const ini = caps[i]?.[1] || 1, fim = caps[i + 1]?.[1] || TOTAL + 1;
        seg.style.setProperty('--f', i < iCap ? 1 : i === iCap ? Math.min(1, (p - ini + 1) / (fim - ini)) : 0);
      });

      if (iCap >= 0 && iCap !== capAtual) {
        capAtual = iCap;
        $('#caps')?.querySelectorAll('a').forEach(a => a.classList.toggle('atual', +a.dataset.cap === iCap));
      }

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


/* A saudação da barra é de chegada, não um rótulo: no celular ela ocupa
   espaço que o botão precisa, então some assim que a página rola. */
function saudacaoDeChegada() {
  const marcar = () => document.body.classList.toggle('rolou', scrollY > 24);
  addEventListener('scroll', marcar, { passive: true });
  marcar();
}

function controlarCromo() {
  const cromo = $('#cromo'), barra = $('#barra');
  let ultimo = scrollY, parado;
  addEventListener('scroll', () => {
    if (!$('#leitura').classList.contains('aberta')) return;
    const y = scrollY, descendo = y > ultimo + 6 && y > 300;
    cromo.classList.toggle('oculto', descendo);
    barra.classList.toggle('oculta', descendo);
    ultimo = y;
    clearTimeout(parado);
    parado = setTimeout(() => { cromo.classList.remove('oculto'); barra.classList.remove('oculta'); }, 800);
  }, { passive: true });
}

/* ── o zoom: pinça e duplo toque; o toque simples nunca dispara ── */
/* ═══ ZOOM ═══════════════════════════════════════════════════
   Não existe mais zoom nosso. A pinça do celular e o ctrl+roda do
   computador já fazem isso melhor do que qualquer coisa que eu
   escreva: dois eixos, inércia, toque duplo, tudo na placa de vídeo.
   O que sobra para nós é só uma coisa — impedir que a barra da oferta
   cresça e escorregue junto quando a pessoa amplia. */

function ancorarBarra() {
  const vv = window.visualViewport;
  const b = $('#barra');
  if (!vv || !b) return;

  const acompanhar = () => {
    /* a barra vive na janela VISUAL (o pedaço que a pessoa está vendo),
       não na página. Sem isto ela some para fora da tela no zoom. */
    const escala = 1 / vv.scale;
    b.style.width = vv.width + 'px';
    b.style.left = vv.offsetLeft + 'px';
    b.style.top = (vv.offsetTop + vv.height) + 'px';
    b.style.bottom = 'auto';
    b.style.setProperty('--vv-escala', escala);
  };

  acompanhar();
  vv.addEventListener('resize', acompanhar);
  vv.addEventListener('scroll', acompanhar);
  addEventListener('orientationchange', () => setTimeout(acompanhar, 300));
}

/* ═══ O PORTEIRO — uma edição por mês ═════════════════════════
   A escolha vale 30 dias. Quem já escolheu vê duas saídas: esperar
   ou pegar o passe.

   Esta regra NÃO pode morar no navegador. O navegador é a casa do
   leitor: qualquer coisa que eu guarde lá ele apaga em dois cliques,
   ou troca de janela anônima e recomeça. Quem decide é a planilha,
   que é a única que enxerga as duas visitas como a mesma pessoa.
   Guardo a resposta aqui só para não perguntar a cada clique. */

const CHAVE_MES = 'eter_mes';
const CHAVE_DEMO = 'eter_demo';

/* ── MODO DEMONSTRAÇÃO (?demo=1) ──────────────────────────────
   O porteiro de verdade mora na planilha. Enquanto ela não está no ar,
   este modo roda a MESMA lógica aqui no navegador, com uma tarja à vista,
   para o fluxo poder ser visto de ponta a ponta. Não vale como controle
   — é uma maquete funcionando, não o porteiro. */
const emDemo = () => url.get('demo') === '1';

function porteiroDeMentira(edicao) {
  let d; try { d = JSON.parse(localStorage.getItem(CHAVE_DEMO)); } catch { d = null; }
  const agora = Date.now();
  if (d && d.ate > agora && d.edicao !== edicao) {
    const faltam = Math.ceil((d.ate - agora) / 86400000);
    const q = new Date(d.ate);
    return {
      liberado: false, motivo: 'já escolheu a edição deste mês',
      edicaoEmCurso: d.edicao, diasQueFaltam: faltam,
      liberaEmBR: `${String(q.getDate()).padStart(2, '0')}/${String(q.getMonth() + 1).padStart(2, '0')}`,
    };
  }
  if (!d || d.ate <= agora) {
    localStorage.setItem(CHAVE_DEMO, JSON.stringify({ edicao, ate: agora + 30 * 86400000 }));
  }
  return { liberado: true, motivo: 'edição do mês (demonstração)' };
}

function tarjaDemo() {
  if (!emDemo() || $('#tarja-demo')) return;
  const t = document.createElement('div');
  t.id = 'tarja-demo';
  t.innerHTML = `<b>Modo demonstração</b> — o porteiro está sendo simulado neste navegador.
    <button type="button" id="demo-zerar">recomeçar do zero</button>`;
  document.body.appendChild(t);
  $('#demo-zerar').addEventListener('click', () => {
    [CHAVE_DEMO, CHAVE_MES, CHAVE_LEAD].forEach(k => localStorage.removeItem(k));
    location.reload();
  });
}

const vereditoSalvo = () => { try { return JSON.parse(localStorage.getItem(CHAVE_MES)); } catch { return null; } };

/* a pergunta em voo: se o aquecimento já está esperando resposta, o clique
   entra na MESMA fila em vez de abrir outra — senão a pessoa paga a espera
   duas vezes, em paralelo, sem ganhar nada */
let porteiroEmVoo = null;

async function consultarPorteiro(edicao) {
  if (emDemo()) return porteiroDeMentira(edicao);
  const l = leadSalvo();
  /* Quem vem do ManyChat entra com c=1 e não preenche formulário — então não
     temos e-mail nem telefone. Mas o ManyChat sabe quem é: se ele acrescentar
     o id do assinante no link (&ms=...), o porteiro conta a edição dessa
     pessoa sem que nenhum dado pessoal ande pela barra de endereços. */
  const ms = url.get('ms') || '';
  if (!CFG.webhookLead || (!l && !ms)) return { liberado: true, motivo: 'sem porteiro' };

  /* resposta fresca guardada: não repergunta */
  const g = vereditoSalvo();
  if (g && g.edicao === edicao && g.quem === ((l && l.email) || ms) && g.ate && Date.now() < g.ate) return g.veredito;

  /* quem pega carona numa consulta em voo tem que herdar a MESMA rede de
     segurança: sem o catch, a rejeição chegava crua ao segundo chamador,
     `liberadoParaLer` estourava e o botão ficava em "Abrindo a edição…"
     para sempre — o oposto exato da regra de falhar aberto */
  if (porteiroEmVoo && porteiroEmVoo.edicao === edicao)
    return porteiroEmVoo.promessa.catch(() => ({ liberado: true, motivo: 'porteiro fora do ar' }));

  try {
    const promessa = fetch(CFG.webhookLead, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ acao: 'pode_ler', email: l?.email, whatsapp: l?.whatsapp, ms, edicao }),
    }).then(r => r.json());
    porteiroEmVoo = { edicao, promessa };
    const v = await promessa;
    porteiroEmVoo = null;
    /* guarda por 10 minutos: tempo de uma leitura, não de uma decisão */
    localStorage.setItem(CHAVE_MES, JSON.stringify({ edicao, quem: l?.email || ms, veredito: v, ate: Date.now() + 6e5 }));
    return v;
  } catch (err) {
    porteiroEmVoo = null;
    /* Falhar ABERTO é regra: internet ruim não pode trancar quem já deu
       o e-mail. Perder um controle custa menos do que barrar um leitor. */
    console.warn('[porta] porteiro fora do ar, liberando', err);
    return { liberado: true, motivo: 'porteiro fora do ar' };
  }
}

function mostrarPorteiro(v) {
  const outra = v.edicaoEmCurso ? `ED${v.edicaoEmCurso}` : 'a que você abriu';
  const dias = v.diasQueFaltam;
  /* 1.6 — a trava, na redação do dossiê. A data vem do porteiro; sem ela,
     a frase não mente: diz "em breve" em vez de inventar um dia. */
  $('#mes-dek').textContent = COPY_CASA.trava(v.liberaEmBR || 'breve');
  $('#mes-pe').textContent =
    `A sua deste mês é a ${outra}, que continua aberta, inteira, quando você quiser.` +
    (dias ? ` Esta aqui abre daqui a ${dias} ${dias === 1 ? 'dia' : 'dias'}.` : '');
  $('#mes-voltar').hidden = !v.edicaoEmCurso;
  $('#mes-voltar').textContent = v.edicaoEmCurso ? `Voltar para a ED${v.edicaoEmCurso}` : 'Voltar';
  $('#mes-dialog').dataset.edicao = v.edicaoEmCurso || '';
  $('#mes-dialog').showModal();
  evento('bateu_no_porteiro', { edicaoEmCurso: v.edicaoEmCurso || null, dias: dias || null });
}

/* O Apps Script liga sob demanda e a primeira resposta custa segundos.
   Perguntar no carregamento, enquanto a pessoa ainda está olhando a capa,
   faz a resposta já estar aqui quando ela clicar — a espera some sem que
   nada fique mais rápido. */
function aquecerPorteiro() {
  /* DESLIGADO, e o motivo é caro: do outro lado, `pode_ler` não é uma
     pergunta — ele GRAVA a linha e tranca os 30 dias no ato. Aquecer no
     carregamento significava que só ABRIR a página queimava a edição do
     mês: quem recebia o link da ED008 no WhatsApp, não lia nada e ia ver
     a ED007 no acervo, levava a parede "você já escolheu a do mês".
     Volta a existir quando o Apps Script separar consultar de consumir
     (o remendo está em build/planilha-de-leads.gs, precisa de novo
     Implantar). Até lá, a espera de 2–5s no clique é o preço certo. */
  return;
}

/* devolve true quando pode seguir; senão mostra as duas saídas */
async function liberadoParaLer() {
  const bt = $('#btn-ler');
  const antes = bt ? bt.innerHTML : null;
  const lento = setTimeout(() => { if (bt) bt.innerHTML = '<b>Abrindo a edição…</b>'; }, 500);
  const v = await consultarPorteiro(EDICAO.n);
  clearTimeout(lento);
  if (bt && antes !== null) bt.innerHTML = antes;
  if (v.liberado) return true;
  mostrarPorteiro(v);
  return false;
}

let aoTerminar = null;

const COPY = {
  leitura:  ['Para onde mandamos a edição?', 'A leitura abre na hora, aqui mesmo. O WhatsApp é para você receber a próxima edição.', 'Abrir a edição'],
  trancada: ['O resto da edição abre aqui', '', 'Destravar a edição'],
  espiada:  ['Falta um passo para ler', 'A leitura abre nesta página, agora. O WhatsApp é para você receber a próxima edição.', 'Ler a partir daqui'],
  checkout: ['Para onde mandamos seu acesso?', 'Confirmando aqui, o passe cai no seu WhatsApp assim que o pagamento entrar.', 'Continuar para o pagamento'],
};

function pedirDados(onde, depois = null) {
  if (jaCapturado()) { depois?.(); return true; }
  aoTerminar = depois;
  const chave = onde.startsWith('checkout') ? 'checkout' : (COPY[onde] ? onde : 'leitura');
  const [tit, dek0, bt] = COPY[chave];
  /* o número de capítulos muda por edição — prometer "seis" no código
     fazia a frase mentir em metade do acervo */
  const restantes = Math.max(1, (EDICAO.capitulos || []).length - 1);
  const dek = chave === 'trancada'
    ? `O primeiro capítulo é livre. ${restantes === 1 ? 'O resto' : `Os outros ${porExtenso(restantes)}`} abre${restantes === 1 ? '' : 'm'} agora, na íntegra, assim que você se identificar.`
    : dek0;
  $('#form-tit').textContent = tit;
  $('#form-dek').textContent = dek;
  $('#btn-enviar').textContent = bt;
  $('#form-dialog').dataset.onde = onde;
  $('#form-dialog').showModal();
  setTimeout(() => $('#f-nome').focus(), 120);
  evento('viu_formulario', { onde });
  return false;
}

const EXTENSO = ['zero','um','dois','três','quatro','cinco','seis','sete','oito','nove','dez'];
const porExtenso = n => EXTENSO[n] || String(n);

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
  const mail = $('#f-mail').value.trim();
  const zap = soDigitos($('#f-zap').value);

  /* nome, e-mail e telefone são obrigatórios — ninguém lê sem se identificar */
  const nomeOk = nome.length >= 2;
  const mailOk = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(mail);
  const zapOk = zap.length >= 10 && zap.length <= 11;

  $('#c-nome').classList.toggle('erro', !nomeOk);
  $('#c-mail').classList.toggle('erro', !mailOk);
  $('#c-zap').classList.toggle('erro', !zapOk);
  /* o leitor de tela precisa saber que o campo está inválido, não só ver */
  [['#f-nome', nomeOk], ['#f-mail', mailOk], ['#f-zap', zapOk]].forEach(([s, ok]) =>
    $(s).setAttribute('aria-invalid', String(!ok)));

  if (!nomeOk) { $('#f-nome').focus(); return; }
  if (!mailOk) { $('#f-mail').focus(); return; }
  if (!zapOk) { $('#f-zap').focus(); return; }
  const okMarcado = $('#f-ok').checked;
  $('#c-ok').classList.toggle('erro', !okMarcado);
  if (!okMarcado) { $('#f-ok').focus(); return; }

  const onde = $('#form-dialog').dataset.onde || 'capa';
  /* Do outro lado, `registrarLead` gasta a edição do mês sempre que
     recebe `edicao`. Quem preencheu o formulário para COMPRAR o passe e
     desistiu do pagamento saía barrado da leitura gratuita sem nunca ter
     lido nada. O cadastro do checkout entra sem edição: ele é lead, não
     é leitura. */
  const paraComprar = onde.startsWith('checkout');
  const lead = {
    nome, email: mail, whatsapp: '55' + zap,
    edicao: paraComprar ? '' : EDICAO.n,
    onde,
    jornaleiro: url.get('j') || null, ms: url.get('ms') || null,
    utm_source: '', utm_medium: '', utm_campaign: '', ...utmsDaUrl(),
    /* paginaAtual só anda na leitura; na espiada a página é a da folha */
    pagina: paginaEmFoco || paginaAtual, referrer: document.referrer || '', em: new Date().toISOString(),
  };

  const bt = $('#btn-enviar');
  bt.disabled = true; bt.textContent = 'Abrindo…';

  /* O Apps Script frio leva 2 a 5 segundos. Se a pessoa apertar Esc nesse
     meio, ela DESISTIU — e mesmo assim a continuação abria a leitura por
     cima dela. A marca é lida depois do await; o cadastro continua sendo
     gravado, porque o dado já foi dado. */
  const dialogo = $('#form-dialog');
  const marca = (dialogo.dataset.envio = String(Date.now()));

  /* A gravação do lead JÁ devolve o veredito do porteiro. Ler essa resposta
     economiza uma segunda ida ao Google — e são 2 a 5 segundos por ida,
     porque o Apps Script liga sob demanda. Uma viagem em vez de duas. */
  let veredito = null;
  if (CFG.webhookLead) {
    try {
      const r = await fetch(CFG.webhookLead, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(lead),
      });
      veredito = await r.json();
    } catch (err) {
      console.warn('[porta] porteiro fora do ar, liberando', err);
      veredito = { liberado: true, motivo: 'porteiro fora do ar' };
    }
  }

  localStorage.setItem(CHAVE_LEAD, JSON.stringify(lead));
  if (veredito) localStorage.setItem(CHAVE_MES, JSON.stringify({
    edicao: EDICAO.n, quem: lead.email, veredito, ate: Date.now() + 6e5,
  }));
  evento('virou_lead', { onde: lead.onde });
  bt.disabled = false;
  destravar();

  /* desistiu no meio da espera: grava o lead e não abre nada por cima */
  if (dialogo.dataset.envio !== marca || !dialogo.open) { aoTerminar = null; return; }
  dialogo.close();

  if (aoTerminar) { const f = aoTerminar; aoTerminar = null; f(); return; }
  if (!veredito || veredito.liberado) abrirLeitura();
  else mostrarPorteiro(veredito);
}

/* ═══ LIGAÇÕES ═════════════════════════════════════════════════ */
function ligar() {
  const lerAgora = async () => { if (await liberadoParaLer()) abrirLeitura(); };
  $('#btn-ler-fixo')?.addEventListener('click', () => {
    evento('clicou_ler', { origem: 'faixa-fixa' });
    jaCapturado() ? lerAgora() : pedirDados('leitura', lerAgora);
  });

  /* a faixa se apaga quando o botão de verdade entra em cena — duas
     ofertas idênticas na mesma tela viram ruído */
  /* O CONVITE FLUTUANTE FOI REMOVIDO. Ele existia porque o botão real
     ficava abaixo da dobra no celular; agora os dois botões estão dentro
     dela, e uma faixa fixa repetindo o mesmo convite virou uma terceira
     oferta da mesma coisa, tapando o fim da página. */
  $('#convite-fixo')?.remove();

  $('#btn-ler').addEventListener('click', () => jaCapturado() ? lerAgora() : pedirDados('leitura', lerAgora));
  $('#btn-voltar').addEventListener('click', voltar);
  $('#btn-sumario').addEventListener('click', () => { $('#sumario-dialog').showModal(); evento('abriu_sumario', { pagina: paginaAtual }); });
  const abrirAcervo = e => { e.preventDefault(); $('#acervo-dialog').showModal(); evento('abriu_acervo'); };
  $('#ver-edicoes').addEventListener('click', abrirAcervo);
  $('#nav-acervo').addEventListener('click', abrirAcervo);
  /* O topo vende o PASSE — duas portas na casa e nada mais: as edições e
     a que resolve. O anual não entra aqui: ele é a oferta de quem já pagou
     o passe, e mora na página de upsell, depois da compra. */
  $('#nav-passe').addEventListener('click', e => {
    e.preventDefault();
    abrirOferta('topo');
  });

  $('#mes-passe').addEventListener('click', () => {
    $('#mes-dialog').close();
    evento('porteiro_virou_passe');
    irParaCheckout('porteiro');
  });
  $('#mes-voltar').addEventListener('click', () => {
    const n = $('#mes-dialog').dataset.edicao;
    $('#mes-dialog').close();
    if (!n) return;
    evento('porteiro_voltou', { para: n });
    /* troca SÓ a edição: reescrever a URL do zero apagava o utm e o código
       do embaixador, e a venda que viesse depois nasceria órfã */
    /* mesma armadilha do acervo: trocar o ?ed não muda de edição quando o
       caminho manda. O botão que existe para tirar a pessoa da parede
       estava devolvendo ela para a mesma parede. */
    const ir = new URL(`../${n}/`, location.href);
    ir.search = location.search;
    ir.searchParams.delete('ed');
    location.href = ir.toString();
  });

  /* o Esc do <dialog> fecha por fora dos listeners: sem isto, quem desiste
     pelo teclado some da conta sem deixar rastro */
  $('#form-dialog').addEventListener('close', () => {
    /* invalida um envio que ainda esteja em voo: quem fechou, desistiu */
    delete $('#form-dialog').dataset.envio;
    if (!jaCapturado()) { evento('desistiu_do_formulario', { onde: $('#form-dialog').dataset.onde }); aoTerminar = null; }
  });

  /* clicar fora fecha: o <dialog> nativo não faz isso, e uma caixa sem
     saída visível é a reclamação mais comum de quem não achou o × */
  document.querySelectorAll('dialog').forEach(d => {
    d.addEventListener('click', ev => {
      if (ev.target !== d) return;      /* só o backdrop, nunca o conteúdo */
      const r = d.getBoundingClientRect();
      const fora = ev.clientX < r.left || ev.clientX > r.right
                || ev.clientY < r.top  || ev.clientY > r.bottom;
      if (fora) d.close();
    });
  });

  $('#form').addEventListener('submit', enviar);
  $('#f-zap').addEventListener('input', mascara);
  $('#f-nome').addEventListener('input', () => $('#c-nome').classList.remove('erro'));
  $('#f-mail').addEventListener('input', () => $('#c-mail').classList.remove('erro'));

  document.querySelectorAll('[data-fecha]').forEach(b =>
    b.addEventListener('click', () => {
      if (b.dataset.fecha === 'form-dialog') {
        evento('desistiu_do_formulario', { onde: $('#form-dialog').dataset.onde });
        aoTerminar = null;
      }
      $('#' + b.dataset.fecha).close();
    }));

  document.body.addEventListener('click', e => {
    const b = e.target.closest('[data-passe]');
    if (b) irParaCheckout(b.dataset.passe);
  });
}

iniciar().catch(err => {
  console.error(err);
  /* Falhar também é a marca falando: fonte de sistema num parágrafo solto
     é a página dizendo que desistiu. */
  document.body.innerHTML = `
    <div class="tombo">
      <img src="${CASA}monograma.webp" alt="">
      <h2>A revista não abriu</h2>
      <p>Alguma coisa entre você e a gente falhou no caminho. Não é você — e não custa tentar de novo.</p>
      <button class="btn btn-passe" onclick="location.reload()">Tentar de novo</button>
    </div>`;
});

})();
