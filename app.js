// =====================================================
// PARTE 1: DADOS (no lugar do back-end Flask + SQLite)
// =====================================================

const CHAVE_STORAGE = "cachorro-quente-dados";

const CATEGORIAS = {
  receita: ["venda"],
  despesa: ["insumos", "combustível", "embalagem", "perda", "outros"],
};

// Todos os valores em dinheiro são guardados em CENTAVOS (número inteiro)
let dados = { proximoId: 1, eventos: [], lancamentos: [] };

function dadosValidos(obj) {
  if (!obj || !Array.isArray(obj.eventos) || !Array.isArray(obj.lancamentos)) return false;
  if (!Number.isInteger(obj.proximoId)) return false;

  const eventosOk = obj.eventos.every(
    (e) =>
      Number.isInteger(e.id) &&
      e.id < obj.proximoId &&
      typeof e.nome === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(e.data)
  );

  const lancamentosOk = obj.lancamentos.every(
    (l) =>
      Number.isInteger(l.id) &&
      l.id < obj.proximoId &&
      Number.isInteger(l.eventoId) &&
      Number.isInteger(l.valor) &&
      l.valor > 0 &&
      Array.isArray(CATEGORIAS[l.tipo]) &&
      CATEGORIAS[l.tipo].includes(l.categoria) &&
      typeof l.descricao === "string"
  );

  return eventosOk && lancamentosOk;
}

function carregarDados() {
  try {
    const salvo = localStorage.getItem(CHAVE_STORAGE);
    if (!salvo) return;
    const obj = JSON.parse(salvo);
    if (dadosValidos(obj)) dados = obj;
  } catch (erro) {
    console.error("Não foi possível ler os dados salvos:", erro);
  }
}

function salvarDados() {
  try {
    localStorage.setItem(CHAVE_STORAGE, JSON.stringify(dados));
  } catch (erro) {
    alert("Não foi possível salvar os dados neste navegador.");
  }
}

function novoId() {
  const id = dados.proximoId;
  dados.proximoId += 1;
  return id;
}

// ---------- Dias de venda ----------

function listarEventos() {
  return [...dados.eventos].sort(
    (a, b) => b.data.localeCompare(a.data) || b.id - a.id
  );
}

function criarEvento(nome, data) {
  nome = nome.trim();
  if (!nome || !data) throw new Error("Informe o nome e a data.");

  const evento = { id: novoId(), nome, data };
  dados.eventos.push(evento);
  salvarDados();
  return evento;
}

function apagarEvento(id) {
  dados.eventos = dados.eventos.filter((e) => e.id !== id);
  dados.lancamentos = dados.lancamentos.filter((l) => l.eventoId !== id);
  salvarDados();
}

// ---------- Lançamentos ----------

function listarLancamentos(eventoId) {
  return dados.lancamentos
    .filter((l) => l.eventoId === eventoId)
    .sort((a, b) => b.id - a.id);
}

function criarLancamento(eventoId, { tipo, categoria, descricao, valor }) {
  const centavos = Math.round(Number(valor) * 100);

  if (!Number.isFinite(centavos) || centavos <= 0) {
    throw new Error("O valor deve ser maior que zero.");
  }
  if (!Array.isArray(CATEGORIAS[tipo]) || !CATEGORIAS[tipo].includes(categoria)) {
    throw new Error("Tipo ou categoria inválidos.");
  }
  if (!dados.eventos.some((e) => e.id === eventoId)) {
    throw new Error("Dia de venda não encontrado.");
  }

  dados.lancamentos.push({
    id: novoId(),
    eventoId,
    tipo,
    categoria,
    descricao: (descricao || "").trim(),
    valor: centavos,
  });
  salvarDados();
}

function apagarLancamento(id) {
  dados.lancamentos = dados.lancamentos.filter((l) => l.id !== id);
  salvarDados();
}

// ---------- Resumos ----------

function calcularResumo(lancamentos) {
  let bruto = 0;
  let gastos = 0;
  const gastosPorCategoria = {};

  lancamentos.forEach((l) => {
    if (l.tipo === "receita") {
      bruto += l.valor;
    } else {
      gastos += l.valor;
      gastosPorCategoria[l.categoria] = (gastosPorCategoria[l.categoria] || 0) + l.valor;
    }
  });

  return { bruto, gastos, liquido: bruto - gastos, gastosPorCategoria };
}

function paraData(texto) {
  const [ano, mes, dia] = texto.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

function paraTexto(data) {
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${mes}-${dia}`;
}

function calcularIntervalo(periodo, dataTexto) {
  const data = paraData(dataTexto);

  if (periodo === "dia") {
    return { inicio: dataTexto, fim: dataTexto };
  }

  if (periodo === "semana") {
    // getDay(): 0 = domingo ... 6 = sábado. Isso converte pra 0 = segunda ... 6 = domingo
    const diasDesdeSegunda = (data.getDay() + 6) % 7;
    const segunda = new Date(data);
    segunda.setDate(data.getDate() - diasDesdeSegunda);
    const domingo = new Date(segunda);
    domingo.setDate(segunda.getDate() + 6);
    return { inicio: paraTexto(segunda), fim: paraTexto(domingo) };
  }

  if (periodo === "mes") {
    const primeiro = new Date(data.getFullYear(), data.getMonth(), 1);
    const ultimo = new Date(data.getFullYear(), data.getMonth() + 1, 0);
    return { inicio: paraTexto(primeiro), fim: paraTexto(ultimo) };
  }

  throw new Error("Período inválido.");
}

function eventosDoPeriodo(inicio, fim) {
  return dados.eventos
    .filter((e) => e.data >= inicio && e.data <= fim)
    .sort((a, b) => a.data.localeCompare(b.data) || a.id - b.id);
}

function resumoPeriodo(periodo, dataTexto) {
  const { inicio, fim } = calcularIntervalo(periodo, dataTexto);
  const eventos = eventosDoPeriodo(inicio, fim);
  const ids = new Set(eventos.map((e) => e.id));
  const lancamentos = dados.lancamentos.filter((l) => ids.has(l.eventoId));

  const dias = eventos.map((e) => ({
    ...e,
    ...calcularResumo(listarLancamentos(e.id)),
  }));

  return { ...calcularResumo(lancamentos), inicio, fim, dias };
}

// ---------- Arquivos (CSV e backup) ----------

function celulaCSV(valor) {
  const texto = String(valor);
  if (/[;"\n\r]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

function gerarCSV(periodo, dataTexto) {
  const { inicio, fim } = calcularIntervalo(periodo, dataTexto);
  const linhas = [["Data", "Dia de venda", "Tipo", "Categoria", "Descrição", "Valor (R$)"]];

  eventosDoPeriodo(inicio, fim).forEach((e) => {
    const dataBR = e.data.split("-").reverse().join("/");
    listarLancamentos(e.id)
      .reverse()
      .forEach((l) => {
        const valorBR = (l.valor / 100).toFixed(2).replace(".", ",");
        linhas.push([dataBR, e.nome, l.tipo, l.categoria, l.descricao, valorBR]);
      });
  });

  const conteudo = linhas.map((linha) => linha.map(celulaCSV).join(";")).join("\r\n");
  return { inicio, fim, conteudo };
}

function baixarArquivo(nome, conteudo, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- Dados de exemplo (fictícios) ----------

function carregarExemplo() {
  if (
    dados.eventos.length > 0 &&
    !confirm("Isso substitui os dados atuais pelos de exemplo. Continuar?")
  ) {
    return false;
  }

  dados = { proximoId: 1, eventos: [], lancamentos: [] };

  const exemplos = [
    { nome: "Jogo de domingo", diasAtras: 2, venda: 780, despesas: { insumos: 290, "combustível": 45, embalagem: 60, perda: 25 } },
    { nome: "Show na praça", diasAtras: 6, venda: 1150, despesas: { insumos: 410, "combustível": 60, embalagem: 85, perda: 40 } },
    { nome: "Feira do bairro", diasAtras: 13, venda: 640, despesas: { insumos: 240, "combustível": 35, embalagem: 50, perda: 15 } },
    { nome: "Festa junina", diasAtras: 20, venda: 1420, despesas: { insumos: 520, "combustível": 70, embalagem: 110, perda: 55 } },
  ];

  exemplos.forEach((ex) => {
    const data = new Date();
    data.setDate(data.getDate() - ex.diasAtras);
    const evento = criarEvento(ex.nome, paraTexto(data));

    criarLancamento(evento.id, {
      tipo: "receita",
      categoria: "venda",
      descricao: "Vendas do dia",
      valor: ex.venda,
    });

    Object.entries(ex.despesas).forEach(([categoria, valor]) => {
      criarLancamento(evento.id, { tipo: "despesa", categoria, descricao: "", valor });
    });
  });

  return true;
}

// =====================================================
// PARTE 2: INTERFACE
// =====================================================

let eventoAtual = null;

// ---------- Funções de apoio ----------

function dinheiro(centavos) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(dataISO) {
  return dataISO.split("-").reverse().join("/");
}

function maiuscula(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function escapar(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

// ---------- Desenho da tela ----------

function desenharCards(idContainer, resumo) {
  const classeLiquido = resumo.liquido >= 0 ? "positivo" : "negativo";
  document.getElementById(idContainer).innerHTML = `
    <div class="card"><span>Faturamento bruto</span><strong>${dinheiro(resumo.bruto)}</strong></div>
    <div class="card"><span>Gastos</span><strong>${dinheiro(resumo.gastos)}</strong></div>
    <div class="card ${classeLiquido}"><span>Líquido</span><strong>${dinheiro(resumo.liquido)}</strong></div>
  `;
}

function desenharGastosPorCategoria(
  gastos,
  idLista = "gastos-categoria",
  textoVazio = "Sem gastos neste dia."
) {
  const lista = document.getElementById(idLista);
  const nomes = Object.keys(gastos);

  if (nomes.length === 0) {
    lista.innerHTML = `<li class="vazio">${textoVazio}</li>`;
    return;
  }

  lista.innerHTML = nomes
    .map((nome) => `<li><span>${maiuscula(escapar(nome))}</span><strong>${dinheiro(gastos[nome])}</strong></li>`)
    .join("");
}

function desenharDiasPeriodo(dias) {
  const corpo = document.getElementById("tabela-periodo");

  if (dias.length === 0) {
    corpo.innerHTML = `<tr><td colspan="5" class="vazio">Nenhum dia de venda neste período.</td></tr>`;
    return;
  }

  corpo.innerHTML = dias
    .map((d) => {
      const classe = d.liquido >= 0 ? "receita" : "despesa";
      return `
      <tr>
        <td>${formatarData(d.data)}</td>
        <td>${escapar(d.nome)}</td>
        <td>${dinheiro(d.bruto)}</td>
        <td>${dinheiro(d.gastos)}</td>
        <td class="${classe}">${dinheiro(d.liquido)}</td>
      </tr>`;
    })
    .join("");
}

function desenharLancamentos(lancamentos) {
  const corpo = document.getElementById("tabela-lancamentos");

  if (lancamentos.length === 0) {
    corpo.innerHTML = `<tr><td colspan="5" class="vazio">Nenhum lançamento ainda.</td></tr>`;
    return;
  }

  corpo.innerHTML = lancamentos
    .map(
      (l) => `
      <tr>
        <td class="${l.tipo}">${maiuscula(l.tipo)}</td>
        <td>${maiuscula(escapar(l.categoria))}</td>
        <td>${escapar(l.descricao)}</td>
        <td>${dinheiro(l.valor)}</td>
        <td><button type="button" class="perigo" onclick="excluirLancamento(${l.id})">X</button></td>
      </tr>`
    )
    .join("");
}

function desenharEventos() {
  const lista = document.getElementById("lista-eventos");
  const eventos = listarEventos();

  if (eventos.length === 0) {
    lista.innerHTML = `<li class="vazio">Nenhum dia de venda criado ainda.</li>`;
    return;
  }

  lista.innerHTML = eventos
    .map((ev) => {
      const ativo = eventoAtual && eventoAtual.id === ev.id ? "ativo" : "";
      return `<li><button type="button" class="${ativo}" onclick="selecionarEvento(${ev.id})">
        ${formatarData(ev.data)} — ${escapar(ev.nome)}
      </button></li>`;
    })
    .join("");
}

// ---------- Atualização ----------

function atualizarPeriodo() {
  const periodo = document.getElementById("periodo-tipo").value;
  const data = document.getElementById("periodo-data").value;
  if (!data) return;

  const r = resumoPeriodo(periodo, data);

  const titulo =
    r.inicio === r.fim
      ? formatarData(r.inicio)
      : `${formatarData(r.inicio)} até ${formatarData(r.fim)}`;
  document.getElementById("periodo-titulo").textContent = titulo;

  desenharCards("cards-periodo", r);
  desenharDiasPeriodo(r.dias);
  desenharGastosPorCategoria(r.gastosPorCategoria, "gastos-periodo", "Sem gastos neste período.");
}

function atualizarEvento() {
  const lancamentos = listarLancamentos(eventoAtual.id);
  const resumo = calcularResumo(lancamentos);

  desenharCards("cards-evento", resumo);
  desenharLancamentos(lancamentos);
  desenharGastosPorCategoria(resumo.gastosPorCategoria);
  atualizarPeriodo();
}

function selecionarEvento(id) {
  const evento = dados.eventos.find((ev) => ev.id === id);
  if (!evento) return;

  eventoAtual = evento;
  document.getElementById("painel-evento").hidden = false;
  document.getElementById("titulo-evento").textContent =
    `${formatarData(evento.data)} — ${evento.nome}`;
  desenharEventos();
  atualizarEvento();
}

function recarregarTela() {
  eventoAtual = null;
  document.getElementById("painel-evento").hidden = true;
  desenharEventos();
  atualizarPeriodo();
}

// ---------- Ações ----------

function excluirLancamento(id) {
  apagarLancamento(id);
  atualizarEvento();
}

document.getElementById("btn-excluir-evento").addEventListener("click", () => {
  if (!eventoAtual || !confirm("Excluir este dia e todos os lançamentos dele?")) return;
  apagarEvento(eventoAtual.id);
  recarregarTela();
});

document.getElementById("form-evento").addEventListener("submit", (e) => {
  e.preventDefault();
  const nome = document.getElementById("evento-nome").value;
  const data = document.getElementById("evento-data").value;

  try {
    const novo = criarEvento(nome, data);
    document.getElementById("periodo-data").value = data;
    e.target.reset();
    definirDataHoje();
    selecionarEvento(novo.id);
  } catch (erro) {
    alert(erro.message);
  }
});

document.getElementById("form-lancamento").addEventListener("submit", (e) => {
  e.preventDefault();

  try {
    criarLancamento(eventoAtual.id, {
      tipo: document.getElementById("lanc-tipo").value,
      categoria: document.getElementById("lanc-categoria").value,
      descricao: document.getElementById("lanc-descricao").value,
      valor: document.getElementById("lanc-valor").value,
    });
    document.getElementById("lanc-descricao").value = "";
    document.getElementById("lanc-valor").value = "";
    atualizarEvento();
  } catch (erro) {
    alert(erro.message);
  }
});

// ---------- Categorias dependem do tipo ----------

function preencherCategorias() {
  const tipo = document.getElementById("lanc-tipo").value;
  document.getElementById("lanc-categoria").innerHTML = CATEGORIAS[tipo]
    .map((c) => `<option value="${c}">${maiuscula(c)}</option>`)
    .join("");
}

document.getElementById("lanc-tipo").addEventListener("change", preencherCategorias);

// ---------- Período e exportação ----------

document.getElementById("periodo-tipo").addEventListener("change", atualizarPeriodo);
document.getElementById("periodo-data").addEventListener("change", atualizarPeriodo);

document.getElementById("btn-exportar").addEventListener("click", () => {
  const periodo = document.getElementById("periodo-tipo").value;
  const data = document.getElementById("periodo-data").value;
  if (!data) {
    alert("Escolha uma data.");
    return;
  }

  const { inicio, fim, conteudo } = gerarCSV(periodo, data);
  baixarArquivo(
    `cachorro-quente_${inicio}_a_${fim}.csv`,
    "\ufeff" + conteudo,
    "text/csv;charset=utf-8"
  );
});

// ---------- Backup e dados ----------

document.getElementById("btn-backup").addEventListener("click", () => {
  const hoje = new Date().toLocaleDateString("sv-SE");
  baixarArquivo(
    `cachorro-quente-backup-${hoje}.json`,
    JSON.stringify(dados, null, 2),
    "application/json"
  );
});

document.getElementById("btn-restaurar").addEventListener("click", () => {
  document.getElementById("arquivo-backup").click();
});

document.getElementById("arquivo-backup").addEventListener("change", async (e) => {
  const arquivo = e.target.files[0];
  if (!arquivo) return;

  try {
    const obj = JSON.parse(await arquivo.text());
    if (!dadosValidos(obj)) throw new Error("formato inválido");
    if (!confirm("Isso substitui todos os dados atuais pelos do backup. Continuar?")) return;

    dados = obj;
    salvarDados();
    recarregarTela();
  } catch (erro) {
    alert("Não foi possível restaurar: o arquivo de backup é inválido.");
  } finally {
    e.target.value = "";
  }
});

document.getElementById("btn-exemplo").addEventListener("click", () => {
  if (carregarExemplo()) recarregarTela();
});

document.getElementById("btn-apagar").addEventListener("click", () => {
  if (!confirm("Apagar TODOS os dados deste navegador? Isso não pode ser desfeito.")) return;
  dados = { proximoId: 1, eventos: [], lancamentos: [] };
  salvarDados();
  recarregarTela();
});

// ---------- Modo claro / escuro ----------

function atualizarBotaoTema() {
  const escuro = document.documentElement.dataset.tema === "escuro";
  document.getElementById("btn-tema").textContent = escuro ? "☀️" : "🌙";
}

document.getElementById("btn-tema").addEventListener("click", () => {
  const novoTema = document.documentElement.dataset.tema === "escuro" ? "claro" : "escuro";
  document.documentElement.dataset.tema = novoTema;
  localStorage.setItem("cq-tema", novoTema);
  atualizarBotaoTema();
});

// ---------- Início ----------

function definirDataHoje() {
  document.getElementById("evento-data").value = new Date().toLocaleDateString("sv-SE");
}

function iniciar() {
  carregarDados();
  preencherCategorias();
  definirDataHoje();
  document.getElementById("periodo-data").value = new Date().toLocaleDateString("sv-SE");
  atualizarBotaoTema();
  desenharEventos();
  atualizarPeriodo();
}

iniciar();