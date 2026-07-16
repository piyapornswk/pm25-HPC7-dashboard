// Shared UI primitives + icons
const { useState, useEffect, useMemo, useRef } = React;

// ---------- Icons (stroke = currentColor) ----------
const Icon = ({ name, size = 18 }) => {
  const paths = {
    map:     <><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14"/><path d="M15 6v14"/></>,
    compare: <><path d="M4 6h7"/><path d="M13 18h7"/><path d="m7 3-3 3 3 3"/><path d="m17 15 3 3-3 3"/></>,
    grid:    <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    bell:    <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9Z"/><path d="M10 21a2 2 0 0 0 4 0"/></>,
    settings:<><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.3.9a7 7 0 0 0-2-1.2l-.4-2.5h-4l-.4 2.5a7 7 0 0 0-2 1.2L5.5 5.8l-2 3.5 2 1.5A7 7 0 0 0 5.4 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.5 2.3-.9a7 7 0 0 0 2 1.2l.4 2.5h4l.4-2.5a7 7 0 0 0 2-1.2l2.3.9 2-3.5-2-1.5c.1-.4.1-.8.1-1.2Z"/></>,
    cal:     <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    refresh: <><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></>,
    download:<><path d="M12 3v12"/><path d="m6 11 6 6 6-6"/><path d="M5 21h14"/></>,
    search:  <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
    chevron: <><path d="m9 6 6 6-6 6"/></>,
    info:    <><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></>,
    sat:     <><path d="M5 5a3 3 0 0 1 4 0l2 2a3 3 0 0 1 0 4l-3 3a3 3 0 0 1-4 0L2 12a3 3 0 0 1 0-4Z"/><path d="m13 11 6 6"/><path d="M14 4h6v6"/><path d="M20 4 13 11"/></>,
    station: <><path d="M4 14a8 8 0 1 1 16 0"/><path d="M8 14a4 4 0 1 1 8 0"/><circle cx="12" cy="14" r="1.5"/><path d="M12 16v5"/></>,
    sensor:  <><path d="M12 2v3"/><path d="M12 19v3"/><path d="M4.9 4.9 7 7"/><path d="M17 17l2.1 2.1"/><path d="M2 12h3"/><path d="M19 12h3"/><path d="M4.9 19.1 7 17"/><path d="M17 7l2.1-2.1"/><circle cx="12" cy="12" r="4"/></>,
    layers:  <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/><path d="m3 17 9 5 9-5"/></>,
    lung:    <><path d="M12 4v14"/><path d="M8 18a4 4 0 0 1-4-4V8c0-1 1-2 2-2 3 0 6 4 6 8"/><path d="M16 18a4 4 0 0 0 4-4V8c0-1-1-2-2-2-3 0-6 4-6 8"/></>,
    shield:  <><path d="M12 3 4 6v6c0 5 3.5 7.5 8 9 4.5-1.5 8-4 8-9V6l-8-3Z"/></>,
    home:    <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/></>,
    wind:    <><path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 13h15a3 3 0 1 1-3 3"/><path d="M3 18h7"/></>,
    menu:    <><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></>,
    close:   <><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>,
    star:    <><path d="M12 3.5l2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 17.0l-5.25 2.75 1-5.85L3.5 9.65l5.9-.85z"/></>,
    heat:    <><path d="M14 14.76V5a2 2 0 1 0-4 0v9.76a4 4 0 1 0 4 0Z"/><path d="M12 9v5"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name] || null}
    </svg>
  );
};

// ---------- Sparkline ----------
const Sparkline = ({ data, w = 90, h = 28, color = '#6FA0E6' }) => {
  if (!data?.length) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const pad = 2;
  const x = i => pad + i * ((w - pad*2) / (data.length - 1));
  const y = v => h - pad - ((v - min) / Math.max(1, (max - min))) * (h - pad*2);
  const d = data.map((v,i) => `${i===0?'M':'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const fillD = `${d} L ${x(data.length-1)} ${h} L ${x(0)} ${h} Z`;
  const id = 'sg-' + color.replace('#','');
  return (
    <svg width={w} height={h}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".25"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={fillD} fill={`url(#${id})`}/>
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};

// ---------- LineChart with hover ----------
const LineChart = ({ series, labels, w = 720, h = 280, yMax, showValues = false, standard = null }) => {
  const [hover, setHover] = useState(null);
  const padL = 40, padR = 36, padT = 16, padB = 30;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  // เผื่อให้เส้นมาตรฐาน (ถ้ามี) อยู่ในกราฟเสมอ
  const max = yMax ?? Math.max(...series.flatMap(s => s.values), standard || 0) * 1.15;
  const x = i => padL + i * (innerW / (labels.length - 1));
  const y = v => padT + innerH - (v / max) * innerH;
  const ticks = 5;
  return (
    <div style={{ position:'relative', width: w }}>
      <svg width={w} height={h} onMouseLeave={() => setHover(null)}>
        {/* grid */}
        {Array.from({length: ticks+1}).map((_,i) => {
          const v = Math.round(max * (1 - i/ticks));
          const yy = padT + (innerH/ticks) * i;
          return (
            <g key={i}>
              <line x1={padL} x2={w-padR} y1={yy} y2={yy} className="grid-line"/>
              <text x={padL-8} y={yy+3} textAnchor="end" className="axis-text" style={{fontSize:10.5, fill:'#8A8FA5'}}>{v}</text>
            </g>
          );
        })}
        {/* labels */}
        {labels.map((l,i) => (
          <text key={i} x={x(i)} y={h-padB+16} textAnchor="middle" style={{fontSize:10.5, fill:'#8A8FA5'}}>{l}</text>
        ))}
        {/* series */}
        {series.map((s,si) => {
          const okV = (v) => v != null && Number.isFinite(+v) && +v >= 0;   // null/-1 = ไม่มีข้อมูล
          // สร้างเส้นแบบเว้นช่อง (gap) ตรงจุดที่ไม่มีข้อมูล ไม่ลากดิ่งลง 0
          let d = '', pen = false;
          s.values.forEach((v,i) => {
            if (!okV(v)) { pen = false; return; }
            d += `${pen ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
            pen = true;
          });
          const anyNull = s.values.some(v => !okV(v));
          const fillD = anyNull ? '' : `${d} L ${x(s.values.length-1)} ${padT+innerH} L ${x(0)} ${padT+innerH} Z`;
          const gid = 'lg-' + si + '-' + s.color.replace('#','');
          return (
            <g key={si}>
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity=".22"/>
                  <stop offset="100%" stopColor={s.color} stopOpacity="0"/>
                </linearGradient>
              </defs>
              {s.fill !== false && fillD && <path d={fillD} fill={`url(#${gid})`}/>}
              <path d={d} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray={s.dash || 'none'}/>
              {s.values.map((v,i) => okV(v) && (
                <circle key={i} cx={x(i)} cy={y(v)} r={hover?.i===i?4.5:0} fill="#fff" stroke={s.color} strokeWidth="2"/>
              ))}
              {showValues && s.values.map((v,i) => okV(v) && (
                <text key={'v'+i} x={x(i)} y={y(v) - 7} textAnchor="middle"
                  style={{ fontSize: 9, fontWeight: 700, fill: s.color, paintOrder: 'stroke', stroke: '#fff', strokeWidth: 2.6 }}>{window.fmt1(v)}</text>
              ))}
            </g>
          );
        })}
        {/* เส้นค่ามาตรฐาน (ประดำ) */}
        {standard != null && (
          <g>
            <line x1={padL} x2={w-padR} y1={y(standard)} y2={y(standard)} stroke="#1B1E2C" strokeWidth="1.5" strokeDasharray="7 5"/>
            <text x={w-padR-4} y={y(standard)+15} textAnchor="end"
              style={{fontSize:12, fontWeight:800, fill:'#1B1E2C', paintOrder:'stroke', stroke:'#fff', strokeWidth:3.2}}>ค่ามาตรฐาน {window.fmt1(standard)} µg/m³</text>
          </g>
        )}
        {/* hover hit areas */}
        {labels.map((_,i) => (
          <rect key={i} x={x(i)-innerW/labels.length/2} y={padT} width={innerW/labels.length} height={innerH} fill="transparent"
            onMouseEnter={() => setHover({ i })}/>
        ))}
        {hover && (
          <line x1={x(hover.i)} x2={x(hover.i)} y1={padT} y2={padT+innerH} stroke="#1B1E2C" strokeDasharray="3 4" strokeWidth="1" opacity=".25"/>
        )}
      </svg>
      {hover && (
        <div className="tooltip" style={{ left: x(hover.i), top: padT + 4 }}>
          <div style={{fontWeight:600, marginBottom:4}}>{labels[hover.i]}</div>
          {series.map((s,si) => (
            <div key={si} style={{display:'flex', alignItems:'center', gap:8}}>
              <span style={{width:8, height:8, borderRadius:2, background:s.color}}/>
              <span style={{opacity:.85}}>{s.name}</span>
              <strong style={{marginLeft:'auto'}}>{(s.values[hover.i] != null && +s.values[hover.i] >= 0) ? s.values[hover.i] + (s.unit||'') : 'ไม่มีข้อมูล'}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------- BarGroup ----------
const BarGroup = ({ groups, labels, w = 720, h = 260, yMax, showValues = false, valueDecimals = 1 }) => {
  const [hover, setHover] = useState(null);
  const padL = 38, padR = 14, padT = 12, padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const max = yMax ?? Math.max(...groups.flatMap(g => g.values)) * 1.2;
  const groupW = innerW / labels.length;
  const barW = (groupW - 14) / groups.length;
  return (
    <div style={{ position:'relative', width: w }}>
      <svg width={w} height={h} onMouseLeave={() => setHover(null)}>
        {Array.from({length:5}).map((_,i) => {
          const v = Math.round(max * (1 - i/4));
          const yy = padT + (innerH/4)*i;
          return <g key={i}>
            <line x1={padL} x2={w-padR} y1={yy} y2={yy} className="grid-line"/>
            <text x={padL-8} y={yy+3} textAnchor="end" style={{fontSize:10.5, fill:'#8A8FA5'}}>{v}</text>
          </g>;
        })}
        {labels.map((l,i) => {
          const gx = padL + i*groupW;
          return (
            <g key={i}>
              <text x={gx + groupW/2} y={h-padB+16} textAnchor="middle" style={{fontSize:10.5, fill:'#8A8FA5'}}>{l}</text>
              {groups.map((g,gi) => {
                const bx = gx + 7 + gi*barW;
                const v = g.values[i];
                const hasV = v != null && Number.isFinite(+v) && +v >= 0;   // null/-1 = ไม่มีข้อมูล -> ไม่วาดแท่ง (ระวัง +null===0)
                const by = padT + innerH - (v/max)*innerH;
                const bh = (v/max)*innerH;
                const isHover = hover?.i===i && hover?.gi===gi;
                return (
                  <g key={gi}>
                    {hasV ? (
                      <rect x={bx} y={by} width={barW-2} height={Math.max(2,bh)} rx="4"
                        fill={g.color} opacity={isHover?1:.88}
                        onMouseEnter={() => setHover({ i, gi })}
                        style={{transition:'opacity .2s'}}/>
                    ) : (
                      <text x={bx + (barW-2)/2} y={padT + innerH - 4} textAnchor="middle"
                        style={{fontSize:9.5, fill:'#B4B9C6', fontWeight:600}}>ไม่มีข้อมูล</text>
                    )}
                    {showValues && hasV && bh > 8 && (
                      <text x={bx + (barW-2)/2} y={by - 5} textAnchor="middle"
                        style={{fontSize:13, fill:'#50556B', fontWeight:700}}>{valueDecimals === 0 ? Math.round(v) : window.fmt1(v)}</text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      {hover && (
        <div className="tooltip" style={{
          left: padL + hover.i*groupW + groupW/2,
          top: padT + 6,
        }}>
          <div style={{fontWeight:600, marginBottom:4}}>{labels[hover.i]}</div>
          {groups.map((g,gi) => (
            <div key={gi} style={{display:'flex', alignItems:'center', gap:8}}>
              <span style={{width:8, height:8, borderRadius:2, background:g.color}}/>
              <span>{g.name}</span>
              <strong style={{marginLeft:'auto'}}>{g.values[hover.i]}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------- Donut ----------
const Donut = ({ value, max = 100, size = 120, color = '#6FA0E6', label, sub }) => {
  const r = size/2 - 10;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, value/max);
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{display:'block'}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F0F1F7" strokeWidth="10"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="10"
          strokeLinecap="round" strokeDasharray={`${c*pct} ${c}`} transform={`rotate(-90 ${size/2} ${size/2})`}/>
      </svg>
      <div style={{position:'absolute', inset:0, display:'grid', placeItems:'center', textAlign:'center'}}>
        <div>
          <div style={{fontSize:22, fontWeight:700, letterSpacing:'-.5px'}}>{label ?? value}</div>
          {sub && <div style={{fontSize:11, color:'#8A8FA5'}}>{sub}</div>}
        </div>
      </div>
    </div>
  );
};

// ---------- PieChart (สำหรับแสดงสัดส่วน) ----------
const PieChart = ({ data, size = 200 }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return null;
  const r = size / 2 - 6;
  const cx = size / 2;
  const cy = size / 2;
  let cumulative = 0;
  const segments = data.map((d, i) => {
    const startAngle = (cumulative / total) * Math.PI * 2;
    cumulative += d.value;
    const endAngle = (cumulative / total) * Math.PI * 2;
    const largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.sin(startAngle);
    const y1 = cy - r * Math.cos(startAngle);
    const x2 = cx + r * Math.sin(endAngle);
    const y2 = cy - r * Math.cos(endAngle);
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    const midAngle = (startAngle + endAngle) / 2;
    const labelR = r * 0.62;
    const lx = cx + labelR * Math.sin(midAngle);
    const ly = cy - labelR * Math.cos(midAngle);
    const pct = (d.value / total * 100).toFixed(1);
    return { ...d, path, lx, ly, pct };
  });
  return (
    <div style={{ width:'100%', maxWidth: size + 'px', margin:'0 auto' }}>
      <svg viewBox={`0 0 ${size} ${size}`}
           style={{ display:'block', width:'100%', height:'auto' }}
           preserveAspectRatio="xMidYMid meet">
        {segments.map((s, i) => (
          <g key={i}>
            <path d={s.path} fill={s.color} stroke="#fff" strokeWidth="2"/>
            <text x={s.lx} y={s.ly} textAnchor="middle" dominantBaseline="middle"
              style={{ fontSize: 16, fontWeight: 700, fill: '#fff', textShadow:'0 1px 2px rgba(0,0,0,.25)' }}>
              {s.pct}%
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

// ---------- DiseasePmCombo (กราฟแท่งโรค + จุด PM2.5 แกนขวา + เส้นมาตรฐาน) ----------
const DiseasePmCombo = ({ labels, diseases, pmValues, pmStd = 37.5, w = 1500, h = 380 }) => {
  const [hover, setHover] = useState(null);
  const padL = 46, padR = 54, padT = 30, padB = 56;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const n = labels.length;

  // แกนซ้าย = อัตราป่วย (ราย/แสน)
  const leftMax = Math.max(1, ...diseases.flatMap(d => d.values)) * 1.20;
  // แกนขวา = PM2.5 (μg/m³) — เผื่อให้เห็นเส้นมาตรฐานเสมอ
  const rightMax = Math.max(40, pmStd, ...pmValues) * 1.18;

  const groupW = innerW / n;
  const nBars = diseases.length;
  const barGap = 3;
  const groupPad = groupW * 0.14;
  const barW = (groupW - groupPad * 2 - barGap * (nBars - 1)) / nBars;

  const yL = v => padT + innerH - (v / leftMax) * innerH;
  const yR = v => padT + innerH - (v / rightMax) * innerH;
  const xCenter = i => padL + groupW * i + groupW / 2;

  const pmPts = pmValues.map((v, i) => ({ x: xCenter(i), y: yR(v), v }));
  const pmPath = pmPts.map((p, i) => (i ? 'L' : 'M') + p.x + ' ' + p.y).join(' ');
  const ticks = 5;

  return (
    <div style={{ position:'relative', width: w }}>
      <svg width={w} height={h} onMouseLeave={() => setHover(null)}>
        {/* grid + แกนซ้าย */}
        {Array.from({ length: ticks + 1 }).map((_, i) => {
          const v = (leftMax / ticks) * i;
          const y = yL(v);
          return (
            <g key={'g' + i}>
              <line x1={padL} x2={w - padR} y1={y} y2={y} className="grid-line" />
              <text x={padL - 8} y={y + 3} textAnchor="end" style={{ fontSize: 10.5, fill: '#8A8FA5' }}>{Math.round(v)}</text>
            </g>
          );
        })}
        {/* แกนขวา (PM2.5) */}
        {Array.from({ length: ticks + 1 }).map((_, i) => {
          const v = (rightMax / ticks) * i;
          return (
            <text key={'r' + i} x={w - padR + 8} y={yR(v) + 3} textAnchor="start" style={{ fontSize: 10.5, fill: '#C98A5C' }}>{Math.round(v)}</text>
          );
        })}

        {/* แท่งโรค */}
        {labels.map((lab, i) => {
          const gx = padL + groupW * i + groupPad;
          return (
            <g key={i}>
              <text x={xCenter(i)} y={h - padB + 18} textAnchor="middle" style={{ fontSize: 11, fill: '#8A8FA5' }}>{lab}</text>
              {diseases.map((d, di) => {
                const v = d.values[i];
                const bx = gx + di * (barW + barGap);
                const by = yL(v);
                const bh = padT + innerH - by;
                const isHover = hover === i;
                return (
                  <g key={di}>
                    <rect x={bx} y={by} width={Math.max(1, barW)} height={Math.max(1, bh)} rx="3"
                      fill={d.color} opacity={isHover ? 1 : 0.9}
                      onMouseEnter={() => setHover(i)} style={{ transition:'opacity .2s' }} />
                    <text x={bx + barW / 2} y={by - 4}
                      transform={`rotate(-90 ${bx + barW / 2} ${by - 4})`}
                      textAnchor="start" style={{ fontSize: 9.5, fill: '#50556B', fontWeight: 700 }}>{Math.round(v)}</text>
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* เส้นมาตรฐาน PM2.5 (แกนขวา) */}
        <line x1={padL} x2={w - padR} y1={yR(pmStd)} y2={yR(pmStd)} stroke="#1B1E2C" strokeWidth="1.5" strokeDasharray="7 5" />

        {/* เส้น + จุด PM2.5 (แกนขวา) */}
        <path d={pmPath} fill="none" stroke="#E07A4C" strokeWidth="2.5" />
        {pmPts.map((p, i) => (
          <g key={'pm' + i}>
            <circle cx={p.x} cy={p.y} r="5" fill="#fff" stroke="#E07A4C" strokeWidth="2.5" />
            <text x={p.x} y={p.y - 11} textAnchor="middle" style={{ fontSize: 10, fill: '#C25E2E', fontWeight: 700 }}>{window.fmt1(p.v)}</text>
          </g>
        ))}

        {/* ชื่อแกน */}
        <text x={4} y={padT - 12} style={{ fontSize: 10.5, fill: '#50556B', fontWeight: 600 }}>จำนวน (ราย)</text>
        <text x={w - padR + 2} y={padT - 12} textAnchor="start" style={{ fontSize: 10.5, fill: '#C98A5C', fontWeight: 600 }}>μg/m³</text>
      </svg>

      {hover !== null && (
        <div className="tooltip" style={{ left: padL + hover * groupW + groupW / 2, top: padT + 6 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{labels[hover]}</div>
          {diseases.map((d, di) => (
            <div key={di} style={{ display:'flex', alignItems:'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color }} />
              <span>{d.name}</span>
              <strong style={{ marginLeft:'auto' }}>{Math.round(d.values[hover])}</strong>
            </div>
          ))}
          <div style={{ display:'flex', alignItems:'center', gap: 8, marginTop: 4, paddingTop: 4, borderTop:'1px solid #ECEDF3' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background:'#E07A4C' }} />
            <span>PM2.5 เฉลี่ย</span>
            <strong style={{ marginLeft:'auto' }}>{window.fmt1(pmValues[hover])}</strong>
          </div>
        </div>
      )}
    </div>
  );
};

Object.assign(window, { Icon, Sparkline, LineChart, BarGroup, Donut, PieChart, DiseasePmCombo });
