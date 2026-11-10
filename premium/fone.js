/* ═══ O WHATSAPP DE QUALQUER PAÍS ═════════════════════════════
   Os formulários (cadastro da leitura grátis, passe e anual) usam esta peça para escolher o país e conferir o número.
   Todos saem no formato que o WhatsApp usa, só dígitos: código do país + número (55119..., 351912...).

   VALIDAÇÃO (Rei, 10/11/2026, pela conversa CRO: 17 de 104 cadastros de 04 a 09/11 tinham número que o WhatsApp recusou):
   - Brasil: DDD que existe + celular de 9 dígitos começando em 9. Com 8 dígitos começando em 6, 7, 8 ou 9, acrescenta o 9
     e mostra o número corrigido para a pessoa confirmar. Recusa todos os dígitos iguais e sequências (12345678).
     Limpa espaço, traço, parêntese, o 0 antes do DDD e o 55 repetido no começo.
   - Outros países: só dígitos, de 6 a 14 depois do código do país; nunca acrescenta 55.
   - O 9 acrescentado se confirma dentro da própria peça: o primeiro ler() põe o número corrigido no campo e devolve
     ok:false com corrigido:true e a mensagem; o segundo toque lê o número já com o 9 e passa. Assim toda página que usa a
     peça (inclusive as antigas, que só olham ok, whatsapp e msg) pede a confirmação.
   - Quem usa a peça mostra o erro embaixo do campo, sem apagar o que a pessoa digitou, e manda ao sensor o motivo
     (nunca o número): window.EterFone.motivo(...) devolve o nome curto do motivo. */
(() => {
  /* [sigla, bandeira, nome, código, exemplo] */
  const PAISES = [
    ['BR', '🇧🇷', 'Brasil',         '55',  '(11) 90000-0000'],
    ['PT', '🇵🇹', 'Portugal',       '351', '912 345 678'],
    ['US', '🇺🇸', 'Estados Unidos', '1',   '201 555 0123'],
    ['CA', '🇨🇦', 'Canadá',         '1',   '416 555 0123'],
    ['ES', '🇪🇸', 'Espanha',        '34',  '612 345 678'],
    ['IT', '🇮🇹', 'Itália',         '39',  '312 345 6789'],
    ['FR', '🇫🇷', 'França',         '33',  '6 12 34 56 78'],
    ['GB', '🇬🇧', 'Reino Unido',    '44',  '7400 123456'],
    ['DE', '🇩🇪', 'Alemanha',       '49',  '1512 3456789'],
    ['CH', '🇨🇭', 'Suíça',          '41',  '78 123 45 67'],
    ['IE', '🇮🇪', 'Irlanda',        '353', '85 012 3456'],
    ['AR', '🇦🇷', 'Argentina',      '54',  '9 11 2345 6789'],
    ['UY', '🇺🇾', 'Uruguai',        '598', '94 231 234'],
    ['PY', '🇵🇾', 'Paraguai',       '595', '961 456 789'],
    ['CL', '🇨🇱', 'Chile',          '56',  '9 6123 4567'],
    ['MX', '🇲🇽', 'México',         '52',  '55 1234 5678'],
    ['AO', '🇦🇴', 'Angola',         '244', '923 123 456'],
    ['MZ', '🇲🇿', 'Moçambique',     '258', '82 123 4567'],
    ['XX', '🌐', 'Outro país',      '',    'Código do país + número'],
  ];
  /* maior número nacional de cada país (sem o código); quem cola o código sem "+" (351912345678) passa desse tamanho */
  const MAX = { PT: 9, US: 10, CA: 10, ES: 9, IT: 10, FR: 9, GB: 10, DE: 11, CH: 9, IE: 9, AR: 11, UY: 8, PY: 9, CL: 9, MX: 10, AO: 9, MZ: 9 };
  /* os DDDs que existem no Brasil */
  const DDD = new Set('11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99'.split(' '));
  const MSG_BR = 'Confere o seu WhatsApp com DDD, só números, por exemplo 11 98123-4567.'; /* exemplo que a própria regra aceita (10/11) */
  const MSG_FORA = 'Confere o número: só os dígitos depois do código do país.';
  const porSigla = Object.fromEntries(PAISES.map(p => [p[0], p]));
  const digitos = s => String(s || '').replace(/\D/g, '');
  const SEQ = '0123456789012345678901', INV = '9876543210987654321098';

  /* Brasil: limpa o 55 repetido e o 0 antes do DDD; devolve só DDD + número */
  const limpaBR = d => {
    d = digitos(d).replace(/^0+/, '');
    if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
    return d.replace(/^0+/, '');
  };
  const mascaraBR = d => {
    d = d.slice(0, 11);
    return d.length <= 2 ? d
      : d.length <= 6 ? `(${d.slice(0, 2)}) ${d.slice(2)}`
      : d.length <= 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
      : `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };

  /* a regra, sem tela: { ok, whatsapp, motivo, msg, corrigido, mostrar } */
  function validar(sigla, bruto) {
    const p = porSigla[sigla] || PAISES[0], c = p[3];
    if (p[0] === 'BR') {
      let d = limpaBR(bruto);
      if (d.length < 10) return { ok: false, motivo: d.length ? 'curto' : 'vazio', msg: MSG_BR };
      const ddd = d.slice(0, 2);
      let loc = d.slice(2), corrigido = false;
      if (!DDD.has(ddd)) return { ok: false, motivo: 'ddd', msg: MSG_BR };
      if (loc.length === 8 && /[6-9]/.test(loc[0])) { loc = '9' + loc; corrigido = true; }
      if (loc.length !== 9 || loc[0] !== '9') return { ok: false, motivo: loc.length === 8 ? 'fixo' : 'tamanho', msg: MSG_BR };
      const oito = loc.slice(1);
      if (/^(\d)\1+$/.test(loc) || /^(\d)\1+$/.test(oito)) return { ok: false, motivo: 'repetido', msg: MSG_BR };
      if (SEQ.includes(oito) || INV.includes(oito)) return { ok: false, motivo: 'sequencia', msg: MSG_BR };
      return { ok: true, whatsapp: '55' + ddd + loc, corrigido, mostrar: mascaraBR(ddd + loc) };
    }
    let d = digitos(bruto);
    const comMais = /^\s*(\+|00)/.test(String(bruto || ''));
    if (p[0] === 'XX') {
      d = d.replace(/^00/, '');
      const ok = d.length >= 8 && d.length <= 15 && !/^(\d)\1+$/.test(d);
      return ok ? { ok, whatsapp: d } : { ok, motivo: 'tamanho-outro-pais', msg: 'Escreva o código do país e o número, só com dígitos.' };
    }
    if (comMais) { d = d.replace(/^00/, ''); if (d.startsWith(c)) d = d.slice(c.length); }
    else if (d.startsWith(c) && d.length > (MAX[p[0]] || 14)) d = d.slice(c.length);
    d = d.replace(/^0+/, '');        /* o 0 da ligação local não existe no WhatsApp */
    if (d.length < 6 || d.length > 14) return { ok: false, motivo: 'tamanho-outro-pais', msg: MSG_FORA };
    if (/^(\d)\1+$/.test(d)) return { ok: false, motivo: 'repetido', msg: MSG_FORA };
    return { ok: true, whatsapp: c + d };
  }

  /* põe o seletor de país antes do campo e devolve quem lê o número */
  function montar(input, aoMudar) {
    if (!input || input.dataset.fone) return input && input._fone;
    input.dataset.fone = '1';
    const caixa = document.createElement('div');
    caixa.className = 'fone';
    input.parentNode.insertBefore(caixa, input);
    const rot = document.createElement('label');
    rot.className = 'fone-pais';
    rot.innerHTML = `<span class="fone-rot" aria-hidden="true"></span>
      <select aria-label="País do WhatsApp">${PAISES.map(([s, b, n, c]) =>
        `<option value="${s}">${b} ${n}${c ? ' (+' + c + ')' : ''}</option>`).join('')}</select>`;
    caixa.append(rot, input);
    const sel = rot.querySelector('select');
    const mostra = rot.querySelector('.fone-rot');
    const pais = () => porSigla[sel.value] || PAISES[0];

    const aplicar = () => {
      const [s, b, , c, ex] = pais();
      mostra.textContent = s === 'XX' ? `${b} +` : `${b} +${c}`;
      input.placeholder = ex;
      input.setAttribute('aria-label', s === 'BR' ? 'WhatsApp com DDD' : 'WhatsApp');
      input.autocomplete = s === 'BR' ? 'tel-national' : 'tel';
      formatar();
    };
    const formatar = () => {
      if (pais()[0] === 'BR') input.value = mascaraBR(limpaBR(input.value));
      else input.value = String(input.value).replace(/[^\d+ ]/g, '').slice(0, 20);
    };
    sel.addEventListener('change', () => { aplicar(); aoMudar && aoMudar(); input.focus(); });
    input.addEventListener('input', () => { formatar(); aoMudar && aoMudar(); });
    aplicar();

    const api = {
      pais: () => pais()[0],
      /* { ok, whatsapp, msg, motivo, corrigido }; com o 9 acrescentado, o campo passa a mostrar o número corrigido
         e a resposta é ok:false até a pessoa tocar de novo (aí o número já tem o 9 e passa sem correção) */
      ler() {
        const r = validar(pais()[0], input.value);
        if (r.ok && r.corrigido && r.mostrar) {
          input.value = r.mostrar;
          return { ok: false, corrigido: true, motivo: 'confirmar', whatsapp: r.whatsapp, mostrar: r.mostrar,
            msg: `Acrescentamos o 9 do celular: ${r.mostrar}. Se estiver certo, toque de novo para enviar.` };
        }
        return r;
      },
    };
    input._fone = api;
    return api;
  }

  window.EterFone = { montar, validar, PAISES };
})();
