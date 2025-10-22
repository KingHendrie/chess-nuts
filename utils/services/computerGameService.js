// utils/services/computerGameService.js
// Service for user vs computer chess games


const ChessGame = require('./chessGame');
let gameSessionService = require('./gameSessionService');
// normalize import: some modules export { GameSessionService } while others export the service directly
if (gameSessionService && gameSessionService.GameSessionService) {
    gameSessionService = gameSessionService.GameSessionService;
}
const { knex } = require('../../utils/db');
const { spawn } = require('child_process');
const logger = require('../../utils/logger');
const fs = require('fs');
const path = require('path');

let StockfishModule = null;
try {
    // try to require the JS stockfish wrapper if available
    StockfishModule = require('stockfish');
} catch (e) {
    // try a more robust resolution: look for a JS engine file under node_modules/stockfish/src
    try {
        const candidateDir = path.join(__dirname, '..', '..', 'node_modules', 'stockfish', 'src');
        if (fs.existsSync(candidateDir)) {
            const files = fs.readdirSync(candidateDir).filter(f => f.endsWith('.js') && f.toLowerCase().includes('stockfish'));
            if (files.length) {
                // require the first matching file
                StockfishModule = require(path.join(candidateDir, files[0]));
            }
        }
    } catch (e2) {
        // fallthrough to binary fallback
        StockfishModule = null;
    }
}
// Diagnostic log: whether the JS stockfish module was resolved
try {
    if (StockfishModule) {
        logger.info('In-process stockfish module loaded');
    } else {
        logger.info('In-process stockfish module NOT available; will attempt binary fallback');
    }
} catch (e) {
    // logger may not be ready; swallow errors
}

async function getStockfishMove(fen, skillLevel = 10) {
    // If a JS/WASM StockfishModule is available and appears worker-like, try it first.
    if (StockfishModule) {
        try {
            // Some stockfish packages export a function that returns a worker-like object.
            const maybeEngine = StockfishModule();
            if (maybeEngine && typeof maybeEngine.postMessage === 'function') {
                return new Promise((resolve) => {
                    try {
                        const engine = maybeEngine;
                        let onmsg = function (line) {
                            try {
                                if (typeof line === 'string' && line.startsWith('bestmove')) {
                                    const parts = line.split(' ');
                                    const best = parts[1];
                                    try { engine.postMessage('quit'); } catch (e) {}
                                    resolve(best);
                                }
                            } catch (e) {
                                resolve(null);
                            }
                        };
                        engine.onmessage = onmsg;
                        engine.postMessage('uci');
                        engine.postMessage('setoption name Skill Level value ' + skillLevel);
                        engine.postMessage('position fen ' + fen);
                        engine.postMessage('go movetime 1000'); // 1 second per move
                        // safety timeout
                        setTimeout(() => resolve(null), 4000);
                    } catch (e) {
                        logger.warn('In-process Stockfish failed: ' + (e && e.message ? e.message : e));
                        // fall through to binary fallback below
                    }
                }).then((res) => {
                    if (res) return res;
                    // if in-process returned null, fall through to spawn fallback
                    return null;
                });
            } else {
                logger.info('In-process stockfish module present but not worker-like; skipping in-process and using binary fallback');
            }
        } catch (e) {
            logger.warn('Error while probing in-process Stockfish module: ' + (e && e.message ? e.message : e));
            // fall through to binary fallback
        }
    }

    // Fallback: try to spawn a stockfish binary. Prefer a local ./bin/stockfish.exe if present.
    let binary = process.env.STOCKFISH_PATH || 'stockfish';
    try {
        const localBin = path.join(__dirname, '..', '..', 'bin', process.platform === 'win32' ? 'stockfish.exe' : 'stockfish');
        if (fs.existsSync(localBin)) {
            binary = localBin;
            logger.info('Using local stockfish binary at: ' + binary);
        } else if (process.env.STOCKFISH_PATH) {
            logger.info('Using STOCKFISH_PATH from environment: ' + process.env.STOCKFISH_PATH);
        } else {
            logger.info('Falling back to system stockfish binary: ' + binary);
        }
    } catch (e) {
        logger.debug && logger.debug('Error checking local stockfish binary: ' + e.message);
    }
    return new Promise((resolve) => {
        let resolved = false;
        try {
            const engine = spawn(binary, []);
            let stdout = '';
            let awaitingUciOk = true;
            let awaitingReadyOk = false;

            engine.stdout.on('data', (data) => {
                try {
                    const text = data.toString();
                    stdout += text;
                    // log engine output at debug level
                    logger.debug && logger.debug('stockfish stdout: ' + text);

                    // UCI handshake: wait for 'uciok' then send 'isready'
                    if (awaitingUciOk && stdout.includes('uciok')) {
                        awaitingUciOk = false;
                        awaitingReadyOk = true;
                        engine.stdin.write('isready\n');
                        return;
                    }

                    if (awaitingReadyOk && stdout.includes('readyok')) {
                        awaitingReadyOk = false;
                        // set options and start search
                        engine.stdin.write('setoption name Skill Level value ' + skillLevel + '\n');
                        engine.stdin.write('position fen ' + fen + '\n');
                        engine.stdin.write('go movetime 1000\n');
                        return;
                    }

                    // capture bestmove when it appears
                    if (stdout.includes('bestmove')) {
                        const lines = stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                        const bestLine = lines.reverse().find(l => l.startsWith('bestmove'));
                        if (bestLine) {
                            const parts = bestLine.split(' ');
                            const best = parts[1];
                            if (!resolved) {
                                resolved = true;
                                try { engine.kill(); } catch (e) {}
                                resolve(best);
                            }
                        }
                    }
                } catch (e) {
                    // ignore
                }
            });

            engine.stderr.on('data', (d) => logger.info && logger.info('stockfish stderr: ' + d.toString()));

            engine.on('error', (err) => {
                if (!resolved) {
                    resolved = true;
                    logger.warn('Failed to spawn stockfish binary: ' + err.message);
                    resolve(null);
                }
            });

            // start UCI negotiation
            engine.stdin.write('uci\n');

            // safety timeout (longer to allow handshake + search)
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    try { engine.kill(); } catch (e) {}
                    logger.warn('Stockfish timed out waiting for bestmove');
                    resolve(null);
                }
            }, 10000);
        } catch (e) {
            if (!resolved) {
                resolved = true;
                logger.warn('Error running stockfish binary: ' + (e && e.message ? e.message : e));
                resolve(null);
            }
        }
    });
}

const ComputerGameService = {
    async createSession(userId, color = 'white', initialFen = null, difficulty = 10) {
        // Computer is always the other color
        const playerWhiteId = color === 'white' ? userId : null;
        const playerBlackId = color === 'black' ? userId : null;
        // Use -1 for computer player
        const session = await gameSessionService.createSession(
            playerWhiteId || -1,
            playerBlackId || -1,
            initialFen
        );
        // Store difficulty in session if needed (not persisted here, but can be added)
        session.difficulty = difficulty;
        return session;
    },

    async userMove(sessionId, moveObj) {
        // User makes a move
    return await gameSessionService.makeMove(sessionId, moveObj);
    },

    async computerMove(sessionId, difficulty = 10) {
        // Computer makes a move using Stockfish
        const session = await gameSessionService.getSession(sessionId);
        if (!session || session.status !== 'active') return null;
        const chess = new ChessGame(session.fen);
        const fen = chess.getFen();
        const moveStr = await getStockfishMove(fen, difficulty);
        if (!moveStr) {
            logger.info('Stockfish did not return a move for session ' + sessionId);
            return null;
        }

        // Stockfish returns UCI style bestmove like 'e2e4' or 'e7e8q'
        let moveObj = null;
        try {
            if (typeof moveStr === 'string' && /^[a-h][1-8][a-h][1-8][qrbnQRBN]?$/.test(moveStr)) {
                const from = moveStr.slice(0, 2);
                const to = moveStr.slice(2, 4);
                const promo = moveStr.length === 5 ? moveStr[4].toLowerCase() : undefined;
                moveObj = promo ? { from, to, promotion: promo } : { from, to };
            } else {
                // fallback: pass through (maybe SAN)
                moveObj = moveStr;
            }
        } catch (e) {
            logger.warn('Failed to parse Stockfish move string: ' + moveStr + ' - ' + e.message);
            moveObj = moveStr;
        }

        logger.info('Session ' + sessionId + ' - Stockfish chose: ' + JSON.stringify(moveObj));

        const move = chess.move(moveObj);
        if (!move) return null;
        const moves = session.moves ? JSON.parse(session.moves) : [];
        moves.push(move);
        const newFen = chess.getFen();
        let status = 'active';
        // ChessGame wrapper exposes isGameOver() which adapts to the underlying chess library
        if (chess.isGameOver && chess.isGameOver()) status = 'finished';
        await knex('game_sessions').where({ id: sessionId }).update({ fen: newFen, moves: JSON.stringify(moves), status, updated_at: new Date() });
        logger.info('Session ' + sessionId + ' - applied computer move, new fen: ' + newFen);
        return { fen: newFen, move, status };
    }
};

module.exports = ComputerGameService;
