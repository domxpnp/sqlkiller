export const cases = [
  {
    id: 'C-01', title: 'คดีขนมหายยามดึก', subtitle: 'THE MIDNIGHT SNACK',
    difficulty: 'BEGINNER', concept: 'SELECT · WHERE', meta: '09:20 AM · HQ PANTRY · MINOR',
    brief: 'ขนมรุ่น Limited ของสารวัตรหายจากตู้เย็น ผู้ต้องสงสัยทุกคนยืนยันว่าไม่ได้แตะต้องมัน กล้องเสีย แต่ระบบสแกนบัตรและใบเสร็จยังอยู่',
    question: 'ใครขโมยขนมของสารวัตร?', culprit: 2, suspectTable: 'staff',
    image: '/images/case-01-midnight-snack.png',
    tables: {
      staff: [
        { id: 1, name: 'กานต์', role: 'ธุรการ', shift: 'DAY' },
        { id: 2, name: 'นิรันดร์', role: 'IT Support', shift: 'NIGHT' },
        { id: 3, name: 'เมษา', role: 'นักวิเคราะห์', shift: 'DAY' }
      ],
      pantry_logs: [
        { log_id: 11, staff_id: 2, time: '00:42', action: 'FRIDGE OPEN' },
        { log_id: 12, staff_id: 1, time: '08:10', action: 'COFFEE' }
      ],
      purchases: [
        { receipt_id: 21, staff_id: 1, item: 'Coffee', time: '08:12' },
        { receipt_id: 22, staff_id: 3, item: 'Sandwich', time: '12:05' }
      ]
    },
    dictionary: {
      staff: {
        description: 'รายชื่อเจ้าหน้าที่และกะทำงานในวันที่ขนมหาย', columns: {
          id: ['INTEGER · PK', 'รหัสเจ้าหน้าที่ ใช้เชื่อมกับ staff_id'],
          name: ['VARCHAR', 'ชื่อเจ้าหน้าที่'],
          role: ['VARCHAR', 'ตำแหน่งงาน'],
          shift: ['ENUM', 'กะทำงาน DAY หรือ NIGHT']
        }
      },
      pantry_logs: {
        description: 'ประวัติการใช้บัตรและกิจกรรมในห้องพัก', columns: {
          log_id: ['INTEGER · PK', 'รหัสเหตุการณ์'],
          staff_id: ['INTEGER · FK → staff.id', 'เจ้าของบัตรที่ทำรายการ'],
          time: ['TIME', 'เวลาที่เกิดกิจกรรม'],
          action: ['VARCHAR', 'กิจกรรมที่ระบบบันทึก']
        }
      },
      purchases: {
        description: 'ใบเสร็จอาหารที่เจ้าหน้าที่นำมาเบิก', columns: {
          receipt_id: ['INTEGER · PK', 'หมายเลขใบเสร็จ'],
          staff_id: ['INTEGER · FK → staff.id', 'เจ้าของใบเสร็จ'],
          item: ['VARCHAR', 'รายการสินค้าที่ซื้อ'],
          time: ['TIME', 'เวลาบนใบเสร็จ']
        }
      }
    },
    objectives: [
      ['staff', 'ตรวจรายชื่อเวร', 'ใครอยู่กะกลางคืน?', 'SHIFT RECORD', 'นิรันดร์เป็นคนเดียวที่เข้าเวรกะกลางคืน'],
      ['pantry_logs', 'ตรวจประตูตู้เย็น', 'ใครเปิดตู้หลังเที่ยงคืน?', 'ACCESS TRACE', 'บัตรของนิรันดร์เปิดตู้เย็นเวลา 00:42'],
      ['purchases', 'ตรวจใบเสร็จ', 'ใครมีหลักฐานการซื้อ?', 'RECEIPT CHECK', 'ไม่พบใบเสร็จซื้ออาหารของนิรันดร์']
    ],
    hints: ['เริ่มด้วย SELECT * FROM staff;', "ใช้ WHERE shift = 'NIGHT' เพื่อกรองเวรกลางคืน", 'เชื่อม staff กับ pantry_logs ผ่าน staff.id = pantry_logs.staff_id'],
    tip: 'เริ่มจาก SELECT * แล้วค่อยกรองด้วย WHERE',
    starter: 'SELECT staff.name, staff.shift, pantry_logs.time, pantry_logs.action\nFROM staff\nLEFT JOIN pantry_logs ON staff.id = pantry_logs.staff_id;'
  },
  {
    id: 'C-02', title: 'ปริศนาที่จอดรถหมายเลข 404', subtitle: 'PARKING SLOT 404',
    difficulty: 'INTERMEDIATE', concept: 'WHERE · ORDER BY', meta: '06:35 PM · TOWER B · PROPERTY',
    brief: 'รถของผู้อำนวยการถูกย้ายไปจอดขวางทางหนีไฟ มีรถสามคันผ่านไม้กั้นในช่วงเกิดเหตุ แต่มีเพียงคันเดียวใช้ใบอนุญาตหมดอายุ',
    question: 'ใครย้ายรถไปช่อง 404?', culprit: 3, suspectTable: 'drivers',
    image: '/images/case-02-parking-404.png',
    tables: {
      drivers: [
        { id: 1, name: 'พีท', department: 'LEGAL' },
        { id: 2, name: 'ออม', department: 'FINANCE' },
        { id: 3, name: 'พลอย', department: 'OPS' }
      ],
      vehicles: [
        { plate: 'กข-1101', driver_id: 1, color: 'BLACK' },
        { plate: 'ชว-2040', driver_id: 2, color: 'WHITE' },
        { plate: 'ดท-4404', driver_id: 3, color: 'RED' }
      ],
      gate_logs: [
        { plate: 'กข-1101', time: '17:42', gate: 'A' },
        { plate: 'ดท-4404', time: '18:07', gate: 'B' },
        { plate: 'ชว-2040', time: '18:20', gate: 'A' }
      ],
      permits: [
        { driver_id: 1, status: 'VALID', slot: '110' },
        { driver_id: 2, status: 'VALID', slot: '204' },
        { driver_id: 3, status: 'EXPIRED', slot: '404' }
      ]
    },
    dictionary: {
      drivers: {
        description: 'เจ้าของสิทธิ์ขับรถที่เข้าอาคาร', columns: {
          id: ['INTEGER · PK', 'รหัสคนขับ'],
          name: ['VARCHAR', 'ชื่อคนขับ'],
          department: ['VARCHAR', 'แผนกต้นสังกัด']
        }
      },
      vehicles: {
        description: 'ทะเบียนรถและเจ้าของรถ', columns: {
          plate: ['VARCHAR · PK', 'หมายเลขทะเบียนรถ'],
          driver_id: ['INTEGER · FK → drivers.id', 'รหัสเจ้าของรถ'],
          color: ['VARCHAR', 'สีของรถ']
        }
      },
      gate_logs: {
        description: 'เหตุการณ์รถผ่านไม้กั้นของอาคาร', columns: {
          plate: ['VARCHAR · FK → vehicles.plate', 'ทะเบียนรถที่ผ่านประตู'],
          time: ['TIME', 'เวลาที่ผ่านไม้กั้น'],
          gate: ['CHAR', 'ชื่อประตูทางเข้า']
        }
      },
      permits: {
        description: 'สถานะใบอนุญาตและช่องจอดประจำ', columns: {
          driver_id: ['INTEGER · FK → drivers.id', 'เจ้าของใบอนุญาต'],
          status: ['ENUM', 'VALID หรือ EXPIRED'],
          slot: ['VARCHAR', 'หมายเลขช่องจอด']
        }
      }
    },
    objectives: [
      ['vehicles', 'จับคู่รถกับคนขับ', 'ตรวจทะเบียนรถ', 'VEHICLE MATCH', 'รถทะเบียน ดท-4404 เป็นของพลอย'],
      ['gate_logs', 'สร้างไทม์ไลน์', 'ตรวจเวลาผ่านไม้กั้น', 'GATE TIMELINE', 'รถของพลอยผ่าน Gate B เวลา 18:07'],
      ['permits', 'ตรวจใบอนุญาต', 'ค้นหา status ผิดปกติ', 'PERMIT ALERT', 'ใบอนุญาตของพลอยหมดอายุและระบุช่อง 404']
    ],
    hints: ['ดู vehicles เพื่อเชื่อมทะเบียนกับ driver_id', "ลอง WHERE status = 'EXPIRED'", 'JOIN drivers กับ permits ด้วย id และ driver_id'],
    tip: 'ข้อความต้องใส่ในเครื่องหมาย single quote',
    starter: "SELECT drivers.name, vehicles.plate, permits.status, permits.slot\nFROM drivers\nJOIN vehicles ON drivers.id = vehicles.driver_id\nJOIN permits ON drivers.id = permits.driver_id\nWHERE permits.status = 'EXPIRED';"
  },
  {
    id: 'C-03', title: 'พนักงานผีในบัญชีเงินเดือน', subtitle: 'THE GHOST EMPLOYEE',
    difficulty: 'ADVANCED', concept: 'JOIN · NULL', meta: '11:10 AM · FINANCE DB · FRAUD',
    brief: 'ฝ่ายบัญชีพบเงินเดือนถูกโอนไปยังพนักงานที่ไม่มีใครเคยพบ รหัสพนักงานนั้นเข้าใช้งานจากเครื่องของเจ้าหน้าที่เพียงคนเดียว',
    question: 'ใครสร้างพนักงานปลอม?', culprit: 2, suspectTable: 'employees',
    image: '/images/case-03-ghost-payroll.png',
    tables: {
      employees: [
        { id: 1, name: 'รสา', team: 'HR', device_id: 'PC-11' },
        { id: 2, name: 'อรุณ', team: 'PAYROLL', device_id: 'PC-22' },
        { id: 3, name: 'ธีร์', team: 'AUDIT', device_id: 'PC-33' }
      ],
      payroll: [
        { payment_id: 51, employee_id: 1, amount: 42000, status: 'PAID' },
        { payment_id: 52, employee_id: 2, amount: 48000, status: 'PAID' },
        { payment_id: 53, employee_id: 999, amount: 48000, status: 'FLAGGED' }
      ],
      devices: [
        { event_id: 71, device_id: 'PC-22', time: '02:14', action: 'CREATE EMPLOYEE 999' },
        { event_id: 72, device_id: 'PC-33', time: '09:02', action: 'READ AUDIT' }
      ]
    },
    dictionary: {
      employees: {
        description: 'ข้อมูลพนักงานจริงและเครื่องประจำตัว', columns: {
          id: ['INTEGER · PK', 'รหัสพนักงาน'],
          name: ['VARCHAR', 'ชื่อพนักงาน'],
          team: ['VARCHAR', 'ทีมที่สังกัด'],
          device_id: ['VARCHAR · FK → devices.device_id', 'รหัสเครื่องคอมพิวเตอร์ประจำตัว']
        }
      },
      payroll: {
        description: 'รายการจ่ายเงินเดือนของรอบปัจจุบัน', columns: {
          payment_id: ['INTEGER · PK', 'รหัสธุรกรรม'],
          employee_id: ['INTEGER · FK → employees.id', 'ผู้รับเงินตามระบบ'],
          amount: ['DECIMAL', 'ยอดเงินที่จ่าย'],
          status: ['ENUM', 'สถานะตรวจสอบรายการ']
        }
      },
      devices: {
        description: 'Audit log จากคอมพิวเตอร์ของเจ้าหน้าที่', columns: {
          event_id: ['INTEGER · PK', 'รหัสเหตุการณ์'],
          device_id: ['VARCHAR · FK → employees.device_id', 'เครื่องที่สร้างเหตุการณ์'],
          time: ['TIME', 'เวลาของเหตุการณ์'],
          action: ['VARCHAR', 'คำสั่งที่ดำเนินการ']
        }
      }
    },
    objectives: [
      ['payroll', 'หาเงินโอนผิดปกติ', 'ตรวจ FLAGGED และ employee_id', 'PAYROLL ANOMALY', 'พบเงิน 48,000 บาทโอนไป employee_id 999'],
      ['devices', 'ตามรอยอุปกรณ์', 'ใครสร้าง employee 999?', 'DEVICE TRACE', 'PC-22 สร้าง employee 999 เวลา 02:14'],
      ['employees', 'ระบุเจ้าของเครื่อง', 'เชื่อม device_id กับพนักงาน', 'IDENTITY MATCH', 'PC-22 เป็นเครื่องของอรุณ ฝ่าย PAYROLL']
    ],
    hints: ['ตรวจ payroll แล้วหา status FLAGGED', 'ดู devices และเหตุการณ์ CREATE EMPLOYEE 999', 'JOIN employees กับ devices ผ่าน device_id'],
    tip: 'JOIN ช่วยเชื่อมหลักฐานจากคนละตาราง',
    starter: 'SELECT employees.name, employees.team, devices.time, devices.action\nFROM employees\nJOIN devices ON employees.device_id = devices.device_id\nORDER BY devices.time ASC;'
  },
  {
    id: 'C-04', title: 'เงามรณะในเซิร์ฟเวอร์', subtitle: 'LOCKED SERVER',
    difficulty: 'EXPERT', concept: 'MULTI-TABLE INVESTIGATION', meta: '01:47 AM · SERVER-A · CRITICAL',
    brief: 'นักพัฒนาระบบถูกพบเสียชีวิตในห้องเซิร์ฟเวอร์ ประตูถูกล็อกจากด้านใน แต่ log ไม่เคยโกหก... หรือมันโกหก?',
    question: 'ใครคือฆาตกรในห้องเซิร์ฟเวอร์?', culprit: 2, suspectTable: 'suspects',
    image: '/images/case-04-locked-server-cartoon.png',
    tables: {
      suspects: [
        { id: 1, name: 'ธันวา วัฒน์', role: 'CTO', alibi: 'ประชุมออนไลน์', risk: 'MEDIUM' },
        { id: 2, name: 'มิรา คงชัย', role: 'DB Admin', alibi: 'กลับบ้าน 23:00', risk: 'HIGH' },
        { id: 3, name: 'กฤตภาส แสง', role: 'Security', alibi: 'ตรวจชั้น 18', risk: 'LOW' },
        { id: 4, name: 'ลลิตา พราว', role: 'Product Lead', alibi: 'งานเลี้ยงบริษัท', risk: 'MEDIUM' }
      ],
      access_logs: [
        { log_id: 201, suspect_id: 3, room: 'SERVER-A', time: '23:41', action: 'EXIT', status: 'VALID' },
        { log_id: 202, suspect_id: 2, room: 'SERVER-A', time: '00:38', action: 'ENTRY', status: 'OVERRIDE' },
        { log_id: 203, suspect_id: 2, room: 'SERVER-A', time: '01:12', action: 'EXIT', status: 'LOG DELETED' }
      ],
      messages: [
        { msg_id: 81, suspect_id: 1, time: '19:12', content: 'พรุ่งนี้คุยเรื่อง audit กัน', deleted: 'NO' },
        { msg_id: 82, suspect_id: 2, time: '22:58', content: 'ถ้าเขาเปิดเผยเรื่อง backdoor เราจบแน่', deleted: 'YES' }
      ],
      inventory: [
        { item_id: 91, item: 'Fiber cable', owner_id: 3, trace: 'NONE' },
        { item_id: 92, item: 'Insulin injector', owner_id: 2, trace: 'VICTIM DNA' }
      ]
    },
    dictionary: {
      suspects: {
        description: 'บุคคลที่เกี่ยวข้อง คำให้การ และระดับความเสี่ยง', columns: {
          id: ['INTEGER · PK', 'รหัสผู้ต้องสงสัย'],
          name: ['VARCHAR', 'ชื่อและนามสกุล'],
          role: ['VARCHAR', 'หน้าที่ในบริษัท'],
          alibi: ['TEXT', 'คำให้การช่วงเกิดเหตุ'],
          risk: ['ENUM', 'ระดับความเสี่ยงจากการคัดกรอง']
        }
      },
      access_logs: {
        description: 'ประวัติใช้บัตรผ่านเข้าออกห้องเซิร์ฟเวอร์', columns: {
          log_id: ['INTEGER · PK', 'รหัสเหตุการณ์'],
          suspect_id: ['INTEGER · FK → suspects.id', 'เจ้าของบัตรผ่าน'],
          room: ['VARCHAR', 'ห้องที่เข้าออก'],
          time: ['TIME', 'เวลาของเหตุการณ์'],
          action: ['ENUM', 'ENTRY หรือ EXIT'],
          status: ['VARCHAR', 'สถานะความสมบูรณ์ของ log']
        }
      },
      messages: {
        description: 'ข้อความภายใน รวมรายการที่กู้คืนหลังถูกลบ', columns: {
          msg_id: ['INTEGER · PK', 'รหัสข้อความ'],
          suspect_id: ['INTEGER · FK → suspects.id', 'เจ้าของข้อความ'],
          time: ['TIME', 'เวลาที่ส่ง'],
          content: ['TEXT', 'เนื้อหาที่กู้คืน'],
          deleted: ['BOOLEAN', 'ข้อความเคยถูกลบหรือไม่']
        }
      },
      inventory: {
        description: 'สิ่งของที่ตรวจพบและผลนิติวิทยาศาสตร์', columns: {
          item_id: ['INTEGER · PK', 'รหัสหลักฐาน'],
          item: ['VARCHAR', 'ชื่อสิ่งของ'],
          owner_id: ['INTEGER · FK → suspects.id', 'เจ้าของสิ่งของ'],
          trace: ['VARCHAR', 'ร่องรอยทางนิติวิทยาศาสตร์']
        }
      }
    },
    objectives: [
      ['access_logs', 'หาคนที่เข้าห้อง', 'ตรวจ log ที่ถูกแก้ไข', 'ACCESS ANOMALY', 'บัตรของมิราเข้า SERVER-A และ exit log ถูกลบ'],
      ['messages', 'ค้นหาแรงจูงใจ', 'ตามหาข้อความที่ถูกลบ', 'DELETED MESSAGE', 'มิรากลัวว่าเหยื่อจะเปิดเผยเรื่อง backdoor'],
      ['inventory', 'ระบุอาวุธ', 'ตรวจ DNA บนสิ่งของ', 'FORENSIC MATCH', 'Injector ของมิรามี DNA ของเหยื่อ']
    ],
    hints: ['JOIN suspects กับ access_logs ผ่าน id และ suspect_id', "ค้น messages ที่ deleted = 'YES'", 'เชื่อม inventory.owner_id กลับไปยัง suspects.id'],
    tip: 'ข้อสรุปที่ดีต้องสอดคล้องกับทุกตาราง',
    starter: 'SELECT suspects.*, access_logs.room, access_logs.time, access_logs.action, access_logs.status\nFROM suspects\nLEFT JOIN access_logs ON suspects.id = access_logs.suspect_id\nORDER BY access_logs.time ASC;'
  }
];
