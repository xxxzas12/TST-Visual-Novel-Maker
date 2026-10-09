# TSTVN — TST Visual Novel Maker

**[ภาษาไทย](#-ภาษาไทย) | [English](#-english)**

> **สร้าง Visual Novel ของคุณเอง โดยไม่ต้องเขียนโค้ด**
> **Create your own visual novel without writing code.**

[![Download Latest — TSTVN v1.1.0](https://img.shields.io/badge/Download_Latest-TSTVN_v1.1.0-6d7cff?style=for-the-badge&logo=windows)](https://github.com/xxxzas12/TST-Visual-Novel-Maker/releases/latest)
[![All Releases](https://img.shields.io/badge/All_Releases-ทุกเวอร์ชัน-555?style=for-the-badge)](https://github.com/xxxzas12/TST-Visual-Novel-Maker/releases)
[![Getting Started](https://img.shields.io/badge/Getting_Started-คู่มือเริ่มต้น-2ea44f?style=for-the-badge)](docs/GETTING_STARTED.md)
[![Report a Bug](https://img.shields.io/badge/Report_a_Bug-แจ้งปัญหา-d73a49?style=for-the-badge)](https://github.com/xxxzas12/TST-Visual-Novel-Maker/issues/new?template=bug_report.yml)
[![Request a Feature](https://img.shields.io/badge/Request_a_Feature-ขอฟีเจอร์-a371f7?style=for-the-badge)](https://github.com/xxxzas12/TST-Visual-Novel-Maker/issues/new?template=feature_request.yml)

![TSTVN scene editor](docs/images/02-scene-editor.png)

---

## 🇹🇭 ภาษาไทย

### TSTVN คืออะไร

TSTVN เป็นโปรแกรมสร้างเกม **Visual Novel** สำหรับ Windows เหมาะกับเกมแนวเล่าเรื่องที่มีบทสนทนา ตัวละคร
ฉากหลัง เพลง และ **ตัวเลือกที่ทำให้เนื้อเรื่องแยกได้หลายเส้นทาง** เช่น เกมจีบ เกมสยองขวัญ เกมสืบสวน หรือเรื่องสั้นเชิงโต้ตอบ

ผู้ใช้ส่วนใหญ่สร้างเกมด้วยการเขียนสคริปต์ แต่ TSTVN สร้างเกม **ผ่านหน้าจอทั้งหมด**:

- เพิ่มบทพูด ตัวละคร ฉากหลัง และเสียงจากปุ่มและเมนู
- ลากภาพลงบนเวทีเพื่อจัดตำแหน่ง
- กด **▶ Play** เพื่อเล่นเกมที่กำลังสร้างได้ทันที

เหมาะกับมือใหม่ นักเขียน และนักวาด ที่อยากเห็นผลงานเป็นเกมโดยไม่ต้องเรียนเขียนโปรแกรมก่อน

TSTVN ยังเป็นโปรเจกต์ใหม่ จึงไม่ได้ทดแทนเอนจินที่ใช้สคริปต์ซึ่งยืดหยุ่นกว่าได้ทุกกรณี
(ดู [เทียบกับ Ren'Py](#-เทียบกับ-renpy))

### 📥 ดาวน์โหลด

| | เวอร์ชัน | ลิงก์ |
|---|---|---|
| ⭐ **แนะนำ (ล่าสุด)** | **v1.1.0** | **[ดาวน์โหลดเวอร์ชันล่าสุด](https://github.com/xxxzas12/TST-Visual-Novel-Maker/releases/latest)** — ไฟล์ `TSTVN-Setup-1.1.0.exe` |
| เวอร์ชันก่อนหน้า | v1.0.0 | [หน้า Release v1.0.0](https://github.com/xxxzas12/TST-Visual-Novel-Maker/releases/tag/V1.0.0) |
| ทุกเวอร์ชัน | | [All Releases](https://github.com/xxxzas12/TST-Visual-Novel-Maker/releases) |

v1.1.0 เป็น Release ล่าสุดที่เผยแพร่บนหน้า Releases ตอนนี้ จึงเป็นเวอร์ชันที่แนะนำ ส่วน v1.0.0 ยังดาวน์โหลดได้ตามเดิม

**วิธีติดตั้งแบบสั้น** (ทีละขั้นละเอียดอยู่ใน [คู่มือเริ่มต้นใช้งาน](docs/GETTING_STARTED.md)):

1. ดาวน์โหลด `TSTVN-Setup-1.1.0.exe` จากหน้า Releases
2. (แนะนำ) ตรวจ SHA-256 ของไฟล์ ดูหัวข้อ [ตรวจสอบไฟล์ที่ดาวน์โหลด](#-ตรวจสอบไฟล์ที่ดาวน์โหลด)
3. เปิดไฟล์ เลือก **Create Desktop shortcut** / **Create Start Menu icon** แล้วกด **Install**
4. กด **Launch TSTVN**

โปรแกรมติดตั้งแบบรายผู้ใช้ (ไม่ต้องใช้สิทธิ์ผู้ดูแลระบบ) ลงที่ `%LOCALAPPDATA%\Programs\TSTVN`
ติดตั้งทับเวอร์ชันเก่าได้ และถอนการติดตั้งได้จาก Windows Settings → Apps

> **หมายเหตุเกี่ยวกับ Windows SmartScreen**
>
> เมื่อเปิดไฟล์ติดตั้ง TSTVN Windows อาจแสดงหน้าต่าง Microsoft Defender SmartScreen แจ้งว่า *Windows protected your PC*
> เนื่องจากโปรแกรมอาจยังไม่มีชื่อเสียงหรือใบรับรองการลงนามโค้ดที่ Windows รู้จัก (ตัวติดตั้ง TSTVN ยังไม่ได้ลงนามดิจิทัล)
> ข้อความอาจแตกต่างกันตามเวอร์ชันและการตั้งค่าของ Windows
>
> หากดาวน์โหลดไฟล์จาก GitHub Releases อย่างเป็นทางการของโครงการ และตรวจสอบว่าเป็นไฟล์ที่ถูกต้องแล้ว ให้ทำตามขั้นตอนนี้:
>
> 1. คลิก **More info (ข้อมูลเพิ่มเติม)**
> 2. ตรวจสอบชื่อโปรแกรมและผู้เผยแพร่ที่แสดง หากมีข้อมูล
> 3. หากคุณเชื่อถือไฟล์และต้องการติดตั้ง ให้คลิก **Run anyway (เรียกใช้ต่อไป)**
>
> **ข้อควรระวัง:** อย่ากด Run anyway กับไฟล์ที่ไม่ทราบแหล่งที่มา หากไม่แน่ใจ ให้ยกเลิกการติดตั้งก่อน และตรวจสอบไฟล์จาก
> หน้า GitHub Releases อย่างเป็นทางการ รวมถึงค่า SHA-256 checksum ที่โครงการเผยแพร่ไว้ ทั้งนี้ checksum ช่วยตรวจสอบ
> ความตรงกันของไฟล์ แต่ไม่ได้รับประกันว่าไฟล์ปลอดภัยโดยตัวมันเอง

### 🆕 มีอะไรใหม่ใน v1.1.0

- **ออกแบบหน้าตาเกมได้เอง:** ปรับกล่องบทพูด กล่องชื่อ ปุ่มตัวเลือก และแถบเมนูบนหน้าจอตัวอย่างจริงได้
  มีโหมด **Basic** สำหรับมือใหม่ และ **Advanced** เมื่ออยากปรับละเอียด
- **กล่องข้อความสำเร็จรูป 9 แบบที่รูปทรงต่างกันจริง** และ **ปุ่มตัวเลือกสำเร็จรูป 7 แบบ**
  รวมปุ่มที่ใช้ภาพของคุณเอง
- **ตัวเลือกทำงานได้มากขึ้น:** ตั้งค่าตัวแปร เล่นเสียง ขยับตัวละคร หรือสั่นจอได้เมื่อผู้เล่นเลือก
- **แอนิเมชันของ UI** พร้อมปุ่ม ▶ ดูตัวอย่าง และ **คลังสไตล์ (Style Library)** สำหรับใช้สไตล์ซ้ำ
- **พื้นที่ทำงานปรับได้**, บันทึกอัตโนมัติ, ตัวจัดการปลั๊กอิน, แกลเลอรีในเกม, ฉาก Point & Click
  และตัวติดตั้งแบบใหม่
- แก้บั๊กหลายจุด รายละเอียดทั้งหมดอยู่ใน [Release notes v1.1.0](docs/releases/v1.1.0.md) และ [CHANGELOG](CHANGELOG.md)

### 📸 ภาพหน้าจอ

| | |
|---|---|
| ![หน้าเริ่มต้น สร้างโปรเจกต์จากเทมเพลต](docs/images/01-welcome.png) **หน้าเริ่มต้น:** ตั้งชื่อโปรเจกต์ เลือกเทมเพลต (Blank, Romance, Horror, Mystery, Comedy) แล้วกด Create Project | ![หน้าแก้ไขฉาก](docs/images/02-scene-editor.png) **แก้ไขฉาก:** เวทีแสดงผล รายการแอ็กชันของฉาก และแผงคุณสมบัติ |
| ![เมนูเพิ่มแอ็กชัน](docs/images/03-add-action-menu.png) **＋ Action:** ค้นหาและเพิ่มแอ็กชัน เช่น บทพูด ตัวเลือก Point & Click แยกตามหมวด | ![เส้นเรื่อง](docs/images/04-story-flow.png) **Story Flow:** แผนผังฉากและการเชื่อมต่อของเนื้อเรื่อง |
| ![ปรับหน้าตาเกม](docs/images/08-game-ui-themes.png) **Game UI & Themes:** ธีมสำเร็จรูป สไตล์กล่องข้อความ และหน้าจอตัวอย่างที่ลากปรับได้ | ![หน้าส่งออกเกม](docs/images/10-export.png) **Export:** เลือก Windows หรือ Web / Mobile browser โปรแกรมตรวจโปรเจกต์ให้ก่อนส่งออก |
| ![หน้าไฟล์ของโปรเจกต์](docs/images/05-assets.png) **Assets:** นำเข้าทั้งโฟลเดอร์ ระบบแยกประเภทไฟล์ให้อัตโนมัติ | ![หน้าตัวแปร](docs/images/07-variables.png) **Variables:** ตัวแปรสำหรับคะแนนความชอบ เงิน หรือเงื่อนไข |
| ![ตั้งค่าโปรเจกต์](docs/images/09-project-settings.png) **Project Settings:** ชื่อเกม ฉากเริ่มต้น ความละเอียด ภาษาของเกม ไอคอนเกม และแกลเลอรี | ![ตั้งค่าโปรแกรม](docs/images/11-application-settings.png) **Application Settings:** ภาษา ธีมมืด/สว่าง ฟอนต์ โลโก้ ปลั๊กอิน และบันทึกอัตโนมัติ |

ภาพหน้าจอทั้งหมดถ่ายจาก TSTVN v1.1.0 ของจริง ภาพเพิ่มเติมอยู่ใน [คู่มือเริ่มต้นใช้งาน](docs/GETTING_STARTED.md)

### ✨ ฟีเจอร์ (v1.1.0)

| ฟีเจอร์ | ทำอะไรได้ | ข้อจำกัด |
|---|---|---|
| ฉากและบทพูด | บทพูด คำบรรยาย ตัวละครพร้อมสีหน้า ฉากหลัง CG เพลง เสียงประกอบ เสียงพากย์ วิดีโอ เอฟเฟกต์จอ | — |
| ตัวเลือกและตัวแปร | ตัวเลือกแยกเส้นเรื่อง เงื่อนไข ตัวแปรตัวเลข/ข้อความ/จริง-เท็จ ซ่อนหรือล็อกตัวเลือกตามเงื่อนไข | — |
| Story Flow | ดูแผนผังเนื้อเรื่อง ลากเชื่อมฉาก และแจ้งจุดเชื่อมต่อที่เสีย | จุดเชื่อมที่เสียแสดงเป็นรายการ ไม่ได้แสดงเป็นลูกศร |
| ออกแบบ UI ของเกม | กล่องข้อความ 9 แบบ ปุ่มตัวเลือก 7 แบบ ภาพกรอบของคุณเอง แสงเรือง ไล่สี เส้นขอบตัวอักษร ดูตัวอย่างหลายขนาดจอ | ภาพกรอบไม่รองรับมุมโค้ง |
| แอนิเมชัน UI | กล่องข้อความปรากฏ/หายไป ข้อความแสดงทีละตัว/ทีละคำ ตัวเลือกปรากฏทีละปุ่ม พร้อม ▶ ดูตัวอย่าง | — |
| คลังสไตล์ | บันทึกสไตล์กล่องข้อความและตัวเลือกไว้ใช้ซ้ำ แก้ครั้งเดียวทุกธีมที่ใช้เปลี่ยนตาม | ใช้ได้ภายในโปรเจกต์เดียว ข้ามโปรเจกต์ให้ใช้ไฟล์ `.tsttheme` |
| พื้นที่ทำงาน | ปรับขนาด พับ ซ่อนแผงได้ มีชุดเลย์เอาต์สำเร็จรูป และจำเลย์เอาต์ไว้ | ใช้กับหน้าแก้ไขฉาก |
| บันทึกและสำรอง | บันทึกอัตโนมัติ (ค่าเริ่มต้นทุก 2 นาทีหลังมีการแก้ไข) กู้คืนเมื่อโปรแกรมปิดผิดปกติ และสำรองข้อมูล | — |
| ปลั๊กอิน | ติดตั้ง/เปิด/ปิด/ลบปลั๊กอินที่เพิ่มธีมและชุดแอ็กชัน | ปลั๊กอินเป็นชุดเนื้อหา ไม่รันโค้ด |
| แกลเลอรีในเกม | หน้า CG ตัวละคร เพลง ฉากจบ ปลดล็อกเมื่อผู้เล่นเห็นในเกม | เงื่อนไขปลดล็อกมีแค่ "เห็นแล้ว" และ "ปลดล็อกเสมอ" |
| Point & Click | ฉากที่ให้คลิกวัตถุบนเวที แต่ละวัตถุพาไปฉากอื่นหรือตั้งค่าตัวแปรได้ | — |
| ภาษา | หน้าจอโปรแกรมเป็นภาษาไทยหรืออังกฤษ เมนูในเกมเลือกภาษาได้ | — |

### 📦 ส่งออกและเผยแพร่เกม

ไปที่ **Export** แล้วเลือกรูปแบบ:

- **Windows:** ได้โฟลเดอร์ `<ชื่อเกม>-Windows` ที่มี `<ชื่อเกม>.exe` และไฟล์ประกอบ (ประมาณ 370 MB)
  ผู้เล่นไม่ต้องติดตั้งอะไรเพิ่ม เวลาส่งให้คนอื่นให้บีบอัด **ทั้งโฟลเดอร์** เป็น .zip
- **Web / Mobile browser:** ได้โฟลเดอร์ `<ชื่อเกม>-Web` ที่มี `index.html` เปิดในเบราว์เซอร์ หรืออัปโหลดทั้งโฟลเดอร์ขึ้นเว็บโฮสต์
  ใช้กับเบราว์เซอร์บนคอมพิวเตอร์และมือถือได้

ก่อนส่งออก โปรแกรมตรวจโปรเจกต์ให้ ถ้ายังมีข้อผิดพลาด (⛔) จะส่งออกไม่ได้จนกว่าจะแก้ ส่วนคำเตือน (⚠️) ส่งออกได้
TSTVN ส่งออกแอปมือถือ (Android/iOS) หรือ macOS/Linux โดยตรงไม่ได้

### 🆚 เทียบกับ Ren'Py

[Ren'Py](https://www.renpy.org/) เป็นเอนจิน Visual Novel ฟรีและโอเพนซอร์สที่ใช้กันแพร่หลายที่สุด มีระบบสคริปต์ที่สมบูรณ์
และระบบนิเวศที่เติบโตมานาน ทั้งสองโปรแกรมฟรี แต่ออกแบบมาสำหรับคนต่างกลุ่ม

| | **TSTVN** | **Ren'Py** |
|---|---|---|
| วิธีสร้างเกม | หน้าจอ เมนู และลากวาง ดูผลทันที | เขียนสคริปต์ด้วยภาษาของ Ren'Py (ต่อยอดจาก Python) |
| ต้องเขียนโค้ดไหม | ปกติไม่ต้อง | ปกติต้องเขียนสคริปต์ |
| แก้ไขแบบเห็นภาพ | มีแผงแก้ไขฉากและหน้าออกแบบ UI | เน้นแก้ไขผ่านไฟล์สคริปต์ |
| ปรับแต่งบทพูดและตัวเลือก | ผ่านสไตล์สำเร็จรูปและการตั้งค่า | ผ่านโค้ด ยืดหยุ่นกว่ามาก |
| ความยืดหยุ่นขั้นสูง | จำกัดเท่าที่หน้าจอมีให้ | สูงมาก เพราะใช้ Python ได้ |
| แพลตฟอร์มที่ส่งออก | Windows, Web | Windows, macOS, Linux, Android, iOS, Web (ตามเอกสารของ Ren'Py) |
| ส่วนขยาย | ปลั๊กอินแบบชุดเนื้อหา (ธีม, ชุดแอ็กชัน) | ขยายด้วยโค้ด Python ได้ |
| เอกสารและชุมชน | โปรเจกต์ใหม่ เอกสารและผู้ใช้ยังน้อย | พัฒนามาหลายปี เอกสารครบ ชุมชนใหญ่ มีเกมที่วางขายจริงจำนวนมาก |
| เหมาะกับ | มือใหม่ นักเขียน นักวาด และคนที่อยากทำต้นแบบเร็ว ๆ บน Windows | คนที่พร้อมเขียนสคริปต์ และต้องการความยืดหยุ่นหรือหลายแพลตฟอร์ม |

**สรุป:** ถ้าอยากเริ่มสร้างเกมทันทีโดยไม่เขียนโค้ด และพอใจกับการส่งออกเป็น Windows หรือเว็บ ลองใช้ TSTVN ได้
ถ้าต้องการปรับแต่งได้ทุกจุด ส่งออกหลายแพลตฟอร์ม หรือทำโปรเจกต์ใหญ่ที่ต้องพึ่งชุมชน Ren'Py เหมาะกว่า

### 💻 ความต้องการของระบบ

| รายการ | รายละเอียด |
|---|---|
| ระบบปฏิบัติการ | Windows 10 หรือ 11 แบบ 64 บิต (x64) |
| พื้นที่ดิสก์ | ไฟล์ติดตั้งประมาณ 112 MB และติดตั้งแล้วประมาณ 370 MB (วัดจาก v1.1.0) เกมที่ส่งออกแบบ Windows ใช้ประมาณ 370 MB ต่อเกม |
| RAM | ยังไม่ได้ทดสอบหาค่าขั้นต่ำ |
| Node.js / เครื่องมือเขียนโปรแกรม | **ไม่ต้องใช้** |
| อินเทอร์เน็ต | ใช้แค่ตอนดาวน์โหลด โปรแกรมทำงานแบบออฟไลน์ |
| macOS / Linux | ยังไม่รองรับ |

### 🔐 ตรวจสอบไฟล์ที่ดาวน์โหลด

1. ดาวน์โหลดจาก [หน้า Releases ของโครงการนี้](https://github.com/xxxzas12/TST-Visual-Novel-Maker/releases) เท่านั้น
2. เปิด PowerShell ในโฟลเดอร์ที่มีไฟล์ แล้วพิมพ์

   ```powershell
   Get-FileHash .\TSTVN-Setup-1.1.0.exe -Algorithm SHA256
   ```
3. ค่าที่ได้ต้องตรงกับค่าใน [Release notes v1.1.0](https://github.com/xxxzas12/TST-Visual-Novel-Maker/releases/tag/v1.1.0):
   `77C5897358B806A24D5483093E3F02FE83DB67319D01E7DA1917F7ED4FB39C76`

ถ้าไม่ตรง ห้ามเปิดไฟล์ ให้ลบแล้วดาวน์โหลดใหม่จากหน้า Releases checksum ยืนยันได้แค่ว่าไฟล์ตรงกับที่โครงการเผยแพร่
ไม่ได้รับประกันความปลอดภัยด้วยตัวมันเอง

### ⚠️ ข้อจำกัดที่ควรรู้

- **ไม่ได้ลงนามดิจิทัล:** ทั้งตัวติดตั้ง ตัวโปรแกรม และไฟล์ `.exe` ของเกมที่ส่งออก ยังไม่ได้ลงนามดิจิทัล
  ผู้เล่นเกมของคุณจึงอาจเห็นคำเตือน SmartScreen ได้เช่นกัน
- **ไอคอนไฟล์เกม:** ไอคอนของไฟล์ `.exe` เกมที่ส่งออกใน Explorer ยังเป็นของ Electron
  ส่วนหน้าต่างเกมและแถบงานใช้ไอคอนเกมแล้ว
- **การทดสอบตัวติดตั้ง:** ทดสอบบนเครื่องจริงหลังถอนการติดตั้งจนหมด ยังไม่ได้ทดสอบบนเครื่องเสมือนที่ติดตั้ง Windows ใหม่
- รายการทั้งหมดอยู่ใน [KNOWN_ISSUES.md](KNOWN_ISSUES.md)

### 📚 เอกสารและช่องทางติดต่อ

- [คู่มือเริ่มต้นใช้งาน (ติดตั้ง → สร้างเกม → ส่งออก)](docs/GETTING_STARTED.md)
- [Release notes v1.1.0](docs/releases/v1.1.0.md) · [CHANGELOG](CHANGELOG.md) · [ประวัติเวอร์ชัน](docs/VERSION_HISTORY.md) · [ปัญหาที่ทราบแล้ว](KNOWN_ISSUES.md)
- [คู่มือสำหรับนักพัฒนา (build จากซอร์สโค้ด, ทดสอบ, ออก Release)](docs/GUIDE.md) · [รูปแบบปลั๊กอิน](plugins/README.md)
- พบปัญหา → [แจ้งบั๊ก](https://github.com/xxxzas12/TST-Visual-Novel-Maker/issues/new?template=bug_report.yml) ·
  อยากได้ฟีเจอร์ → [ขอฟีเจอร์](https://github.com/xxxzas12/TST-Visual-Novel-Maker/issues/new?template=feature_request.yml) ·
  [ดู Issues ทั้งหมด](https://github.com/xxxzas12/TST-Visual-Novel-Maker/issues)

### 📋 แผนการพัฒนา

- [x] โปรแกรมสร้าง Visual Novel ระบบฉาก บทพูด ตัวละคร และตัวเลือก
- [x] โหมดมืด / สว่าง หลายภาษา และเปลี่ยนฟอนต์ได้
- [x] ตัวติดตั้ง Windows
- [x] ออกแบบ UI ของเกม แอนิเมชัน และคลังสไตล์ (v1.1.0)
- [x] ระบบปลั๊กอินแบบชุดเนื้อหา (v1.1.0)
- [ ] ตลาดปลั๊กอินสำหรับชุมชน
- [ ] ส่งออกได้หลายรูปแบบขึ้น
- [ ] ตัวเลือกปรับแต่งเพิ่มเติม

### ❤️ สนับสนุนโปรเจกต์

ถ้าชอบ TSTVN และอยากสนับสนุนการพัฒนา: ☕ [Buy Me a Coffee](https://buymeacoffee.com/xxxzas12p)

ทุกการสนับสนุนช่วยให้ผมพัฒนาฟีเจอร์ใหม่ ๆ และปรับปรุง TSTVN ต่อไปได้ ❤️
ถ้าคุณสร้างเกมด้วย TSTVN แบ่งปันกับชุมชนได้เลย

---

## 🇬🇧 English

### What is TSTVN?

TSTVN is a **visual novel** maker for Windows. It is made for story-driven games with dialogue, characters,
backgrounds, music and **choices that branch the story**, such as romance, horror, mystery or short
interactive stories.

Most visual novel tools are built around writing scripts. TSTVN is built around **visual editing**:

- add dialogue, characters, backgrounds and sounds from buttons and menus;
- drag pictures onto a stage to place them;
- press **▶ Play** to try the game immediately.

It is meant for beginners, writers and artists who want to make a game without learning to program first.
TSTVN is a young project and not a replacement for more flexible script-based engines in every case (see
[TSTVN vs Ren'Py](#-tstvn-vs-renpy)).

### 📥 Download

| | Version | Link |
|---|---|---|
| ⭐ **Recommended (latest)** | **v1.1.0** | **[Download Latest](https://github.com/xxxzas12/TST-Visual-Novel-Maker/releases/latest)**, file `TSTVN-Setup-1.1.0.exe` |
| Previous | v1.0.0 | [v1.0.0 release page](https://github.com/xxxzas12/TST-Visual-Novel-Maker/releases/tag/V1.0.0) |
| All versions | | [All Releases](https://github.com/xxxzas12/TST-Visual-Novel-Maker/releases) |

v1.1.0 is the latest published release, so it is the recommended version. v1.0.0 remains available.

**Quick install** (step by step in the [Getting Started guide](docs/GETTING_STARTED.md#english)):

1. Download `TSTVN-Setup-1.1.0.exe` from the Releases page.
2. (Recommended) Verify the file's SHA-256 (see [Verify your download](#-verify-your-download)).
3. Run it, choose **Create Desktop shortcut** / **Create Start Menu icon**, and click **Install**.
4. Click **Launch TSTVN**.

It installs for the current user, so no administrator rights are needed, into
`%LOCALAPPDATA%\Programs\TSTVN`. It upgrades older versions in place and can be removed from Windows
Settings → Apps.

> **Note about Windows SmartScreen**
>
> When you open the TSTVN installer, Microsoft Defender SmartScreen may display a “Windows protected your PC”
> warning if the application has limited reputation or does not have a code-signing certificate recognized by
> Windows. The TSTVN installer is not code-signed yet. The exact wording can differ between Windows versions and
> settings.
>
> If you downloaded the installer from the project's official GitHub Releases page and have verified that it is
> the expected file:
>
> 1. Click **More info**.
> 2. Check the application name and publisher information, if available.
> 3. If you trust the file and want to proceed, click **Run anyway**.
>
> **Warning:** Never bypass SmartScreen for files from unknown sources. If you are unsure, cancel the installation
> and verify the installer using the official GitHub Releases page and the published SHA-256 checksum. A matching
> checksum confirms file integrity against the published value, but does not by itself guarantee that the file is
> safe.

### 🆕 What's New in v1.1.0

- **Design your game's UI:** style the dialogue box, name box, choice buttons and menu bar on a live preview,
  with **Basic** settings for beginners and **Advanced** for every detail.
- **9 textbox presets with genuinely different shapes** and **7 choice-button presets**, including image buttons.
- **Choices can do more:** set variables, play a sound, animate a character or shake the screen when picked.
- **UI animations** with ▶ Preview, and a **Style Library** to reuse your styles.
- **Flexible workspace**, autosave, a Plugin Manager, an in-game gallery, Point & Click scenes, and a new
  installer.
- Many bug fixes. The full list is in the [v1.1.0 release notes](docs/releases/v1.1.0.md) and the
  [CHANGELOG](CHANGELOG.md).

### 📸 Screenshots

| | |
|---|---|
| ![Welcome screen with project templates](docs/images/01-welcome.png) **Welcome:** name your project, pick a template (Blank, Romance, Horror, Mystery, Comedy) and click Create Project. | ![Scene editor](docs/images/02-scene-editor.png) **Scene editor:** the stage, the scene's action list and the properties panel. |
| ![Add action menu](docs/images/03-add-action-menu.png) **＋ Action:** search and add actions (dialogue, choice, Point & Click…) by category. | ![Story Flow](docs/images/04-story-flow.png) **Story Flow:** a map of your scenes and how they connect. |
| ![Game UI and themes](docs/images/08-game-ui-themes.png) **Game UI & Themes:** theme presets, textbox styles and a live, draggable preview. | ![Export](docs/images/10-export.png) **Export:** choose Windows or Web / Mobile browser. The project is checked before export. |
| ![Assets](docs/images/05-assets.png) **Assets:** import whole folders; file types are detected automatically. | ![Variables](docs/images/07-variables.png) **Variables:** affection points, money, flags and conditions. |
| ![Project settings](docs/images/09-project-settings.png) **Project Settings:** game title, start scene, resolution, game language, game icon and gallery. | ![Application settings](docs/images/11-application-settings.png) **Application Settings:** language, dark/light, fonts, logo, plugins and autosave. |

All screenshots are of the real TSTVN v1.1.0. More are in the [Getting Started guide](docs/GETTING_STARTED.md).

### ✨ Features (v1.1.0)

| Feature | What you can do | Limitations |
|---|---|---|
| Scenes & dialogue | Dialogue, narration, characters with expressions, backgrounds, CGs, music, sound effects, voice, video, screen effects | — |
| Choices & variables | Branching choices, conditions, number/text/true-false variables, hide or lock options by condition | — |
| Story Flow | See the story map, drag to connect scenes, find broken connections | Broken connections are listed, not drawn as arrows |
| Game UI designer | 9 textbox presets, 7 choice presets, your own frame image, glow, gradients, text outline, previews for many screen sizes | Frame images ignore corner radius |
| UI animations | Dialogue box in/out, letter-by-letter or word-by-word text, choices one after another, with ▶ Preview | — |
| Style Library | Save textbox and choice styles and reuse them; edit once, every linked theme updates | Per project; use a `.tsttheme` file to move styles between projects |
| Workspace | Resize, fold and hide panels; layout presets; layout is remembered | Applies to the scene editor |
| Save & backup | Autosave (default: 2 minutes after a change), crash recovery, backups | — |
| Plugins | Install, enable/disable and remove plugins that add themes and action templates | Content packs only, no code runs |
| In-game gallery | CG, Characters, Music and Endings pages that unlock as players see them | Unlock rules: "when seen" or "always" |
| Point & Click | Scenes with clickable objects on the stage, each going to a scene or setting a variable | — |
| Languages | Editor in Thai or English; in-game menus in either language | — |

### 📦 Export and share your game

Open **Export** and choose a target:

- **Windows:** creates a `<Game>-Windows` folder with `<Game>.exe` and its runtime files (about 370 MB).
  Players don't need to install anything. Share it by zipping **the whole folder**.
- **Web / Mobile browser:** creates a `<Game>-Web` folder with `index.html`. Open it in a browser, or upload the
  whole folder to a web host. It works in desktop and mobile browsers.

TSTVN checks the project first. Errors (⛔) must be fixed before export; warnings (⚠️) don't block it.
TSTVN does not export native Android/iOS apps or macOS/Linux builds.

### 🆚 TSTVN vs Ren'Py

[Ren'Py](https://www.renpy.org/) is the best-known free and open-source visual novel engine. It has a mature
scripting system and a large, long-established ecosystem. Both tools are free, but they suit different people.

| | **TSTVN** | **Ren'Py** |
|---|---|---|
| Primary workflow | Visual editor: menus, drag & drop, instant preview | Writing scripts in Ren'Py's own language (built on Python) |
| Coding normally required | No | Yes, scripting |
| Visual editing | Scene editor and visual UI designer | Mainly edited through script files |
| Dialogue & choice customization | Presets and settings | Code, far more flexible |
| Advanced scripting flexibility | Limited to what the editor offers | Very high (Python available) |
| Export platforms | Windows, Web | Windows, macOS, Linux, Android, iOS, Web (per Ren'Py's documentation) |
| Extensibility | Content-pack plugins (themes, action templates) | Extensible with Python code |
| Documentation & community | New project; small documentation and user base | Developed for many years; extensive docs, large community, many published games |
| Best fit | Beginners, writers and artists; quick prototypes on Windows | Creators comfortable with scripting who need flexibility or many platforms |

**In short:** choose TSTVN to start making a game right away without code, if Windows or Web export is
enough. Choose Ren'Py for full control, more platforms, or larger projects that benefit from its community.

### 💻 System requirements

| | |
|---|---|
| Operating system | Windows 10 or 11, 64-bit (x64) |
| Disk space | Installer about 112 MB; about 370 MB installed (measured, v1.1.0); each Windows game export about 370 MB |
| RAM | No minimum has been measured |
| Node.js / developer tools | **Not needed** |
| Internet | Only to download. TSTVN works offline |
| macOS / Linux | Not supported |

### 🔐 Verify your download

1. Download only from [this project's Releases page](https://github.com/xxxzas12/TST-Visual-Novel-Maker/releases).
2. Open PowerShell in the download folder and run:

   ```powershell
   Get-FileHash .\TSTVN-Setup-1.1.0.exe -Algorithm SHA256
   ```
3. The result must match the value in the [v1.1.0 release notes](https://github.com/xxxzas12/TST-Visual-Novel-Maker/releases/tag/v1.1.0):
   `77C5897358B806A24D5483093E3F02FE83DB67319D01E7DA1917F7ED4FB39C76`

If it doesn't match, don't run the file. Delete it and download it again from the Releases page. A
checksum only proves the file matches what the project published; it does not by itself prove the file is
safe.

### ⚠️ Known limitations

- **Not code-signed:** the installer, the TSTVN app and exported game `.exe` files are not code-signed yet, so
  your players may also see a SmartScreen warning.
- **Game file icon:** an exported game's `.exe` file icon in Explorer is still Electron's. The game window and
  taskbar use your game icon.
- **Installer testing:** the installer was tested on a real PC after a full uninstall, not on a freshly installed
  virtual machine.
- Full list: [KNOWN_ISSUES.md](KNOWN_ISSUES.md).

### 📚 Documentation & help

- [Getting Started (install → make a game → export)](docs/GETTING_STARTED.md#english)
- [v1.1.0 release notes](docs/releases/v1.1.0.md) · [CHANGELOG](CHANGELOG.md) · [Version history](docs/VERSION_HISTORY.md) · [Known issues](KNOWN_ISSUES.md)
- [Developer guide (build from source, tests, releasing)](docs/GUIDE.md) · [Plugin format](plugins/README.md)
- Found a problem? [Report a bug](https://github.com/xxxzas12/TST-Visual-Novel-Maker/issues/new?template=bug_report.yml) ·
  Have an idea? [Request a feature](https://github.com/xxxzas12/TST-Visual-Novel-Maker/issues/new?template=feature_request.yml) ·
  [All issues](https://github.com/xxxzas12/TST-Visual-Novel-Maker/issues)

### 📋 Roadmap

- [x] Visual novel editor: scenes, dialogue, characters, choices
- [x] Dark / Light mode, multiple languages, custom fonts
- [x] Windows installer
- [x] Game UI designer, animations and Style Library (v1.1.0)
- [x] Content-pack plugin system (v1.1.0)
- [ ] Community plugin marketplace
- [ ] More export options
- [ ] More customization options

### ❤️ Support TSTVN

If you enjoy TSTVN and want to support its development: ☕ [Buy Me a Coffee](https://buymeacoffee.com/xxxzas12p)

Your support helps me keep developing new features and improving TSTVN. If you make something with TSTVN,
share it with the community!

---

## 📄 License | สัญญาอนุญาต

TSTVN is released under the [MIT License](LICENSE). · TSTVN เผยแพร่ภายใต้ [สัญญาอนุญาต MIT](LICENSE)

**TSTVN — Tash so trust** · Made with ❤️ for visual novel creators · สร้างขึ้นด้วย ❤️ สำหรับคนที่อยากสร้าง Visual Novel
