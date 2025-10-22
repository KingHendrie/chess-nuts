<#
Rebuilds public/img/chesspieces/wikimedia/map.json by scanning the directory
and selecting filenames for each expected piece code. Prefers 'w' filenames for
white pieces and 'b' for black where present.

Run from repo root:
  .\scripts\generate_wikimedia_map.ps1
#>

$targetDir = Join-Path -Path (Get-Location) -ChildPath 'public\img\chesspieces\wikimedia'
if (-not (Test-Path $targetDir)) { Write-Error "Directory not found: $targetDir"; exit 1 }

$files = Get-ChildItem -Path $targetDir -Filter '*.svg' | Select-Object -ExpandProperty Name

$expected = @(
    @{ key='wK'; letter='k'; colorPrefix='w' },
    @{ key='wQ'; letter='q'; colorPrefix='w' },
    @{ key='wR'; letter='r'; colorPrefix='w' },
    @{ key='wB'; letter='b'; colorPrefix='w' },
    @{ key='wN'; letter='n'; colorPrefix='w' },
    @{ key='wP'; letter='p'; colorPrefix='w' },
    @{ key='bK'; letter='k'; colorPrefix='b' },
    @{ key='bQ'; letter='q'; colorPrefix='b' },
    @{ key='bR'; letter='r'; colorPrefix='b' },
    @{ key='bB'; letter='b'; colorPrefix='b' },
    @{ key='bN'; letter='n'; colorPrefix='b' },
    @{ key='bP'; letter='p'; colorPrefix='b' }
)

$map = @{}
foreach ($e in $expected) {
    $k = $e.key; $letter = $e.letter; $pref = $e.colorPrefix
    # First try to find a file that contains the pref (w/b) and the letter before t45
    $candidates = $files | Where-Object { $_ -match "[${pref}].*${letter}.*t45\.svg" }
    if (-not $candidates.Count) {
        # If none, try any file that contains the letter followed by t45
        $candidates = $files | Where-Object { $_ -match "${letter}.*t45\.svg" }
    }
    if ($candidates.Count) {
        # Prefer shorter names (heuristic) or the one with pref at start
        $chosen = $candidates | Sort-Object { $_.Length } | Select-Object -First 1
        $map[$k] = $chosen
    }
}

Write-Host "Generated mapping entries: $($map.Keys.Count)"
Write-Host ($map.GetEnumerator() | ForEach-Object { "{0} => {1}" -f $_.Key, $_.Value })

$mapPath = Join-Path $targetDir 'map.json'
$map | ConvertTo-Json -Depth 3 | Out-File -FilePath $mapPath -Encoding UTF8
Write-Host "Saved map to $mapPath"
