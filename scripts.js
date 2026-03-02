let rowsGlobal = [];

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQZmK1DRlPhgRCRDNGl2NHe3KhUHv5RciZMd5RF6OadQBO6kfEd73zm8-vgrSZrnqpyts0z28Ep3yR9/pub?gid=2131847576&single=true&output=csv";

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

  dados.participantes = extrairParticipantes(rowsGlobal);
  dados.grupos = extrairGruposEJogos(rowsGlobal);
  dados.ranking = extrairRanking(rowsGlobal);

  renderGrupos(dados.grupos);
  renderRanking(dados.ranking);
  renderSelectParticipantes(dados.participantes);
  renderSelectGrupos(dados.grupos);

  if (participanteAtual) {
    document.getElementById("participante").value = participanteAtual;
  }

  if (grupoAtual) {
    document.getElementById("grupoFiltro").value = grupoAtual;
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

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    if (ch !== "\r") {
      cell += ch;
    }
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

  ranking.forEach((p) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${p.nome}</td><td>${p.pontos}</td>`;
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

  selGrupo.onchange = atualizarPalpitesFiltrados;
}

/* ================= PALPITES ================= */

function montarLinhaJogo(timeA, palpiteA, palpiteB, timeB) {
  return `
    <div class="jogo-linha" role="presentation">
      <span class="time-a">${timeA}</span>
      <span class="palpite-a">${palpiteA}</span>
      <span class="versus">X</span>
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

      const pA = (r[part.col] ?? "").trim() || "-";
      const pB = (r[part.col + 2] ?? "").trim() || "-";
      const pts = r[part.col + 3] ?? "";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${jogo.grupo}</td>
        <td>${montarLinhaJogo(jogo.timeA, pA, pB, jogo.timeB)}</td>
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

  titulo.textContent = grupo.nome;
  corpo.innerHTML = "";

  grupo.jogos.forEach((jogo) => {
    const r = rowsGlobal[jogo.linha] || [];

    const placarA = r[1] || "-";
    const x = r[2] || "x";
    const placarB = r[3] || "-";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${jogo.timeA}</td>
      <td>${placarA}</td>
      <td>${x}</td>
      <td>${placarB}</td>
      <td>${jogo.timeB}</td>
    `;
    corpo.appendChild(tr);
  });
}