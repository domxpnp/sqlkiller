import './sql-autocomplete.css';

const SQL_KEYWORDS = [
  'SELECT', 'DISTINCT', 'FROM', 'WHERE', 'AS', 'JOIN', 'LEFT JOIN',
  'INNER JOIN', 'RIGHT JOIN', 'ON', 'AND', 'OR', 'NOT', 'IS NULL',
  'IS NOT NULL', 'LIKE', 'IN', 'BETWEEN', 'ORDER BY', 'GROUP BY',
  'HAVING', 'LIMIT', 'ASC', 'DESC', 'COUNT', 'SUM', 'AVG', 'MIN',
  'MAX', 'NULL', 'TRUE', 'FALSE'
];

const RESERVED = new Set([
  ...SQL_KEYWORDS.flatMap(keyword => keyword.split(/\s+/)),
  'FULL', 'OUTER', 'CROSS', 'NATURAL', 'UNION', 'OFFSET', 'FETCH'
]);

let autocompleteId = 0;

function readTables(getTables) {
  try {
    const tables = typeof getTables === 'function' ? getTables() : getTables;
    return tables && typeof tables === 'object' ? tables : {};
  } catch {
    return {};
  }
}

function fieldsFor(rows) {
  const fields = new Set();
  if (Array.isArray(rows)) {
    rows.forEach(row => {
      if (row && typeof row === 'object') {
        Object.keys(row).forEach(field => fields.add(field));
      }
    });
  }
  return [...fields];
}

function tableNameFrom(tables, requestedName) {
  const wanted = String(requestedName || '').toLowerCase();
  return Object.keys(tables).find(name => name.toLowerCase() === wanted);
}

function queryAliases(sql, tables) {
  const aliases = new Map();
  const referencedTables = [];
  const sourcePattern = /\b(?:FROM|JOIN)\s+([A-Za-z_$][\w$]*)(?:\s+(?:AS\s+)?([A-Za-z_$][\w$]*))?/gi;
  let match;

  while ((match = sourcePattern.exec(sql))) {
    const table = tableNameFrom(tables, match[1]);
    if (!table) continue;

    if (!referencedTables.includes(table)) referencedTables.push(table);
    aliases.set(table.toLowerCase(), table);

    const alias = match[2];
    if (alias && !RESERVED.has(alias.toUpperCase())) {
      aliases.set(alias.toLowerCase(), table);
    }
  }

  return { aliases, referencedTables };
}

function tokenAtCursor(value, cursor) {
  const before = value.slice(0, cursor);
  const match = before.match(/(?:([A-Za-z_$][\w$]*)\.)?([A-Za-z_$][\w$]*)?$/);
  const qualifier = match?.[1] || '';
  const partial = match?.[2] || '';
  return {
    qualifier,
    partial,
    replaceStart: cursor - partial.length,
    hasToken: Boolean(qualifier || partial)
  };
}

function scoreSuggestion(item, partial, context) {
  const label = item.label.toLowerCase();
  const needle = partial.toLowerCase();
  let score = 0;

  if (!needle) score += 20;
  else if (label === needle) score += 130;
  else if (label.startsWith(needle)) score += 100;
  else if (label.includes(needle)) score += 45;
  else return -1;

  if (context === 'source' && item.kind === 'TABLE') score += 35;
  if (context === 'field' && item.kind === 'FIELD') score += 25;
  if (item.kind === 'SQL') score += 5;
  return score;
}

function sqlContext(value, cursor) {
  const before = value.slice(0, cursor);
  if (/\b(?:FROM|JOIN)\s+[A-Za-z_$\w]*$/i.test(before)) return 'source';
  if (/\b(?:SELECT|WHERE|ON|AND|OR|ORDER\s+BY|GROUP\s+BY)\b[^;]*$/i.test(before)) return 'field';
  return 'general';
}

/**
 * Adds SQL-aware autocomplete to a textarea.
 *
 * @param {HTMLTextAreaElement} textarea SQL editor element.
 * @param {Function|Object} getTables Function returning { tableName: rows }.
 * @returns {Function} Call to remove the autocomplete and all event listeners.
 */
export function setupSqlAutocomplete(textarea, getTables) {
  if (!(textarea instanceof HTMLTextAreaElement)) {
    throw new TypeError('setupSqlAutocomplete expects a textarea element');
  }

  const id = `sql-autocomplete-${++autocompleteId}`;
  const popup = document.createElement('div');
  popup.id = id;
  popup.className = 'sql-autocomplete';
  popup.setAttribute('role', 'listbox');
  popup.setAttribute('aria-label', 'SQL autocomplete suggestions');
  popup.hidden = true;
  document.body.append(popup);

  const oldAttributes = {
    autocomplete: textarea.getAttribute('autocomplete'),
    ariaAutocomplete: textarea.getAttribute('aria-autocomplete'),
    ariaControls: textarea.getAttribute('aria-controls'),
    ariaExpanded: textarea.getAttribute('aria-expanded'),
    ariaHaspopup: textarea.getAttribute('aria-haspopup')
  };

  textarea.setAttribute('autocomplete', 'off');
  textarea.setAttribute('aria-autocomplete', 'list');
  textarea.setAttribute('aria-controls', id);
  textarea.setAttribute('aria-expanded', 'false');
  textarea.setAttribute('aria-haspopup', 'listbox');

  let suggestions = [];
  let selectedIndex = 0;
  let replacement = { start: 0, end: 0 };
  let composing = false;

  function isOpen() {
    return !popup.hidden && suggestions.length > 0;
  }

  function close() {
    popup.hidden = true;
    popup.replaceChildren();
    suggestions = [];
    selectedIndex = 0;
    textarea.setAttribute('aria-expanded', 'false');
    textarea.removeAttribute('aria-activedescendant');
  }

  function positionPopup() {
    if (!isOpen()) return;

    const rect = textarea.getBoundingClientRect();
    const style = getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.5 || 24;
    const paddingTop = Number.parseFloat(style.paddingTop) || 0;
    const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
    const before = textarea.value.slice(0, textarea.selectionStart);
    const lines = before.split('\n');
    const line = lines.length - 1;
    const column = lines.at(-1).length;
    const characterWidth = (Number.parseFloat(style.fontSize) || 14) * 0.62;
    const popupWidth = Math.max(200, Math.min(360, rect.width, window.innerWidth - 16));
    const desiredLeft = rect.left + paddingLeft + column * characterWidth - textarea.scrollLeft;
    const desiredTop = rect.top + paddingTop + (line + 1) * lineHeight - textarea.scrollTop + 5;
    const maxLeft = Math.max(8, window.innerWidth - popupWidth - 8);
    const maxTop = Math.max(8, window.innerHeight - Math.min(270, popup.scrollHeight || 270) - 8);

    popup.style.width = `${popupWidth}px`;
    popup.style.left = `${Math.max(8, Math.min(desiredLeft, maxLeft))}px`;
    popup.style.top = `${Math.max(8, Math.min(desiredTop, maxTop))}px`;
  }

  function setSelected(index) {
    if (!suggestions.length) return;
    selectedIndex = (index + suggestions.length) % suggestions.length;

    [...popup.children].forEach((element, itemIndex) => {
      const selected = itemIndex === selectedIndex;
      element.classList.toggle('is-selected', selected);
      element.setAttribute('aria-selected', String(selected));
      if (selected) {
        textarea.setAttribute('aria-activedescendant', element.id);
        element.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  function accept(index = selectedIndex) {
    const item = suggestions[index];
    if (!item) return;

    const insertText = item.insertText || item.label;
    textarea.setRangeText(insertText, replacement.start, replacement.end, 'end');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    close();
    textarea.focus();
  }

  function render(items) {
    popup.replaceChildren();
    suggestions = items.slice(0, 40);
    selectedIndex = 0;

    suggestions.forEach((item, index) => {
      const option = document.createElement('div');
      option.id = `${id}-option-${index}`;
      option.className = 'sql-autocomplete__option';
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(index === 0));

      const tag = document.createElement('span');
      tag.className = `sql-autocomplete__tag sql-autocomplete__tag--${item.kind.toLowerCase()}`;
      tag.textContent = item.kind;

      const label = document.createElement('span');
      label.className = 'sql-autocomplete__label';
      label.textContent = item.label;

      const detail = document.createElement('span');
      detail.className = 'sql-autocomplete__detail';
      detail.textContent = item.detail || '';

      option.append(tag, label, detail);
      option.addEventListener('pointerdown', event => {
        event.preventDefault();
        accept(index);
      });
      popup.append(option);
    });

    popup.hidden = !suggestions.length;
    textarea.setAttribute('aria-expanded', String(Boolean(suggestions.length)));
    if (suggestions.length) {
      textarea.setAttribute('aria-activedescendant', `${id}-option-0`);
      positionPopup();
    } else {
      textarea.removeAttribute('aria-activedescendant');
    }
  }

  function buildSuggestions(force = false) {
    const tables = readTables(getTables);
    const cursor = textarea.selectionStart;
    const token = tokenAtCursor(textarea.value, cursor);
    if (!force && !token.hasToken) {
      close();
      return [];
    }

    const { aliases, referencedTables } = queryAliases(textarea.value, tables);
    const context = sqlContext(textarea.value, cursor);
    const candidates = [];

    if (token.qualifier) {
      const table = aliases.get(token.qualifier.toLowerCase()) || tableNameFrom(tables, token.qualifier);
      if (table) {
        fieldsFor(tables[table]).forEach(field => candidates.push({
          label: field,
          kind: 'FIELD',
          detail: table
        }));
      }
    } else {
      SQL_KEYWORDS.forEach(keyword => candidates.push({
        label: keyword,
        kind: 'SQL',
        detail: 'keyword'
      }));

      Object.keys(tables).forEach(table => candidates.push({
        label: table,
        kind: 'TABLE',
        detail: `${Array.isArray(tables[table]) ? tables[table].length : 0} rows`
      }));

      aliases.forEach((table, alias) => {
        if (alias !== table.toLowerCase()) candidates.push({
          label: `${alias}.`,
          kind: 'TABLE',
          detail: `alias · ${table}`
        });
      });

      const fieldTables = referencedTables.length ? referencedTables : Object.keys(tables);
      const seenFields = new Set();
      fieldTables.forEach(table => {
        fieldsFor(tables[table]).forEach(field => {
          const key = `${field.toLowerCase()}\u0000${table.toLowerCase()}`;
          if (seenFields.has(key)) return;
          seenFields.add(key);
          candidates.push({ label: field, kind: 'FIELD', detail: table });
        });
      });
    }

    const filtered = candidates
      .map((item, order) => ({ item, order, score: scoreSuggestion(item, token.partial, context) }))
      .filter(entry => entry.score >= 0)
      .sort((a, b) => b.score - a.score || a.order - b.order)
      .map(entry => entry.item);

    replacement = { start: token.replaceStart, end: cursor };
    render(filtered);
    return filtered;
  }

  function insertIndentation() {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.setRangeText('  ', start, end, 'end');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    close();
  }

  function onKeydown(event) {
    if (event.ctrlKey && event.key === 'Enter') return;

    if ((event.ctrlKey || event.metaKey) && event.code === 'Space') {
      event.preventDefault();
      buildSuggestions(true);
      return;
    }

    if (event.key === 'Escape' && isOpen()) {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === 'ArrowDown' && isOpen()) {
      event.preventDefault();
      setSelected(selectedIndex + 1);
      return;
    }

    if (event.key === 'ArrowUp' && isOpen()) {
      event.preventDefault();
      setSelected(selectedIndex - 1);
      return;
    }

    if (event.key === 'Enter' && isOpen()) {
      event.preventDefault();
      accept();
      return;
    }

    if (event.key === 'Tab') {
      if (!isOpen()) buildSuggestions(false);
      if (isOpen()) {
        event.preventDefault();
        accept();
      } else {
        event.preventDefault();
        insertIndentation();
      }
    }
  }

  function onInput() {
    if (!composing) buildSuggestions(false);
  }

  function onSelectionChange() {
    if (document.activeElement === textarea && isOpen()) buildSuggestions(false);
  }

  function onDocumentPointerDown(event) {
    if (event.target !== textarea && !popup.contains(event.target)) close();
  }

  function onBlur() {
    window.setTimeout(() => {
      if (!popup.contains(document.activeElement)) close();
    }, 0);
  }

  function onCompositionStart() {
    composing = true;
    close();
  }

  function onCompositionEnd() {
    composing = false;
    buildSuggestions(false);
  }

  textarea.addEventListener('keydown', onKeydown);
  textarea.addEventListener('input', onInput);
  textarea.addEventListener('click', onSelectionChange);
  textarea.addEventListener('select', onSelectionChange);
  textarea.addEventListener('scroll', positionPopup);
  textarea.addEventListener('blur', onBlur);
  textarea.addEventListener('compositionstart', onCompositionStart);
  textarea.addEventListener('compositionend', onCompositionEnd);
  document.addEventListener('pointerdown', onDocumentPointerDown);
  window.addEventListener('resize', positionPopup);
  window.addEventListener('scroll', positionPopup, true);

  return function cleanupSqlAutocomplete() {
    close();
    popup.remove();
    textarea.removeEventListener('keydown', onKeydown);
    textarea.removeEventListener('input', onInput);
    textarea.removeEventListener('click', onSelectionChange);
    textarea.removeEventListener('select', onSelectionChange);
    textarea.removeEventListener('scroll', positionPopup);
    textarea.removeEventListener('blur', onBlur);
    textarea.removeEventListener('compositionstart', onCompositionStart);
    textarea.removeEventListener('compositionend', onCompositionEnd);
    document.removeEventListener('pointerdown', onDocumentPointerDown);
    window.removeEventListener('resize', positionPopup);
    window.removeEventListener('scroll', positionPopup, true);

    const restore = (name, value) => {
      if (value === null) textarea.removeAttribute(name);
      else textarea.setAttribute(name, value);
    };
    restore('autocomplete', oldAttributes.autocomplete);
    restore('aria-autocomplete', oldAttributes.ariaAutocomplete);
    restore('aria-controls', oldAttributes.ariaControls);
    restore('aria-expanded', oldAttributes.ariaExpanded);
    restore('aria-haspopup', oldAttributes.ariaHaspopup);
  };
}

export default setupSqlAutocomplete;
