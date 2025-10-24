require('dotenv').config();
console.log('dotenv configuration loaded');

const express = require('express');
const path = require('path');
const fs = require('fs');
const ejs = require('ejs');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const helmet = require('helmet');
const compression = require('compression');
const logger = require('./utils/logger');
const { registry } = require('./utils/metrics');
const { initializeService } = require('./utils/services/gameSessionService');

// Optional security and observability integrations (loaded only when configured)
let Sentry;
try {
    if (process.env.SENTRY_DSN) {
        Sentry = require('@sentry/node');
        Sentry.init({ dsn: process.env.SENTRY_DSN });
        logger.info('Sentry initialized');
    }
} catch (e) {
    logger.warn('Sentry not installed or failed to initialize: ' + e.message);
}
const db = require('./utils/db');
const apiRoutes = require('./utils/api');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(cookieParser(process.env.APP_SECRET));

// Session configuration: optionally use Redis store if REDIS_URL is provided
const sessionConfig = {
    secret: process.env.APP_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.COOKIE_SECURE === 'true' }
};

if (process.env.REDIS_URL) {
    try {
        const Redis = require('ioredis');
        const connectRedis = require('connect-redis');
        const RedisStore = connectRedis(session);
        const redisClient = new Redis(process.env.REDIS_URL);
        sessionConfig.store = new RedisStore({ client: redisClient });
        logger.info('Using Redis session store');
    } catch (e) {
        logger.warn('Redis session store not configured: ' + e.message);
    }
}

app.use(session(sessionConfig));
// Configure Helmet with a permissive Content-Security-Policy for CDNs we use
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://cdn.socket.io', "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https://cdn.jsdelivr.net'],
            connectSrc: ["'self'", 'https://cdn.socket.io', `ws://localhost:${process.env.PORT || 3000}`, `http://localhost:${process.env.PORT || 3000}`],
            // Allow loading styles from Google Fonts when used by the client
            styleSrc: ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
            // Allow font files from Google Fonts and CDNJS
            fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net']
        }
    }
}));
app.use(compression());
app.use('/api', apiRoutes);

// Rate limiting for sensitive endpoints
try {
    const rateLimit = require('express-rate-limit');
    const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
    app.use('/api/user/login', authLimiter);
    app.use('/api/user/register', authLimiter);
} catch (e) {
    logger.warn('express-rate-limit not installed or failed to initialize');
}

// Optional CSRF protection for non-API forms
if (process.env.ENABLE_CSRF === 'true') {
    try {
        const csurf = require('csurf');
        app.use(csurf({ cookie: true }));
    } catch (e) {
        logger.warn('csurf not installed or failed to initialize');
    }
}

// Optional Prometheus metrics endpoint
if (process.env.ENABLE_METRICS === 'true') {
    try {
        const client = require('prom-client');
        client.collectDefaultMetrics();
        app.get('/metrics', async (req, res) => {
            res.set('Content-Type', client.register.contentType);
            res.end(await client.register.metrics());
        });
    } catch (e) {
        logger.warn('prom-client not installed or failed to initialize');
    }
}

// If Sentry is initialized, add request and error handlers around API routes
if (Sentry) {
    try {
        app.use(Sentry.Handlers.requestHandler());
        app.use(Sentry.Handlers.errorHandler());
    } catch (e) {
        logger.warn('Failed to attach Sentry handlers: ' + e.message);
    }
}

// Middleware: Make activePath available to all views for nav highlighting
app.use((req, res, next) => {
    res.locals.activePath = req.path;
    next();
});

// Health and readiness endpoints
app.get('/health', (req, res) => res.status(200).send('OK'));
app.get('/ready', async (req, res) => {
    try {
        await db.checkConnection();
        res.status(200).send('READY');
    } catch (err) {
        res.status(500).send('NOT READY');
    }
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
});

// Helper: Capitalize for page titles
function Capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Helper: Check Database Connection
async function checkDbConnection() {
    try {
        await db.checkConnection();
        return true;
    } catch (err) {
        logger.error('Database error:', err);
        return err;
    }
}

// Render with layout, handling 404 and 500
async function renderWithLayout(res, page, options = {}) {
    // Ensure activePath is always available
    options.activePath = res.locals.activePath || options.activePath || '/';

    // Set isAdmin based on session
    const user = res.req.session?.user;
    options.isAdmin = user?.role === 'admin';
    options.isLoggedIn = !!user;

    // Protect specific paths (e.g., /profile and /admin)
    const protectedPaths = ['/profile', '/admin', '/play', '/game'];
    const currentPath = res.req.path;

    if (protectedPaths.some(p => currentPath.startsWith(p)) && !user) {
        return res.redirect('/login');
    }

    // Allow unauthenticated access to /game/:id but render it through the layout
    if (currentPath.startsWith('/game')) {
        options.title = 'Game';
        // Inform the game page whether sockets are enabled on the server
        options.enableSockets = process.env.ENABLE_SOCKETS === 'true';
        // Attempt to extract sessionId and playingColor from path or query
        try {
            const m = res.req.path.match(/\/game\/(\w+)/);
            if (m) options.sessionId = m[1];
            if (res.req.query && res.req.query.playingColor) options.playingColor = res.req.query.playingColor;
            if (res.req.query && res.req.query.vs === 'computer') options.playingVsComputer = true;
        } catch (e) {
            // ignore
        }

        // Render the page into the layout so site-wide styles/navigation are preserved
        const body = await ejs.renderFile(
            path.join(__dirname, 'views/pages', 'game.ejs'),
            options
        );
        return res.render('layout', { ...options, title: 'Game', body });
    }

    // Check DB connection if requried
    if (options.requriedDb) {
        const dbStatus = await checkDbConnection();
        if (dbStatus !== true) {
            res.status(500);
            logger.error('Could not render due to DB error: ' + dbStatus);
            try {
                const errorBody = await ejs.renderFile(
                    path.join(__dirname, 'views/pages', '500.ejs'),
                    { ...options, error: dbStatus }
                );
                return res.render('layout', {
                    ...options,
                    title: 'Database Error',
                    body: errorBody
                });
            } catch (errorPageError) {
                logger.error('Failed to render 500 page: ' + errorPageError.stack);
                return res.send('A server/database error occurred.');
            }
        }
    }

    let pagePath = path.join(__dirname, 'views/pages', `${page}.ejs`);
    if (!fs.existsSync(pagePath)) {
        const indexFallbackPath = path.join(__dirname, 'views/pages', page, 'home.ejs');
        if (fs.existsSync(indexFallbackPath)) {
            pagePath = indexFallbackPath;
        } else {
            res.status(404);
            logger.warn(`Page not found: ${pagePath}`);
            const body = await ejs.renderFile(
                path.join(__dirname, 'views/pages', '404.ejs'),
                options
            );
            return res.render('layout', {
                ...options,
                title: 'Page Not Found',
                body
            });
        }
    }

    try {
        const body = await ejs.renderFile(pagePath, options);
        logger.info(`Rendering page: ${page}`);
        res.render('layout', {
            ...options,
            body
        });
    } catch (error) {
        res.status(500);
        logger.error('Error rendering page: ' + error.stack);
        try {
            const errorBody = await ejs.renderFile(
                path.join(__dirname, 'views/pages', '500.ejs'),
                { ...options, error:error }
            );
            res.render('layout', {
                ...options,
                title: 'Server Error',
                body: errorBody
            });
        } catch (errorPageErr) {
            logger.error('Failed to render 500 error page: ' + errorPageErr.stack);
            res.send('A server error occurred.');
        }
    }
}

// Catch-all route for generic rendering based on URL path
app.get(/.*/, (req, res, next) => {
    try {
        const segments = req.path.split('/').filter(Boolean);
        const page = segments.join('/') || 'home';

        res.locals.activePath = req.path; // Ensure activePath is set

        renderWithLayout(res, page, {
            title: Capitalize(segments[segments.length - 1] || 'Home'),
            activePath: req.path // Explicitly pass activePath
        });
    } catch (error) {
        logger.error('Error in catch-all route: ' + error.stack);
        next(error);
    }
});

// 404 handler (fallback)
app.use((req, res) => {
    res.status(404);
    logger.warn('404 - Page not found: ' + req.originalUrl);
    renderWithLayout(res, '404', { title: 'Page Not Found' });
});

// 500 handler (fallback)
app.use((err, req, res, next) => {
    res.status(500);
    logger.error('500 - Server error: ' + err.stack);
    renderWithLayout(res, '500', { title: 'Server Error', error: err });
});

const PORT = process.env.PORT || 3000;

// Only start the server when this file is run directly. This allows tests
// to require the Express `app` without the server automatically listening.
if (require.main === module) {
    const http = require('http');
    const server = http.createServer(app);

    // Log critical environment variables
    logger.info(`Environment Variables Loaded: PORT=${process.env.PORT}, APP_SECRET=${process.env.APP_SECRET}, NODE_ENV=${process.env.NODE_ENV}`);

    // Optionally enable Socket.io when configured
    if (process.env.ENABLE_SOCKETS === 'true') {
        try {
            const { initSocket, getIo } = require('./utils/socket');
            const io = initSocket(server);
            const EventBus = require('./utils/eventBus');
            EventBus.on('queue:joined', ({ userId, elo }) => {
                // broadcast to matchmaking room
                io.to('matchmaking').emit('queue:joined', { userId, elo });
            });
            EventBus.on('queue:left', ({ userId }) => {
                io.to('matchmaking').emit('queue:left', { userId });
            });
            EventBus.on('queue:matched', (payload) => {
                try {
                    const { userId: uid, opponentId: oid, sessionId } = payload || {};
                    const payloadOut = { userId: uid, opponentId: oid };
                    if (sessionId) payloadOut.sessionId = sessionId;
                    io.to('matchmaking').emit('queue:matched', payloadOut);
                } catch (e) {
                    logger.warn('Error handling queue:matched in app.js: ' + (e && e.message));
                }
            });

            io.on('connection', (socket) => {
                logger.info('Socket connected: ' + socket.id);
                socket.on('disconnect', () => logger.info('Socket disconnected: ' + socket.id));
            });
            logger.info('Socket.io enabled');
        } catch (e) {
            logger.warn('socket.io not installed or failed to initialize: ' + e.message);
        }
    }

    // Initialize services before starting the server
    (async () => {
        console.log('Before initializing GameSessionService');
        try {
            await initializeService();
            console.log('GameSessionService initialized successfully');
        } catch (error) {
            console.error('Failed to initialize GameSessionService:', error);
            process.exit(1); // Exit the process if initialization fails
        }
    })();

    server.listen(PORT, async () => {
        console.log(`Server is running on http://localhost:${PORT}`);
        logger.info(`Server is running on http://localhost:${PORT}`);

        // Optionally start matchmaker worker
        if (process.env.ENABLE_MATCHMAKER === 'true') {
            try {
                const { start } = require('./workers/matchmakerWorker');
                start();
                logger.info('Matchmaker worker started');
            } catch (e) {
                logger.warn('Failed to start matchmaker worker: ' + e.message);
            }
        }

        // Optionally start stockfish worker (for computer move processing)
        if (process.env.ENABLE_STOCKFISH_WORKER === 'true') {
            try {
                const stockfishWorker = require('./workers/stockfishWorker');
                stockfishWorker.start();
                logger.info('Stockfish worker started');
            } catch (e) {
                logger.warn('Failed to start stockfish worker: ' + e.message);
            }
        }
    });
}

module.exports = app;