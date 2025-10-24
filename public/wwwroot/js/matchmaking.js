// public/wwwroot/js/matchmaking.js

document.addEventListener('DOMContentLoaded', () => {
    const joinBtn = document.getElementById('join-matchmaking');
    const cancelBtn = document.getElementById('cancel-matchmaking');
    const statusBox = document.getElementById('matchmaking-status');
    const eloValue = document.getElementById('elo-value');
    const waitValue = document.getElementById('wait-value');

    let searchInterval = null;
    let startTime = null;
    let userElo = 500;
    let socket = null;

    async function fetchElo() {
        // Get user profile to show ELO
        try {
            const res = await fetch('/api/user/profile');
            if (!res.ok) return;
            const ct = res.headers.get('content-type') || '';
            if (!ct.includes('application/json')) return;
            const data = await res.json();
            userElo = data.elo || 500;
            eloValue.textContent = userElo;
        } catch (e) {
            console.warn('Failed to fetch user profile for ELO:', e);
        }
    }

    async function joinMatchmaking() {
        joinBtn.disabled = true;
        statusBox.textContent = 'Searching...';
        cancelBtn.style.display = '';
        startTime = Date.now();
        await fetch('/api/matchmaking/join', { method: 'POST' });
        if (!socket && window.io) {
            socket = io();
            socket.emit('joinMatchmaking', {});
            socket.on('queue:matched', (data) => {
                // If matched and current user is part of the match, navigate to game
                const userId = window.currentUserId;
                if (data.userId === userId || data.opponentId === userId) {
                    // If server provided a sessionId, redirect directly to that game
                    if (data.sessionId) {
                        window.location.href = `/game/${data.sessionId}`;
                    } else {
                        // fallback
                        window.location.href = '/game';
                    }
                }
            });
        }
        searchInterval = setInterval(updateWaitTime, 1000);
    }

    async function cancelMatchmaking() {
        cancelBtn.disabled = true;
        await fetch('/api/matchmaking/leave', { method: 'POST' });
        statusBox.textContent = 'Not searching';
        cancelBtn.style.display = 'none';
        joinBtn.disabled = false;
        waitValue.textContent = '-';
        clearInterval(searchInterval);
        if (socket) {
            socket.emit('leaveMatchmaking');
            socket.disconnect();
            socket = null;
        }
    }

    function updateWaitTime() {
        const seconds = Math.floor((Date.now() - startTime) / 1000);
        waitValue.textContent = seconds + 's';
    }

    joinBtn.addEventListener('click', joinMatchmaking);
    cancelBtn.addEventListener('click', cancelMatchmaking);
    fetchElo();
});
