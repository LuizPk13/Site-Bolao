let rowsGlobal = [];
let grupoAtualSelecionado = null;
const SHEET_URL =  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQZmK1DRlPhgRCRDNGl2NHe3KhUHv5RciZMd5RF6OadQBO6kfEd73zm8-vgrSZrnqpyts0z28Ep3yR9/pub?gid=2131847576&single=true&output=csv";
const dados = {
  participantes: [],
  grupos: [],
  ranking: [],
};


/* ================= CARREGAMENTO ================= */
carregarDadosInicial();

function carregarDadosInicial() {
  fetchSheet().then(processarDados);
}

function fetchSheet() {
  return fetch(SHEET_URL + "&t=" + Date.now(), { cache: "no-store" }).then((r) =>
    r.text()
  );
}

function processarDados(csvText) {
  rowsGlobal = parseCSV(csvText);
  const participanteAtual = document.getElementById("participante")?.value;
  const grupoAtual = document.getElementById("grupoFiltro")?.value;
  const jogoGrupoAtual = document.getElementById("jogoGrupoFiltro")?.value;
  
  dados.participantes = extrairParticipantes(rowsGlobal);
  dados.grupos = extrairGruposEJogos(rowsGlobal);
  dados.ranking = extrairRanking(rowsGlobal);
  
  renderGrupos(dados.grupos);
  renderRanking(dados.ranking);
  renderSelectParticipantes(dados.participantes);
  renderSelectGrupos(dados.grupos);
  renderSelectJogoGrupos(dados.grupos);
  
  if (participanteAtual) {
    document.getElementById("participante").value = participanteAtual;
  }
  if (grupoAtual) {
    document.getElementById("grupoFiltro").value = grupoAtual;
  }
  if (jogoGrupoAtual) {
    document.getElementById("jogoGrupoFiltro").value = jogoGrupoAtual;
    renderSelectJogos(jogoGrupoAtual);
  }
  atualizarPalpitesFiltrados();
}

/* ================= CSV PARSER ================= */
function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ",") { row.push(cell); cell = ""; continue; }
    if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; continue; }
    if (ch !== "\r") { cell += ch; }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

/* ================= EXTRAÇÕES ================= */
function extrairParticipantes(rows) {
  const header = rows[0] || [];
  const participantes = [];
  header.forEach((v, col) => {
    const txt = String(v).trim();
    if (!txt || txt.toLowerCase() === "pts." || txt.startsWith("=")) return;
    participantes.push({ nome: txt, col });
  });
  return participantes;
}

function extrairGruposEJogos(rows) {
  const grupos = [];
  let grupoAtual = null;
  for (let i = 0; i < rows.length; i++) {
    const colA = String(rows[i]?.[0] ?? "").trim();
    const colC = String(rows[i]?.[2] ?? "").trim();
    const colE = String(rows[i]?.[4] ?? "").trim();
    if (/^GRUPO\s+[A-Z]/i.test(colA)) {
      grupoAtual = { nome: colA, jogos: [] };
      grupos.push(grupoAtual);
      continue;
    }
    if (grupoAtual && colA && colE && colC.toUpperCase() === "X") {
      grupoAtual.jogos.push({
        grupo: grupoAtual.nome,
        timeA: colA,
        timeB: colE,
        linha: i,
      });
    }
  }
  return grupos;
}

function extrairRanking(rows) {
  const idxRanking = rows.findIndex(
    (r) => String(r?.[0] ?? "").trim().toUpperCase() === "RANKING"
  );
  if (idxRanking === -1) return [];
  const ranking = [];
  for (let i = idxRanking + 2; i < rows.length; i++) {
    const nome = String(rows[i]?.[0] ?? "").trim();
    const pontos = rows[i]?.[1];
    if (!nome) break;
    const n = Number(String(pontos).replace(",", "."));
    ranking.push({ nome, pontos: Number.isFinite(n) ? n : 0 });
  }
  ranking.sort((a, b) => b.pontos - a.pontos);
  return ranking;
}

/* ================= RENDER ================= */
function renderGrupos(grupos) {
  const el = document.getElementById("grupos");
  if (!el) return;
  el.innerHTML = "";
  grupos.forEach((g) => {
    const btn = document.createElement("button");
    btn.className = "pill";
    btn.textContent = g.nome;
    btn.onclick = () => mostrarTabelaDoGrupo(g);
    el.appendChild(btn);
  });
}

function renderRanking(ranking) {
  const tbody = document.querySelector("#ranking tbody");
  if (!tbody) return;

  tbody.innerHTML = "";
  let colocacao = 1;
  ranking.forEach((p, idx) => {
    // Mantém mesma colocação para empate de pontos
    if (idx > 0 && p.pontos < ranking[idx - 1].pontos) {
      colocacao = idx + 1;
    }

    let medalha = "";
    if (colocacao === 1) medalha = " 🥇";
    else if (colocacao === 2) medalha = " 🥈";
    else if (colocacao === 3) medalha = " 🥉";
    else if (colocacao === 19) medalha = " ⚓";
    else if (colocacao === 20) medalha = " 🔦";

    
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${colocacao}º${medalha}</td><td>${p.nome}</td><td>${formatValue(p.pontos)}</td>`;
    tbody.appendChild(tr);
  });
}

function renderSelectParticipantes(participantes) {
  const sel = document.getElementById("participante");
  if (!sel) return;
  sel.innerHTML = '<option value="">Participante...</option>';
  participantes.forEach((p, idx) => {
    const op = document.createElement("option");
    op.value = idx;
    op.textContent = p.nome;
    sel.appendChild(op);
  });
  sel.onchange = atualizarPalpitesFiltrados;
}

function renderSelectGrupos(grupos) {
  const selGrupo = document.getElementById("grupoFiltro");
  if (!selGrupo) return;
  selGrupo.innerHTML = '<option value="">Todos</option>';
  grupos.forEach((g) => {
    const op = document.createElement("option");
    op.value = g.nome;
    op.textContent = g.nome;
    selGrupo.appendChild(op);
  });
  selGrupo.onchange = () => {
    atualizarPalpitesFiltrados();
    const grupoSelecionado = selGrupo.value;
    if (!grupoSelecionado) return;
    const grupo = dados.grupos.find((g) => g.nome === grupoSelecionado);
    if (grupo) mostrarTabelaDoGrupo(grupo);
  };
}

function formatValue(value) {
  const texto = String(value ?? "").trim();
  return texto || "-";
}

/* ================= PALPITES — POR PARTICIPANTE ================= */
function montarLinhaJogo(timeA, palpiteA, palpiteB, timeB, versus = "X") {
  return `
    <div class="jogo-linha" role="presentation">
      <span class="time-a">${timeA}</span>
      <span class="palpite-a">${palpiteA}</span>
      <span class="versus">${versus}</span>
      <span class="palpite-b">${palpiteB}</span>
      <span class="time-b">${timeB}</span>
    </div>
  `;
}

function atualizarPalpitesFiltrados() {
  const participanteSel = document.getElementById("participante");
  const grupoSel = document.getElementById("grupoFiltro");
  const wrap = document.getElementById("palpitesWrap");
  const nomeHeader = document.getElementById("nomeSelecionado");
  const tbody = document.querySelector("#palpites tbody");
  const idx = participanteSel?.value;
  if (!idx) return esconderPalpites();
  
  const part = dados.participantes[Number(idx)];
  const grupoFiltro = grupoSel?.value || "";
  nomeHeader.textContent = part.nome;
  tbody.innerHTML = "";
  
  dados.grupos.forEach((g) => {
    if (grupoFiltro && g.nome !== grupoFiltro) return;
    g.jogos.forEach((jogo) => {
      const r = rowsGlobal[jogo.linha] || [];
      const pA = formatValue(r[part.col]);
      const pB = formatValue(r[part.col + 2]);
      const pts = formatValue(r[part.col + 3]);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${jogo.grupo}</td>
        <td>${montarLinhaJogo(jogo.timeA, pA, pB, jogo.timeB, "X")}</td>
        <td>${pts}</td>
      `;
      tbody.appendChild(tr);
    });
  });
  wrap.classList.remove("hidden");
}

function esconderPalpites() {
  document.getElementById("palpitesWrap")?.classList.add("hidden");
}

function mostrarTabelaDoGrupo(grupo) {
  const titulo = document.getElementById("tituloGrupo");
  const corpo = document.getElementById("corpoGrupo");
  if (!titulo || !corpo) return;
  grupoAtualSelecionado = grupo;
  titulo.textContent = grupo.nome;
  corpo.innerHTML = "";
  grupo.jogos.forEach((jogo) => {
    const r = rowsGlobal[jogo.linha] || [];
    const placarA = formatValue(r[1]);
    const placarB = formatValue(r[3]);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${jogo.timeA}</td>
      <td>${placarA}</td>
      <td>${r[2] || "x"}</td>
      <td>${placarB}</td>
      <td>${jogo.timeB}</td>
    `;
    corpo.appendChild(tr);
  });
}

/* ================= PALPITES — POR JOGO ================= */
function renderSelectJogoGrupos(grupos) {
  const sel = document.getElementById("jogoGrupoFiltro");
  if (!sel) return;
  sel.innerHTML = '<option value="">Selecione um grupo...</option>';
  grupos.forEach((g) => {
    const op = document.createElement("option");
    op.value = g.nome;
    op.textContent = g.nome;
    sel.appendChild(op);
  });
  sel.onchange = () => {
    renderSelectJogos(sel.value);
    esconderPorJogo();
  };
}

function renderSelectJogos(nomeGrupo) {
  const sel = document.getElementById("jogoFiltro");
  if (!sel) return;
  sel.innerHTML = '<option value="">Selecione um jogo...</option>';
  if (!nomeGrupo) return;
  const grupo = dados.grupos.find((g) => g.nome === nomeGrupo);
  if (!grupo) return;
  grupo.jogos.forEach((jogo, idx) => {
    const op = document.createElement("option");
    op.value = idx;
    op.textContent = `${jogo.timeA} x ${jogo.timeB}`;
    sel.appendChild(op);
  });
  sel.onchange = () => atualizarPorJogo(nomeGrupo);
}

function atualizarPorJogo(nomeGrupo) {
  const jogoSel = document.getElementById("jogoFiltro");
  const wrap = document.getElementById("porJogoWrap");
  const titulo = document.getElementById("tituloJogoSelecionado");
  const tbody = document.querySelector("#tabelaPorJogo tbody");
  const jogoIdx = jogoSel?.value;
  if (jogoIdx === "" || jogoIdx === undefined) return esconderPorJogo();
  
  const grupo = dados.grupos.find((g) => g.nome === nomeGrupo);
  if (!grupo) return esconderPorJogo();
  const jogo = grupo.jogos[Number(jogoIdx)];
  if (!jogo) return esconderPorJogo();
  
  titulo.textContent = `${jogo.timeA} x ${jogo.timeB}`;
  tbody.innerHTML = "";

  // Monta os dados de cada participante e ordena por pontos (maior → menor)
  const linhas = dados.participantes.map((part) => {
    const r = rowsGlobal[jogo.linha] || [];
    const pA = formatValue(r[part.col]);
    const pB = formatValue(r[part.col + 2]);
    const pts = formatValue(r[part.col + 3]);
    const ptsNum = Number(String(r[part.col + 3] ?? "").replace(",", "."));
    return { part, pA, pB, pts, ptsNum: Number.isFinite(ptsNum) ? ptsNum : -1 };
  });

  linhas.sort((a, b) => b.ptsNum - a.ptsNum);

  linhas.forEach(({ part, pA, pB, pts }) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${part.nome}</td>
      <td>${montarLinhaJogo(jogo.timeA, pA, pB, jogo.timeB, "X")}</td>
      <td>${pts}</td>
    `;
    tbody.appendChild(tr);
  });
  wrap.classList.remove("hidden");
}

function esconderPorJogo() {
  document.getElementById("porJogoWrap")?.classList.add("hidden");
}

/* ================= ABAS DE MODO ================= */
function initModoTabs() {
  const tabPart = document.getElementById("tab-participante");
  const tabJogo = document.getElementById("tab-jogo");
  const painelPart = document.getElementById("painel-participante");
  const painelJogo = document.getElementById("painel-jogo");
  if (!tabPart || !tabJogo) return;
  
  tabPart.addEventListener("click", () => {
    tabPart.classList.add("ativo");
    tabJogo.classList.remove("ativo");
    tabPart.setAttribute("aria-selected", "true");
    tabJogo.setAttribute("aria-selected", "false");
    painelPart.classList.remove("hidden");
    painelJogo.classList.add("hidden");
  });
  
  tabJogo.addEventListener("click", () => {
    tabJogo.classList.add("ativo");
    tabPart.classList.remove("ativo");
    tabJogo.setAttribute("aria-selected", "true");
    tabPart.setAttribute("aria-selected", "false");
    painelJogo.classList.remove("hidden");
    painelPart.classList.add("hidden");
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initModoTabs);
} else {
  initModoTabs();
}

/* ================= CARROSSEL DE FOTOS (telas ≤ 960px) ================= */
function initCarousel() {
  if (window.innerWidth > 960) return;
  document.querySelectorAll(".side-column").forEach((col) => {
    if (col.querySelector(".side-track")) return;
    const photos = Array.from(col.querySelectorAll(".side-photo"));
    if (!photos.length) return;
    const track = document.createElement("div");
    track.className = "side-track";
    photos.forEach((p) => track.appendChild(p));
    photos.forEach((p) => track.appendChild(p.cloneNode(true)));
    col.appendChild(track);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCarousel);
} else {
  initCarousel();
}