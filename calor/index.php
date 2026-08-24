<?php
/* ═══ O MAPA DE CALOR DA PORTA ════════════════════════════════
   A leitura dos pontos que o sensor coletou: o funil em números e os
   toques desenhados POR CIMA da própria página, ao vivo. Protegido
   pela chave da casa. */
$CHAVE = 'vanguarda-2026';
if (($_GET['chave'] ?? '') !== $CHAVE) { http_response_code(404); exit('nada aqui'); }
$ARQ = dirname(__DIR__) . '/pontos-b7k2f9.ndjson';
$linhas = file_exists($ARQ) ? file($ARQ, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) : [];
$eventos = [];
foreach ($linhas as $l) { $j = json_decode($l, true); if ($j) $eventos[] = $j; }
?><!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Mapa de calor — Porta ETER</title>
<style>
:root{--papel:#F2EEE6;--tinta:#1E1813;--tinta2:#5A5044;--ouro:#8F7333;--verde:#0F1F18;--linha:rgba(30,24,19,.14)}
*{box-sizing:border-box}
body{margin:0;background:var(--papel);color:var(--tinta);font:400 14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:1.4rem}
h1{font-family:Georgia,serif;font-weight:400;font-size:1.7rem;margin:0 0 .2rem}
.sub{color:var(--tinta2);margin:0 0 1.4rem}
table{border-collapse:collapse;background:#fff;font-size:.82rem;margin-bottom:1.6rem;min-width:34rem}
th,td{padding:.45rem .8rem;border:1px solid var(--linha);text-align:left}
th{background:var(--verde);color:#F0EAE0;font-weight:600}
td.n{text-align:right;font-variant-numeric:tabular-nums;color:var(--ouro);font-weight:600}
.painel{display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;margin:0 0 .8rem}
select,button{font:inherit;padding:.4rem .7rem;border:1px solid var(--linha);background:#fff;border-radius:2px}
button{background:var(--ouro);color:#fff;border:0;cursor:pointer}
#quadro{position:relative;border:1px solid var(--linha);width:100%;max-width:64rem;height:78vh;overflow:auto;background:#fff}
#tela{width:100%;height:100%;border:0;display:block}
.caixa{overflow-x:auto}
.dica{color:var(--tinta2);font-size:.78rem;margin-top:.5rem}
</style>
</head>
<body>
<h1>Mapa de calor — Porta ETER</h1>
<p class="sub"><?php echo count($eventos); ?> pontos coletados. Os toques são desenhados por cima da página real.</p>

<div class="caixa"><table id="funil"></table></div>
<div class="caixa"><table id="canais"></table></div>

<div class="painel">
  <label>Página: <select id="qual"></select></label>
  <label><input type="checkbox" id="so-cel" checked> só celular</label>
  <button id="ver">Desenhar o calor</button>
  <span id="conta"></span>
</div>
<div id="quadro"><iframe id="tela" src="about:blank"></iframe></div>
<p class="dica">Bolha maior e mais quente = mais toques naquele ponto. A rolagem média por página está na tabela do funil.</p>

<script>
const DADOS = <?php echo json_encode($eventos, JSON_UNESCAPED_UNICODE); ?>;

/* ── o funil em números ─────────────────────────────────────── */
const ordem = ['vista','clicou_ler','virou_lead','abriu_leitura','abriu_oferta','clicou_passe','foi_ao_checkout'];
const porEvento = {};
const porPagina = {};
const porCanal = {};
for (const e of DADOS) {
  const nome = e.t === 'funil' ? e.ev : e.t;
  porEvento[nome] = (porEvento[nome] || 0) + 1;
  if (e.t === 'vista') {
    porPagina[e.p] = porPagina[e.p] || { vistas: 0, rolagens: [], toques: 0 };
    porPagina[e.p].vistas++;
    const canal = (e.us || 'direto') + ' · ' + (e.um || '—');
    porCanal[canal] = porCanal[canal] || { vistas: 0, checkouts: 0 };
    porCanal[canal].vistas++;
  }
  if (e.t === 'rolou' && porPagina[e.p]) porPagina[e.p].rolagens.push(e.ate || 0);
  if (e.t === 'toque') { porPagina[e.p] = porPagina[e.p] || { vistas: 0, rolagens: [], toques: 0 }; porPagina[e.p].toques++; }
  if (e.t === 'funil' && e.ev === 'foi_ao_checkout') {
    const canal = (e.us || 'direto') + ' · ' + (e.um || '—');
    porCanal[canal] = porCanal[canal] || { vistas: 0, checkouts: 0 };
    porCanal[canal].checkouts++;
  }
}
document.getElementById('funil').innerHTML =
  '<tr><th>Página</th><th>Vistas</th><th>Toques</th><th>Rolagem média</th></tr>' +
  Object.entries(porPagina).sort((a,b)=>b[1].vistas-a[1].vistas).map(([p,d]) => {
    const rm = d.rolagens.length ? Math.round(100*d.rolagens.reduce((s,x)=>s+x,0)/d.rolagens.length)+'%' : '—';
    return `<tr><td>${p}</td><td class="n">${d.vistas}</td><td class="n">${d.toques}</td><td class="n">${rm}</td></tr>`;
  }).join('') +
  `<tr><th colspan="4">O funil</th></tr>` +
  ordem.filter(o=>porEvento[o]).map(o=>`<tr><td>${o}</td><td class="n" colspan="3">${porEvento[o]}</td></tr>`).join('');

document.getElementById('canais').innerHTML =
  '<tr><th>Canal (utm_source · utm_medium)</th><th>Vistas</th><th>Checkouts</th></tr>' +
  Object.entries(porCanal).sort((a,b)=>b[1].vistas-a[1].vistas).map(([c,d]) =>
    `<tr><td>${c}</td><td class="n">${d.vistas}</td><td class="n">${d.checkouts}</td></tr>`).join('');

/* ── o desenho sobre a página ───────────────────────────────── */
const qual = document.getElementById('qual');
[...new Set(DADOS.filter(e=>e.t==='toque').map(e=>e.p))].sort().forEach(p => {
  const o = document.createElement('option'); o.value = o.textContent = p; qual.append(o);
});
document.getElementById('ver').addEventListener('click', () => {
  const p = qual.value; if (!p) return;
  const soCel = document.getElementById('so-cel').checked;
  const tela = document.getElementById('tela');
  tela.src = p + (p.includes('?') ? '&' : '?') + 'semcalor=1';
  tela.addEventListener('load', () => {
    setTimeout(() => {
      const doc = tela.contentDocument;
      const dw = doc.documentElement.scrollWidth, dh = doc.documentElement.scrollHeight;
      const capa = doc.createElement('canvas');
      capa.width = dw; capa.height = dh;
      capa.style.cssText = `position:absolute;top:0;left:0;width:${dw}px;height:${dh}px;pointer-events:none;z-index:99999`;
      doc.body.append(capa);
      const cx = capa.getContext('2d');
      const pontos = DADOS.filter(e => e.t==='toque' && e.p===p && (!soCel || e.cel));
      for (const t of pontos) {
        const g = cx.createRadialGradient(t.x*dw, t.y*dh, 2, t.x*dw, t.y*dh, 26);
        g.addColorStop(0, 'rgba(220,40,30,.55)');
        g.addColorStop(.6, 'rgba(240,150,30,.25)');
        g.addColorStop(1, 'rgba(240,150,30,0)');
        cx.fillStyle = g;
        cx.beginPath(); cx.arc(t.x*dw, t.y*dh, 26, 0, 7); cx.fill();
      }
      document.getElementById('conta').textContent = pontos.length + ' toques desenhados';
    }, 2500);
  }, { once: true });
});
</script>
</body>
</html>
