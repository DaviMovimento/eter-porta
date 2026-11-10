<?php
/* ═══ BASE DO SENSOR (10/11/2026) ═══════════════════════════════
   Usada pelo coletor (../calor.php) e pelo painel (index.php).
   - A chave de leitura não fica escrita aqui: o repositório é público.
     Fica só a impressão SHA-256 dela, da qual não se tira a chave.
     A chave mora em ~/Vida/.credenciais/calor-sensor.env, no Mac.
   - Os pontos ficam em arquivos .php que começam por uma linha que
     encerra a execução: abertos pelo navegador, não mostram nada.
     O arquivo antigo (.ndjson) abria direto para qualquer pessoa. */
if (!defined('CALOR_DIR')) define('CALOR_DIR', dirname(__DIR__));
const CALOR_IMPRESSAO = '67614b018069032661f91c21ce622791869dd3bff9da50872b29ebc875e7a758';
const CALOR_GUARDA = "<?php http_response_code(404); exit; ?>\n";
const CALOR_TETO = 64 * 1024 * 1024;

function calor_arquivos() {
  return [
    'velho'   => CALOR_DIR . '/pontos-b7k2f9.ndjson',
    'arquivo' => CALOR_DIR . '/pontos-ae48cb553711-ate-1011.php',
    'atual'   => CALOR_DIR . '/pontos-ae48cb553711.php',
  ];
}

/* a chave vem no cabeçalho X-Chave (rotina do funil) ou em ?chave= (painel no navegador) */
function calor_chave_ok() {
  $c = $_SERVER['HTTP_X_CHAVE'] ?? ($_GET['chave'] ?? '');
  return is_string($c) && $c !== '' && hash_equals(CALOR_IMPRESSAO, hash('sha256', $c));
}

/* move o .ndjson público para um arquivo protegido, uma vez só:
   copia, confere o tamanho e só então apaga o velho */
function calor_migra() {
  $a = calor_arquivos();
  if (!file_exists($a['velho'])) return;
  $trava = fopen(CALOR_DIR . '/pontos-ae48cb553711.trava', 'c');
  if (!$trava || !flock($trava, LOCK_EX | LOCK_NB)) return;
  clearstatcache();
  if (file_exists($a['velho']) && !file_exists($a['arquivo'])) {
    $tam = filesize($a['velho']);
    $tmp = $a['arquivo'] . '.parcial.php';
    $o = fopen($tmp, 'wb'); $i = fopen($a['velho'], 'rb');
    $ok = $o && $i && fwrite($o, CALOR_GUARDA) === strlen(CALOR_GUARDA)
          && stream_copy_to_stream($i, $o) === $tam;
    if ($i) fclose($i); if ($o) fclose($o);
    if ($ok && filesize($tmp) === strlen(CALOR_GUARDA) + $tam && rename($tmp, $a['arquivo'])) unlink($a['velho']);
    else if (file_exists($tmp)) unlink($tmp);
  }
  flock($trava, LOCK_UN); fclose($trava);
}

/* grava linhas no arquivo atual, criando-o com a linha de guarda */
function calor_grava($linhas) {
  $f = calor_arquivos()['atual'];
  clearstatcache();
  if (file_exists($f) && filesize($f) > CALOR_TETO) return 'cheio';
  $h = fopen($f, 'ab'); if (!$h) return 'erro';
  flock($h, LOCK_EX);
  if (fstat($h)['size'] === 0) fwrite($h, CALOR_GUARDA);
  fwrite($h, $linhas);
  flock($h, LOCK_UN); fclose($h);
  return 'ok';
}

/* devolve os pontos em ordem: o arquivo de antes de 10/11 e depois o atual,
   sem a linha de guarda; se a migração ainda não rodou, lê o .ndjson velho */
function calor_le($cada) {
  $a = calor_arquivos();
  $fontes = file_exists($a['arquivo']) ? [$a['arquivo'], $a['atual']] : [$a['velho'], $a['atual']];
  foreach ($fontes as $f) {
    if (!file_exists($f)) continue;
    $h = fopen($f, 'rb'); if (!$h) continue;
    $primeira = fgets($h);
    if ($primeira !== false && $primeira !== CALOR_GUARDA) $cada($primeira);
    while (($l = fgets($h)) !== false) $cada($l);
    fclose($h);
  }
}
