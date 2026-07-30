# Builds demo/index.html — top.html + a mock nginx autoindex block + bot.html,
# so the skin can be opened in a browser without an nginx behind it.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$dist = Join-Path $root 'dist'
$demo = Join-Path $root 'demo'
$assets = Join-Path $demo '.m3listing'

New-Item -ItemType Directory -Force -Path $assets | Out-Null
Copy-Item (Join-Path $dist 'm3listing.css') $assets -Force
Copy-Item (Join-Path $dist 'm3listing.js')  $assets -Force
Copy-Item (Join-Path $dist 'm3listing-probe.js') $assets -Force

$top = Get-Content (Join-Path $dist 'top.html') -Raw
$bot = Get-Content (Join-Path $dist 'bot.html') -Raw

# Verbatim shape of what nginx autoindex emits (CRLF, padded columns,
# names longer than 50 chars truncated in the label but intact in href).
$rows = @(
  '<a href="../">../</a>',
  '<a href="%40eaDir/">@eaDir/</a>                                            17-Nov-2025 08:27       -',
  '<a href="Distrib/">Distrib/</a>                                           26-Nov-2024 16:46       -',
  '<a href="ISO/">ISO/</a>                                               17-Nov-2025 08:27       -',
  '<a href="%D0%94%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D1%8B/">Документы/</a>                                         03-Feb-2025 19:09       -',
  '<a href="Tools/">Tools/</a>                                             03-Feb-2025 19:09       -',
  '<a href="COMPLEX_2014SP4.iso">COMPLEX_2014SP4.iso</a>                                12-Feb-2023 20:08      4G',
  '<a href="Dell%20Driver%20Pack%20For%20Windows%20OS%20v.24.03.00.ISO">Dell Driver Pack For Windows OS v.24.03.00.ISO</a>     16-Apr-2024 15:33      1G',
  '<a href="Dell_Driver_Pack_for_Windows_OS_LCDRVPCK_WIN_24.03.200.61.ISO">Dell_Driver_Pack_for_Windows_OS_LCDRVPCK_WIN_24..&gt;</a> 14-Jun-2025 22:01      1G',
  '<a href="pfSense-CE-2.6.0-RELEASE-amd64.iso">pfSense-CE-2.6.0-RELEASE-amd64.iso</a>                 31-Jan-2022 20:31    732M',
  '<a href="talos-metal-amd64.iso">talos-metal-amd64.iso</a>                              17-Nov-2025 07:50    287M',
  '<a href="%D0%9E%D1%82%D1%87%D1%91%D1%82%20%D0%B7%D0%B0%202025.xlsx">Отчёт за 2025.xlsx</a>                                 09-Jan-2026 11:02    118K',
  '<a href="notes.md">notes.md</a>                                           02-Mar-2026 07:14    3821',
  '<a href="backup.tar.gz">backup.tar.gz</a>                                      21-Dec-2025 03:00     56M',
  '<a href="id_ed25519.pub">id_ed25519.pub</a>                                     09-Feb-2023 11:20     102',
  '<a href="promo.mp4">promo.mp4</a>                                          14-Jul-2026 18:40    1.4G',
  '<a href="soundtrack.flac">soundtrack.flac</a>                                    05-May-2026 21:11     42M',
  '<a href="poster.png">poster.png</a>                                         05-May-2026 21:12    2.7M',
  '<a href="setup.exe">setup.exe</a>                                          30-Sep-2025 09:33     94M',
  '<a href="manual.pdf">manual.pdf</a>                                         30-Sep-2025 09:34    5.1M',
  '<a href="deploy.sh">deploy.sh</a>                                          11-Jun-2026 12:00     1462',
  '<a href="app.js">app.js</a>                                             11-Jun-2026 12:01    28K',
  '<a href="nginx.conf">nginx.conf</a>                                         11-Jun-2026 12:02     1642',
  '<a href="ca.pem">ca.pem</a>                                             02-Jul-2026 09:00    1834',
  '<a href="server.crt">server.crt</a>                                         02-Jul-2026 09:00    1512',
  '<a href="client.pfx">client.pfx</a>                                         02-Jul-2026 09:01    3204',
  '<a href="request.csr">request.csr</a>                                        02-Jul-2026 09:02    1024',
  '<a href="ocsp.ors">ocsp.ors</a>                                           02-Jul-2026 09:03     712',
  '<a href="openssl.cnf">openssl.cnf</a>                                        02-Jul-2026 09:04   11264',
  '<a href="index.html">index.html</a>                                         14-Jul-2026 10:00    4096',
  '<a href="theme.css">theme.css</a>                                          14-Jul-2026 10:01   28672',
  '<a href="config.json">config.json</a>                                        14-Jul-2026 10:02    2048',
  '<a href="pom.xml">pom.xml</a>                                            14-Jul-2026 10:03    5120',
  '<a href="build.py">build.py</a>                                           14-Jul-2026 10:04    7168',
  '<a href="parser.t">parser.t</a>                                           14-Jul-2026 10:05    3072',
  '<a href="stdio.h">stdio.h</a>                                            14-Jul-2026 10:06    9216',
  '<a href="libssl.lib">libssl.lib</a>                                         14-Jul-2026 10:07     12M',
  '<a href="gateway.rdp">gateway.rdp</a>                                        18-Jul-2026 08:30    1638',
  '<a href="appliance.ova">appliance.ova</a>                                      18-Jul-2026 08:31    4.2G',
  '<a href="office.lic">office.lic</a>                                         18-Jul-2026 08:32     512',
  '<a href="release.ics">release.ics</a>                                        18-Jul-2026 08:33    1024',
  '<a href="update.msu">update.msu</a>                                         18-Jul-2026 08:34     46M',
  '<a href="installer.msi">installer.msi</a>                                      18-Jul-2026 08:35     18M',
  '<a href="subs.srt">subs.srt</a>                                           18-Jul-2026 08:36   24576',
  '<a href="chart.csv">chart.csv</a>                                          18-Jul-2026 08:37   65536',
  '<a href="clip.mkv">clip.mkv</a>                                           18-Jul-2026 08:38    2.1G',
  '<a href="track.flac">track.flac</a>                                         18-Jul-2026 08:39     38M',
  '<a href="photo.jpg">photo.jpg</a>                                          18-Jul-2026 08:40    4.4M',
  '<a href="logo.svg">logo.svg</a>                                           18-Jul-2026 08:41   18432',
  '<a href="anim.gif">anim.gif</a>                                           18-Jul-2026 08:42    1.2M',
  '<a href="a-deliberately-very-long-file-name-that-should-force-the-row-to-ellipsise-v2026.07.29-final.tar.zst">a-deliberately-very-long-file-name-that-should-fo..&gt;</a> 29-Jul-2026 23:10     91M'
)

$nginx = "`r`n`r`n<body>`r`n<h1>Index of /</h1><hr><pre>" + ($rows -join "`r`n") + "`r`n</pre><hr>`r`n"

$out = $top + $nginx + $bot
[IO.File]::WriteAllText((Join-Path $demo 'index.html'), $out, (New-Object Text.UTF8Encoding $false))
Write-Host "demo/index.html written ($($out.Length) bytes)"
