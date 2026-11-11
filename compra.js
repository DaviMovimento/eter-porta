/* ═══ COMPRA — o botão da seção #assinatura da home de venda e o passe de embaixador ═══
   Protótipo (08/11/2026). Nada aqui está no ar.

   11/11/2026 (Rei): o passe de 30 dias saiu da página; a seção #assinatura tem só o
   plano anual. O passe continua existindo só pelos links de embaixador
   (/revista/ricardo/passe/, /revista/nath/passe/), que chegam à home com
   ?comprar=passe#assinatura. Sem botão na página, o código mesmo faz o passo do
   clique, com o mesmo comportamento de antes (ver "LIGAR").

   PASSE  (só com ?comprar=passe)
     1. Já tem cadastro no aparelho (chave `eter_lead` com nome, e-mail e
        WhatsApp, a mesma que a leitura gratuita e a caixa da oferta do site
        gravam)? Vai direto ao pagamento.
     2. Não tem? Abre o popup (nome, e-mail, WhatsApp, autorização) e só
        depois vai ao pagamento.
     3. A URL da Guru sai com o rastro de origem (src, sck, utm_*) e, se
        PREENCHER_CHECKOUT, com nome, e-mail e telefone já preenchidos.
     4. Registra no mesmo endpoint do site (Apps Script, aba `leads`, coluna
        `onde`), SÓ se ENVIAR = true.

   ANUAL  (#pv-anual)
     Abre o WhatsApp do Luiz com a mensagem pronta, na voz do comprador.
     Se a pessoa tem cadastro, o primeiro nome entra na mensagem e o clique é
     registrado (também só com ENVIAR = true), com o telefone dela, para o
     Luiz cruzar a conversa com a planilha.

   A marca de origem tem três valores:
     leitura    → já se cadastrou na leitura gratuita de uma edição
     cadastrado → já se cadastrou antes, mas por um botão de compra
     popup      → se cadastrou agora, no popup desta página
     (no anual, quem não tem cadastro vai como `novo`)
   ═══════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

/* ── chaves de ligar ─────────────────────────────────────────────────── */
/* Registro na planilha: LIGADO por ordem do Rei (09/11). O entregador da Voxuy
   só manda o fluxo da leitura gratuita para cadastro COM edição; os cadastros
   dos botões de compra vão sem edição e ficam na planilha para recuperação. */
const ENVIAR = true;
/* Sem pixel da Meta (Rei, 09/11: sem tráfego pago por enquanto). O que vale
   é o registro na planilha; os eventos vão só ao dataLayer. */
/* Nome, e-mail e telefone na URL da Guru. Decisão do Rei: o site no ar tem a
   regra contrária escrita no porta.js ("nada de nome ou telefone na URL").
   Ver compra-LEIA.md. */
const PREENCHER_CHECKOUT = true;

/* ── endereços (conferidos em 08/11 no site local) ───────────────────── */
/* = edicoes.json → config.webhookLead */
const ENDPOINT = 'https://script.google.com/macros/s/AKfycbzkY_WfokD6PcZDhf1Uh_toXCfn2ofcYKEldfTlga9RKdlHUR3cPg_zdRxqIzVjrt3E_w/exec';
/* WhatsApp comercial do Luiz (00-MAPA/pessoa/luiz-alencar.md, 04/11) */
const WHATS_LUIZ = '5543984845551';
const CHAVE_LEAD = 'eter_lead';
/* O cadastro feito nos botões de compra fica numa chave PRÓPRIA. Se fosse na
   eter_lead, o site da revista acharia que a pessoa já se cadastrou para ler,
   não pediria o cadastro na edição e ela nunca receberia a leitura. */
const CHAVE_LEAD_COMPRA = 'eter_lead_compra';
const PAGINA = 'home';
/* pagamento do passe de 30 dias (= edicoes.json → config.checkoutPasse); o passe não tem mais botão na página */
const CHECKOUT_PASSE = 'https://clkdmg.site/pay/passe-de-30-dias';

/* ── utilidades ──────────────────────────────────────────────────────── */
const qs = new URLSearchParams(location.search);
const ler = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const soDigitos = s => String(s || '').replace(/\D/g, '');
const dl = (event, dados) => (window.dataLayer = window.dataLayer || []).push({ event, pagina: PAGINA, ...dados });


/* a mesma régua do site (premium.js e casa.js): cadastro só vale com os três */
const valido = l => l && l.nome && l.email && l.whatsapp ? l : null;
const leadSalvo = () => valido(ler(CHAVE_LEAD)) || valido(ler(CHAVE_LEAD_COMPRA));

/* veio da leitura gratuita (o lead tem edição) ou de um botão de compra */
const marcaDe = l => !l ? 'novo' : (l.edicao ? 'leitura' : 'cadastrado');

/* embaixador: o site guarda o ?j por 30 dias em `eter_j` */
function embaixador() {
  const j = (qs.get('j') || '').trim().toLowerCase();
  if (/^[a-z0-9_-]{2,40}$/.test(j)) return j;
  const s = ler('eter_j');
  return s && s.j && s.ate > Date.now() ? s.j : '';
}

/* id do contato no ManyChat: o site guarda o ?ms em `eter_ms` (texto puro) */
function manychat() {
  const m = (qs.get('ms') || '').trim();
  if (/^\d{4,20}$/.test(m)) return m;
  try { const g = localStorage.getItem('eter_ms') || ''; return /^\d{4,20}$/.test(g) ? g : ''; } catch (e) { return ''; }
}

/* telefone no formato da Guru: código do país à parte. Só o Brasil é
   separado com certeza; número de fora vai sem preencher o telefone. */
function foneGuru(w) {
  const d = soDigitos(w);
  return /^55\d{10,11}$/.test(d) ? { phone_local_code: '55', phone: d.slice(2) } : null;
}

/* ── o link da Guru ──────────────────────────────────────────────────── */
/* Segue o desenho do site no ar (casa.js): src = a página, sck = o botão
   (+ embaixador), utm_source = porta, utm_campaign = a página, utm_medium =
   o botão. Os utm de anúncio atravessam, menos medium e content, que são
   desta página. Novo: utm_content leva a marca de origem. */
function linkCheckout(base, botao, marca, lead) {
  const u = new URL(base);
  const j = embaixador(), ms = manychat();
  const p = u.searchParams;
  p.set('src', PAGINA);
  p.set('sck', `${botao}-${marca}` + (j ? `-${j}` : ''));
  p.set('utm_source', 'porta');
  p.set('utm_campaign', PAGINA);
  for (const [k, v] of qs) if (k.startsWith('utm_') && v) p.set(k, v);
  p.set('utm_medium', botao);
  p.set('utm_content', marca);
  if (ms) p.set('utm_term', `ms-${ms}`);
  if (PREENCHER_CHECKOUT && lead) {
    /* parâmetros da doc da Guru, "Como configurar parâmetros na URL";
       o checkout lê e APAGA esses campos da barra de endereço ao abrir */
    p.set('name', lead.nome);
    p.set('email', lead.email);
    const f = foneGuru(lead.whatsapp);
    if (f) { p.set('phone_local_code', f.phone_local_code); p.set('phone', f.phone); }
  }
  return u.toString();
}

/* ── registro no endpoint do site ────────────────────────────────────── */
/* Mesmo formato que casa.js e premium.js mandam (text/plain, sem preflight,
   o Apps Script lê do mesmo jeito). O porteiro grava na aba `leads`; a
   marca vai na coluna `onde`. Edição vazia = não gasta leitura do mês. */
function registrar(lead, onde) {
  const j = embaixador(), ms = manychat();
  const corpo = {
    nome: lead.nome, email: lead.email, whatsapp: lead.whatsapp,
    edicao: '', onde,
    jornaleiro: j || null, ms: ms || null,
    utm_source: qs.get('utm_source') || '', utm_medium: qs.get('utm_medium') || '',
    utm_campaign: qs.get('utm_campaign') || '',
    pagina: 0, referrer: document.referrer || '', em: new Date().toISOString(),
  };
  if (!ENVIAR) { console.info('[compra] ENVIAR=false, não enviado:', corpo); return; }
  try {
    fetch(ENDPOINT, { method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(corpo) });
  } catch (e) { /* a compra nunca espera a planilha */ }
}

/* ═══ PASSE ═════════════════════════════════════════════════════════════ */
/* O clique vai à planilha SEM edição, como faz a caixa da oferta do site no ar:
   com edição, o porteiro gastaria a edição do mês da pessoa (aba acessos).
   Quem se cadastrou na leitura há menos de 20 minutos vai SEM o e-mail (só nome
   e WhatsApp): o entregador da Voxuy acha a linha mais recente de cada pessoa
   pelo e-mail e pula a sem edição, então uma linha de clique com o e-mail,
   antes da entrega, faria ela perder a leitura. Sem o e-mail, a entrega não é
   afetada e a equipe acha a pessoa pelo telefone. */
const RECENTE_MS = 20 * 60 * 1000;
const leituraRecente = lead => { const t = Date.parse(lead && lead.em || ''); return !!lead.edicao && !isNaN(t) && Date.now() - t < RECENTE_MS; };
const registrarSeNovo = (lead, marca, onde) => registrar(leituraRecente(lead) ? { ...lead, email: '' } : lead, onde);

function irAoPasse(base, lead, marca) {
  registrarSeNovo(lead, marca, `checkout-${PAGINA}-assine-passe-${marca}`);
  dl('foi_ao_checkout', { origem: 'assine-passe', marca });
  location.href = linkCheckout(base, 'assine-passe', marca, lead);
}

function cliquePasse() {
  dl('clicou_passe', { origem: 'assine-passe' });
  const lead = leadSalvo();
  if (lead) { irAoPasse(CHECKOUT_PASSE, lead, marcaDe(lead)); return; }
  abrirPopup(CHECKOUT_PASSE, 'passe');
}

/* ── o popup ─────────────────────────────────────────────────────────── */
const CSS = `
#cp-dialog{position:fixed;inset:0;margin:auto;border:0;padding:0;background:transparent;max-width:min(520px,calc(100vw - 32px));width:100%;height:fit-content;max-height:calc(100dvh - 32px);overflow:auto;color:var(--t,#190808)}
#cp-dialog::backdrop{background:rgba(10,4,4,.72);backdrop-filter:blur(6px)}
#cp-dialog form{position:relative;background:var(--f,#FFFBF3);border-radius:22px;padding:clamp(26px,4vw,42px);display:grid;gap:14px}
#cp-dialog .cp-rot{font:800 12px/1 'FuturaCond',sans-serif;letter-spacing:.17em;text-transform:uppercase;color:var(--ouro,#89723C);margin:0}
#cp-dialog h3{font:500 clamp(24px,3vw,30px)/1.1 'TRJN',serif;margin:0}
#cp-dialog .cp-dek{font-size:15.5px;line-height:1.55;margin:0 0 4px;color:var(--t3,rgba(25,8,8,.5))}
#cp-dialog input[type=text],#cp-dialog input[type=email],#cp-dialog input[type=tel]{width:100%;box-sizing:border-box;height:52px;padding:0 16px;border:1px solid var(--ln,rgba(25,8,8,.13));border-radius:2px;background:#fff;font:400 16px/1 'InterEter',-apple-system,Helvetica,Arial,sans-serif;color:inherit}
#cp-dialog input:focus{outline:2px solid var(--ouro2,#AF9153);outline-offset:1px}
#cp-dialog .cp-campo .msg{display:none;font-size:13px;color:var(--vinho,#511212);margin-top:6px}
#cp-dialog .cp-campo.erro input{border-color:var(--vinho,#511212)}
#cp-dialog .cp-campo.erro .msg{display:block}
#cp-dialog .fone{display:flex;gap:8px}#cp-dialog .fone input{flex:1 1 auto;min-width:0}
#cp-dialog .fone-pais{position:relative;display:flex;align-items:center;justify-content:center;flex:0 0 auto;min-width:92px;border:1px solid rgba(25,8,8,.15);border-radius:3px;background:#fff;font:400 16px 'InterEter',sans-serif;cursor:pointer;color:#190808}
#cp-dialog .fone-pais select{position:absolute;inset:0;opacity:0;cursor:pointer;font-size:16px}
#cp-dialog .fone-pais::after{content:'';width:6px;height:6px;margin-left:8px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:translateY(-2px) rotate(45deg);opacity:.55}
#cp-dialog .cp-campo.erro .fone-pais{border-color:var(--vinho,#511212)}
#cp-dialog .cp-campo.aviso .msg{display:block;color:#5c4a1e;background:#f6edd8;padding:8px 10px;border-radius:3px}
#cp-dialog .cp-ok{display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:1.5;color:var(--t3,rgba(25,8,8,.5))}
#cp-dialog .cp-ok input{margin-top:3px;accent-color:var(--ouro,#89723C)}
#cp-dialog .cp-ok a{color:inherit}
#cp-dialog .pbt{width:100%;margin-top:6px}
#cp-dialog .cp-fecha{all:unset;cursor:pointer;position:absolute;right:18px;top:12px;font:500 32px/1 'TRJN',serif}
`;

let dlg = null, destino = '', tipoPopup = 'passe';
const TEXTOS = {
  passe: { rot: 'Passe de 30 dias · R$97', tit: 'Para onde mandamos o seu acesso?', dek: 'Com estes dados, a página de pagamento já abre preenchida.', bt: 'Continuar para o pagamento' },
  anual: { rot: 'Plano anual · 12x R$97,04', tit: 'Fale com a nossa equipe no WhatsApp', dek: 'Deixe seus dados e a conversa abre com a mensagem pronta.', bt: 'Continuar para o WhatsApp' },
};

function montarPopup() {
  const st = document.createElement('style');
  st.textContent = CSS;
  document.head.append(st);

  dlg = document.createElement('dialog');
  dlg.id = 'cp-dialog';
  dlg.setAttribute('aria-labelledby', 'cp-titulo');
  dlg.innerHTML = `
    <form novalidate>
      <button type="button" class="cp-fecha" aria-label="Fechar">×</button>
      <p class="cp-rot"></p>
      <h3 id="cp-titulo"></h3>
      <p class="cp-dek"></p>
      <div class="cp-campo" data-c="nome">
        <input id="cp-nome" type="text" autocomplete="name" placeholder="Seu nome" aria-label="Seu nome" enterkeyhint="next">
        <span class="msg" role="alert">Escreva seu nome.</span>
      </div>
      <div class="cp-campo" data-c="mail">
        <input id="cp-mail" type="email" autocomplete="email" placeholder="Seu melhor e-mail" aria-label="Seu melhor e-mail" enterkeyhint="next">
        <span class="msg" role="alert">Escreva um e-mail válido.</span>
      </div>
      <div class="cp-campo" data-c="zap">
        <input id="cp-zap" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="WhatsApp com DDD" aria-label="WhatsApp com DDD" enterkeyhint="go">
        <span class="msg" role="alert">Precisa ter DDD e 8 ou 9 dígitos.</span>
      </div>
      <div class="cp-campo" data-c="ok">
        <label class="cp-ok"><input type="checkbox" id="cp-aceite">
          <span>Autorizo a <b>ETER</b> a me enviar a edição, comunicações e ofertas por WhatsApp e e-mail. Saio quando quiser respondendo <b>SAIR</b>. <a href="https://eterbrasil.com/revista/privacidade/" target="_blank" rel="noopener">Privacidade</a>.</span></label>
        <span class="msg" role="alert">Precisamos da sua autorização.</span>
      </div>
      <button class="pbt ouro cp-bt" type="submit"></button>
    </form>`;
  /* dentro do #pv para herdar as cores e o estilo do botão da página */
  (document.getElementById('pv') || document.body).append(dlg);

  const zap = dlg.querySelector('#cp-zap');
  /* Rei, 10/11: o mesmo seletor de país e a mesma regra do cadastro da leitura (fone.js) */
  const fone = window.EterFone ? window.EterFone.montar(zap, () => { const c = zap.closest('.cp-campo'); c.classList.remove('erro', 'aviso'); }) : null;

  const fechar = () => { dl('desistiu_do_popup', { origem: 'assine-' + tipoPopup }); dlg.close(); };
  dlg.querySelector('.cp-fecha').addEventListener('click', fechar);
  dlg.addEventListener('click', ev => {
    if (ev.target === dlg && Date.now() - (+dlg.dataset.abriuEm || 0) > 500) fechar();
  });

  dlg.querySelector('form').addEventListener('submit', ev => {
    ev.preventDefault();
    if (dlg.dataset.enviando === '1') return;              /* clique duplo */
    const v = id => dlg.querySelector(id).value.trim();
    const erra = (c, sim) => dlg.querySelector(`[data-c="${c}"]`).classList.toggle('erro', sim);
    const nome = v('#cp-nome'), mail = v('#cp-mail');
    const campoZap = dlg.querySelector('[data-c="zap"]'), msgZap = campoZap.querySelector('.msg');
    const z = fone ? fone.ler() : { ok: soDigitos(v('#cp-zap')).length >= 10, whatsapp: '55' + soDigitos(v('#cp-zap')) };
    const whatsapp = z.whatsapp;
    campoZap.classList.remove('aviso');
    /* com o 9 acrescentado, a peça já pôs o número corrigido no campo: a pessoa confere e toca de novo */
    if (!z.ok && z.corrigido) {
      campoZap.classList.add('aviso');
      msgZap.textContent = 'Acrescentamos o 9 do celular: ' + z.mostrar + '. Se estiver certo, toque de novo no botão.';
      dl('whatsapp_corrigido', { origem: 'assine-' + tipoPopup });
    } else if (!z.ok) { msgZap.textContent = z.msg || 'Confira o WhatsApp.'; dl('whatsapp_recusado', { motivo: z.motivo || '', origem: 'assine-' + tipoPopup }); }
    erra('nome', nome.length < 2);
    erra('mail', !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail));
    erra('zap', !z.ok && !z.corrigido);
    erra('ok', !dlg.querySelector('#cp-aceite').checked);
    if (dlg.querySelector('.cp-campo.erro') || !z.ok) return;

    dlg.dataset.enviando = '1';
    setTimeout(() => { dlg.dataset.enviando = ''; }, 1500);
    /* o mesmo objeto que o site guarda: a leitura gratuita e a caixa da
       oferta passam a reconhecer esta pessoa e não pedem os dados de novo */
    const lead = {
      nome, email: mail, whatsapp, edicao: '',
      onde: tipoPopup === 'anual' ? `whatsapp-${PAGINA}-assine-anual` : `checkout-${PAGINA}-assine-passe`,
      jornaleiro: embaixador() || null, ms: manychat() || null,
      utm_source: qs.get('utm_source') || '', utm_medium: qs.get('utm_medium') || '',
      utm_campaign: qs.get('utm_campaign') || '',
      pagina: 0, referrer: document.referrer || '', em: new Date().toISOString(),
    };
    gravar(CHAVE_LEAD_COMPRA, lead);
    dl('virou_lead', { onde: lead.onde });
    dlg.close();
    if (tipoPopup === 'anual') irAoWhatsapp(lead, 'popup'); else irAoPasse(destino, lead, 'popup');
  });
}

function abrirPopup(base, tipo) {
  if (!dlg) montarPopup();
  destino = base; tipoPopup = tipo || 'passe';
  const t = TEXTOS[tipoPopup];
  dlg.querySelector('.cp-rot').textContent = t.rot;
  dlg.querySelector('#cp-titulo').textContent = t.tit;
  dlg.querySelector('.cp-dek').textContent = t.dek;
  dlg.querySelector('.cp-bt').textContent = t.bt;
  dlg.dataset.abriuEm = String(Date.now());
  dlg.showModal();
  dl('abriu_popup', { origem: 'assine-' + tipoPopup });
  setTimeout(() => dlg.querySelector('#cp-nome').focus(), 120);
}

/* ═══ ANUAL ═════════════════════════════════════════════════════════════ */
/* A mensagem é do COMPRADOR para a equipe (Rei, 09/11). Preço e link ficam
   com o Luiz. O WhatsApp não deixa enviar sozinho: a conversa abre com o
   texto pronto e a pessoa só aperta enviar. */
function mensagemAnual(lead) {
  const primeiro = lead ? String(lead.nome).trim().split(/\s+/)[0] : '';
  return 'Olá, tudo bem? ' + (primeiro ? `Aqui é ${primeiro}. ` : '')
    + 'Gostaria de conhecer a assinatura anual da ETER.';
}

const linkAnual = lead =>
  `https://wa.me/${WHATS_LUIZ}?text=${encodeURIComponent(mensagemAnual(lead))}`;

function irAoWhatsapp(lead, marca) {
  registrarSeNovo(lead, marca, `whatsapp-${PAGINA}-assine-anual-${marca}`);
  dl('foi_para_whatsapp_anual', { origem: 'assine-anual', marca });
  const url = linkAnual(lead);
  const w = window.open(url, '_blank', 'noopener');
  if (!w) location.href = url;   /* navegador que bloqueia a aba nova */
}

/* Rei, 09/11: o anual também pede nome, e-mail e WhatsApp antes, para a equipe
   poder recuperar quem clicou e não chamou. Quem já tem cadastro vai direto. */
function cliqueAnual(ev) {
  ev.preventDefault();
  ev.stopPropagation();   /* a página trata todo href="#" como rolagem */
  const lead = leadSalvo();
  dl('clicou_anual', { origem: 'assine-anual' });
  if (lead) { irAoWhatsapp(lead, marcaDe(lead)); return; }
  abrirPopup('', 'anual');
}

/* ═══ LIGAR ═════════════════════════════════════════════════════════════ */
function ligar() {
  const anual = document.getElementById('pv-anual');
  if (anual) {
    /* o href real serve para tocar e segurar no celular e para quem abre em
       outra aba; o clique normal passa pelo cliqueAnual */
    anual.href = linkAnual(leadSalvo());
    anual.target = '_blank';
    anual.rel = 'noopener';
    anual.removeAttribute('data-afazer');
    anual.addEventListener('click', cliqueAnual);
  }
  /* Rei, 09/11: os passes de embaixador (/ricardo/passe, /nath/passe) chegam com ?comprar=passe e passam
     pelo mesmo formulário curto antes do checkout; quem já tem cadastro segue direto, como no clique.
     11/11: o botão do passe saiu da página, então o passo do clique é feito direto, com o mesmo atraso */
  if (qs.get('comprar') === 'passe') setTimeout(cliquePasse, 700);
}

document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', ligar) : ligar();
})();
