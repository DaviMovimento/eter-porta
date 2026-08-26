/* ═══ A OFERTA DA CASA — home e biblioteca ═════════════════════
   A página de edição sempre teve a cadeia completa do passe: a caixa da
   oferta (mockup + entregáveis + preço), depois o formulário, e só então
   o checkout. Na home e na biblioteca o botão pulava direto para o
   pagamento — quem clicava no topo comprava sem ver o que comprava, e o
   lead de quem abandonava o checkout se perdia.

   Este módulo dá às duas páginas a mesma cadeia, lendo tudo do mesmo
   edicoes.json e reusando o CSS que a premium.css já define. Uma oferta,
   escrita num lugar só. */
(() => {
  const AQUI = document.currentScript?.src || location.href;
  const CASA = AQUI.replace(/[^/]*$/, '');           /* .../premium/ */
  const RAIZ = CASA.replace(/premium\/$/, '');       /* .../revista/ */
  const PAGINA = document.body.classList.contains('biblioteca') ? 'biblioteca' : 'home';

  let D = null;
  const catalogo = () => D ||
    (D = fetch(`${RAIZ}edicoes.json?v=202608261810`).then(r => r.json()));

  const busca = () => new URLSearchParams(location.search);
  const pontos = t => String(t).replace(/ · /g, ' <i class="pt"></i> ');

  /* o mesmo desenho de URL da página de edição: src diz a página, sck diz
     o botão com o embaixador dentro, e os utm do anúncio viajam juntos */
  function linkCheckout(cfg, origem) {
    const u = new URL(cfg.checkoutPasse);
    const p = busca();
    const j = p.get('j');
    u.searchParams.set('src', PAGINA);
    u.searchParams.set('sck', j ? `${origem}-${j}` : origem);
    u.searchParams.set('utm_source', 'porta');
    u.searchParams.set('utm_campaign', PAGINA);
    for (const [k, v] of p) if (k.startsWith('utm_')) u.searchParams.set(k, v);
    u.searchParams.set('utm_medium', origem);
    return u.toString();
  }

  /* ── a caixa da oferta: um popup só, com o formulário dentro ── */
  const capturado = () => {
    try { const l = JSON.parse(localStorage.getItem('eter_lead') || 'null');
          return !!(l && l.nome && l.email && l.whatsapp); } catch (e) { return false; }
  };

  async function abrirOferta(origem, direto) {
    const d = await catalogo();
    const C = d.config, P = d.passe;
    /* botão ao lado dos entregáveis: sem popup de oferta. Cadastrado vai
       direto ao pagamento; novo vê só o formulário curto. */
    if (direto && capturado()) {
      (window.dataLayer = window.dataLayer || []).push({ event: 'foi_ao_checkout', origem, pagina: PAGINA });
      location.href = linkCheckout(C, origem);
      return;
    }
    let cx = document.getElementById('oferta-dialog');
    if (!cx) {
      cx = document.createElement('dialog');
      cx.id = 'oferta-dialog';
      cx.innerHTML = `
        <form class="painel oferta" id="oferta-form" novalidate>
          <button type="button" class="fechar" aria-label="Fechar">×</button>
          <figure class="mock-passe">
            <img src="${CASA}mockup-assinatura.webp" alt="Tudo que o passe abre"
              width="794" height="485" decoding="async">
          </figure>
          <p class="oferta-rot">${pontos(P.rotulo.replace('Passe ETER · ', 'Passe · '))}
            <b>${C.precoPasse}</b></p>
          <p class="oferta-chamada">30 dias de acesso total. Não renova: cobrança única.</p>
          <ul class="oferta-itens">
            ${P.itens.map(([a]) => `<li><b>${a}</b></li>`).join('')}
          </ul>
          <div class="oferta-campos" id="oferta-campos">
            <div class="campo" id="oc-nome">
              <input id="of-nome" type="text" autocomplete="given-name" placeholder="Seu nome" aria-label="Seu nome">
              <span class="msg" role="alert">Escreva seu nome.</span>
            </div>
            <div class="campo" id="oc-mail">
              <input id="of-mail" type="email" autocomplete="email" placeholder="Seu melhor e-mail" aria-label="Seu melhor e-mail">
              <span class="msg" role="alert">Escreva um e-mail válido.</span>
            </div>
            <div class="campo" id="oc-zap">
              <input id="of-zap" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="WhatsApp com DDD" aria-label="WhatsApp com DDD">
              <span class="msg" role="alert">Precisa ter DDD e 8 ou 9 dígitos.</span>
            </div>
            <div class="campo" id="oc-ok">
              <label class="consent">
                <input type="checkbox" id="of-ok">
                <span>Autorizo a <b>ETER</b> a me enviar a edição, comunicações e ofertas por
                WhatsApp e e-mail. Saio quando quiser respondendo <b>SAIR</b>.
                <a href="${RAIZ}privacidade/" target="_blank" rel="noopener">Privacidade</a>.</span>
              </label>
              <span class="msg" role="alert">Precisamos da sua autorização.</span>
            </div>
          </div>
          <button class="btn btn-passe" id="oferta-seguir" type="submit">ASSINAR O PASSE — ${C.precoPasse}</button>
        </form>`;
      document.body.append(cx);
      cx.querySelector('.fechar').addEventListener('click', () => cx.close());
      cx.addEventListener('click', ev => {
        if (ev.target === cx && Date.now() - (+cx.dataset.abriuEm || 0) > 500) cx.close();
      });
      cx.querySelectorAll('img').forEach(i => i.decode?.().catch(() => {}));

      const zap = cx.querySelector('#of-zap');
      zap.addEventListener('input', () => {
        const dg = zap.value.replace(/\D/g, '').slice(0, 11);
        zap.value = dg.length <= 2 ? dg
          : dg.length <= 7 ? `(${dg.slice(0, 2)}) ${dg.slice(2)}`
          : `(${dg.slice(0, 2)}) ${dg.slice(2, 7)}-${dg.slice(7)}`;
        cx.querySelector('#oc-zap').classList.remove('erro');
      });

      cx.querySelector('#oferta-form').addEventListener('submit', ev => {
        ev.preventDefault();
        if (cx.dataset.enviando === '1') return;      /* clique duplo */
        cx.dataset.enviando = '1';
        setTimeout(() => { cx.dataset.enviando = ''; }, 1500);
        const orig = cx.dataset.origem || 'oferta';
        const irAoCheckout = () => { cx.close(); location.href = linkCheckout(C, orig); };
        if (capturado()) { 
          (window.dataLayer = window.dataLayer || []).push({ event: 'foi_ao_checkout', origem: orig, pagina: PAGINA });
          irAoCheckout(); return;
        }
        const v = id => cx.querySelector(id).value.trim();
        const erra = (id, sim) => cx.querySelector(id).classList.toggle('erro', sim);
        const nome = v('#of-nome'), mail = v('#of-mail');
        const dig = v('#of-zap').replace(/\D/g, '');
        erra('#oc-nome', !nome);
        erra('#oc-mail', !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail));
        erra('#oc-zap', !(dig.length === 10 || dig.length === 11));
        erra('#oc-ok', !cx.querySelector('#of-ok').checked);
        if (cx.querySelector('.campo.erro')) return;
        const p = busca();
        const lead = {
          nome, email: mail, whatsapp: '55' + dig, edicao: '',
          onde: `checkout-${PAGINA}-${orig}`,
          jornaleiro: p.get('j') || null, ms: p.get('ms') || null,
          utm_source: p.get('utm_source') || '', utm_medium: p.get('utm_medium') || '',
          utm_campaign: p.get('utm_campaign') || '',
          pagina: 0, referrer: document.referrer || '', em: new Date().toISOString(),
        };
        try { localStorage.setItem('eter_lead', JSON.stringify(lead)); } catch (e) {}
        if (C.webhookLead) try {
          fetch(C.webhookLead, { method: 'POST', keepalive: true,
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(lead) });
        } catch (e) {}
        (window.dataLayer = window.dataLayer || []).push({ event: 'foi_ao_checkout', origem: orig, pagina: PAGINA });
        irAoCheckout();
      });
    }
    cx.querySelector('#oferta-campos').hidden = capturado();
    cx.classList.toggle('so-form', !!direto);
    cx.dataset.origem = origem;
    if (!cx.open) { cx.dataset.abriuEm = String(Date.now()); cx.showModal(); }
    setTimeout(() => { if (!capturado()) cx.querySelector('#of-nome').focus(); }, 120);
    (window.dataLayer = window.dataLayer || []).push({ event: 'abriu_oferta', origem, pagina: PAGINA });
  }

  window.abrirOfertaCasa = abrirOferta;
})();
