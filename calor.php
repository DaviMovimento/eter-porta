<?php
/* ═══ O COLETOR DO MAPA DE CALOR ══════════════════════════════
   Recebe, do próprio site, os toques, a rolagem e os eventos do
   funil, e os guarda num arquivo de linhas JSON. Nada de terceiros:
   o dado nasce e mora no domínio da ETER.
   Sem PII além do que o funil já trata; o arquivo tem teto de 12 MB
   e o nome carrega um sufixo que não se adivinha. */
$ARQ = __DIR__ . '/pontos-b7k2f9.ndjson';
$CHAVE = 'vanguarda-2026';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $b = file_get_contents('php://input');
  if ($b === false || strlen($b) > 30000) { http_response_code(413); exit; }
  $j = json_decode($b, true);
  if (!$j || !isset($j['e']) || !is_array($j['e'])) { http_response_code(400); exit; }
  if (file_exists($ARQ) && filesize($ARQ) > 12 * 1024 * 1024) { echo 'cheio'; exit; }
  $linhas = '';
  foreach (array_slice($j['e'], 0, 50) as $ev) {
    if (!is_array($ev)) continue;
    $linhas .= json_encode($ev, JSON_UNESCAPED_UNICODE) . "\n";
  }
  if ($linhas !== '') file_put_contents($ARQ, $linhas, FILE_APPEND | LOCK_EX);
  header('Content-Type: text/plain'); echo 'ok'; exit;
}

/* leitura: só com a chave */
if (($_GET['chave'] ?? '') === $CHAVE) {
  header('Content-Type: text/plain; charset=utf-8');
  if (file_exists($ARQ)) readfile($ARQ); else echo '';
  exit;
}
http_response_code(404); echo 'nada aqui';
