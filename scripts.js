let rowsGlobal = [];

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQZmK1DRlPhgRCRDNGl2NHe3KhUHv5RciZMd5RF6OadQBO6kfEd73zm8-vgrSZrnqpyts0z28Ep3yR9/pub?gid=2131847576&single=true&output=csv";

const dados = {
  participantes: [], // [{ nome, col }]
  grupos: [], // [{ nome, jogos:[{ grupo, timeA, timeB, linha }] }]
  ranking: [], // [{ nome, pontos }]
};

/* ---------- CARREGAMENTO (GOOGLE SHEETS CSV) ---------- */

fetch(SHEET_URL, { cache: "no-store" })
  .then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status} ao buscar a planilha`);
    return r.text();
  })
  .then((csvText) => {
    rowsGlobal = parseCSV(csvText);

    dados.participantes = extrairParticipantes(rowsGlobal);
    dados.grupos = extrairGruposEJogos(rowsGlobal);
    dados.ranking = extrairRanking(rowsGlobal);

    // Renderização inicial da interface
    renderGrupos(dados.grupos);
    renderRanking(dados.ranking);
    renderSelectParticipantes(dados.participantes);
    renderSelectGrupos(dados.grupos);
  })
  .catch((err) => {
    alert("Erro ao carregar Google Sheets: " + err.message);
    console.error(err);
  });

/* ---------- CSV PARSER (respeita aspas, vírgulas e quebras de linha) ---------- */

function parseCSV(text) {
  // Remove BOM (às vezes vem no começo)
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        // Aspas escapada dentro do texto
        cell += '"';
        i += 1;
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

    if (ch === "\r") {
      // ignora CR, trata no \n
      continue;
    }

    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += ch;
  }

  // Última célula/linha
  row.push(cell);
  rows.push(row);

  // Limpa linhas totalmente vazias no final
  while (rows.length && rows[rows.length - 1].every((c) => String(c).trim() === "")) {
    rows.pop();
  }

  return rows;
}

/* ---------- EXTRAÇÕES ---------- */

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

  for (let i = 0; i < rows.length; i += 1) {
    const colA = String(rows[i]?.[0] ?? "").trim();
    const colC = String(rows[i]?.[2] ?? "").trim();
    const colE = String(rows[i]?.[4] ?? "").trim();

    if (/^GRUPO\s+[A-Z]/i.test(colA)) {
      grupoAtual = { nome: colA, jogos: [] };
      grupos.push(grupoAtual);
      continue;
    }

    if (grupoAtual && colA && colE && colC.toUpperCase() === "X" && !/^GRUPO/i.test(colA)) {
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

  const start = idxRanking + 2;
  const ranking = [];

  for (let i = start; i < rows.length; i += 1) {
    const nome = String(rows[i]?.[0] ?? "").trim();
    const pontos = rows[i]?.[1];

    if (!nome) break;

    const n = Number(String(pontos).replace(",", "."));
    ranking.push({ nome, pontos: Number.isFinite(n) ? n : 0 });
  }

  ranking.sort((a, b) => b.pontos - a.pontos);
  return ranking;
}

/* ---------- RENDERIZAÇÃO ---------- */

function renderGrupos(grupos) {
  const el = document.getElementById("grupos");
  if (!el) return;

  el.innerHTML = "";

  grupos.forEach((g) => {
    const btn = document.createElement("button");
    btn.className = "pill";
    btn.textContent = g.nome;
    btn.onclick = () => {
      mostrarTabelaDoGrupo(g);
      document.getElementById("tabelaGrupo")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    };

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

  sel.addEventListener("change", atualizarPalpitesFiltrados);
}

function renderSelectGrupos(grupos) {
  const selGrupo = document.getElementById("grupoFiltro");
  if (!selGrupo) return;

  selGrupo.innerHTML = '<option value="">Todos os Grupos</option>';

  grupos.forEach((g) => {
    const op = document.createElement("option");
    op.value = g.nome;
    op.textContent = g.nome;
    selGrupo.appendChild(op);
  });

  selGrupo.addEventListener("change", atualizarPalpitesFiltrados);
}

/* ---------- FILTRO E PALPITES ---------- */

function atualizarPalpitesFiltrados() {
  const participanteSel = document.getElementById("participante");
  const grupoSel = document.getElementById("grupoFiltro");
  const wrap = document.getElementById("palpitesWrap");
  const nomeHeader = document.getElementById("nomeSelecionado");
  const tbody = document.querySelector("#palpites tbody");

  const idx = participanteSel.value;
  if (idx === "") return esconderPalpites();

  const part = dados.participantes[Number(idx)];
  const grupoFiltro = grupoSel ? grupoSel.value : "";

  nomeHeader.textContent = part.nome;
  tbody.innerHTML = "";

  dados.grupos.forEach((g) => {
    if (grupoFiltro && g.nome !== grupoFiltro) return;

    g.jogos.forEach((jogo) => {
      const r = rowsGlobal[jogo.linha] || [];

      // Colunas: Palpite A (col), Palpite B (col + 2), Pts (col + 3)
      const pA = (r[part.col] ?? "").toString().trim() || "-";
      const pB = (r[part.col + 2] ?? "").toString().trim() || "-";
      const pts = r[part.col + 3] ?? "";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${jogo.grupo}</td>
        <td>
          <div class="jogo-linha">
            <span class="time-a">${jogo.timeA}</span>
            <span class="palpite-a">${pA}</span>
            <span class="versus">X</span>
            <span class="palpite-b">${pB}</span>
            <span class="time-b">${jogo.timeB}</span>
          </div>
        </td>
        <td>${pts}</td>
      `;
      tbody.appendChild(tr);
    });
  });

  wrap.classList.remove("hidden");
}

function esconderPalpites() {
  const wrap = document.getElementById("palpitesWrap");
  if (wrap) wrap.classList.add("hidden");
}

function mostrarTabelaDoGrupo(grupo) {
  const titulo = document.getElementById("tituloGrupo");
  const corpo = document.getElementById("corpoGrupo");
  if (!titulo || !corpo) return;

  titulo.textContent = grupo.nome;
  corpo.innerHTML = "";

  grupo.jogos.forEach((jogo) => {
    const r = rowsGlobal[jogo.linha] || [];
    const placarA = String(r[1] ?? "").trim() || "-";
    const x = String(r[2] ?? "").trim() || "x";
    const placarB = String(r[3] ?? "").trim() || "-";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${jogo.timeA}</td>
      <td>${placarA}</td>
      <td style="text-align:center">${x}</td>
      <td>${placarB}</td>
      <td>${jogo.timeB}</td>
    `;
    corpo.appendChild(tr);
  });
}