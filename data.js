// PM2.5 Health Region 7 — mock data
// เขตสุขภาพที่ 7: ขอนแก่น, กาฬสินธุ์, มหาสารคาม, ร้อยเอ็ด

// Heat Index endpoint (Google Apps Script) — ดึง TMD + คำนวณ + cache ฝั่ง Google
// หน้าพยากรณ์อุณหภูมิ fetch สดจาก URL นี้ (ไม่ต้อง deploy ใหม่ทุกชั่วโมง)
window.HEAT_GAS_URL = 'https://script.google.com/macros/s/AKfycbzRSl3alTqs7TojNM02-DcNPPIARBRVoffJnpPM9dkcGM2Qf9n6clh8oS2oIq3DNYA/exec';

// Behavior data endpoint (GAS) — เก็บ/แก้ไขข้อมูลพฤติกรรม + เช็ครหัสฝั่ง Google
// (ใส่ URL /exec ที่ deploy จาก behavior-gas.gs · เว้นว่าง = ซ่อนปุ่มแก้ไข)
window.BEHAVIOR_GAS_URL = 'https://script.google.com/macros/s/AKfycbzYFqEM2fA8F6VL-9mE77kUJTB9PnWPiipC1vzEjQlUzLWKo0yty4b_BWzuXP8yqQf7/exec';

window.PROVINCES = [
  { code: 'KKN', name: 'ขอนแก่น',     name_en: 'Khon Kaen',     cx: 320, cy: 240, fill: '#E8F0FE' },
  { code: 'KSN', name: 'กาฬสินธุ์',    name_en: 'Kalasin',       cx: 470, cy: 220, fill: '#FDEEE3' },
  { code: 'MKM', name: 'มหาสารคาม',  name_en: 'Maha Sarakham', cx: 410, cy: 340, fill: '#E8F5E9' },
  { code: 'RET', name: 'ร้อยเอ็ด',     name_en: 'Roi Et',        cx: 540, cy: 350, fill: '#F3E8FD' },
];

// PM2.5 Thai bands (มาตรฐาน PCD)
window.PM_BANDS = [
  { max: 15.0, label: 'ดีมาก',         color: '#7FC8F8', text: '#1E5F87' },
  { max: 25.0, label: 'ดี',            color: '#A8E6A1', text: '#2E6A2E' },
  { max: 37.5, label: 'ปานกลาง',       color: '#FFE08A', text: '#7A5A12' },
  { max: 75.0, label: 'เริ่มมีผลกระทบ', color: '#FFB07A', text: '#8A3E10' },
  { max: 999,  label: 'มีผลกระทบ',     color: '#F08585', text: '#7A1818' },
];
window.bandOf = (v) => window.PM_BANDS.find(b => v <= b.max);
// แสดงค่า PM2.5 เป็นทศนิยม 1 ตำแหน่ง เช่น 18.5, 22.0
window.fmt1 = (v) => (Math.round((parseFloat(v) || 0) * 10) / 10).toFixed(1);
// แสดงช่วงค่าแบบทศนิยม เช่น "15.1–25.0", "75.1+"
window.bandRange = (i) => {
  const b = window.PM_BANDS[i];
  if (b.max === 999) {
    const prev = window.PM_BANDS[i - 1].max;
    return (prev + 0.1).toFixed(1) + '+';
  }
  const prev = i === 0 ? 0 : window.PM_BANDS[i - 1].max + 0.1;
  return prev.toFixed(1) + '–' + b.max.toFixed(1);
};

// ===== ระดับอุณหภูมิสูงสุด (°C) — เกณฑ์เตือนภัยความร้อน =====
window.HEAT_BANDS = [
  { max: 35,  label: 'ปกติ',        color: '#A8E6A1', text: '#2E6A2E', emoji: '🙂', range: '< 35' },
  { max: 38,  label: 'เฝ้าระวัง',    color: '#7ED957', text: '#256B2E', emoji: '😊', range: '35–38' },
  { max: 40,  label: 'เตือนภัย',     color: '#FFE08A', text: '#7A5A12', emoji: '😟', range: '38–40' },
  { max: 43,  label: 'อันตราย',      color: '#FFB07A', text: '#8A3E10', emoji: '😣', range: '40–43' },
  { max: 999, label: 'อันตรายมาก',   color: '#F08585', text: '#7A1818', emoji: '🥵', range: '≥ 43' },
];
window.heatBandOf = (t) => window.HEAT_BANDS.find(b => t <= b.max) || window.HEAT_BANDS[window.HEAT_BANDS.length - 1];
// รหัสสภาพอากาศ TMD (field cond)
window.TMD_COND = {
  1: 'ท้องฟ้าแจ่มใส', 2: 'มีเมฆบางส่วน', 3: 'เมฆเป็นส่วนมาก', 4: 'มีเมฆมาก',
  5: 'ฝนตกเล็กน้อย', 6: 'ฝนปานกลาง', 7: 'ฝนตกหนัก', 8: 'ฝนฟ้าคะนอง',
  9: 'อากาศหนาวจัด', 10: 'อากาศหนาว', 11: 'อากาศเย็น', 12: 'อากาศร้อนจัด',
};
// คำแนะนำสุขภาพตามระดับดัชนีความร้อน (อ้างอิงกรมอนามัย)
window.HEAT_ADVICE = {
  general: { title: 'ประชาชนทั่วไป', levels: [
    { level: 'เฝ้าระวัง',   color: '#7ED957', items: ['ทำกิจกรรมได้ตามปกติ'] },
    { level: 'เตือนภัย',    color: '#FFE08A', items: ['ดื่มน้ำสะอาดบ่อยๆ', 'หลีกเลี่ยงทำกิจกรรมกลางแจ้ง', 'สวมหมวก แว่นกันแดด กางร่ม ทาครีมกันแดด ก่อนออกกลางแจ้ง'] },
    { level: 'อันตราย',     color: '#FFB07A', items: ['ลดระยะเวลาทำกิจกรรมกลางแจ้ง', 'สังเกตอาการตัวเอง ดูแลกลุ่มเสี่ยง หากมีอาการผิดปกติให้รีบพบแพทย์'] },
    { level: 'อันตรายมาก',  color: '#F08585', items: ['งดทำกิจกรรมกลางแจ้ง', 'พักในบ้าน/อาคารที่มีการถ่ายเทอากาศสะดวก หรือมีเครื่องปรับอากาศ', 'เลี่ยงดื่มชา กาแฟ น้ำอัดลม', 'สังเกตอาการตัวเอง ดูแลกลุ่มเสี่ยง หากมีอาการผิดปกติให้รีบพบแพทย์'] },
  ]},
  risk: { title: 'กลุ่มเสี่ยง (เด็กเล็ก ผู้สูงอายุ มีโรคประจำตัว ผู้ทำงานกลางแจ้ง)', levels: [
    { level: 'เฝ้าระวัง',   color: '#7ED957', items: ['ทำกิจกรรมได้ตามปกติ'] },
    { level: 'เตือนภัย',    color: '#FFE08A', items: ['ดื่มน้ำสะอาดบ่อยๆ', 'ลดระยะเวลาทำกิจกรรมกลางแจ้ง', 'สวมหมวก แว่นกันแดด กางร่ม ทาครีมกันแดด ก่อนออกกลางแจ้ง', 'สังเกตอาการตัวเอง หากผิดปกติให้รีบพบแพทย์'] },
    { level: 'อันตราย',     color: '#FFB07A', items: ['งดทำกิจกรรมกลางแจ้ง เวลา 11.00–15.00 น.', 'ห้ามทารก/เด็กเล็กอยู่ในรถที่จอดกลางแดด', 'ผู้มีโรคประจำตัวเตรียมยาให้พร้อม'] },
    { level: 'อันตรายมาก',  color: '#F08585', items: ['งดทำกิจกรรมกลางแจ้ง', 'พักในบ้าน/อาคารที่มีอากาศถ่ายเทสะดวก หรือมีเครื่องปรับอากาศ', 'หลีกเลี่ยงดื่มชา กาแฟ น้ำอัดลม', 'ปรับตารางการทำงานหากต้องทำงานกลางแจ้ง', 'หากมีอาการผิดปกติให้รีบพบแพทย์'] },
  ]},
};

// Air4Thai stations (representative; values μg/m³)
window.STATIONS = [
  { id: '44t', name: 'ศาลากลางจังหวัดขอนแก่น',           prov: 'KKN', amphoe: 'เมืองขอนแก่น',  lat: 16.43, lng: 102.83, pm25: 42, pm10: 68,  o3: 22, source: 'Air4Thai' },
  { id: '45t', name: 'มหาวิทยาลัยขอนแก่น',                prov: 'KKN', amphoe: 'เมืองขอนแก่น',  lat: 16.47, lng: 102.82, pm25: 38, pm10: 61,  o3: 19, source: 'Air4Thai' },
  { id: '46t', name: 'สถานีอุตุนิยมวิทยากาฬสินธุ์',         prov: 'KSN', amphoe: 'เมืองกาฬสินธุ์', lat: 16.43, lng: 103.51, pm25: 51, pm10: 79,  o3: 25, source: 'Air4Thai' },
  { id: '47t', name: 'สำนักงานสิ่งแวดล้อม ภาคที่ 10',      prov: 'MKM', amphoe: 'เมืองมหาสารคาม',lat: 16.18, lng: 103.30, pm25: 33, pm10: 55,  o3: 17, source: 'Air4Thai' },
  { id: '48t', name: 'ศาลากลางจังหวัดร้อยเอ็ด',           prov: 'RET', amphoe: 'เมืองร้อยเอ็ด',  lat: 16.05, lng: 103.65, pm25: 47, pm10: 74,  o3: 21, source: 'Air4Thai' },
  { id: '49t', name: 'สำนักงานเทศบาลเมืองบ้านไผ่',        prov: 'KKN', amphoe: 'บ้านไผ่',       lat: 16.06, lng: 102.73, pm25: 29, pm10: 49,  o3: 16, source: 'Air4Thai' },
  { id: '50t', name: 'โรงพยาบาลยางตลาด',                  prov: 'KSN', amphoe: 'ยางตลาด',      lat: 16.39, lng: 103.36, pm25: 44, pm10: 70,  o3: 20, source: 'Air4Thai' },
  { id: '51t', name: 'สำนักงานสาธารณสุขโพนทอง',           prov: 'RET', amphoe: 'โพนทอง',        lat: 16.32, lng: 104.05, pm25: 36, pm10: 58,  o3: 18, source: 'Air4Thai' },
];

// 12 months of disease incidence per 100,000 — air-pollution-related groups
window.MONTHS = ['ต.ค.68','พ.ย.68','ธ.ค.68','ม.ค.69','ก.พ.69','มี.ค.69','เม.ย.69','พ.ค.69','มิ.ย.69','ก.ค.69','ส.ค.69','ก.ย.69'];
window.DISEASES = [
  { key: 'resp',  name: 'โรคทางเดินหายใจ',         color: '#7FA8E6', values: [142,168,198,241,276,289,224,168,134,118,124,132] },
  { key: 'cvd',   name: 'โรคหัวใจและหลอดเลือด',     color: '#E69A9A', values: [ 88,102,121,144,162,171,138,108, 86, 80, 82, 88] },
  { key: 'eye',   name: 'โรคตาอักเสบ',             color: '#FFC994', values: [ 48, 58, 72, 91,103,110, 88, 64, 49, 44, 46, 50] },
  { key: 'skin',  name: 'โรคผิวหนังอักเสบ',              color: '#A6DBA6', values: [ 62, 70, 78, 89, 96,101, 87, 72, 65, 60, 62, 66] },
];

// อัตราป่วยรายจังหวัด (ราย/แสนประชากร) — ปรับจากค่าเฉลี่ยเขตด้วยตัวคูณรายจังหวัด
// ALL = ภาพรวมเขตสุขภาพที่ 7 (ใช้ค่า window.DISEASES โดยตรง)
window.DISEASE_PROV_FACTOR = { KKN: 1.12, KSN: 0.88, MKM: 0.82, RET: 0.96 };
window.DISEASE_BY_PROV = (() => {
  const out = { ALL: window.DISEASES };
  Object.keys(window.DISEASE_PROV_FACTOR).forEach((code) => {
    const f = window.DISEASE_PROV_FACTOR[code];
    out[code] = window.DISEASES.map((d) => ({
      ...d,
      values: d.values.map((v) => Math.round(v * f * 10) / 10),
    }));
  });
  return out;
})();

// 12 months PM2.5 average per province (μg/m³) — used by trend + comparison
window.PM_MONTHLY = {
  KKN: [22,30,41,55,68,74,52,32,21,18,20,24],
  KSN: [25,33,46,61,75,82,58,36,24,20,22,27],
  MKM: [20,27,38,49,60,66,46,28,19,17,18,22],
  RET: [23,31,43,57,70,77,55,34,22,19,21,25],
};
// ค่า PM2.5 เฉลี่ยรายเดือนทั้งเขต (เฉลี่ย 4 จังหวัด) — ใช้กับตัวเลือก ALL
window.PM_MONTHLY_ALL = window.MONTHS.map((_, i) => {
  const codes = ['KKN', 'KSN', 'MKM', 'RET'];
  const sum = codes.reduce((a, c) => a + (window.PM_MONTHLY[c][i] || 0), 0);
  return Math.round((sum / codes.length) * 10) / 10;
});

// ===== อัตราป่วยรายสัปดาห์ (ข้อมูลจริงจาก HDC กระทรวงสาธารณสุข · ตาราง s_pm25_1_in_week · ปีงบ 2569) =====
// 4 กลุ่มโรค: resp = ทางเดินหายใจ (diag_main 2,4) | cvd = หัวใจและหลอดเลือด (8,16)
//            eye = ตาอักเสบ (32) | skin = ผิวหนังอักเสบ (64,128)
// ค่านี้เป็น snapshot ตั้งต้น — app.jsx จะดึงสดจาก API มาอัปเดตทับเมื่อเชื่อมต่อได้
window.DISEASE_WEEKLY = {
  KKN: {
    resp: [243,1135,1174,1202,1049,1077,1162,1131,1110,939,980,1040,934,611,530,421,604,470,329,256,201,71],
    cvd:  [41,108,119,107,101,95,93,93,96,83,81,104,90,64,75,68,82,50,23,16,19,4],
    eye:  [213,641,653,711,747,752,780,743,754,770,783,823,756,751,772,591,805,618,611,567,486,153],
    skin: [140,628,689,668,697,636,739,729,695,652,622,675,754,565,480,414,525,422,320,306,308,83],
  },
  KSN: {
    resp: [131,502,551,508,525,461,472,427,443,406,420,448,411,450,425,283,429,346,192,224,174,101],
    cvd:  [10,28,26,27,16,20,32,23,19,25,29,22,25,20,17,16,24,21,11,10,7,1],
    eye:  [108,400,375,380,353,382,421,391,409,390,419,400,414,425,430,288,429,363,261,268,206,84],
    skin: [98,231,284,266,307,275,274,281,317,268,280,289,313,307,318,278,329,278,190,187,161,53],
  },
  MKM: {
    resp: [108,464,513,440,441,386,406,388,394,316,378,471,383,316,319,205,344,226,151,86,39,1],
    cvd:  [14,34,46,36,33,45,25,29,25,36,26,37,29,15,21,19,17,19,7,3,1,0],
    eye:  [86,326,326,366,352,365,351,373,345,382,409,399,403,348,337,299,364,319,294,240,129,0],
    skin: [78,236,285,265,264,321,292,301,260,295,257,301,309,281,208,179,248,162,129,134,61,0],
  },
  RET: {
    resp: [120,449,498,489,373,423,448,390,418,332,426,393,340,372,361,276,374,344,233,272,203,122],
    cvd:  [10,27,17,20,22,10,25,15,20,16,25,21,22,25,18,15,19,21,5,9,7,0],
    eye:  [138,466,480,501,515,526,533,546,555,567,633,587,585,633,570,439,616,528,534,451,484,180],
    skin: [115,369,420,380,418,396,431,408,433,468,443,449,514,500,512,401,520,411,381,364,417,181],
  },
};
// ALL = รวมทุกจังหวัดในเขตสุขภาพที่ 7 (คำนวณอัตโนมัติ)
window.DISEASE_WEEKLY.ALL = (() => {
  const codes = ['KKN', 'KSN', 'MKM', 'RET'];
  const groups = ['resp', 'cvd', 'eye', 'skin'];
  const n = window.DISEASE_WEEKLY.KKN.resp.length;
  const out = {};
  groups.forEach((g) => {
    out[g] = Array.from({ length: n }, (_, i) =>
      codes.reduce((a, c) => a + ((window.DISEASE_WEEKLY[c] && window.DISEASE_WEEKLY[c][g] && window.DISEASE_WEEKLY[c][g][i]) || 0), 0));
  });
  return out;
})();
// ป้ายกำกับสัปดาห์ (W1..Wn ตามจำนวนสัปดาห์ที่มีข้อมูล)
window.DISEASE_WEEKS = Array.from({ length: window.DISEASE_WEEKLY.KKN.resp.length }, (_, i) => 'W' + (i + 1));

// >>> PM_WEEKLY_AUTO_START (อัปเดตอัตโนมัติทุกเดือนโดย update_pm_weekly.ps1 · อย่าแก้ด้วยมือในบล็อกนี้)
// ค่าฝุ่น PM2.5 รายสัปดาห์ (ข้อมูลจริงจาก GISTDA ปี 2569 · W1-W26) · หน่วย ug/m3 · อัปเดต 2026-06-23 21:25
window.PM_WEEKLY = {
  ALL: [31.5, 27.8, 51.2, 37.4, 39.3, 30.4, 31.2, 28.8, 32.1, 28.4, 23.4, 32.3, 42.9, 43.1, 50.7, 46.8, 36.3, 26.8, 27.9, 22.4, 15.8, 18.4, 16.2, 11.5, 13.3, 17.1],
  KKN: [31.4, 27.6, 50.8, 37.8, 42, 31.2, 32.4, 31.9, 31.4, 31.2, 27.5, 31.7, 40.4, 44.6, 53.5, 49.3, 38.4, 25.5, 24.8, 20.4, 16.6, 17.9, 17, 13.8, 14.1, 17.1],
  KSN: [30.9, 28.5, 52.3, 37.6, 38, 32, 32.1, 28.9, 31.7, 28.3, 22.3, 32.8, 43.9, 45.1, 53.4, 49.7, 36.6, 27, 28.7, 22.9, 15.9, 18.7, 16.7, 11.3, 13.8, 18.3],
  MKM: [33.1, 28.4, 53, 38.9, 40.6, 30.5, 31.9, 29.1, 32.4, 28.3, 24.3, 32.2, 42.2, 41.7, 48.8, 44.5, 35.6, 27.8, 28.4, 23.3, 16.8, 18.9, 16.6, 11.8, 13.7, 17.5],
  RET: [30.4, 26.8, 48.9, 35.4, 36.5, 27.7, 28.4, 25.5, 33, 25.6, 19.4, 32.4, 45.2, 41.2, 47.1, 43.8, 34.5, 26.7, 29.9, 22.9, 14.1, 18.2, 14.6, 9.3, 11.6, 15.4],
};
// <<< PM_WEEKLY_AUTO_END

// Three sources comparison — last 12 months, regional avg
window.COMPARE = {
  Air4Thai: [22,30,41,55,68,74,52,32,21,18,20,24],
  GISDA:    [24,33,44,58,72,79,56,35,23,20,22,26],
  Dustboy:  [21,28,38,52,64,70,49,30,20,17,19,23],
};
window.SOURCE_META = {
  Air4Thai: { color: '#7FB3E6', dot: '●', detail: 'สถานีตรวจวัดภาคพื้นดิน · 60 นาที',  count: 8  },
  GISDA:    { color: '#B89AE6', dot: '▲', detail: 'ดาวเทียม · ความละเอียด 1×1 กม.',     count: 4 },
  Dustboy:  { color: '#E6A88F', dot: '■', detail: 'เซ็นเซอร์ชุมชน · 60 นาที',             count: 142 },
};

// Health behavior survey (legacy)
window.BEHAVIORS = [
  { key:'mask',  name:'สวมหน้ากาก N95 เมื่อ AQI สูง',  pct: 62, trend: +8 },
  { key:'app',   name:'ติดตามค่า PM2.5 ผ่านแอป',        pct: 48, trend:+12 },
  { key:'indoor',name:'งดกิจกรรมกลางแจ้ง',              pct: 54, trend: +5 },
  { key:'purify',name:'ใช้เครื่องฟอกอากาศในบ้าน',        pct: 21, trend: +3 },
  { key:'check', name:'ตรวจสุขภาพปอดประจำปี',           pct: 33, trend: +6 },
];

// ระดับพฤติกรรม / รายข้อ แยกตามจังหวัด · ปีงบประมาณ 2569
// ALL = รวมทั้งเขตสุขภาพที่ 7
window.BEHAVIOR_BY_PROV = {
  ALL: {
    // ภาพรวมทั้งเขตสุขภาพที่ 7 = ผลรวมจริงของ 4 จังหวัด · n = 5,767 (ดี 2781, ปานกลาง 1636, ต่ำ 1350)
    levels: [
      { level:'good',   pct: 48.22, color:'#3FAE6B', label:'พฤติกรรมระดับดี' },
      { level:'medium', pct: 28.37, color:'#F5C84A', label:'พฤติกรรมระดับปานกลาง' },
      { level:'low',    pct: 23.41, color:'#D9534F', label:'พฤติกรรมระดับต่ำ' },
    ],
    details: [
      { short:'ไม่เผาขยะ',     name:'ไม่เผาขยะ กระดาษ จุดธูป',           never: 1606, sometimes: 2793, regular: 1368 },
      { short:'สวมหน้ากาก',   name:'สวมหน้ากากอนามัย',                 never:  150, sometimes: 2340, regular: 3277 },
      { short:'ลดออกนอกบ้าน', name:'ลดระยะเวลาออกนอกบ้าน',             never:  690, sometimes: 3823, regular: 1254 },
      { short:'ปิดหน้าต่าง',  name:'ปิดประตูหน้าต่าง',                  never:  159, sometimes: 1710, regular: 3898 },
      { short:'เช็คอากาศ',    name:'ตรวจเช็คคุณภาพอากาศก่อนออกนอกบ้าน', never:  906, sometimes: 2881, regular: 1980 },
      { short:'งดออกแจ้ง',    name:'งดการออกกำลังกายกลางแจ้ง',          never:  750, sometimes: 3634, regular: 1383 },
    ],
    n: 5767
  },
  KKN: {
    // ข้อมูลจริงจังหวัดขอนแก่น · n = 95 (ระดับดี 44, ปานกลาง 38, ต่ำ 13)
    levels: [
      { level:'good',   pct: 46.3, color:'#3FAE6B', label:'พฤติกรรมระดับดี' },
      { level:'medium', pct: 40.0, color:'#F5C84A', label:'พฤติกรรมระดับปานกลาง' },
      { level:'low',    pct: 13.7, color:'#D9534F', label:'พฤติกรรมระดับต่ำ' },
    ],
    details: [
      { short:'ไม่เผาขยะ',     name:'ไม่เผาขยะ กระดาษ จุดธูป',           never: 18, sometimes: 27, regular: 50 },
      { short:'สวมหน้ากาก',   name:'สวมหน้ากากอนามัย',                 never:  7, sometimes: 68, regular: 20 },
      { short:'ลดออกนอกบ้าน', name:'ลดระยะเวลาออกนอกบ้าน',             never: 17, sometimes: 51, regular: 27 },
      { short:'ปิดหน้าต่าง',  name:'ปิดประตูหน้าต่าง',                  never:  3, sometimes: 26, regular: 66 },
      { short:'เช็คอากาศ',    name:'ตรวจเช็คคุณภาพอากาศก่อนออกนอกบ้าน', never: 28, sometimes: 48, regular: 19 },
      { short:'งดออกแจ้ง',    name:'งดการออกกำลังกายกลางแจ้ง',          never:  4, sometimes: 60, regular: 31 },
    ],
    n: 95
  },
  KSN: {
    // ข้อมูลจริงจังหวัดกาฬสินธุ์ · n = 2,429 (ระดับดี 1035, ปานกลาง 806, ต่ำ 588)
    levels: [
      { level:'good',   pct: 42.61, color:'#3FAE6B', label:'พฤติกรรมระดับดี' },
      { level:'medium', pct: 33.18, color:'#F5C84A', label:'พฤติกรรมระดับปานกลาง' },
      { level:'low',    pct: 24.21, color:'#D9534F', label:'พฤติกรรมระดับต่ำ' },
    ],
    details: [
      { short:'ไม่เผาขยะ',     name:'ไม่เผาขยะ กระดาษ จุดธูป',           never: 517, sometimes: 1336, regular:  576 },
      { short:'สวมหน้ากาก',   name:'สวมหน้ากากอนามัย',                 never:  92, sometimes: 1191, regular: 1146 },
      { short:'ลดออกนอกบ้าน', name:'ลดระยะเวลาออกนอกบ้าน',             never: 275, sometimes: 1656, regular:  498 },
      { short:'ปิดหน้าต่าง',  name:'ปิดประตูหน้าต่าง',                  never:  49, sometimes:  785, regular: 1595 },
      { short:'เช็คอากาศ',    name:'ตรวจเช็คคุณภาพอากาศก่อนออกนอกบ้าน', never: 457, sometimes: 1340, regular:  632 },
      { short:'งดออกแจ้ง',    name:'งดการออกกำลังกายกลางแจ้ง',          never: 307, sometimes: 1630, regular:  492 },
    ],
    n: 2429
  },
  MKM: {
    // ข้อมูลจริงจังหวัดมหาสารคาม · n = 3,233 (ระดับดี 1701, ปานกลาง 791, ต่ำ 741)
    levels: [
      { level:'good',   pct: 52.61, color:'#3FAE6B', label:'พฤติกรรมระดับดี' },
      { level:'medium', pct: 24.47, color:'#F5C84A', label:'พฤติกรรมระดับปานกลาง' },
      { level:'low',    pct: 22.92, color:'#D9534F', label:'พฤติกรรมระดับต่ำ' },
    ],
    details: [
      { short:'ไม่เผาขยะ',     name:'ไม่เผาขยะ กระดาษ จุดธูป',           never: 1068, sometimes: 1425, regular:  740 },
      { short:'สวมหน้ากาก',   name:'สวมหน้ากากอนามัย',                 never:   51, sometimes: 1072, regular: 2110 },
      { short:'ลดออกนอกบ้าน', name:'ลดระยะเวลาออกนอกบ้าน',             never:  395, sometimes: 2113, regular:  725 },
      { short:'ปิดหน้าต่าง',  name:'ปิดประตูหน้าต่าง',                  never:  107, sometimes:  894, regular: 2232 },
      { short:'เช็คอากาศ',    name:'ตรวจเช็คคุณภาพอากาศก่อนออกนอกบ้าน', never:  416, sometimes: 1488, regular: 1329 },
      { short:'งดออกแจ้ง',    name:'งดการออกกำลังกายกลางแจ้ง',          never:  437, sometimes: 1940, regular:  856 },
    ],
    n: 3233
  },
  RET: {
    // ข้อมูลจริงจังหวัดร้อยเอ็ด · n = 10 (ระดับดี 1, ปานกลาง 1, ต่ำ 8)
    levels: [
      { level:'good',   pct: 10.0, color:'#3FAE6B', label:'พฤติกรรมระดับดี' },
      { level:'medium', pct: 10.0, color:'#F5C84A', label:'พฤติกรรมระดับปานกลาง' },
      { level:'low',    pct: 80.0, color:'#D9534F', label:'พฤติกรรมระดับต่ำ' },
    ],
    details: [
      { short:'ไม่เผาขยะ',     name:'ไม่เผาขยะ กระดาษ จุดธูป',           never: 3, sometimes: 5, regular: 2 },
      { short:'สวมหน้ากาก',   name:'สวมหน้ากากอนามัย',                 never: 0, sometimes: 9, regular: 1 },
      { short:'ลดออกนอกบ้าน', name:'ลดระยะเวลาออกนอกบ้าน',             never: 3, sometimes: 3, regular: 4 },
      { short:'ปิดหน้าต่าง',  name:'ปิดประตูหน้าต่าง',                  never: 0, sometimes: 5, regular: 5 },
      { short:'เช็คอากาศ',    name:'ตรวจเช็คคุณภาพอากาศก่อนออกนอกบ้าน', never: 5, sometimes: 5, regular: 0 },
      { short:'งดออกแจ้ง',    name:'งดการออกกำลังกายกลางแจ้ง',          never: 2, sometimes: 4, regular: 4 },
    ],
    n: 10
  }
};

// Backward compatibility (เผื่อมีโค้ดเดิมอ้างถึง)
window.BEHAVIOR_LEVELS  = window.BEHAVIOR_BY_PROV.ALL.levels;
window.BEHAVIOR_DETAILS = window.BEHAVIOR_BY_PROV.ALL.details;

// Clean rooms (ห้องปลอดฝุ่น) — 5 ประเภท ตามมาตรฐานเขตสุขภาพที่ 7
// health = สถานบริการสาธารณสุข | office = อาคารสำนักงาน
// childDev = อาคารสถานพัฒนาเด็กปฐมวัย | school = อาคารสถานศึกษา
// convention = ศูนย์ประชุม หอประชุม ห้องประชุม
// ข้อมูลจริงจาก podfoon API (ห้องปลอดฝุ่น อนามัย) · snapshot ตั้งต้น — app.jsx ดึงสดมาอัปเดตทับ
window.CLEAN_ROOMS = [
  { prov:'KKN', health:77,  office:13,  childDev:103, school:6,  convention:17, other:3,  total:219 },
  { prov:'KSN', health:30,  office:2,   childDev:15,  school:3,  convention:1,  other:30, total:81  },
  { prov:'MKM', health:85,  office:26,  childDev:18,  school:8,  convention:7,  other:4,  total:148 },
  { prov:'RET', health:231, office:119, childDev:26,  school:74, convention:25, other:7,  total:482 },
];
// Meta สำหรับใช้แสดงผล (ชื่อไทย + สี + key)
window.CLEAN_ROOM_TYPES = [
  { key: 'health',     label: 'สถานบริการสาธารณสุข',         short: 'สาธารณสุข',   color: '#5DBE8C' },
  { key: 'office',     label: 'อาคารสำนักงาน',                short: 'สำนักงาน',    color: '#6FA0E6' },
  { key: 'childDev',   label: 'อาคารสถานพัฒนาเด็กปฐมวัย',      short: 'เด็กปฐมวัย', color: '#9D7FE0' },
  { key: 'school',     label: 'อาคารสถานศึกษา',               short: 'สถานศึกษา',   color: '#E6A85C' },
  { key: 'convention', label: 'ศูนย์ประชุม หอประชุม ห้องประชุม', short: 'ศูนย์ประชุม', color: '#E0708C' },
  { key: 'other',      label: 'ประเภทอื่นๆ',                  short: 'อื่นๆ',       color: '#9AA3B2' },
];

// District / Tambon GISDA grid
// districts under each province with a representative pm value and tambons
window.DISTRICTS = {
  KKN: [
    { name:'เมืองขอนแก่น', pm:46, tambons:[
      {name:'ในเมือง',pm:49},{name:'สำราญ',pm:44},{name:'โคกสี',pm:42},{name:'ท่าพระ',pm:45},
      {name:'บ้านทุ่ม',pm:43},{name:'เมืองเก่า',pm:48},{name:'พระลับ',pm:41},{name:'สาวะถี',pm:40},
    ]},
    { name:'บ้านไผ่',     pm:31, tambons:[{name:'ในเมือง',pm:33},{name:'หัวหนอง',pm:30},{name:'เมืองเพีย',pm:29},{name:'บ้านลาน',pm:32}]},
    { name:'ชุมแพ',       pm:36, tambons:[{name:'ชุมแพ',pm:38},{name:'โนนหัน',pm:35},{name:'หนองไผ่',pm:34}]},
    { name:'น้ำพอง',      pm:39, tambons:[{name:'น้ำพอง',pm:41},{name:'วังชัย',pm:38},{name:'หนองกุง',pm:37}]},
    { name:'พล',          pm:35, tambons:[{name:'เมืองพล',pm:37},{name:'โจดหนองแก',pm:34},{name:'เก่างิ้ว',pm:33}]},
    { name:'หนองเรือ',    pm:33, tambons:[{name:'หนองเรือ',pm:35},{name:'บ้านเม็ง',pm:32},{name:'ยางคำ',pm:31}]},
    { name:'กระนวน',      pm:34, tambons:[{name:'กระนวน',pm:36},{name:'น้ำอ้อม',pm:33}]},
    { name:'หนองสองห้อง', pm:32, tambons:[{name:'หนองสองห้อง',pm:34},{name:'คึมชาด',pm:30}]},
  ],
  KSN: [
    { name:'เมืองกาฬสินธุ์', pm:52, tambons:[
      {name:'กาฬสินธุ์',pm:54},{name:'เหนือ',pm:51},{name:'หลุบ',pm:50},{name:'ไผ่',pm:49},
      {name:'ลำปาว',pm:53},{name:'หนองกุง',pm:50},{name:'กลางหมื่น',pm:48},
    ]},
    { name:'ยางตลาด',     pm:45, tambons:[{name:'ยางตลาด',pm:47},{name:'หัวงัว',pm:44},{name:'อุ่มเม่า',pm:43},{name:'บัวบาน',pm:45}]},
    { name:'กมลาไสย',     pm:42, tambons:[{name:'กมลาไสย',pm:44},{name:'หลักเมือง',pm:41}]},
    { name:'สมเด็จ',       pm:38, tambons:[{name:'สมเด็จ',pm:40},{name:'หนองแวง',pm:37}]},
    { name:'ห้วยเม็ก',     pm:36, tambons:[{name:'ห้วยเม็ก',pm:38},{name:'คำใหญ่',pm:35}]},
    { name:'ท่าคันโท',     pm:34, tambons:[{name:'ท่าคันโท',pm:36},{name:'ยางอู้ม',pm:33}]},
  ],
  MKM: [
    { name:'เมืองมหาสารคาม', pm:34, tambons:[
      {name:'ตลาด',pm:36},{name:'เขวา',pm:33},{name:'ท่าตูม',pm:32},{name:'แวงน่าง',pm:31},{name:'โคกก่อ',pm:34},
    ]},
    { name:'โกสุมพิสัย',   pm:30, tambons:[{name:'หัวขวาง',pm:32},{name:'ยางน้อย',pm:29},{name:'วังยาว',pm:28}]},
    { name:'พยัคฆภูมิพิสัย', pm:32, tambons:[{name:'ปะหลาน',pm:34},{name:'ก้ามปู',pm:31}]},
    { name:'บรบือ',        pm:31, tambons:[{name:'บรบือ',pm:33},{name:'บ่อใหญ่',pm:30}]},
    { name:'วาปีปทุม',     pm:29, tambons:[{name:'หนองแสง',pm:31},{name:'ขามป้อม',pm:28}]},
    { name:'กันทรวิชัย',    pm:33, tambons:[{name:'โคกพระ',pm:35},{name:'ขามเรียง',pm:32}]},
  ],
  RET: [
    { name:'เมืองร้อยเอ็ด', pm:48, tambons:[
      {name:'ในเมือง',pm:50},{name:'รอบเมือง',pm:47},{name:'เหนือเมือง',pm:46},{name:'หนองแก้ว',pm:48},{name:'ดงลาน',pm:45},
    ]},
    { name:'เสลภูมิ',      pm:40, tambons:[{name:'กลาง',pm:42},{name:'นางาม',pm:39},{name:'เมืองไพร',pm:38}]},
    { name:'โพนทอง',      pm:37, tambons:[{name:'แวง',pm:39},{name:'โคกกกม่วง',pm:36}]},
    { name:'สุวรรณภูมิ',    pm:39, tambons:[{name:'สระคู',pm:41},{name:'ดอกไม้',pm:38}]},
    { name:'พนมไพร',      pm:35, tambons:[{name:'พนมไพร',pm:37},{name:'แสนสุข',pm:34}]},
    { name:'อาจสามารถ',   pm:36, tambons:[{name:'อาจสามารถ',pm:38},{name:'โพนเมือง',pm:35}]},
  ],
};
