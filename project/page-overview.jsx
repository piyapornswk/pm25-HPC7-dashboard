// Page 1: Overview — map + stations + disease + behaviors + clean rooms
const { useState: useState1, useMemo: useMemo1, useEffect: useEffect1, useRef: useRef1 } = React;

// ===== Google Maps real-map component =====
const GoogleMapView = ({ showLayer, selStation, setSelStation }) => {
  const mapEl = useRef1(null);
  const mapInst = useRef1(null);
  const overlays = useRef1([]);
  const infoWin = useRef1(null);
  const boundaryLoaded = useRef1(false);

  const clearOverlays = () => {
    overlays.current.forEach(o => o.setMap && o.setMap(null));
    overlays.current = [];
  };

  // init once
  useEffect1(() => {
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
    infoWin.current = new g.InfoWindow({ disableAutoPan: true });

    mapInst.current = map;
    const onResize = () => {
      g.event.trigger(map, 'resize');
      map.setCenter({ lat: 16.30, lng: 103.20 });
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      clearOverlays();
    };
  }, []);

  // re-draw layer on change
  useEffect1(() => {
    if (!mapInst.current || !window.google || !window.google.maps) return;
    clearOverlays();
    const g = window.google.maps;
    const map = mapInst.current;
    if (showLayer !== 'stations') map.data.setMap(null);

    if (showLayer === 'stations') {
      const provinceStations = {};
      window.STATIONS.forEach(s => {
        if (!provinceStations[s.prov]) provinceStations[s.prov] = [];
        provinceStations[s.prov].push(s);
      });

      const styleProvince = (feature) => {
        const code = feature.getProperty('code');
        const stations = provinceStations[code] || [];
        const avg = stations.length
          ? stations.reduce((sum, s) => sum + (+s.pm25 || 0), 0) / stations.length
          : 0;
        const band = window.bandOf(avg);
        return {
          fillColor: band.color,
          fillOpacity: 0.48,
          strokeColor: band.text,
          strokeOpacity: 0.95,
          strokeWeight: 1.6,
          clickable: true,
        };
      };

      const bindProvinceEvents = () => {
        map.data.setStyle(styleProvince);

        // สร้างเนื้อหา popup แล้วเปิด ณ ตำแหน่งเมาส์
        const showInfo = (feature, latLng) => {
          const code = feature.getProperty('code');
          const provName = feature.getProperty('name_th') || code;
          const stations = provinceStations[code] || [];
          const avg = stations.length
            ? stations.reduce((sum, s) => sum + (+s.pm25 || 0), 0) / stations.length
            : 0;
          const band = window.bandOf(avg);
          const stationRows = stations.map(s => `
            <div style="padding:6px 0;border-top:1px solid #EEF0F5">
              <div><b>ชื่อสถานี:</b> ${s.name}</div>
              <div><b>จังหวัด:</b> ${provName}</div>
              <div><b>ค่าฝุ่น:</b> ${window.fmt1(s.pm25)} µg/m³</div>
            </div>
          `).join('');
          infoWin.current.setContent(`
            <div style="min-width:230px">
              <div style="font-weight:800;font-size:14px;margin-bottom:4px">${provName}</div>
              <div style="margin-bottom:8px"><b>ค่าเฉลี่ยจังหวัด:</b> ${window.fmt1(avg)} µg/m³ · ${band.label}</div>
              ${stationRows || '<div style="color:#8A8FA5">ไม่มีข้อมูลสถานี</div>'}
            </div>
          `);
          infoWin.current.setPosition(latLng);
          infoWin.current.open(map);
        };

        // หาจุดกึ่งกลางจังหวัด (สำหรับวาง popup แบบเสถียร ไม่บังเคอร์เซอร์)
        const centroidOf = (feature) => {
          const bounds = new g.LatLngBounds();
          feature.getGeometry().forEachLatLng(ll => bounds.extend(ll));
          return bounds.getCenter();
        };

        // เลื่อนเมาส์โดนจังหวัด = เด้ง popup ทันที (เดสก์ท็อป)
        map.data.addListener('mouseover', (e) => {
          map.data.overrideStyle(e.feature, { fillOpacity: 0.64, strokeWeight: 2.4 });
          showInfo(e.feature, centroidOf(e.feature));
        });
        // เมาส์ออก = ปิด popup + คืนสีเดิม
        map.data.addListener('mouseout', (e) => {
          map.data.revertStyle(e.feature);
          infoWin.current.close();
        });
        // แตะ = เด้ง popup (มือถือ/แท็บเล็ตที่ไม่มี hover)
        map.data.addListener('click', (e) => {
          showInfo(e.feature, centroidOf(e.feature));
        });
      };

      map.data.setMap(map);
      if (!boundaryLoaded.current) {
        fetch('province-boundaries-r7.geojson?ts=' + Date.now(), { cache: 'no-store' })
          .then(res => {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
          })
          .then(geo => {
            if (boundaryLoaded.current) return;
            map.data.addGeoJson(geo);
            boundaryLoaded.current = true;
            bindProvinceEvents();
            const bounds = new g.LatLngBounds();
            map.data.forEach(feature => {
              feature.getGeometry().forEachLatLng(latLng => bounds.extend(latLng));
            });
            if (!bounds.isEmpty()) map.fitBounds(bounds, 24);
          })
          .catch(err => {
            console.warn('province-boundaries-r7.geojson fetch failed:', err);
          });
      } else {
        map.data.setStyle(styleProvince);
        map.data.setMap(map);
      }
    } else if (showLayer === 'rooms') {
      const C = {
        KKN:{ lat:16.43, lng:102.83, name:'ขอนแก่น' },
        KSN:{ lat:16.43, lng:103.50, name:'กาฬสินธุ์' },
        MKM:{ lat:16.18, lng:103.30, name:'มหาสารคาม' },
        RET:{ lat:16.06, lng:103.65, name:'ร้อยเอ็ด' },
      };
      window.CLEAN_ROOMS.forEach(cr => {
        const p = C[cr.prov];
        if (!p) return;
        const circle = new g.Circle({
          strokeColor: '#5DBE8C',
          strokeOpacity: 0.9,
          strokeWeight: 1.5,
          fillColor: '#5DBE8C',
          fillOpacity: 0.18,
          map,
          center: { lat: p.lat, lng: p.lng },
          radius: Math.sqrt(cr.total) * 1800,
        });
        const marker = new g.Marker({
          position: { lat: p.lat, lng: p.lng },
          map,
          title: p.name,
          icon: {
            path: g.SymbolPath.CIRCLE,
            scale: 24,
            fillColor: '#fff',
            fillOpacity: 1,
            strokeColor: '#5DBE8C',
            strokeWeight: 3,
          },
          label: {
            text: String(cr.total),
            color: '#2F7C58',
            fontSize: '13px',
            fontWeight: '800',
          },
        });
        marker.addListener('click', () => {
          infoWin.current.setContent(`<b>${p.name}</b><br>ห้องปลอดฝุ่นทั้งหมด: <b>${cr.total}</b><br>${window.CLEAN_ROOM_TYPES.map(t => `${t.short} ${cr[t.key]}`).join(' · ')}`);
          infoWin.current.open(map, marker);
        });
        overlays.current.push(circle, marker);
      });
    }
  }, [showLayer, selStation]);

  if (!window.google || !window.google.maps) {
    return (
      <div style={{ width:'100%', height:'100%', borderRadius: 14, display:'grid', placeItems:'center', color:'#8A8FA5', background:'#F1F4F9' }}>
        กำลังโหลด Google Maps…
      </div>
    );
  }

  return <div ref={mapEl} style={{ width:'100%', height:'100%', borderRadius: 14 }}/>;
};

const Connecting = () => (
  <span style={{ display:'inline-flex', alignItems:'center', gap:8, fontSize:16, fontWeight:600, color:'#8A8FA5' }}>
    <span style={{ position:'relative', display:'inline-flex', width:9, height:9 }}>
      <span style={{ position:'absolute', inset:0, borderRadius:'50%', background:'#FFB07A', opacity:.6, animation:'pulse 1.4s ease-out infinite' }}/>
      <span style={{ position:'relative', width:9, height:9, borderRadius:'50%', background:'#FFB07A' }}/>
    </span>
    กำลังเชื่อมต่อ…
  </span>
);

const PageOverview = ({ status = {} }) => {
  const { air = true, disease = true, room = true } = status;
  const [selStation, setSelStation] = useState1(window.STATIONS[Math.min(2, window.STATIONS.length-1)].id);
  const [hoverStn, setHoverStn] = useState1(null);
  const [showLayer, setShowLayer] = useState1('stations');
  const [behaviorProv, setBehaviorProv] = useState1('ALL');

  const regional = useMemo1(() => {
    const arr = window.STATIONS.map((s) => s.pm25);
    return {
      avg: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10,
      max: Math.max(...arr),
      min: Math.min(...arr),
      stations: arr.length
    };
  }, []);

  const totalCleanRooms = window.CLEAN_ROOMS.reduce((a, b) => a + b.total, 0);
  // รวมจำนวนแต่ละประเภทจากทุกจังหวัด
  const totalsByType = window.CLEAN_ROOM_TYPES.reduce((acc, t) => {
    acc[t.key] = window.CLEAN_ROOMS.reduce((sum, cr) => sum + (cr[t.key] || 0), 0);
    return acc;
  }, {});
  // สเกล donut: ปัดขึ้นเป็นหลักร้อยเหนือจังหวัดที่มากสุด (RET ~482 → 500)
  const cleanRoomDonutMax = Math.max(100, Math.ceil(Math.max(...window.CLEAN_ROOMS.map(c => c.total)) / 100) * 100);
  // ยอดผู้ป่วยสะสมจริง = รวม 4 กลุ่มโรค × ทุกสัปดาห์ ของทั้งเขต (จาก window.DISEASE_WEEKLY.ALL)
  const diseaseWeeksN = (window.DISEASE_WEEKS || []).length;
  const totalPatients = (() => {
    const all = (window.DISEASE_WEEKLY && window.DISEASE_WEEKLY.ALL) || {};
    return ['resp', 'cvd', 'eye', 'skin'].reduce((sum, g) =>
      sum + (all[g] || []).reduce((a, b) => a + (b || 0), 0), 0);
  })();

  const sel = window.STATIONS.find((s) => s.id === selStation);
  const selBand = window.bandOf(sel.pm25);

  // Project lat/lng to SVG coords (rough affine within bounding box of region)
  const bbox = { minLng: 102.55, maxLng: 104.20, minLat: 15.95, maxLat: 16.55 };
  const SW = 720,SH = 420;
  const proj = (lng, lat) => ({
    x: 40 + (lng - bbox.minLng) / (bbox.maxLng - bbox.minLng) * (SW - 80),
    y: 40 + (1 - (lat - bbox.minLat) / (bbox.maxLat - bbox.minLat)) * (SH - 80)
  });

  return (
    <div className="view-enter">
      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi">
          <div className="glow" style={{ background: window.bandOf(regional.avg).color }} />
          <div className="kpi-inner">
            <div className="kpi-label">PM2.5 เฉลี่ยทั้งเขตสุขภาพที่ 7 · μg/m³</div>
            <div className="kpi-value">{air ? window.fmt1(regional.avg) : <Connecting/>}</div>
            <div className="kpi-foot">
              <span>รวมทั้ง 4 จังหวัด</span>
            </div>
          </div>
        </div>
        <div className="kpi">
          <div className="glow" style={{ background: 'var(--p-lav)' }} />
          <div className="kpi-inner">
            <div className="kpi-label">สถานีตรวจวัด · Air4Thai</div>
            <div className="kpi-value">{air ? <>{regional.stations}<span style={{ fontSize: 14, color: '#8A8FA5', fontWeight: 500, marginLeft: 6 }}>สถานี</span></> : <Connecting/>}</div>
            <div className="kpi-foot">
              <span className="kpi-pill">ออนไลน์ทั้งหมด</span>
              <Sparkline data={[6, 7, 7, 8, 8, 8, 8]} color="#9D7FE0" />
            </div>
          </div>
        </div>
        <div className="kpi">
          <div className="glow" style={{ background: 'var(--p-mint)' }} />
          <div className="kpi-inner">
            <div className="kpi-label">ห้องปลอดฝุ่นที่ขึ้นทะเบียน</div>
            <div className="kpi-value">{room ? totalCleanRooms.toLocaleString() : <Connecting/>}</div>
            <div className="kpi-foot">
              <span>ในเดือนนี้</span>
            </div>
          </div>
        </div>
        <div className="kpi">
          <div className="glow" style={{ background: 'var(--p-peach)' }} />
          <div className="kpi-inner">
            <div className="kpi-label">ผู้ป่วยจากมลพิษทางอากาศ (สะสม)</div>
            <div className="kpi-value">{disease ? totalPatients.toLocaleString() : <Connecting/>}</div>
            <div className="kpi-foot">
              <span>4 กลุ่มโรค · สะสม W1–W{diseaseWeeksN} ปี 2569 · HDC สธ.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Map + Stations */}
      <div className="grid-2" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="card-h">
            <div>
              <h3 className="card-t">แผนที่สถานการณ์ฝุ่นละอองขนาดไม่เกิน 2.5 ไมครอน · เขตสุขภาพที่ 7</h3>
              <div className="card-st">ขอนแก่น · กาฬสินธุ์ · มหาสารคาม · ร้อยเอ็ด</div>
            </div>
            <div className="tabs">
              {[
              { k: 'stations', l: 'สถานี' },
              { k: 'rooms', l: 'ห้องปลอดฝุ่น' }].
              map((t) =>
              <button key={t.k} className={'tab ' + (showLayer === t.k ? 'active' : '')} onClick={() => setShowLayer(t.k)}>{t.l}</button>
              )}
            </div>
          </div>
          <div className="card-b">
            <div className="map-wrap">
              <GoogleMapView showLayer={showLayer} selStation={selStation} setSelStation={setSelStation}/>

              {!air && showLayer === 'stations' && (
                <div style={{ position:'absolute', inset:0, zIndex:1000, display:'grid', placeItems:'center',
                  background:'rgba(247,251,255,.72)', backdropFilter:'blur(2px)', WebkitBackdropFilter:'blur(2px)' }}>
                  <div style={{ textAlign:'center' }}>
                    <Connecting/>
                    <div style={{ fontSize:12, color:'#8A8FA5', marginTop:8 }}>กำลังโหลดตำแหน่งสถานี Air4Thai…</div>
                  </div>
                </div>
              )}

              <div className="legend" style={{ zIndex: 500 }}>
                <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 12 }}>PM2.5 (μg/m³)</div>
                {window.PM_BANDS.map((b, i) => {
                  const range = window.bandRange(i);
                  return (
                    <div key={i} className="legend-row">
                      <span className="legend-sw" style={{ background: b.color }} />
                      <span style={{ width: 70 }}>{range}</span>
                      <span style={{ color: '#8A8FA5' }}>{b.label}</span>
                    </div>);

                })}
              </div>
            </div>
          </div>
        </div>

        {/* Station list */}
        <div className="card">
          <div className="card-h">
            <div>
              <h3 className="card-t" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <img src="images/Air4thai.png" alt="Air4Thai" style={{ width: 28, height: 28, objectFit: 'contain' }}/>
                <span>สถานีตรวจวัด Air4Thai</span>
              </h3>
            </div>
          </div>
          <div className="card-b">
            {!air ? (
              <div style={{ padding:'48px 16px', textAlign:'center' }}>
                <Connecting/>
                <div style={{ fontSize:11.5, color:'#8A8FA5', marginTop:10 }}>กำลังดึงข้อมูลสถานีจาก Air4Thai…</div>
              </div>
            ) : (<>
            <div className="stn-list">
              {window.STATIONS.map((s) => {
                const b = window.bandOf(s.pm25);
                const prov = window.PROVINCES.find((p) => p.code === s.prov);
                return (
                  <div key={s.id} className={'stn-item ' + (selStation === s.id ? 'sel' : '')} onClick={() => setSelStation(s.id)}>
                    <div className="stn-badge" style={{ background: b.color, color: b.text }}>{window.fmt1(s.pm25)}</div>
                    <div>
                      <div className="stn-name">{s.name}</div>
                      <div className="stn-meta">{prov.name}{s.amphoe ? ' · ' + s.amphoe : ''}{s.pm10 ? ' · PM10 ' + s.pm10 : ''}</div>
                    </div>
                    <div className="stn-arrow"><Icon name="chevron" size={14} /></div>
                  </div>);

              })}
            </div>
            <div className="divider" />
            {/* === Footer with gimmick: live status + mini sparkline + avg === */}
            {(() => {
              const vals = window.STATIONS.map(s => s.pm25);
              const avgRaw = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0;
              const avg = Math.round(avgRaw * 10) / 10;
              const maxV = Math.max(...vals, 1);
              const band = window.bandOf(avg);
              return (
                <div style={{ padding: '8px 6px 4px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:11.5, color:'#8A8FA5', fontWeight:500, marginBottom: 10 }}>
                    <span style={{ position:'relative', display:'inline-flex', width:8, height:8 }}>
                      <span style={{ position:'absolute', inset:0, borderRadius:'50%', background:'var(--a-mint)', opacity:.5, animation:'pulse 1.6s ease-out infinite' }}/>
                      <span style={{ position:'relative', width:8, height:8, borderRadius:'50%', background:'var(--a-mint)' }}/>
                    </span>
                    <span style={{ fontWeight:700, color:'#2E6A2E', letterSpacing:.5 }}>LIVE</span>
                    <span>· Air4Thai API · รีเฟรชทุก 60 นาที</span>
                  </div>
                  <div style={{
                    display:'flex', alignItems:'center', gap:12,
                    padding:'10px 14px', borderRadius:14,
                    background:'linear-gradient(135deg, #F7FBFF 0%, #F0F7FA 100%)',
                    border:'1px solid var(--border)'
                  }}>
                    <div style={{ display:'flex', flexDirection:'column', minWidth:84 }}>
                      <span style={{ fontSize:10.5, color:'#8A8FA5', fontWeight:500 }}>ค่าเฉลี่ยทุกสถานี</span>
                      <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
                        <span style={{ fontSize:22, fontWeight:800, color:band.text, lineHeight:1 }}>{window.fmt1(avg)}</span>
                        <span style={{ fontSize:10.5, color:'#8A8FA5' }}>μg/m³</span>
                      </div>
                      <span style={{
                        marginTop:4, fontSize:10, fontWeight:700, color:band.text,
                        background:band.color, padding:'2px 8px', borderRadius:999,
                        alignSelf:'flex-start'
                      }}>{band.label}</span>
                    </div>
                    {/* Sparkline */}
                    <div style={{ flex:1, display:'flex', alignItems:'flex-end', gap:4, height:48 }}>
                      {vals.map((v, i) => {
                        const b = window.bandOf(v);
                        const h = Math.max(8, (v / maxV) * 44);
                        return (
                          <div key={i} title={window.STATIONS[i].name + ': ' + window.fmt1(v) + ' μg/m³'}
                            style={{
                              flex:1, height:h, background:b.color,
                              borderRadius:'6px 6px 3px 3px',
                              position:'relative', cursor:'pointer',
                              transition:'all .25s', opacity:.9
                            }}
                            onMouseEnter={e => { e.currentTarget.style.opacity=1; e.currentTarget.style.transform='translateY(-2px)'; }}
                            onMouseLeave={e => { e.currentTarget.style.opacity=.9; e.currentTarget.style.transform='none'; }}>
                            <span style={{
                              position:'absolute', top:-14, left:'50%', transform:'translateX(-50%)',
                              fontSize:9.5, fontWeight:700, color:b.text
                            }}>{window.fmt1(v)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
            </>)}
          </div>
        </div>
      </div>

      {/* === คำแนะนำสำหรับประชาชนทั่วไป === */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-h">
          <div>
            <h3 className="card-t">คำแนะนำสำหรับประชาชนทั่วไป</h3>
            <div className="card-st">ตามระดับคุณภาพอากาศ PM2.5 ปัจจุบัน</div>
          </div>
        </div>
        <div className="card-b">
          <div className="grid-3" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
            {[
              { label: 'ดีมาก',            emoji: '😊', bg: '#EAF6FE', border: '#BFE0F5', text: '#1E5F87', advice: 'ทำกิจกรรมได้ตามปกติ' },
              { label: 'ดี',               emoji: '🙂', bg: '#EFFAEC', border: '#CDEBC4', text: '#2E6A2E', advice: 'ทำกิจกรรมได้ตามปกติ' },
              { label: 'ปานกลาง',          emoji: '😷', bg: '#FFF7E0', border: '#F5E5A8', text: '#7A5A12', advice: 'ลดหรือจำกัดการทำกิจกรรมกลางแจ้ง เฝ้าระวังอาการผิดปกติ' },
              { label: 'เริ่มมีผลกระทบ', emoji: '⚠️', bg: '#FFEBDC', border: '#F5C9A8', text: '#8A3E10', advice: 'ลดหรือจำกัดการทำกิจกรรมกลางแจ้ง เฝ้าระวังอาการผิดปกติ สวมใส่หน้ากากป้องกันฝุ่น' },
              { label: 'มีผลกระทบ',     emoji: '🚨', bg: '#FCE4E4', border: '#F0B8B8', text: '#7A1818', advice: 'งดการทำกิจกรรมกลางแจ้ง สวมใส่หน้ากากป้องกันฝุ่น มีอาการผิดปกติ รีบพบแพทย์' },
            ].map((item, idx) => (
              <div key={idx} style={{
                background: item.bg,
                border: '1px solid ' + item.border,
                borderRadius: 16,
                padding: '18px 16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: 10,
                transition: 'all .25s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}>
                <div style={{ fontSize: 32, lineHeight: 1 }}>{item.emoji}</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: item.text }}>{item.label}</div>
                <div style={{ fontSize: 12, color: '#50556B', lineHeight: 1.5 }}>{item.advice}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Disease chart (รายจังหวัด + PM2.5 combo) */}
      <DiseaseCard/>

      {/* === ร้อยละพฤติกรรมการป้องกันตนเองจากฝุ่น PM2.5 === */}
      <BehaviorCard behaviorProv={behaviorProv} setBehaviorProv={setBehaviorProv}/>

      {/* Clean rooms */}
      <div className="card">
        <div className="card-h">
          <div>
            <h3 className="card-t">ห้องปลอดฝุ่น (Clean Room) · เขตสุขภาพที่ 7</h3>
            <div className="card-st">{window.CLEAN_ROOM_TYPES.length} ประเภทอาคาร · {totalCleanRooms.toLocaleString()} แห่ง · ข้อมูลจริงจาก podfoon อนามัย</div>
          </div>
          <div className="flex gap-2 center" style={{ flexWrap:'wrap' }}>
            {window.CLEAN_ROOM_TYPES.map(t => (
              <span key={t.key} className="chip" title={t.label}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: t.color, display:'inline-block' }} />
                {t.short} <strong style={{ marginLeft: 4 }}>{totalsByType[t.key]}</strong>
              </span>
            ))}
          </div>
        </div>
        <div className="card-b">
          <div className="clean-rooms-grid">
            {window.CLEAN_ROOMS.map((cr) => {
              const prov = window.PROVINCES.find((p) => p.code === cr.prov);
              return (
                <div key={cr.prov} className="clean-room-card"
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}>
                  <Donut value={cr.total} max={cleanRoomDonutMax} size={88} color={prov.code === 'KKN' ? '#6FA0E6' : prov.code === 'KSN' ? '#E68A5C' : prov.code === 'MKM' ? '#5DBE8C' : '#9D7FE0'} label={cr.total} sub="แห่ง" />
                  <div className="clean-room-info">
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{prov.name}</div>
                    <div style={{ fontSize: 11.5, color: '#8A8FA5', marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {window.CLEAN_ROOM_TYPES.map(t => (
                        <span key={t.key}>{t.short} <strong style={{ color: '#1B1E2C' }}>{cr[t.key]}</strong></span>
                      ))}
                    </div>
                  </div>
                </div>);

            })}
          </div>
        </div>
      </div>

    </div>);

};

// ============ DiseaseCard: dropdown รายจังหวัด + combo (แท่งโรค + PM2.5) ============
const DiseaseCard = () => {
  const provOpts = [
    { code:'ALL', name:'ทั้งเขตสุขภาพที่ 7' },
    { code:'KKN', name:'ขอนแก่น' },
    { code:'KSN', name:'กาฬสินธุ์' },
    { code:'MKM', name:'มหาสารคาม' },
    { code:'RET', name:'ร้อยเอ็ด' },
  ];
  const [prov, setProv] = useState1('ALL');

  // ป้ายสัปดาห์ + จำนวนสัปดาห์ที่มีข้อมูล
  const labels = window.DISEASE_WEEKS || [];
  const n = labels.length;
  // ดึงข้อมูลรายสัปดาห์ของจังหวัดที่เลือก แล้วประกอบกับชื่อ/สี 4 กลุ่มโรค (จาก window.DISEASES)
  const wk = (window.DISEASE_WEEKLY && window.DISEASE_WEEKLY[prov]) || {};
  const diseases = window.DISEASES.map(d => ({
    key: d.key, name: d.name, color: d.color,
    values: (wk[d.key] || []).slice(0, n)
  }));
  // ค่าฝุ่น PM2.5 รายสัปดาห์ (สมมุติ) — ตัด/เติมให้ยาวเท่าจำนวนสัปดาห์
  const pmRaw = (window.PM_WEEKLY && window.PM_WEEKLY[prov]) || [];
  const pmValues = Array.from({ length: n }, (_, i) => (pmRaw[i] != null ? pmRaw[i] : 0));
  // ความกว้างกราฟ ~64px ต่อสัปดาห์ (เลื่อนแนวนอนได้)
  const chartW = Math.max(1100, n * 64);
  const provLabel = provOpts.find(o => o.code === prov).name;

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
          <h3 className="card-t">อัตราป่วยด้วยโรคจากมลพิษทางอากาศ · {provLabel}</h3>
          <div className="card-st">รายสัปดาห์ระบาดวิทยา ปี 2569 · ผู้ป่วยจาก HDC สธ. · เทียบ PM2.5 จริงจาก GISTDA (แกนขวา)</div>
        </div>
        <select value={prov} onChange={e => setProv(e.target.value)} style={selectStyle}>
          {provOpts.map(o => <option key={o.code} value={o.code}>{o.name}</option>)}
        </select>
      </div>
      <div className="card-b">
        {/* Legend */}
        <div className="flex gap-3 center" style={{ flexWrap:'wrap', marginBottom: 12, fontSize: 11.5, color:'#50556B' }}>
          {diseases.map(d => (
            <span key={d.key || d.name} className="flex center gap-2">
              <span style={{ width: 12, height: 12, borderRadius: 3, background: d.color }} />{d.name}
            </span>
          ))}
          <span className="flex center gap-2">
            <span style={{ width: 13, height: 13, borderRadius: '50%', background:'#fff', border:'2.5px solid #E07A4C', flexShrink: 0 }} />
            PM2.5 (μg/m³ · แกนขวา)
          </span>
          <span className="flex center gap-2">
            <span style={{ width: 18, borderTop:'2px dashed #1B1E2C', flexShrink: 0 }} />
            มาตรฐาน 37.5 μg/m³
          </span>
        </div>
        <div className="chart-scroll">
          <DiseasePmCombo
            key={prov}
            labels={labels}
            diseases={diseases}
            pmValues={pmValues}
            pmStd={37.5}
            w={chartW} h={380}
          />
        </div>
      </div>
    </div>
  );
};

// ============ BehaviorCard: dropdown + Pie + Grouped Bar ============
const BehaviorCard = ({ behaviorProv, setBehaviorProv }) => {
  const provOpts = [
    { code:'ALL', name:'ทั้งเขตสุขภาพที่ 7' },
    { code:'KKN', name:'ขอนแก่น' },
    { code:'KSN', name:'กาฬสินธุ์' },
    { code:'MKM', name:'มหาสารคาม' },
    { code:'RET', name:'ร้อยเอ็ด' },
  ];
  const bData = window.BEHAVIOR_BY_PROV[behaviorProv] || window.BEHAVIOR_BY_PROV.ALL;
  const provLabel = provOpts.find(o => o.code === behaviorProv).name;

  const selectStyle = {
    appearance:'none', WebkitAppearance:'none', MozAppearance:'none',
    padding:'8px 36px 8px 16px',
    background:'var(--surface)',
    border:'1px solid var(--border)', borderRadius: 999,
    fontSize: 13, color:'var(--ink)', cursor:'pointer',
    fontFamily:'inherit', fontWeight: 500,
    backgroundImage:'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%238A8FA5\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'/></svg>")',
    backgroundRepeat:'no-repeat',
    backgroundPosition:'right 12px center',
    boxShadow:'var(--shadow-sm)'
  };

  return (
    <>
      {/* ===== Card 1: Pie Chart + Insight Panel ===== */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-h">
          <div>
            <h3 className="card-t">🔥 ร้อยละพฤติกรรมการป้องกันตนเองจากฝุ่น PM2.5 · {provLabel}</h3>
            <div className="card-st">ข้อมูล ณ ปีงบประมาณ 2569 · n = {bData.n.toLocaleString()} ราย</div>
          </div>
          <div className="flex gap-2 center">
            <select value={behaviorProv} onChange={(e) => setBehaviorProv(e.target.value)} style={selectStyle}>
              {provOpts.map(o => (
                <option key={o.code} value={o.code}>{o.name}</option>
              ))}
            </select>
            <span className="chip"><Icon name="cal" size={14}/> ปีงบประมาณ 2569</span>
          </div>
        </div>
        <div className="card-b">
          <div className="pie-card-grid">
            {/* ซ้าย: Pie */}
            <div style={{ textAlign:'center', padding:'8px 0' }}>
              <PieChart key={behaviorProv} data={bData.levels.map(b => ({
                label: b.label, value: b.pct, color: b.color
              }))} size={260}/>
            </div>

            {/* ขวา: Stat panel */}
            <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', gap: 14 }}>
              {(() => {
                const sorted = [...bData.levels].sort((a,b) => b.pct - a.pct);
                const top = sorted[0];
                return (
                  <div style={{
                    background: `linear-gradient(135deg, ${top.color}15, ${top.color}05)`,
                    border: `1px solid ${top.color}40`,
                    borderRadius: 14, padding: '14px 16px'
                  }}>
                    <div style={{ fontSize: 11, color:'#8A8FA5', fontWeight: 600, textTransform:'uppercase', letterSpacing: .5 }}>
                      ✨ พฤติกรรมส่วนใหญ่
                    </div>
                    <div style={{ display:'flex', alignItems:'baseline', gap: 8, marginTop: 6 }}>
                      <span style={{ fontSize: 32, fontWeight: 800, color: top.color, lineHeight: 1 }}>{top.pct}%</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color:'#1B1E2C' }}>{top.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color:'#50556B', marginTop: 6 }}>
                      จากกลุ่มตัวอย่าง <strong>{bData.n.toLocaleString()}</strong> ราย
                    </div>
                  </div>
                );
              })()}

              {/* Detail legend with bars */}
              <div style={{ display:'flex', flexDirection:'column', gap: 12 }}>
                {bData.levels.map(b => {
                  const count = Math.round(bData.n * b.pct / 100);
                  return (
                    <div key={b.level}>
                      <div className="flex center gap-2" style={{ marginBottom: 4 }}>
                        <span style={{ width: 12, height: 12, borderRadius: 4, background: b.color, flexShrink: 0 }}/>
                        <span style={{ fontSize: 13, color:'#1B1E2C', fontWeight: 500 }}>{b.label}</span>
                        <span style={{ marginLeft:'auto', fontSize: 12, color:'#8A8FA5' }}>{count.toLocaleString()} ราย</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: b.color, minWidth: 50, textAlign:'right' }}>{b.pct}%</span>
                      </div>
                      <div style={{ height: 6, background:'var(--surface-2)', borderRadius: 999, overflow:'hidden' }}>
                        <div style={{
                          width: b.pct + '%', height:'100%',
                          background: `linear-gradient(90deg, ${b.color}aa, ${b.color})`,
                          borderRadius: 999,
                          transition: 'width 1s cubic-bezier(.2,.7,.1,1)'
                        }}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Card 2: Grouped Bar — รายพฤติกรรม 5 ประเภท ===== */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-h">
          <div>
            <h3 className="card-t">📊 พฤติกรรมการป้องกันตนเองจากการรับสัมผัส PM2.5 · {provLabel}</h3>
            <div className="card-st">5 พฤติกรรม · จำแนกตามความถี่ในการปฏิบัติ</div>
          </div>
          <div className="flex gap-3 center" style={{ flexWrap:'wrap', fontSize: 12 }}>
            <span className="flex center gap-2"><span style={{ width: 12, height: 12, borderRadius: 3, background:'#D9534F' }}/>ไม่เคยปฏิบัติ</span>
            <span className="flex center gap-2"><span style={{ width: 12, height: 12, borderRadius: 3, background:'#F5C84A' }}/>ปฏิบัติบางครั้ง</span>
            <span className="flex center gap-2"><span style={{ width: 12, height: 12, borderRadius: 3, background:'#3FAE6B' }}/>ปฏิบัติประจำ</span>
          </div>
        </div>
        <div className="card-b">
          <div className="chart-scroll">
            <BarGroup
              key={behaviorProv}
              labels={bData.details.map(b => b.short)}
              groups={[
                { name:'ไม่เคยปฏิบัติ',  color:'#D9534F', values: bData.details.map(b => b.never) },
                { name:'ปฏิบัติบางครั้ง', color:'#F5C84A', values: bData.details.map(b => b.sometimes) },
                { name:'ปฏิบัติประจำ',   color:'#3FAE6B', values: bData.details.map(b => b.regular) },
              ]}
              w={1100} h={340}
              showValues={true}
              valueDecimals={0}
            />
          </div>
          <div style={{ fontSize: 11, color:'#8A8FA5', marginTop: 8, lineHeight: 1.6 }}>
            ไม่เผาขยะ = ไม่เผาขยะ กระดาษ จุดธูป · ลดออกนอกบ้าน = ลดระยะเวลาออกนอกบ้าน · ปิดหน้าต่าง = ปิดประตูหน้าต่าง · เช็คอากาศ = ตรวจเช็คคุณภาพอากาศก่อนออกนอกบ้าน · งดออกแจ้ง = งดการออกกำลังกายกลางแจ้ง
          </div>
        </div>
      </div>
    </>
  );
};

window.PageOverview = PageOverview;
