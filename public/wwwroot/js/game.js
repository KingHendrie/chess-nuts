// public/wwwroot/js/game.js
// Chess game frontend UI using chessboard.js and chess.js

let board = null;
let game = null;
let timerInterval = null;
let moveHistory = [];
let sessionId = null;
let socket = null;

function updateGameInfo() {
    document.getElementById('game-turn').textContent = game.turn() === 'w' ? 'White' : 'Black';
    document.getElementById('game-status').textContent = game.game_over() ? 'Game Over' : 'In Progress';
    document.getElementById('game-moves').textContent = moveHistory.length;
}

function updateBoard() {
    board.position(game.fen());
    updateGameInfo();
}

function startTimer() {
    let seconds = 0;
    timerInterval = setInterval(() => {
        seconds++;
        const min = Math.floor(seconds / 60);
        const sec = seconds % 60;
        document.getElementById('game-timer').textContent = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

function sendMove(moveObj) {
    if (!sessionId) {
        alert('You are not in a game session. Moves cannot be sent.');
        return;
    }

    fetch(`/api/game/session/${sessionId}/move`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ move: moveObj })
    })
    .then(async res => {
        if (res.status === 401) {
            // authentication/token missing
            alert('Authentication required to make moves. Please sign in.');
            throw new Error('Unauthorized');
        }
        const data = await res.json();
        if (res.ok && data.success) {
            // server accepted move; nothing more to do because we already updated locally
            return data;
        } else {
            throw new Error(data.error || 'Invalid move');
        }
    })
    .catch(err => {
        console.error('Move failed:', err);
        alert(err.message || 'Move failed');
        // Optionally reload position from server or revert last move — left as future improvement
    });
}

function onDrop(source, target) {
    // construct a move; include promotion default to queen for pawn promotion
    const tentative = { from: source, to: target, promotion: 'q' };
    const result = game.move(tentative);
    if (result === null) {
        // illegal move
        return 'snapback';
    }

    // legal move: update history and UI
    moveHistory.push({ from: result.from, to: result.to, promotion: result.promotion });
    updateBoard();
    if (game.game_over()) stopTimer();

    // send to server (server may validate / persist)
    sendMove({ from: result.from, to: result.to, promotion: result.promotion });
}

function addChatMessage(msg) {
    const chatBox = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.textContent = msg;
    chatBox.appendChild(div);
}

document.addEventListener('DOMContentLoaded', () => {
    // Assume sessionId is set via server-side rendering or query param
    sessionId = window.sessionId || null;
    // If sessionId not provided by server, try to parse it from URL (/game/:id)
    if (!sessionId) {
        try {
            const path = window.location.pathname;
            let m = path.match(/\/game\/(\w+)/);
            if (!m) m = path.match(/\/game:(\w+)/); // support /game:ID form
            if (m) sessionId = m[1];
        } catch (e) {
            console.log('Could not parse sessionId from URL:', e);
        }
    }
    console.log('Checking if Chess object is defined:', typeof Chess !== 'undefined');

    // Ensure game initialization logs
    if (typeof Chess !== 'undefined') {
        console.log('Chess object is defined. Initializing game...');
    } else {
        console.error('Chess object is not defined. Ensure chess.js is loaded correctly.');
    }

    game = new Chess();

    // Initialize the board only after attempting to load the local mapping to avoid
    // external raw.githubusercontent requests which may be blocked by CSP.
    (async function initBoard() {
        const mappingUrl = '/img/chesspieces/wikimedia/map.json';
        let pieceMap = null;
        try {
            const res = await fetch(mappingUrl);
            if (res.ok) {
                pieceMap = await res.json();
                console.log('Loaded local piece map with keys:', Object.keys(pieceMap));
            } else {
                console.log('No local piece map found; using local wikipedia folder fallback');
            }
        } catch (e) {
            console.log('Error loading piece map:', e);
        }

        const baseWikimedia = '/img/chesspieces/wikimedia/';
        const baseWikipedia = '/img/chesspieces/wikipedia/';

        // Warn if multiple piece codes point to the same filename
        const reverse = {};
        Object.keys(pieceMap || {}).forEach(k => {
            const f = pieceMap[k];
            if (!f) return;
            reverse[f] = reverse[f] || [];
            reverse[f].push(k);
        });
        Object.keys(reverse).forEach(f => {
            if (reverse[f].length > 1) {
                console.warn('Piece map duplicate filename:', f, 'used for', reverse[f]);
            }
        });

        const pieceThemeFromMap = function(piece) {
            // piece argument is like 'wP' or 'bK'
            let filename;
            if (pieceMap && pieceMap[piece]) filename = baseWikimedia + pieceMap[piece];
            else filename = baseWikipedia + piece + '.png';
            console.debug('pieceTheme called for', piece, '->', filename);
            return filename;
        };

        function createBoard() {
            const orientation = (window.playingColor === 'black') ? 'black' : 'white';
            if (board && typeof board.destroy === 'function') {
                try { board.destroy(); } catch (e) { /* ignore */ }
            }
            board = Chessboard('game-board', {
                draggable: true,
                position: (typeof game !== 'undefined' && game) ? game.fen() : 'start',
                orientation: orientation,
                onDrop: onDrop,
                pieceTheme: pieceThemeFromMap
            });
        }

        // create initial board
        createBoard();

        // expose helper to flip board to player's color at bottom
        window.setPlayingColor = function(color) {
            window.playingColor = color === 'black' ? 'black' : 'white';
            createBoard();
            fitBoardToContainer();
        }
        // Ensure initial orientation matches any server-provided value
        try { window.setPlayingColor(window.playingColor || 'white'); } catch (e) { /* ignore */ }
    })();
    // Ensure board container is square and fits the viewport -- adapt on resize
    function fitBoardToContainer() {
        const el = document.getElementById('game-board');
        if (!el) return;
        const style = getComputedStyle(el);
        const width = Math.min(window.innerWidth * 0.9, 640);
        el.style.width = width + 'px';
        el.style.height = width + 'px';
        // some chessboard implementations expose a resize method
        try { if (board && typeof board.resize === 'function') board.resize(); } catch (e) { /* ignore */ }
    }

    window.addEventListener('resize', () => fitBoardToContainer());
    // initial fit
    setTimeout(fitBoardToContainer, 50);
    updateGameInfo();
    startTimer();

    // Connect to socket if available and enabled on server
    if (window.enableSockets && typeof io !== 'undefined') {
        socket = io();

        // Listen for opponent moves
        socket.on('move', (move) => {
            game.move(move);
            moveHistory.push(move);
            updateBoard();
            if (game.game_over()) stopTimer();
        });

        // Listen for game start
        socket.on('gameStart', (data) => {
            console.log('Game started:', data);
            game.load(data.fen);
            board.position(data.fen);
            updateGameInfo();
        });
    }

    document.getElementById('move-undo').addEventListener('click', () => {
        game.undo();
        moveHistory.pop();
        updateBoard();
    });
    document.getElementById('move-resign').addEventListener('click', () => {
        stopTimer();
        document.getElementById('game-status').textContent = 'Resigned';
    });
    // If playing vs computer, request engine move when it's not player's turn
    if (window.playingVsComputer) {
        socket?.on('connected', () => {
            // no-op
        });
        // Poll: if it's opponent turn, request computer move
        let awaitingComputerMove = false;
        async function maybeRequestComputerMove() {
            if (!game || awaitingComputerMove) return;
            // Determine whose turn it is and whether that side is the computer
            const turn = game.turn(); // 'w' or 'b'
            console.debug('maybeRequestComputerMove check', { turn, sessionId, playingColor: window.playingColor, playingVsComputer: window.playingVsComputer });
            // If user is white and it's black's turn, or user is black and it's white's turn -> request computer move
            const userColor = (window.playingColor === 'black') ? 'b' : 'w';
            const computerColor = userColor === 'w' ? 'b' : 'w';
            if (turn !== computerColor) return;
            awaitingComputerMove = true;
            try {
                const headers = { 'Content-Type': 'application/json' };
                const token = localStorage.getItem('jwtToken');
                if (token) headers['Authorization'] = `Bearer ${token}`;
                console.debug('Requesting computer move for session', sessionId);
                const res = await fetch(`/api/game/session/${sessionId}/computer-move`, { method: 'POST', credentials: 'include', headers, body: JSON.stringify({ difficulty: window.computerDifficulty || 10 }) });
                console.debug('computer-move response', res.status);
                if (!res.ok) console.warn('computer-move request failed with status', res.status);
            } catch (e) {
                console.error('computer-move request error', e);
            } finally {
                awaitingComputerMove = false;
            }
        }

        // Poll every 1.5s to check whether the computer should move
        setInterval(maybeRequestComputerMove, 1500);
        // After initialization, check immediately in case computer starts
        setTimeout(maybeRequestComputerMove, 200);
    }
    document.getElementById('chat-send').addEventListener('click', () => {
        const input = document.getElementById('chat-input');
        if (input.value.trim()) {
            addChatMessage('You: ' + input.value.trim());
            input.value = '';
        }
    });
});
