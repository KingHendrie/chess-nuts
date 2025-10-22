Place a Stockfish executable in this folder for the in-process worker to spawn.

- Recommended filenames:
  - Windows: stockfish.exe
  - macOS / Linux: stockfish

How to get a binary (Windows):
1. Download a prebuilt Windows build from the official Stockfish releases page: https://github.com/official-stockfish/Stockfish/releases
2. Unzip and copy the appropriate `stockfish_*.exe` into this project's `bin` folder and rename to `stockfish.exe`.
3. Set environment variable `STOCKFISH_PATH` to `./bin/stockfish.exe` (or add to `.env`).

Example PowerShell commands:

```powershell
# after placing the exe in ./bin
$env:STOCKFISH_PATH = (Resolve-Path .\bin\stockfish.exe).Path
Stop-Process -Name node -Force -ErrorAction SilentlyContinue
Start-Process -FilePath node -ArgumentList 'app.js' -WorkingDirectory (Resolve-Path .).Path -RedirectStandardOutput '.\server.log' -RedirectStandardError '.\server.err' -PassThru
```

Why this helps:
- The project's code spawns a Stockfish binary when the JS/WASM engine is not compatible; using a native binary avoids the API mismatch and usually works reliably on Windows.
