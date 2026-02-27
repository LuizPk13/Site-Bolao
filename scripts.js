let rowsGlobal = [];

const ARQ = "BOLAOZAÇO.xlsx";
const ABA = "Bolão da Copa";

let dados = {
  participantes: [], // [{nome, col}]
  grupos: [],        // [{nome, jogos:[{grupo, timeA, timeB, linha}]}]
  ranking: [],       // [{nome, pontos}]
};

/* ---------- CARREGAMENTO ---------- */

fetch(ARQ)
  .then(r => r.arrayBuffer())
  .then(buf => {
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[ABA] || wb.Sheets[wb.SheetNames[0]];
    if (!ws) throw new Error(`Não achei a aba "${ABA}" e nenhuma aba disponível no arquivo.`);

    // Converte em matriz (rows x cols)
    rowsGlobal = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    
    dados.participantes = extrairParticipantes(rowsGlobal);
    dados.grupos = extrairGruposEJogos(rowsGlobal);
    dados.ranking = extrairRanking(rowsGlobal);

    // Renderização inicial da interface
    renderGrupos(dados.grupos);
    renderRanking(dados.ranking);
    renderSelectParticipantes(dados.participantes);
    renderSelectGrupos(dados.grupos);
  })
  .catch(err => {
    alert("Erro ao carregar planilha: " + err.message);
    console.error(err);
  });

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

  for (let i = 0; i < rows.length; i++) {
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
  const idxRanking = rows.findIndex(r => String(r?.[0] ?? "").trim().toUpperCase() === "RANKING");
  if (idxRanking === -1) return [];

  const start = idxRanking + 2;
  const ranking = [];

  for (let i = start; i < rows.length; i++) {
    const nome = String(rows[i]?.[0] ?? "").trim();
    const pontos = rows[i]?.[1];
    if (!nome) break;
    const n = Number(String(pontos).replace(",", "."));
    ranking.push({ nome, pontos: Number.isFinite(n) ? n : 0 });
  }

  ranking.sort((a, b) => b.pontos - a.pontos);
  return ranking;
}

/* ---------- RENDERIZAÇÃO DE COMPONENTES ---------- */

function renderGrupos(grupos) {
  const el = document.getElementById("grupos");
  if (!el) return;
  el.innerHTML = "";

  grupos.forEach(g => {
    const btn = document.createElement("button");
    btn.className = "pill";
    btn.textContent = g.nome;
    btn.onclick = () => {
      mostrarTabelaDoGrupo(g);
      document.getElementById("tabelaGrupo")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    el.appendChild(btn);
  });
}

function renderRanking(ranking) {
  const tbody = document.querySelector("#ranking tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  ranking.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${p.nome}</td><td>${p.pontos}</td>`;
    tbody.appendChild(tr);
  });
}

function renderSelectParticipantes(participantes) {
  const sel = document.getElementById("participante");
  if (!sel) return;
  sel.innerHTML = '<option value="">Selecione um participante...</option>';

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

  grupos.forEach(g => {
    const op = document.createElement("option");
    op.value = g.nome;
    op.textContent = g.nome;
    selGrupo.appendChild(op);
  });

  selGrupo.addEventListener("change", atualizarPalpitesFiltrados);
}

/* ---------- LÓGICA DE FILTRO E PALPITES ---------- */

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

  dados.grupos.forEach(g => {
    // Aplica o filtro de grupo se houver um selecionado
    if (grupoFiltro && g.nome !== grupoFiltro) return;

    g.jogos.forEach(jogo => {
      const r = rowsGlobal[jogo.linha] || [];

      // Colunas: Palpite A (col), Palpite B (col + 2), Pts (col + 3)
      const pA = (r[part.col] ?? "").toString().trim() || "-";
      const pB = (r[part.col + 2] ?? "").toString().trim() || "-";
      const pts = r[part.col + 3] ?? "";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${jogo.grupo}</td>
        <td>${jogo.timeA} - ${pA} X ${pB} - ${jogo.timeB}</td>
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

  grupo.jogos.forEach(jogo => {
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






