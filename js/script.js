(function () {
  "use strict";

  var root = document.documentElement;
  var reduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ============ Abertura: gradiente animado em WebGL ============ */
  var VERTEX_SHADER = [
    "attribute vec2 position;",
    "varying vec2 vUv;",
    "void main() {",
    "  vUv = position * 0.5 + 0.5;",
    "  gl_Position = vec4(position, 0.0, 1.0);",
    "}"
  ].join("\n");

  var FRAGMENT_SHADER = [
    "precision highp float;",
    "varying vec2 vUv;",
    "uniform vec2 u_resolution;",
    "uniform float u_time;",
    "uniform float u_grain;",
    "uniform vec3 u_colors[4];",
    "uniform vec3 u_bg;",
    "vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }",
    "float snoise(vec2 v) {",
    "  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);",
    "  vec2 i = floor(v + dot(v, C.yy));",
    "  vec2 x0 = v - i + dot(i, C.xx);",
    "  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);",
    "  vec4 x12 = x0.xyxy + C.xxzz;",
    "  x12.xy -= i1;",
    "  i = mod(i, 289.0);",
    "  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));",
    "  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);",
    "  m = m * m; m = m * m;",
    "  vec3 x = 2.0 * fract(p * C.www) - 1.0;",
    "  vec3 h = abs(x) - 0.5;",
    "  vec3 ox = floor(x + 0.5);",
    "  vec3 a0 = x - ox;",
    "  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);",
    "  vec3 g;",
    "  g.x = a0.x * x0.x + h.x * x0.y;",
    "  g.yz = a0.yz * x12.xz + h.yz * x12.yw;",
    "  return 130.0 * dot(m, g);",
    "}",
    "void main() {",
    "  vec2 uv = vUv;",
    "  float ratio = u_resolution.x / u_resolution.y;",
    "  vec2 p = uv - 0.5;",
    "  p.x *= ratio;",
    "  float t = u_time * 0.1;",
    "  float n1 = snoise(p * 0.4 + vec2(t * 0.2, -t * 0.3));",
    "  float n2 = snoise(p * 0.55 + vec2(-t * 0.15, t * 0.25) + n1 * 0.25);",
    "  float n3 = snoise(p * 0.75 + vec2(t * 0.1, -t * 0.2) + n2 * 0.2);",
    "  vec3 col = u_bg;",
    "  float dist = length(p) * 1.5;",
    "  float vignette = 1.0 - smoothstep(0.3, 1.2, dist);",
    "  col = mix(col, u_colors[0], smoothstep(-0.2, 0.5, n1) * 0.85);",
    "  col = mix(col, u_colors[1], smoothstep(-0.1, 0.6, n2) * 0.7);",
    "  col = mix(col, u_colors[2], smoothstep(-0.3, 0.4, n3) * 0.6);",
    "  col = mix(col, u_colors[3], smoothstep(0.0, 0.7, n1 * n2) * 0.5);",
    "  float glow = smoothstep(0.8, 0.0, dist) * 0.3;",
    "  col += u_colors[1] * glow;",
    "  col = mix(col * 0.2, col, vignette);",
    "  float grain = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453 + u_time);",
    "  col += (grain - 0.5) * u_grain * 0.1;",
    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");

  function hexParaRgb(hex) {
    var h = hex.replace("#", "");
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  }

  function iniciarGradiente(canvas, opcoes) {
    if (!canvas) return;
    var gl = canvas.getContext("webgl", { antialias: false, powerPreference: "low-power" });
    if (!gl) return;

    function compilar(tipo, fonte) {
      var shader = gl.createShader(tipo);
      gl.shaderSource(shader, fonte);
      gl.compileShader(shader);
      return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
    }

    var vs = compilar(gl.VERTEX_SHADER, VERTEX_SHADER);
    var fs = compilar(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return;

    var programa = gl.createProgram();
    gl.attachShader(programa, vs);
    gl.attachShader(programa, fs);
    gl.linkProgram(programa);
    if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) return;
    gl.useProgram(programa);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var posicao = gl.getAttribLocation(programa, "position");
    gl.enableVertexAttribArray(posicao);
    gl.vertexAttribPointer(posicao, 2, gl.FLOAT, false, 0, 0);

    var uResolucao = gl.getUniformLocation(programa, "u_resolution");
    var uTempo = gl.getUniformLocation(programa, "u_time");
    gl.uniform1f(gl.getUniformLocation(programa, "u_grain"), opcoes.grain);
    gl.uniform3fv(gl.getUniformLocation(programa, "u_bg"), hexParaRgb(opcoes.bg));
    var cores = [];
    opcoes.colors.forEach(function (c) { cores = cores.concat(hexParaRgb(c)); });
    gl.uniform3fv(gl.getUniformLocation(programa, "u_colors"), new Float32Array(cores));

    var container = canvas.parentElement;
    var animando = false;
    var raf = 0;
    var tempoParado = 14;

    function desenhar(ms) {
      var segundos = reduzirMovimento.matches ? tempoParado : 14 + ms * 0.001 * opcoes.speed;
      gl.uniform2f(uResolucao, canvas.width, canvas.height);
      gl.uniform1f(uTempo, segundos);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function quadro(ms) {
      desenhar(ms);
      canvas.classList.add("is-ready");
      raf = animando ? requestAnimationFrame(quadro) : 0;
    }

    function atualizarAnimacao(deveAnimar) {
      animando = deveAnimar && !reduzirMovimento.matches;
      if (animando && !raf) raf = requestAnimationFrame(quadro);
      if (!animando && !raf) desenhar(performance.now());
    }

    function redimensionar() {
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.round(container.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(container.clientHeight * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (!animando) desenhar(performance.now());
    }

    if ("ResizeObserver" in window) new ResizeObserver(redimensionar).observe(container);
    else window.addEventListener("resize", redimensionar);
    redimensionar();

    var naTela = true;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entradas) {
        naTela = entradas[0].isIntersecting;
        atualizarAnimacao(naTela && !document.hidden);
      }).observe(container);
    }
    document.addEventListener("visibilitychange", function () {
      atualizarAnimacao(naTela && !document.hidden);
    });
    reduzirMovimento.addEventListener("change", function () {
      atualizarAnimacao(naTela && !document.hidden);
    });

    raf = requestAnimationFrame(quadro);
    atualizarAnimacao(true);
  }

  iniciarGradiente(document.getElementById("introCanvas"), {
    bg: "#0E1F19",
    colors: ["#1F6650", "#2E8B66", "#F2A93C", "#D1452B"],
    speed: 1.2,
    grain: 0.25
  });

  /* ============ Abertura: painel que levanta e apresenta o site ============ */
  var intro = document.getElementById("abertura");
  var partesDaPagina = document.querySelectorAll(".site-header, main, .site-footer");
  var DURACAO_FECHAR = 1050;
  var DURACAO_ABRIR = 750;
  var emTransicao = false;
  var posicaoAntesDeReabrir = 0;
  var primeiraEntrada = true;

  function introAberta() {
    return root.classList.contains("intro-open");
  }

  function bloquearPagina(bloquear) {
    partesDaPagina.forEach(function (el) {
      if (bloquear) el.setAttribute("inert", "");
      else el.removeAttribute("inert");
    });
  }
  if (introAberta()) bloquearPagina(true);

  function duracao(ms) {
    return reduzirMovimento.matches ? 60 : ms;
  }

  function focar(alvo) {
    if (!alvo.hasAttribute("tabindex")) alvo.setAttribute("tabindex", "-1");
    alvo.focus({ preventScroll: true });
  }

  function ehCurso(alvo) {
    return alvo.id === "curso-essencial" || alvo.id === "curso-kids";
  }

  function fecharIntro(id) {
    if (!introAberta() || emTransicao) return;
    emTransicao = true;
    var alvoDoEndereco = primeiraEntrada && location.hash ? document.getElementById(location.hash.slice(1)) : null;
    if (alvoDoEndereco && intro.contains(alvoDoEndereco)) alvoDoEndereco = null;
    primeiraEntrada = false;
    var alvo = document.getElementById(id) || alvoDoEndereco || document.getElementById("conteudo-principal");

    if (ehCurso(alvo)) {
      if (!cursoSelecionado()) selecionarCurso(alvo.id === "curso-kids" ? "kids" : "essencial");
      alvo.style.transition = "none";
      alvo.classList.add("is-visible");
      void alvo.offsetHeight;
      alvo.style.transition = "";
    }

    bloquearPagina(false);
    if (alvo.id !== "conteudo-principal") alvo.scrollIntoView({ block: "start", behavior: "instant" });
    else window.scrollTo({ top: posicaoAntesDeReabrir, behavior: "instant" });
    posicaoAntesDeReabrir = 0;

    root.classList.add("intro-revealing");
    intro.classList.add("is-closing");

    setTimeout(function () {
      root.classList.remove("intro-open", "intro-revealing");
      intro.classList.remove("is-closing");
      emTransicao = false;
      focar(alvo);
      if (ehCurso(alvo)) {
        alvo.classList.add("is-destaque");
        setTimeout(function () { alvo.classList.remove("is-destaque"); }, 3000);
      }
    }, duracao(DURACAO_FECHAR));
  }

  function abrirIntro() {
    if (introAberta() || emTransicao) return;
    emTransicao = true;
    posicaoAntesDeReabrir = window.scrollY;
    root.classList.add("intro-open");
    intro.classList.add("is-opening");
    intro.scrollTop = 0;
    bloquearPagina(true);

    setTimeout(function () {
      intro.classList.remove("is-opening");
      emTransicao = false;
      var primeiroCaminho = intro.querySelector(".intro-path");
      if (primeiroCaminho) primeiroCaminho.focus({ preventScroll: true });
    }, duracao(DURACAO_ABRIR));
  }

  document.addEventListener("click", function (e) {
    var link = e.target.closest("a[href^='#']");
    if (!link) return;
    var id = link.getAttribute("href").slice(1);

    if (id === "abertura") {
      e.preventDefault();
      abrirIntro();
      return;
    }
    if (!introAberta()) return;

    var alvo = document.getElementById(link.getAttribute("data-intro-alvo") || id);
    if (!alvo || intro.contains(alvo)) return;
    e.preventDefault();
    fecharIntro(alvo.id);
  });

  function introNoFim() {
    return intro.scrollTop + intro.clientHeight >= intro.scrollHeight - 2;
  }

  intro.addEventListener("wheel", function (e) {
    if (introAberta() && e.deltaY > 8 && introNoFim()) fecharIntro();
  }, { passive: true });

  var toqueInicioY = null;
  intro.addEventListener("touchstart", function (e) { toqueInicioY = e.touches[0].clientY; }, { passive: true });
  intro.addEventListener("touchmove", function (e) {
    if (toqueInicioY === null || !introAberta() || !introNoFim()) return;
    if (toqueInicioY - e.touches[0].clientY > 50) {
      toqueInicioY = null;
      fecharIntro();
    }
  }, { passive: true });

  document.addEventListener("keydown", function (e) {
    if (!introAberta()) return;
    if (e.key === "Escape") {
      fecharIntro();
      return;
    }
    if (["ArrowDown", "PageDown", " "].indexOf(e.key) === -1) return;
    if (e.target.closest("a, button, input, select, textarea") || !introNoFim()) return;
    e.preventDefault();
    fecharIntro();
  });

  window.addEventListener("hashchange", function () {
    var id = location.hash.slice(1);
    if (id === "abertura") abrirIntro();
    else if (id && introAberta()) fecharIntro(id);
  });

  /* ============ Menu mobile ============ */
  var navToggle = document.getElementById("navToggle");
  var siteNav = document.getElementById("navPrincipal");

  navToggle.addEventListener("click", function () {
    var isOpen = siteNav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
    navToggle.setAttribute("aria-label", isOpen ? "Fechar menu de navegação" : "Abrir menu de navegação");
  });

  siteNav.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      siteNav.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });

  /* ============ Reveal on scroll ============ */
  var revealTargets = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealTargets.forEach(function (el) { observer.observe(el); });
  } else {
    revealTargets.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ============ Contagem dos números ============ */
  function contar(el) {
    var final = parseInt(el.getAttribute("data-valor"), 10);
    var inicio = null;
    var DURACAO = 1200;
    function passo(agora) {
      if (inicio === null) inicio = agora;
      var progresso = Math.min((agora - inicio) / DURACAO, 1);
      var suave = 1 - Math.pow(1 - progresso, 3);
      el.textContent = String(Math.round(final * suave));
      if (progresso < 1) requestAnimationFrame(passo);
    }
    requestAnimationFrame(passo);
  }

  var numeros = document.querySelectorAll(".stat__num[data-valor]");
  if ("IntersectionObserver" in window && !reduzirMovimento.matches) {
    var observadorNumeros = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        if (!entrada.isIntersecting) return;
        contar(entrada.target);
        observadorNumeros.unobserve(entrada.target);
      });
    }, { threshold: 0.6 });
    numeros.forEach(function (el) { observadorNumeros.observe(el); });
  }

  /* ============ Próximas turmas e prazo de reembolso ============ */
  var REGRAS_INICIO = {
    manha: { diaSemana: 1, meses: null, nome: "da manhã" },
    noite: { diaSemana: 2, meses: null, nome: "da noite" },
    sabado: { diaSemana: 6, meses: [1, 3, 5, 7, 9], nome: "de sábado" }
  };

  function primeiroDiaDaSemana(ano, mes, diaSemana) {
    var dia = new Date(ano, mes, 1);
    return new Date(ano, mes, 1 + ((diaSemana - dia.getDay() + 7) % 7));
  }

  function proximosInicios(regra, aPartirDe, quantidade) {
    var datas = [];
    for (var i = 0; i < 36 && datas.length < quantidade; i++) {
      var data = primeiroDiaDaSemana(aPartirDe.getFullYear(), aPartirDe.getMonth() + i, regra.diaSemana);
      if (regra.meses && regra.meses.indexOf(data.getMonth()) === -1) continue;
      if (data > aPartirDe) datas.push(data);
    }
    return datas;
  }

  function formatarData(data, comDiaSemana) {
    var opcoes = { day: "numeric", month: "long" };
    if (comDiaSemana) opcoes.weekday = "long";
    if (data.getFullYear() !== new Date().getFullYear()) opcoes.year = "numeric";
    return data.toLocaleDateString("pt-BR", opcoes);
  }

  (function preencherDatas() {
    var hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    Object.keys(REGRAS_INICIO).forEach(function (chave) {
      var alvo = document.querySelector('[data-proxima="' + chave + '"]');
      var proxima = proximosInicios(REGRAS_INICIO[chave], hoje, 1)[0];
      if (!alvo || !proxima) return;
      alvo.textContent = "Próxima: " + formatarData(proxima, true);
      alvo.hidden = false;

      if (chave === "sabado") {
        var mes = document.querySelector('.meses__lista [data-mes="' + proxima.getMonth() + '"]');
        if (mes) mes.classList.add("is-proxima");
      }
    });

    var exemplo = document.querySelector("[data-exemplo-reembolso]");
    if (!exemplo) return;
    var inicios = proximosInicios(REGRAS_INICIO.manha, hoje, 2);
    for (var i = 0; i < inicios.length; i++) {
      var limite = new Date(inicios[i]);
      limite.setDate(limite.getDate() - 7);
      if (limite >= hoje) {
        exemplo.innerHTML = "Exemplo: na turma da manhã que começa em <strong>" + formatarData(inicios[i]) +
          "</strong>, dá para cancelar com reembolso integral até <strong>" + formatarData(limite) + "</strong>.";
        exemplo.hidden = false;
        break;
      }
    }
  })();

  /* ============ Pré-inscrição: dados dos cursos ============ */
  var CURSOS = {
    essencial: {
      nome: "Culinária Essencial",
      valor: "R$ 480 à vista ou 4x de R$ 130",
      idade: { min: 13, max: 120, dica: "A Culinária Essencial aceita alunos a partir de 13 anos, sem idade máxima." },
      turmas: [
        { id: "manha", nome: "Manhã", dias: "Seg. e qua.", horario: "8h às 11h", duracao: "4 semanas", regra: "manha" },
        { id: "noite", nome: "Noite", dias: "Ter. e qui.", horario: "19h às 22h", duracao: "4 semanas", regra: "noite" },
        { id: "sabado", nome: "Sábado", dias: "Sábados", horario: "14h às 17h", duracao: "8 semanas", regra: "sabado" }
      ]
    },
    kids: {
      nome: "Culinária Kids",
      valor: "R$ 560 por dupla ou 4x de R$ 150",
      idade: { min: 6, max: 12, dica: "A Culinária Kids é para crianças de 6 a 12 anos." },
      turmas: [
        { id: "kids-sabado", nome: "Sábado", dias: "Sábados", horario: "9h às 11h", duracao: "8 semanas", regra: "sabado" }
      ]
    }
  };

  var hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  function proximoInicio(regra) {
    return proximosInicios(REGRAS_INICIO[regra], hoje, 1)[0];
  }

  function prazoReembolso(inicio) {
    var limite = new Date(inicio);
    limite.setDate(limite.getDate() - 7);
    return limite;
  }

  /* ============ Pré-inscrição: elementos ============ */
  function $(id) { return document.getElementById(id); }

  var form = $("formInscricao");
  var opcoesTurma = $("opcoesTurma");
  var turmaVazia = $("turmaVazia");
  var legendaInscrito = $("legendaInscrito");
  var labelNomeInscrito = $("labelNomeInscrito");
  var labelIdadeInscrito = $("labelIdadeInscrito");
  var nomeInscritoEl = $("nomeInscrito");
  var idadeInscritoEl = $("idadeInscrito");
  var dicaIdade = $("dica-idadeInscrito");
  var blocoResponsavel = $("blocoResponsavel");
  var avisoResponsavel = $("avisoResponsavel");
  var nomeResponsavelEl = $("nomeResponsavel");
  var legendaContato = $("legendaContato");
  var labelEmail = $("labelEmail");
  var labelWhatsapp = $("labelWhatsapp");
  var emailEl = $("email");
  var whatsappEl = $("whatsapp");
  var semAlergiasEl = $("semAlergias");
  var outraRestricaoEl = $("outraRestricao");
  var campoAlergias = $("campoAlergias");
  var alergiasEl = $("alergias");
  var cienciaEl = $("ciencia");
  var formErros = $("formErros");
  var formErrosTitulo = $("formErrosTitulo");
  var formErrosLista = $("formErrosLista");
  var formSucesso = $("formSucesso");
  var sucessoTexto = $("sucessoTexto");
  var sucessoDados = $("sucessoDados");
  var resumo = document.querySelector(".resumo");

  function cursoSelecionado() {
    var marcado = form.querySelector('input[name="curso"]:checked');
    return marcado ? marcado.value : "";
  }

  function turmaSelecionada() {
    var curso = CURSOS[cursoSelecionado()];
    var marcado = form.querySelector('input[name="turma"]:checked');
    if (!curso || !marcado) return null;
    return curso.turmas.filter(function (t) { return t.id === marcado.value; })[0] || null;
  }

  function descreverTurma(turma) {
    var quando = turma.nome === "Sábado" ? turma.horario : turma.dias.toLowerCase() + ", " + turma.horario;
    return turma.nome + " · " + quando;
  }

  function ehKids() {
    return cursoSelecionado() === "kids";
  }

  function selecionarCurso(chave) {
    var opcao = $("curso-opcao-" + chave);
    if (opcao && !opcao.checked) {
      opcao.checked = true;
      atualizarCurso();
    }
  }

  /* ============ Pré-inscrição: turmas, responsável e resumo ============ */
  function renderizarTurmas() {
    var curso = CURSOS[cursoSelecionado()];
    opcoesTurma.innerHTML = "";
    turmaVazia.hidden = Boolean(curso);
    if (!curso) return;

    curso.turmas.forEach(function (turma) {
      var inicio = proximoInicio(turma.regra);
      var opcao = document.createElement("label");
      opcao.className = "opcao";
      opcao.innerHTML =
        '<input class="opcao__input" type="radio" name="turma" id="turma-opcao-' + turma.id + '" value="' + turma.id + '" aria-describedby="erro-turma">' +
        '<span class="opcao__corpo">' +
          '<span class="opcao__titulo">' + turma.nome + "</span>" +
          '<span class="opcao__meta">' + turma.dias + ", " + turma.horario + "</span>" +
          '<span class="opcao__meta">Duração: ' + turma.duracao + "</span>" +
          (inicio ? '<span class="opcao__inicio">Próximo início: ' + formatarData(inicio) + "</span>" : "") +
        "</span>" +
        '<span class="opcao__marca" aria-hidden="true"></span>';
      opcoesTurma.appendChild(opcao);
    });

    if (curso.turmas.length === 1) opcoesTurma.querySelector("input").checked = true;
  }

  function atualizarCurso() {
    var curso = CURSOS[cursoSelecionado()];
    var kids = ehKids();
    renderizarTurmas();

    legendaInscrito.textContent = kids ? "Quem é a criança?" : "Quem vai participar?";
    labelNomeInscrito.textContent = kids ? "Nome completo da criança" : "Nome completo";
    labelIdadeInscrito.textContent = kids ? "Idade da criança" : "Idade";
    if (curso) {
      idadeInscritoEl.min = curso.idade.min;
      idadeInscritoEl.max = curso.idade.max;
      dicaIdade.textContent = curso.idade.dica;
    }

    limparErro("curso");
    limparErro("turma");
    atualizarResponsavel();
    atualizarResumo();
    atualizarEtapas();
  }

  function precisaResponsavel() {
    if (ehKids()) return true;
    if (cursoSelecionado() !== "essencial") return false;
    var idade = parseInt(idadeInscritoEl.value, 10);
    return !isNaN(idade) && idade < 18;
  }

  function atualizarResponsavel() {
    var precisa = precisaResponsavel();
    blocoResponsavel.hidden = !precisa;
    nomeResponsavelEl.required = precisa;
    avisoResponsavel.textContent = ehKids()
      ? "Na Culinária Kids, a criança cozinha ao lado de um responsável, que também participa das aulas."
      : "Menores de 18 anos participam com a autorização de um responsável.";
    legendaContato.textContent = precisa ? "Como falamos com o responsável?" : "Como falamos com você?";
    labelWhatsapp.textContent = precisa ? "WhatsApp do responsável" : "WhatsApp";
    labelEmail.textContent = precisa ? "E-mail do responsável" : "E-mail";
    if (!precisa) {
      nomeResponsavelEl.value = "";
      limparErro("nomeResponsavel");
    }
  }

  function escreverResumo(chave, texto) {
    var el = resumo.querySelector('[data-resumo="' + chave + '"]');
    if (!el || el.textContent === texto) return;
    el.textContent = texto;
    el.classList.remove("is-atualizado");
    void el.offsetWidth;
    el.classList.add("is-atualizado");
  }

  function atualizarResumo() {
    var curso = CURSOS[cursoSelecionado()];
    var turma = turmaSelecionada();
    var inicio = turma ? proximoInicio(turma.regra) : null;
    var prazo = inicio ? prazoReembolso(inicio) : null;

    escreverResumo("curso", curso ? curso.nome : "Nenhum curso escolhido ainda");
    resumo.querySelector('[data-resumo="curso"]').classList.toggle("is-vazio", !curso);
    escreverResumo("turma", turma ? descreverTurma(turma) : "—");
    escreverResumo("inicio", inicio ? formatarData(inicio, true) : "—");
    escreverResumo("reembolso", prazo ? (prazo >= hoje ? formatarData(prazo) : "prazo encerrado") : "—");
    escreverResumo("valor", curso ? curso.valor : "—");
  }

  /* ============ Pré-inscrição: restrições alimentares ============ */
  function restricoesMarcadas() {
    return Array.prototype.map.call(form.querySelectorAll('input[name="restricao"]:checked'), function (el) {
      return el.value;
    });
  }

  function tratarRestricao(marcada) {
    if (marcada === semAlergiasEl && marcada.checked) {
      form.querySelectorAll('input[name="restricao"]').forEach(function (el) {
        if (el !== semAlergiasEl) el.checked = false;
      });
    } else if (marcada.checked) {
      semAlergiasEl.checked = false;
    }

    campoAlergias.hidden = !outraRestricaoEl.checked;
    if (!outraRestricaoEl.checked) alergiasEl.value = "";
    if (marcada === outraRestricaoEl && marcada.checked) alergiasEl.focus();
    if (restricoesMarcadas().length) limparErro("alergias");
  }

  /* ============ Pré-inscrição: máscara do WhatsApp ============ */
  whatsappEl.addEventListener("input", function () {
    var digitos = whatsappEl.value.replace(/\D/g, "").slice(0, 11);
    var formatado = digitos;
    if (digitos.length > 2) formatado = "(" + digitos.slice(0, 2) + ") " + digitos.slice(2);
    if (digitos.length > 6) {
      var corte = digitos.length === 11 ? 7 : 6;
      formatado = "(" + digitos.slice(0, 2) + ") " + digitos.slice(2, corte) + "-" + digitos.slice(corte);
    }
    whatsappEl.value = formatado;
  });

  /* ============ Pré-inscrição: validação ============ */
  var REGEX_NOME = /^[A-Za-zÀ-ÖØ-öø-ÿ'’\s]+$/;
  var REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function erroDeNome(valor, quem) {
    var v = valor.trim();
    if (!v) return "Informe " + quem + ".";
    if (!REGEX_NOME.test(v)) return "Use apenas letras no " + quem.replace(/^o /, "") + ".";
    if (v.split(/\s+/).length < 2) return "Digite nome e sobrenome.";
    return "";
  }

  var VALIDADORES = {
    curso: function () {
      return cursoSelecionado() ? "" : "Escolha um dos cursos.";
    },
    turma: function () {
      if (!cursoSelecionado()) return "Escolha um curso para ver as turmas.";
      return turmaSelecionada() ? "" : "Escolha uma das turmas.";
    },
    nomeInscrito: function () {
      return erroDeNome(nomeInscritoEl.value, ehKids() ? "o nome da criança" : "o nome completo");
    },
    idadeInscrito: function () {
      var curso = CURSOS[cursoSelecionado()];
      var idade = Number(idadeInscritoEl.value);
      if (!idadeInscritoEl.value) return ehKids() ? "Informe a idade da criança." : "Informe a idade.";
      if (!Number.isInteger(idade) || idade < 1 || idade > 120) return "Digite a idade em anos, só com números.";
      if (curso && (idade < curso.idade.min || idade > curso.idade.max)) {
        return ehKids()
          ? "A Culinária Kids é para crianças de 6 a 12 anos. A partir de 13, veja a Culinária Essencial."
          : "A Culinária Essencial é a partir de 13 anos. Para crianças de 6 a 12, veja a Culinária Kids.";
      }
      return "";
    },
    nomeResponsavel: function () {
      return precisaResponsavel() ? erroDeNome(nomeResponsavelEl.value, "o nome do responsável") : "";
    },
    whatsapp: function () {
      var digitos = whatsappEl.value.replace(/\D/g, "");
      if (!digitos) return "Informe um WhatsApp para contato.";
      if (digitos.length < 10) return "O número parece incompleto: inclua o DDD, como (00) 00000-0000.";
      return "";
    },
    email: function () {
      var v = emailEl.value.trim();
      if (!v) return "Informe um e-mail para contato.";
      if (!REGEX_EMAIL.test(v)) return "Confira o e-mail: ele precisa ter o formato nome@exemplo.com.";
      return "";
    },
    alergias: function () {
      if (!restricoesMarcadas().length) return "Marque “Nenhuma” ou as restrições de quem vai cozinhar.";
      if (outraRestricaoEl.checked && !alergiasEl.value.trim()) return "Conte qual é a outra restrição.";
      return "";
    },
    ciencia: function () {
      return cienciaEl.checked ? "" : "Confirme que leu a política de reembolso.";
    }
  };

  function contornoDoCampo(id) {
    if (id === "curso") return form.querySelector(".opcoes--2");
    if (id === "turma") return opcoesTurma;
    if (id === "alergias") return $("grupoRestricoes");
    if (id === "ciencia") return cienciaEl.closest(".confirmacao");
    var campo = $(id);
    return campo ? campo.closest(".field") : null;
  }

  function alvoDoCampo(id) {
    if (id === "curso") return form.querySelector('input[name="curso"]:checked') || $("curso-opcao-essencial");
    if (id === "turma") return opcoesTurma.querySelector("input") || $("curso-opcao-essencial");
    if (id === "alergias") return outraRestricaoEl.checked && !alergiasEl.value.trim() ? alergiasEl : semAlergiasEl;
    return $(id);
  }

  function mostrarErro(id, mensagem) {
    $("erro-" + id).textContent = mensagem;
    var contorno = contornoDoCampo(id);
    if (contorno) contorno.classList.add("is-invalid");
    var campo = $(id);
    if (campo) campo.setAttribute("aria-invalid", "true");
  }

  function limparErro(id) {
    var erro = $("erro-" + id);
    if (erro) erro.textContent = "";
    var contorno = contornoDoCampo(id);
    if (contorno) contorno.classList.remove("is-invalid");
    var campo = $(id);
    if (campo) campo.removeAttribute("aria-invalid");
  }

  function revalidarSeComErro(id) {
    if (!$("erro-" + id).textContent) return;
    var mensagem = VALIDADORES[id]();
    if (mensagem) mostrarErro(id, mensagem);
    else limparErro(id);
  }

  ["nomeInscrito", "idadeInscrito", "nomeResponsavel", "whatsapp", "email"].forEach(function (id) {
    var campo = $(id);
    campo.addEventListener("input", function () { revalidarSeComErro(id); });
    campo.addEventListener("blur", function () {
      if (!campo.value.trim()) return;
      var mensagem = VALIDADORES[id]();
      if (mensagem) mostrarErro(id, mensagem);
      else limparErro(id);
    });
  });
  alergiasEl.addEventListener("input", function () { revalidarSeComErro("alergias"); });

  function atualizarEtapas() {
    var completas = [
      !VALIDADORES.curso(),
      !VALIDADORES.turma(),
      !VALIDADORES.nomeInscrito() && !VALIDADORES.idadeInscrito() && !VALIDADORES.nomeResponsavel(),
      !VALIDADORES.whatsapp() && !VALIDADORES.email(),
      !VALIDADORES.alergias()
    ];
    form.querySelectorAll(".etapa").forEach(function (etapa, i) {
      etapa.classList.toggle("is-completa", Boolean(completas[i]));
    });
  }

  form.addEventListener("change", function (e) {
    var alvo = e.target;
    if (alvo.name === "curso") atualizarCurso();
    else if (alvo.name === "turma") {
      limparErro("turma");
      atualizarResumo();
    } else if (alvo.name === "restricao") tratarRestricao(alvo);
    else if (alvo === cienciaEl && cienciaEl.checked) limparErro("ciencia");
    atualizarEtapas();
  });
  form.addEventListener("input", atualizarEtapas);
  idadeInscritoEl.addEventListener("input", atualizarResponsavel);

  /* ============ Pré-inscrição: envio ============ */
  function rolarAte(el) {
    el.scrollIntoView({ behavior: reduzirMovimento.matches ? "auto" : "smooth", block: "center" });
  }

  function mostrarResumoDeErros(erros) {
    formErrosTitulo.textContent = erros.length === 1
      ? "Falta corrigir 1 item antes de enviar:"
      : "Falta corrigir " + erros.length + " itens antes de enviar:";
    formErrosLista.innerHTML = "";
    erros.forEach(function (erro) {
      var item = document.createElement("li");
      var link = document.createElement("a");
      link.href = "#" + alvoDoCampo(erro.id).id;
      link.textContent = erro.mensagem;
      link.addEventListener("click", function (e) {
        e.preventDefault();
        var alvo = alvoDoCampo(erro.id);
        rolarAte(alvo.closest(".etapa, .form-final") || alvo);
        alvo.focus({ preventScroll: true });
      });
      item.appendChild(link);
      formErrosLista.appendChild(item);
    });
    formErros.hidden = false;
    rolarAte(formErros);
    formErros.focus({ preventScroll: true });
  }

  function linhaDeResumo(rotulo, valor) {
    var linha = document.createElement("div");
    var dt = document.createElement("dt");
    var dd = document.createElement("dd");
    dt.textContent = rotulo;
    dd.textContent = valor;
    linha.appendChild(dt);
    linha.appendChild(dd);
    sucessoDados.appendChild(linha);
  }

  function mostrarSucesso() {
    var curso = CURSOS[cursoSelecionado()];
    var turma = turmaSelecionada();
    var inicio = proximoInicio(turma.regra);
    var prazo = prazoReembolso(inicio);
    var restricoes = restricoesMarcadas().filter(function (r) { return r !== "Outra"; });
    if (outraRestricaoEl.checked) restricoes.push(alergiasEl.value.trim());

    sucessoTexto.textContent = "Recebemos a pré-inscrição de " + nomeInscritoEl.value.trim() + " na " + curso.nome +
      ". A equipe do Ateliê vai confirmar a vaga pelo WhatsApp " + whatsappEl.value + ".";

    sucessoDados.innerHTML = "";
    linhaDeResumo("Turma", descreverTurma(turma));
    linhaDeResumo("Próximo início", formatarData(inicio, true));
    linhaDeResumo("Reembolso integral até", prazo >= hoje ? formatarData(prazo) : "prazo encerrado para esta turma");
    if (precisaResponsavel()) linhaDeResumo("Responsável", nomeResponsavelEl.value.trim());
    linhaDeResumo("Restrições", restricoes.join(", "));

    formErros.hidden = true;
    form.hidden = true;
    formSucesso.hidden = false;
    rolarAte(formSucesso);
    formSucesso.focus({ preventScroll: true });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var erros = [];
    Object.keys(VALIDADORES).forEach(function (id) {
      var mensagem = VALIDADORES[id]();
      if (mensagem) {
        mostrarErro(id, mensagem);
        erros.push({ id: id, mensagem: mensagem });
      } else {
        limparErro(id);
      }
    });

    if (erros.length) mostrarResumoDeErros(erros);
    else mostrarSucesso();
  });

  $("novaInscricao").addEventListener("click", function () {
    form.reset();
    campoAlergias.hidden = true;
    formErros.hidden = true;
    Object.keys(VALIDADORES).forEach(limparErro);
    atualizarCurso();
    formSucesso.hidden = true;
    form.hidden = false;
    rolarAte(form);
    $("curso-opcao-essencial").focus({ preventScroll: true });
  });

  /* Botões "Pré-inscrever-se" dos cards de curso já escolhem o curso */
  document.querySelectorAll("[data-curso]").forEach(function (link) {
    link.addEventListener("click", function () {
      selecionarCurso(link.getAttribute("data-curso"));
    });
  });

  atualizarCurso();

  /* ============ Contato: copiar e-mail e endereço ============ */
  var avisoCopia = $("avisoCopia");

  function copiaAlternativa(texto) {
    var area = document.createElement("textarea");
    area.value = texto;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(area);
    return ok;
  }

  function copiarTexto(texto) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(texto).then(
        function () { return true; },
        function () { return copiaAlternativa(texto); }
      );
    }
    return Promise.resolve(copiaAlternativa(texto));
  }

  document.querySelectorAll("[data-copiar]").forEach(function (botao) {
    var textoOriginal = botao.textContent;
    botao.addEventListener("click", function () {
      copiarTexto(botao.getAttribute("data-copiar")).then(function (ok) {
        var nome = botao.getAttribute("data-copiar-nome");
        botao.textContent = ok ? "Copiado!" : "Não deu para copiar";
        botao.classList.toggle("is-copiado", ok);
        avisoCopia.textContent = ok ? nome + " copiado." : "Não foi possível copiar. Selecione o texto manualmente.";
        setTimeout(function () {
          botao.textContent = textoOriginal;
          botao.classList.remove("is-copiado");
        }, 2200);
      });
    });
  });
})();
