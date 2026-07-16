// Root app + sidebar nav
const { useState: useStateApp, useEffect: useEffectApp, useCallback: useCallbackApp, useRef: useRefApp } = React;

const GAS_URL = 'https://script.google.com/macros/s/AKfycbyccHuGkiGErQZo4Ww52d8z9sg0acKfhVexnqZeQOfMkCtty_bQgD5YTNsntRNRR3b8QA/exec';
const AIR4THAI_URL = 'https://script.google.com/macros/s/AKfycbwTpLBY-CsiSIBwVLA_Upj0PG3M42y--2CSXt_G99Z2d9Tfpd_6jevCAkjffFLbw4xk/exec';
const DUSTBOY_URL = 'https://script.google.com/macros/s/AKfycbzL_2gmIeABukeHPFg5T6groMvEfiGGy27_MK2JiORQOWseE1Y7ssjfjt6v-Lh3vcW0/exec';
// อัตราป่วยรายสัปดาห์ (HDC กระทรวงสาธารณสุข) — API เปิด CORS ให้ดึงตรงจากเบราว์เซอร์ได้
const DISEASE_URL = 'https://opendata.moph.go.th/api/report_data';
// ห้องปลอดฝุ่น (podfoon อนามัย) — ดึงแยกรายจังหวัดด้วย PROVINCE_ID (CORS เปิด *)
const CLEANROOM_URL = 'https://podfoon.anamai.moph.go.th/api/cleanroom/province/';
const CLEANROOM_PROV = { '28': 'KKN', '34': 'KSN', '32': 'MKM', '33': 'RET' }; // PROVINCE_ID เขตสุขภาพที่ 7

// ====== แปลงวันที่เป็นภาษาไทย ======
const THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const formatThaiDateTime = (d) => {
  const day = d.getDate();
  const mon = THAI_MONTHS[d.getMonth()];
  const yr = (d.getFullYear() + 543).toString().slice(-2);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${mon} ${yr} · ${hh}:${mm} น.`;
};

// ====== Export DISTRICTS เป็นไฟล์ Excel ======
window.exportToExcel = () => {
  if (typeof XLSX === 'undefined') {
    alert('XLSX library ยังโหลดไม่เสร็จ ลองอีกครั้งใน 2-3 วินาที');
    return;
  }
  const wb = XLSX.utils.book_new();
  const provNames = { KKN: 'ขอนแก่น', KSN: 'กาฬสินธุ์', MKM: 'มหาสารคาม', RET: 'ร้อยเอ็ด' };

  // Sheet 1: จังหวัด
  const provRows = [['จังหวัด', 'PM2.5 เฉลี่ย (μg/m³)', 'ระดับ']];
  Object.entries(window.DISTRICTS).forEach(([code, ds]) => {
    const avg = ds.length ? window.fmt1(ds.reduce((a,b)=>a+b.pm,0)/ds.length) : '0.0';
    provRows.push([provNames[code], avg, window.bandOf(avg).label]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(provRows), 'จังหวัด');

  // Sheet 2: อำเภอ
  const distRows = [['จังหวัด', 'อำเภอ', 'PM2.5 (μg/m³)', 'จำนวนตำบล', 'ระดับ']];
  Object.entries(window.DISTRICTS).forEach(([code, ds]) => {
    ds.forEach(d => distRows.push([provNames[code], d.name, d.pm, d.tambons.length, window.bandOf(d.pm).label]));
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(distRows), 'อำเภอ');

  // Sheet 3: ตำบล
  const tbRows = [['จังหวัด', 'อำเภอ', 'ตำบล', 'PM2.5 (μg/m³)', 'ระดับ']];
  Object.entries(window.DISTRICTS).forEach(([code, ds]) => {
    ds.forEach(d => d.tambons.forEach(t =>
      tbRows.push([provNames[code], d.name, t.name, t.pm, window.bandOf(t.pm).label])
    ));
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tbRows), 'ตำบล');

  const stamp = new Date().toISOString().slice(0,16).replace(/[:T]/g,'-');
  XLSX.writeFile(wb, `PM25_GISDA_${stamp}.xlsx`);
};

// multi = true -> ปล่อยให้ไหลได้หลายแผ่น (ใช้กับหน้ารายอำเภอที่มี 76 อำเภอ)
window.exportOnePage = (multi) => {
  const root = document.documentElement;
  const body = document.body;

  const cleanup = () => {
    body.classList.remove('export-one-page', 'export-multi');
    root.classList.remove('export-multi');
    root.style.removeProperty('--export-scale');
    window.removeEventListener('afterprint', cleanup);
  };

  body.classList.add('export-one-page');
  if (multi) { body.classList.add('export-multi'); root.classList.add('export-multi'); }
  requestAnimationFrame(() => {
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => window.print(), 80);
    setTimeout(cleanup, 3000);
  });
};

const PrintOnePageSheet = ({ page, pageMeta, now, status }) => {
  const provName = { KKN:'ขอนแก่น', KSN:'กาฬสินธุ์', MKM:'มหาสารคาม', RET:'ร้อยเอ็ด' };
  const CODES = ['KKN','KSN','MKM','RET'];
  const fmt = window.fmt1 || ((v) => (Math.round((+v || 0) * 10) / 10).toFixed(1));
  const intTh = (v) => Math.round(+v || 0).toLocaleString('th-TH');
  const avg = (arr, key) => {
    const vals = (arr || []).map(x => key ? x[key] : x).filter(v => Number.isFinite(+v) && +v > 0).map(Number);
    return vals.length ? vals.reduce((a,b) => a + b, 0) / vals.length : 0;
  };
  const sum = (arr) => (arr || []).reduce((a,b) => a + (+b || 0), 0);
  const band = (v) => window.bandOf ? window.bandOf(+v || 0) : { label:'-', color:'#E6EAF2', text:'#50556B' };
  const latest = window.LATEST || {};

  // ===== รายอำเภอ / รายจังหวัด (GISTDA) =====
  const districtRows = Object.entries(window.DISTRICTS || {}).flatMap(([code, ds]) =>
    (ds || []).map(d => ({ code, province: provName[code] || code, name: d.name, pm: +d.pm || 0, tambons: (d.tambons || []).length }))
  ).sort((a,b) => b.pm - a.pm);
  const provinceRows = CODES.map(code => {
    const ds = (window.DISTRICTS && window.DISTRICTS[code]) || [];
    return { code, province: provName[code], pm: avg(ds, 'pm'), count: ds.length };
  });

  // ===== แหล่งข้อมูล =====
  const airAvg = latest.Air4Thai?.region_avg || avg(window.STATIONS || [], 'pm25');
  const gisdaAvg = latest.GISDA?.region_avg || avg(districtRows, 'pm');
  const dustAvg = latest.Dustboy?.region_avg || avg(window.DUSTBOY || [], 'pm25');
  const provAvgOf = (list, code) => avg((list || []).filter(s => s.prov === code), 'pm25');

  // ===== ห้องปลอดฝุ่น =====
  const rooms = window.CLEAN_ROOMS || [];
  const roomTypes = window.CLEAN_ROOM_TYPES || [];
  const cleanTotal = sum(rooms.map(r => r.total));

  // ===== อัตราป่วย (สะสมรายสัปดาห์ HDC) =====
  const dw = window.DISEASE_WEEKLY || {};
  const nWeeks = (dw.KKN?.resp || []).length;
  const diseaseList = (window.DISEASES || []).map(d => ({
    key: d.key, name: d.name, color: d.color,
    total: CODES.reduce((s, c) => s + sum(dw[c]?.[d.key]), 0),
  })).sort((a,b) => b.total - a.total);
  const diseaseTotal = sum(diseaseList.map(d => d.total));

  // ===== พฤติกรรม =====
  const beh = (window.BEHAVIOR_BY_PROV && window.BEHAVIOR_BY_PROV.ALL) || null;

  // ===== ฝุ่นย้อนหลัง =====
  const wkAll = (window.PM_WEEKLY && window.PM_WEEKLY.ALL) || [];
  const hourly = window.PM_HOURLY || null;

  // ===== Heat =====
  const heatProvs = (window.HEAT && window.HEAT.provinces) || [];
  const heatIndex = (f) => {
    if (Number.isFinite(+f?.hi)) return +f.hi;
    const T = (+f?.tcMax || 0) * 1.8 + 32;
    const R = +f?.rh || 0;
    const hiF = -42.379 + 2.04901523*T + 10.14333127*R - 0.22475541*T*R - 0.00683783*T*T - 0.05481717*R*R + 0.00122874*T*T*R + 0.00085282*T*R*R - 0.00000199*T*T*R*R;
    return Math.round(((hiF - 32) / 1.8) * 10) / 10;
  };
  const hBand = (v) => window.heatBandOf ? window.heatBandOf(+v || 0) : { label:'-', color:'#FFE08A', text:'#7A5A12' };
  const heatToday = heatProvs.map(p => ({ code:p.code, name:p.name, t:p.forecasts?.[0] })).filter(x => x.t);
  const dayLabel = (iso) => { const d = new Date(iso); return Number.isNaN(+d) ? '-' : `${d.getDate()}/${d.getMonth()+1}`; };

  // ===== KPI ต่อหน้า =====
  const kpisByPage = {
    overview: [
      { label:'PM2.5 เฉลี่ยทั้งเขต', value: fmt(gisdaAvg), unit:'µg/m³', color: band(gisdaAvg).color },
      { label:'สถานีตรวจวัด Air4Thai', value: (window.STATIONS || []).length, unit:'สถานี', color: '#7FC8F8' },
      { label:'ห้องปลอดฝุ่นที่ขึ้นทะเบียน', value: intTh(cleanTotal), unit:'แห่ง', color: '#DFF3E7' },
      { label:`ผู้ป่วยสะสม W1–W${nWeeks}`, value: intTh(diseaseTotal), unit:'ราย', color: '#FCE0E5' },
    ],
    compare: [
      { label:'Air4Thai', value: fmt(airAvg), unit:'µg/m³', color: '#7FC8F8' },
      { label:'GISTDA', value: fmt(gisdaAvg), unit:'µg/m³', color: '#A8E6A1' },
      { label:'Dustboy', value: fmt(dustAvg), unit:'µg/m³', color: '#FFE08A' },
      { label:'ส่วนต่างสูงสุด–ต่ำสุด', value: fmt(Math.max(airAvg,gisdaAvg,dustAvg) - Math.min(airAvg,gisdaAvg,dustAvg)), unit:'µg/m³', color: '#FCE0E5' },
    ],
    districts: [
      { label:'ค่าเฉลี่ยทั้งเขต', value: fmt(gisdaAvg), unit:'µg/m³', color: band(gisdaAvg).color },
      { label:'จำนวนอำเภอ', value: districtRows.length, unit:`อำเภอ · ${sum(districtRows.map(d=>d.tambons))} ตำบล`, color: '#E1ECFB' },
      { label:'อำเภอสูงสุด', value: fmt(districtRows[0]?.pm || 0), unit: districtRows[0]?.name || '-', color: '#FCE0E5' },
      { label:'อำเภอต่ำสุด', value: fmt(districtRows[districtRows.length-1]?.pm || 0), unit: districtRows[districtRows.length-1]?.name || '-', color: '#DFF3E7' },
    ],
    heat: heatToday.slice(0,4).map(h => ({
      label: h.name, value: fmt(heatIndex(h.t)), unit: `°C HI · ${hBand(heatIndex(h.t)).label}`, color: hBand(heatIndex(h.t)).color,
    })),
  };
  const printKpis = kpisByPage[page] || kpisByPage.overview;

  // ===== ชิ้นส่วนที่ใช้ซ้ำ =====
  const ProvinceBars = ({ title }) => (
    <>
      <h4>{title || 'ค่าฝุ่น PM2.5 รายจังหวัด'}</h4>
      {provinceRows.map(r => {
        const b = band(r.pm);
        return (
          <div className="print-bar" key={r.code}>
            <span>{r.province}</span>
            <i><em style={{ width: Math.min(100, r.pm / 75 * 100) + '%', background:b.color }}/></i>
            <b style={{ color:b.text }}>{fmt(r.pm)}</b>
          </div>
        );
      })}
      <div className="print-bands">
        {(window.PM_BANDS || []).map((b, i) => <span key={i} style={{ background:b.color, color:b.text }}>{b.label}</span>)}
      </div>
    </>
  );

  const Sparkline = ({ values, standard }) => {
    const vals = (values || []).map(v => +v || 0);
    if (!vals.length) return null;
    const max = Math.max(...vals, standard || 0) * 1.1 || 1;
    const pts = vals.map((v, i) => `${(i / Math.max(1, vals.length - 1)) * 100},${100 - (v / max) * 100}`).join(' ');
    const stdY = standard ? 100 - (standard / max) * 100 : null;
    return (
      <svg className="print-spark" viewBox="0 0 100 100" preserveAspectRatio="none">
        {stdY !== null && <line x1="0" y1={stdY} x2="100" y2={stdY} stroke="#1B1E2C" strokeWidth="0.8" strokeDasharray="3 2" opacity="0.55"/>}
        <polyline points={pts} fill="none" stroke="#6FA0E6" strokeWidth="1.6" vectorEffect="non-scaling-stroke"/>
      </svg>
    );
  };

  // ===== เนื้อหาต่อหน้า =====
  let body = null;

  if (page === 'overview') {
    body = (
      <div className="print-grid">
        <div className="print-panel">
          <ProvinceBars/>
          <h4 className="mt">สถานีตรวจวัด Air4Thai ({(window.STATIONS || []).length})</h4>
          <div className="print-list">
            {(window.STATIONS || []).slice(0, 8).map((s, i) => {
              const b = band(s.pm25);
              return (
                <div className="print-li" key={i}>
                  <b style={{ background:b.color, color:b.text }}>{fmt(s.pm25)}</b>
                  <span>{s.name}</span>
                  <small>{provName[s.prov] || s.prov}</small>
                </div>
              );
            })}
          </div>
        </div>

        <div className="print-panel">
          <h4>ห้องปลอดฝุ่น (Clean Room) · รวม {intTh(cleanTotal)} แห่ง</h4>
          <table className="print-table">
            <thead>
              <tr><th>จังหวัด</th>{roomTypes.map(t => <th key={t.key} className="num">{t.short}</th>)}<th className="num">รวม</th></tr>
            </thead>
            <tbody>
              {rooms.map(r => (
                <tr key={r.prov}>
                  <td>{provName[r.prov] || r.prov}</td>
                  {roomTypes.map(t => <td key={t.key} className="num">{intTh(r[t.key])}</td>)}
                  <td className="num strong">{intTh(r.total)}</td>
                </tr>
              ))}
              <tr className="total">
                <td>รวมทั้งเขต</td>
                {roomTypes.map(t => <td key={t.key} className="num">{intTh(sum(rooms.map(r => r[t.key])))}</td>)}
                <td className="num strong">{intTh(cleanTotal)}</td>
              </tr>
            </tbody>
          </table>

          <h4 className="mt">ผู้ป่วยด้วยโรคจากมลพิษทางอากาศ · สะสม W1–W{nWeeks}</h4>
          {diseaseList.map(d => (
            <div className="print-bar" key={d.key}>
              <span>{d.name}</span>
              <i><em style={{ width: Math.min(100, (d.total / (diseaseList[0]?.total || 1)) * 100) + '%', background:d.color }}/></i>
              <b>{intTh(d.total)}</b>
            </div>
          ))}
          <div className="print-note">รวมทั้งสิ้น <strong>{intTh(diseaseTotal)}</strong> ราย · แหล่งข้อมูล HDC กระทรวงสาธารณสุข</div>
        </div>

        <div className="print-panel">
          <h4>พฤติกรรมการป้องกันตนเอง{beh && beh.n ? ` · n = ${intTh(beh.n)}` : ''}</h4>
          {beh && beh.levels && (
            <div className="print-levels">
              {beh.levels.map((l, i) => (
                <div className="print-level" key={i}>
                  <span style={{ background:l.color }}/>
                  <div><strong>{fmt(l.pct)}%</strong><small>{l.label}</small></div>
                </div>
              ))}
            </div>
          )}
          {beh && beh.details && (
            <table className="print-table mt">
              <thead><tr><th>พฤติกรรม</th><th className="num">ไม่เคย</th><th className="num">บางครั้ง</th><th className="num">ประจำ</th></tr></thead>
              <tbody>
                {beh.details.map((d, i) => {
                  const tot = d.never + d.sometimes + d.regular || 1;
                  return (
                    <tr key={i}>
                      <td>{d.short || d.name}</td>
                      <td className="num">{Math.round(d.never / tot * 100)}%</td>
                      <td className="num">{Math.round(d.sometimes / tot * 100)}%</td>
                      <td className="num strong">{Math.round(d.regular / tot * 100)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <div className="print-note">ค่าฝุ่นย้อนหลังรายสัปดาห์ (W1–W{wkAll.length}) · เส้นประ = ค่ามาตรฐาน 37.5</div>
          <Sparkline values={wkAll} standard={37.5}/>
        </div>
      </div>
    );
  } else if (page === 'compare') {
    const rank = provinceRows.map(r => ({
      ...r,
      air: provAvgOf(window.STATIONS, r.code),
      dust: provAvgOf(window.DUSTBOY, r.code),
    })).sort((a,b) => a.pm - b.pm);
    const medal = ['🥇','🥈','🥉','4'];
    body = (
      <div className="print-grid">
        <div className="print-panel">
          <h4>อันดับคุณภาพอากาศรายจังหวัด (ดีที่สุด → แย่ที่สุด)</h4>
          {rank.map((r, i) => {
            const b = band(r.pm);
            return (
              <div className="print-rank" key={r.code}>
                <span>{medal[i] || i+1}</span>
                <strong>{r.province}</strong>
                <small>{r.count} อำเภอ</small>
                <b style={{ background:b.color, color:b.text }}>{fmt(r.pm)}</b>
              </div>
            );
          })}
          <h4 className="mt">เทียบค่าเฉลี่ยแต่ละแหล่ง</h4>
          {[
            { name:'Air4Thai', value:airAvg, note:`${(window.STATIONS||[]).length} สถานีภาคพื้น`, color:'#7FC8F8' },
            { name:'GISTDA', value:gisdaAvg, note:`${districtRows.length} อำเภอ · ดาวเทียม`, color:'#A8E6A1' },
            { name:'Dustboy', value:dustAvg, note:`${(window.DUSTBOY||[]).length} สถานีชุมชน`, color:'#FFE08A' },
          ].map((s, i) => (
            <div className="print-bar" key={i}>
              <span>{s.name}</span>
              <i><em style={{ width: Math.min(100, s.value / 75 * 100) + '%', background:s.color }}/></i>
              <b>{fmt(s.value)}</b>
            </div>
          ))}
        </div>

        <div className="print-panel">
          <h4>เปรียบเทียบรายจังหวัด × 3 แหล่งข้อมูล (µg/m³)</h4>
          <table className="print-table">
            <thead><tr><th>จังหวัด</th><th className="num">Air4Thai</th><th className="num">GISTDA</th><th className="num">Dustboy</th><th className="num">ส่วนต่าง</th></tr></thead>
            <tbody>
              {provinceRows.map(r => {
                const a = provAvgOf(window.STATIONS, r.code), g = r.pm, d = provAvgOf(window.DUSTBOY, r.code);
                const vals = [a,g,d].filter(v => v > 0);
                const diff = vals.length > 1 ? Math.max(...vals) - Math.min(...vals) : 0;
                return (
                  <tr key={r.code}>
                    <td>{r.province}</td>
                    <td className="num">{a ? fmt(a) : '–'}</td>
                    <td className="num">{fmt(g)}</td>
                    <td className="num">{d ? fmt(d) : '–'}</td>
                    <td className="num strong">{fmt(diff)}</td>
                  </tr>
                );
              })}
              <tr className="total">
                <td>ทั้งเขต</td>
                <td className="num">{fmt(airAvg)}</td>
                <td className="num">{fmt(gisdaAvg)}</td>
                <td className="num">{fmt(dustAvg)}</td>
                <td className="num strong">{fmt(Math.max(airAvg,gisdaAvg,dustAvg) - Math.min(airAvg,gisdaAvg,dustAvg))}</td>
              </tr>
            </tbody>
          </table>
          <div className="print-note">
            ส่วนต่างเกิดจากวิธีตรวจวัดต่างกัน — Air4Thai/Dustboy วัดที่จุดติดตั้ง ส่วน GISTDA ประมาณค่าจากดาวเทียมครอบคลุมทั้งพื้นที่
          </div>
          <div className="print-bands mt">
            {(window.PM_BANDS || []).map((b, i) => <span key={i} style={{ background:b.color, color:b.text }}>{b.label}</span>)}
          </div>
        </div>

        <div className="print-panel">
          <h4>รายงานข้อมูลรายสถานี</h4>
          <table className="print-table">
            <thead><tr><th>สถานี</th><th>จังหวัด</th><th className="num">PM2.5</th><th>ระดับ</th></tr></thead>
            <tbody>
              {[...(window.STATIONS || []).map(s => ({ ...s, src:'Air4Thai' })), ...(window.DUSTBOY || []).map(s => ({ ...s, src:'Dustboy' }))]
                .sort((a,b) => (+b.pm25||0) - (+a.pm25||0)).slice(0, 14).map((s, i) => {
                const b = band(s.pm25);
                return (
                  <tr key={i}>
                    <td className="ell">{s.name}</td>
                    <td>{provName[s.prov] || s.prov}</td>
                    <td className="num strong">{fmt(s.pm25)}</td>
                    <td><span className="print-pill" style={{ background:b.color, color:b.text }}>{b.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  } else if (page === 'districts') {
    const byProv = CODES.map(code => ({
      code, name: provName[code],
      list: ((window.DISTRICTS && window.DISTRICTS[code]) || []).slice().sort((a,b) => (+b.pm||0) - (+a.pm||0)),
    }));
    const hourlyProv = hourly?.provinces || {};
    body = (
      <>
        {/* ---- แผ่นที่ 1 : สรุปสำหรับผู้บริหาร ---- */}
        <div className="print-grid">
          <div className="print-panel">
            <ProvinceBars title="ค่าเฉลี่ยรายจังหวัด (GISTDA)"/>
          </div>

          <div className="print-panel">
            <h4>10 อำเภอค่าฝุ่นสูงสุด</h4>
            {districtRows.slice(0, 10).map((d, i) => {
              const b = band(d.pm);
              return (
                <div className="print-rank tight" key={i}>
                  <span>{i+1}</span>
                  <strong>{d.name}</strong>
                  <small>{d.province}</small>
                  <b style={{ background:b.color, color:b.text }}>{fmt(d.pm)}</b>
                </div>
              );
            })}
          </div>

          <div className="print-panel">
            <h4>ค่าฝุ่นย้อนหลังรายสัปดาห์ (W1–W{wkAll.length})</h4>
            <Sparkline values={wkAll} standard={37.5}/>
            <div className="print-note">เส้นประ = ค่ามาตรฐาน 37.5 µg/m³ · เฉลี่ยทั้งเขต</div>
            {hourly && (
              <>
                <h4 className="mt">รายชั่วโมง 24 ชม. · {hourly.date || ''}</h4>
                <table className="print-table">
                  <thead><tr><th>จังหวัด</th><th className="num">ต่ำสุด</th><th className="num">เฉลี่ย</th><th className="num">สูงสุด</th></tr></thead>
                  <tbody>
                    {CODES.map(c => {
                      const arr = (hourlyProv[c] || []).map(Number).filter(v => v > 0);
                      if (!arr.length) return null;
                      return (
                        <tr key={c}>
                          <td>{provName[c]}</td>
                          <td className="num">{fmt(Math.min(...arr))}</td>
                          <td className="num">{fmt(avg(arr))}</td>
                          <td className="num strong">{fmt(Math.max(...arr))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>

        {/* ---- แผ่นที่ 2 : ตารางครบทุกอำเภอ ---- */}
        <div className="print-page2">
          <h4 className="print-page2-title">ค่าฝุ่น PM2.5 รายอำเภอ ครบทั้ง {districtRows.length} อำเภอ · หน่วย µg/m³</h4>
          <div className="print-dcols">
            {byProv.map(p => (
              <div className="print-dcol" key={p.code}>
                <div className="print-dhead">{p.name} <em>{p.list.length} อำเภอ</em></div>
                {p.list.map((d, i) => {
                  const b = band(d.pm);
                  return (
                    <div className="print-drow" key={i}>
                      <span>{d.name}</span>
                      <b style={{ background:b.color, color:b.text }}>{fmt(d.pm)}</b>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="print-bands mt">
            {(window.PM_BANDS || []).map((b, i) => <span key={i} style={{ background:b.color, color:b.text }}>{b.label} <em>{window.bandRange ? window.bandRange(i) : ''}</em></span>)}
          </div>
        </div>
      </>
    );
  } else if (page === 'heat') {
    const days = (heatProvs[0]?.forecasts || []).slice(0, 7);
    body = (
      <div className="print-grid">
        <div className="print-panel wide">
          <h4>พยากรณ์ดัชนีความร้อน (Heat Index) {days.length} วันข้างหน้า · °C</h4>
          <table className="print-table heat">
            <thead>
              <tr><th>จังหวัด</th>{days.map((f, i) => <th key={i} className="num">{dayLabel(f.date)}</th>)}</tr>
            </thead>
            <tbody>
              {heatProvs.map(p => (
                <tr key={p.code}>
                  <td>{p.name}</td>
                  {(p.forecasts || []).slice(0, 7).map((f, i) => {
                    const hi = heatIndex(f);
                    const b = hBand(hi);
                    return <td key={i} className="num"><span className="print-pill" style={{ background:b.color, color:b.text }}>{fmt(hi)}</span></td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <h4 className="mt">อุณหภูมิสูงสุด–ต่ำสุด และความชื้นสัมพัทธ์ (วันนี้)</h4>
          <table className="print-table">
            <thead><tr><th>จังหวัด</th><th className="num">สูงสุด</th><th className="num">ต่ำสุด</th><th className="num">ความชื้น</th><th className="num">HI</th><th>เวลาที่ร้อนสุด</th></tr></thead>
            <tbody>
              {heatToday.map(h => (
                <tr key={h.code}>
                  <td>{h.name}</td>
                  <td className="num">{fmt(h.t.tcMax)}°C</td>
                  <td className="num">{fmt(h.t.tcMin)}°C</td>
                  <td className="num">{h.t.hiRh || h.t.rh}%</td>
                  <td className="num strong">{fmt(heatIndex(h.t))}</td>
                  <td>{h.t.hiTime ? String(h.t.hiTime).substring(11,16) + ' น.' : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="print-panel">
          <h4>เกณฑ์ระดับดัชนีความร้อน</h4>
          <div className="print-list">
            {(window.HEAT_BANDS || []).map((b, i) => (
              <div className="print-li" key={i}>
                <b style={{ background:b.color, color:b.text }}>{b.range}</b>
                <span>{b.emoji} {b.label}</span>
              </div>
            ))}
          </div>
          <h4 className="mt">คำแนะนำการปฏิบัติตัว</h4>
          {(window.HEAT_ADVICE?.general?.levels || []).slice(1).map((l, i) => (
            <div className="print-advice" key={i}>
              <strong style={{ color:l.color }}>● {l.level}</strong>
              <p>{(l.items || []).join(' · ')}</p>
            </div>
          ))}
          <div className="print-note">Heat Index คำนวณด้วยสมการ Rothfusz จากอุณหภูมิและความชื้นสัมพัทธ์รายชั่วโมงของกรมอุตุนิยมวิทยา (TMD)</div>
        </div>
      </div>
    );
  }

  return (
    <section className="print-sheet" aria-hidden="true">
      <div className="print-head">
        <div className="print-logo"><img src="images/logo.png" alt=""/></div>
        <div>
          <div className="print-title">{pageMeta.title}</div>
          <div className="print-sub">{pageMeta.sub}</div>
          <div className="print-meta">ศูนย์อนามัยที่ 7 ขอนแก่น · ข้อมูล ณ {formatThaiDateTime(now)}</div>
        </div>
      </div>

      <div className="print-kpis">
        {printKpis.map((k, i) => (
          <div className="print-kpi" key={i}>
            <span className="print-kpi-glow" style={{ background:k.color }}/>
            <div className="print-kpi-label">{k.label}</div>
            <div className="print-kpi-value">{k.value}<span>{k.unit}</span></div>
          </div>
        ))}
      </div>

      {body}

      <div className="print-foot">
        แหล่งข้อมูล: Air4Thai (คพ.) · GISTDA · Dustboy · HDC กระทรวงสาธารณสุข · ห้องปลอดฝุ่น กรมอนามัย · TMD
        <span>งานข้อมูลและติดตามประเมินผล กลุ่มขับเคลื่อนยุทธศาสตร์และพัฒนากำลังคน · ศูนย์อนามัยที่ 7 ขอนแก่น</span>
      </div>
    </section>
  );
};

const App = () => {
  const [page, setPage] = useStateApp('overview');
  const [dataKey, setDataKey] = useStateApp(0);
  const [lastUpdate, setLastUpdate] = useStateApp(null);
  const [fetchStatus, setFetchStatus] = useStateApp('loading'); // loading | success | error
  const [diseaseReady, setDiseaseReady] = useStateApp(false);   // โหลดข้อมูลโรคจริงเสร็จหรือยัง
  const [roomReady, setRoomReady] = useStateApp(false);         // โหลดข้อมูลห้องปลอดฝุ่นจริงเสร็จหรือยัง
  const [now, setNow] = useStateApp(new Date());
  const [sideOpen, setSideOpen] = useStateApp(false);
  const lastAirFetch = useRefApp(0);   // เวลาที่ดึงข้อมูลอากาศล่าสุด (กัน timer ค้างตอนแท็บพื้นหลัง/เครื่อง sleep)
  // ปิด sidebar เมื่อเปลี่ยนหน้า (mobile UX)
  const navigate = (p) => { setPage(p); setSideOpen(false); };

  // นาฬิกาแสดงเวลา realtime (อัปเดตทุก 30 วินาที)
  useEffectApp(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // ====== ดึงข้อมูล realtime จาก Google Apps Script (GISDA + Air4Thai + Dustboy พร้อมกัน) ======
  const fetchGISDA = useCallbackApp(() => {
    lastAirFetch.current = Date.now();
    setFetchStatus('loading');
    Promise.all([
      fetch(GAS_URL).then(r => r.json()).catch(e => { console.error('GISDA fetch failed:', e); return null; }),
      fetch(AIR4THAI_URL).then(r => r.json()).catch(e => { console.error('Air4Thai fetch failed:', e); return null; }),
      fetch(DUSTBOY_URL).then(r => r.json()).catch(e => { console.error('Dustboy fetch failed:', e); return null; })
    ])
      .then(([gisda, air4thai, dustboy]) => {
        const data = gisda || { provinces:[], districts:[], tambons:[] };
        if (air4thai && air4thai.stations) {
          data.stations = air4thai.stations;
          console.log('Air4Thai stations received:', air4thai.stations.length);
        }
        if (dustboy && dustboy.stations) {
          data.dustboy = dustboy.stations;
          console.log('Dustboy stations received:', dustboy.stations.length);
        }
        return data;
      })
      .then(data => {
        console.log('GISDA data received:', data);

        const PV_MAP = {
          'ขอนแก่น': 'KKN',
          'กาฬสินธุ์': 'KSN',
          'มหาสารคาม': 'MKM',
          'ร้อยเอ็ด': 'RET'
        };

        const newDistricts = { KKN: [], KSN: [], MKM: [], RET: [] };

        // ฟังก์ชันช่วย: ตรวจว่าชื่อใช้ได้ไหม
        const isValid = (v) => v && v !== '#N/A' && String(v).trim() !== '';

        // 1) เก็บ PM2.5 ของอำเภอจากชีท "ชีต1"
        const districtPmMap = {};
        if (data.districts && Array.isArray(data.districts)) {
          data.districts.forEach(d => {
            const code = PV_MAP[d.province];
            if (code && isValid(d.district)) {
              const key = code + '|' + d.district;
              districtPmMap[key] = Math.round((parseFloat(d.pm25) || 0) * 10) / 10;
            }
          });
        }

        // 2) จัดกลุ่มตำบลตามอำเภอ
        if (data.tambons && Array.isArray(data.tambons)) {
          data.tambons.forEach(tb => {
            const code = PV_MAP[tb.province];
            if (!code) return;
            if (!isValid(tb.district) || !isValid(tb.tambon)) return;

            const tambonObj = {
              name: tb.tambon,
              pm: Math.round((parseFloat(tb.pm25) || 0) * 10) / 10
            };

            let existingDist = newDistricts[code].find(d => d.name === tb.district);
            if (existingDist) {
              existingDist.tambons.push(tambonObj);
            } else {
              const districtKey = code + '|' + tb.district;
              newDistricts[code].push({
                name: tb.district,
                pm: districtPmMap[districtKey] || tambonObj.pm,
                tambons: [tambonObj]
              });
            }
          });
        }

        // 3) เพิ่มอำเภอที่มีในชีท1 แต่ยังไม่ปรากฏ (ไม่มีข้อมูลตำบล)
        Object.keys(districtPmMap).forEach(k => {
          const [code, distName] = k.split('|');
          if (!newDistricts[code].find(d => d.name === distName)) {
            newDistricts[code].push({
              name: distName,
              pm: districtPmMap[k],
              tambons: []
            });
          }
        });

        // 4) คำนวณ PM อำเภอจากค่าเฉลี่ยตำบล ถ้าไม่มีจากชีท1
        Object.keys(newDistricts).forEach(code => {
          newDistricts[code].forEach(d => {
            if (!d.pm && d.tambons.length > 0) {
              d.pm = Math.round(d.tambons.reduce((a, t) => a + t.pm, 0) / d.tambons.length * 10) / 10;
            }
          });
        });

        // 5) อัปเดต PM_MONTHLY (เดือนล่าสุด) จากชีท "จังหวัด"
        if (data.provinces && Array.isArray(data.provinces)) {
          data.provinces.forEach(p => {
            const code = PV_MAP[p.name];
            if (code && window.PM_MONTHLY[code]) {
              const pm = Math.round((parseFloat(p.pm25) || 0) * 10) / 10;
              window.PM_MONTHLY[code][window.PM_MONTHLY[code].length - 1] = pm;
            }
          });
        }

        // 6) เขียนทับ DISTRICTS เดิม (เฉพาะเมื่อมีข้อมูลจริง)
        const hasData = Object.values(newDistricts).some(arr => arr.length > 0);
        if (hasData) {
          window.DISTRICTS = newDistricts;
          console.log('DISTRICTS updated:',
            Object.entries(newDistricts).map(([k,v]) => k+': '+v.length+' อำเภอ').join(', '));
        }

        // 7) อัปเดต STATIONS จากข้อมูล Air4Thai จริง (ใช้พิกัดจริงจาก sheet)
        if (data.stations && Array.isArray(data.stations) && data.stations.length > 0) {
          const PROV_MAP = {
            'ขอนแก่น':  { lat: 16.43, lng: 102.83, code: 'KKN' },
            'กาฬสินธุ์': { lat: 16.43, lng: 103.51, code: 'KSN' },
            'มหาสารคาม': { lat: 16.18, lng: 103.30, code: 'MKM' },
            'ร้อยเอ็ด':  { lat: 16.05, lng: 103.65, code: 'RET' },
          };
          const provCount = {};
          const newStations = data.stations
            .filter(s => PROV_MAP[s.province])
            .map((s, idx) => {
              const center = PROV_MAP[s.province];
              const hasRealCoords = s.lat && s.lng && !isNaN(s.lat) && !isNaN(s.lng);
              let lat, lng;
              if (hasRealCoords) {
                lat = parseFloat(s.lat);
                lng = parseFloat(s.lng);
              } else {
                // fallback: กระจายรอบศูนย์กลางจังหวัด
                const ci = provCount[s.province] = (provCount[s.province] || 0) + 1;
                const angle = (ci * 137.5) * Math.PI / 180;
                const r = 0.05 + (ci % 3) * 0.04;
                lat = center.lat + Math.sin(angle) * r;
                lng = center.lng + Math.cos(angle) * r;
              }
              return {
                id: 'air4thai_' + idx,
                name: s.name,
                prov: center.code,
                amphoe: '',
                lat: lat,
                lng: lng,
                pm25: Math.round((parseFloat(s.pm25) || 0) * 10) / 10,
                pm10: 0,
                o3: 0,
                source: 'Air4Thai'
              };
            });
          if (newStations.length > 0) {
            window.STATIONS = newStations;
            console.log('STATIONS updated: ' + newStations.length + ' สถานี Air4Thai (พิกัดจริง)');
          }
        }

        // 8) เก็บข้อมูล Dustboy
        const PROV_CODE = { 'ขอนแก่น':'KKN', 'กาฬสินธุ์':'KSN', 'มหาสารคาม':'MKM', 'ร้อยเอ็ด':'RET' };
        if (data.dustboy && Array.isArray(data.dustboy)) {
          window.DUSTBOY = data.dustboy
            .filter(s => PROV_CODE[s.province])
            .map((s, idx) => ({
              id: 'dustboy_' + idx,
              name: s.name,
              prov: PROV_CODE[s.province],
              pm25: Math.round((parseFloat(s.pm25) || 0) * 10) / 10,
              source: 'Dustboy'
            }));
          console.log('DUSTBOY updated: ' + window.DUSTBOY.length + ' สถานี');
        }

        // 9) คำนวณค่าเฉลี่ยปัจจุบันของแต่ละแหล่ง (ใช้ในหน้าเปรียบเทียบ)
        const avgOf = (arr, key) => {
          const vals = arr.map(x => key ? x[key] : x).filter(v => !isNaN(v) && v > 0);
          // เก็บทศนิยม 1 ตำแหน่ง ให้ตรงกับค่าที่แสดงในหน้า Overview (window.fmt1)
          return vals.length ? Math.round(vals.reduce((a,b)=>a+b,0) / vals.length * 10) / 10 : 0;
        };
        const byProv = (arr, key) => {
          const out = { KKN:[], KSN:[], MKM:[], RET:[] };
          arr.forEach(x => { if (out[x.prov]) out[x.prov].push(key ? x[key] : x); });
          return Object.fromEntries(Object.entries(out).map(([k,v]) => [k, avgOf(v)]));
        };

        window.LATEST = {
          Air4Thai: {
            region_avg: avgOf(window.STATIONS, 'pm25'),
            by_prov: byProv(window.STATIONS, 'pm25'),
            count: window.STATIONS.length
          },
          GISDA: {
            region_avg: avgOf(Object.values(window.DISTRICTS).flat(), 'pm'),
            by_prov: Object.fromEntries(Object.entries(window.DISTRICTS).map(([k,ds]) =>
              [k, avgOf(ds, 'pm')])),
            count: Object.values(window.DISTRICTS).reduce((a,b)=>a+b.length,0)
          },
          Dustboy: (window.DUSTBOY && window.DUSTBOY.length) ? {
            region_avg: avgOf(window.DUSTBOY, 'pm25'),
            by_prov: byProv(window.DUSTBOY, 'pm25'),
            count: window.DUSTBOY.length
          } : { region_avg: 0, by_prov:{KKN:0,KSN:0,MKM:0,RET:0}, count: 0 }
        };
        console.log('LATEST averages:', window.LATEST);

        // อัปเดตค่าเดือนล่าสุดใน COMPARE จากค่าจริง
        if (window.LATEST.Air4Thai.region_avg) window.COMPARE.Air4Thai[11] = window.LATEST.Air4Thai.region_avg;
        if (window.LATEST.GISDA.region_avg)    window.COMPARE.GISDA[11]    = window.LATEST.GISDA.region_avg;
        if (window.LATEST.Dustboy.region_avg)  window.COMPARE.Dustboy[11]  = window.LATEST.Dustboy.region_avg;

        // อัปเดต count ใน SOURCE_META
        window.SOURCE_META.Air4Thai.count = window.LATEST.Air4Thai.count;
        window.SOURCE_META.GISDA.count    = window.LATEST.GISDA.count;
        window.SOURCE_META.Dustboy.count  = window.LATEST.Dustboy.count;

        window.GISDA_DATA = data;
        setLastUpdate(data.lastUpdated || new Date().toISOString());
        setFetchStatus('success');
        setDataKey(k => k + 1);
      })
      .catch(err => {
        console.error('Error fetching GISDA data:', err);
        setFetchStatus('error');
      });
  }, []);

  // ====== ดึงอัตราป่วยรายสัปดาห์สดจาก HDC (4 จังหวัดพร้อมกัน) มาอัปเดตทับ snapshot ======
  const fetchDiseaseWeekly = useCallbackApp(() => {
    const PV = { '40':'KKN', '46':'KSN', '44':'MKM', '45':'RET' };
    // map กลุ่มโรค: resp=2,4 | cvd=8,16 | eye=32 | skin=64,128
    const groupOf = { 2:'resp', 4:'resp', 8:'cvd', 16:'cvd', 32:'eye', 64:'skin', 128:'skin' };
    const NW = 53;
    Promise.all(Object.keys(PV).map(pv =>
      fetch(DISEASE_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableName: 's_pm25_1_in_week', year: '2569', province: pv, type: 'json' })
      }).then(r => r.json()).then(rows => ({ pv, rows })).catch(e => { console.error('Disease fetch failed', pv, e); return null; })
    )).then(results => {
      setDiseaseReady(true); // ความพยายามดึงเสร็จแล้ว → แสดงค่า (จริงถ้าได้ / snapshot สำรองถ้าไม่ได้)
      const valid = results.filter(x => x && Array.isArray(x.rows));
      if (!valid.length) return; // ดึงไม่ได้ → ใช้ snapshot เดิมต่อ

      const out = {};
      let lastW = 0;
      valid.forEach(({ pv, rows }) => {
        const g = { resp: Array(NW).fill(0), cvd: Array(NW).fill(0), eye: Array(NW).fill(0), skin: Array(NW).fill(0) };
        rows.forEach(rec => {
          const grp = groupOf[+rec.diag_main];
          if (!grp) return;
          for (let w = 1; w <= NW; w++) {
            const p = String(w).padStart(2, '0');
            const v = parseInt(rec['w_' + p + '_m'], 10) || 0;
            if (v) { g[grp][w - 1] += v; if (w > lastW) lastW = w; }
          }
        });
        out[PV[pv]] = g;
      });
      if (lastW === 0) return;

      const groups = ['resp', 'cvd', 'eye', 'skin'];
      const trimmed = {};
      Object.keys(out).forEach(code => {
        trimmed[code] = {};
        groups.forEach(grp => { trimmed[code][grp] = out[code][grp].slice(0, lastW); });
      });
      const codes = ['KKN', 'KSN', 'MKM', 'RET'];
      const all = {};
      groups.forEach(grp => {
        all[grp] = Array.from({ length: lastW }, (_, i) =>
          codes.reduce((a, c) => a + ((trimmed[c] && trimmed[c][grp] && trimmed[c][grp][i]) || 0), 0));
      });
      trimmed.ALL = all;

      window.DISEASE_WEEKLY = trimmed;
      window.DISEASE_WEEKS = Array.from({ length: lastW }, (_, i) => 'W' + (i + 1));
      console.log('DISEASE_WEEKLY updated from API · weeks =', lastW);
      setDataKey(k => k + 1);
    });
  }, []);

  // ====== ดึงห้องปลอดฝุ่นสดจาก podfoon (4 จังหวัดเขต 7) มาอัปเดตทับ snapshot ======
  const fetchCleanRooms = useCallbackApp(() => {
    const typeMap = {
      'สถานบริการสาธารณสุข': 'health',
      'อาคารสำนักงาน': 'office',
      'อาคารสถานพัฒนาเด็กปฐมวัย': 'childDev',
      'อาคารสถานศึกษา': 'school',
      'ศูนย์ประชุม หอประชุม ห้องประชุม ศูนย์แสดงสินค้า': 'convention',
    };
    Promise.all(Object.keys(CLEANROOM_PROV).map(id =>
      fetch(CLEANROOM_URL + id).then(r => r.json()).then(rooms => ({ id, rooms }))
        .catch(e => { console.error('CleanRoom fetch failed', id, e); return null; })
    )).then(results => {
      setRoomReady(true); // ความพยายามดึงเสร็จแล้ว → แสดงค่า (จริงถ้าได้ / snapshot สำรองถ้าไม่ได้)
      const valid = results.filter(x => x && Array.isArray(x.rooms));
      if (!valid.length) return; // ดึงไม่ได้ → ใช้ snapshot เดิม

      const map = {};
      valid.forEach(({ id, rooms }) => {
        const code = CLEANROOM_PROV[id];
        const c = { prov: code, health: 0, office: 0, childDev: 0, school: 0, convention: 0, other: 0, total: rooms.length };
        rooms.forEach(rm => { const k = typeMap[rm.Type]; if (k) c[k]++; else c.other++; });
        map[code] = c;
      });
      // คงลำดับ KKN,KSN,MKM,RET — จังหวัดที่ดึงไม่ได้ใช้ค่าเดิม
      window.CLEAN_ROOMS = ['KKN', 'KSN', 'MKM', 'RET'].map(code =>
        map[code] || window.CLEAN_ROOMS.find(x => x.prov === code));
      console.log('CLEAN_ROOMS updated from podfoon API');
      setDataKey(k => k + 1);
    });
  }, []);

  // เรียกครั้งแรก + รีเฟรชอัตโนมัติ
  useEffectApp(() => {
    fetchGISDA();
    fetchDiseaseWeekly();
    fetchCleanRooms();
    // อากาศ (Air4Thai/GISDA/Dustboy) = ค่า realtime → ดึงทุก 1 ชั่วโมง
    const tAir = setInterval(fetchGISDA, 60 * 60 * 1000);
    // อัตราป่วย (HDC) + ห้องปลอดฝุ่น = เปลี่ยนช้า → ดึงทุก 12 ชั่วโมง (ประหยัดเน็ต)
    const tSlow = setInterval(() => { fetchDiseaseWeekly(); fetchCleanRooms(); }, 12 * 60 * 60 * 1000);
    // กันอาการ "ค้าง": เบราว์เซอร์หยุด setInterval ตอนแท็บพื้นหลัง/เครื่อง sleep
    // → พอกลับมาดูแท็บอีกครั้ง ถ้าข้อมูลค้างเกิน 10 นาที ให้ดึงอากาศใหม่ทันที
    const refreshIfStale = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastAirFetch.current > 10 * 60 * 1000) {
        fetchGISDA();
      }
    };
    document.addEventListener('visibilitychange', refreshIfStale);
    window.addEventListener('focus', refreshIfStale);
    return () => {
      clearInterval(tAir); clearInterval(tSlow);
      document.removeEventListener('visibilitychange', refreshIfStale);
      window.removeEventListener('focus', refreshIfStale);
    };
  }, [fetchGISDA, fetchDiseaseWeekly, fetchCleanRooms]);

  const pageMeta = {
    overview: {
      title: 'รายงานสถานการณ์ฝุ่นละอองขนาดไม่เกิน 2.5 ไมครอน เขตสุขภาพที่ 7',
      sub: 'พื้นที่ที่รับผิดชอบ ได้แก่ จังหวัดขอนแก่น มหาสารคาม ร้อยเอ็ด และกาฬสินธุ์'
    },
    compare: {
      title: 'เปรียบเทียบแหล่งข้อมูลฝุ่น PM2.5 เขตสุขภาพที่ 7 จากแหล่งข้อมูลต่างๆ',
      sub: 'Air4Thai · GISDA · Dustboy'
    },
    districts: {
      title: 'ค่าฝุ่น PM2.5 รายอำเภอ–ตำบล เขตสุขภาพที่ 7 · โดย GISTDA',
      sub: 'เขตสุขภาพที่ 7 · 4 จังหวัด · 76 อำเภอ · จากดาวเทียม'
    },
    heat: {
      title: 'พยากรณ์อุณหภูมิสูงสุด เขตสุขภาพที่ 7',
      sub: 'พยากรณ์ 7 วันข้างหน้า · กรมอุตุนิยมวิทยา (TMD)'
    },
  }[page];

  return (
    <>
      <div className="atmo"/>
      <div className="atmo-extra"/>
      <PrintOnePageSheet page={page} pageMeta={pageMeta} now={now} status={{ air: fetchStatus !== 'loading', disease: diseaseReady, room: roomReady }}/>
      <div className="app">
        {/* Mobile backdrop */}
        <div className={'side-backdrop ' + (sideOpen ? 'show' : '')} onClick={() => setSideOpen(false)}/>

        {/* Sidebar */}
        <aside className={'side ' + (sideOpen ? 'open' : '')}>
          <button className="side-close" onClick={() => setSideOpen(false)} aria-label="ปิดเมนู">
            <Icon name="close"/>
          </button>
          <div className="side-inner">
          <div className="brand">
            <div className="brand-mark"/>
            <div className="brand-text">
              <div className="t1">ข้อมูลฝุ่น PM2.5</div>
              <div className="t2">เขตสุขภาพที่ 7</div>
            </div>
          </div>

          <div className="nav-section">รายงานหลัก</div>
          <div className="nav">
            <button className={'nav-item ' + (page==='overview'?'active':'')} onClick={() => navigate('overview')}>
              <span className="ico" style={{ background: page==='overview'?'var(--p-sky)':'var(--surface-2)' }}><Icon name="map"/></span>
              <span>ภาพรวมสถานการณ์</span>
              <span className="nav-num">1</span>
            </button>
            <button className={'nav-item ' + (page==='compare'?'active':'')} onClick={() => navigate('compare')}>
              <span className="ico" style={{ background: page==='compare'?'var(--p-lav)':'var(--surface-2)' }}><Icon name="compare"/></span>
              <span>เทียบ 3 แหล่งข้อมูล</span>
              <span className="nav-num">2</span>
            </button>
            <button className={'nav-item ' + (page==='districts'?'active':'')} onClick={() => navigate('districts')}>
              <span className="ico" style={{ background: page==='districts'?'var(--p-mint)':'var(--surface-2)' }}><Icon name="grid"/></span>
              <span>รายอำเภอ–ตำบล โดย GISTDA</span>
              <span className="nav-num">3</span>
            </button>
            <button className={'nav-item ' + (page==='heat'?'active':'')} onClick={() => navigate('heat')}>
              <span className="ico" style={{ background: page==='heat'?'var(--p-peach)':'var(--surface-2)' }}><Icon name="heat"/></span>
              <span>พยากรณ์อุณหภูมิ</span>
              <span className="nav-num">4</span>
            </button>
          </div>

          <div className="nav-section">แหล่งข้อมูล</div>
          <div className="nav">
            <a href="http://air4thai.pcd.go.th/webV3/#/Home" target="_blank" rel="noopener noreferrer" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
              <span className="ico" style={{ background: '#fff', padding: 2, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="images/Air4thai.png" alt="Air4Thai" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
              </span>
              <span>Air4Thai</span>
              <span style={{ marginLeft: 'auto' }}><span className="live-dot"/></span>
            </a>
            <a href="https://pm25.gistda.or.th/" target="_blank" rel="noopener noreferrer" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
              <span className="ico" style={{ background: '#fff', padding: 2, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="images/gistda.png" alt="GISTDA" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
              </span>
              <span>GISTDA</span>
              <span style={{ marginLeft: 'auto' }}><span className="live-dot"/></span>
            </a>
            <a href="https://www.cmuccdc.org/" target="_blank" rel="noopener noreferrer" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
              <span className="ico" style={{ background: '#fff', padding: 2, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="images/dustboy.png" alt="Dustboy" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
              </span>
              <span>Dustboy</span>
              <span style={{ marginLeft: 'auto' }}><span className="live-dot"/></span>
            </a>
            <a href="https://www.tmd.go.th/" target="_blank" rel="noopener noreferrer" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
              <span className="ico" style={{ background: '#fff', padding: 2, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="images/tmd.jpg" alt="กรมอุตุนิยมวิทยา" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
              </span>
              <span>กรมอุตุนิยมวิทยา</span>
              <span style={{ marginLeft: 'auto' }}><span className="live-dot"/></span>
            </a>
          </div>

          <div className="nav-section">เครื่องมือ</div>
          <div className="nav">
              <a href="https://podfoon.anamai.moph.go.th/" target="_blank" rel="noopener noreferrer" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
              <span className="ico" style={{ background: 'var(--surface-2)' }}><Icon name="shield"/></span>
              <span>คำแนะนำในการป้องกันตนเอง</span>
              </a>
            <a href="https://podfoon.anamai.moph.go.th/" target="_blank" rel="noopener noreferrer" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
              <span className="ico" style={{ background: 'var(--surface-2)' }}><Icon name="home"/></span>
              <span>ทะเบียนห้องปลอดฝุ่น</span>
            </a>
            {/* 👇 แบบประเมินความพึงพอใจ — ใส่ลิงก์ของอาจารย์ตรง href="" ด้านล่างนี้ */}
            <a href="https://docs.google.com/forms/d/e/1FAIpQLSckWjSllcf7kYMgeLq872T1LoOUvLsE9ItbJ3tuN512uVHK5Q/viewform?usp=sharing&ouid=115073338025850280317" target="_blank" rel="noopener noreferrer" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
              <span className="ico" style={{ background: 'var(--surface-2)' }}><Icon name="star"/></span>
              <span>แบบประเมินความพึงพอใจ</span>
            </a>
          </div>

          <div className="side-foot">
            <div>
              <span className="live-dot" style={{
                background: fetchStatus==='success' ? 'var(--a-mint)' : fetchStatus==='error' ? '#E0708C' : '#FFB07A'
              }}/>
              {fetchStatus==='loading' && 'กำลังโหลดข้อมูลฝุ่น PM2.5 เขตสุขภาพที่ 7...'}
              {fetchStatus==='success' && 'เชื่อมต่อสำเร็จ'}
              {fetchStatus==='error' && 'โหลดข้อมูลล้มเหลว (CORS?)'}
            </div>
            <div style={{ marginTop: 4 }}>
              {lastUpdate ? 'อัปเดต: ' + formatThaiDateTime(new Date(lastUpdate)) : 'รอข้อมูล realtime...'}
            </div>
            <div style={{ marginTop: 2, fontSize: 10, opacity: .7 }}>รีเฟรชอัตโนมัติทุก 1 ชั่วโมง</div>
          </div>
          </div>
        </aside>

        {/* Main */}
        <main className="main">
          {/* Banner หัวกระดาษ — แสดงทุกหน้า */}
          <div className="health-banner">
            <div className="hb-logo">
              <img src="images/logo.png" alt="กระทรวงสาธารณสุข"/>
            </div>
            <div className="hb-text">
              <h2>รายงานสถานการณ์ฝุ่นละอองขนาดไม่เกิน 2.5 ไมครอน เขตสุขภาพที่ 7</h2>
              <p>พัฒนาโดย งานข้อมูลและติดตามประเมินผล กลุ่มขับเคลื่อนยุทธศาสตร์และพัฒนากำลังคน ศูนย์อนามัยที่ 7 ขอนแก่น</p>
            </div>
          </div>

          <div className="main-inner">
            <div className="topbar">
              <div style={{ display:'flex', alignItems:'center', gap: 12, minWidth: 0, flex: 1 }}>
                <button className="menu-toggle" onClick={() => setSideOpen(true)} aria-label="เปิดเมนู">
                  <Icon name="menu"/>
                </button>
                <div style={{ minWidth: 0 }}>
                  <h1>{pageMeta.title}</h1>
                  <div className="sub">{pageMeta.sub}</div>
                </div>
              </div>
              <div className="topbar-r">
                <button className="chip export-one-page-btn" onClick={() => window.exportOnePage(page === 'districts')} title={page === 'districts' ? 'Export หน้านี้เป็น PDF (ครบ 76 อำเภอ · 2 แผ่น)' : 'Export หน้านี้เป็น PDF แบบ one page'}>
                  <Icon name="download" size={14}/> <span className="label">One Page</span>
                </button>
                <div className="chip"><Icon name="cal" size={14}/> {formatThaiDateTime(now)}</div>
                <button className="btn-icon" title="รีเฟรชข้อมูล" onClick={() => { fetchGISDA(); fetchDiseaseWeekly(); fetchCleanRooms(); }}><Icon name="refresh"/></button>
              </div>
            </div>

            {page === 'overview'  && <PageOverview  key={'ov-'+dataKey} status={{ air: fetchStatus !== 'loading', disease: diseaseReady, room: roomReady }}/>}
            {page === 'compare'   && <PageCompare   key={'cp-'+dataKey}/>}
            {page === 'districts' && <PageDistricts key={'di-'+dataKey}/>}
            {page === 'heat'      && <PageHeat      key="heat-page"/>}
          </div>
        </main>
      </div>
    </>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
