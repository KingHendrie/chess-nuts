<#
Downloads Wikimedia Commons SVG chess piece files whose filenames have a 't' in the 3rd position (e.g. '*t45.svg').
Saves files to public/img/chesspieces/wikimedia/ and generates a map.json mapping chess piece codes to filenames.

Run locally from the repo root in PowerShell:
    .\scripts\download_wikimedia_pieces.ps1
#>

$ErrorActionPreference = 'Stop'

$targetDir = Join-Path -Path (Get-Location) -ChildPath 'public\img\chesspieces\wikimedia'
New-Item -Path $targetDir -ItemType Directory -Force | Out-Null

Write-Host "Target directory: $targetDir"

# Fetch the category page and extract candidate filenames matching '*t45.svg'
$categoryUrl = 'https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces'
Write-Host "Fetching category page..."
$resp = Invoke-WebRequest -Uri $categoryUrl -UseBasicParsing

# Match filenames like Chess_xxx45.svg where the code contains a 't' at position 3 (e.g. ...t45.svg)
$regex = [regex] 'Chess_[A-Za-z0-9_]*t45\.svg'
$matches = @($regex.Matches($resp.Content) | ForEach-Object { $_.Value } ) | Sort-Object -Unique

if (-not $matches.Count) {
    Write-Host "No candidate filenames found on the category page. Exiting."
    exit 1
}

Write-Host "Found $($matches.Count) candidate filenames. Preparing to download..."

$downloaded = @()
foreach ($name in $matches) {
    # Build Special:FilePath URL which redirects to the actual file URL
    $nameOnly = $name -replace '^Chess_', ''
    $fileUrl = "https://commons.wikimedia.org/wiki/Special:FilePath/$name"
    $outPath = Join-Path $targetDir $name
    if (Test-Path $outPath) {
        Write-Host "Already have $name - skipping"
        $downloaded += $name
        continue
    }
    try {
        Write-Host "Downloading $name..."
        Invoke-WebRequest -Uri $fileUrl -OutFile $outPath -UseBasicParsing -TimeoutSec 30
        Write-Host "Saved $name"
        $downloaded += $name
    } catch {
        $errMsg = $_ | Out-String
        Write-Host ('Failed to download ' + $name)
        Write-Host $errMsg
    }
}

if (-not $downloaded.Count) { Write-Host "No files downloaded. Exiting."; exit 1 }

Write-Host "Downloaded $($downloaded.Count) files. Building mapping..."

# Helper: determine piece and color heuristically from filename and file content
function Get-PieceKeyFromFile($filePath, $fileName) {
    $code = $fileName -replace '^Chess_', '' -replace '45\.svg$',''
    $codeLower = $code.ToLower()

    # piece letters we care about
    $letters = @{ 'k'='K'; 'q'='Q'; 'r'='R'; 'b'='B'; 'n'='N'; 'p'='P' }
    $piece = $null
    foreach ($l in $letters.Keys) {
        if ($codeLower -match $l) { $piece = $letters[$l]; break }
    }

    # color preference: if code starts with 'w' or contains 'w' -> white; else if contains 'b' -> black
    $color = $null
    if ($codeLower -match '^w' -or $codeLower -match '(^|_)w') { $color='w' }
    elseif ($codeLower -match '^b' -or $codeLower -match '(^|_)b') { $color='b' }

    # If content mentions 'white' or 'black', prefer that
    try {
        $content = Get-Content -Path $filePath -ErrorAction SilentlyContinue | Out-String
        $contentLower = $content.ToLower()
        if ($contentLower -match 'white') { $color='w' }
        elseif ($contentLower -match 'black') { $color='b' }
    } catch {
        # ignore
    }

    if (-not $piece) { return $null }
    if (-not $color) { $color = 'b' } # default to black if unknown
    return "$color$piece"
}

$mapping = @{}
foreach ($file in $downloaded) {
    $fullPath = Join-Path $targetDir $file
    $key = Get-PieceKeyFromFile -filePath $fullPath -fileName $file
    if ($key) {
        if (-not $mapping.ContainsKey($key)) { $mapping[$key] = $file }
    }
}

Write-Host "Mapping generated for $($mapping.Count) piece codes." 
Write-Host "Mapping keys: $($mapping.Keys -join ', ')"

# Report missing expected keys
$expected = @('wK','wQ','wR','wB','wN','wP','bK','bQ','bR','bB','bN','bP')
$missing = @()
foreach ($k in $expected) { if (-not $mapping.ContainsKey($k)) { $missing += $k } }
if ($missing.Count) { Write-Host "Warning: mapping missing keys: $($missing -join ', ')" }

# Save mapping JSON
$mapPath = Join-Path $targetDir 'map.json'
$mapping | ConvertTo-Json -Depth 3 | Out-File -FilePath $mapPath -Encoding UTF8
Write-Host "Saved mapping to $mapPath"

Write-Host "Done. If any expected pieces are missing, you can re-run the script or manually add files to $targetDir and edit map.json." 
