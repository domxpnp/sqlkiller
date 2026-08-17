/**
 * Dependency-free Excel export for the Developer Exam Lab.
 *
 * The module emits a standards-based OOXML workbook inside an uncompressed ZIP
 * container. Strings are stored as inline strings, so answers beginning with
 * "=" remain text instead of being interpreted as formulas.
 *
 * @typedef {Object} ExamExportHelpers
 * @property {(question: Record<string, any>, state: Record<string, any>) => unknown} [getAnswer]
 *   Resolve the answer for a question. By default, a saved answer is used and
 *   the question's starter text is used when no saved answer exists.
 * @property {(question: Record<string, any>, state: Record<string, any>) => unknown} [getLanguage]
 *   Resolve the selected language. Defaults to state.languages[id], then the
 *   question's configured language.
 * @property {(question: Record<string, any>, state: Record<string, any>, answer: string) => boolean} [hasAttempted]
 *   Override draft detection.
 *
 * @typedef {Object} ExamExportMetadata
 * @property {string} [title='Developer Exam Lab — คำตอบแบบฝึกปฏิบัติ'] Workbook title.
 * @property {string} [author='SQL//KILLER'] Workbook author.
 * @property {string} [subject='SQL and programming practical assessment'] Workbook subject.
 * @property {string} [company='SQL//KILLER'] Company shown in extended properties.
 * @property {Date|string|number} [exportedAt=new Date()] Export timestamp.
 *
 * @typedef {Object} ExamWorkbookOptions
 * @property {Array<Record<string, any>>} examQuestions Question definitions.
 * @property {Array<Record<string, any>>} examReferenceRows Reference dataset rows.
 * @property {Record<string, any>} [state={}] Current exam state.
 * @property {string} [filename] Download filename. The .xlsx suffix is added when absent.
 * @property {ExamExportMetadata} [metadata={}]
 * @property {ExamExportHelpers} [helpers={}]
 *
 * @typedef {Object} BuiltExamWorkbook
 * @property {Uint8Array} bytes Complete XLSX file bytes.
 * @property {string} filename Sanitized filename.
 * @property {string[]} sheetNames Workbook sheet names in order.
 */

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const encoder = new TextEncoder();

const CELL_STYLE = Object.freeze({
  normal: 0,
  title: 1,
  section: 2,
  label: 3,
  tableHeader: 4,
  money: 5,
  wrapped: 6,
  code: 7,
  integer: 8
});

const REFERENCE_COLUMNS = Object.freeze([
  { key: 'rowNo', label: 'ลำดับ', width: 10, type: 'number', style: CELL_STYLE.integer },
  { key: 'shop', label: 'ร้าน', width: 20 },
  { key: 'status', label: 'สถานะสินค้า', width: 18 },
  { key: 'orderedAt', label: 'วันที่สั่งซื้อ', width: 22 },
  { key: 'orderNo', label: 'หมายเลขสั่งซื้อ', width: 20 },
  { key: 'item', label: 'รายการ', width: 30 },
  { key: 'option', label: 'ตัวเลือกสินค้า', width: 18 },
  { key: 'quantity', label: 'จำนวน', width: 10, type: 'number', style: CELL_STYLE.integer },
  { key: 'subtotal', label: 'ยอดรวม', width: 14, type: 'number', style: CELL_STYLE.money },
  { key: 'shipping', label: 'ค่าจัดส่ง', width: 14, type: 'number', style: CELL_STYLE.money },
  { key: 'discount', label: 'ส่วนลด', width: 14, type: 'number', style: CELL_STYLE.money },
  { key: 'net', label: 'รวมสุทธิ', width: 14, type: 'number', style: CELL_STYLE.money }
]);

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function assertArray(value, name) {
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array.`);
}

function sanitizeXmlText(value) {
  const text = String(value ?? '');
  let output = '';
  for (const character of text) {
    const codePoint = character.codePointAt(0);
    const valid = codePoint === 0x09
      || codePoint === 0x0a
      || codePoint === 0x0d
      || (codePoint >= 0x20 && codePoint <= 0xd7ff)
      || (codePoint >= 0xe000 && codePoint <= 0xfffd)
      || (codePoint >= 0x10000 && codePoint <= 0x10ffff);
    output += valid ? character : '\ufffd';
  }
  return output;
}

function escapeXml(value) {
  return sanitizeXmlText(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
  })[character]);
}

function finiteNumber(value, fallback = 0) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function hasOwn(object, key) {
  return Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);
}

function normalizeDate(value, fallback = new Date()) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value ?? fallback);
  return Number.isNaN(date.getTime()) ? new Date(fallback) : date;
}

function formatTimestamp(value) {
  if (value === null || value === undefined || value === '') return '—';
  const date = normalizeDate(value, new Date(Number.NaN));
  if (Number.isNaN(date.getTime())) return String(value);
  return `${date.toISOString().slice(0, 19).replace('T', ' ')} UTC`;
}

function sanitizeFilename(value, exportedAt) {
  const fallback = `developer-exam-answers-${exportedAt.toISOString().slice(0, 10)}`;
  const base = String(value || fallback)
    .replace(/\.xlsx$/i, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 180) || fallback;
  return `${base}.xlsx`;
}

function trimSheetName(value) {
  const cleaned = sanitizeXmlText(value)
    .replace(/[\\/?*:[\]]/g, ' ')
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^'+|'+$/g, '')
    .trim() || 'Sheet';
  return Array.from(cleaned).slice(0, 31).join('');
}

function uniqueSheetName(value, usedNames) {
  const base = trimSheetName(value);
  let candidate = base;
  let counter = 2;
  while (usedNames.has(candidate.toLocaleLowerCase('en-US'))) {
    const suffix = ` (${counter})`;
    const room = Math.max(1, 31 - Array.from(suffix).length);
    candidate = `${Array.from(base).slice(0, room).join('')}${suffix}`;
    counter += 1;
  }
  usedNames.add(candidate.toLocaleLowerCase('en-US'));
  return candidate;
}

function makeSheetNames(questions) {
  const used = new Set();
  const names = [
    uniqueSheetName('Summary', used),
    uniqueSheetName('Reference Data', used)
  ];
  questions.forEach((question, index) => {
    const number = String(question.number ?? index + 1).padStart(2, '0');
    const description = question.title || question.id || `Question ${number}`;
    names.push(uniqueSheetName(`Q${number} - ${description}`, used));
  });
  return names;
}

function columnName(number) {
  let value = number;
  let name = '';
  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name || 'A';
}

function xmlCell(cell, rowNumber) {
  const reference = `${columnName(cell.column)}${rowNumber}`;
  const style = Number.isInteger(cell.style) ? ` s="${cell.style}"` : '';
  if (cell.type === 'number' && Number.isFinite(cell.value)) {
    return `<c r="${reference}"${style} t="n"><v>${cell.value}</v></c>`;
  }
  if (cell.type === 'boolean') {
    return `<c r="${reference}"${style} t="b"><v>${cell.value ? 1 : 0}</v></c>`;
  }
  return `<c r="${reference}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell.value)}</t></is></c>`;
}

function worksheetXml({ rows, columns, merges = [], autoFilter = '', freezeRows = 0 }) {
  let maximumColumn = 1;
  rows.forEach(row => row.cells.forEach(cell => { maximumColumn = Math.max(maximumColumn, cell.column); }));
  merges.forEach(reference => {
    const match = reference.match(/:([A-Z]+)\d+$/);
    if (!match) return;
    let column = 0;
    for (const character of match[1]) column = column * 26 + character.charCodeAt(0) - 64;
    maximumColumn = Math.max(maximumColumn, column);
  });
  const lastRow = Math.max(rows.length, 1);
  const dimension = `A1:${columnName(maximumColumn)}${lastRow}`;
  const columnXml = columns.length
    ? `<cols>${columns.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${finiteNumber(width, 12)}" customWidth="1"/>`).join('')}</cols>`
    : '';
  const paneXml = freezeRows > 0
    ? `<pane ySplit="${freezeRows}" topLeftCell="A${freezeRows + 1}" activePane="bottomLeft" state="frozen"/>`
    : '';
  const rowsXml = rows.map((row, index) => {
    const rowNumber = index + 1;
    const height = Number.isFinite(row.height) ? ` ht="${row.height}" customHeight="1"` : '';
    return `<row r="${rowNumber}"${height}>${row.cells.map(cell => xmlCell(cell, rowNumber)).join('')}</row>`;
  }).join('');
  const mergeXml = merges.length
    ? `<mergeCells count="${merges.length}">${merges.map(reference => `<mergeCell ref="${reference}"/>`).join('')}</mergeCells>`
    : '';
  const filterXml = autoFilter ? `<autoFilter ref="${autoFilter}"/>` : '';
  return `${XML_HEADER}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="${dimension}"/><sheetViews><sheetView workbookViewId="0">${paneXml}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${columnXml}<sheetData>${rowsXml}</sheetData>${filterXml}${mergeXml}<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>`;
}

function textCell(column, value, style = CELL_STYLE.normal) {
  return { column, value: String(value ?? ''), style };
}

function numberCell(column, value, style = CELL_STYLE.money) {
  return { column, value: finiteNumber(value), type: 'number', style };
}

function pushRow(rows, cells, height) {
  rows.push({ cells, ...(Number.isFinite(height) ? { height } : {}) });
  return rows.length;
}

function blankRow(rows) {
  return pushRow(rows, []);
}

function totalReferenceRows(referenceRows) {
  const overall = { subtotal: 0, shipping: 0, discount: 0, net: 0 };
  const shops = new Map();
  referenceRows.forEach(row => {
    const shop = String(row.shop ?? '').trim() || '(ไม่ระบุร้าน)';
    if (!shops.has(shop)) shops.set(shop, { shop, subtotal: 0, shipping: 0, discount: 0, net: 0 });
    const shopTotals = shops.get(shop);
    for (const key of ['subtotal', 'shipping', 'discount', 'net']) {
      const value = finiteNumber(row[key]);
      overall[key] += value;
      shopTotals[key] += value;
    }
  });
  return { overall, shops: [...shops.values()] };
}

function completedSet(state) {
  if (state.completed instanceof Set) return new Set([...state.completed].map(String));
  return new Set(Array.isArray(state.completed) ? state.completed.map(String) : []);
}

function resolveQuestion(question, state, helpers, completed) {
  const id = String(question.id ?? question.number ?? '');
  const savedAnswers = state.answers && typeof state.answers === 'object' ? state.answers : {};
  const savedLanguages = state.languages && typeof state.languages === 'object' ? state.languages : {};
  const rawAnswer = typeof helpers.getAnswer === 'function'
    ? helpers.getAnswer(question, state)
    : hasOwn(savedAnswers, id) ? savedAnswers[id] : question.starter ?? '';
  const answer = String(rawAnswer ?? '');
  const rawLanguage = typeof helpers.getLanguage === 'function'
    ? helpers.getLanguage(question, state)
    : hasOwn(savedLanguages, id) ? savedLanguages[id] : question.language ?? 'text';
  const language = String(rawLanguage || 'text');
  const attempted = typeof helpers.hasAttempted === 'function'
    ? Boolean(helpers.hasAttempted(question, state, answer))
    : Boolean(answer.trim()) && answer.trim() !== String(question.starter ?? '').trim();
  const isCompleted = completed.has(id);
  const validation = Array.isArray(state.validations?.[id]) ? state.validations[id].map(Boolean) : [];
  return {
    id,
    answer,
    language,
    attempted,
    completed: isCompleted,
    status: isCompleted ? 'ทำแล้ว' : attempted ? 'มี Draft' : 'ยังไม่ทำ',
    validation
  };
}

function buildSummarySheet({ questions, resolvedQuestions, state, metadata, totals }) {
  const rows = [];
  const merges = [];
  const completedCount = resolvedQuestions.filter(question => question.completed).length;
  const attemptedCount = resolvedQuestions.filter(question => question.attempted).length;
  const sessionStatus = state.submittedAt ? 'ส่งแล้ว' : state.expiredAt ? 'หมดเวลา' : state.startedAt ? 'กำลังทำ' : 'ยังไม่เริ่ม';

  pushRow(rows, [textCell(1, metadata.title, CELL_STYLE.title)], 30);
  merges.push('A1:F1');
  pushRow(rows, [textCell(1, 'ส่งออกเมื่อ', CELL_STYLE.label), textCell(2, formatTimestamp(metadata.exportedAt), CELL_STYLE.wrapped)]);
  pushRow(rows, [textCell(1, 'สถานะรอบ', CELL_STYLE.label), textCell(2, sessionStatus)]);
  pushRow(rows, [textCell(1, 'เริ่มเมื่อ', CELL_STYLE.label), textCell(2, formatTimestamp(state.startedAt))]);
  pushRow(rows, [textCell(1, 'ส่งเมื่อ', CELL_STYLE.label), textCell(2, formatTimestamp(state.submittedAt))]);
  if (state.expiredAt) pushRow(rows, [textCell(1, 'หมดเวลาเมื่อ', CELL_STYLE.label), textCell(2, formatTimestamp(state.expiredAt))]);
  pushRow(rows, [textCell(1, 'ความคืบหน้า', CELL_STYLE.label), textCell(2, `${completedCount}/${questions.length} ข้อ · มีคำตอบ ${attemptedCount}/${questions.length} ข้อ`)]);
  blankRow(rows);

  pushRow(rows, [textCell(1, 'ยอดรวมทั้งหมด', CELL_STYLE.section)]);
  merges.push(`A${rows.length}:F${rows.length}`);
  pushRow(rows, ['รายการ', 'จำนวนเงิน'].map((value, index) => textCell(index + 1, value, CELL_STYLE.tableHeader)));
  pushRow(rows, [textCell(1, 'ยอดรวมสินค้า'), numberCell(2, totals.overall.subtotal)]);
  pushRow(rows, [textCell(1, 'ค่าจัดส่ง'), numberCell(2, totals.overall.shipping)]);
  pushRow(rows, [textCell(1, 'ส่วนลด'), numberCell(2, totals.overall.discount)]);
  pushRow(rows, [textCell(1, 'รายได้สุทธิ'), numberCell(2, totals.overall.net)]);
  blankRow(rows);

  pushRow(rows, [textCell(1, 'ยอดรวมแยกตามร้าน', CELL_STYLE.section)]);
  merges.push(`A${rows.length}:F${rows.length}`);
  pushRow(rows, ['ร้าน', 'ยอดรวมสินค้า', 'ค่าจัดส่ง', 'ส่วนลด', 'รายได้สุทธิ'].map((value, index) => textCell(index + 1, value, CELL_STYLE.tableHeader)));
  totals.shops.forEach(shop => pushRow(rows, [
    textCell(1, shop.shop),
    numberCell(2, shop.subtotal),
    numberCell(3, shop.shipping),
    numberCell(4, shop.discount),
    numberCell(5, shop.net)
  ]));
  blankRow(rows);

  pushRow(rows, [textCell(1, 'สรุปคำตอบ', CELL_STYLE.section)]);
  merges.push(`A${rows.length}:F${rows.length}`);
  const questionHeaderRow = pushRow(rows, ['ข้อ', 'หัวข้อ', 'หมวด', 'ภาษา', 'สถานะ', 'Checklist'].map((value, index) => textCell(index + 1, value, CELL_STYLE.tableHeader)));
  questions.forEach((question, index) => {
    const resolved = resolvedQuestions[index];
    const passed = resolved.validation.filter(Boolean).length;
    const validationText = resolved.validation.length ? `${passed}/${resolved.validation.length}` : 'ยังไม่ตรวจ';
    pushRow(rows, [
      numberCell(1, finiteNumber(question.number, index + 1), CELL_STYLE.integer),
      textCell(2, question.title || question.id || `Question ${index + 1}`, CELL_STYLE.wrapped),
      textCell(3, question.section || ''),
      textCell(4, resolved.language),
      textCell(5, resolved.status),
      textCell(6, validationText)
    ]);
  });

  return worksheetXml({
    rows,
    columns: [10, 40, 18, 18, 16, 16],
    merges,
    autoFilter: `A${questionHeaderRow}:F${rows.length}`,
    freezeRows: 1
  });
}

function buildReferenceSheet(referenceRows, totals) {
  const rows = [];
  const merges = [];
  pushRow(rows, [textCell(1, 'ข้อมูลรายการสินค้าอ้างอิง', CELL_STYLE.title)], 30);
  merges.push('A1:L1');
  pushRow(rows, [textCell(1, 'ข้อมูลต้นฉบับแบบ Read only ที่ใช้ร่วมกันทุกข้อ', CELL_STYLE.wrapped)]);
  merges.push('A2:L2');
  blankRow(rows);
  const headerRow = pushRow(rows, REFERENCE_COLUMNS.map((column, index) => textCell(index + 1, column.label, CELL_STYLE.tableHeader)));
  referenceRows.forEach(row => {
    pushRow(rows, REFERENCE_COLUMNS.map((column, index) => {
      const value = row[column.key];
      return column.type === 'number'
        ? numberCell(index + 1, value, column.style)
        : textCell(index + 1, value, CELL_STYLE.wrapped);
    }));
  });
  const finalDataRow = rows.length;
  const totalRow = pushRow(rows, [
    textCell(1, 'ยอดรวมทั้งหมด', CELL_STYLE.label),
    numberCell(9, totals.overall.subtotal),
    numberCell(10, totals.overall.shipping),
    numberCell(11, totals.overall.discount),
    numberCell(12, totals.overall.net)
  ]);
  merges.push(`A${totalRow}:H${totalRow}`);

  return worksheetXml({
    rows,
    columns: REFERENCE_COLUMNS.map(column => column.width),
    merges,
    autoFilter: referenceRows.length ? `A${headerRow}:L${finalDataRow}` : '',
    freezeRows: headerRow
  });
}

function splitExcelText(value, limit = 30000) {
  let remaining = String(value ?? '');
  if (!remaining) return [''];
  const chunks = [];
  while (remaining.length > limit) {
    let cut = remaining.lastIndexOf('\n', limit);
    if (cut < Math.floor(limit * 0.5)) cut = limit;
    else cut += 1;
    if (cut > 0 && /[\ud800-\udbff]/.test(remaining[cut - 1]) && /[\udc00-\udfff]/.test(remaining[cut])) cut -= 1;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut);
  }
  chunks.push(remaining);
  return chunks;
}

function buildAnswerSheet(question, resolved, index) {
  const rows = [];
  const merges = [];
  const questionNumber = finiteNumber(question.number, index + 1);
  const validationPassed = resolved.validation.filter(Boolean).length;
  const validationText = resolved.validation.length
    ? `${validationPassed}/${resolved.validation.length}`
    : 'ยังไม่ตรวจ';

  pushRow(rows, [textCell(1, `ข้อ ${String(questionNumber).padStart(2, '0')} — ${question.title || question.id || ''}`, CELL_STYLE.title)], 30);
  merges.push('A1:F1');
  pushRow(rows, [textCell(1, 'หมวด', CELL_STYLE.label), textCell(2, question.section || '')]);
  pushRow(rows, [textCell(1, 'ภาษา', CELL_STYLE.label), textCell(2, resolved.language)]);
  pushRow(rows, [textCell(1, 'สถานะ', CELL_STYLE.label), textCell(2, resolved.status)]);
  pushRow(rows, [textCell(1, 'Checklist', CELL_STYLE.label), textCell(2, validationText)]);
  blankRow(rows);

  pushRow(rows, [textCell(1, 'โจทย์', CELL_STYLE.section)]);
  merges.push(`A${rows.length}:F${rows.length}`);
  const promptRow = pushRow(rows, [textCell(1, question.prompt || '', CELL_STYLE.wrapped)], 42);
  merges.push(`A${promptRow}:F${promptRow}`);
  blankRow(rows);

  pushRow(rows, [textCell(1, 'เงื่อนไข', CELL_STYLE.section)]);
  merges.push(`A${rows.length}:F${rows.length}`);
  const requirements = Array.isArray(question.requirements) ? question.requirements : [];
  if (requirements.length) {
    requirements.forEach((requirement, requirementIndex) => {
      const rowNumber = pushRow(rows, [
        textCell(1, String(requirementIndex + 1).padStart(2, '0'), CELL_STYLE.label),
        textCell(2, requirement, CELL_STYLE.wrapped)
      ], 30);
      merges.push(`B${rowNumber}:F${rowNumber}`);
    });
  } else {
    const rowNumber = pushRow(rows, [textCell(2, '—', CELL_STYLE.wrapped)]);
    merges.push(`B${rowNumber}:F${rowNumber}`);
  }
  blankRow(rows);

  pushRow(rows, [textCell(1, 'คำตอบ', CELL_STYLE.section)]);
  merges.push(`A${rows.length}:F${rows.length}`);
  const codeParts = splitExcelText(resolved.answer);
  codeParts.forEach((part, partIndex) => {
    const lineCount = Math.max(1, part.split(/\r\n|\r|\n/).length);
    const label = codeParts.length === 1 ? 'CODE' : `CODE ${partIndex + 1}/${codeParts.length}`;
    const rowNumber = pushRow(rows, [
      textCell(1, label, CELL_STYLE.label),
      textCell(2, part, CELL_STYLE.code)
    ], Math.min(360, Math.max(48, lineCount * 15)));
    merges.push(`B${rowNumber}:F${rowNumber}`);
  });

  return worksheetXml({
    rows,
    columns: [14, 24, 24, 24, 24, 24],
    merges,
    freezeRows: 1
  });
}

function stylesXml() {
  return `${XML_HEADER}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts><fonts count="5"><font><sz val="11"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font><font><b/><sz val="18"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF173F35"/><name val="Calibri"/></font><font><sz val="10"/><color rgb="FF173F35"/><name val="Consolas"/><family val="3"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF173F35"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2F7669"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD5E2DF"/></left><right style="thin"><color rgb="FFD5E2DF"/></right><top style="thin"><color rgb="FFD5E2DF"/></top><bottom style="thin"><color rgb="FFD5E2DF"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="9"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment vertical="top"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

function workbookXml(sheetNames) {
  const sheets = sheetNames.map((name, index) => `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('');
  return `${XML_HEADER}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr/><bookViews><workbookView activeTab="0"/></bookViews><sheets>${sheets}</sheets><calcPr calcId="191029"/></workbook>`;
}

function workbookRelationshipsXml(sheetCount) {
  const worksheets = Array.from({ length: sheetCount }, (_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('');
  return `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${worksheets}<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
}

function contentTypesXml(sheetCount) {
  const sheets = Array.from({ length: sheetCount }, (_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
  return `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
}

function rootRelationshipsXml() {
  return `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
}

function corePropertiesXml(metadata) {
  const timestamp = metadata.exportedAt.toISOString();
  return `${XML_HEADER}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(metadata.title)}</dc:title><dc:subject>${escapeXml(metadata.subject)}</dc:subject><dc:creator>${escapeXml(metadata.author)}</dc:creator><cp:lastModifiedBy>${escapeXml(metadata.author)}</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:modified></cp:coreProperties>`;
}

function appPropertiesXml(metadata, sheetNames) {
  const titles = sheetNames.map(name => `<vt:lpstr>${escapeXml(name)}</vt:lpstr>`).join('');
  return `${XML_HEADER}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>SQL//KILLER Exam Lab</Application><Company>${escapeXml(metadata.company)}</Company><AppVersion>1.0</AppVersion><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>${sheetNames.length}</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size="${sheetNames.length}" baseType="lpstr">${titles}</vt:vector></TitlesOfParts></Properties>`;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC32_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(value) {
  const input = normalizeDate(value);
  const year = Math.min(2107, Math.max(1980, input.getUTCFullYear()));
  const month = year === 1980 && input.getUTCFullYear() < 1980 ? 1 : input.getUTCMonth() + 1;
  const day = year === 1980 && input.getUTCFullYear() < 1980 ? 1 : input.getUTCDate();
  const hours = year === 1980 && input.getUTCFullYear() < 1980 ? 0 : input.getUTCHours();
  const minutes = year === 1980 && input.getUTCFullYear() < 1980 ? 0 : input.getUTCMinutes();
  const seconds = year === 1980 && input.getUTCFullYear() < 1980 ? 0 : input.getUTCSeconds();
  return {
    date: ((year - 1980) << 9) | (month << 5) | day,
    time: (hours << 11) | (minutes << 5) | Math.floor(seconds / 2)
  };
}

function concatenate(chunks) {
  const totalLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;
  chunks.forEach(chunk => {
    output.set(chunk, offset);
    offset += chunk.length;
  });
  return output;
}

function zipStored(files, timestamp) {
  if (files.length > 0xffff) throw new RangeError('ZIP64 is not supported: too many workbook parts.');
  const localChunks = [];
  const centralChunks = [];
  const records = [];
  const dos = dosDateTime(timestamp);
  let localOffset = 0;

  files.forEach(file => {
    const name = encoder.encode(file.name);
    const data = typeof file.data === 'string' ? encoder.encode(file.data) : file.data;
    if (!(data instanceof Uint8Array)) throw new TypeError(`Invalid ZIP data for ${file.name}.`);
    if (name.length > 0xffff || data.length > 0xffffffff) throw new RangeError(`ZIP part is too large: ${file.name}.`);
    const checksum = crc32(data);
    const header = new Uint8Array(30 + name.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x0800, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, dos.time, true);
    view.setUint16(12, dos.date, true);
    view.setUint32(14, checksum, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, name.length, true);
    view.setUint16(28, 0, true);
    header.set(name, 30);
    localChunks.push(header, data);
    records.push({ name, dataLength: data.length, checksum, offset: localOffset });
    localOffset += header.length + data.length;
    if (localOffset > 0xffffffff) throw new RangeError('ZIP64 is not supported: workbook is too large.');
  });

  records.forEach(record => {
    const header = new Uint8Array(46 + record.name.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0x0800, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, dos.time, true);
    view.setUint16(14, dos.date, true);
    view.setUint32(16, record.checksum, true);
    view.setUint32(20, record.dataLength, true);
    view.setUint32(24, record.dataLength, true);
    view.setUint16(28, record.name.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, record.offset, true);
    header.set(record.name, 46);
    centralChunks.push(header);
  });

  const centralDirectory = concatenate(centralChunks);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, records.length, true);
  endView.setUint16(10, records.length, true);
  endView.setUint32(12, centralDirectory.length, true);
  endView.setUint32(16, localOffset, true);
  endView.setUint16(20, 0, true);
  return concatenate([...localChunks, centralDirectory, end]);
}

/**
 * Build a complete XLSX workbook without touching the DOM.
 *
 * This is useful for automated tests, Web Workers, or custom upload flows. The
 * workbook always contains Summary, Reference Data, and one answer worksheet
 * per question. Monetary totals are calculated row-by-row from the reference
 * data and appear both overall and grouped by shop.
 *
 * @param {ExamWorkbookOptions} options
 * @returns {BuiltExamWorkbook}
 */
export function buildExamWorkbook(options) {
  if (!options || typeof options !== 'object') throw new TypeError('Workbook options are required.');
  const {
    examQuestions,
    examReferenceRows,
    state = {},
    filename,
    metadata: suppliedMetadata = {},
    helpers = {}
  } = options;
  assertArray(examQuestions, 'examQuestions');
  assertArray(examReferenceRows, 'examReferenceRows');
  if (!state || typeof state !== 'object') throw new TypeError('state must be an object.');
  if (!helpers || typeof helpers !== 'object') throw new TypeError('helpers must be an object.');

  const exportedAt = normalizeDate(suppliedMetadata.exportedAt);
  const metadata = {
    title: String(suppliedMetadata.title || 'Developer Exam Lab — คำตอบแบบฝึกปฏิบัติ'),
    author: String(suppliedMetadata.author || 'SQL//KILLER'),
    subject: String(suppliedMetadata.subject || 'SQL and programming practical assessment'),
    company: String(suppliedMetadata.company || 'SQL//KILLER'),
    exportedAt
  };
  const outputFilename = sanitizeFilename(filename, exportedAt);
  const sheetNames = makeSheetNames(examQuestions);
  const totals = totalReferenceRows(examReferenceRows);
  const completed = completedSet(state);
  const resolvedQuestions = examQuestions.map(question => resolveQuestion(question, state, helpers, completed));
  const worksheets = [
    buildSummarySheet({ questions: examQuestions, resolvedQuestions, state, metadata, totals }),
    buildReferenceSheet(examReferenceRows, totals),
    ...examQuestions.map((question, index) => buildAnswerSheet(question, resolvedQuestions[index], index))
  ];
  const sheetCount = worksheets.length;
  const files = [
    { name: '[Content_Types].xml', data: contentTypesXml(sheetCount) },
    { name: '_rels/.rels', data: rootRelationshipsXml() },
    { name: 'docProps/core.xml', data: corePropertiesXml(metadata) },
    { name: 'docProps/app.xml', data: appPropertiesXml(metadata, sheetNames) },
    { name: 'xl/workbook.xml', data: workbookXml(sheetNames) },
    { name: 'xl/_rels/workbook.xml.rels', data: workbookRelationshipsXml(sheetCount) },
    { name: 'xl/styles.xml', data: stylesXml() },
    ...worksheets.map((data, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, data }))
  ];

  return {
    bytes: zipStored(files, exportedAt),
    filename: outputFilename,
    sheetNames: [...sheetNames]
  };
}

/**
 * Build and download the exam workbook in a browser.
 *
 * @param {ExamWorkbookOptions} options
 * @returns {{filename: string, byteLength: number, sheetNames: string[]}}
 *   Information about the initiated download.
 */
export function downloadExamWorkbook(options) {
  if (typeof document === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') {
    throw new Error('downloadExamWorkbook requires a browser DOM. Use buildExamWorkbook outside the browser.');
  }
  const workbook = buildExamWorkbook(options);
  const blob = new Blob([workbook.bytes], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = workbook.filename;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return {
    filename: workbook.filename,
    byteLength: workbook.bytes.length,
    sheetNames: workbook.sheetNames
  };
}
