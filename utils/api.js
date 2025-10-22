const eloService = require('./services/eloService');
const express = require('express');
const router = express.Router();
const transporter = require('./mailer');
const logger = require('./logger');
const { htmlToText } = require('html-to-text');
const db = require('./db');
const bcrypt = require('bcrypt');
const matchmakingService = require('./services/matchmakingService');
// gameSessionService may be exported either as { GameSessionService } or as the service object itself
const _gameSessionModule = require('./services/gameSessionService');
const GameSessionService = _gameSessionModule.GameSessionService || _gameSessionModule;
// backward-compatible alias used by some routes
const gameSessionService = GameSessionService;
const computerJobQueue = require('./computerJobQueue');
const jwt = require('jsonwebtoken');

function generate2FACode() {
    const digits = () => Math.floor(100 + Math.random() * 900);
    return `${digits()}-${digits()}-${digits()}`;
}

// Auth middleware
function requireAuth(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({ error: "Not authenticated." });
    }
    next();
}

// Middleware to verify JWT tokens
function verifyToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid token.' });
    }
}

// Middleware that accepts either a Bearer JWT or an existing session-based login.
function verifyTokenOrSession(req, res, next) {
    // If there's a session user, accept it
    if (req.session && req.session.user) {
        req.user = {
            id: req.session.user.id,
            email: req.session.user.email,
            role: req.session.user.role
        };
        return next();
    }

    // Otherwise try the Authorization header
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied. No token or session provided.' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid token.' });
    }
}

// Enable JSON parsing for API routes
router.use(express.json({ limit: '5mb' }));
router.use(express.urlencoded({ limit: '5mb', extended: true }));

//#region Emails

router.post('/email/send-email', async (req, res) => {
    const { to, subject, text, html } = req.body;

    if (!to || !subject || (!text && !html)) {
        logger.warn('Email send attempt with missing fields');
        return res.status(400).json({ error: "Missing required fields!"});
    }

    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to,
            subject,
            text,
            html,
        });

        logger.info(`Email sent to ${to} with subject "${subject}"`);
        res.json({ success: true });
    } catch (error) {
        logger.error('Error sending email: ' + error.stack);
        res.status(500).json({ error: 'Failed to send email.' });
    }
});

router.post('/email/send-contanct', async (req, res) => {
    const { to, subject, text, html } = req.body;

    if (!to || !subject || (!text && !html)) {
        logger.warn('Email send attempt with missing fields.');
        return res.status(400).json({ error: "Missing required fields!" });
    }

    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_TO,
            subject,
        };

        if (html) {
            mailOptions.html = html;
            mailOptions.text = htmlToText(html);
        } else if (text) {
            mailOptions.text = text;
        }

        await transporter.sendMail(mailOptions);
        logger.info(`Email sent to ${process.env.EMAIL_TO} with subject "${subject}"`);
        res.json({ success: true });
    } catch (error) {
        logger.warn('Error sending email: ' + error.stack);
        res.status(500).json({ error: "Failed to send email."});
    }
});

//#endregion Emails

//#region 2FA

router.post('/2fa/verify-2fa', async (req, res) => {
    const { code } = req.body;
    const pending = req.session.pending2FA;

    if (!pending) {
        logger.warn('2FA verification attempt without pending challenge');
        return res.status(400).json({ error: "No 2FA challenge pending." });
    }
    if (!code || typeof code !== 'string') {
        logger.warn('2FA verification attempt with missing code');
        return res.status(400).json({ error: "Missing 2FA code." });
    }
    if (pending.expires < Date.now()) {
        logger.warn('2FA code expired for user ' + pending.userId);
        delete req.session.pending2FA;
        return res.status(400).json({ error: "2FA code expired. Please login again." });
    }
    if (pending.code !== code.trim()) {
        logger.warn(`2FA verification failed for user ${pending.userId}: Incorrect code`);
        return res.status(401).json({ error: "Incorrect 2FA code." });
    }

    const user = await db.getUserById(pending.userId);
    if (!user) {
        logger.warn(`2FA verification failed: User ${pending.userId} does not exist.`);
        return res.status(400).json({ error: "User not longer exists." });
    }

    req.session.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName
    };

    delete req.session.pending2FA;
    res.json({ success: true, message: "2FA verified. Login complete." });
})

//#endregion 2FA

//#region User Registration and Authentication

// User Registration
router.post('/user/register', async (req, res) => {
    const { firstName, lastName, email, password, role = 'user' } = req.body;

    if (!firstName || !lastName || !email || !password) {
        logger.warrn('Registration attempt with missing fields!');
        return res.status(400).json({ error: "Missing required fields!" });
    }

    try {
        const userExists = await db.checkUserExists(email);
        if (userExists) {
            logger.warn(`Registration failed: User ${email} already exists`);
            return res.status(400).json({ error: "User already exists!" });
        }
        logger.info(`User ${email} does not exist, proceeding with registration`);
    } catch (error) {
        logger.error('Error checking user existence: ' + error.stack);
        return res.status(500).json({ error: "Database error." });
    }

    try {
        const user = await db.createUser(
            firstName,
            lastName,
            email,
            password,
            role
        );

        if (user) {
            logger.info(`User ${email} registered successfully`);
            res.json({ success: true, message: "Registration successful." });
        } else {
            logger.warn(`Registration failed for unknown reasons for user ${email}`);
            res.status(500).json({ error: "Registration failed." });
        }
    } catch (error) {
        logger.error('Error during user registration: ' + error.stack);
        res.status(500).json({ error: "Database error." });
    }
});

// User Login
router.post('/user/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        logger.warn('Login attempt with missing fields');
        return res.status(400).json({ error: 'Missing required fields!' });
    }

    try {
        const user = await db.checkUserCredentials(email, password);
        if (user) {
            const token = jwt.sign(
                { id: user.id, email: user.email, role: user.role },
                process.env.JWT_SECRET || 'default-secret',
                { expiresIn: '1h' }
            );
            req.session.user = { id: user.id, email: user.email, role: user.role }; // Set session user
            res.json({ success: true, token }); // Return the token in the response
        } else {
            logger.warn(`Login failed for user ${email}`);
            res.status(401).json({ error: 'Invalid email or password.' });
        }
    } catch (error) {
        logger.error('Error during login: ' + error.stack);
        res.status(500).json({ error: 'Failed to process login.' });
    }
});

// User Logout
router.post('/user/logout', async (req, res) => {
    req.session.destroy(err => {
        if (err) {
            logger.error('Error destroying session:', err);
            return res.status(500).json({ error: 'Failed to logout.' });
        }

        res.clearCookie('connect.sid'); // Default cookie name for express-session
        logger.info('User logged out and session destroyed.');
        return res.json({ success: true, message: 'Logout successful.' });
    });
});

// Check User session
router.get('/user/status', (req, res) => {
    if (req.session && req.session.user) {
        res.json({ loggedIn: true });
    } else {
        res.json({ loggedIn: false });
    }
});

//#endregion User Registration and Authentication

//#region User Profile

// Get User Profile
router.get('/user/profile', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "Not authenticated." });
    }

    try {
        const user = await db.getUserById(req.session.user.id);
        if (!user) return res.status(404).json({ error: "User not found." });

        res.json({
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            two_factor_enabled: !!user.two_factor_enabled
        });

        logger.info(`User profile fetched for ${user.email}`);
    } catch (error) {
        logger.error('Error getting user: ' + error.stack);
        res.status(500).json({ error: "Failed to fetch user info." });
    }
});

// Update User 2FA Setting
router.patch('/user/profile/2fa', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "Not authenticated." });
    }

    const { enabled } = req.body;
    if (typeof enabled !== "boolean") {
        return res.status(400).json({ error: "Enabled flag required (boolean)." });
    }

    try {
        await db.setTwoFA(
            req.session.user.id,
            enabled
        );

        logger.info(`2FA status updated for user ${req.session.user.email}: ${enabled}`);
        req.session.user.two_factor_enabled = enabled;
        res.json({ success: true });
    } catch (error) {
        logger.warn('Error updating 2FA: ' + error.stack);
        res.status(500).json({ error: "Failed to update 2FA." });
    }
});

// User Password Change Request
router.post('/user/profile/password/request', async (req, res)  => {
    if (!req.session.user) {
        return res.status(401).json({ error: "Not authenticated." });
    }

    try {
        const user = await db.getUserById(req.session.user.id);
        if (!user) return res.status(404).json({ error: "User not found." });

        const code = generate2FACode();
        req.session.pendingPasswordChange = {
            userId: user.id,
            code,
            expires: Date.now() + 5 * 60 * 1000
        };

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: "Your Password Change Code",
            text: `Your code to change your password: ${code}`,
            html: `<p>Your code to change your password: <b>${code}</b></p>`
        });

        res.json({ success: true, message: "Verification code sent to your email." });
    } catch (error) {
        logger.error('Error during password change request: ' + error.stack);
        res.status(500).json({ error: "Failed to send password change code." });
    }
});

// User Password Change
router.put('/user/profile/password/change', async (req, res) => {
    const { code, newPassword } = req.body;

    if (!req.session.user) {
        return res.status(401).json({ error: "Not authenticated." });
    }

    const pending = req.session.pendingPasswordChange;
    if (!pending || pending.userId !== req.session.user.id) {
        logger.warn('Password change attempt without pending change');
        return res.status(400).json({ error: "No password change pending." });
    }

    if (!code || !newPassword) {
        logger.warn('Password change attempt with missing fields');
        return res.status(400).json({ error: "Code and new password required." });
    }

    if (pending.expires < Date.now()) {
        logger.warn(`Password change code expired for user ${pending.userId}`);
        delete req.session.pendingPasswordChange;
        return res.status(400).json({ error: "Verification code expired." });
    }

    if (pending.code !== code.trim()) {
        logger.warn(`Password change failed for user ${pending.userId}: Incorrect code`);
        return res.status(401).json({ error: "Incorrect verification code." });
    }

    try {
        const hash = await bcrypt.hash(newPassword, 10);
        await db.updateUserPassword(req.session.user.id, hash);
        delete req.session.pendingPasswordChange;
        res.json({ success: true, message: "Password updated successfully." });
    } catch (error) {
        logger.error('Error updating password: ' + error.stack);
        res.status(500).json({ error: "Failed to update password." });
    }
});

//#endregion User Profile

//#region Admin Actions

// Get All Users Paginated
router.get('/admin/users', async (req, res) => {
    const { page = 1, pageSize = 10 } = req.body;

    try {
        const users = await db.getUsersPaginated(page, pageSize);
        return res.json(users);
    } catch (error) {
        logger.error('Error fetching users:', error);
        return res.status(500).json({ error: "Failed to fetch users." });
    }
});

// Update User
router.put('/admin/users/:id', async (req, res) => {
    const { id } = req.params;
    const { firstName, lastName, email, password, role } = req.body;

    if (!firstName || !lastName || !email || !role) {
        logger.warn('Admin user update attempt with missing fields');
        return res.status(400).json({ error: "Missing required fields!" });
    }

    try {
        const updated = await db.updateUser(id, {
            firstName,
            lastName,
            email,
            password,
            role
        });

        if (updated) {
            logger.info(`User ${email} updated successfully`);
            res.json({ success: true, message: "User updated successfully." });
        } else {
            logger.warn(`Update faild for user ${email}`);
            res.status(400).json({ error: "Update failed." });
        }
    } catch (error) {
        logger.error('Error updating user: ' + error.stack);
        res.status(500).json({ error: "Failed to update user." });
    }
});

//#endregion Admin Actions

//#region Matchmaking and Game Sessions

// Join matchmaking queue
router.post('/matchmaking/join', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await matchmakingService.joinQueue(userId);
        res.json({ success: true, queue: result });
    } catch (error) {
        logger.error('Error joining matchmaking queue:', error);
        res.status(500).json({ error: 'Failed to join matchmaking queue.' });
    }
});

// Leave matchmaking queue
router.post('/matchmaking/leave', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        await matchmakingService.leaveQueue(userId);
        res.json({ success: true });
    } catch (error) {
        logger.error('Error leaving matchmaking queue:', error);
        res.status(500).json({ error: 'Failed to leave matchmaking queue.' });
    }
});

// Create a new game session between two users
router.post('/game/session/create', verifyToken, async (req, res) => {
    try {
        const { opponentId, color, initialFen } = req.body;
        const userId = req.user.id;

        // Validate opponentId
        const isComputerOpponent = opponentId === 'computer';
        const validatedOpponentId = isComputerOpponent ? 0 : parseInt(opponentId, 10);

        if (!validatedOpponentId && !isComputerOpponent) {
            return res.status(400).json({ error: 'Invalid opponentId.' });
        }

        const playerWhiteId = color === 'white' ? userId : validatedOpponentId;
        const playerBlackId = color === 'black' ? userId : validatedOpponentId;

        // Input validation
        if (!opponentId || !['white', 'black'].includes(color)) {
            return res.status(400).json({ error: 'Invalid opponentId or color.' });
        }

        const session = await GameSessionService.createSession(playerWhiteId, playerBlackId, initialFen);
        res.json({ success: true, session });
    } catch (error) {
        logger.error('Error creating game session: ' + error.stack);
        res.status(500).json({ error: 'Failed to create game session.' });
    }
});

// Make a move in a game session

router.post('/game/session/:id/move', verifyTokenOrSession, async (req, res) => {
    try {
        const sessionId = req.params.id;
        const moveObj = req.body.move;
        const result = await gameSessionService.makeMove(sessionId, moveObj);
        if (!result) {
            return res.status(400).json({ error: 'Invalid move or session.' });
        }

        // If game is finished, update ELOs
        if (result.status === 'finished') {
            const session = await gameSessionService.getSession(sessionId);
            // Determine winner/loser/draw
            let winnerId = null, loserId = null, draw = false;
            const chess = require('chess.js');
            const game = new chess.Chess(session.fen);
            if (game.isDraw()) {
                draw = true;
            } else if (game.isCheckmate()) {
                // Winner is the player who just moved
                winnerId = game.turn() === 'w' ? session.player_black_id : session.player_white_id;
                loserId = game.turn() === 'w' ? session.player_white_id : session.player_black_id;
            }
            if (draw) {
                await eloService.updateElo(session.player_white_id, session.player_black_id, 0.5);
            } else if (winnerId && loserId) {
                await eloService.updateElo(winnerId, loserId, 1);
            }
        }

        res.json({ success: true, ...result });
    } catch (error) {
        logger.error('Error making move in game session:', error);
        res.status(500).json({ error: 'Failed to make move.' });
    }
});

// Export PGN for a session
router.get('/game/session/:id/export/pgn', requireAuth, async (req, res) => {
    try {
        const session = await gameSessionService.getSession(req.params.id);
        if (!session) return res.status(404).json({ error: 'Session not found' });
        const { Chess } = require('chess.js');
        const game = new Chess(session.fen);
        const pgn = game.pgn();
        res.set('Content-Type', 'application/vnd.chess-pgn');
        res.send(pgn);
    } catch (e) {
        logger.error('Failed to export PGN: ' + e.stack);
        res.status(500).json({ error: 'Failed to export PGN' });
    }
});

// Request computer to move for a session (enqueue job)
router.post('/game/session/:id/computer-move', verifyTokenOrSession, async (req, res) => {
    try {
        const sessionId = req.params.id;
        const { difficulty = 10 } = req.body;
        logger.info(`Received computer-move request for session ${sessionId} (difficulty ${difficulty}) from user ${req.user?.id || 'anonymous'}`);
        const enqueued = await computerJobQueue.enqueueComputerMove(sessionId, difficulty);
        logger.info(`Enqueue result for session ${sessionId}: ${enqueued}`);
        if (!enqueued) return res.status(500).json({ error: 'Failed to enqueue computer move' });
        res.json({ success: true, enqueued: true });
    } catch (e) {
        logger.error('Failed to enqueue computer move: ' + e.stack);
        res.status(500).json({ error: 'Failed to enqueue computer move' });
    }
});

// Route for /play to enter matchmaking queue
router.get('/play', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const queueEntry = await matchmakingService.joinQueue(userId);

        // Poll for a match (simplified for now)
        const interval = setInterval(async () => {
            const match = await matchmakingService.findMatch(userId, queueEntry.elo);
            if (match) {
                clearInterval(interval);
                await matchmakingService.setMatched(userId, match.user_id);

                // Create a game session
                const session = await gameSessionService.createSession(userId, match.user_id);
                res.redirect(`/game:${session.id}`);
            }
        }, 2000); // Poll every 2 seconds
    } catch (error) {
        logger.error('Error in /play route:', error);
        res.status(500).json({ error: 'Failed to enter matchmaking queue.' });
    }
});

// Route for /game:gameid to load game session
router.get('/game:gameid', verifyToken, async (req, res) => {
    try {
        const sessionId = req.params.gameid;
        const session = await gameSessionService.getSession(sessionId);

        if (!session) {
            return res.status(404).json({ error: 'Game session not found.' });
        }

        res.json({
            success: true,
            session
        });
    } catch (error) {
        logger.error('Error in /game:gameid route:', error);
        res.status(500).json({ error: 'Failed to load game session.' });
    }
});

// Route to render the game page
router.get('/game/:id', async (req, res) => {
    const gameId = req.params.id;

    // Validate gameId
    if (!gameId || isNaN(parseInt(gameId, 10))) {
        return res.status(400).send('Invalid game ID');
    }

    try {
        // Render the game page with the game ID
        res.render('pages/game', { title: 'Game', gameId });
    } catch (error) {
        logger.error('Error rendering game page:', error);
        res.status(500).send('Failed to load game page');
    }
});

// Add a protected /game route
router.get('/game', verifyToken, (req, res) => {
    res.json({ success: true, message: 'Access granted to /game' });
});

module.exports = router;
