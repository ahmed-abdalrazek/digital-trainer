$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8766
$python = Get-Command python -ErrorAction SilentlyContinue

if (-not $python) {
  throw 'Python غير موجود في PATH. ثبّت Python أو شغّل خادم Laragon يدويًا على عنوان الشبكة المحلية.'
}

$addresses = [Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() |
  Where-Object { $_.OperationalStatus -eq 'Up' -and $_.NetworkInterfaceType -in @('Wireless80211', 'Ethernet') } |
  ForEach-Object {
    $adapterName = $_.Name
    $_.GetIPProperties().UnicastAddresses |
      Where-Object {
        $_.Address.AddressFamily -eq [Net.Sockets.AddressFamily]::InterNetwork -and
        -not $_.Address.ToString().StartsWith('169.254.') -and
        $_.Address.ToString() -ne '127.0.0.1'
      } |
      ForEach-Object { [pscustomobject]@{ Adapter = $adapterName; Address = $_.Address.ToString() } }
  } |
  Sort-Object @{ Expression = { if ($_.Adapter -match 'Wi-?Fi|Wireless') { 0 } else { 1 } } }, Address -Unique

Write-Host 'المدرب الرقمي — عرض تجريبي للهاتف' -ForegroundColor Cyan
Write-Host 'اتصل من الهاتف بنفس شبكة Wi-Fi، ثم افتح أحد العناوين التالية:' -ForegroundColor Yellow
foreach ($entry in $addresses) {
  Write-Host "  $($entry.Adapter): http://$($entry.Address):$port" -ForegroundColor Green
}
if (-not $addresses) {
  Write-Warning 'لم يتم العثور على عنوان شبكة محلية. تحقق من اتصال Wi-Fi أو Ethernet.'
}
Write-Host 'الخادم متاح على الشبكة المحلية فقط؛ لا تستخدم شبكة عامة ولا توجه المنفذ إلى الإنترنت.' -ForegroundColor DarkYellow
Write-Host 'لإيقافه اضغط Ctrl+C.'

& $python.Source -m http.server $port --bind 0.0.0.0 --directory $projectRoot
