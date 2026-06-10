// Page 3: District / Tambon drill-down from GISDA
const { useState: useState3, useMemo: useMemo3, useEffect: useEffect3, useRef: useRef3 } = React;

const normalizeDistrictName = (name) => String(name || '').replace(/^อำเภอ/, '').replace(/\s+/g, '').trim();

const DistrictGoogleMap = ({ prov, districts, district, setDistrict }) => {
  const mapEl = useRef3(null);
  const mapInst = useRef3(null);
  const infoWin = useRef3(null);
  const listeners = useRef3([]);
  const [geoReady, setGeoReady] = useState3(false);

  const provObj = window.PROVINCES.find(p => p.code === prov);
  const selectedName = district || (districts[0] && districts[0].name);

  const clearListeners = () => {
    listeners.current.forEach(l => window.google && window.google.maps && window.google.maps.event.removeListener(l));
    listeners.current = [];
  };

  const fitProvince = () => {
    const map = mapInst.current;
    const g = window.google && window.google.maps;
    if (!map || !g || !provObj) return;
    const bounds = new g.LatLngBounds();
    map.data.forEach(feature => {
      if (feature.getProperty('NAME1') !== provObj.name) return;
      feature.getGeometry().forEachLatLng(latLng => bounds.extend(latLng));
    });
    if (!bounds.isEmpty()) map.fitBounds(bounds, 28);
  };

  useEffect3(() => {
    if (mapInst.current || !window.google || !window.google.maps) return;
    const g = window.google.maps;
    const map = new g.Map(mapEl.current, {
      center: { lat: 16.30, lng: 103.20 },
      zoom: 8,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
      clickableIcons: false,
      gestureHandling: 'greedy',
      styles: [
        { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
        { featureType: 'poi.medical', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
      ],
    });
    mapInst.current = map;
    infoWin.current = new g.InfoWindow({ disableAutoPan: true });

    fetch('district-boundaries-r7.geojson?ts=' + Date.now(), { cache: 'no-store' })
      .then(res => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(geo => {
        map.data.addGeoJson(geo);
        setGeoReady(true);
      })
      .catch(err => console.warn('district-boundaries-r7.geojson fetch failed:', err));

    const onResize = () => {
      g.event.trigger(map, 'resize');
      fitProvince();
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      clearListeners();
    };
  }, []);

  useEffect3(() => {
    const map = mapInst.current;
    if (!map || !window.google || !window.google.maps || !geoReady || !provObj) return;
    const g = window.google.maps;
    clearListeners();

    const districtMap = new Map(districts.map(d => [normalizeDistrictName(d.name), d]));
    const selectedKey = normalizeDistrictName(selectedName);

    const featureInfo = (feature) => {
      const provName = feature.getProperty('NAME1');
      const distName = feature.getProperty('NAME2');
      const d = districtMap.get(normalizeDistrictName(distName));
      return { provName, distName, d };
    };

    map.data.setStyle(feature => {
      const { provName, distName, d } = featureInfo(feature);
      if (provName !== provObj.name) return { visible: false };
      const pm = d ? d.pm : 0;
      const band = d ? window.bandOf(pm) : { color: '#E6EAF2', text: '#6E7488' };
      const isSel = normalizeDistrictName(distName) === selectedKey;
      return {
        visible: true,
        fillColor: band.color,
        fillOpacity: isSel ? 0.72 : 0.46,
        strokeColor: isSel ? '#2F6FCF' : band.text,
        strokeOpacity: 0.95,
        strokeWeight: isSel ? 2.6 : 1.4,
        clickable: true,
      };
    });

    // สร้างเนื้อหา popup + เปิด ณ ตำแหน่งที่กำหนด
    const showDistrictInfo = (feature, latLng) => {
      const { provName, distName, d } = featureInfo(feature);
      const band = d ? window.bandOf(d.pm) : null;
      infoWin.current.setContent(`
        <div style="min-width:220px;line-height:1.65">
          <div style="font-weight:800;font-size:14px;margin-bottom:4px">อำเภอ${distName}</div>
          <div><b>จังหวัด:</b> ${provName}</div>
          <div><b>ค่าฝุ่น:</b> ${d ? window.fmt1(d.pm) + ' µg/m³' : 'ไม่มีข้อมูล'}</div>
          <div><b>ระดับ:</b> ${band ? band.label : '-'}</div>
          <div><b>ตำบล:</b> ${d ? d.tambons.length : 0} ตำบล</div>
        </div>
      `);
      infoWin.current.setPosition(latLng);
      infoWin.current.open(map);
    };
    // จุดกึ่งกลางอำเภอ (วาง popup แบบเสถียร ไม่บังเคอร์เซอร์)
    const districtCentroid = (feature) => {
      const bounds = new g.LatLngBounds();
      feature.getGeometry().forEachLatLng(ll => bounds.extend(ll));
      return bounds.getCenter();
    };

    // เลื่อนเมาส์โดน = เด้ง popup ทันที (เดสก์ท็อป)
    listeners.current.push(map.data.addListener('mouseover', e => {
      const { provName } = featureInfo(e.feature);
      if (provName !== provObj.name) return;
      map.data.overrideStyle(e.feature, { fillOpacity: 0.68, strokeWeight: 2.4 });
      showDistrictInfo(e.feature, districtCentroid(e.feature));
    }));
    // เมาส์ออก = ปิด popup + คืนสีเดิม
    listeners.current.push(map.data.addListener('mouseout', e => {
      map.data.revertStyle(e.feature);
      infoWin.current.close();
    }));
    // แตะ = เลือกอำเภอ + เด้ง popup (มือถือ/แท็บเล็ต)
    listeners.current.push(map.data.addListener('click', e => {
      const { provName, d } = featureInfo(e.feature);
      if (provName !== provObj.name) return;
      if (d) setDistrict(d.name);
      showDistrictInfo(e.feature, districtCentroid(e.feature));
    }));

    fitProvince();
  }, [geoReady, prov, districts, district]);

  if (!window.google || !window.google.maps) {
    return (
      <div style={{ width:'100%', height:'100%', display:'grid', placeItems:'center', color:'#8A8FA5', background:'#F1F4F9' }}>
        กำลังโหลด Google Maps…
      </div>
    );
  }

  return <div ref={mapEl} style={{ width:'100%', height:'100%' }}/>;
};
const PageDistricts = () => {
  const [prov, setProv] = useState3('KKN');
  const [district, setDistrict] = useState3(null);

  const provObj = window.PROVINCES.find(p => p.code === prov);
  const districts = window.DISTRICTS[prov];
  const selDist = district ? districts.find(d => d.name === district) : districts[0];

  // Aggregate stats
  const allDist = Object.values(window.DISTRICTS).flat();
  const provMax = Math.max(...districts.map(d => d.pm));
  const provMin = Math.min(...districts.map(d => d.pm));
  const provAvg = Math.round(districts.reduce((a,b) => a+b.pm, 0) / districts.length * 10) / 10;

  const allTambons = districts.flatMap(d => d.tambons);
  const tambAvg = allTambons.length ? Math.round(allTambons.reduce((a,b)=>a+b.pm,0) / allTambons.length * 10) / 10 : 0;

  const provColors = {
    KKN: '#6FA0E6', KSN: '#E68A5C', MKM: '#5DBE8C', RET: '#9D7FE0'
  };
  const provBg = {
    KKN: 'var(--p-sky)', KSN: 'var(--p-peach)', MKM: 'var(--p-mint)', RET: 'var(--p-lav)'
  };

  return (
    <div className="view-enter">
      {/* Header pills */}
      <div className="flex between center" style={{ marginBottom: 18, flexWrap:'wrap', gap: 16 }}>
        <div className="prov-tabs">
          {window.PROVINCES.map(p => (
            <button key={p.code} className={'prov-tab ' + (prov===p.code?'active':'')} onClick={() => { setProv(p.code); setDistrict(null); }}>
              <span className="swatch" style={{ background: provColors[p.code] }}/>
              {p.name}
              <span style={{ fontSize: 11, color: '#8A8FA5', marginLeft: 4 }}>{window.DISTRICTS[p.code].length} อำเภอ</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2 center">
          <button className="chip" onClick={() => window.exportToExcel()} style={{cursor:'pointer'}}>
            <Icon name="download" size={14}/> Export Excel
          </button>
        </div>
      </div>

      {/* Snapshot for selected province */}
      <div className="kpi-grid">
        <div className="kpi">
          <div className="glow" style={{ background: provBg[prov] }}/>
          <div className="kpi-inner">
            <div className="kpi-label">{provObj.name} · ค่าเฉลี่ย</div>
            <div className="kpi-value">{window.fmt1(provAvg)} <span style={{ fontSize:14, color:'#8A8FA5', fontWeight:500 }}>μg/m³</span></div>
            <div className="kpi-foot">
              <span className="kpi-pill" style={{ background: window.bandOf(provAvg).color, color: window.bandOf(provAvg).text }}>{window.bandOf(provAvg).label}</span>
            </div>
          </div>
        </div>
        <div className="kpi">
          <div className="glow" style={{ background: '#FCE0E5' }}/>
          <div className="kpi-inner">
            <div className="kpi-label">อำเภอที่มีค่าสูงสุด</div>
            <div className="kpi-value">{window.fmt1(provMax)}</div>
            <div className="kpi-foot">
              <span style={{ color:'#1B1E2C', fontWeight:500 }}>{districts.find(d => d.pm===provMax).name}</span>
            </div>
          </div>
        </div>
        <div className="kpi">
          <div className="glow" style={{ background: 'var(--p-mint)' }}/>
          <div className="kpi-inner">
            <div className="kpi-label">อำเภอที่มีค่าต่ำสุด</div>
            <div className="kpi-value">{window.fmt1(provMin)}</div>
            <div className="kpi-foot">
              <span style={{ color:'#1B1E2C', fontWeight:500 }}>{districts.find(d => d.pm===provMin).name}</span>
            </div>
          </div>
        </div>
        <div className="kpi">
          <div className="glow" style={{ background: 'var(--p-lemon)' }}/>
          <div className="kpi-inner">
            <div className="kpi-label">ตำบลรวม / เฉลี่ย</div>
            <div className="kpi-value">{allTambons.length}<span style={{ fontSize:14, color:'#8A8FA5', fontWeight:500, marginLeft:6 }}>· ⌀ {window.fmt1(tambAvg)}</span></div>
            <div className="kpi-foot">
              <Sparkline data={[18,22,30,42,55,60,42,28,18,16,18,22]} color={provColors[prov]}/>
            </div>
          </div>
        </div>
      </div>

      {/* District map */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-h">
          <div>
            <h3 className="card-t">แผนที่ค่าฝุ่นรายอำเภอ · {provObj.name}</h3>
            <div className="card-st">ระบายสีตามค่า PM2.5 เฉลี่ยรายอำเภอจาก GISTDA · คลิกพื้นที่อำเภอเพื่อดูรายละเอียด</div>
          </div>
          <div className="flex gap-2" style={{ flexWrap:'wrap' }}>
            {window.PM_BANDS.map((b, i) => (
              <span key={i} className="chip" style={{ background: b.color, color: b.text, border:'none', fontWeight: 600 }}>
                ● {b.label}
              </span>
            ))}
          </div>
        </div>
        <div className="card-b">
          <div className="district-map-wrap">
            <DistrictGoogleMap prov={prov} districts={districts} district={district} setDistrict={setDistrict}/>
          </div>
        </div>
      </div>

      {/* District grid */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-h">
          <div>
            <h3 className="card-t">รายอำเภอ · {provObj.name}</h3>
            <div className="card-st">ค่า PM2.5 เฉลี่ย จากดาวเทียม GISDA</div>
          </div>
          <div className="flex gap-2" style={{ flexWrap:'wrap' }}>
            {window.PM_BANDS.map((b, i) => {
              const range = window.bandRange(i);
              return (
                <span key={i} className="chip" style={{ background: b.color, color: b.text, border:'none', fontWeight: 600 }}>
                  ● {b.label} <span style={{ opacity: .7, fontWeight: 500, marginLeft: 4 }}>{range}</span>
                </span>
              );
            })}
          </div>
        </div>
        <div className="card-b">
          <div className="dist-grid">
            {districts.sort((a,b)=>b.pm-a.pm).map(d => {
              const band = window.bandOf(d.pm);
              const sel = (district || districts[0].name) === d.name;
              return (
                <div key={d.name} className={'dist-tile ' + (sel?'sel':'')} onClick={() => setDistrict(d.name)}>
                  <div className="accent" style={{ background: band.color }}/>
                  <div className="dname">{d.name}</div>
                  <div className="dval">{window.fmt1(d.pm)}<span className="dunit">μg/m³</span></div>
                  <div className="dbar">
                    <div style={{ width: Math.min(100, d.pm/80*100) + '%', background: band.color }}/>
                  </div>
                  <div style={{ marginTop: 8, display:'flex', justifyContent:'space-between', fontSize:11, color:'#8A8FA5' }}>
                    <span>{d.tambons.length} ตำบล</span>
                    <span style={{ color: band.text, fontWeight: 600 }}>{band.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected district drill-down */}
      <div className="card">
        <div className="card-h">
          <div>
            <h3 className="card-t">รายตำบล · อำเภอ{selDist.name}</h3>
            <div className="card-st">{selDist.tambons.length} ตำบล · จัดเรียงตาม PM2.5</div>
          </div>
          <span className="chip" style={{ background: window.bandOf(selDist.pm).color, color: window.bandOf(selDist.pm).text, border:'none' }}>
            ⌀ อำเภอ {window.fmt1(selDist.pm)} μg/m³
          </span>
        </div>
        <div className="card-b">
          <div className="tambon-list">
            {selDist.tambons.sort((a,b)=>b.pm-a.pm).map(t => {
              const band = window.bandOf(t.pm);
              return (
                <div key={t.name} className="tambon-row">
                  <span className="sw" style={{ background: band.color }}/>
                  <span className="nm">ตำบล{t.name}</span>
                  <span className="ld">{band.label}</span>
                  <span className="pm">{window.fmt1(t.pm)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* All provinces side-by-side mini cards */}
      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-h">
          <div>
            <h3 className="card-t">เปรียบเทียบทุกจังหวัด · เขตสุขภาพที่ 7</h3>
            <div className="card-st">Top 5 อำเภอที่มีค่า PM2.5 สูงสุดต่อจังหวัด</div>
          </div>
        </div>
        <div className="card-b">
          <div className="grid-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {window.PROVINCES.map(p => {
              const top5 = window.DISTRICTS[p.code].slice().sort((a,b) => b.pm - a.pm).slice(0,5);
              const max = Math.max(...top5.map(t=>t.pm));
              return (
                <div key={p.code} style={{ padding: 14, background: '#fff', border:'1px solid var(--border)', borderRadius: 16 }}>
                  <div className="flex between center" style={{ marginBottom: 10 }}>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: provColors[p.code] }}/>
                  </div>
                  {top5.map(d => (
                    <div key={d.name} style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, alignItems:'center', padding:'5px 0' }}>
                      <div>
                        <div style={{ fontSize: 12.5 }}>{d.name}</div>
                        <div style={{ height: 4, background:'var(--surface-2)', borderRadius: 999, marginTop: 4 }}>
                          <div style={{ width: (d.pm/max)*100 + '%', height:'100%', background: provColors[p.code], borderRadius: 999, transition:'width 1s' }}/>
                        </div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{window.fmt1(d.pm)}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ===== กราฟ PM2.5 ย้อนหลังรายชั่วโมง รายจังหวัด (ล่างสุด) ===== */}
      {window.PM_HOURLY && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="card-h">
            <div>
              <h3 className="card-t">ค่าฝุ่น PM2.5 ย้อนหลังรายชั่วโมง · รายจังหวัด</h3>
              <div className="card-st">ข้อมูลวันที่ {window.PM_HOURLY.date} · 24 ชั่วโมง (µg/m³) · GISTDA · อัปเดต {window.PM_HOURLY.updated}</div>
            </div>
          </div>
          <div className="card-b">
            {/* legend: ขีดสี = เส้นแต่ละจังหวัด */}
            <div className="flex gap-3 center" style={{ flexWrap:'wrap', fontSize: 12.5, marginBottom: 12, color:'#50556B' }}>
              {[['ขอนแก่น','#6FA0E6'],['กาฬสินธุ์','#E68A5C'],['มหาสารคาม','#5DBE8C'],['ร้อยเอ็ด','#9D7FE0']].map(([n,c]) => (
                <span key={n} className="flex center gap-2">
                  <span style={{ width:18, height:4, borderRadius:2, background:c, display:'inline-block' }}/>{n}
                </span>
              ))}
            </div>
            <div className="chart-scroll">
              <LineChart
                labels={window.PM_HOURLY.hours}
                series={[
                  { name:'ขอนแก่น',   color:'#6FA0E6', values: window.PM_HOURLY.provinces.KKN, unit:' µg/m³', fill:false },
                  { name:'กาฬสินธุ์',  color:'#E68A5C', values: window.PM_HOURLY.provinces.KSN, unit:' µg/m³', fill:false },
                  { name:'มหาสารคาม', color:'#5DBE8C', values: window.PM_HOURLY.provinces.MKM, unit:' µg/m³', fill:false },
                  { name:'ร้อยเอ็ด',   color:'#9D7FE0', values: window.PM_HOURLY.provinces.RET, unit:' µg/m³', fill:false },
                ]}
                w={1500} h={340}
                showValues={true}
                standard={37.5}
              />
            </div>
            <div style={{ fontSize: 11, color:'#8A8FA5', marginTop: 6, textAlign:'center' }}>แกนนอน = เวลา (นาฬิกา 00:00–23:00) · แกนตั้ง = ค่าฝุ่น PM2.5 (µg/m³)</div>
          </div>
        </div>
      )}
    </div>
  );
};

window.PageDistricts = PageDistricts;
