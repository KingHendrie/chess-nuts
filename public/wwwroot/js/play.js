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
            const result = await response.json();
            if (result.success) {
                // Poll for a match
                const interval = setInterval(async () => {
                    const matchResponse = await fetch('/api/matchmaking/find', {
                        method: 'GET',
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('jwtToken')}` }
                    });
                    const matchResult = await matchResponse.json();
                    if (matchResult.success && matchResult.matchFound) {
                        clearInterval(interval);
                        window.location.href = '/game';
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
            const result = await response.json();
            if (result.success) {
                // Redirect to the standard /game/:id route and include playingColor and vs=computer so the game page
                // can initialize orientation and know this is a computer game.
                window.location.href = `/game/${result.session.id}?playingColor=${color}&vs=computer`;
            }
        } catch (error) {
            console.error('Error starting computer game:', error);
        }
    }
});