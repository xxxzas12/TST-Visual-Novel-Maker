// Player-facing strings of the game runtime (kept separate from the editor dictionary
// so exported games stay small). English text is the key.
const TH: Record<string, string> = {
  Auto: 'อัตโนมัติ',
  Save: 'บันทึก',
  Load: 'โหลด',
  Hide: 'ซ่อน',
  Start: 'เริ่มเกม',
  Continue: 'เล่นต่อ',
  Settings: 'ตั้งค่า',
  Quit: 'ออก',
  Menu: 'เมนู',
  Resume: 'เล่นต่อ',
  'Hide UI': 'ซ่อนหน้าจอ UI',
  'Show UI': 'แสดงหน้าจอ UI',
  'Return to Title': 'กลับหน้าแรก',
  'Quit Game': 'ออกจากเกม',
  'Save Game': 'บันทึกเกม',
  'Load Game': 'โหลดเกม',
  Back: 'ย้อนกลับ',
  'Auto Save': 'บันทึกอัตโนมัติ',
  'Slot {n}': 'ช่อง {n}',
  Empty: 'ว่าง',
  'Overwrite {label}?': 'บันทึกทับ {label} หรือไม่?',
  Yes: 'ใช่',
  No: 'ไม่',
  'Game saved': 'บันทึกเกมแล้ว',
  'Could not save (storage full?)': 'บันทึกไม่สำเร็จ (พื้นที่เต็ม?)',
  'Game loaded': 'โหลดเกมแล้ว',
  'Auto mode ON': 'โหมดอัตโนมัติ: เปิด',
  'Auto mode OFF': 'โหมดอัตโนมัติ: ปิด',
  'Text speed': 'ความเร็วข้อความ',
  'Auto speed': 'ความเร็วโหมดอัตโนมัติ',
  'Master volume': 'ระดับเสียงรวม',
  Music: 'เพลง',
  'Sound effects': 'เสียงประกอบ',
  Voice: 'เสียงพากย์',
  Display: 'การแสดงผล',
  Windowed: 'หน้าต่าง',
  Fullscreen: 'เต็มจอ',
  Borderless: 'ไร้ขอบ',
  'Auto-hide buttons when idle': 'ซ่อนปุ่มอัตโนมัติเมื่อไม่ได้ใช้งาน',
  'Something went wrong': 'เกิดข้อผิดพลาด',
  'Play Again': 'เล่นอีกครั้ง',
  'Return to the title screen? Unsaved progress will be lost.': 'กลับหน้าแรกหรือไม่? ความคืบหน้าที่ยังไม่บันทึกจะหายไป',
  'Quit the game?': 'ออกจากเกมหรือไม่?',
  'Fullscreen is not available here': 'ใช้โหมดเต็มจอที่นี่ไม่ได้',
  'Missing background': 'ไม่พบภาพฉากหลัง',
  'Missing character': 'ไม่พบตัวละคร',
  'Missing image': 'ไม่พบภาพ',
  'Click to skip': 'คลิกเพื่อข้าม',
  'by {author}': 'โดย {author}',
  'The End': 'จบ',
  Close: 'ปิด',
  'Auto-advance (A)': 'เล่นอัตโนมัติ (A)',
  'Save (S)': 'บันทึก (S)',
  'Load (L)': 'โหลด (L)',
  'Hide UI (H / right-click)': 'ซ่อน UI (H / คลิกขวา)',
  'Menu (Esc)': 'เมนู (Esc)',
  'This game has no scenes to play.': 'เกมนี้ยังไม่มีฉากให้เล่น',
  Skip: 'ข้าม',
  'Skip (hold Ctrl)': 'ข้าม (กด Ctrl ค้าง)',
  'Skip ON': 'โหมดข้าม: เปิด',
  'Skip OFF': 'โหมดข้าม: ปิด',
  'Text size': 'ขนาดตัวอักษร',
  'High contrast': 'คอนทราสต์สูง',
};

export type Translate = (key: string, vars?: Record<string, string | number>) => string;

export function makeTranslator(lang: string | undefined): Translate {
  const dict = lang === 'th' ? TH : {};
  return (key, vars) => {
    let s = dict[key] ?? key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
    return s;
  };
}

export const RUNTIME_STRINGS_TH = TH;
