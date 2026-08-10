import './style.css';
import './scene.css';
import './scene-auto.css';
import './readability.css';
import './case-brief.css';
import './schema-details.css';
import { cases } from './case-data.js';
import { executeSQL } from './sql-engine.js';
import { setupSqlAutocomplete } from './sql-autocomplete.js';

const $ = selector => document.querySelector(selector);
const completed = new Set(JSON.parse(localStorage.getItem('sqlkiller_completed') || '[]'));
let active = null;
let found = new Set();
let selected = 0;
let hintIndex = 0;

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function renderBoard() {
  const unlocked = Math.min(completed.size + 1, cases.length);
  $('#caseGrid').innerHTML = cases.map((caseFile, index) => {
    const locked = index >= unlocked;
    const solved = completed.has(caseFile.id);
    const state = solved ? '✓ CLOSED' : locked ? '⌖ LOCKED' : '● AVAILABLE';
    return '<button class="case-card ' + (locked ? 'locked ' : '') + (solved ? 'complete' : '') +
      '" data-index="' + index + '" ' + (locked ? 'disabled' : '') + '>' +
      '<div class="case-no">' + caseFile.id + '<span>' + state + '</span></div>' +
      '<small>' + caseFile.difficulty + '</small><h2>' + caseFile.title + '</h2>' +
      '<p>' + caseFile.subtitle + '</p><div><b>' + caseFile.concept +
      '</b><span>เปิดแฟ้ม →</span></div></button>';
  }).join('');
  $('#solvedCount').textContent = completed.size + '/' + cases.length;
  $('#rankText').textContent = completed.size >= 3 ? 'SENIOR' : completed.size >= 1 ? 'DETECTIVE' : 'ROOKIE';
  document.querySelectorAll('.case-card:not(.locked)').forEach(card => {
    card.onclick = () => openCase(Number(card.dataset.index));
  });
}

function openCase(index) {
  active = cases[index];
  found = new Set();
  selected = 0;
  hintIndex = 0;
  $('#caseBoard').classList.add('hidden');
  $('#game').classList.remove('hidden');
  $('#headerCase').textContent = active.id + ' / ' + active.subtitle;
  $('#headerStatus').textContent = 'ACTIVE';
  $('#caseTitle').textContent = active.title;
  $('#caseMeta').textContent = active.meta;
  $('#caseBrief').textContent = active.brief;
  $('#concept').textContent = active.concept;
  $('#dbName').textContent = active.id.toLowerCase().replace('-', '_') + '_db';
  $('#tipText').textContent = active.tip;
  $('#hint').textContent = active.hints[0];
  $('#notesTitle').textContent = active.title;
  $('#caseNotes').innerHTML = '<p>' + active.brief + '</p><ul>' +
    active.objectives.map(item => '<li><b>' + item[1] + '</b> — ' + item[2] + '</li>').join('') + '</ul>';
  $('#sql').value = active.starter;
  $('#evidenceList').innerHTML = '';
  $('#empty').classList.remove('hidden');
  $('#count').textContent = '0';
  $('#progress').textContent = '0 / ' + active.objectives.length;
  $('#accuse').disabled = true;
  $('#accuse small').textContent = 'LOCKED';
  $('#sceneWrap').classList.toggle('hidden', !active.image);
  if (active.image) $('#sceneImage').src = active.image;
  renderMissions();
  renderSchema();
  renderRows(active.tables[active.suspectTable]);
  switchTab('terminal');
}

function renderMissions() {
  $('#missions').innerHTML = active.objectives.map((item, index) =>
    '<div class="mission" data-table="' + item[0] + '"><i>0' + (index + 1) + '</i><div><b>' +
    item[1] + '</b><small>' + item[2] + '</small></div><span>○</span></div>'
  ).join('');
}

function renderSchema() {
  $('#schemaGrid').innerHTML = Object.entries(active.tables).map(([name, rows]) => {
    const info = active.dictionary[name] || { description: '', columns: {} };
    const columns = Object.keys(rows[0] || {});
    return '<article class="schema-card">' +
      '<button class="schema-card-head schema-query" data-name="' + name + '" title="สร้าง SELECT จากตารางนี้">' +
      '<span><small>TABLE</small><b>' + name + '</b></span><i>' + rows.length + ' ROWS</i><em>SELECT →</em></button>' +
      '<p class="table-description">' + info.description + '</p>' +
      '<div class="column-list">' + columns.map(column => {
        const detail = info.columns[column] || [typeof rows[0][column], ''];
        return '<div class="column-detail"><div><b>' + column + '</b><code>' + detail[0] +
          '</code></div><p>' + detail[1] + '</p></div>';
      }).join('') + '</div></article>';
  }).join('');
  document.querySelectorAll('.schema-query').forEach(button => {
    button.onclick = () => {
      $('#sql').value = 'SELECT *\nFROM ' + button.dataset.name + ';';
      switchTab('terminal');
      $('#sql').focus();
    };
  });
}

function badge(value) {
  if (value === null || value === undefined) return '<span class="null">NULL</span>';
  const danger = ['HIGH', 'OVERRIDE', 'LOG DELETED', 'YES', 'VICTIM DNA', 'FLAGGED', 'EXPIRED'];
  const safe = ['LOW', 'VALID', 'NO', 'NONE', 'PAID'];
  if (danger.includes(String(value))) return '<span class="badge danger">' + escapeHTML(value) + '</span>';
  if (safe.includes(String(value))) return '<span class="badge safe">' + escapeHTML(value) + '</span>';
  return escapeHTML(value);
}

function renderRows(rows, columns) {
  if (!rows.length) {
    $('#table').innerHTML = '<tbody><tr><td class="error">0 rows returned</td></tr></tbody>';
    return;
  }
  const keys = columns && columns.length ? columns : Object.keys(rows[0]);
  $('#table').innerHTML = '<thead><tr><th>#</th>' + keys.map(key => '<th>' + escapeHTML(key) + '</th>').join('') +
    '</tr></thead><tbody>' + rows.map((row, index) =>
      '<tr><td class="num">' + String(index + 1).padStart(2, '0') + '</td>' +
      keys.map(key => '<td>' + badge(row[key]) + '</td>').join('') + '</tr>'
    ).join('') + '</tbody>';
}

function addEvidence(table) {
  const objective = active.objectives.find(item => item[0] === table);
  if (!objective || found.has(table)) return;
  found.add(table);
  const element = document.createElement('div');
  element.className = 'e-item';
  element.innerHTML = '<i>✦</i><div><small>' + objective[3] + '</small><p>' + objective[4] + '</p></div>';
  $('#evidenceList').append(element);
  $('#empty').classList.add('hidden');
  const mission = document.querySelector('.mission[data-table="' + table + '"]');
  mission.classList.add('done');
  mission.querySelector('span').textContent = '✓';
  $('#count').textContent = found.size;
  $('#progress').textContent = found.size + ' / ' + active.objectives.length;
  if (found.size === active.objectives.length) {
    $('#accuse').disabled = false;
    $('#accuse small').textContent = 'READY';
  }
}

function runQuery() {
  const query = $('#sql').value.trim();
  $('#status').textContent = 'Executing…';
  window.setTimeout(() => {
    try {
      if (!/^select\b/i.test(query)) throw new Error('โหมดสืบสวนรองรับเฉพาะคำสั่ง SELECT');
      const result = executeSQL(query, active.tables);
      renderRows(result.data, result.columns);
      result.tables.forEach(addEvidence);
      $('#status').textContent = 'Success';
      $('#rows').textContent = result.data.length + ' rows · ' + Math.ceil(Math.random() * 6) + 'ms';
    } catch (error) {
      $('#table').innerHTML = '<tbody><tr><td class="error">SQL ERROR: ' + escapeHTML(error.message) + '</td></tr></tbody>';
      $('#status').textContent = 'Error';
      $('#rows').textContent = 'SQLSTATE 42000';
    }
  }, 220);
}

function switchTab(name) {
  ['terminal', 'schema', 'notes'].forEach(id => $('#' + id).classList.toggle('hidden', id !== name));
  document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === name));
}

function goBoard() {
  $('#game').classList.add('hidden');
  $('#caseBoard').classList.remove('hidden');
  $('#headerCase').textContent = 'DATA CRIME BUREAU';
  $('#headerStatus').textContent = 'ONLINE';
  renderBoard();
}

function openAccusation() {
  selected = 0;
  $('#modal').classList.remove('hidden');
  $('#question').textContent = active.question;
  $('#confirm').disabled = true;
  $('#confirm').textContent = 'ยืนยันข้อสรุป';
  $('#confirm').dataset.closed = 'false';
  $('#verdict').className = '';
  $('#verdict').innerHTML = '';
  const people = active.tables[active.suspectTable];
  $('#suspectList').innerHTML = people.map(person =>
    '<button data-id="' + person.id + '"><span>0' + person.id + '</span><div><b>' + person.name +
    '</b><small>' + (person.role || person.department || person.team || 'SUSPECT') + '</small></div></button>'
  ).join('');
  document.querySelectorAll('#suspectList button').forEach(button => {
    button.onclick = () => {
      document.querySelectorAll('#suspectList button').forEach(item => item.classList.remove('selected'));
      button.classList.add('selected');
      selected = Number(button.dataset.id);
      $('#confirm').disabled = false;
    };
  });
}

function confirmAccusation() {
  if ($('#confirm').dataset.closed === 'true') {
    $('#modal').classList.add('hidden');
    goBoard();
    return;
  }
  const won = selected === active.culprit;
  const verdict = $('#verdict');
  verdict.className = won ? 'win' : 'lose';
  verdict.innerHTML = won
    ? '<b>CASE CLOSED</b>ข้อสรุปถูกต้อง หลักฐานทุกชิ้นเชื่อมโยงถึงบุคคลเดียวกัน'
    : '<b>INSUFFICIENT EVIDENCE</b>ข้อสรุปยังขัดกับข้อมูล ลองตรวจ ID ที่เชื่อมระหว่างตาราง';
  if (won) {
    completed.add(active.id);
    localStorage.setItem('sqlkiller_completed', JSON.stringify([...completed]));
    $('#confirm').textContent = 'ปิดแฟ้มและกลับหน้าคดี';
    $('#confirm').dataset.closed = 'true';
  }
}

$('#run').onclick = runQuery;
$('#clear').onclick = () => { $('#sql').value = ''; $('#sql').focus(); };
$('#sql').addEventListener('keydown', event => {
  if (event.ctrlKey && event.key === 'Enter') {
    event.preventDefault();
    runQuery();
  }
});
document.querySelectorAll('.tab').forEach(tab => { tab.onclick = () => switchTab(tab.dataset.tab); });
$('#nextHint').onclick = () => {
  hintIndex = (hintIndex + 1) % active.hints.length;
  $('#hint').textContent = active.hints[hintIndex];
};
$('#backBtn').onclick = goBoard;
$('#homeBtn').onclick = goBoard;
$('#handbookBtn').onclick = () => $('#handbook').classList.remove('hidden');
$('#accuse').onclick = openAccusation;
$('#confirm').onclick = confirmAccusation;
document.querySelectorAll('[data-close]').forEach(button => {
  button.onclick = () => $('#' + button.dataset.close).classList.add('hidden');
});

document.querySelector('.runbar span:nth-child(2)').textContent = 'TAB: AUTOCOMPLETE · CTRL+SPACE: SUGGEST';
document.querySelector('.schema-title p').textContent = 'Data Dictionary: ความหมาย ชนิดข้อมูล และความสัมพันธ์ของทุกฟิลด์';
setupSqlAutocomplete($('#sql'), () => active ? active.tables : {});
renderBoard();
