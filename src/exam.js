import './exam.css';
import { examQuestions, examReferenceRows, examSections } from './exam-data.js';
import { downloadExamWorkbook } from './excel-export.js';

const STORAGE_KEY = 'sqlkiller_exam_attempt_v1';
const EXAM_DURATION_MS = 90 * 60 * 1000;
const STATE_VERSION = 2;
const $ = selector => document.querySelector(selector);

let state = loadState();
let saveTimer = null;
let toastTimer = null;

function createFreshState() {
  return {
    version: STATE_VERSION,
    startedAt: null,
    submittedAt: null,
    expiredAt: null,
    activeIndex: 0,
    answers: {},
    languages: {},
    completed: [],
    validations: {}
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== 'object') return createFreshState();
    const validIds = new Set(examQuestions.map(question => question.id));
    const validLanguages = new Set(['sql', 'javascript', 'typescript', 'json', 'csharp', 'other']);
    const asTimestamp = value => {
      const timestamp = Number(value);
      return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
    };
    const answers = saved.answers && typeof saved.answers === 'object'
      ? Object.fromEntries(Object.entries(saved.answers).filter(([id]) => validIds.has(id)))
      : {};
    const languages = saved.languages && typeof saved.languages === 'object'
      ? Object.fromEntries(Object.entries(saved.languages).filter(([id, language]) => validIds.has(id) && validLanguages.has(language)))
      : {};
    const validations = saved.validations && typeof saved.validations === 'object'
      ? Object.fromEntries(Object.entries(saved.validations).filter(([id, results]) => validIds.has(id) && Array.isArray(results)))
      : {};
    return {
      ...createFreshState(),
      startedAt: asTimestamp(saved.startedAt),
      submittedAt: asTimestamp(saved.submittedAt),
      expiredAt: asTimestamp(saved.expiredAt),
      activeIndex: Math.min(Math.max(Number(saved.activeIndex) || 0, 0), examQuestions.length - 1),
      answers,
      languages,
      completed: Array.isArray(saved.completed) ? [...new Set(saved.completed.filter(id => validIds.has(id)))] : [],
      validations
    };
  } catch {
    return createFreshState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

function isExpired(at = Date.now()) {
  return Boolean(state.expiredAt || (state.startedAt && at - state.startedAt >= EXAM_DURATION_MS));
}

function isLocked() {
  return Boolean(state.submittedAt || isExpired());
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

function formatMoney(value) {
  return new Intl.NumberFormat('th-TH').format(value);
}

function questionAnswer(question) {
  return Object.prototype.hasOwnProperty.call(state.answers, question.id)
    ? String(state.answers[question.id])
    : question.starter;
}

function questionLanguage(question) {
  return state.languages[question.id] || question.language;
}

function hasAttempted(question) {
  const answer = questionAnswer(question).trim();
  return Boolean(answer) && answer !== question.starter.trim();
}

function renderReferenceData() {
  const groups = new Map();
  examReferenceRows.forEach(row => {
    if (!groups.has(row.orderNo)) groups.set(row.orderNo, []);
    groups.get(row.orderNo).push(row);
  });

  $('#examIntroOrderCards').innerHTML = [...groups.entries()].map(([orderNo, rows]) => {
    const first = rows[0];
    return `<article class="exam-order-card">
      <div><small>ORDER NO.</small><b>${escapeHTML(orderNo)}</b><span>${escapeHTML(first.status)}</span></div>
      <p>${escapeHTML(first.shop)} <em>${escapeHTML(first.orderedAt)}</em></p>
      <ul>${rows.map(row => `<li><span>${escapeHTML(row.item)} <small>${escapeHTML(row.option)}</small></span><b>฿${formatMoney(row.net)}</b></li>`).join('')}</ul>
    </article>`;
  }).join('');

  $('#examMiniOrders').innerHTML = examReferenceRows.map(row => `<article>
    <div><small>${escapeHTML(row.orderNo)}</small><span>${escapeHTML(row.status)}</span></div>
    <b>${escapeHTML(row.item)}</b>
    <p>${escapeHTML(row.shop)} · ${escapeHTML(row.option)}</p>
    <footer><span>QTY ${row.quantity}</span><strong>฿${formatMoney(row.net)}</strong></footer>
  </article>`).join('');

  $('#examFullTableBody').innerHTML = examReferenceRows.map(row => `<tr>
    <td>${row.rowNo}</td><td>${escapeHTML(row.shop)}</td><td>${escapeHTML(row.status)}</td>
    <td>${escapeHTML(row.orderedAt)}</td><td><code>${escapeHTML(row.orderNo)}</code></td>
    <td>${escapeHTML(row.item)}</td><td>${escapeHTML(row.option)}</td><td>${row.quantity}</td>
    <td>${formatMoney(row.subtotal)}</td><td>${formatMoney(row.shipping)}</td>
    <td>${formatMoney(row.discount)}</td><td>${formatMoney(row.net)}</td>
  </tr>`).join('');
}

function renderIntro() {
  const started = Boolean(state.startedAt);
  const submitted = Boolean(state.submittedAt);
  const expired = isExpired();
  const completedCount = state.completed.length;

  if (submitted) {
    $('#examStartBtn').innerHTML = 'ดูคำตอบรอบล่าสุด <span>→</span>';
    $('#examResumeNote').textContent = `ส่งแล้ว ${completedCount}/${examQuestions.length} ข้อ · ดาวน์โหลดคำตอบหรือเริ่มรอบใหม่ได้`;
  } else if (expired) {
    $('#examStartBtn').innerHTML = 'ดูคำตอบรอบที่หมดเวลา <span>→</span>';
    $('#examResumeNote').textContent = `หมดเวลาแล้ว · บันทึกไว้ ${completedCount}/${examQuestions.length} ข้อ และดาวน์โหลดคำตอบได้`;
  } else if (started) {
    $('#examStartBtn').innerHTML = `ทำต่อข้อ ${String(state.activeIndex + 1).padStart(2, '0')} <span>→</span>`;
    $('#examResumeNote').textContent = `บันทึกแล้ว ${completedCount}/${examQuestions.length} ข้อ · เวลายังคงนับต่อจากรอบเดิม`;
  } else {
    $('#examStartBtn').innerHTML = 'เริ่มทำข้อสอบ <span>→</span>';
    $('#examResumeNote').textContent = 'คำตอบจะถูกบันทึกอัตโนมัติในเครื่องนี้';
  }

  $('#examResetIntroBtn').classList.toggle('hidden', !started);
  $('#examIntro').classList.remove('hidden');
  $('#examWorkspace').classList.add('hidden');
  updateClock();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function startOrResumeExam() {
  if (!state.startedAt) {
    state.startedAt = Date.now();
    saveState();
  }
  $('#examIntro').classList.add('hidden');
  $('#examWorkspace').classList.remove('hidden');
  renderQuestion();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderQuestionList() {
  const completed = new Set(state.completed);
  $('#examQuestionList').innerHTML = examSections.map(section => {
    const questions = examQuestions.filter(question => question.section === section.id);
    return `<div class="exam-nav-section">
      <div><b>${escapeHTML(section.title)}</b><small>${escapeHTML(section.range)}</small></div>
      ${questions.map(question => {
        const index = examQuestions.indexOf(question);
        const isActive = index === state.activeIndex;
        const isComplete = completed.has(question.id);
        const isDraft = hasAttempted(question);
        const statusLabel = isComplete ? 'ทำแล้ว' : isDraft ? 'มี Draft' : 'ยังไม่ทำ';
        return `<button type="button" data-exam-question="${index}" class="${isActive ? 'active ' : ''}${isComplete ? 'complete ' : ''}${isDraft ? 'draft' : ''}" aria-label="ข้อ ${String(question.number).padStart(2, '0')}: ${escapeHTML(question.title)} — ${statusLabel}" aria-current="${isActive ? 'step' : 'false'}">
          <i>${String(question.number).padStart(2, '0')}</i><span>${escapeHTML(question.title)}</span><b>${isComplete ? '✓' : isDraft ? '•' : '○'}</b>
        </button>`;
      }).join('')}
    </div>`;
  }).join('');
}

function renderProgress() {
  const completedCount = state.completed.length;
  $('#examProgressText').textContent = `${completedCount} / ${examQuestions.length}`;
  $('#examProgressBar').style.width = `${completedCount / examQuestions.length * 100}%`;
  $('#examProgressA11y').setAttribute('aria-valuenow', String(completedCount));
  $('#examProgressA11y').setAttribute('aria-valuetext', `ทำเสร็จ ${completedCount} จาก ${examQuestions.length} ข้อ`);
}

function fileExtension(language) {
  return ({ sql: 'sql', javascript: 'js', typescript: 'ts', json: 'json', csharp: 'cs', other: 'txt' })[language] || 'txt';
}

function updateEditorFile() {
  const language = $('#examLanguage').value;
  $('#examEditorFile').textContent = `answer-${String(state.activeIndex + 1).padStart(2, '0')}.${fileExtension(language)}`;
}

function updateEditorMetrics() {
  const answer = $('#examAnswer').value;
  const lineCount = Math.max(answer.split('\n').length, 1);
  const railLimit = Math.min(lineCount, 500);
  $('#examLineRail').textContent = Array.from({ length: railLimit }, (_, index) => index + 1).join('\n');
  $('#examLineCount').textContent = `${lineCount} ${lineCount === 1 ? 'LINE' : 'LINES'}`;
}

function renderCriteria(results = null) {
  const question = examQuestions[state.activeIndex];
  $('#examCriteria').innerHTML = question.checks.map((check, index) => {
    const result = Array.isArray(results) ? results[index] : null;
    const className = result === true ? 'pass' : result === false ? 'fail' : '';
    const icon = result === true ? '✓' : result === false ? '×' : '○';
    return `<div class="exam-criterion ${className}"><i>${icon}</i><span>${escapeHTML(check.label)}</span></div>`;
  }).join('');

  if (!Array.isArray(results)) {
    $('#examCheckNote').textContent = 'กด “ตรวจองค์ประกอบ” เมื่อเขียนคำตอบแล้ว';
    return;
  }

  const passed = results.filter(Boolean).length;
  $('#examCheckNote').textContent = `พบองค์ประกอบ ${passed}/${results.length} ข้อ · ยังควรทดสอบโค้ดจริงก่อนส่ง`;
}

function renderQuestion() {
  const question = examQuestions[state.activeIndex];
  const submitted = Boolean(state.submittedAt);
  const expired = isExpired();
  const locked = submitted || expired;
  const completed = state.completed.includes(question.id);

  $('#examQuestionSection').textContent = question.section;
  $('#examQuestionEyebrow').textContent = question.eyebrow;
  $('#examQuestionNumber').textContent = `${String(question.number).padStart(2, '0')} / ${String(examQuestions.length).padStart(2, '0')}`;
  $('#examQuestionTitle').textContent = question.title;
  $('#examQuestionPrompt').textContent = question.prompt;
  $('#examQuestionRequirements').innerHTML = question.requirements.map((requirement, index) => `<li><i>${String(index + 1).padStart(2, '0')}</i><span>${escapeHTML(requirement)}</span></li>`).join('');
  $('#examLanguage').value = questionLanguage(question);
  $('#examAnswer').value = questionAnswer(question);
  $('#examHintText').textContent = question.hint;
  $('#examHintText').classList.add('hidden');
  $('#examHintBtn').innerHTML = 'เปิดแนวทางของข้อนี้ <span>+</span>';
  $('#examMobileHintBtn').textContent = '◇ แนวทาง';
  $('#examSaveStatus').textContent = submitted ? 'READ ONLY · SUBMITTED' : expired ? 'READ ONLY · TIME UP' : 'บันทึกอัตโนมัติแล้ว';
  $('#examMarkBtn').innerHTML = completed ? 'ยกเลิกสถานะทำแล้ว <span>↺</span>' : 'บันทึกเป็นทำแล้ว <span>✓</span>';
  $('#examMarkBtn').classList.toggle('marked', completed);
  $('#examPrevBtn').disabled = state.activeIndex === 0;
  $('#examNextBtn').disabled = state.activeIndex === examQuestions.length - 1;
  $('#examAnswer').readOnly = locked;
  $('#examLanguage').disabled = locked;
  $('#examCheckBtn').disabled = locked;
  $('#examMarkBtn').disabled = locked;
  $('#examFinishBtn').disabled = locked;
  $('#examSubmittedBanner').classList.toggle('hidden', !locked);
  $('#examLockedTitle').textContent = submitted ? 'ส่งแบบฝึกหัดรอบนี้แล้ว' : 'หมดเวลาสำหรับรอบนี้แล้ว';
  $('#examLockedMessage').textContent = submitted
    ? 'เปิดดูและดาวน์โหลดคำตอบได้ แต่ไม่สามารถแก้ไขจนกว่าจะเริ่มรอบใหม่'
    : 'Draft ล่าสุดถูกบันทึกและล็อกไว้แล้ว ดาวน์โหลดคำตอบหรือเริ่มรอบใหม่ได้';

  updateEditorFile();
  updateEditorMetrics();
  renderCriteria(state.validations[question.id] || null);
  renderQuestionList();
  renderProgress();
  updateClock();
}

function flushDraft({ force = false } = {}) {
  if ($('#examWorkspace').classList.contains('hidden') || (!force && isLocked())) return;
  window.clearTimeout(saveTimer);
  const question = examQuestions[state.activeIndex];
  state.answers[question.id] = $('#examAnswer').value;
  state.languages[question.id] = $('#examLanguage').value;
  const saved = saveState();
  $('#examSaveStatus').textContent = saved ? 'บันทึกอัตโนมัติแล้ว' : 'บันทึกในเครื่องไม่สำเร็จ';
}

function scheduleDraftSave() {
  if (isLocked()) return;
  $('#examSaveStatus').textContent = 'กำลังบันทึก…';
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    flushDraft();
    renderQuestionList();
  }, 280);
}

function goToQuestion(index) {
  flushDraft();
  state.activeIndex = Math.min(Math.max(index, 0), examQuestions.length - 1);
  saveState();
  renderQuestion();
  window.requestAnimationFrame(() => {
    const heading = $('#examQuestionTitle');
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function runChecks() {
  if (isLocked()) return;
  flushDraft();
  const question = examQuestions[state.activeIndex];
  const answer = questionAnswer(question);
  if (!hasAttempted(question)) {
    showToast('เขียนคำตอบเพิ่มเติมก่อนตรวจองค์ประกอบ');
    $('#examAnswer').focus();
    return;
  }
  const results = question.checks.map(check => {
    try {
      return Boolean(check.validate(answer));
    } catch {
      return false;
    }
  });
  state.validations[question.id] = results;
  saveState();
  renderCriteria(results);
  const passed = results.filter(Boolean).length;
  showToast(passed === results.length
    ? 'พบองค์ประกอบพื้นฐานครบแล้ว — อย่าลืมทดสอบโค้ดจริง'
    : `พบองค์ประกอบ ${passed}/${results.length} รายการ`);
}

function toggleCompleted() {
  if (isLocked()) return;
  flushDraft();
  const question = examQuestions[state.activeIndex];
  const completed = new Set(state.completed);
  if (completed.has(question.id)) {
    completed.delete(question.id);
    showToast(`นำข้อ ${question.number} กลับมาทบทวนแล้ว`);
  } else {
    if (!hasAttempted(question)) {
      showToast('กรุณาเขียนคำตอบก่อนบันทึกเป็นทำแล้ว');
      $('#examAnswer').focus();
      return;
    }
    completed.add(question.id);
    showToast(`บันทึกข้อ ${question.number} เป็นทำแล้ว`);
  }
  state.completed = [...completed];
  saveState();
  renderQuestion();
}

function toggleHint() {
  const hidden = $('#examHintText').classList.toggle('hidden');
  $('#examHintBtn').innerHTML = hidden ? 'เปิดแนวทางของข้อนี้ <span>+</span>' : 'ซ่อนแนวทาง <span>−</span>';
  $('#examMobileHintBtn').textContent = hidden ? '◇ แนวทาง' : '◇ ซ่อนแนวทาง';
  if (!hidden) $('#examHintText').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function openModal(id) {
  const modal = $('#' + id);
  modal._examOpener = document.activeElement;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('exam-modal-open');
  document.querySelectorAll('body > :not(.exam-modal):not(script)').forEach(element => {
    element.inert = true;
  });
  window.setTimeout(() => modal.querySelector('button')?.focus(), 0);
}

function closeModal(id) {
  const modal = $('#' + id);
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  if (!document.querySelector('.exam-modal:not(.hidden)')) {
    document.body.classList.remove('exam-modal-open');
    document.querySelectorAll('body > :not(.exam-modal):not(script)').forEach(element => {
      element.inert = false;
    });
  }
  modal._examOpener?.focus?.();
  modal._examOpener = null;
}

function openSubmitReview() {
  if (isLocked()) return;
  flushDraft();
  const complete = state.completed.length;
  const drafts = examQuestions.filter(hasAttempted).length;
  $('#examSubmitCompleted').textContent = `${complete}/${examQuestions.length}`;
  $('#examSubmitMessage').textContent = complete === examQuestions.length
    ? 'ทุกข้อถูกบันทึกเป็นทำแล้ว หลังยืนยันจะล็อกคำตอบรอบนี้และดาวน์โหลดเก็บไว้ได้'
    : `ยังมี ${examQuestions.length - complete} ข้อที่ไม่ได้บันทึกเป็นทำแล้ว (${drafts} ข้อมี draft) คุณยังส่งได้ แต่ควรตรวจทานก่อน`;
  openModal('examSubmitModal');
}

function confirmSubmit() {
  if (isLocked()) return;
  flushDraft();
  state.submittedAt = Date.now();
  saveState();
  closeModal('examSubmitModal');
  renderQuestion();
  showToast('ส่งแบบฝึกหัดแล้ว — คำตอบรอบนี้ถูกล็อกไว้');
}

function requestReset() {
  openModal('examResetModal');
}

function confirmReset() {
  window.clearTimeout(saveTimer);
  localStorage.removeItem(STORAGE_KEY);
  state = createFreshState();
  closeModal('examResetModal');
  renderIntro();
  showToast('ลบรอบเดิมแล้ว พร้อมเริ่มข้อสอบรอบใหม่');
}

function exportAnswers() {
  flushDraft();
  const completed = new Set(state.completed);
  const createdAt = new Date().toLocaleString('th-TH');
  const content = [
    '# Developer Exam Lab — คำตอบแบบฝึกปฏิบัติ',
    '',
    `ส่งออกเมื่อ: ${createdAt}`,
    `ความคืบหน้า: ${completed.size}/${examQuestions.length} ข้อ`,
    '',
    '> ไฟล์นี้เป็นคำตอบที่บันทึกจาก Exam Lab โปรดทดสอบโค้ดจริงและตรวจไฟล์ Excel ก่อนส่ง',
    '',
    ...examQuestions.flatMap(question => [
      `## ข้อ ${question.number} — ${question.title}`,
      '',
      `สถานะ: ${completed.has(question.id) ? 'ทำแล้ว' : hasAttempted(question) ? 'มี Draft' : 'ยังไม่ทำ'}`,
      '',
      '````' + questionLanguage(question),
      questionAnswer(question),
      '````',
      ''
    ])
  ].join('\n');

  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `developer-exam-answers-${new Date().toISOString().slice(0, 10)}.md`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('ดาวน์โหลดคำตอบเป็นไฟล์ Markdown แล้ว');
}

function exportExcelAnswers() {
  flushDraft();
  try {
    downloadExamWorkbook({
      examQuestions,
      examReferenceRows,
      state,
      helpers: {
        getAnswer: question => questionAnswer(question),
        getLanguage: question => questionLanguage(question),
        hasAttempted: question => hasAttempted(question)
      }
    });
    showToast('ดาวน์โหลดคำตอบและผลสรุปเป็น Excel แล้ว');
  } catch {
    showToast('สร้างไฟล์ Excel ไม่สำเร็จ กรุณาลองอีกครั้ง');
  }
}

function formatTime(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function updateClock() {
  const timer = $('#examTimer');
  if (!state.startedAt) {
    timer.textContent = '90:00';
    timer.classList.remove('warning', 'expired');
    $('#examSessionStatus').textContent = 'READY';
    return;
  }

  const now = Date.now();
  const endTime = state.submittedAt || state.expiredAt || now;
  const remaining = Math.max(0, EXAM_DURATION_MS - (endTime - state.startedAt));
  timer.textContent = formatTime(remaining);
  timer.classList.toggle('warning', remaining > 0 && remaining <= 10 * 60 * 1000);
  timer.classList.toggle('expired', remaining === 0);
  $('#examSessionStatus').textContent = state.submittedAt ? 'SUBMITTED' : remaining === 0 ? 'TIME UP' : 'IN PROGRESS';

  if (!state.submittedAt && !state.expiredAt && remaining === 0) {
    flushDraft({ force: true });
    state.expiredAt = state.startedAt + EXAM_DURATION_MS;
    saveState();
    if (!$('#examSubmitModal').classList.contains('hidden')) closeModal('examSubmitModal');
    if ($('#examWorkspace').classList.contains('hidden')) renderIntro();
    else renderQuestion();
    showToast('หมดเวลาแล้ว — ระบบบันทึกและล็อก Draft รอบนี้ไว้');
  }
}

function showToast(message) {
  const toast = $('#examToast');
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2600);
}

$('#examStartBtn').addEventListener('click', startOrResumeExam);
$('#examOverviewBtn').addEventListener('click', () => {
  flushDraft();
  renderIntro();
});
$('#examResetIntroBtn').addEventListener('click', requestReset);
$('#examNewAttemptBtn').addEventListener('click', requestReset);
$('#examConfirmResetBtn').addEventListener('click', confirmReset);
$('#examQuestionList').addEventListener('click', event => {
  const button = event.target.closest('[data-exam-question]');
  if (button) goToQuestion(Number(button.dataset.examQuestion));
});
$('#examAnswer').addEventListener('input', () => {
  updateEditorMetrics();
  const question = examQuestions[state.activeIndex];
  delete state.validations[question.id];
  renderCriteria();
  scheduleDraftSave();
});
$('#examAnswer').addEventListener('scroll', () => {
  $('#examLineRail').style.transform = `translateY(-${$('#examAnswer').scrollTop}px)`;
});
$('#examAnswer').addEventListener('keydown', event => {
  const primaryModifier = event.ctrlKey || event.metaKey;
  if (primaryModifier && event.key === 'Enter') {
    event.preventDefault();
    runChecks();
  }
  if (primaryModifier && event.key.toLocaleLowerCase() === 's') {
    event.preventDefault();
    flushDraft();
    showToast('บันทึก Draft แล้ว');
  }
});
$('#examLanguage').addEventListener('change', () => {
  updateEditorFile();
  scheduleDraftSave();
});
$('#examPrevBtn').addEventListener('click', () => goToQuestion(state.activeIndex - 1));
$('#examNextBtn').addEventListener('click', () => goToQuestion(state.activeIndex + 1));
$('#examCheckBtn').addEventListener('click', runChecks);
$('#examMarkBtn').addEventListener('click', toggleCompleted);
$('#examHintBtn').addEventListener('click', toggleHint);
$('#examMobileHintBtn').addEventListener('click', toggleHint);
$('#examDownloadBtn').addEventListener('click', exportAnswers);
$('#examExcelBtn').addEventListener('click', exportExcelAnswers);
$('#examFinishBtn').addEventListener('click', openSubmitReview);
$('#examConfirmSubmitBtn').addEventListener('click', confirmSubmit);

['examOpenDataIntroBtn', 'examOpenDataBtn', 'examMobileDataBtn'].forEach(id => {
  $('#' + id).addEventListener('click', () => openModal('examDataModal'));
});

document.querySelectorAll('[data-exam-close]').forEach(button => {
  button.addEventListener('click', () => closeModal(button.dataset.examClose));
});

document.querySelectorAll('.exam-modal').forEach(modal => {
  modal.addEventListener('mousedown', event => {
    if (event.target === modal) closeModal(modal.id);
  });
});

document.addEventListener('keydown', event => {
  const modal = document.querySelector('.exam-modal:not(.hidden)');
  if (!modal) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeModal(modal.id);
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = [...modal.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
    .filter(element => !element.hidden && element.getClientRects().length);
  if (!focusable.length) {
    event.preventDefault();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

window.addEventListener('beforeunload', flushDraft);

renderReferenceData();
document.querySelectorAll('.exam-modal').forEach(modal => modal.setAttribute('aria-hidden', 'true'));
renderIntro();
window.setInterval(updateClock, 1000);
