# ============================================================
#  update_pm_weekly.ps1
#  รวมค่าฝุ่น PM2.5 รายสัปดาห์จากไฟล์ GISTDA (ระดับจังหวัด)
#  แล้วเขียนค่าใหม่ลงในบล็อก PM_WEEKLY ของ data.js อัตโนมัติ
#  ตั้งให้รันทุกเดือนผ่าน Windows Task Scheduler
# ============================================================
$ErrorActionPreference = 'Stop'

$root    = 'C:\Users\windows\Desktop\ศุนย์อนายที่ 7 ขอนแก่น\งานข้อมูลและติดตามประเมินผล\เมืองสุขภาพดี\งานฝุ่น PM2.5\งาน dashboard\ข้อมูลฝุ่นจาก Gisda'
$dataJs  = 'C:\Users\windows\Desktop\pm25_extract\pm2-5-7\project\data.js'
$logFile = 'C:\Users\windows\Desktop\pm25_extract\pm2-5-7\project\update_pm_weekly.log'

function Log($m){ "$([DateTime]::Now.ToString('yyyy-MM-dd HH:mm:ss'))  $m" | Add-Content -LiteralPath $logFile -Encoding UTF8 }

try {
  $provs = [ordered]@{ 'ขอนแก่น'='KKN'; 'กาฬสินธุ์'='KSN'; 'มหาสารคาม'='MKM'; 'ร้อยเอ็ด'='RET' }
  $ceYear   = (Get-Date).Year
  $thaiYear = $ceYear + 543
  $jan1     = Get-Date "$ceYear-01-01"
  $wkStart  = $jan1.AddDays(-[int]$jan1.DayOfWeek)   # วันอาทิตย์ของสัปดาห์ที่มี 1 ม.ค.

  # ---- อ่านค่าเฉลี่ยรายวันของแต่ละจังหวัด ----
  $daily = @{}
  foreach($th in $provs.Keys){
    $code = $provs[$th]; $daily[$code] = @{}
    $yearDir = Join-Path $root "$th\$thaiYear"
    if(-not (Test-Path -LiteralPath $yearDir)){ continue }
    $files = Get-ChildItem -LiteralPath $yearDir -Recurse -Filter 'PM25_Province_24hrs_*.csv' -ErrorAction SilentlyContinue
    foreach($f in $files){
      if($f.Name -match '(\d{4})-(\d{2})-(\d{2})'){
        $dstr = "$($matches[1])-$($matches[2])-$($matches[3])"; $vals=@()
        Get-Content -LiteralPath $f.FullName | Select-Object -Skip 1 | ForEach-Object {
          $p = ($_ -split ','); if($p.Length -ge 2){ $v=0.0; if([double]::TryParse($p[1],[ref]$v)){ $vals += $v } }
        }
        if($vals.Count -gt 0){ $daily[$code][$dstr] = ($vals | Measure-Object -Average).Average }
      }
    }
  }

  # ---- guard: ถ้าข้อมูลน้อยผิดปกติ ไม่เขียนทับ (กันไฟล์เสีย) ----
  $totalDays = ($provs.Values | ForEach-Object { $daily[$_].Count } | Measure-Object -Sum).Sum
  if($totalDays -lt 4){ Log "ABORT: พบข้อมูลน้อยเกินไป ($totalDays วัน) — ไม่เขียนทับ data.js"; exit }

  # ---- จัดกลุ่มรายสัปดาห์ (อาทิตย์-เสาร์) ----
  $weekly=@{}; $maxWeek=0
  foreach($code in $provs.Values){
    foreach($dstr in $daily[$code].Keys){
      $dt = Get-Date $dstr
      $wk = [int][math]::Floor(($dt - $wkStart).Days/7) + 1
      if($wk -lt 1){ continue }
      if($wk -gt $maxWeek){ $maxWeek = $wk }
      if(-not $weekly.ContainsKey($wk)){ $weekly[$wk]=@{} }
      if(-not $weekly[$wk].ContainsKey($code)){ $weekly[$wk][$code]=@() }
      $weekly[$wk][$code] += $daily[$code][$dstr]
    }
  }

  function WeekArr($code){
    $a=@()
    for($w=1;$w -le $maxWeek;$w++){
      if($weekly.ContainsKey($w) -and $weekly[$w].ContainsKey($code)){
        $a += [math]::Round(($weekly[$w][$code]|Measure-Object -Average).Average,1)
      } else { $a += 0 }
    }
    return ($a -join ', ')
  }
  function WeekArrAll(){
    $a=@()
    for($w=1;$w -le $maxWeek;$w++){
      $rv=@()
      foreach($code in $provs.Values){ if($weekly.ContainsKey($w) -and $weekly[$w].ContainsKey($code)){ $rv += ($weekly[$w][$code]|Measure-Object -Average).Average } }
      if($rv.Count){ $a += [math]::Round(($rv|Measure-Object -Average).Average,1) } else { $a += 0 }
    }
    return ($a -join ', ')
  }

  # ---- สร้างบล็อกใหม่ ----
  $block = @"
// >>> PM_WEEKLY_AUTO_START (อัปเดตอัตโนมัติทุกเดือนโดย update_pm_weekly.ps1 · อย่าแก้ด้วยมือในบล็อกนี้)
// ค่าฝุ่น PM2.5 รายสัปดาห์ (ข้อมูลจริงจาก GISTDA ปี $thaiYear · W1-W$maxWeek) · หน่วย ug/m3 · อัปเดต $([DateTime]::Now.ToString('yyyy-MM-dd HH:mm'))
window.PM_WEEKLY = {
  ALL: [$(WeekArrAll)],
  KKN: [$(WeekArr 'KKN')],
  KSN: [$(WeekArr 'KSN')],
  MKM: [$(WeekArr 'MKM')],
  RET: [$(WeekArr 'RET')],
};
// <<< PM_WEEKLY_AUTO_END
"@

  # ---- แทนที่บล็อกเดิมใน data.js (ระหว่าง marker) ----
  $content = [System.IO.File]::ReadAllText($dataJs)
  $rx = [regex]'(?s)// >>> PM_WEEKLY_AUTO_START.*?// <<< PM_WEEKLY_AUTO_END'
  if(-not $rx.IsMatch($content)){ Log "ABORT: ไม่พบ marker PM_WEEKLY_AUTO ใน data.js"; exit }
  $new = $rx.Replace($content, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $block }, 1)
  [System.IO.File]::WriteAllText($dataJs, $new, (New-Object System.Text.UTF8Encoding($false)))

  Log "OK: อัปเดต PM_WEEKLY สำเร็จ · ปี $thaiYear · $maxWeek สัปดาห์ · $totalDays วัน-จังหวัด"
}
catch {
  Log "ERROR: $($_.Exception.Message)"
}
