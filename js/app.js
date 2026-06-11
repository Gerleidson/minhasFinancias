/* =============================================
   FINAPP — JavaScript principal
   Persistência via localStorage
   ============================================= */

'use strict';

// ── CONSTANTES ──────────────────────────────────
const EMOJIS = ['💰','🏠','🚗','🍔','🎓','💊','✈️','🛒','💡','📱','🎮','👗',
                 '💼','📁','🎉','🏋️','💳','🎵','📚','🐾','🌿','🍕'];
const COLORS = ['#a78bfa','#34d399','#f87171','#fbbf24','#60a5fa','#f472b6',
                '#fb923c','#4ade80','#38bdf8','#e879f9','#facc15','#2dd4bf'];
const MESES  = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// ── ESTADO / STORAGE ────────────────────────────
const load = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

let transacoes  = load('finapp_transacoes')  || [];
let categorias  = load('finapp_categorias')  || defaultCategorias();

function defaultCategorias() {
  return [
    { id: uid(), nome: 'Alimentação',   emoji: '🍔', cor: '#fbbf24' },
    { id: uid(), nome: 'Moradia',       emoji: '🏠', cor: '#60a5fa' },
    { id: uid(), nome: 'Transporte',    emoji: '🚗', cor: '#f472b6' },
    { id: uid(), nome: 'Saúde',         emoji: '💊', cor: '#34d399' },
    { id: uid(), nome: 'Lazer',         emoji: '🎮', cor: '#a78bfa' },
    { id: uid(), nome: 'Salário',       emoji: '💰', cor: '#4ade80' },
    { id: uid(), nome: 'Outros',        emoji: '📁', cor: '#fb923c' },
  ];
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function persist() {
  save('finapp_transacoes', transacoes);
  save('finapp_categorias', categorias);
}

// ── FORMATAÇÃO ──────────────────────────────────
const fmtBRL = v => 'R$ ' + parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtData = d => { if (!d) return ''; const [y,m,dd] = d.split('-'); return `${dd}/${m}/${y}`; };

// ── DOM HELPERS ─────────────────────────────────
const qs  = s => document.querySelector(s);
const qsa = s => document.querySelectorAll(s);

// ── VIEWS ────────────────────────────────────────
function showView(name) {
  qsa('.view').forEach(v => v.classList.remove('active'));
  qsa('.nav-item').forEach(n => n.classList.remove('active'));
  qs(`#view-${name}`).classList.add('active');
  qs(`[data-view="${name}"]`)?.classList.add('active');
  qs('#page-title').textContent = { dashboard:'Dashboard', transacoes:'Transações', categorias:'Categorias', relatorio:'Relatório' }[name];
  if (name === 'dashboard')   renderDashboard();
  if (name === 'transacoes')  renderTransacoes();
  if (name === 'categorias')  renderCategorias();
  if (name === 'relatorio')   renderRelatorio();
  // fechar sidebar mobile
  qs('.sidebar').classList.remove('open');
}

// ── TOAST ────────────────────────────────────────
let toastTimer;
function toast(msg, type = 'ok') {
  const el = qs('#toast');
  el.textContent = (type === 'ok' ? '✔ ' : '✘ ') + msg;
  el.style.borderColor = type === 'ok' ? 'var(--green)' : 'var(--red)';
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ── DASHBOARD ────────────────────────────────────
function renderDashboard() {
  const receitas = transacoes.filter(t => t.tipo === 'receita').reduce((s, t) => s + t.valor, 0);
  const despesas = transacoes.filter(t => t.tipo === 'despesa').reduce((s, t) => s + t.valor, 0);
  const saldo    = receitas - despesas;
  const eco      = receitas > 0 ? Math.round((saldo / receitas) * 100) : 0;

  qs('#saldo-total').textContent = fmtBRL(saldo);
  qs('#saldo-total').className   = 'card-value ' + (saldo >= 0 ? 'green' : 'red');
  qs('#saldo-sub').textContent   = saldo >= 0 ? '↑ positivo' : '↓ negativo';
  qs('#total-receitas').textContent = fmtBRL(receitas);
  qs('#total-despesas').textContent = fmtBRL(despesas);
  qs('#receitas-count').textContent = transacoes.filter(t => t.tipo === 'receita').length + ' lançamentos';
  qs('#despesas-count').textContent = transacoes.filter(t => t.tipo === 'despesa').length + ' lançamentos';
  qs('#taxa-economia').textContent  = eco + '%';

  // Últimas 6 transações
  const lista = [...transacoes].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 6);
  const ul = qs('#dash-ultimas');
  if (lista.length === 0) { ul.innerHTML = '<div class="empty-state">Nenhuma transação ainda</div>'; }
  else {
    ul.innerHTML = lista.map(t => {
      const cat = categorias.find(c => c.id === t.catId);
      return `<div class="t-item">
        <div class="t-icon" style="background:${cat?.cor || '#333'}22">${cat?.emoji || '📁'}</div>
        <div class="t-info">
          <div class="t-desc">${esc(t.descricao)}</div>
          <div class="t-meta">${fmtData(t.data)} · ${cat?.nome || 'Sem categoria'}</div>
        </div>
        <div class="t-valor ${t.tipo === 'receita' ? 'green' : 'red'}">${t.tipo === 'receita' ? '+' : '-'}${fmtBRL(t.valor)}</div>
      </div>`;
    }).join('');
  }

  // Gráfico categorias
  renderCatChart('dash-cat-chart', transacoes.filter(t => t.tipo === 'despesa'));
}

function renderCatChart(id, lista) {
  const el = qs('#' + id);
  if (!lista.length) { el.innerHTML = '<div class="empty-state">Sem dados</div>'; return; }

  const por = {};
  lista.forEach(t => { por[t.catId] = (por[t.catId] || 0) + t.valor; });
  const total = Object.values(por).reduce((s, v) => s + v, 0);
  const sorted = Object.entries(por).sort((a, b) => b[1] - a[1]).slice(0, 8);

  el.innerHTML = sorted.map(([catId, val]) => {
    const cat = categorias.find(c => c.id === catId);
    const pct = total > 0 ? Math.round((val / total) * 100) : 0;
    return `<div class="chart-row">
      <div class="chart-label-row">
        <span>${cat?.emoji || '📁'} ${cat?.nome || 'Desconhecido'}</span>
        <span>${pct}% · ${fmtBRL(val)}</span>
      </div>
      <div class="chart-bar-bg">
        <div class="chart-bar-fill" style="width:${pct}%;background:${cat?.cor || '#666'}"></div>
      </div>
    </div>`;
  }).join('');
}

// ── TRANSAÇÕES ────────────────────────────────────
function getFilters() {
  return {
    search: qs('#search-input').value.toLowerCase(),
    tipo:   qs('#filter-tipo').value,
    cat:    qs('#filter-cat').value,
    mes:    qs('#filter-mes').value,
  };
}

function filterTransacoes() {
  const f = getFilters();
  return transacoes.filter(t => {
    if (f.search && !t.descricao.toLowerCase().includes(f.search)) return false;
    if (f.tipo   && t.tipo !== f.tipo) return false;
    if (f.cat    && t.catId !== f.cat) return false;
    if (f.mes) {
      const [ano, mes] = f.mes.split('-');
      const [ty, tm] = t.data.split('-');
      if (ty !== ano || tm !== mes) return false;
    }
    return true;
  }).sort((a, b) => b.data.localeCompare(a.data));
}

function renderTransacoes() {
  populateCatFilter();
  populateMesFilter();
  const lista = filterTransacoes();
  const tbody = qs('#tabela-body');
  const empty = qs('#transacoes-empty');

  if (!lista.length) {
    tbody.innerHTML = '';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';
  tbody.innerHTML = lista.map(t => {
    const cat = categorias.find(c => c.id === t.catId);
    return `<tr data-id="${t.id}">
      <td style="font-family:var(--font-mono);font-size:.78rem;color:var(--text2)">${fmtData(t.data)}</td>
      <td>
        <div style="font-weight:600">${esc(t.descricao)}</div>
        ${t.obs ? `<div style="font-size:.72rem;color:var(--text3)">${esc(t.obs)}</div>` : ''}
      </td>
      <td>
        ${cat ? `<span style="display:inline-flex;align-items:center;gap:5px;font-size:.8rem">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${cat.cor}"></span>
          ${cat.emoji} ${cat.nome}
        </span>` : '<span style="color:var(--text3)">—</span>'}
      </td>
      <td><span class="badge badge-${t.tipo}">${t.tipo === 'receita' ? '↑' : '↓'} ${t.tipo}</span></td>
      <td class="t-valor ${t.tipo === 'receita' ? 'green' : 'red'}" style="font-family:var(--font-mono)">${t.tipo === 'receita' ? '+' : '-'}${fmtBRL(t.valor)}</td>
      <td>
        <button class="btn-icon" onclick="editarTransacao('${t.id}')">✎</button>
        <button class="btn-icon del" onclick="deletarTransacao('${t.id}')">✕</button>
      </td>
    </tr>`;
  }).join('');
}

function populateCatFilter() {
  const sel = qs('#filter-cat');
  const cur = sel.value;
  sel.innerHTML = '<option value="">Todas as categorias</option>' +
    categorias.map(c => `<option value="${c.id}">${c.emoji} ${c.nome}</option>`).join('');
  sel.value = cur;
}

function populateMesFilter() {
  const sel = qs('#filter-mes');
  const cur = sel.value;
  const meses = [...new Set(transacoes.map(t => t.data.slice(0, 7)))].sort().reverse();
  sel.innerHTML = '<option value="">Todos os meses</option>' +
    meses.map(m => {
      const [y, mo] = m.split('-');
      return `<option value="${m}">${MESES[+mo - 1]} ${y}</option>`;
    }).join('');
  sel.value = cur;
}

window.deletarTransacao = function(id) {
  if (!confirm('Deletar esta transação?')) return;
  transacoes = transacoes.filter(t => t.id !== id);
  persist();
  renderTransacoes();
  toast('Transação removida', 'ok');
};

window.editarTransacao = function(id) {
  const t = transacoes.find(t => t.id === id);
  if (!t) return;
  openModal(t);
};

// ── MODAL ─────────────────────────────────────────
function openModal(t = null) {
  populateCatSelect();
  qs('#t-id').value = t ? t.id : '';
  qs('#t-descricao').value = t ? t.descricao : '';
  qs('#t-valor').value     = t ? t.valor : '';
  qs('#t-data').value      = t ? t.data : new Date().toISOString().slice(0, 10);
  qs('#t-categoria').value = t ? t.catId : '';
  qs('#t-obs').value       = t ? (t.obs || '') : '';

  const tipo = t ? t.tipo : 'despesa';
  qs('#t-tipo').value = tipo;
  qsa('.tipo-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tipo === tipo);
  });

  qs('#modal-title').textContent = t ? 'Editar Transação' : 'Nova Transação';
  qs('#modal-overlay').classList.add('open');
  qs('#t-descricao').focus();
}

function closeModal() { qs('#modal-overlay').classList.remove('open'); }

function populateCatSelect() {
  const sel = qs('#t-categoria');
  sel.innerHTML = '<option value="">Sem categoria</option>' +
    categorias.map(c => `<option value="${c.id}">${c.emoji} ${c.nome}</option>`).join('');
}

function salvarTransacao() {
  const descricao = qs('#t-descricao').value.trim();
  const valor     = parseFloat(qs('#t-valor').value);
  const data      = qs('#t-data').value;
  const tipo      = qs('#t-tipo').value;
  const catId     = qs('#t-categoria').value;
  const obs       = qs('#t-obs').value.trim();

  if (!descricao)     { toast('Informe a descrição', 'err'); return; }
  if (!valor || valor <= 0) { toast('Valor inválido', 'err'); return; }
  if (!data)          { toast('Informe a data', 'err'); return; }

  const id = qs('#t-id').value;
  if (id) {
    const i = transacoes.findIndex(t => t.id === id);
    transacoes[i] = { id, descricao, valor, data, tipo, catId, obs };
    toast('Transação atualizada');
  } else {
    transacoes.push({ id: uid(), descricao, valor, data, tipo, catId, obs });
    toast('Transação salva');
  }
  persist();
  closeModal();
  renderDashboard();
  renderTransacoes();
}

// ── CATEGORIAS ────────────────────────────────────
function renderCategorias() {
  renderCatList();
}

function renderCatList() {
  const el = qs('#cat-list');
  const counts = {};
  transacoes.forEach(t => { counts[t.catId] = (counts[t.catId] || 0) + 1; });

  if (!categorias.length) { el.innerHTML = '<div class="empty-state">Nenhuma categoria</div>'; return; }
  el.innerHTML = categorias.map(c => `
    <div class="cat-item">
      <span class="cat-emoji">${c.emoji}</span>
      <span class="cat-dot" style="background:${c.cor}"></span>
      <span class="cat-nome">${esc(c.nome)}</span>
      <span class="cat-count">${counts[c.id] || 0} trans.</span>
      <button class="btn-icon del" onclick="deletarCategoria('${c.id}')">✕</button>
    </div>`).join('');
}

window.deletarCategoria = function(id) {
  const n = transacoes.filter(t => t.catId === id).length;
  if (n > 0 && !confirm(`Esta categoria tem ${n} transação(ões). Remover assim mesmo?`)) return;
  categorias = categorias.filter(c => c.id !== id);
  persist();
  renderCatList();
  toast('Categoria removida');
};

function salvarCategoria() {
  const nome  = qs('#cat-nome').value.trim();
  const emoji = qs('#cat-emoji').value;
  const cor   = qs('#cat-cor').value;
  if (!nome) { toast('Informe o nome', 'err'); return; }
  categorias.push({ id: uid(), nome, emoji, cor });
  persist();
  qs('#cat-nome').value = '';
  renderCatList();
  toast('Categoria criada');
}

function buildEmojiGrid() {
  const el = qs('#emoji-grid');
  el.innerHTML = EMOJIS.map(e =>
    `<div class="emoji-opt${e === '📁' ? ' sel' : ''}" data-e="${e}">${e}</div>`
  ).join('');
  el.addEventListener('click', ev => {
    const opt = ev.target.closest('.emoji-opt');
    if (!opt) return;
    qsa('.emoji-opt').forEach(o => o.classList.remove('sel'));
    opt.classList.add('sel');
    qs('#cat-emoji').value = opt.dataset.e;
  });
}

function buildColorGrid() {
  const el = qs('#color-grid');
  el.innerHTML = COLORS.map(c =>
    `<div class="color-opt${c === '#a78bfa' ? ' sel' : ''}" data-c="${c}" style="background:${c}"></div>`
  ).join('');
  el.addEventListener('click', ev => {
    const opt = ev.target.closest('.color-opt');
    if (!opt) return;
    qsa('.color-opt').forEach(o => o.classList.remove('sel'));
    opt.classList.add('sel');
    qs('#cat-cor').value = opt.dataset.c;
  });
}

// ── RELATÓRIO ─────────────────────────────────────
function renderRelatorio() {
  populateRelFiltros();
  const ano = qs('#rel-ano').value;
  const mes = qs('#rel-mes').value;

  let lista = transacoes.filter(t => {
    const [ty, tm] = t.data.split('-');
    if (ano && ty !== ano) return false;
    if (mes && tm !== mes) return false;
    return true;
  });

  const receitas = lista.filter(t => t.tipo === 'receita').reduce((s, t) => s + t.valor, 0);
  const despesas = lista.filter(t => t.tipo === 'despesa').reduce((s, t) => s + t.valor, 0);
  const saldo    = receitas - despesas;

  qs('#rel-receitas').textContent = fmtBRL(receitas);
  qs('#rel-despesas').textContent = fmtBRL(despesas);
  qs('#rel-saldo').textContent    = fmtBRL(saldo);
  qs('#rel-saldo').className      = 'card-value ' + (saldo >= 0 ? 'green' : 'red');

  renderCatChart('rel-receita-chart', lista.filter(t => t.tipo === 'receita'));
  renderCatChart('rel-despesa-chart', lista.filter(t => t.tipo === 'despesa'));
  renderBarChart(ano);
}

function populateRelFiltros() {
  const anos = [...new Set(transacoes.map(t => t.data.slice(0, 4)))].sort().reverse();
  const selA = qs('#rel-ano');
  const curA = selA.value;
  selA.innerHTML = '<option value="">Todos os anos</option>' + anos.map(a => `<option value="${a}">${a}</option>`).join('');
  selA.value = curA;

  const selM = qs('#rel-mes');
  const curM = selM.value;
  selM.innerHTML = '<option value="">Todos os meses</option>' + MESES.map((m, i) =>
    `<option value="${String(i+1).padStart(2,'0')}">${m}</option>`).join('');
  selM.value = curM;
}

function renderBarChart(anoFiltro) {
  const el = qs('#bar-chart');
  const ano = anoFiltro || new Date().getFullYear().toString();
  const mesesData = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0');
    const lista = transacoes.filter(t => t.data.startsWith(ano + '-' + m));
    return {
      label: MESES[i],
      rec: lista.filter(t => t.tipo === 'receita').reduce((s, t) => s + t.valor, 0),
      des: lista.filter(t => t.tipo === 'despesa').reduce((s, t) => s + t.valor, 0),
    };
  });

  const maxVal = Math.max(...mesesData.flatMap(d => [d.rec, d.des]), 1);

  el.innerHTML = mesesData.map(d => {
    const rh = Math.round((d.rec / maxVal) * 120);
    const dh = Math.round((d.des / maxVal) * 120);
    return `<div class="bar-group">
      <div class="bar-col">
        <div class="bar" title="Receita: ${fmtBRL(d.rec)}" style="height:${rh}px;background:var(--green);opacity:0.8"></div>
        <div class="bar" title="Despesa: ${fmtBRL(d.des)}" style="height:${dh}px;background:var(--red);opacity:0.8"></div>
      </div>
      <div class="bar-label">${d.label}</div>
    </div>`;
  }).join('');
}

// ── UTILIDADES ────────────────────────────────────
function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── INIT ──────────────────────────────────────────
function init() {
  // Data no header
  const now = new Date();
  qs('#date-badge').textContent = now.toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'short', year:'numeric' });

  // Sidebar nav
  qsa('.nav-item, .btn-link').forEach(el => {
    el.addEventListener('click', () => {
      const v = el.dataset.view;
      if (v) showView(v);
    });
  });

  // Hamburger
  qs('#hamburger').addEventListener('click', () => qs('.sidebar').classList.toggle('open'));
  qs('#modal-overlay').addEventListener('click', e => { if (e.target === qs('#modal-overlay')) closeModal(); });

  // Modal buttons
  qs('#btn-nova-transacao').addEventListener('click', () => openModal());
  qs('#modal-close').addEventListener('click', closeModal);
  qs('#btn-cancelar').addEventListener('click', closeModal);
  qs('#btn-salvar-transacao').addEventListener('click', salvarTransacao);

  // Tipo tabs
  qsa('.tipo-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      qsa('.tipo-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      qs('#t-tipo').value = btn.dataset.tipo;
    });
  });

  // Filtros transações
  ['search-input','filter-tipo','filter-cat','filter-mes'].forEach(id =>
    qs('#' + id)?.addEventListener('input', renderTransacoes)
  );

  // Categoria
  buildEmojiGrid();
  buildColorGrid();
  qs('#btn-salvar-cat').addEventListener('click', salvarCategoria);

  // Relatório filtros
  qs('#rel-ano').addEventListener('change', renderRelatorio);
  qs('#rel-mes').addEventListener('change', renderRelatorio);

  // Limpar tudo
  qs('#btn-limpar-tudo').addEventListener('click', () => {
    if (!confirm('Deletar TODAS as transações e categorias? Isso não pode ser desfeito.')) return;
    transacoes = [];
    categorias = defaultCategorias();
    persist();
    showView('dashboard');
    toast('Dados limpos');
  });

  // Renderizar inicial
  showView('dashboard');
}

document.addEventListener('DOMContentLoaded', init);
