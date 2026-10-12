/* ═══ O WHATSAPP DE QUALQUER PAÍS ═════════════════════════════
   Os três formulários (cadastro da leitura, oferta na edição, oferta na
   home) pediam DDD brasileiro e punham um 55 fixo na frente. Quem lê de
   Portugal ou dos EUA não conseguia se cadastrar. Aqui mora a escolha do
   país: o Brasil continua igual (máscara e DDD), os outros conferem o
   tamanho do número local, e todos saem no mesmo formato que o WhatsApp
   usa, só dígitos: código do país + número (55119..., 351912...).
   A planilha e a entrega já guardam os dígitos como chegam; nada muda lá. */
(() => {
  /* [sigla, bandeira, nome, código, tamanhos aceitos do número local, exemplo] */
  const PAISES = [
    ['BR', '🇧🇷', 'Brasil',         '55',  [10, 11], '(11) 90000-0000'],
    ['PT', '🇵🇹', 'Portugal',       '351', [9],      '912 345 678'],
    ['US', '🇺🇸', 'Estados Unidos', '1',   [10],     '201 555 0123'],
    ['CA', '🇨🇦', 'Canadá',         '1',   [10],     '416 555 0123'],
    ['ES', '🇪🇸', 'Espanha',        '34',  [9],      '612 345 678'],
    ['IT', '🇮🇹', 'Itália',         '39',  [9, 10],  '312 345 6789'],
    ['FR', '🇫🇷', 'França',         '33',  [9],      '6 12 34 56 78'],
    ['GB', '🇬🇧', 'Reino Unido',    '44',  [10],     '7400 123456'],
    ['DE', '🇩🇪', 'Alemanha',       '49',  [10, 11], '1512 3456789'],
    ['CH', '🇨🇭', 'Suíça',          '41',  [9],      '78 123 45 67'],
    ['IE', '🇮🇪', 'Irlanda',        '353', [9],      '85 012 3456'],
    ['AR', '🇦🇷', 'Argentina',      '54',  [10, 11], '9 11 2345 6789'],
    ['UY', '🇺🇾', 'Uruguai',        '598', [8],      '94 231 234'],
    ['PY', '🇵🇾', 'Paraguai',       '595', [9],      '961 456 789'],
    ['CL', '🇨🇱', 'Chile',          '56',  [9],      '9 6123 4567'],
    ['MX', '🇲🇽', 'México',         '52',  [10],     '55 1234 5678'],
    ['AO', '🇦🇴', 'Angola',         '244', [9],      '923 123 456'],
    ['MZ', '🇲🇿', 'Moçambique',     '258', [9],      '82 123 4567'],
    ['XX', '🌐', 'Outro país',      '',    [8, 15],  'Código do país + número'],
  ];
  /* a preposição certa de cada país, para a mensagem de erro soar natural */
  const EM = { US: 'nos', CA: 'no', ES: 'na', IT: 'na', FR: 'na', GB: 'no', DE: 'na', CH: 'na',
               IE: 'na', AR: 'na', UY: 'no', PY: 'no', CL: 'no', MX: 'no', PT: 'em', AO: 'em', MZ: 'em' };
  const porSigla = Object.fromEntries(PAISES.map(p => [p[0], p]));
  const digitos = s => String(s || '').replace(/\D/g, '');

  const mascaraBR = d => {
    d = d.slice(0, 11);
    return d.length <= 2 ? d
      : d.length <= 7 ? `(${d.slice(0, 2)}) ${d.slice(2)}`
      : `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };

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
      const [s, b, , c, , ex] = pais();
      mostra.textContent = s === 'XX' ? `${b} +` : `${b} +${c}`;
      input.placeholder = ex;
      input.setAttribute('aria-label', s === 'BR' ? 'WhatsApp com DDD' : 'WhatsApp');
      input.autocomplete = s === 'BR' ? 'tel-national' : 'tel';
      formatar();
    };
    const formatar = () => {
      const d = digitos(input.value);
      input.value = pais()[0] === 'BR' ? mascaraBR(d) : d.slice(0, 15);
    };
    sel.addEventListener('change', () => { aplicar(); aoMudar && aoMudar(); input.focus(); });
    input.addEventListener('input', () => { formatar(); aoMudar && aoMudar(); });
    aplicar();

    const api = {
      /* { ok, whatsapp: 'código+número', msg } */
      ler() {
        const [s, , n, c, tam] = pais();
        let d = digitos(input.value);
        if (s === 'XX') {
          const ok = d.length >= tam[0] && d.length <= tam[1];
          return { ok, whatsapp: d, msg: 'Escreva o código do país e o número, só com dígitos.' };
        }
        /* quem digita o 0 da ligação local (07…, 06…, 015…) não erra:
           o WhatsApp não usa esse 0, então ele sai */
        if (s !== 'BR') d = d.replace(/^0+/, '');
        const ok = tam.includes(d.length);
        const msg = s === 'BR' ? 'Precisa ter DDD e 8 ou 9 dígitos.'
          : `Confira o número: ${EM[s] || 'em'} ${n} o celular tem ${tam.join(' ou ')} dígitos.`;
        return { ok, whatsapp: c + d, msg };
      },
    };
    input._fone = api;
    return api;
  }

  window.EterFone = { montar, PAISES };
})();
