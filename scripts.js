let rowsGlobal = [];

const ARQ = "BOLAOZAÇO.xlsx";
const ABA = "Bolão da Copa";

let dados = {
  participantes: [], // [{nome, col}] col = índice (0-based) dentro da planilha
  grupos: [],        // [{nome, jogos:[{grupo, timeA, timeB, linha}]}]
  ranking: [],       // [{nome, pontos}]
};

fetch(ARQ)
  .then(r => r.arrayBuffer())
  .then(buf => {
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[ABA];
    if (!ws) throw new Error(`Não achei a aba "${ABA}"`);

    // Converte em matriz (rows x cols)
    rowsGlobal = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    const rows = rowsGlobal;

    dados.participantes = extrairParticipantes(rows);
    dados.grupos = extrairGruposEJogos(rows);
    dados.ranking = extrairRanking(rows);

    renderGrupos(dados.grupos);
    renderRanking(dados.ranking);
    renderSelectParticipantes(dados.participantes, rows);
  })
  .catch(err => {
    alert("Erro ao carregar planilha: " + err.message);
    console.error(err);
  });

/* ---------- EXTRAÇÕES ---------- */

// Participantes ficam na linha 1 (índice 0) em colunas tipo G, L, Q...
// Critério: texto não-vazio, não é "Pts." e não começa com "="
function extrairParticipantes(rows) {
  const header = rows[0] || [];
  const participantes = [];

  header.forEach((v, col) => {
    const txt = String(v).trim();
    if (!txt) return;
    if (txt.toLowerCase() === "pts.") return;
    if (txt.startsWith("=")) return;
    // nomes tipo Janaina, Christiano, etc.
    participantes.push({ nome: txt, col });
  });

  return participantes;
}

// Grupos ficam na coluna A: "GRUPO A", "GRUPO B", ...
// Jogos: linhas onde colA tem timeA e colE tem timeB
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

    // só é jogo se tiver o "X" na coluna C
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

// Ranking já está em uma tabela: A = Nome, B = Pontos (a partir de "RANKING")
// Vamos procurar a linha que tem "RANKING" na coluna A, e depois ler de A/B.
function extrairRanking(rows) {
  const idxRanking = rows.findIndex(r => String(r?.[0] ?? "").trim().toUpperCase() === "RANKING");
  if (idxRanking === -1) return [];

  // Normalmente: linha seguinte tem cabeçalhos "Nome" e "Pontos"
  // e começa a lista logo abaixo.
  const start = idxRanking + 2;
  const ranking = [];

  for (let i = start; i < rows.length; i++) {
    const nome = String(rows[i]?.[0] ?? "").trim();
    const pontos = rows[i]?.[1];

    if (!nome) break; // acabou a lista
    // pontos pode vir string/number; vamos tentar normalizar:
    const n = Number(String(pontos).replace(",", "."));
    ranking.push({ nome, pontos: Number.isFinite(n) ? n : 0 });
  }

  // Ordena desc
  ranking.sort((a, b) => b.pontos - a.pontos);
  return ranking;
}

/* ---------- RENDER ---------- */

function renderGrupos(grupos) {
  const el = document.getElementById("grupos");
  el.innerHTML = "";

  grupos.forEach(g => {
    const btn = document.createElement("button");
    btn.className = "pill";
    btn.textContent = g.nome;

    btn.onclick = () => {
      mostrarTabelaDoGrupo(g); 
      document.getElementById("tabelaGrupo").scrollIntoView({ behavior: "smooth", block: "start" });
    };

    el.appendChild(btn);
  });
}

function renderRanking(ranking) {
  const tbody = document.querySelector("#ranking tbody");
  tbody.innerHTML = "";

  ranking.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${p.nome}</td><td>${p.pontos}</td>`;
    tbody.appendChild(tr);
  });
}

function renderSelectParticipantes(participantes, rows) {
  const sel = document.getElementById("participante");
  sel.innerHTML = `<option value="">Selecione...</option>`;

  participantes.forEach((p, idx) => {
    const op = document.createElement("option");
    op.value = idx;
    op.textContent = p.nome;
    sel.appendChild(op);
  });

  sel.addEventListener("change", () => {
    const idx = sel.value;
    if (idx === "") return esconderPalpites();

    const p = participantes[Number(idx)];
    mostrarPalpitesDoParticipante(p, rows);
  });
}

/* ---------- PALPITES ---------- */

// No seu layout, para cada participante:
// - palpite timeA fica na coluna (col)
// - palpite timeB fica na coluna (col + 2)
// - pontos do jogo fica na coluna (col + 3)
function mostrarPalpitesDoParticipante(part, rows) {
  const wrap = document.getElementById("palpitesWrap");
  const nome = document.getElementById("nomeSelecionado");
  const tbody = document.querySelector("#palpites tbody");

  nome.textContent = part.nome;
  tbody.innerHTML = "";

  // Reusa a mesma extração dos jogos (pra listar tudo na ordem)
  const grupos = extrairGruposEJogos(rows);

  grupos.forEach(g => {
    g.jogos.forEach(jogo => {
      const r = rows[jogo.linha] || [];

      const pA = (r[part.col] ?? "").toString().trim() || "-";
      const pB = (r[part.col + 2] ?? "").toString().trim() || "-";
      const pts = r[part.col + 3] ?? "";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${jogo.grupo}</td>
        <td>${jogo.timeA} x ${jogo.timeB}</td>
        <td>${pA} x ${pB}</td>
        <td>${pts}</td>
      `;
      tbody.appendChild(tr);
    });
  });

  wrap.classList.remove("hidden");
}

function esconderPalpites() {
  document.getElementById("palpitesWrap").classList.add("hidden");
  document.querySelector("#palpites tbody").innerHTML = "";
}

function mostrarTabelaDoGrupo(grupo) {
  const titulo = document.getElementById("tituloGrupo");
  const corpo = document.getElementById("corpoGrupo");

  titulo.textContent = grupo.nome;
  corpo.innerHTML = "";

  // cada jogo já foi detectado com timeA (col A) e timeB (col E)
  // e sabemos a linha (index) dentro de rows
  grupo.jogos.forEach(jogo => {
    const r = rowsGlobal[jogo.linha] || []; 
    // A=0, B=1, C=2, D=3, E=4
    const timeA = String(r[0] ?? "").trim();
    const placarA = String(r[1] ?? "").trim() || "-";
    const x = String(r[2] ?? "").trim() || "x";
    const placarB = String(r[3] ?? "").trim() || "-";
    const timeB = String(r[4] ?? "").trim();

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${timeA}</td>
      <td>${placarA}</td>
      <td style="text-align:center">${x}</td>
      <td>${placarB}</td>
      <td>${timeB}</td>
    `;
    corpo.appendChild(tr);
  });
}