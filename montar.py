# Monta a home dobra por dobra (protótipo local). Pedido do Rei (08/11): cada dobra nova entra
# embaixo da anterior, para ele ver a página inteira. A primeira dobra vem da aprovada
# (../primeira-dobra/biblioteca.html) sem mudar o desenho; as dobras seguintes vêm de DOBRAS.
# Rodar: python3 montar.py  -> escreve index.html
import pathlib, re

AQUI = pathlib.Path(__file__).resolve().parent
base = (AQUI.parent / 'primeira-dobra' / 'biblioteca.html').read_text(encoding='utf-8')
DOBRAS = [AQUI.parent / 'segunda-dobra' / 'dobra.html']

def troca(texto, velho, novo):
    assert velho in texto, velho
    return texto.replace(velho, novo, 1)

h = base
h = troca(h, '<title>ETER · primeira dobra · Biblioteca</title>', '<title>ETER — Inteligência cultural e repertório polímata</title>\n'
          '<meta name="description" content="A revista semanal e a comunidade de quem vive das próprias ideias. Leia uma edição completa por mês, de graça.">\n'
          '<link rel="icon" type="image/png" sizes="32x32" href="img/favicon-32.png"><link rel="apple-touch-icon" href="img/favicon-180.png"><meta name="theme-color" content="#190808">')
# auditoria 09/11: o seletor de cor da fase de escolha reescrevia o endereço para ?cor=...&layout=..., apagando as UTMs e o j=
# do embaixador antes de a compra lê-los. O endereço fica como a pessoa chegou.
h = troca(h, "function sincroniza(){try{history.replaceState(null,'','?cor='+document.documentElement.dataset.cor+'&layout='+document.documentElement.dataset.layout+(q.get('bt')?'&bt='+encodeURIComponent(q.get('bt')):''))}catch(e){}}", 'function sincroniza(){}')
# o seletor de cores era só da fase de escolha da primeira dobra
h = re.sub(r'<div class="controle" id="controle">.*?</div>\n', '', h, count=1, flags=re.S)
# celular: a barra de endereço some ao rolar e dispara "resize"; o fundo só se remonta se a largura mudar
h = troca(h, "let rt; addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(monta,250)});",
          "let rt, larg0=innerWidth; addEventListener('resize',()=>{if(innerWidth===larg0) return; larg0=innerWidth; clearTimeout(rt);rt=setTimeout(monta,250)});")
# a barra do topo não tem fundo na primeira dobra; depois dela, sobre o fundo claro, ganha o fundo escuro da marca
extra = '''<style>
.barra{transition:background .3s,box-shadow .3s}
/* Rei, 09/11: sem fundo só com a página parada no topo; ao começar a rolar, a barra escura com sombra, para não passar por cima do título */
.barra.rolou{background:rgba(25,8,8,.96)!important;box-shadow:0 10px 30px -12px rgba(0,0,0,.6)}
/* Rei, 09/11: a primeira dobra rola junto com a página; a folha branca sobe no primeiro movimento e
   para na metade da tela, com espaço abaixo dos botões, e nunca passa por cima deles */
.dobra{position:relative;z-index:0}
.dobra .escurece{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;z-index:25}
</style>
<script>(()=>{const b=document.querySelector('.barra'),d=document.querySelector('.dobra');if(!b||!d)return;
const v=document.createElement('div');v.className='escurece';d.appendChild(v);
const f=()=>{b.classList.toggle('rolou',scrollY>4)};
addEventListener('scroll',f,{passive:true});f()})()</script>
'''
# links reais da primeira dobra e da barra (Rei, 08/11: o botão Assine rola até a assinatura)
REV = 'https://eterbrasil.com/revista/'
for velho, novo in [('<a class="logo" href="#"', '<a class="logo" href="#topo"'),
                    ('<a class="atual" href="#">Home</a>', '<a class="atual" href="#topo">Home</a>'),
                    ('<a href="#">Edições</a>', f'<a href="{REV}biblioteca/">Edições</a>'),
                    ('<a href="#">Bibliografia</a>', f'<a href="{REV}bibliografia/">Bibliografia</a>'),
                    ('<a class="assine" href="#">Assine</a>', '<a class="assine" href="#assinatura">Assine</a>'),
                    ('<a class="bt um" href="#">Assine a ETER</a>', '<a class="bt um" href="#assinatura">Assine a ETER</a>'),
                    ('<a class="bt dois" id="bt2" href="#">Conheça a revista</a>', f'<a class="bt dois" id="bt2" href="{REV}biblioteca/">Conheça a revista</a>'),
                    ('<section class="dobra">', '<section class="dobra" id="topo">')]:
    if velho in h: h = h.replace(velho, novo, 1)
    else: print('aviso: não achei', velho[:40])
h = h.replace('<html lang="pt-BR">', '<html lang="pt-BR" style="scroll-behavior:smooth">', 1)
corpo = (AQUI / 'pagina.html').read_text(encoding='utf-8')
# Rei, 09/11: o Assine das outras páginas abre a home já na oferta (#assinatura). O script da primeira dobra reescreve o
# endereço ao carregar e apagaria o #; o destino é guardado no <head>, antes dele, e a página desce até lá ao terminar.
h = troca(h, '</head>', "<script>window.__destino=location.hash;</script>\n</head>")
# auditoria 09/11: a home também guarda o j= do embaixador por 30 dias (eter_j), como o site de hoje; a compra lê esse registro
import sys; sys.path.insert(0, str(AQUI.parent)); from comum import J30, og
h = troca(h, '</head>', J30 + '\n<script defer src="../premium/calor.js"></script>\n' + og('ETER — Inteligência cultural e repertório polímata', 'A revista semanal e a comunidade de quem vive das próprias ideias. Leia uma edição completa por mês, de graça.', '', 'og.jpg') + '</head>')
extra += """<script>addEventListener('load',()=>{const d=window.__destino;if(!d||d.length<2)return;const el=document.getElementById(d.slice(1));if(!el)return;
 const s=document.getElementById('o-que-e');if(s){s.style.transition='none';s.classList.remove('baixa')}
 document.documentElement.style.scrollBehavior='auto';
 const vai=()=>scrollTo(0,el.getBoundingClientRect().top+scrollY);vai();setTimeout(vai,400);setTimeout(()=>{if(s)s.style.transition=''},500)})</script>
"""
final = troca(h, '</body>', corpo + '\n' + extra + '</body>')
# Protótipo (09/11): os links para as outras páginas novas apontam para os arquivos locais, como nas demais páginas,
# para o site inteiro ser navegável na lateral. Na publicação voltam aos endereços oficiais (eterbrasil.com/revista/...).
for velho, novo in [(REV + 'biblioteca/', '../biblioteca/index.html'), (REV + 'bibliografia/', '../bibliografia/index.html'),
                    (REV + '${c}/', '../edicao/${c}/index.html')]:
    final = final.replace(velho, novo)
(AQUI / 'index.html').write_text(final, encoding='utf-8')
print('index.html: primeira dobra + página de venda')
