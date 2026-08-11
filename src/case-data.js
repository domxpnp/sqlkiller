export const cases = [
  {
    id: 'C-01', title: 'คดีขนมหายยามดึก', subtitle: 'THE MIDNIGHT SNACK',
    difficulty: 'BEGINNER+', concept: 'WHERE · JOIN', meta: '09:20 AM · HQ PANTRY · MINOR',
    brief: 'ขนมรุ่น Limited ของสารวัตรหายจากตู้เย็น ผู้ต้องสงสัยทุกคนยืนยันว่าไม่ได้แตะต้องมัน กล้องเสีย แต่ระบบสแกนบัตรและใบเสร็จยังอยู่',
    question: 'ใครขโมยขนมของสารวัตร?', culprit: 2, suspectTable: 'staff',
    image: '/images/case-01-midnight-snack.png',
    tables: {
      staff: [
        { id: 1, name: 'กานต์', role: 'ธุรการ', shift: 'DAY' },
        { id: 2, name: 'นิรันดร์', role: 'IT Support', shift: 'NIGHT' },
        { id: 3, name: 'เมษา', role: 'นักวิเคราะห์', shift: 'DAY' },
        { id: 4, name: 'วาริน', role: 'นิติกร', shift: 'EVENING' },
        { id: 5, name: 'ชนน', role: 'ช่างอาคาร', shift: 'NIGHT' },
        { id: 6, name: 'พิม', role: 'บัญชี', shift: 'DAY' },
        { id: 7, name: 'เหนือ', role: 'รปภ.', shift: 'NIGHT' },
        { id: 8, name: 'ลิน', role: 'นักศึกษาฝึกงาน', shift: 'EVENING' }
      ],
      pantry_logs: [
        { log_id: 11, staff_id: 2, time: '00:42', action: 'FRIDGE OPEN' },
        { log_id: 12, staff_id: 1, time: '08:10', action: 'COFFEE' },
        { log_id: 13, staff_id: 5, time: '23:18', action: 'WATER' },
        { log_id: 14, staff_id: 7, time: '23:51', action: 'COFFEE' },
        { log_id: 15, staff_id: 4, time: '19:24', action: 'FRIDGE OPEN' },
        { log_id: 16, staff_id: 6, time: '12:03', action: 'MICROWAVE' },
        { log_id: 17, staff_id: 5, time: '01:09', action: 'MICROWAVE' },
        { log_id: 18, staff_id: 3, time: '15:45', action: 'FRIDGE OPEN' },
        { log_id: 19, staff_id: 8, time: '20:10', action: 'WATER' },
        { log_id: 20, staff_id: 7, time: '02:21', action: 'WATER' }
      ],
      purchases: [
        { receipt_id: 21, staff_id: 1, item: 'Coffee', time: '08:12' },
        { receipt_id: 22, staff_id: 3, item: 'Sandwich', time: '12:05' },
        { receipt_id: 23, staff_id: 5, item: 'Noodles', time: '22:55' },
        { receipt_id: 24, staff_id: 7, item: 'Coffee', time: '23:40' },
        { receipt_id: 25, staff_id: 4, item: 'Salad', time: '18:50' },
        { receipt_id: 26, staff_id: 6, item: 'Yogurt', time: '11:58' },
        { receipt_id: 27, staff_id: 8, item: 'Tea', time: '19:54' },
        { receipt_id: 28, staff_id: 3, item: 'Milk', time: '15:30' }
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
      ['pantry_logs', 'ตรวจประตูตู้เย็น', 'JOIN ชื่อคนกับผู้เปิดตู้หลังเที่ยงคืน', 'ACCESS TRACE', 'บัตรของนิรันดร์เปิดตู้เย็นเวลา 00:42', ['staff', 'pantry_logs']],
      ['purchases', 'ตรวจใบเสร็จ', 'JOIN เพื่อตรวจหลักฐานการซื้อของผู้ต้องสงสัย', 'RECEIPT CHECK', 'ไม่พบใบเสร็จซื้ออาหารของนิรันดร์', ['staff', 'purchases']]
    ],
    hints: ['เริ่มด้วย SELECT * FROM staff;', "ใช้ WHERE shift = 'NIGHT' เพื่อกรองเวรกลางคืน", 'เชื่อม staff กับ pantry_logs ผ่าน staff.id = pantry_logs.staff_id'],
    tip: 'คนเข้าเวรกลางคืนมีหลายคน ต้องเชื่อมกิจกรรมและใบเสร็จก่อนสรุป',
    starter: 'SELECT *\nFROM staff;'
  },
  {
    id: 'C-02', title: 'ปริศนาที่จอดรถหมายเลข 404', subtitle: 'PARKING SLOT 404',
    difficulty: 'INTERMEDIATE+', concept: 'MULTI JOIN · WHERE', meta: '06:35 PM · TOWER B · PROPERTY',
    brief: 'รถของผู้อำนวยการถูกย้ายไปจอดขวางทางหนีไฟ มีรถหลายคันผ่านไม้กั้นในช่วงเกิดเหตุ และมีใบอนุญาตผิดปกติมากกว่าหนึ่งใบ ต้องหาเจ้าของรถที่เชื่อมโยงกับช่อง 404',
    question: 'ใครย้ายรถไปช่อง 404?', culprit: 3, suspectTable: 'drivers',
    image: '/images/case-02-parking-404.png',
    tables: {
      drivers: [
        { id: 1, name: 'พีท', department: 'LEGAL' },
        { id: 2, name: 'ออม', department: 'FINANCE' },
        { id: 3, name: 'พลอย', department: 'OPS' },
        { id: 4, name: 'คิม', department: 'SALES' },
        { id: 5, name: 'แพร', department: 'HR' },
        { id: 6, name: 'กันย์', department: 'IT' },
        { id: 7, name: 'ฝน', department: 'MARKETING' },
        { id: 8, name: 'โอม', department: 'PROCUREMENT' }
      ],
      vehicles: [
        { plate: 'กข-1101', driver_id: 1, color: 'BLACK' },
        { plate: 'ชว-2040', driver_id: 2, color: 'WHITE' },
        { plate: 'ดท-4404', driver_id: 3, color: 'RED' },
        { plate: 'นก-7732', driver_id: 4, color: 'SILVER' },
        { plate: 'บม-9014', driver_id: 5, color: 'WHITE' },
        { plate: 'รย-6621', driver_id: 6, color: 'BLUE' },
        { plate: 'สล-3088', driver_id: 7, color: 'BLACK' },
        { plate: 'อจ-5510', driver_id: 8, color: 'GRAY' }
      ],
      gate_logs: [
        { plate: 'กข-1101', time: '17:42', gate: 'A' },
        { plate: 'ดท-4404', time: '18:07', gate: 'B' },
        { plate: 'ชว-2040', time: '18:20', gate: 'A' },
        { plate: 'นก-7732', time: '17:51', gate: 'B' },
        { plate: 'บม-9014', time: '18:03', gate: 'A' },
        { plate: 'รย-6621', time: '18:11', gate: 'C' },
        { plate: 'สล-3088', time: '18:16', gate: 'B' },
        { plate: 'อจ-5510', time: '18:29', gate: 'C' },
        { plate: 'กข-1101', time: '19:02', gate: 'A' }
      ],
      permits: [
        { driver_id: 1, status: 'VALID', slot: '110' },
        { driver_id: 2, status: 'VALID', slot: '204' },
        { driver_id: 3, status: 'EXPIRED', slot: '404' },
        { driver_id: 4, status: 'EXPIRED', slot: '732' },
        { driver_id: 5, status: 'VALID', slot: '014' },
        { driver_id: 6, status: 'SUSPENDED', slot: '621' },
        { driver_id: 7, status: 'VALID', slot: '088' },
        { driver_id: 8, status: 'EXPIRED', slot: '510' }
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
      ['vehicles', 'จับคู่รถกับคนขับ', 'JOIN ทะเบียนรถกลับไปหาเจ้าของ', 'VEHICLE MATCH', 'รถทะเบียน ดท-4404 เป็นของพลอย', ['drivers', 'vehicles']],
      ['gate_logs', 'สร้างไทม์ไลน์', 'JOIN รถกับ log ไม้กั้น', 'GATE TIMELINE', 'รถของพลอยผ่าน Gate B เวลา 18:07', ['vehicles', 'gate_logs']],
      ['permits', 'ตรวจใบอนุญาต', 'JOIN คนขับกับสิทธิ์ช่อง 404', 'PERMIT ALERT', 'ใบอนุญาตของพลอยหมดอายุและระบุช่อง 404', ['drivers', 'permits']]
    ],
    hints: ['ทะเบียนรถเชื่อม vehicles กับ gate_logs', 'ใบอนุญาตหมดอายุมีมากกว่าหนึ่งใบ ต้องกรอง slot เพิ่ม', 'driver_id เชื่อม drivers, vehicles และ permits เข้าด้วยกัน'],
    tip: 'ข้อความต้องใส่ในเครื่องหมาย single quote',
    starter: 'SELECT *\nFROM gate_logs\nORDER BY time ASC;'
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
        { id: 3, name: 'ธีร์', team: 'AUDIT', device_id: 'PC-33' },
        { id: 4, name: 'นที', team: 'FINANCE', device_id: 'PC-44' },
        { id: 5, name: 'สร', team: 'HR', device_id: 'PC-55' },
        { id: 6, name: 'ขวัญ', team: 'PAYROLL', device_id: 'PC-66' },
        { id: 7, name: 'เจต', team: 'IT', device_id: 'PC-77' },
        { id: 8, name: 'มุก', team: 'AUDIT', device_id: 'PC-88' },
        { id: 9, name: 'ภพ', team: 'FINANCE', device_id: 'PC-99' },
        { id: 10, name: 'จิน', team: 'LEGAL', device_id: 'PC-10' }
      ],
      payroll: [
        { payment_id: 51, employee_id: 1, amount: 42000, status: 'PAID' },
        { payment_id: 52, employee_id: 2, amount: 48000, status: 'PAID' },
        { payment_id: 53, employee_id: 999, amount: 48000, status: 'FLAGGED' },
        { payment_id: 54, employee_id: 3, amount: 55000, status: 'PAID' },
        { payment_id: 55, employee_id: 4, amount: 46500, status: 'PAID' },
        { payment_id: 56, employee_id: 5, amount: 41000, status: 'PAID' },
        { payment_id: 57, employee_id: 6, amount: 48000, status: 'REVIEW' },
        { payment_id: 58, employee_id: 7, amount: 52000, status: 'PAID' },
        { payment_id: 59, employee_id: 8, amount: 55000, status: 'PAID' },
        { payment_id: 60, employee_id: 404, amount: 32000, status: 'REJECTED' },
        { payment_id: 61, employee_id: 9, amount: 46500, status: 'PAID' },
        { payment_id: 62, employee_id: 10, amount: 60000, status: 'PAID' }
      ],
      devices: [
        { event_id: 71, device_id: 'PC-22', time: '02:14', action: 'CREATE EMPLOYEE 999' },
        { event_id: 72, device_id: 'PC-33', time: '09:02', action: 'READ AUDIT' },
        { event_id: 73, device_id: 'PC-11', time: '08:31', action: 'UPDATE PROFILE 5' },
        { event_id: 74, device_id: 'PC-66', time: '02:08', action: 'EXPORT PAYROLL' },
        { event_id: 75, device_id: 'PC-77', time: '01:55', action: 'SYSTEM PATCH' },
        { event_id: 76, device_id: 'PC-44', time: '10:17', action: 'APPROVE BUDGET' },
        { event_id: 77, device_id: 'PC-88', time: '09:11', action: 'READ AUDIT' },
        { event_id: 78, device_id: 'PC-99', time: '14:22', action: 'EXPORT REPORT' },
        { event_id: 79, device_id: 'PC-10', time: '16:05', action: 'READ CONTRACT' },
        { event_id: 80, device_id: 'PC-22', time: '02:16', action: 'DELETE AUDIT EVENT' }
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
      ['payroll', 'หาเงินโอนผิดปกติ', 'กรอง FLAGGED เพื่อหารหัสพนักงานผี', 'PAYROLL ANOMALY', 'พบเงิน 48,000 บาทโอนไป employee_id 999'],
      ['devices', 'ตามรอยอุปกรณ์', 'กรอง log ที่สร้าง employee 999', 'DEVICE TRACE', 'PC-22 สร้าง employee 999 เวลา 02:14'],
      ['employees', 'ระบุเจ้าของเครื่อง', 'JOIN device_id กลับไปหาพนักงาน', 'IDENTITY MATCH', 'PC-22 เป็นเครื่องของอรุณ ฝ่าย PAYROLL', ['employees', 'devices']]
    ],
    hints: ['เริ่มจากรายการ payroll ที่สถานะผิดปกติ', 'action ใน devices บอกว่ามีการสร้างรหัสใดจากเครื่องไหน', 'device_id เชื่อม log กลับไปหาเจ้าของเครื่อง'],
    tip: 'JOIN ช่วยเชื่อมหลักฐานจากคนละตาราง',
    starter: 'SELECT *\nFROM payroll\nORDER BY payment_id ASC;'
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
        { id: 4, name: 'ลลิตา พราว', role: 'Product Lead', alibi: 'งานเลี้ยงบริษัท', risk: 'MEDIUM' },
        { id: 5, name: 'วิชญ์ ทองดี', role: 'DevOps', alibi: 'เฝ้าระบบจากบ้าน', risk: 'MEDIUM' },
        { id: 6, name: 'นารา จิตร', role: 'QA Lead', alibi: 'ทดสอบระบบชั้น 12', risk: 'LOW' },
        { id: 7, name: 'ปกรณ์ เมธา', role: 'Network Engineer', alibi: 'ซ่อมวงจรสำรอง', risk: 'HIGH' },
        { id: 8, name: 'ศศิ วงศ์', role: 'HR Director', alibi: 'เดินทางต่างจังหวัด', risk: 'LOW' }
      ],
      access_logs: [
        { log_id: 201, suspect_id: 3, room: 'SERVER-A', time: '23:41', action: 'EXIT', status: 'VALID' },
        { log_id: 202, suspect_id: 2, room: 'SERVER-A', time: '00:38', action: 'ENTRY', status: 'OVERRIDE' },
        { log_id: 203, suspect_id: 2, room: 'SERVER-A', time: '01:12', action: 'EXIT', status: 'LOG DELETED' },
        { log_id: 204, suspect_id: 5, room: 'SERVER-B', time: '00:22', action: 'ENTRY', status: 'VALID' },
        { log_id: 205, suspect_id: 5, room: 'SERVER-B', time: '00:49', action: 'EXIT', status: 'VALID' },
        { log_id: 206, suspect_id: 7, room: 'NETWORK', time: '00:31', action: 'ENTRY', status: 'OVERRIDE' },
        { log_id: 207, suspect_id: 7, room: 'NETWORK', time: '01:20', action: 'EXIT', status: 'VALID' },
        { log_id: 208, suspect_id: 6, room: 'LAB-12', time: '23:55', action: 'ENTRY', status: 'VALID' },
        { log_id: 209, suspect_id: 1, room: 'EXEC-01', time: '00:05', action: 'ENTRY', status: 'REMOTE' },
        { log_id: 210, suspect_id: 4, room: 'LOBBY', time: '22:44', action: 'EXIT', status: 'VALID' }
      ],
      messages: [
        { msg_id: 81, suspect_id: 1, time: '19:12', content: 'พรุ่งนี้คุยเรื่อง audit กัน', deleted: 'NO' },
        { msg_id: 82, suspect_id: 2, time: '22:58', content: 'ถ้าเขาเปิดเผยเรื่อง backdoor เราจบแน่', deleted: 'YES' },
        { msg_id: 83, suspect_id: 5, time: '21:10', content: 'deploy เสร็จแล้ว กำลังกลับ', deleted: 'NO' },
        { msg_id: 84, suspect_id: 7, time: '23:48', content: 'วงจรสำรองยังมีปัญหา', deleted: 'NO' },
        { msg_id: 85, suspect_id: 4, time: '20:02', content: 'เจอกันที่งานเลี้ยง', deleted: 'NO' },
        { msg_id: 86, suspect_id: 1, time: '23:31', content: 'ปิด audit ชั่วคราวก่อน', deleted: 'YES' },
        { msg_id: 87, suspect_id: 6, time: '00:18', content: 'ผลทดสอบรอบสุดท้ายผ่าน', deleted: 'NO' },
        { msg_id: 88, suspect_id: 8, time: '18:40', content: 'ถึงเชียงใหม่แล้ว', deleted: 'NO' },
        { msg_id: 89, suspect_id: 3, time: '23:22', content: 'ตรวจ SERVER-A เสร็จแล้ว', deleted: 'NO' }
      ],
      inventory: [
        { item_id: 91, item: 'Fiber cable', owner_id: 3, trace: 'NONE' },
        { item_id: 92, item: 'Insulin injector', owner_id: 2, trace: 'VICTIM DNA' },
        { item_id: 93, item: 'Access dongle', owner_id: 5, trace: 'NONE' },
        { item_id: 94, item: 'Network pliers', owner_id: 7, trace: 'OWNER DNA' },
        { item_id: 95, item: 'Glass tumbler', owner_id: 1, trace: 'OWNER DNA' },
        { item_id: 96, item: 'Lab gloves', owner_id: 6, trace: 'NONE' },
        { item_id: 97, item: 'Key card', owner_id: 3, trace: 'MIXED' },
        { item_id: 98, item: 'USB drive', owner_id: 4, trace: 'NONE' },
        { item_id: 99, item: 'Medical pouch', owner_id: 8, trace: 'NONE' }
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
      ['access_logs', 'หาคนที่เข้าห้อง', 'JOIN ชื่อกับ log ของ SERVER-A ที่ผิดปกติ', 'ACCESS ANOMALY', 'บัตรของมิราเข้า SERVER-A และ exit log ถูกลบ', ['suspects', 'access_logs']],
      ['messages', 'ค้นหาแรงจูงใจ', 'JOIN เจ้าของกับข้อความที่ถูกลบ', 'DELETED MESSAGE', 'มิรากลัวว่าเหยื่อจะเปิดเผยเรื่อง backdoor', ['suspects', 'messages']],
      ['inventory', 'ระบุอาวุธ', 'JOIN เจ้าของสิ่งของกับผล DNA', 'FORENSIC MATCH', 'Injector ของมิรามี DNA ของเหยื่อ', ['suspects', 'inventory']]
    ],
    hints: ['ห้องอื่นและ OVERRIDE อื่นเป็นข้อมูลลวง กรองชื่อห้องให้ตรงคดี', 'ข้อความที่ถูกลบมีมากกว่าหนึ่งข้อความ ต้องเชื่อมกลับไปหาเจ้าของ', 'owner_id เชื่อมสิ่งของกลับไปยังผู้ต้องสงสัย'],
    tip: 'ข้อสรุปที่ดีต้องสอดคล้องกับทุกตาราง',
    starter: 'SELECT *\nFROM access_logs\nORDER BY time ASC;'
  }
];
