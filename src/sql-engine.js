/**
 * A deliberately small, dependency-free SELECT engine for SQL//KILLER.
 *
 * It is not intended to implement the whole SQL standard. It does preserve a
 * column's relation identity throughout a query, though, so JOINs cannot
 * accidentally overwrite columns that happen to have the same name.
 */

const CLAUSE_KEYWORDS = new Set([
  'FROM', 'JOIN', 'INNER', 'LEFT', 'OUTER', 'ON', 'WHERE', 'ORDER', 'BY',
  'LIMIT', 'ASC', 'DESC', 'AND', 'OR',
]);

function fail(thai, english, hint = '') {
  const suffix = hint ? ` — ${hint}` : '';
  throw new Error(`${thai} / ${english}${suffix}`);
}

function keyOf(value) {
  return String(value).toLocaleLowerCase('en-US');
}

function displayToken(token) {
  if (!token) return 'end of query';
  if (token.type === 'string') return `'${token.value}'`;
  return token.raw || token.value;
}

function tokenize(sql) {
  const tokens = [];
  let index = 0;

  while (index < sql.length) {
    const char = sql[index];

    if (/\s/u.test(char)) {
      index += 1;
      continue;
    }

    if (char === '-' && sql[index + 1] === '-') {
      index += 2;
      while (index < sql.length && sql[index] !== '\n') index += 1;
      continue;
    }

    if (char === '/' && sql[index + 1] === '*') {
      const start = index;
      index += 2;
      while (index < sql.length && !(sql[index] === '*' && sql[index + 1] === '/')) index += 1;
      if (index >= sql.length) {
        fail('คอมเมนต์ /* ยังไม่ได้ปิด', 'Unclosed /* comment', `position ${start + 1}`);
      }
      index += 2;
      continue;
    }

    if (char === "'" || char === '"') {
      const quote = char;
      const start = index;
      let value = '';
      index += 1;
      let closed = false;
      while (index < sql.length) {
        if (sql[index] === quote) {
          if (sql[index + 1] === quote) {
            value += quote;
            index += 2;
            continue;
          }
          index += 1;
          closed = true;
          break;
        }
        if (sql[index] === '\\' && sql[index + 1] === quote) {
          value += quote;
          index += 2;
          continue;
        }
        value += sql[index];
        index += 1;
      }
      if (!closed) {
        fail('ข้อความยังปิดเครื่องหมายคำพูดไม่ครบ', 'Unclosed string literal', `position ${start + 1}`);
      }
      tokens.push({ type: 'string', value, raw: sql.slice(start, index), pos: start });
      continue;
    }

    if (char === '`' || char === '[') {
      const endChar = char === '[' ? ']' : '`';
      const start = index;
      index += 1;
      let value = '';
      while (index < sql.length && sql[index] !== endChar) {
        value += sql[index];
        index += 1;
      }
      if (sql[index] !== endChar) {
        fail('ชื่อคอลัมน์หรือตารางยังปิดไม่ครบ', 'Unclosed quoted identifier', `position ${start + 1}`);
      }
      index += 1;
      tokens.push({ type: 'word', value, upper: value.toUpperCase(), raw: sql.slice(start, index), pos: start });
      continue;
    }

    const numberMatch = sql.slice(index).match(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)/);
    if (numberMatch) {
      const raw = numberMatch[0];
      tokens.push({ type: 'number', value: Number(raw), raw, pos: index });
      index += raw.length;
      continue;
    }

    const wordMatch = sql.slice(index).match(/^[\p{L}_$][\p{L}\p{N}_$]*/u);
    if (wordMatch) {
      const value = wordMatch[0];
      tokens.push({ type: 'word', value, upper: value.toUpperCase(), raw: value, pos: index });
      index += value.length;
      continue;
    }

    const twoChars = sql.slice(index, index + 2);
    if (['!=', '<>', '<=', '>='].includes(twoChars)) {
      tokens.push({ type: 'operator', value: twoChars, raw: twoChars, pos: index });
      index += 2;
      continue;
    }
    if (['=', '<', '>'].includes(char)) {
      tokens.push({ type: 'operator', value: char, raw: char, pos: index });
      index += 1;
      continue;
    }
    if (char === '.') {
      tokens.push({ type: 'dot', value: char, raw: char, pos: index });
      index += 1;
      continue;
    }
    if (char === ',') {
      tokens.push({ type: 'comma', value: char, raw: char, pos: index });
      index += 1;
      continue;
    }
    if (char === '*') {
      tokens.push({ type: 'star', value: char, raw: char, pos: index });
      index += 1;
      continue;
    }
    if (char === ';') {
      tokens.push({ type: 'semicolon', value: char, raw: char, pos: index });
      index += 1;
      continue;
    }

    fail('พบอักขระที่ SQL engine ไม่รู้จัก', 'Unsupported character', `'${char}' at position ${index + 1}`);
  }

  return tokens;
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.index = 0;
  }

  peek(offset = 0) {
    return this.tokens[this.index + offset];
  }

  take() {
    const token = this.peek();
    if (token) this.index += 1;
    return token;
  }

  isWord(word, offset = 0) {
    const token = this.peek(offset);
    return Boolean(token && token.type === 'word' && token.upper === word);
  }

  acceptWord(word) {
    if (!this.isWord(word)) return false;
    this.take();
    return true;
  }

  expectWord(word, example = '') {
    if (!this.acceptWord(word)) {
      const token = this.peek();
      fail(
        `คาดว่าจะพบ ${word} แต่พบ ${displayToken(token)}`,
        `Expected ${word}, found ${displayToken(token)}`,
        example,
      );
    }
  }

  identifier(label) {
    const token = this.peek();
    if (!token || token.type !== 'word') {
      fail(
        `กรุณาระบุ${label}ให้ถูกต้อง`,
        `Expected a valid ${label}`,
        `found ${displayToken(token)}`,
      );
    }
    this.take();
    return token.value;
  }

  columnRef(label = 'ชื่อคอลัมน์') {
    const first = this.identifier(label);
    if (this.peek()?.type !== 'dot') return { qualifier: null, column: first };
    this.take();
    return { qualifier: first, column: this.identifier('ชื่อคอลัมน์หลังจุด') };
  }

  selectItem() {
    if (this.peek()?.type === 'star') {
      this.take();
      return { kind: 'star', qualifier: null, alias: null };
    }

    const first = this.identifier('คอลัมน์ใน SELECT');
    let item;
    if (this.peek()?.type === 'dot') {
      this.take();
      if (this.peek()?.type === 'star') {
        this.take();
        item = { kind: 'star', qualifier: first, alias: null };
      } else {
        item = {
          kind: 'column',
          ref: { qualifier: first, column: this.identifier('ชื่อคอลัมน์หลังจุด') },
          alias: null,
        };
      }
    } else {
      item = { kind: 'column', ref: { qualifier: null, column: first }, alias: null };
    }

    if (this.acceptWord('AS')) {
      if (item.kind === 'star') {
        fail('ไม่สามารถตั้งชื่อ alias ให้ * ได้', 'Cannot alias a * projection', 'ใช้ table.* โดยไม่ใส่ AS');
      }
      item.alias = this.identifier('ชื่อ alias หลัง AS');
    } else {
      const possibleAlias = this.peek();
      if (
        item.kind === 'column'
        && possibleAlias?.type === 'word'
        && !CLAUSE_KEYWORDS.has(possibleAlias.upper)
      ) {
        item.alias = this.take().value;
      }
    }
    return item;
  }

  selectList() {
    const items = [];
    while (this.peek() && !this.isWord('FROM')) {
      items.push(this.selectItem());
      if (this.peek()?.type === 'comma') {
        this.take();
        if (this.isWord('FROM')) {
          fail('มีเครื่องหมาย comma เกินท้าย SELECT', 'Trailing comma in SELECT list', 'ลบ comma ก่อน FROM');
        }
        continue;
      }
      if (!this.isWord('FROM')) {
        fail(
          'ต้องคั่นคอลัมน์ด้วย comma',
          'SELECT columns must be separated by commas',
          `near ${displayToken(this.peek())}`,
        );
      }
    }
    if (!items.length) fail('SELECT ต้องมีคอลัมน์', 'SELECT needs at least one column', 'เช่น SELECT * FROM staff');
    return items;
  }

  tableRef() {
    const table = this.identifier('ชื่อตาราง');
    let alias = null;
    let explicitAlias = false;
    if (this.acceptWord('AS')) {
      alias = this.identifier('ชื่อ alias หลัง AS');
      explicitAlias = true;
    } else {
      const possibleAlias = this.peek();
      if (possibleAlias?.type === 'word' && !CLAUSE_KEYWORDS.has(possibleAlias.upper)) {
        alias = this.take().value;
        explicitAlias = true;
      }
    }
    return { table, alias: alias || table, explicitAlias };
  }

  join() {
    let type = 'inner';
    if (this.acceptWord('LEFT')) {
      type = 'left';
      this.acceptWord('OUTER');
      this.expectWord('JOIN', 'รูปแบบ: LEFT JOIN table ON a.id = b.id');
    } else if (this.acceptWord('INNER')) {
      this.expectWord('JOIN', 'รูปแบบ: INNER JOIN table ON a.id = b.id');
    } else {
      this.expectWord('JOIN', 'รูปแบบ: JOIN table ON a.id = b.id');
    }

    const tableRef = this.tableRef();
    this.expectWord('ON', 'ทุก JOIN ต้องมี ON เช่น ON staff.id = logs.staff_id');
    const left = this.columnRef('คอลัมน์ด้านซ้ายของ ON');
    const operator = this.take();
    if (!operator || operator.type !== 'operator' || operator.value !== '=') {
      fail('ON รองรับการจับคู่ด้วย = เท่านั้น', 'JOIN ON currently supports = only', 'เช่น ON a.id = b.staff_id');
    }
    const right = this.columnRef('คอลัมน์ด้านขวาของ ON');
    if (!left.qualifier || !right.qualifier) {
      fail('คอลัมน์ใน ON ต้องระบุตารางหรือ alias', 'JOIN columns must be qualified', 'เช่น ON s.id = l.staff_id');
    }
    return { type, tableRef, left, right };
  }

  conditionValue() {
    const token = this.peek();
    if (!token) fail('WHERE ยังขาดค่าที่ใช้เปรียบเทียบ', 'WHERE is missing a comparison value');
    if (token.type === 'string' || token.type === 'number') {
      this.take();
      return { kind: 'literal', value: token.value };
    }
    if (token.type === 'word' && ['NULL', 'TRUE', 'FALSE'].includes(token.upper)) {
      this.take();
      const value = token.upper === 'NULL' ? null : token.upper === 'TRUE';
      return { kind: 'literal', value };
    }
    if (token.type === 'word') {
      const ref = this.columnRef('ค่าหรือคอลัมน์ด้านขวา');
      return { kind: 'column', ref };
    }
    fail('ค่าหลัง operator ไม่ถูกต้อง', 'Invalid value after comparison operator', `found ${displayToken(token)}`);
  }

  condition() {
    const left = this.columnRef('คอลัมน์ใน WHERE');
    let operator;
    if (this.acceptWord('LIKE')) operator = 'LIKE';
    else {
      const token = this.take();
      if (!token || token.type !== 'operator') {
        fail('WHERE ต้องมี operator เปรียบเทียบ', 'WHERE needs a comparison operator', 'รองรับ =, !=, <>, <, <=, >, >=, LIKE');
      }
      operator = token.value;
    }
    return { left, operator, right: this.conditionValue() };
  }

  orderList() {
    const orders = [];
    do {
      if (this.peek()?.type === 'comma') this.take();
      const ref = this.columnRef('คอลัมน์หลัง ORDER BY');
      let direction = 'asc';
      if (this.acceptWord('ASC')) direction = 'asc';
      else if (this.acceptWord('DESC')) direction = 'desc';
      orders.push({ ref, direction });
    } while (this.peek()?.type === 'comma');
    return orders;
  }

  parse() {
    if (!this.tokens.length) fail('ยังไม่ได้ใส่คำสั่ง SQL', 'The SQL query is empty', 'ลอง SELECT * FROM table');
    this.expectWord('SELECT', 'โหมดนี้รองรับคำสั่ง SELECT เท่านั้น');
    const select = this.selectList();
    this.expectWord('FROM', 'ตัวอย่าง: SELECT * FROM staff');
    const from = this.tableRef();
    const joins = [];

    while (this.isWord('JOIN') || this.isWord('INNER') || this.isWord('LEFT')) joins.push(this.join());

    const where = [];
    if (this.acceptWord('WHERE')) {
      where.push(this.condition());
      while (this.acceptWord('AND')) where.push(this.condition());
      if (this.isWord('OR')) {
        fail('เวอร์ชันนี้รองรับ WHERE แบบ AND เท่านั้น', 'Only AND conditions are supported', 'แยก OR เป็นอีก query หนึ่ง');
      }
    }

    let orderBy = [];
    if (this.acceptWord('ORDER')) {
      this.expectWord('BY', 'รูปแบบ: ORDER BY time DESC');
      orderBy = this.orderList();
    }

    let limit = null;
    if (this.acceptWord('LIMIT')) {
      const token = this.take();
      if (!token || token.type !== 'number' || !Number.isInteger(token.value) || token.value < 0) {
        fail('LIMIT ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป', 'LIMIT must be a non-negative integer', 'เช่น LIMIT 10');
      }
      limit = token.value;
    }

    if (this.peek()?.type === 'semicolon') this.take();
    if (this.peek()) {
      fail(
        `ไม่เข้าใจ SQL ส่วน ${displayToken(this.peek())}`,
        `Unexpected SQL near ${displayToken(this.peek())}`,
        'ตรวจลำดับ WHERE → ORDER BY → LIMIT',
      );
    }
    return { select, from, joins, where, orderBy, limit };
  }
}

function prepareTables(tables) {
  if (!tables || typeof tables !== 'object' || Array.isArray(tables)) {
    fail('ข้อมูล tables ต้องเป็น object', 'tables must be an object mapping table names to row arrays');
  }

  const prepared = new Map();
  for (const [name, rows] of Object.entries(tables)) {
    if (!Array.isArray(rows)) {
      fail(`ข้อมูลตาราง ${name} ต้องเป็น array`, `Table ${name} must contain an array of rows`);
    }
    const lowerName = keyOf(name);
    if (prepared.has(lowerName)) {
      fail(`ชื่อตาราง ${name} ซ้ำเมื่อไม่สนตัวพิมพ์`, `Duplicate case-insensitive table name: ${name}`);
    }

    const columns = [];
    const columnMap = new Map();
    rows.forEach((row, rowIndex) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        fail(`แถว ${rowIndex + 1} ใน ${name} ไม่ใช่ object`, `Row ${rowIndex + 1} in ${name} is not an object`);
      }
      Object.keys(row).forEach((column) => {
        const lowerColumn = keyOf(column);
        if (!columnMap.has(lowerColumn)) {
          columnMap.set(lowerColumn, column);
          columns.push(column);
        }
      });
    });

    prepared.set(lowerName, { name, rows, columns, columnMap });
  }
  return prepared;
}

/**
 * Return all observed columns for a table, preserving their first-seen order.
 * Table and column matching in the engine itself is case-insensitive.
 */
export function getTableColumns(tables, tableName) {
  const prepared = prepareTables(tables);
  const table = prepared.get(keyOf(tableName));
  if (!table) {
    const available = [...prepared.values()].map((item) => item.name).join(', ') || '(none)';
    fail(`ไม่พบตาราง ${tableName}`, `Table ${tableName} does not exist`, `available: ${available}`);
  }
  return [...table.columns];
}

function makeRelation(tableRef, prepared, id) {
  const table = prepared.get(keyOf(tableRef.table));
  if (!table) {
    const available = [...prepared.values()].map((item) => item.name).join(', ') || '(none)';
    fail(`ไม่พบตาราง ${tableRef.table}`, `Unknown table ${tableRef.table}`, `available tables: ${available}`);
  }
  return {
    id,
    table,
    tableName: table.name,
    alias: tableRef.alias,
    aliasKey: keyOf(tableRef.alias),
    explicitAlias: tableRef.explicitAlias,
  };
}

function ensureUniqueAlias(relations, relation) {
  const duplicate = relations.find((item) => item.aliasKey === relation.aliasKey);
  if (duplicate) {
    fail(
      `alias ${relation.alias} ถูกใช้มากกว่าหนึ่งครั้ง`,
      `Duplicate table alias ${relation.alias}`,
      'ตั้ง alias คนละชื่อ เช่น employees e JOIN employees manager',
    );
  }
}

function relationForQualifier(qualifier, relations) {
  const wanted = keyOf(qualifier);
  const aliasMatch = relations.find((relation) => relation.aliasKey === wanted);
  if (aliasMatch) return aliasMatch;

  const tableMatches = relations.filter((relation) => keyOf(relation.tableName) === wanted);
  if (tableMatches.length === 1) return tableMatches[0];
  if (tableMatches.length > 1) {
    fail(
      `ตาราง ${qualifier} ถูก JOIN มากกว่าหนึ่งครั้ง`,
      `Table qualifier ${qualifier} is ambiguous`,
      `ใช้ alias: ${tableMatches.map((item) => item.alias).join(', ')}`,
    );
  }
  fail(
    `ไม่พบตารางหรือ alias ${qualifier}`,
    `Unknown table or alias ${qualifier}`,
    `available: ${relations.map((item) => item.alias).join(', ')}`,
  );
}

function resolveColumn(ref, relations, context = 'query') {
  if (ref.qualifier) {
    const relation = relationForQualifier(ref.qualifier, relations);
    const actualColumn = relation.table.columnMap.get(keyOf(ref.column));
    if (!actualColumn) {
      fail(
        `ไม่พบคอลัมน์ ${ref.qualifier}.${ref.column}`,
        `Unknown column ${ref.qualifier}.${ref.column}`,
        `${relation.alias} has: ${relation.table.columns.join(', ') || '(no known columns)'}`,
      );
    }
    return { relation, column: actualColumn };
  }

  const matches = relations.flatMap((relation) => {
    const column = relation.table.columnMap.get(keyOf(ref.column));
    return column ? [{ relation, column }] : [];
  });
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    fail(
      `คอลัมน์ ${ref.column} กำกวมเพราะมีอยู่หลายตาราง`,
      `Ambiguous column ${ref.column}`,
      `ระบุให้ชัด เช่น ${matches.map((item) => `${item.relation.alias}.${item.column}`).join(' หรือ / or ')}`,
    );
  }
  const allColumns = [...new Set(relations.flatMap((relation) => relation.table.columns))];
  const textLiteralHint = context === 'WHERE right side'
    ? `ถ้าหมายถึงข้อความให้ใส่ quote เช่น '${ref.column}'`
    : `available columns: ${allColumns.join(', ') || '(none)'}`;
  fail(`ไม่พบคอลัมน์ ${ref.column}`, `Unknown column ${ref.column}`, textLiteralHint);
}

function valueFrom(scope, resolved) {
  const row = scope.get(resolved.relation.id);
  if (row == null) return null;
  const value = row[resolved.column];
  return value === undefined ? null : value;
}

function valuesEqual(left, right) {
  if (left == null || right == null) return false;
  if (typeof left === 'number' && typeof right === 'number') return left === right;
  if (typeof left === 'boolean' || typeof right === 'boolean') return left === right;
  return String(left).toLocaleLowerCase('en-US') === String(right).toLocaleLowerCase('en-US');
}

function compareValues(left, right) {
  if (left == null || right == null) return null;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
}

function likePattern(pattern) {
  const escaped = String(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replace(/%/g, '.*').replace(/_/g, '.')}$`, 'iu');
}

function matchesCondition(left, operator, right) {
  // SQL comparisons with NULL evaluate to UNKNOWN, which WHERE filters out.
  if (left == null || right == null) return false;
  switch (operator.toUpperCase()) {
    case '=': return valuesEqual(left, right);
    case '!=':
    case '<>': return left != null && right != null && !valuesEqual(left, right);
    case '<': return compareValues(left, right) < 0;
    case '<=': return compareValues(left, right) <= 0;
    case '>': return compareValues(left, right) > 0;
    case '>=': return compareValues(left, right) >= 0;
    case 'LIKE': return left != null && right != null && likePattern(right).test(String(left));
    default:
      fail(`ไม่รองรับ operator ${operator}`, `Unsupported operator ${operator}`);
  }
}

function qualifierLabel(relation, relations) {
  const sameTableCount = relations.filter(
    (item) => keyOf(item.tableName) === keyOf(relation.tableName),
  ).length;
  // Prefer the real table name in result headers. A self-JOIN needs aliases to
  // distinguish two instances of the same table.
  return sameTableCount > 1 ? relation.alias : relation.tableName;
}

function buildProjection(selectItems, relations) {
  const projected = [];
  for (const item of selectItems) {
    if (item.kind === 'star') {
      const targetRelations = item.qualifier
        ? [relationForQualifier(item.qualifier, relations)]
        : relations;
      targetRelations.forEach((relation) => {
        relation.table.columns.forEach((column) => {
          projected.push({ relation, column, alias: null });
        });
      });
      continue;
    }

    const resolved = resolveColumn(item.ref, relations, 'SELECT');
    projected.push({ ...resolved, alias: item.alias });
  }

  if (!projected.length) {
    fail('SELECT ไม่พบคอลัมน์ให้แสดง', 'SELECT did not resolve to any columns', 'ตรวจ schema ของตารางที่ว่าง');
  }

  const baseCounts = new Map();
  projected.forEach((item) => {
    const base = item.alias || item.column;
    const lower = keyOf(base);
    baseCounts.set(lower, (baseCounts.get(lower) || 0) + 1);
  });

  projected.forEach((item) => {
    if (item.alias) item.header = item.alias;
    else if ((baseCounts.get(keyOf(item.column)) || 0) > 1) {
      item.header = `${qualifierLabel(item.relation, relations)}.${item.column}`;
    } else item.header = item.column;
  });

  const used = new Map();
  projected.forEach((item) => {
    const lower = keyOf(item.header);
    if (used.has(lower)) {
      fail(
        `ชื่อคอลัมน์ผลลัพธ์ ${item.header} ซ้ำกัน`,
        `Duplicate result column ${item.header}`,
        'ใช้ AS ตั้งชื่อคอลัมน์ให้ต่างกัน เช่น a.id AS staff_id',
      );
    }
    used.set(lower, item);
  });
  return projected;
}

function resolveCondition(condition, relations) {
  const left = resolveColumn(condition.left, relations, 'WHERE');
  let right = condition.right;
  if (right.kind === 'column') {
    right = {
      kind: 'column',
      resolved: resolveColumn(right.ref, relations, 'WHERE right side'),
    };
  }
  return { left, operator: condition.operator, right };
}

function orderAccessor(order, relations, projection) {
  try {
    const resolved = resolveColumn(order.ref, relations, 'ORDER BY');
    return (scope) => valueFrom(scope, resolved);
  } catch (error) {
    if (order.ref.qualifier) throw error;
    const matches = projection.filter((item) => keyOf(item.header) === keyOf(order.ref.column));
    if (matches.length === 1) return (scope) => valueFrom(scope, matches[0]);
    throw error;
  }
}

/**
 * Execute the supported SELECT subset against in-memory JavaScript tables.
 *
 * @param {string} query SQL SELECT statement.
 * @param {Record<string, Array<Record<string, unknown>>>} tables Table data.
 * @returns {{data: Array<Record<string, unknown>>, tables: string[], columns: string[]}}
 */
export function executeSQL(query, tables) {
  if (typeof query !== 'string') fail('query ต้องเป็นข้อความ', 'query must be a string');
  const ast = new Parser(tokenize(query.trim())).parse();
  const prepared = prepareTables(tables);
  const relations = [];
  let relationId = 0;

  const fromRelation = makeRelation(ast.from, prepared, relationId++);
  ensureUniqueAlias(relations, fromRelation);
  relations.push(fromRelation);
  let scopes = fromRelation.table.rows.map((row) => new Map([[fromRelation.id, row]]));

  for (const join of ast.joins) {
    const newRelation = makeRelation(join.tableRef, prepared, relationId++);
    ensureUniqueAlias(relations, newRelation);
    const joinedRelations = [...relations, newRelation];
    const leftResolved = resolveColumn(join.left, joinedRelations, 'JOIN ON');
    const rightResolved = resolveColumn(join.right, joinedRelations, 'JOIN ON');
    const leftIsNew = leftResolved.relation.id === newRelation.id;
    const rightIsNew = rightResolved.relation.id === newRelation.id;
    if (leftIsNew === rightIsNew) {
      fail(
        `ON ของ JOIN ${newRelation.alias} ต้องเชื่อมตารางใหม่กับตารางก่อนหน้า`,
        `JOIN ON for ${newRelation.alias} must connect the new table to a previous table`,
        `เช่น ON ${relations[0].alias}.id = ${newRelation.alias}.foreign_id`,
      );
    }

    const nextScopes = [];
    scopes.forEach((scope) => {
      let matched = false;
      newRelation.table.rows.forEach((rightRow) => {
        const candidate = new Map(scope);
        candidate.set(newRelation.id, rightRow);
        if (valuesEqual(valueFrom(candidate, leftResolved), valueFrom(candidate, rightResolved))) {
          matched = true;
          nextScopes.push(candidate);
        }
      });
      if (!matched && join.type === 'left') {
        const candidate = new Map(scope);
        candidate.set(newRelation.id, null);
        nextScopes.push(candidate);
      }
    });
    scopes = nextScopes;
    relations.push(newRelation);
  }

  const projection = buildProjection(ast.select, relations);
  const conditions = ast.where.map((condition) => resolveCondition(condition, relations));
  if (conditions.length) {
    scopes = scopes.filter((scope) => conditions.every((condition) => {
      const left = valueFrom(scope, condition.left);
      const right = condition.right.kind === 'literal'
        ? condition.right.value
        : valueFrom(scope, condition.right.resolved);
      return matchesCondition(left, condition.operator, right);
    }));
  }

  if (ast.orderBy.length) {
    const orders = ast.orderBy.map((order) => ({
      ...order,
      value: orderAccessor(order, relations, projection),
    }));
    scopes.sort((leftScope, rightScope) => {
      for (const order of orders) {
        const left = order.value(leftScope);
        const right = order.value(rightScope);
        if (left == null && right == null) continue;
        if (left == null) return 1;
        if (right == null) return -1;
        const compared = compareValues(left, right);
        if (compared) return order.direction === 'desc' ? -compared : compared;
      }
      return 0;
    });
  }

  if (ast.limit !== null) scopes = scopes.slice(0, ast.limit);

  const columns = projection.map((item) => item.header);
  const data = scopes.map((scope) => {
    const row = {};
    projection.forEach((item) => {
      row[item.header] = valueFrom(scope, item);
    });
    return row;
  });
  const usedTables = [];
  relations.forEach((relation) => {
    if (!usedTables.some((name) => keyOf(name) === keyOf(relation.tableName))) usedTables.push(relation.tableName);
  });
  return { data, tables: usedTables, columns };
}

export default executeSQL;
