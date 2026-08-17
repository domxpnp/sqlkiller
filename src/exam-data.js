export const examReferenceRows = [
  {
    rowNo: 2,
    shop: 'IT24H Star',
    status: 'ชำระเงินแล้ว',
    orderedAt: '2021-02-01 10:10:12',
    orderNo: 'TH202102143',
    item: 'Apple magic Mouse',
    option: 'สีเงิน',
    quantity: 1,
    subtotal: 2200,
    shipping: 30,
    discount: 0,
    net: 2230
  },
  {
    rowNo: 4,
    shop: 'Icomputer',
    status: 'ส่งของแล้ว',
    orderedAt: '2020-11-11 12:28:00',
    orderNo: 'TH202011091',
    item: 'Keyboard ไร้สาย',
    option: 'สีดำ',
    quantity: 1,
    subtotal: 9190,
    shipping: 15,
    discount: 30,
    net: 9175
  },
  {
    rowNo: 5,
    shop: 'Icomputer',
    status: 'ส่งของแล้ว',
    orderedAt: '2020-11-11 12:28:00',
    orderNo: 'TH202011091',
    item: 'แผ่นรองเมาส์',
    option: 'ขนาดใหญ่',
    quantity: 1,
    subtotal: 560,
    shipping: 15,
    discount: 0,
    net: 575
  }
];

const countMatches = (answer, pattern) => (answer.match(pattern) || []).length;
const includesAll = (answer, values) => values.every(value => answer.toLocaleLowerCase('th-TH').includes(value.toLocaleLowerCase('th-TH')));

function stripCodeComments(answer) {
  const source = String(answer);
  let result = '';
  let quote = null;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (quote) {
      result += character;
      if (character === '\\' && index + 1 < source.length) {
        result += source[index + 1];
        index += 1;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      result += character;
      continue;
    }

    const sqlComment = character === '-' && next === '-'
      && (index === 0 || /\s/u.test(source[index - 1]));
    if ((character === '/' && next === '/') || sqlComment || character === '#') {
      while (index < source.length && source[index] !== '\n') index += 1;
      result += '\n';
      continue;
    }

    if (character === '/' && next === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        if (source[index] === '\n') result += '\n';
        index += 1;
      }
      if (index < source.length) index += 1;
      result += ' ';
      continue;
    }

    result += character;
  }

  return result;
}

const checkedCode = answer => stripCodeComments(answer).trim();
const codeMatches = (answer, pattern) => pattern.test(checkedCode(answer));
const countCodeMatches = (answer, pattern) => countMatches(checkedCode(answer), pattern);
const codeIncludesAll = (answer, values) => includesAll(checkedCode(answer), values);

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fieldPattern(fields) {
  const alternatives = fields.map(escapeRegExp).join('|');
  return `(?:\\.\\s*(?:${alternatives})\\b|\\[\\s*['\"\`](?:${alternatives})['\"\`]\\s*\\]|\\b(?:${alternatives})\\b\\s*(?=[:,=])|\\b(?:${alternatives})\\b(?=\\s*,))`;
}

function hasFieldReference(code, fields) {
  return new RegExp(fieldPattern(fields), 'iu').test(code);
}

function hasIteration(code) {
  return /\.(?:map|reduce|forEach|groupBy)\s*\(|\bfor\s*(?:\(|[\w$]+\s+(?:in|of)\b)|\bwhile\s*\(|\bgroup\s+by\b|\bupdate\b[\s\S]*\bset\b/iu.test(code);
}

function hasGroupingWrite(code) {
  return /\.(?:reduce|groupBy|push|append|set|setdefault)\s*\(|\[[^\]\r\n]+\]\s*(?:\?\?=|\|\|=|=)|\bgroup\s+by\b/iu.test(code);
}

function hasResultOutput(code) {
  return /\breturn\s+(?![;}\r\n])[^;}\r\n]+|\bconsole\.(?:log|table)\s*\(|\bprint\s*\(|\bselect\b[\s\S]*\bfrom\b/iu.test(code);
}

function usesDeclaredInput(code) {
  const signatures = [
    /\bfunction\s+[\w$]*\s*\(\s*([A-Za-z_$][\w$]*)/u,
    /\bdef\s+\w+\s*\(\s*([A-Za-z_][\w]*)/u,
    /\b(?:const|let|var)\s+[\w$]+\s*=\s*(?:async\s*)?\(?\s*([A-Za-z_$][\w$]*)/u,
    /\b(?:public|private|protected|static)\s+[\w<>,[\]?]+\s+\w+\s*\(\s*[\w<>,[\]?]+\s+([A-Za-z_][\w]*)/u
  ];
  const match = signatures.map(pattern => code.match(pattern)).find(Boolean);
  if (!match) return false;
  return countMatches(code, new RegExp(`\\b${escapeRegExp(match[1])}\\b`, 'gu')) >= 2;
}

function hasMinuteFormatting(code) {
  if (/\.(?:getMinutes|getUTCMinutes)\s*\(|\bminute\s*:\s*['"]?(?:2-digit|numeric)|\bstrftime\s*\(\s*['"][^'"]*%[IM]|(?:HH?|hh?):mm/iu.test(code)) return true;
  return countMatches(code, /\bminutes?\b/giu) >= 2 && hasResultOutput(code);
}

function assignsStringToField(code, fields, value) {
  const quotedValue = `(?:'${escapeRegExp(value)}'|\"${escapeRegExp(value)}\"|\`${escapeRegExp(value)}\`)`;
  return new RegExp(`${fieldPattern(fields)}\\s*(?::|=)\\s*${quotedValue}`, 'iu').test(code);
}

function aggregatesFields(code, fields) {
  return fields.every(field => hasFieldReference(code, [field]))
    && /\+=|=\s*[^;\r\n]*\+|\bsum\s*\(|\.reduce\s*\(/iu.test(code);
}

function parseJsonAnswer(answer) {
  try {
    const value = JSON.parse(answer.trim());
    return { valid: true, value };
  } catch {
    return { valid: false, value: null };
  }
}

export const examQuestions = [
  {
    id: 'sql-schema',
    number: 1,
    section: 'SQL',
    eyebrow: 'DATABASE DESIGN',
    title: 'ออกแบบตาราง Header และ Detail',
    prompt: 'ออกแบบฐานข้อมูลจากชุดข้อมูลรายการสินค้า โดยแยกข้อมูลระดับคำสั่งซื้อออกจากข้อมูลแต่ละรายการสินค้าให้ชัดเจน',
    requirements: [
      'สร้างตาราง Header สำหรับข้อมูลระดับคำสั่งซื้อ',
      'สร้างตาราง Detail สำหรับรายการสินค้า',
      'กำหนด Primary Key, Foreign Key และชนิดข้อมูลที่เหมาะสม'
    ],
    language: 'sql',
    starter: `-- Question 01 / Database design\n-- ออกแบบตาราง order header และ order detail ที่นี่\n\n`,
    hint: 'ข้อมูลร้าน สถานะ วันที่ และเลขคำสั่งซื้อซ้ำกันเมื่อหนึ่งคำสั่งซื้อมีหลายสินค้า จึงควรอยู่ฝั่ง Header ส่วนชื่อสินค้า ตัวเลือก จำนวน และราคาอยู่ฝั่ง Detail',
    checks: [
      { label: 'มีคำสั่ง CREATE TABLE อย่างน้อย 2 ตาราง', validate: answer => countCodeMatches(answer, /\bcreate\s+table\b/gi) >= 2 },
      { label: 'กำหนด Primary Key', validate: answer => codeMatches(answer, /\bprimary\s+key\b/i) },
      { label: 'เชื่อมความสัมพันธ์ด้วย Foreign Key หรือ REFERENCES', validate: answer => codeMatches(answer, /\bforeign\s+key\b|\breferences\b/i) }
    ]
  },
  {
    id: 'sql-insert',
    number: 2,
    section: 'SQL',
    eyebrow: 'DATA SEEDING',
    title: 'เขียน Query สำหรับ Insert ข้อมูล',
    prompt: 'เขียนคำสั่งเพิ่มข้อมูลตัวอย่างทั้ง 3 รายการลงในตารางที่ออกแบบไว้ในข้อ 1 โดยรักษาความสัมพันธ์ระหว่าง Header และ Detail',
    requirements: [
      'เพิ่ม Header ของคำสั่งซื้อที่ไม่ซ้ำกัน',
      'เพิ่ม Detail ครบทั้ง 3 รายการ',
      'ข้อมูลเลขคำสั่งซื้อ ร้าน ราคา และสถานะต้องตรงกับตารางอ้างอิง'
    ],
    language: 'sql',
    starter: `-- Question 02 / Insert reference data\n\n`,
    hint: 'ข้อมูลมี 2 หมายเลขคำสั่งซื้อ แต่มี Detail 3 รายการ: TH202102143 มี 1 รายการ และ TH202011091 มี 2 รายการ',
    checks: [
      { label: 'มีคำสั่ง INSERT INTO', validate: answer => codeMatches(answer, /\binsert\s+into\b/i) },
      { label: 'มีหมายเลขคำสั่งซื้อทั้ง 2 หมายเลข', validate: answer => codeIncludesAll(answer, ['TH202102143', 'TH202011091']) },
      { label: 'อ้างอิงสินค้าครบทั้ง 3 รายการ', validate: answer => codeIncludesAll(answer, ['Apple magic Mouse', 'Keyboard ไร้สาย', 'แผ่นรองเมาส์']) }
    ]
  },
  {
    id: 'sql-join',
    number: 3,
    section: 'SQL',
    eyebrow: 'RELATIONSHIP QUERY',
    title: 'Join ตารางกลับเป็นรายการสินค้า',
    prompt: 'เขียน Query เชื่อมตาราง Header และ Detail เพื่อแสดงข้อมูลคำสั่งซื้อพร้อมรายการสินค้าในผลลัพธ์เดียว',
    requirements: [
      'เลือกคอลัมน์สำคัญจากทั้งสองตาราง',
      'JOIN ด้วยคีย์ความสัมพันธ์ที่สร้างไว้',
      'ผลลัพธ์ต้องรองรับคำสั่งซื้อหนึ่งรายการที่มีสินค้าหลายรายการ'
    ],
    language: 'sql',
    starter: `-- Question 03 / Join header and detail\nSELECT\n  -- columns\nFROM\n  -- header table\n`,
    hint: 'ใช้คีย์ของ Header เป็นตัวเชื่อมกับ Foreign Key ใน Detail และระบุชื่อตารางหรือ alias หน้าคอลัมน์ที่ชื่อซ้ำกัน',
    checks: [
      { label: 'มี SELECT และ FROM', validate: answer => codeMatches(answer, /\bselect\b/i) && codeMatches(answer, /\bfrom\b/i) },
      { label: 'มีคำสั่ง JOIN', validate: answer => codeMatches(answer, /\b(?:inner\s+|left\s+|right\s+|full\s+)?join\b/i) },
      { label: 'มีเงื่อนไขเชื่อมตารางด้วย ON', validate: answer => codeMatches(answer, /\bon\b[\s\S]*=/i) }
    ]
  },
  {
    id: 'sql-sum',
    number: 4,
    section: 'SQL',
    eyebrow: 'AGGREGATION',
    title: 'สรุปยอดรวมด้วย SQL',
    prompt: 'เขียน Query สรุปยอดรวมสินค้า ค่าจัดส่ง ส่วนลด และรายได้สุทธิจากข้อมูลที่เพิ่มไว้',
    requirements: [
      'รวมยอดสินค้า (subtotal)',
      'รวมค่าจัดส่ง (shipping)',
      'รวมส่วนลด (discount)',
      'รวมรายได้สุทธิ (net)'
    ],
    language: 'sql',
    starter: `-- Question 04 / Aggregate totals\nSELECT\n  -- SUM(...) AS ...\nFROM\n  -- table name\n`,
    hint: 'สามารถใช้ SUM หลายคอลัมน์ใน SELECT เดียวและตั้ง alias ให้แต่ละผลรวมอ่านความหมายได้ชัดเจน',
    checks: [
      { label: 'ใช้ SUM ครบ 4 ค่า', validate: answer => countCodeMatches(answer, /\bsum\s*\(/gi) >= 4 },
      { label: 'ครอบคลุมยอดสินค้าและค่าจัดส่ง', validate: answer => codeMatches(answer, /subtotal|total|ยอดรวม/i) && codeMatches(answer, /shipping|delivery|จัดส่ง/i) },
      { label: 'ครอบคลุมส่วนลดและยอดสุทธิ', validate: answer => codeMatches(answer, /discount|ส่วนลด/i) && codeMatches(answer, /net|สุทธิ/i) }
    ]
  },
  {
    id: 'dev-json',
    number: 5,
    section: 'PROGRAMMER',
    eyebrow: 'DATA TRANSFORMATION',
    title: 'ออกแบบข้อมูลเป็น JSON',
    prompt: 'แปลงข้อมูลตัวอย่างเป็น JSON format ที่นำไปใช้งานต่อในโปรแกรมได้ โดยส่งผลลัพธ์เป็น JSON เท่านั้น',
    requirements: [
      'JSON ต้อง parse ได้จริง',
      'มีข้อมูลครบ 3 รายการ',
      'ชื่อ field สื่อความหมายและชนิดข้อมูลเหมาะสม'
    ],
    language: 'json',
    starter: `[` + `\n  {\n    \"orderNo\": \"TH202102143\"\n  }\n]`,
    hint: 'ตัวเลขราคาและจำนวนควรเป็น number ไม่ใช่ string ส่วนวันที่อาจเก็บเป็นข้อความมาตรฐานเพื่อไม่ให้ข้อมูล timezone เปลี่ยนโดยไม่ตั้งใจ',
    checks: [
      { label: 'เป็น JSON ที่ parse ได้', validate: answer => parseJsonAnswer(answer).valid },
      { label: 'โครงสร้างหลักเป็น Array จำนวน 3 รายการ', validate: answer => { const parsed = parseJsonAnswer(answer); return parsed.valid && Array.isArray(parsed.value) && parsed.value.length === 3; } },
      { label: 'มีหมายเลขคำสั่งซื้อทั้ง 2 หมายเลข', validate: answer => includesAll(answer, ['TH202102143', 'TH202011091']) }
    ]
  },
  {
    id: 'dev-buddhist-date',
    number: 6,
    section: 'PROGRAMMER',
    eyebrow: 'DATE FORMATTING',
    title: 'แสดงวันที่ในรูปแบบปี พ.ศ.',
    prompt: 'เขียนโปรแกรมอ่านวันที่สั่งซื้อและแสดงผลเป็นรูปแบบวัน/เดือน/ปี พ.ศ. พร้อมเวลา เช่น 01/02/2564 10:10 น.',
    requirements: [
      'รองรับค่าจาก field วันที่สั่งซื้อ',
      'แปลงปี ค.ศ. เป็น พ.ศ. อย่างถูกต้อง',
      'จัดรูปแบบวัน เดือน ชั่วโมง และนาทีให้ครบ'
    ],
    language: 'javascript',
    starter: `// Question 06 / Buddhist Era date\nfunction formatThaiOrderDate(orderedAt) {\n  // your code\n}\n`,
    hint: 'หลักการพื้นฐานคือปี พ.ศ. = ปี ค.ศ. + 543 แต่ควรระวัง timezone เมื่อสร้าง Date จากข้อความที่ไม่มี timezone',
    checks: [
      { label: 'มีฟังก์ชันหรือขั้นตอนรับค่าวันที่', validate: answer => usesDeclaredInput(checkedCode(answer)) },
      { label: 'มีตรรกะแปลงเป็นปี พ.ศ. (+543 หรือ Buddhist calendar)', validate: answer => /\+\s*543|543\s*\+|calendar\s*[:=]\s*['"]buddhist|u-ca-buddhist|BuddhistCalendar\s*\(/iu.test(checkedCode(answer)) },
      { label: 'จัดรูปแบบเวลาอย่างน้อยถึงนาที', validate: answer => hasMinuteFormatting(checkedCode(answer)) }
    ]
  },
  {
    id: 'dev-group-orders',
    number: 7,
    section: 'PROGRAMMER',
    eyebrow: 'GROUPING',
    title: 'จัดกลุ่มข้อมูลตามคำสั่งซื้อ',
    prompt: 'เขียนโปรแกรมแยกหรือจัดกลุ่มรายการสินค้าด้วยหมายเลขคำสั่งซื้อ แล้วแสดงผลเป็น JSON ตาราง หรือโครงสร้างที่เหมาะสม',
    requirements: [
      'ใช้หมายเลขคำสั่งซื้อเป็น key ในการจัดกลุ่ม',
      'TH202011091 ต้องมีสินค้า 2 รายการ',
      'ผลลัพธ์ต้องรักษารายละเอียดสินค้าเดิม'
    ],
    language: 'javascript',
    starter: `// Question 07 / Group by order number\nfunction groupByOrder(rows) {\n  // your code\n}\n`,
    hint: 'ใน JavaScript สามารถใช้ reduce สร้าง object หรือ Map ที่ key เป็น orderNo แล้วสะสมสินค้าใน array ของแต่ละคำสั่งซื้อ',
    checks: [
      { label: 'อ้างอิง field หมายเลขคำสั่งซื้อ', validate: answer => hasFieldReference(checkedCode(answer), ['orderNo', 'order_no', 'orderNumber']) },
      { label: 'มีตรรกะจัดกลุ่มหรือสะสมรายการ', validate: answer => { const code = checkedCode(answer); return hasIteration(code) && hasGroupingWrite(code); } },
      { label: 'คืนค่าหรือแสดงผลลัพธ์', validate: answer => hasResultOutput(checkedCode(answer)) }
    ]
  },
  {
    id: 'dev-update-status',
    number: 8,
    section: 'PROGRAMMER',
    eyebrow: 'IMMUTABLE UPDATE',
    title: 'แก้สถานะสินค้าทุกรายการ',
    prompt: 'เขียนโปรแกรมเปลี่ยนสถานะของข้อมูลทุกรายการเป็น “ส่งของแล้ว” โดยไม่ทำให้ field อื่นสูญหาย',
    requirements: [
      'ประมวลผลครบทุกรายการ',
      'เปลี่ยนเฉพาะสถานะเป็น “ส่งของแล้ว”',
      'แสดงหรือคืนค่าชุดข้อมูลหลังแก้ไข'
    ],
    language: 'javascript',
    starter: `// Question 08 / Update every status\nfunction markEveryOrderAsShipped(rows) {\n  // your code\n}\n`,
    hint: 'map เหมาะกับการสร้าง array ใหม่ โดย copy field เดิมของแต่ละรายการและแทนค่า field status',
    checks: [
      { label: 'กำหนดค่าสถานะ “ส่งของแล้ว”', validate: answer => assignsStringToField(checkedCode(answer), ['status'], 'ส่งของแล้ว') },
      { label: 'ประมวลผลข้อมูลแบบหลายรายการ', validate: answer => hasIteration(checkedCode(answer)) },
      { label: 'มีการอ้างอิง field สถานะ', validate: answer => hasFieldReference(checkedCode(answer), ['status']) }
    ]
  },
  {
    id: 'dev-shop-revenue',
    number: 9,
    section: 'PROGRAMMER',
    eyebrow: 'REPORTING',
    title: 'รวมรายได้แยกตามร้าน',
    prompt: 'เขียนโปรแกรมสรุปรายได้จากทุกร้าน โดยแสดงยอดสินค้า ค่าจัดส่ง ส่วนลด และรายได้สุทธิของแต่ละร้าน',
    requirements: [
      'จัดกลุ่มด้วยชื่อร้าน',
      'รวมยอดสินค้าและค่าจัดส่ง',
      'รวมส่วนลดและรายได้สุทธิ',
      'ผลลัพธ์แสดงตัวเลขของแต่ละร้านอย่างชัดเจน'
    ],
    language: 'javascript',
    starter: `// Question 09 / Revenue by shop\nfunction summarizeRevenueByShop(rows) {\n  // your code\n}\n`,
    hint: 'สร้าง accumulator แยกตาม shop แล้วบวก subtotal, shipping, discount และ net ของแต่ละแถวเข้ากับร้านนั้น',
    checks: [
      { label: 'จัดกลุ่มหรือสะสมผลด้วยชื่อร้าน', validate: answer => { const code = checkedCode(answer); return hasFieldReference(code, ['shop', 'store']) && hasIteration(code) && hasGroupingWrite(code); } },
      { label: 'ครอบคลุมยอดสินค้าและค่าจัดส่ง', validate: answer => aggregatesFields(checkedCode(answer), ['subtotal', 'shipping']) },
      { label: 'ครอบคลุมส่วนลดและรายได้สุทธิ', validate: answer => aggregatesFields(checkedCode(answer), ['discount', 'net']) },
      { label: 'มีการคืนค่าหรือแสดงรายงาน', validate: answer => hasResultOutput(checkedCode(answer)) }
    ]
  }
];

export const examSections = [
  { id: 'SQL', title: 'ชุด 1 · SQL', range: 'ข้อ 01—04' },
  { id: 'PROGRAMMER', title: 'ชุด 2 · Programmer', range: 'ข้อ 05—09' }
];
