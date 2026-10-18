# Ateliê do Sabor

Landing page de uma escola de culinária fictícia, com dois cursos presenciais e formulário de pré-inscrição:

- **Culinária Essencial**: a partir de 13 anos, para quem quer aprender a cozinhar do zero.
- **Culinária Kids**: crianças de 6 a 12 anos, cozinhando em dupla com um responsável.

**Site publicado:** https://jnnetto.github.io/atelie-do-sabor/

## Tecnologias

HTML, CSS e JavaScript puros, sem frameworks nem etapa de build. As únicas dependências externas são as fontes Fredoka e Figtree, do Google Fonts.

## Estrutura

```
index.html          página única
404.html            página de erro do GitHub Pages
css/style.css       estilos (tema claro e escuro)
js/script.js        abertura animada (WebGL), formulário, datas das turmas
img/                fotos otimizadas (WebP + JPG) e imagem de compartilhamento
icons/              favicon e ícones para a tela inicial
site.webmanifest    nome e ícones ao adicionar o site à tela inicial
.nojekyll           pede ao GitHub Pages que publique os arquivos como estão
```

## Como rodar localmente

Abra o `index.html` no navegador ou, para testar como no servidor, rode na pasta do projeto:

```bash
python -m http.server 8080
```

e acesse http://localhost:8080.

## Publicação

O site é publicado pelo GitHub Pages a partir da raiz da branch `main`. Qualquer push nessa branch atualiza o site em 1 a 2 minutos.

## Formulário

Não há back-end: a validação, as mensagens de erro e a confirmação acontecem na própria página, e nenhum dado é enviado ou armazenado.

## Créditos

Fotos de Shixart1985, via Wikimedia Commons, sob licença [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/deed.pt-br). As imagens foram recortadas e redimensionadas. Os links de cada foto estão no rodapé do site.

Ateliê do Sabor, Chef Helena Duarte, endereço e contatos são fictícios.
