// Page 4: Heat Index (ดัชนีความร้อน) — พยากรณ์จาก TMD NWP forecast_daily
const { useState: useStateH, useEffect: useEffectH, useRef: useRefH } = React;
const TH_MON_H = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const TH_DOW_H = ['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'];
const fmtDayH = (iso) => { const d = new Date(iso + 'T00:00:00'); return d.getDate() + ' ' + TH_MON_H[d.getMonth()]; };
const fmtDowH = (iso) => TH_DOW_H[new Date(iso + 'T00:00:00').getDay()];
const heatIndexCalcC = (tc, rh) => {
  const T = (+tc || 0) * 1.8 + 32;
  const R = +rh || 0;
  const hiF = -42.379 + 2.04901523*T + 10.14333127*R - 0.22475541*T*R - 0.00683783*T*T - 0.05481717*R*R + 0.00122874*T*T*R + 0.00085282*T*R*R - 0.00000199*T*T*R*R;
  return Math.round(((hiF - 32) / 1.8) * 10) / 10;
};
const heatIndexOf = (f) => Number.isFinite(+f?.hi) ? +f.hi : heatIndexCalcC(f?.tcMax, f?.rh);

const HeatProvinceMap = ({ provinces, loading, updated }) => {
  const mapEl = useRefH(null);
  const mapInst = useRefH(null);
  const infoWin = useRefH(null);
  const labels = useRefH([]);
  const heatDataRef = useRefH({});
  const boundaryLoaded = useRefH(false);

  const clearLabels = () => {
    labels.current.forEach(m => m.setMap && m.setMap(null));
    labels.current = [];
  };

  useEffectH(() => {
    if (mapInst.current || !window.google || !window.google.maps || !mapEl.current) return;
    const g = window.google.maps;
    const map = new g.Map(mapEl.current, {
      center: { lat: 16.25, lng: 103.25 },
      zoom: 8,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
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

    const onResize = () => {
      g.event.trigger(map, 'resize');
      map.setCenter({ lat: 16.25, lng: 103.25 });
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      clearLabels();
      map.data.setMap(null);
    };
  }, []);

  useEffectH(() => {
    if (!mapInst.current || !window.google || !window.google.maps || !Array.isArray(provinces)) return;
    const g = window.google.maps;
    const map = mapInst.current;
    const heatByCode = provinces.reduce((acc, p) => {
      const today = (p.forecasts || [])[0] || {};
      const hi = heatIndexOf(today);
      acc[p.code] = {
        name: p.name,
        hi,
        temp: +(today.hiTc || today.tcMax || 0),
        rh: +(today.hiRh || today.rh || 0),
        time: today.hiTime || '',
        updated,
        band: window.heatBandOf(hi),
      };
      return acc;
    }, {});
    heatDataRef.current = heatByCode;
    const centers = {
      KKN: { lat: 16.58, lng: 102.55 },
      KSN: { lat: 16.62, lng: 103.58 },
      MKM: { lat: 16.10, lng: 103.12 },
      RET: { lat: 16.05, lng: 103.78 },
    };

    const styleProvince = (feature) => {
      const code = feature.getProperty('code');
      const item = heatByCode[code];
      const band = item ? item.band : { color:'#E6EAF2', text:'#8A8FA5' };
      return {
        fillColor: band.color,
        fillOpacity: item ? 0.56 : 0.2,
        strokeColor: band.text,
        strokeOpacity: 0.95,
        strokeWeight: 1.7,
        clickable: true,
      };
    };

    const provCentroidH = (feature) => {
      const bounds = new g.LatLngBounds();
      feature.getGeometry().forEachLatLng(ll => bounds.extend(ll));
      return bounds.getCenter();
    };
    const showProvInfoH = (feature, latLng) => {
      const code = feature.getProperty('code');
      const provName = feature.getProperty('name_th') || code;
      const item = heatDataRef.current[code];
      if (!item) return;
      infoWin.current.setContent(`
        <div style="min-width:230px;line-height:1.65">
          <div style="font-weight:800;font-size:15px;margin-bottom:5px">${provName}</div>
          <div><b>Heat Index:</b> ${window.fmt1(item.hi)} °C HI</div>
          <div><b>อุณหภูมิที่ใช้คำนวณ:</b> ${window.fmt1(item.temp)} °C</div>
          <div><b>ความชื้น:</b> ${item.rh}%</div>
          <div><b>ระดับ:</b> <span style="background:${item.band.color};color:${item.band.text};padding:2px 8px;border-radius:999px;font-weight:700">${item.band.label}</span></div>
          ${item.time ? `<div><b>ช่วงเวลาสูงสุด:</b> ${item.time}</div>` : ''}
          <div style="margin-top:6px;color:#8A8FA5;font-size:11px">อัปเดตข้อมูล: ${item.updated || '-'}</div>
        </div>
      `);
      infoWin.current.setPosition(latLng);
      infoWin.current.open(map);
    };
    const bindEvents = () => {
      map.data.setStyle(styleProvince);
      // เลื่อนเมาส์โดน = เด้ง popup ทันที (เดสก์ท็อป)
      map.data.addListener('mouseover', e => {
        map.data.overrideStyle(e.feature, { fillOpacity: 0.72, strokeWeight: 2.5 });
        showProvInfoH(e.feature, provCentroidH(e.feature));
      });
      // เมาส์ออก = ปิด popup + คืนสีเดิม
      map.data.addListener('mouseout', e => {
        map.data.revertStyle(e.feature);
        infoWin.current.close();
      });
      // แตะ = เด้ง popup (มือถือ/แท็บเล็ต)
      map.data.addListener('click', e => {
        showProvInfoH(e.feature, provCentroidH(e.feature));
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
          bindEvents();
          const bounds = new g.LatLngBounds();
          map.data.forEach(feature => feature.getGeometry().forEachLatLng(latLng => bounds.extend(latLng)));
          if (!bounds.isEmpty()) map.fitBounds(bounds, 24);
        })
        .catch(err => console.warn('province-boundaries-r7.geojson fetch failed:', err));
    } else {
      map.data.setStyle(styleProvince);
      map.data.setMap(map);
    }

    clearLabels();
    Object.entries(heatByCode).forEach(([code, item]) => {
      const center = centers[code];
      if (!center) return;
      const marker = new g.Marker({
        position: center,
        map,
        title: item.name,
        icon: {
          path: g.SymbolPath.CIRCLE,
          scale: 24,
          fillColor: '#ffffff',
          fillOpacity: 0.92,
          strokeColor: item.band.text,
          strokeWeight: 2.6,
        },
        label: {
          text: window.fmt1(item.hi),
          color: item.band.text,
          fontSize: '13px',
          fontWeight: '900',
        },
        zIndex: 20,
      });
      const openMarkerInfo = () => {
        infoWin.current.setContent(`
          <div style="min-width:220px;line-height:1.65">
            <div style="font-weight:800;font-size:15px;margin-bottom:5px">${item.name}</div>
            <div><b>Heat Index:</b> ${window.fmt1(item.hi)} °C HI</div>
            <div><b>อุณหภูมิ:</b> ${window.fmt1(item.temp)} °C</div>
            <div><b>ความชื้น:</b> ${item.rh}%</div>
            <div><b>ระดับ:</b> ${item.band.label}</div>
          </div>
        `);
        infoWin.current.open(map, marker);
      };
      // เลื่อนเมาส์โดน = เด้งทันที, ออก = ปิด, แตะ = เด้ง (มือถือ)
      marker.addListener('mouseover', openMarkerInfo);
      marker.addListener('mouseout', () => infoWin.current.close());
      marker.addListener('click', openMarkerInfo);
      labels.current.push(marker);
    });
  }, [provinces, updated]);

  if (!window.google || !window.google.maps) {
    return (
      <div className="heat-province-map-empty">
        กำลังโหลด Google Maps...
      </div>
    );
  }

  return (
    <div className="heat-province-map-wrap">
      <div ref={mapEl} className="heat-province-map"/>
      {loading && (
        <div className="heat-map-loading">
          <Connecting/>
          <div>กำลังเชื่อมต่อข้อมูล TMD...</div>
        </div>
      )}
      <div className="legend heat-map-legend">
        <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 12 }}>Heat Index (°C)</div>
        {window.HEAT_BANDS.filter(b => b.label !== 'ปกติ').map(b => (
          <div key={b.label} className="legend-row">
            <span className="legend-sw" style={{ background: b.color }} />
            <span style={{ width: 72 }}>{b.range}</span>
            <span style={{ color: '#8A8FA5' }}>{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const PageHeat = () => {
  const [loading, setLoading] = useStateH(true);
  const [heatData, setHeatData] = useStateH(window.HEAT || null);
  const [hourlyProv, setHourlyProv] = useStateH('KKN');

  useEffectH(() => {
    let alive = true;
    const finishLoading = () => {
      if (!alive) return;
      setTimeout(() => {
        if (alive) setLoading(false);
      }, 450);
    };

    const loadHeatData = (initial = false) => {
      fetch('heat-data.json?ts=' + Date.now(), { cache: 'no-store' })
        .then(res => {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(data => {
          if (!alive) return;
          if (data && Array.isArray(data.provinces) && data.provinces.length) {
            window.HEAT = data;
            setHeatData(data);
          }
        })
        .catch(err => {
          console.warn('heat-data.json fetch failed, use window.HEAT fallback:', err);
        })
        .finally(() => {
          if (initial) finishLoading();
        });
    };

    loadHeatData(true);
    const timer = setInterval(() => loadHeatData(false), 60 * 60 * 1000);

    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const H = heatData || window.HEAT;
  if (!H || !H.provinces || !H.provinces.length) {
    return (
      <div className="view-enter">
        <div className="card"><div className="card-b" style={{ padding: 44, textAlign: 'center', color: '#8A8FA5', lineHeight: 1.8 }}>
          ยังไม่มีข้อมูลพยากรณ์อุณหภูมิ<br/>
          <span style={{ fontSize: 12 }}>รันสคริปต์ <strong>update_heat.ps1</strong> เพื่อดึงพยากรณ์จาก TMD</span>
        </div></div>
      </div>
    );
  }

  const provs = H.provinces;
  const todays = provs.map(p => ({ code: p.code, name: p.name, t: p.forecasts[0] }));
  const hottest = todays.reduce((a, b) => (heatIndexOf(b.t) > heatIndexOf(a.t) ? b : a), todays[0]);
  const hottestHI = heatIndexOf(hottest.t);
  const hotBand = window.heatBandOf(hottestHI);
  const nDays = provs[0].forecasts.length;
  const hourlyProvObj = provs.find(p => p.code === hourlyProv) || provs[0];
  const hourlyDay = (hourlyProvObj.forecasts || []).find(f => Array.isArray(f.hours) && f.hours.length) || hourlyProvObj.forecasts[0];
  const hourlyPoints = ((hourlyDay && hourlyDay.hours) || []).slice().sort((a, b) => String(a.time).localeCompare(String(b.time)));
  const hourlyPeak = hourlyPoints.length ? hourlyPoints.reduce((a, b) => (+b.hi > +a.hi ? b : a), hourlyPoints[0]) : null;

  return (
    <div className="view-enter">
      {/* ===== Hero: ดัชนีความร้อนสูงสุดวันนี้ ===== */}
      <div className="card" style={{ marginBottom: 18, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: loading ? 'linear-gradient(135deg,#eef1f6,#fafbff)' : `linear-gradient(135deg, ${hotBand.color}33, ${hotBand.color}0d)` }} />
        <div className="card-b" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 64, lineHeight: 1 }}>{loading ? '⏳' : hotBand.emoji}</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 12.5, color: '#50556B', fontWeight: 600 }}>ดัชนีความร้อนสูงสุดวันนี้ · เขตสุขภาพที่ 7</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
              {loading ? <Connecting/> : (<>
                <span style={{ fontSize: 48, fontWeight: 800, color: hotBand.text, lineHeight: 1 }}>{window.fmt1(hottestHI)}</span>
                <span style={{ fontSize: 16, color: '#8A8FA5' }}>°C</span>
                <span style={{ fontSize: 12, color: '#8A8FA5', fontWeight: 700 }}>HI</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: hotBand.text, background: hotBand.color, padding: '4px 14px', borderRadius: 999 }}>{hotBand.label}</span>
              </>)}
            </div>
            <div style={{ fontSize: 13, color: '#50556B', marginTop: 6 }}>
              {loading ? 'กำลังดึงพยากรณ์จากกรมอุตุนิยมวิทยา…' : (<>
                สูงสุดที่ <strong>{hottest.name}</strong> · ใช้คำนวณจาก {window.fmt1(hottest.t.hiTc || hottest.t.tcMax)}°C · ความชื้น {hottest.t.hiRh || hottest.t.rh}%
              </>)}
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 11, color: '#8A8FA5' }}>
            <div>แหล่งข้อมูล: กรมอุตุนิยมวิทยา (TMD)</div>
            <div>อัปเดต: {H.updated}</div>
          </div>
        </div>
      </div>

      {/* ===== KPI: ดัชนีความร้อนวันนี้รายจังหวัด ===== */}
      <div className="kpi-grid">
        {todays.map(p => {
          const hi = heatIndexOf(p.t);
          const band = window.heatBandOf(hi);
          return (
            <div key={p.code} className="kpi">
              <div className="glow" style={{ background: band.color }} />
              <div className="kpi-inner">
                <div className="kpi-label">{p.name} · วันนี้</div>
                {loading ? (
                  <div className="kpi-value"><Connecting/></div>
                ) : (<>
                  <div className="kpi-value" style={{ color: band.text }}>
                    {window.fmt1(hi)}<span style={{ fontSize: 14, color: '#8A8FA5', fontWeight: 500, marginLeft: 4 }}>°C HI</span>
                    <span style={{ fontSize: 24, marginLeft: 8 }}>{band.emoji}</span>
                  </div>
                  <div className="kpi-foot">
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: band.text, background: band.color, padding: '2px 9px', borderRadius: 999 }}>{band.label}</span>
                    <span style={{ marginLeft: 'auto', color: '#8A8FA5' }}>อุณหภูมิ {window.fmt1(p.t.hiTc || p.t.tcMax)}°C · ชื้น {p.t.hiRh || p.t.rh}%</span>
                  </div>
                </>)}
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== Province Heat Map ===== */}
      <div className="card heat-map-card" style={{ marginBottom: 18 }}>
        <div className="card-h">
          <div>
            <h3 className="card-t">แผนที่ดัชนีความร้อนรายจังหวัด · เขตสุขภาพที่ 7</h3>
            <div className="card-st">ระบายสีตามระดับ Heat Index วันนี้จาก TMD · รีเฟรชอัตโนมัติทุก 1 ชั่วโมง · อัปเดตล่าสุด {H.updated}</div>
          </div>
          <span className="chip"><Icon name="refresh" size={14}/> ทุก 1 ชั่วโมง</span>
        </div>
        <div className="card-b">
          <HeatProvinceMap provinces={provs} loading={loading} updated={H.updated}/>
        </div>
      </div>

      {/* ===== Hourly Heat Index ===== */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-h">
          <div>
            <h3 className="card-t">ดัชนีความร้อนรายชั่วโมง · {hourlyProvObj.name}</h3>
            <div className="card-st">
              แสดงค่า HI จากข้อมูลพยากรณ์รายชั่วโมงของ TMD · วันที่ {hourlyDay ? fmtDayH(hourlyDay.date) : '-'}
            </div>
          </div>
          <div className="flex gap-2 center" style={{ flexWrap:'wrap' }}>
            {hourlyPeak && !loading && (
              <span className="chip" style={{ background: window.heatBandOf(+hourlyPeak.hi).color, color: window.heatBandOf(+hourlyPeak.hi).text, border:'none', fontWeight:700 }}>
                สูงสุด {window.fmt1(hourlyPeak.hi)}°C HI · {hourlyPeak.hour || ''}
              </span>
            )}
            <select value={hourlyProvObj.code} onChange={e => setHourlyProv(e.target.value)}
              style={{ border:'1px solid var(--border)', background:'#fff', borderRadius:999, padding:'8px 14px', color:'#50556B', fontWeight:600, fontFamily:'inherit' }}>
              {provs.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <div className="card-b">
          {loading ? (
            <div style={{ padding:'34px 16px', textAlign:'center' }}><Connecting/></div>
          ) : hourlyPoints.length ? (
            <div className="chart-scroll">
              <div className="hourly-heat-grid" style={{ minWidth: Math.max(720, hourlyPoints.length * 72), gridTemplateColumns: `repeat(${hourlyPoints.length}, 64px)` }}>
                {hourlyPoints.map((h, i) => {
                  const hi = +h.hi || 0;
                  const band = window.heatBandOf(hi);
                  const isPeak = hourlyPeak && h.time === hourlyPeak.time;
                  return (
                    <div key={h.time || i} className={'hourly-heat-cell ' + (isPeak ? 'peak' : '')}
                      title={`${h.hour || ''} · HI ${window.fmt1(hi)}°C · อุณหภูมิ ${window.fmt1(h.tc)}°C · ความชื้น ${h.rh}%`}
                      style={{ background: band.color, color: band.text, borderColor: isPeak ? band.text : 'transparent' }}>
                      <div className="hh">{h.hour}</div>
                      <div className="hv">{window.fmt1(hi)}</div>
                      <div className="hm">{window.fmt1(h.tc)}° · {h.rh}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ padding:'34px 16px', textAlign:'center', color:'#8A8FA5' }}>
              ยังไม่มีข้อมูลรายชั่วโมงสำหรับจังหวัดนี้ในรอบพยากรณ์ปัจจุบัน
            </div>
          )}
          <div style={{ marginTop: 10, fontSize: 11.5, color:'#8A8FA5', textAlign:'center' }}>
            ตัวเลขหลักคือ Heat Index (°C) · บรรทัดล่างคืออุณหภูมิและความชื้น ณ ชั่วโมงนั้น
          </div>
        </div>
      </div>

      {/* ===== เกณฑ์เตือนภัยดัชนีความร้อน ===== */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-h">
          <div>
            <h3 className="card-t">เกณฑ์ระดับดัชนีความร้อน</h3>
            <div className="card-st">คำนวณจากสูตร Rothfusz โดยใช้ค่าอุณหภูมิสูงสุดและความชื้นสัมพัทธ์ · หน่วย: °C</div>
          </div>
        </div>
        <div className="card-b">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }} className="heat-scale">
            {window.HEAT_BANDS.filter(b => b.label !== 'ปกติ').map(b => (
              <div key={b.label} style={{ background: b.color, borderRadius: 14, padding: '14px 12px', textAlign: 'center', color: b.text }}>
                <div style={{ fontSize: 30 }}>{b.emoji}</div>
                <div style={{ fontWeight: 800, fontSize: 15, marginTop: 4 }}>{b.label}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 2 }}>{b.range} °C</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== พยากรณ์ดัชนีความร้อน 7 วัน รายจังหวัด ===== */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-h">
          <div>
            <h3 className="card-t">พยากรณ์ดัชนีความร้อน {nDays} วันข้างหน้า · รายจังหวัด</h3>
            <div className="card-st">ค่าในช่อง = Heat Index (°C) · tooltip แสดงอุณหภูมิสูงสุดและความชื้นที่ใช้คำนวณ</div>
          </div>
        </div>
        <div className="card-b">
          {loading ? (
            <div style={{ padding:'48px 16px', textAlign:'center' }}>
              <Connecting/>
              <div style={{ fontSize:11.5, color:'#8A8FA5', marginTop:10 }}>กำลังดึงพยากรณ์ {nDays} วันจาก TMD…</div>
            </div>
          ) : (
          <div className="chart-scroll">
            <div style={{ minWidth: 620 }}>
              {/* header วันที่ */}
              <div style={{ display: 'grid', gridTemplateColumns: `110px repeat(${nDays}, 1fr)`, gap: 6, marginBottom: 6 }}>
                <div />
                {provs[0].forecasts.map((f, i) => (
                  <div key={i} style={{ textAlign: 'center', fontSize: 11, color: '#8A8FA5', fontWeight: 600 }}>
                    <div>{fmtDowH(f.date)}</div>
                    <div>{fmtDayH(f.date)}</div>
                  </div>
                ))}
              </div>
              {/* แถวรายจังหวัด */}
              {provs.map(p => (
                <div key={p.code} style={{ display: 'grid', gridTemplateColumns: `110px repeat(${nDays}, 1fr)`, gap: 6, marginBottom: 6, alignItems: 'center' }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                  {p.forecasts.map((f, i) => {
                    const hi = heatIndexOf(f);
                    const band = window.heatBandOf(hi);
                    return (
                      <div key={i} title={`${fmtDayH(f.date)} · ${band.label} · HI ${window.fmt1(hi)}°C · ใช้คำนวณจาก ${window.fmt1(f.hiTc || f.tcMax)}°C ชื้น ${f.hiRh || f.rh}% · ต่ำสุด ${window.fmt1(f.tcMin)}°C`}
                        style={{ background: band.color, color: band.text, borderRadius: 10, padding: '10px 4px', textAlign: 'center', fontWeight: 800, fontSize: 14.5 }}>
                        {window.fmt1(hi)}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          )}
        </div>
      </div>

      {/* ===== คำแนะนำด้านสุขภาพ ===== */}
      <div className="card">
        <div className="card-h">
          <div>
            <h3 className="card-t">คำแนะนำการปฏิบัติตัวตามระดับดัชนีความร้อน</h3>
            <div className="card-st">แบ่งตามกลุ่มประชาชน · อ้างอิงกรมอนามัย</div>
          </div>
        </div>
        <div className="card-b">
          <div className="grid-2" style={{ gap: 16 }}>
            {['general', 'risk'].map(gk => {
              const g = window.HEAT_ADVICE[gk];
              return (
                <div key={gk} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{g.title}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {g.levels.map(lv => (
                      <div key={lv.level} style={{ background: lv.color + '33', border: `1px solid ${lv.color}`, borderRadius: 12, padding: '10px 12px' }}>
                        <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 4 }}>● {lv.level}</div>
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#3A3F52', lineHeight: 1.6 }}>
                          {lv.items.map((it, i) => <li key={i}>{it}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 11.5, color: '#8A8FA5', marginTop: 12, textAlign: 'center' }}>
            หากมีเหตุฉุกเฉิน โทร <strong>1669</strong> หรือติดต่อสถานพยาบาลที่ใกล้ที่สุด
          </div>
        </div>
      </div>
    </div>
  );
};

window.PageHeat = PageHeat;
