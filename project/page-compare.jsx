// Page 2: Compare PM2.5 across 3 sources (Air4Thai, GISDA, Dustboy)
const { useState: useState2, useMemo: useMemo2 } = React;

const PageCompare = () => {
  const [view, setView] = useState2('bar');  // bar | trend | scatter
  const [selProv, setSelProv] = useState2('ALL');

  const sources = ['Air4Thai', 'GISDA', 'Dustboy'];
  const meta = window.SOURCE_META;
  const data = window.COMPARE;

  // ===== ข้อมูลรายจังหวัด (จาก window.LATEST) สำหรับกราฟแกน X = จังหวัด =====
  const PROV_CODES = ['KKN', 'KSN', 'MKM', 'RET'];
  const provLabels = PROV_CODES.map(c => window.PROVINCES.find(p => p.code === c).name);
  const L = window.LATEST || { Air4Thai:{by_prov:{}}, GISDA:{by_prov:{}}, Dustboy:{by_prov:{}} };
  const provData = sources.reduce((acc, s) => {
    acc[s] = PROV_CODES.map(c => L[s].by_prov[c] || 0);
    return acc;
  }, {});
  const provYMax = Math.max(40, ...Object.values(provData).flat()) * 1.15;

  // Compute regional averages per source (ใช้กับการ์ดด้านบน + delta)
  const avg = sources.reduce((acc, s) => {
    acc[s] = Math.round(data[s].reduce((a,b)=>a+b,0) / data[s].length * 10) / 10;
    return acc;
  }, {});

  // Compute Air4Thai delta vs others (เทียบเฉพาะจังหวัด)
  const delta = (a, b) => {
    const va = provData[a].reduce((x,y)=>x+y,0)/provData[a].length;
    const vb = provData[b].reduce((x,y)=>x+y,0)/provData[b].length;
    if (!vb) return '0';
    return ((va - vb) / vb * 100).toFixed(1);
  };

  return (
    <div className="view-enter">
      {/* Province ranking */}
      <ProvinceRanking/>

      {/* Trend comparison */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-h">
          <div>
            <h3 className="card-t">เปรียบเทียบ PM2.5 รายจังหวัด · 3 แหล่งข้อมูล</h3>
            <div className="card-st">ค่าเฉลี่ยปัจจุบัน · 4 จังหวัด เขตสุขภาพที่ 7</div>
          </div>
          <div className="flex gap-2 center">
            <div className="tabs">
              {[
                {k:'bar',   l:'แท่งเทียบ'},
                {k:'trend', l:'เส้น'},
                {k:'scatter', l:'Scatter'},
              ].map(t => (
                <button key={t.k} className={'tab ' + (view===t.k?'active':'')} onClick={() => setView(t.k)}>{t.l}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="card-b">
          {/* Legend: แต่ละสี = แหล่งข้อมูล */}
          <div className="flex gap-3 center" style={{ flexWrap:'wrap', marginBottom: 14, fontSize: 12.5 }}>
            {sources.map(s => {
              const srcName = { Air4Thai:'Air4Thai', GISDA:'GISTDA', Dustboy:'DUSTBOY' }[s] || s;
              return (
                <span key={s} className="flex center gap-2">
                  <span style={{ width: 14, height: 14, borderRadius: 4, background: meta[s].color, flexShrink: 0 }}/>
                  <strong style={{ color: meta[s].color }}>{srcName}</strong>
                  <span style={{ color:'#8A8FA5', fontSize: 11.5 }}>{meta[s].detail}</span>
                </span>
              );
            })}
          </div>
          <div className="chart-scroll">
            {view === 'bar' && (
              <BarGroup
                labels={provLabels}
                groups={sources.map(s => ({ name: s, color: meta[s].color, values: provData[s] }))}
                w={1080} h={340} yMax={provYMax}
                showValues={true}
              />
            )}
            {view === 'trend' && (
              <LineChart
                labels={provLabels}
                series={sources.map(s => ({ name: s, color: meta[s].color, values: provData[s], unit:' μg/m³' }))}
                w={1080} h={340} yMax={provYMax}
              />
            )}
            {view === 'scatter' && <ScatterCompare provData={provData} provLabels={provLabels}/>}
          </div>
        </div>
      </div>

      {/* Side-by-side: deltas + per-province + agreement */}
      <div className="grid-2" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="card-h">
            <div>
              <h3 className="card-t">ส่วนต่างระหว่างแหล่งข้อมูล</h3>
              <div className="card-st">เทียบกับ Air4Thai (สถานีภาคพื้น)</div>
            </div>
          </div>
          <div className="card-b">
            <DeltaMatrix provData={provData} provLabels={provLabels} meta={meta}/>
            <div className="divider"/>
            <div style={{ fontSize: 12, color: '#50556B', lineHeight: 1.7 }}>
              GISDA รายงานสูงกว่า Air4Thai เฉลี่ย <strong>{delta('GISDA','Air4Thai')}%</strong> เนื่องจากดาวเทียมตรวจจับมวลฝุ่นในชั้นบรรยากาศตลอดคอลัมน์
              ขณะที่ Dustboy รายงานต่ำกว่า <strong>{Math.abs(delta('Dustboy','Air4Thai'))}%</strong> จากตำแหน่งเซ็นเซอร์ในที่พักอาศัย
            </div>
          </div>
        </div>

        <SourceCompareByProvince sources={sources} meta={meta}/>
      </div>

      {/* รายงานข้อมูลรายสถานี Dustboy */}
      <DustboyStationReport/>
    </div>
  );
};

// --- Province Air Quality Ranking (จัดอันดับคุณภาพอากาศรายจังหวัด) ---
const ProvinceRanking = () => {
  // แหล่งข้อมูลให้เลือก (key = key ใน window.LATEST, label = ชื่อแสดงผล)
  const SRC_OPTS = [
    { key:'ALL',      label:'เฉลี่ยทุกแหล่ง' },
    { key:'Air4Thai', label:'Air4Thai' },
    { key:'GISDA',    label:'GISTDA' },
    { key:'Dustboy',  label:'DUSTBOY' },
  ];
  const [src, setSrc] = useState2('ALL');

  const L = window.LATEST || { Air4Thai:{by_prov:{}}, GISDA:{by_prov:{}}, Dustboy:{by_prov:{}} };
  const meta = window.SOURCE_META;
  const provColors = { KKN:'#6FA0E6', KSN:'#E68A5C', MKM:'#5DBE8C', RET:'#9D7FE0' };
  // ตัวคูณ fallback ให้สอดคล้องกับส่วนอื่นของหน้า (GISDA สูงกว่า, Dustboy ต่ำกว่า)
  const FB_MULT = { Air4Thai: 1, GISDA: 1.07, Dustboy: 0.93 };

  // ดึงค่า PM2.5 ของจังหวัดตามแหล่งที่เลือก (รองรับ ALL = เฉลี่ย)
  const valueOf = (code, monthIdx) => {
    const monthly = window.PM_MONTHLY[code] || [];
    const base = monthly.length ? monthly[monthly.length + monthIdx] : 0;
    if (src === 'ALL') {
      const live = ['Air4Thai','GISDA','Dustboy']
        .map(s => (monthIdx === -1 && L[s] && L[s].by_prov[code]) || 0)
        .filter(v => v > 0);
      if (live.length) return live.reduce((a,b)=>a+b,0) / live.length;
      // fallback = เฉลี่ยตัวคูณทุกแหล่ง
      const avgMult = (FB_MULT.Air4Thai + FB_MULT.GISDA + FB_MULT.Dustboy) / 3;
      return base * avgMult;
    }
    const live = monthIdx === -1 && L[src] ? L[src].by_prov[code] : 0;
    return live || base * (FB_MULT[src] || 1);
  };

  const rows = window.PROVINCES.map(p => {
    const cur = Math.round(valueOf(p.code, -1) * 10) / 10;
    const prev = valueOf(p.code, -2);
    return {
      code: p.code, name: p.name, color: provColors[p.code] || '#6FA0E6',
      pm: cur, delta: Math.round((cur - prev) * 10) / 10,
    };
  }).sort((a,b) => a.pm - b.pm);

  const maxPm = Math.max(...rows.map(r => r.pm), 1);
  const best = rows[0], worst = rows[rows.length - 1];
  const srcLabel = SRC_OPTS.find(o => o.key === src).label;
  const srcColor = src === 'ALL' ? '#6FA0E6' : (meta[src] ? meta[src].color : '#6FA0E6');

  const selectStyle = {
    appearance:'none', WebkitAppearance:'none', MozAppearance:'none',
    padding:'8px 36px 8px 16px', background:'var(--surface)',
    border:'1px solid var(--border)', borderRadius: 999,
    fontSize: 13, color:'var(--ink)', cursor:'pointer',
    fontFamily:'inherit', fontWeight: 600, boxShadow:'var(--shadow-sm)',
    backgroundImage:'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%238A8FA5\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'/></svg>")',
    backgroundRepeat:'no-repeat', backgroundPosition:'right 12px center'
  };

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="card-h">
        <div>
          <h3 className="card-t">🏆 อันดับคุณภาพอากาศรายจังหวัด</h3>
          <div className="card-st">เรียงจากอากาศดีที่สุด → ต้องเฝ้าระวัง · แหล่งข้อมูล: <strong style={{ color: srcColor }}>{srcLabel}</strong></div>
        </div>
        <select value={src} onChange={e => setSrc(e.target.value)} style={selectStyle}>
          {SRC_OPTS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>
      <div className="card-b">
        <div key={src} style={{ display:'grid', gap: 10 }}>
          {rows.map((r, i) => {
            const band = window.bandOf(r.pm);
            const pct = Math.min(100, r.pm / maxPm * 100);
            const isBest = i === 0, isWorst = i === rows.length - 1;
            const improving = r.delta < 0;
            return (
              <div key={r.code} style={{
                display:'grid', gridTemplateColumns:'auto 1fr auto', gap: 14, alignItems:'center',
                padding:'14px 16px', borderRadius: 14,
                background: isBest ? 'linear-gradient(135deg, #EFFAEC 0%, #F7FCF5 100%)'
                  : isWorst ? 'linear-gradient(135deg, #FFF1EC 0%, #FFF8F5 100%)' : '#fff',
                border: '1px solid ' + (isBest ? '#CDEBC4' : isWorst ? '#F5C9A8' : 'var(--border)'),
                transition:'all .25s'
              }}
              onMouseEnter={(e)=>e.currentTarget.style.transform='translateX(3px)'}
              onMouseLeave={(e)=>e.currentTarget.style.transform='none'}>
                {/* Rank badge */}
                <div style={{
                  width: 42, height: 42, borderRadius: 12, display:'grid', placeItems:'center',
                  background: isBest ? '#3FAE6B' : isWorst ? '#E07A4C' : r.color + '22',
                  color: (isBest||isWorst) ? '#fff' : r.color, fontSize: 18, fontWeight: 800,
                  boxShadow: isBest ? '0 4px 12px rgba(63,174,107,.35)' : 'none', flexShrink: 0
                }}>{i+1}</div>

                {/* Name + bar */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 6, flexWrap:'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{r.name}</span>
                    {isBest && <span style={{ fontSize: 10, fontWeight:700, color:'#2E6A2E', background:'#D7F2CD', padding:'2px 8px', borderRadius:999 }}>อากาศดีที่สุด</span>}
                    {isWorst && <span style={{ fontSize: 10, fontWeight:700, color:'#8A3E10', background:'#FBD9C7', padding:'2px 8px', borderRadius:999 }}>ต้องเฝ้าระวัง</span>}
                  </div>
                  <div style={{ height: 8, background:'var(--surface-2)', borderRadius:999, overflow:'hidden' }}>
                    <div style={{
                      width: pct + '%', height:'100%', background: band.color,
                      borderRadius:999, transition:'width 1s cubic-bezier(.2,.7,.1,1)'
                    }}/>
                  </div>
                </div>

                {/* Value + band + trend */}
                <div style={{ textAlign:'right', minWidth: 96, flexShrink: 0 }}>
                  <div style={{ display:'flex', alignItems:'baseline', gap: 4, justifyContent:'flex-end' }}>
                    <span style={{ fontSize: 24, fontWeight: 800, color: band.text, lineHeight: 1 }}>{window.fmt1(r.pm)}</span>
                    <span style={{ fontSize: 10.5, color:'#8A8FA5' }}>μg/m³</span>
                  </div>
                  <div style={{ marginTop: 5, display:'flex', alignItems:'center', gap:6, justifyContent:'flex-end' }}>
                    <span style={{ fontSize: 9.5, fontWeight:700, color: band.text, background: band.color, padding:'2px 7px', borderRadius:999 }}>{band.label}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// --- Dustboy station-by-station report ---
const DustboyStationReport = () => {
  const stations = window.DUSTBOY || [];
  const provNames = { KKN: 'ขอนแก่น', KSN: 'กาฬสินธุ์', MKM: 'มหาสารคาม', RET: 'ร้อยเอ็ด' };
  const provColors = { KKN:'#6FA0E6', KSN:'#E68A5C', MKM:'#5DBE8C', RET:'#9D7FE0' };
  const grouped = ['KKN', 'KSN', 'MKM', 'RET'].map(code => ({
    code,
    name: provNames[code],
    color: provColors[code],
    stations: stations.filter(s => s.prov === code).sort((a,b) => b.pm25 - a.pm25)
  }));
  return (
    <div className="card">
      <div className="card-h">
        <div>
          <h3 className="card-t">รายงานข้อมูลรายสถานี · Dustboy</h3>
          <div className="card-st">{stations.length} สถานี · เซ็นเซอร์ชุมชนรายตำแหน่ง · ค่า PM2.5 ปัจจุบัน</div>
        </div>
        <span className="chip"><Icon name="sensor" size={14}/> {stations.length} สถานี</span>
      </div>
      <div className="card-b">
        {stations.length === 0 ? (
          <div style={{ padding: 24, textAlign:'center', color:'#8A8FA5', fontSize: 13 }}>
            ไม่มีข้อมูล Dustboy · กำลังโหลด หรือไม่สามารถเชื่อมต่อได้
          </div>
        ) : (
          <div className="grid-2" style={{ gridTemplateColumns:'repeat(2, 1fr)', gap: 16 }}>
            {grouped.map(g => (
              <div key={g.code} style={{ background:'#fff', border:'1px solid var(--border)', borderRadius: 14, padding: 14 }}>
                <div className="flex between center" style={{ marginBottom: 10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: g.color }}/>
                    <strong style={{ fontSize: 14 }}>{g.name}</strong>
                  </div>
                  <span style={{ fontSize: 11.5, color:'#8A8FA5' }}>{g.stations.length} สถานี</span>
                </div>
                {g.stations.length === 0 ? (
                  <div style={{ padding: 12, fontSize: 12, color:'#8A8FA5', textAlign:'center' }}>ไม่มีสถานี Dustboy</div>
                ) : (
                  <div style={{ display:'grid', gap: 6 }}>
                    {g.stations.map(s => {
                      const band = window.bandOf(s.pm25);
                      return (
                        <div key={s.id} style={{
                          display:'grid', gridTemplateColumns:'1fr auto auto', gap: 10,
                          alignItems:'center', padding:'8px 12px',
                          background:'var(--surface-2)', borderRadius: 10
                        }}>
                          <div style={{ fontSize: 12.5, lineHeight: 1.4, overflow:'hidden', textOverflow:'ellipsis' }}>
                            {s.name}
                          </div>
                          <span style={{
                            fontSize: 10.5, padding:'2px 8px', borderRadius: 999,
                            background: band.color, color: band.text, fontWeight: 600, whiteSpace:'nowrap'
                          }}>{band.label}</span>
                          <div style={{ fontSize: 16, fontWeight: 700, minWidth: 32, textAlign:'right' }}>
                            {window.fmt1(s.pm25)}<span style={{ fontSize: 10, color:'#8A8FA5', fontWeight: 500, marginLeft: 2 }}>μg/m³</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Scatter: Air4Thai vs GISDA/Dustboy (4 จังหวัด) ---
const ScatterCompare = ({ provData, provLabels }) => {
  const W = 1080, H = 320;
  const padL = 50, padR = 20, padT = 20, padB = 40;
  const pd = provData || { Air4Thai:[0,0,0,0], GISDA:[0,0,0,0], Dustboy:[0,0,0,0] };
  const xs = pd.Air4Thai;
  const ys = pd.GISDA;
  const ys2 = pd.Dustboy;
  const allMax = Math.max(...xs, ...ys, ...ys2);
  const max = Math.max(30, Math.ceil(allMax * 1.2));
  const x = v => padL + (v/max) * (W - padL - padR);
  const y = v => H - padB - (v/max) * (H - padT - padB);
  return (
    <svg width={W} height={H}>
      {Array.from({length:6}).map((_,i) => {
        const v = (max/5) * i;
        return (
          <g key={i}>
            <line x1={padL} x2={W-padR} y1={y(v)} y2={y(v)} className="grid-line"/>
            <line x1={x(v)} x2={x(v)} y1={padT} y2={H-padB} className="grid-line"/>
            <text x={padL-8} y={y(v)+3} textAnchor="end" style={{fontSize:10.5, fill:'#8A8FA5'}}>{v}</text>
            <text x={x(v)} y={H-padB+16} textAnchor="middle" style={{fontSize:10.5, fill:'#8A8FA5'}}>{v}</text>
          </g>
        );
      })}
      {/* y=x line */}
      <line x1={x(0)} y1={y(0)} x2={x(max)} y2={y(max)} stroke="#DCDFEA" strokeDasharray="4 6"/>
      {xs.map((v,i) => (
        <g key={'g-'+i}>
          <circle cx={x(v)} cy={y(ys[i])} r="6" fill="#B89AE6" opacity=".75"/>
        </g>
      ))}
      {xs.map((v,i) => (
        <circle key={'d-'+i} cx={x(v)} cy={y(ys2[i])} r="6" fill="#E6A88F" opacity=".75"/>
      ))}
      <text x={W/2} y={H-6} textAnchor="middle" style={{fontSize:11, fill:'#50556B'}}>Air4Thai (μg/m³)</text>
      <text x={14} y={H/2} transform={`rotate(-90 14 ${H/2})`} textAnchor="middle" style={{fontSize:11, fill:'#50556B'}}>GISDA / Dustboy (μg/m³)</text>
      <g transform={`translate(${W-180}, ${padT+10})`}>
        <rect width="160" height="56" rx="10" fill="#fff" stroke="#ECEDF3"/>
        <circle cx="14" cy="20" r="5" fill="#B89AE6"/><text x="26" y="24" style={{fontSize:11, fill:'#50556B'}}>GISDA vs Air4Thai</text>
        <circle cx="14" cy="40" r="5" fill="#E6A88F"/><text x="26" y="44" style={{fontSize:11, fill:'#50556B'}}>Dustboy vs Air4Thai</text>
      </g>
    </svg>
  );
};

// --- Delta matrix per province ---
const DeltaMatrix = ({ provData, provLabels, meta }) => {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {['GISDA','Dustboy'].map(s => {
        const diffs = provData[s].map((v,i) => v - provData.Air4Thai[i]);
        const max = Math.max(1, ...diffs.map(Math.abs));
        return (
          <div key={s}>
            <div className="flex between" style={{ marginBottom: 6, fontSize: 12.5, color:'#50556B' }}>
              <span><strong style={{color: meta[s].color}}>{s}</strong> − Air4Thai</span>
              <span style={{ color:'#8A8FA5' }}>μg/m³</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 6 }}>
              {diffs.map((d,i) => {
                const intensity = Math.abs(d)/max;
                const color = d >= 0 ? '#E6A88F' : '#7FB3E6';
                return (
                  <div key={i} style={{
                    height: 56, borderRadius: 10, position:'relative',
                    background: color + Math.round(intensity*200+30).toString(16).padStart(2,'0'),
                    display: 'grid', placeItems: 'center',
                    color: intensity > .5 ? '#fff' : '#1B1E2C',
                    fontSize: 16, fontWeight: 700
                  }}>{d > 0 ? '+' : ''}{window.fmt1(d)}</div>
                );
              })}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 6, marginTop: 4 }}>
              {provLabels.map((m,i) => (
                <div key={i} style={{ fontSize: 11, color: '#8A8FA5', textAlign:'center' }}>{m}</div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// --- Interactive Province Comparison (เปรียบเทียบรายจังหวัด) ---
const SourceCompareByProvince = ({ sources, meta }) => {
  const [prov, setProv] = useState2('KKN');
  const provOpts = window.PROVINCES;
  const L = window.LATEST || { Air4Thai:{by_prov:{}}, GISDA:{by_prov:{}}, Dustboy:{by_prov:{}} };
  const fallback = window.PM_MONTHLY[prov].slice(-1)[0];
  const vals = {
    Air4Thai: L.Air4Thai.by_prov[prov] || fallback,
    GISDA:    L.GISDA.by_prov[prov]    || Math.round(fallback*1.07),
    Dustboy:  L.Dustboy.by_prov[prov]  || Math.round(fallback*0.93),
  };
  const provName = provOpts.find(p => p.code === prov).name;

  // หา outlier / pattern
  const arr = [
    { src:'Air4Thai', v: vals.Air4Thai },
    { src:'GISDA',    v: vals.GISDA },
    { src:'Dustboy',  v: vals.Dustboy },
  ].sort((a,b) => b.v - a.v);
  const maxV = arr[0].v, minV = arr[2].v;
  const diff = Math.round((maxV - minV) * 10) / 10;
  const high = arr.filter(x => x.v >= maxV - 2).map(x => x.src);
  const low  = arr.filter(x => x.v <= minV + 2).map(x => x.src);

  // คำอธิบายแบบ smart
  const explanations = {
    Air4Thai: 'อยู่ในเมือง พื้นที่จราจรหนาแน่น',
    Dustboy:  'sensor ในที่พักอาศัย ใกล้แหล่งฝุ่นรายวัน',
    GISDA:    'ดาวเทียม เฉลี่ยทั้งอำเภอ (รวมพื้นที่เกษตร/ป่า)',
  };
  let note = null;
  if (diff <= 3) {
    note = {
      icon: '✓',
      color: '#2E6A2E',
      bg: '#EFFAEC',
      border: '#CDEBC4',
      title: 'ทั้ง 3 แหล่งเห็นตรงกัน',
      text: `ค่าต่างกันไม่เกิน ${window.fmt1(diff)} μg/m³ เชื่อถือได้ว่าสถานการณ์ใน${provName}ตรงตามนี้`
    };
  } else {
    const highSrc = high.join('/');
    const lowSrc  = low[0];
    note = {
      icon: '⚠️',
      color: '#8A3E10',
      bg: '#FFEBDC',
      border: '#F5C9A8',
      title: `ต่างกัน ${window.fmt1(diff)} จุด`,
      text: `${highSrc} เห็นรุนแรงกว่า ${lowSrc} ${window.fmt1(diff)} จุด — เพราะ ${highSrc.includes('Air4Thai')||highSrc.includes('Dustboy') ? `${explanations.Air4Thai} ส่วน ${lowSrc} ${explanations[lowSrc]}` : explanations[highSrc] + ' ส่วน ' + lowSrc + ' ' + explanations[lowSrc]}`
    };
  }

  const selectStyle = {
    appearance:'none', WebkitAppearance:'none', MozAppearance:'none',
    padding:'8px 36px 8px 16px',
    background:'var(--surface)',
    border:'1px solid var(--border)', borderRadius: 999,
    fontSize: 13, color:'var(--ink)', cursor:'pointer',
    fontFamily:'inherit', fontWeight: 600,
    backgroundImage:'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%238A8FA5\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'/></svg>")',
    backgroundRepeat:'no-repeat',
    backgroundPosition:'right 12px center',
    boxShadow:'var(--shadow-sm)'
  };

  return (
    <div className="card">
      <div className="card-h">
        <div>
          <h3 className="card-t">เปรียบเทียบข้อมูลรายจังหวัด</h3>
          <div className="card-st">เลือกจังหวัด · ดูค่า PM2.5 จากทั้ง 3 แหล่งพร้อมกัน</div>
        </div>
        <select value={prov} onChange={e => setProv(e.target.value)} style={selectStyle}>
          {provOpts.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
        </select>
      </div>
      <div className="card-b">
        {/* 3 source cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
          {arr.map((item, idx) => {
            const band = window.bandOf(item.v);
            const isHigh = idx === 0 && diff > 3;
            return (
              <div key={item.src} style={{
                background: '#fff',
                border: '1px solid ' + (isHigh ? '#F0B8B8' : 'var(--border)'),
                borderRadius: 14,
                padding: '14px 16px',
                position: 'relative',
                transition: 'all .25s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 8 }}>
                  <span style={{ display:'inline-flex', alignItems:'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: meta[item.src].color }}>
                    <span style={{ width: 8, height: 8, borderRadius:'50%', background: meta[item.src].color }}/>
                    {item.src}
                  </span>
                  {isHigh && <span style={{ fontSize: 9.5, fontWeight: 700, color:'#8A3E10', background:'#FFEBDC', padding:'2px 7px', borderRadius: 999 }}>สูงสุด</span>}
                </div>
                <div style={{ display:'flex', alignItems:'baseline', gap: 4, marginBottom: 6 }}>
                  <span style={{ fontSize: 30, fontWeight: 800, color: band.text, lineHeight: 1 }}>{window.fmt1(item.v)}</span>
                  <span style={{ fontSize: 11, color:'#8A8FA5' }}>μg/m³</span>
                </div>
                <span style={{
                  fontSize: 10.5, fontWeight: 700, color: band.text,
                  background: band.color, padding:'2px 10px', borderRadius: 999
                }}>{band.label}</span>
              </div>
            );
          })}
        </div>

        {/* Smart note */}
        <div style={{
          background: note.bg,
          border: '1px solid ' + note.border,
          borderRadius: 12,
          padding: '12px 14px',
          display: 'flex', gap: 10, alignItems:'flex-start'
        }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>{note.icon}</span>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: note.color, marginBottom: 3 }}>{note.title}</div>
            <div style={{ fontSize: 12, color:'#50556B', lineHeight: 1.55 }}>{note.text}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Provincial comparison bars ---
const ProvincialCompare = () => {
  // ใช้ค่าจริงจาก window.LATEST.X.by_prov (อัปเดตจาก realtime fetch)
  const provinces = window.PROVINCES;
  const sources = ['Air4Thai','GISDA','Dustboy'];
  const meta = window.SOURCE_META;
  const L = window.LATEST || { Air4Thai:{by_prov:{}}, GISDA:{by_prov:{}}, Dustboy:{by_prov:{}} };
  const rows = provinces.map(p => {
    const fallback = window.PM_MONTHLY[p.code].slice(-1)[0];
    const a = L.Air4Thai.by_prov[p.code] || fallback;
    const g = L.GISDA.by_prov[p.code]    || Math.round(a*1.07);
    const d = L.Dustboy.by_prov[p.code]  || Math.round(a*0.93);
    return {
      prov: p.name,
      code: p.code,
      vals: { Air4Thai: a, GISDA: g, Dustboy: d }
    };
  });
  const allVals = rows.flatMap(r => Object.values(r.vals)).filter(v => v > 0);
  const max = Math.max(40, ...allVals) * 1.1;
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {rows.map(r => (
        <div key={r.code} style={{ display:'grid', gridTemplateColumns:'140px 1fr', gap: 20, alignItems:'center' }}>
          <div>
            <div style={{ fontWeight:600 }}>{r.prov}</div>
            <div style={{ fontSize:11, color:'#8A8FA5' }}>{r.code}</div>
          </div>
          <div style={{ display:'grid', gap: 8 }}>
            {sources.map(s => {
              const v = r.vals[s];
              const pct = Math.min(100, v / max * 100);
              return (
                <div key={s} style={{ display:'grid', gridTemplateColumns:'90px 1fr 60px', gap:12, alignItems:'center' }}>
                  <div style={{ fontSize:12, color: meta[s].color, fontWeight: 600 }}>{s}</div>
                  <div style={{ height: 18, background:'var(--surface-2)', borderRadius: 999, overflow:'hidden', position:'relative' }}>
                    <div style={{
                      width: pct + '%', height: '100%',
                      background: `linear-gradient(90deg, ${meta[s].color}aa, ${meta[s].color})`,
                      borderRadius: 999, transition: 'width 1s cubic-bezier(.2,.7,.1,1)'
                    }}/>
                  </div>
                  <div style={{ textAlign:'right', fontWeight:700 }}>{window.fmt1(v)} <span style={{ fontSize:11, color:'#8A8FA5', fontWeight:500 }}>μg/m³</span></div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

window.PageCompare = PageCompare;
