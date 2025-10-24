document.addEventListener('DOMContentLoaded', () => {
    const vsPlayerButton = document.getElementById('vsPlayer');
    const vsComputerButton = document.getElementById('vsComputer');
    const matchmakingDiv = document.getElementById('matchmaking');
    const computerOptionsDiv = document.getElementById('computerOptions');

    vsPlayerButton.addEventListener('click', async () => {
        matchmakingDiv.classList.remove('d-none');
        try {
            const response = await fetch('/api/matchmaking/join', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('jwtToken')}` }
            });

            // Only attempt to parse JSON when the response contains JSON
            let result = null;
            const ct = response.headers.get('content-type') || '';
            if (ct.includes('application/json')) {
                try { result = await response.json(); } catch (e) { console.warn('Failed to parse matchmaking/join JSON:', e); }
            } else {
                // If server returned HTML (e.g., redirect), log the snippet for debugging
                try { const txt = await response.text(); console.warn('Non-JSON response from matchmaking/join:', txt && txt.slice ? txt.slice(0,200) : txt); } catch(e){}
            }

            if (result && result.success) {
                // Poll for a match
                const interval = setInterval(async () => {
                    try {
                        const matchResponse = await fetch('/api/matchmaking/find', {
                            method: 'GET',
                            headers: { 'Authorization': `Bearer ${localStorage.getItem('jwtToken')}` }
                        });

                        let matchResult = null;
                        const mct = matchResponse.headers.get('content-type') || '';
                        if (mct.includes('application/json')) {
                            try { matchResult = await matchResponse.json(); } catch (e) { console.warn('Failed to parse matchmaking/find JSON:', e); }
                        } else {
                            try { const txt = await matchResponse.text(); console.warn('Non-JSON response from matchmaking/find:', txt && txt.slice ? txt.slice(0,200) : txt); } catch(e){}
                        }

                        if (matchResult && matchResult.success && matchResult.matchFound) {
                            clearInterval(interval);
                            window.location.href = '/game';
                        }
                    } catch (e) {
                        console.warn('Error polling matchmaking/find:', e);
                    }
                }, 2000);
            }
        } catch (error) {
            console.error('Error joining matchmaking:', error);
        }
    });

    vsComputerButton.addEventListener('click', () => {
        computerOptionsDiv.classList.remove('d-none');
    });

    document.getElementById('playAsWhite').addEventListener('click', async () => {
        await startComputerGame('white');
    });

    document.getElementById('playAsBlack').addEventListener('click', async () => {
        await startComputerGame('black');
    });

    async function startComputerGame(color) {
        try {
            const response = await fetch('/api/game/session/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
                },
                body: JSON.stringify({ opponentId: 'computer', color })
            });

            let result = null;
            const ct = response.headers.get('content-type') || '';
            if (ct.includes('application/json')) {
                try { result = await response.json(); } catch (e) { console.warn('Failed to parse create session JSON:', e); }
            } else {
                try { const txt = await response.text(); console.warn('Non-JSON response from session/create:', txt && txt.slice ? txt.slice(0,200) : txt); } catch(e){}
            }

            if (result && result.success) {
                window.location.href = `/game/${result.session.id}?playingColor=${color}&vs=computer`;
            } else if (response.status === 401) {
                // Not authenticated — prompt user to login
                alert('You must be logged in to start a game. Please log in and try again.');
            }
        } catch (error) {
            console.error('Error starting computer game:', error);
        }
    }
});