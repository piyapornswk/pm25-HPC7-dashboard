# ============================================================
#  update_heat.ps1
#  ดึงพยากรณ์รายวันจาก TMD NWP API (forecast_daily) 4 จังหวัดเขต 7
#  คำนวณ Heat Index (ดัชนีความร้อน) แล้วเขียนไฟล์ heat-data.js
#  ตั้งให้รันทุก 1 ชั่วโมงผ่าน Windows Task Scheduler
# ============================================================
$ErrorActionPreference = 'Stop'

# TMD SSL chain can fail under Windows Task Scheduler on some machines.
# Keep this scoped to this PowerShell process so the hourly job can still refresh data.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [enum]::Parse([Net.SecurityProtocolType], 'Tls13')
} catch {}
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }

$token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6ImE3NzY0ODEzNWY1OTAzZjRmYzc1NjlhYmRhOGI5MjUwMTk4NDI4MDViMGZmODc1MjRhMTk3NDIwM2NjZGEwNTdlZDU3Yjg3NWY3YWExOGEwIn0.eyJhdWQiOiIyIiwianRpIjoiYTc3NjQ4MTM1ZjU5MDNmNGZjNzU2OWFiZGE4YjkyNTAxOTg0MjgwNWIwZmY4NzUyNGExOTc0MjAzY2NkYTA1N2VkNTdiODc1ZjdhYTE4YTAiLCJpYXQiOjE3ODAzNzI3OTEsIm5iZiI6MTc4MDM3Mjc5MSwiZXhwIjoxODExOTA4NzkxLCJzdWIiOiIzODk5Iiwic2NvcGVzIjpbXX0.ma986E7CP-SVUPd-mKZBMKhUHb89YfZWb11okIJhNmPymJWiiK8-Y5qCAJn2W4PAvIqfv3a7epjdGcmZRlgtfQd1OTt245kySHSI4Dneg9hPEqiC1MLxMm6HUs2tcfkWvV9AbNVonT6pn9op9Nk_OhHynS-U2meJl_RC9MBYlNwZp2n9Gb_Lk5L7Ri_8OrHV8qAQfZgefBNR8mlkejMZ1Xs8Ak35vlpMeoz48fiazQ9ZYPhbRoSo_kyr8p5Da-REKVh2Q8GcCj9mMCutU0qmBXisdG-KA7uYEnYOEGU7vH8qzXm6p_Grzz9oAWo20rMoLaoDmhCYunMDk3nRxGgJm4CM2vgaunC2GW7R3SwfQLsP8u2yPCTGxjSOVsKjAUUlW5e7ouejFS_AkeipKPbg6VsRfIG1fFftuaj4MLhcCeRRs2Z0UWhNhqsc_ZZW62QP0ZnKI6Q7FKhgs11paEHGbGsufbH1JU7y8hX_byDUone6ftL4HIAps-v4MSEC5PVM913oNN-IrDwW1RGXWU-8kQzn_DT8tCm5Ram3zkpxYkwVqP9kdHk7YPNCGE5GEjAMOD4nT_gr-z0l2VqF_l7imlfhqg7qMEqf6g5jV9nmN0E6rnxLq4NoppsaQjUPtMSyCwLcyvvzZdDSKqWgrD-TxLSOtSnsqmHkznV0P4fTio4'

$proj = 'C:\Users\windows\Desktop\pm25_extract\pm2-5-7\project'
$out  = Join-Path $proj 'heat-data.js'
$log  = Join-Path $proj 'update_heat.log'
function Log($m){ "$([DateTime]::Now.ToString('yyyy-MM-dd HH:mm:ss'))  $m" | Add-Content -LiteralPath $log -Encoding UTF8 }

function Invoke-TmdJson([string]$Uri){
  $curlArgs = @(
    '--http1.1',
    '-k',
    '--ssl-no-revoke',
    '-sS',
    '--retry', '2',
    '--retry-delay', '2',
    '--connect-timeout', '30',
    '--max-time', '120',
    '-H', ("Authorization: Bearer {0}" -f $token),
    '-H', 'Accept: application/json',
    $Uri
  )
  $raw = & curl.exe @curlArgs 2>&1
  $exitCode = $LASTEXITCODE
  $text = ($raw | Out-String).Trim()
  if($exitCode -ne 0){
    throw "curl failed ($exitCode): $text"
  }
  if([string]::IsNullOrWhiteSpace($text)){
    throw "empty response from TMD"
  }
  try {
    return $text | ConvertFrom-Json
  } catch {
    $snippet = if($text.Length -gt 180){ $text.Substring(0, 180) } else { $text }
    throw "invalid JSON from TMD: $snippet"
  }
}

# ---- Heat Index (NWS Rothfusz regression ตรงตามสูตร) : input C + %RH -> output C ----
function HeatIndexC([double]$Tc,[double]$R){
  $T = $Tc * 1.8 + 32   # degC -> degF  (degF = degC*1.8 + 32)
  $HI = -42.379 + 2.04901523*$T + 10.14333127*$R - 0.22475541*$T*$R - 0.00683783*$T*$T - 0.05481717*$R*$R + 0.00122874*$T*$T*$R + 0.00085282*$T*$R*$R - 0.00000199*$T*$T*$R*$R
  return [math]::Round((($HI-32)/1.8),1)   # degF -> degC
}

$provs = @(
  @{code='KKN'; name='ขอนแก่น';   lat=16.43; lon=102.83},
  @{code='KSN'; name='กาฬสินธุ์';  lat=16.43; lon=103.51},
  @{code='MKM'; name='มหาสารคาม'; lat=16.18; lon=103.30},
  @{code='RET'; name='ร้อยเอ็ด';   lat=16.05; lon=103.65}
)
function GetHourlyMaxByDate([double]$lat,[double]$lon,[string]$startDate){
  $out = @{}
  $baseDate = [datetime]$startDate
  for($i=0; $i -lt 7; $i++){
    $date = $baseDate.AddDays($i).ToString('yyyy-MM-dd')
    $uri = "https://data.tmd.go.th/nwpapi/v1/forecast/location/hourly/at?lat=$lat&lon=$lon&fields=tc,rh,cond&date=$date&hour=0&duration=24"
    try {
      $resp = Invoke-TmdJson -Uri $uri
      $fc = $resp.WeatherForecasts[0].forecasts
      foreach($f in $fc){
        $d = $f.data
        if($null -eq $d.tc -or $null -eq $d.rh){ continue }
        $timeObj = [datetime]$f.time
        $day = $timeObj.ToString('yyyy-MM-dd')
        $hi = HeatIndexC ([double]$d.tc) ([double]$d.rh)
        $hourItem = [ordered]@{
          time = $timeObj.ToString('yyyy-MM-ddTHH:mm:sszzz')
          hour = $timeObj.ToString('HH:mm')
          tc   = [math]::Round([double]$d.tc,1)
          rh   = [math]::Round([double]$d.rh,0)
          hi   = $hi
          cond = [int]$d.cond
        }
        if(-not $out.ContainsKey($day)){
          $out[$day] = [pscustomobject]@{
            hi    = -999
            tc    = 0
            rh    = 0
            time  = ''
            cond  = 0
            hours = @()
          }
        }
        $out[$day].hours += $hourItem
        if($hi -gt $out[$day].hi){
          $out[$day].hi = $hi
          $out[$day].tc = $hourItem.tc
          $out[$day].rh = $hourItem.rh
          $out[$day].time = $hourItem.time
          $out[$day].cond = $hourItem.cond
        }
      }
    }
    catch {
      # TMD hourly endpoint usually covers only the nearest forecast range; use daily fallback for unavailable days.
    }
  }
  return $out
}

try {
  $provObjs = @()
  $today = (Get-Date -Format 'yyyy-MM-dd')   # ระบุวันเริ่ม = วันนี้ เสมอ (กันได้ข้อมูลเริ่มเมื่อวานตอน model run ยังไม่อัปเดต)
  foreach($p in $provs){
    $uri = "https://data.tmd.go.th/nwpapi/v1/forecast/location/daily/at?lat=$($p.lat)&lon=$($p.lon)&fields=tc_max,tc_min,rh,cond&date=$today&duration=7"
    $resp = Invoke-TmdJson -Uri $uri
    $fc = $resp.WeatherForecasts[0].forecasts
    $hourlyMax = GetHourlyMaxByDate ([double]$p.lat) ([double]$p.lon) $today
    $items = @()
    foreach($f in $fc){
      $d = $f.data
      $date = ([datetime]$f.time).ToString('yyyy-MM-dd')
      $dailyTcMax = [math]::Round([double]$d.tc_max,1)
      $dailyRh = [math]::Round([double]$d.rh,0)
      $hourly = $hourlyMax[$date]
      if($hourly){
        $hi = $hourly.hi
        $hiTc = $hourly.tc
        $hiRh = $hourly.rh
        $hiTime = $hourly.time
        $hiSource = 'hourly'
        $cond = $hourly.cond
      } else {
        $hi = HeatIndexC ([double]$d.tc_max) ([double]$d.rh)
        $hiTc = $dailyTcMax
        $hiRh = $dailyRh
        $hiTime = $date
        $hiSource = 'daily-fallback'
        $cond = [int]$d.cond
      }
      $items += [ordered]@{
        date  = $date
        tcMax = $dailyTcMax
        tcMin = [math]::Round([double]$d.tc_min,1)
        rh    = $dailyRh
        hi    = $hi
        hiTc  = $hiTc
        hiRh  = $hiRh
        hiTime = $hiTime
        hiSource = $hiSource
        hours = if($hourly -and $hourly.hours){ $hourly.hours } else { @() }
        cond  = $cond
      }
    }
    $provObjs += [ordered]@{ code=$p.code; name=$p.name; forecasts=$items }
  }

  if($provObjs.Count -lt 1){ Log "ABORT: ไม่ได้ข้อมูลจาก TMD"; exit }

  $obj  = [ordered]@{ updated = ([DateTime]::Now.ToString('yyyy-MM-dd HH:mm')); provinces = $provObjs }
  $json = $obj | ConvertTo-Json -Depth 8
  $js   = "// Heat Index data (TMD NWP forecast_daily) - auto-generated by update_heat.ps1`r`n// อัปเดตอัตโนมัติทุก 1 ชั่วโมง - อย่าแก้ไฟล์นี้ด้วยมือ`r`nwindow.HEAT = $json;`r`n"
  [System.IO.File]::WriteAllText($out, $js, (New-Object System.Text.UTF8Encoding($false)))
  # เขียน .json ด้วย (แดชบอร์ด fetch แบบ no-cache เพื่อเลี่ยงปัญหาเบราว์เซอร์แคช)
  [System.IO.File]::WriteAllText((Join-Path $proj 'heat-data.json'), $json, (New-Object System.Text.UTF8Encoding($false)))
  Log "OK: heat-data updated ($($provObjs.Count) provinces, $($provObjs[0].forecasts.Count) days)"
}
catch {
  Log "ERROR: $($_.Exception.Message)"
}
