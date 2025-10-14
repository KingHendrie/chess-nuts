require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const ejs = require('ejs');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const helmet = require('helmet');
const compression = require('compression');

const logger = require('./utils/logger');
const db = require('./utils/db');
const apiRoutes = require('./utils/api');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(cookieParser(process.env.APP_SECRET));
app.use(session({
    secret: process.env.APP_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set secure: true if using HTTPS
}));
app.use(helmet());
app.use(compression());
app.use('/api', apiRoutes);

// Middleware: Make activePath available to all views for nav highlighting
app.use((req, res, next) => {
    res.locals.activePath = req.path;
    next();
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
    const protectedPaths = ['/profile', '/admin', '/play'];
    const currentPath = res.req.path;

    if (protectedPaths.some(p => currentPath.startsWith(p)) && !user) {
        return res.redirect('/login');
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
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    logger.info(`Server is running on http://localhost:${PORT}`);
});