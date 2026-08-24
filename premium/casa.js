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
  const catalogo = async () => D ||
    (D = await (await fetch(`${RAIZ}edicoes.json?v=202608241144`)).json());

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

  /* ── a caixa da oferta ──────────────────────────────────────── */
  async function abrirOferta(origem) {
    const d = await catalogo();
    const C = d.config, P = d.passe;
    let cx = document.getElementById('oferta-dialog');
    if (!cx) {
      cx = document.createElement('dialog');
      cx.id = 'oferta-dialog';
      cx.innerHTML = `
        <div class="painel oferta">
          <button type="button" class="fechar" aria-label="Fechar">×</button>
          <img class="marca-oferta" src="${CASA}logo.webp" alt="ETER" width="900" height="240">
          <figure class="mock-passe">
            <img src="${CASA}mockup-assinatura.webp" alt="Tudo que você acessa"
              width="794" height="485" decoding="async">
          </figure>
          <p class="oferta-chamada">Você começa hoje pela edição que quiser, e o mês corre com a ETER inteira aberta.</p>
          <p class="oferta-rot">${pontos(P.rotulo.replace('Passe ETER · ', 'Passe · '))}
            <b>${C.precoPasse}</b></p>
          <ul class="oferta-itens">
            ${P.itens.map(([a, b]) => `<li><b>${a}</b>${b ? `<span>${b}</span>` : ''}</li>`).join('')}
          </ul>
          <button class="btn btn-passe" id="oferta-seguir">ADQUIRIR O PASSE</button>
          <p class="oferta-pe">${P.condicao || ''}</p>
        </div>`;
      document.body.append(cx);
      cx.querySelector('.fechar').addEventListener('click', () => cx.close());
      cx.addEventListener('click', ev => { if (ev.target === cx) cx.close(); });
      cx.querySelector('#oferta-seguir').addEventListener('click', () => {
        cx.close();
        pedirDados(origem);
      });
      cx.querySelectorAll('img').forEach(i => i.decode?.().catch(() => {}));
    }
    cx.dataset.origem = origem;
    cx.showModal();
    (window.dataLayer = window.dataLayer || []).push({ event: 'abriu_oferta', origem, pagina: PAGINA });
  }

  /* ── o formulário, entre a decisão e o pagamento ────────────── */
  async function pedirDados(origem) {
    const d = await catalogo();
    const C = d.config;
    let fx = document.getElementById('form-dialog');
    if (!fx) {
      fx = document.createElement('dialog');
      fx.id = 'form-dialog';
      fx.innerHTML = `
        <form class="form" id="form-casa" novalidate>
          <button type="button" class="fechar" aria-label="Fechar">×</button>
          <img class="mono" src="${CASA}monograma.webp" alt="" width="256" height="256">
          <h2>Para onde mandamos seu acesso?</h2>
          <p class="dek2">Confirmando aqui, o passe cai no seu WhatsApp assim que o pagamento entrar.</p>
          <div class="campo" id="c-nome">
            <label for="f-nome">Seu nome</label>
            <input id="f-nome" type="text" autocomplete="given-name" placeholder="Como te chamam" enterkeyhint="next">
            <span class="msg" role="alert">Escreva seu nome.</span>
          </div>
          <div class="campo" id="c-mail">
            <label for="f-mail">Seu melhor e-mail</label>
            <input id="f-mail" type="email" autocomplete="email" placeholder="voce@email.com" enterkeyhint="next">
            <span class="msg" role="alert">Escreva um e-mail válido.</span>
          </div>
          <div class="campo" id="c-zap">
            <label for="f-zap">WhatsApp com DDD</label>
            <input id="f-zap" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="(11) 90000-0000" enterkeyhint="go">
            <span class="msg" role="alert">Precisa ter DDD e 8 ou 9 dígitos.</span>
          </div>
          <div class="campo" id="c-ok">
            <label class="consent">
              <input type="checkbox" id="f-ok">
              <span>Autorizo a <b>ETER</b> a me enviar comunicações sobre a revista e
              <b>ofertas</b>, por WhatsApp e e-mail. Saio quando quiser respondendo
              <b>SAIR</b>. <a href="${RAIZ}privacidade/" target="_blank" rel="noopener">Privacidade</a>.</span>
            </label>
            <span class="msg" role="alert">Precisamos da sua autorização.</span>
          </div>
          <button class="btn btn-passe" id="btn-enviar" type="submit">Continuar para o pagamento</button>
        </form>`;
      document.body.append(fx);
      fx.querySelector('.fechar').addEventListener('click', () => fx.close());
      fx.addEventListener('click', ev => { if (ev.target === fx) fx.close(); });

      /* a máscara do telefone, a mesma régua da página de edição */
      const zap = fx.querySelector('#f-zap');
      zap.addEventListener('input', () => {
        const d = zap.value.replace(/\D/g, '').slice(0, 11);
        zap.value = d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}`
                  : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d;
      });

      fx.querySelector('#form-casa').addEventListener('submit', async ev => {
        ev.preventDefault();
        const v = id => fx.querySelector(id).value.trim();
        const erra = (id, sim) => fx.querySelector(id).classList.toggle('erro', sim);
        const nome = v('#f-nome'), mail = v('#f-mail');
        const dig = v('#f-zap').replace(/\D/g, '');
        const ok = fx.querySelector('#f-ok').checked;
        erra('#c-nome', !nome);
        erra('#c-mail', !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail));
        erra('#c-zap', !(dig.length === 10 || dig.length === 11));
        erra('#c-ok', !ok);
        if (fx.querySelector('.campo.erro')) return;

        const bt = fx.querySelector('#btn-enviar');
        bt.disabled = true; bt.textContent = 'Abrindo o pagamento…';
        const p = busca();
        const lead = {
          nome, email: mail, whatsapp: '55' + dig,
          edicao: '',                       /* comprar não consome a edição do mês */
          onde: `checkout-${PAGINA}-${fx.dataset.origem || 'oferta'}`,
          jornaleiro: p.get('j') || null, ms: p.get('ms') || null,
          utm_source: p.get('utm_source') || '', utm_medium: p.get('utm_medium') || '',
          utm_campaign: p.get('utm_campaign') || '',
          pagina: 0, referrer: document.referrer || '', em: new Date().toISOString(),
        };
        /* o lead vai ANTES do redirecionamento: quem abandonar o checkout
           fica na planilha, que é o público da recuperação */
        try {
          if (C.webhookLead) await fetch(C.webhookLead, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(lead),
          });
        } catch (e) { /* a venda não espera a planilha */ }
        try { localStorage.setItem('eter_lead', JSON.stringify(lead)); } catch (e) {}
        (window.dataLayer = window.dataLayer || []).push({ event: 'foi_ao_checkout', origem: fx.dataset.origem, pagina: PAGINA });
        location.href = linkCheckout(C, fx.dataset.origem || 'oferta');
      });
    }
    fx.dataset.origem = origem;
    fx.showModal();
    setTimeout(() => fx.querySelector('#f-nome').focus(), 120);
  }

  window.abrirOfertaCasa = abrirOferta;
})();
