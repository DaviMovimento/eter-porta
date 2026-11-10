<?php
/* ═══ O COLETOR DO MAPA DE CALOR ══════════════════════════════
   Recebe, do próprio site, os toques, a rolagem e os eventos do
   funil, e os guarda num arquivo de linhas JSON. Nada de terceiros:
   o dado nasce e mora no domínio da ETER.
   Sem PII além do que o funil já trata; o arquivo tem teto de 64 MB
   e não abre pelo navegador (ver calor/base.php). */
/* chave, arquivos e gravação: calor/base.php (10/11/2026) */
require __DIR__ . '/calor/base.php';
calor_migra();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $b = file_get_contents('php://input');
  if ($b === false || strlen($b) > 30000) { http_response_code(413); exit; }
  $j = json_decode($b, true);
  if (!$j || !isset($j['e']) || !is_array($j['e'])) { http_response_code(400); exit; }
  /* o teto era 12 MB e encheu às 23:32 de 25/10, no lançamento da ED014: o
     sensor parou de gravar sem aviso. Agora são 64 MB; a cópia do que havia
     até ali está em porta/dados-sensor/. O teto agora fica em calor/base.php. */
  $linhas = '';
  foreach (array_slice($j['e'], 0, 50) as $ev) {
    if (!is_array($ev)) continue;
    $linhas .= json_encode($ev, JSON_UNESCAPED_UNICODE) . "\n";
  }
  $r = $linhas !== '' ? calor_grava($linhas) : 'ok';
  header('Content-Type: text/plain'); echo $r; exit;
}

/* leitura: só com a chave */
if (calor_chave_ok()) {
  header('Content-Type: text/plain; charset=utf-8');
  calor_le(function ($l) { echo $l; });
  exit;
}
http_response_code(404); echo 'nada aqui';
