let ioInstance = null;

function initSocket(server) {
    if (ioInstance) return ioInstance;
    const { Server } = require('socket.io');
    const io = new Server(server, { cors: { origin: '*' } });
    // If REDIS_URL is present, attempt to attach the redis adapter so Socket.io can scale across nodes.
    if (process.env.REDIS_URL) {
        try {
            const { createAdapter } = require('@socket.io/redis-adapter');
            const { default: IORedis } = require('ioredis');
            const pubClient = new IORedis(process.env.REDIS_URL);
            const subClient = pubClient.duplicate();
            io.adapter(createAdapter(pubClient, subClient));
            console.log('Socket.io redis adapter enabled');
        } catch (e) {
            console.warn('Failed to initialize socket.io redis adapter:', e.message);
        }
    }
    io.on('connection', (socket) => {
        console.log('Socket connected: ' + socket.id);
        socket.on('joinMatchmaking', (data) => {
            socket.join('matchmaking');
        });
        socket.on('leaveMatchmaking', () => {
            socket.leave('matchmaking');
        });
        // Allow clients to join a game-specific room so we can emit moves for that session only
        socket.on('joinGame', (payload) => {
            try {
                const sessionId = payload && (payload.sessionId || payload.id) ? (payload.sessionId || payload.id) : payload;
                if (sessionId) {
                    const room = `game_${sessionId}`;
                    socket.join(room);
                    console.log(`Socket ${socket.id} joined room ${room}`);
                }
            } catch (e) {
                console.warn('joinGame handler error:', e && e.message);
            }
        });
        socket.on('leaveGame', (payload) => {
            try {
                const sessionId = payload && (payload.sessionId || payload.id) ? (payload.sessionId || payload.id) : payload;
                if (sessionId) {
                    const room = `game_${sessionId}`;
                    socket.leave(room);
                    console.log(`Socket ${socket.id} left room ${room}`);
                }
            } catch (e) {
                console.warn('leaveGame handler error:', e && e.message);
            }
        });
    });
    // Add logging to confirm socket.io.js requests
    io.engine.on('initial_headers', (headers, req) => {
        console.log('Socket.IO client script requested:', req.url);
    });
    ioInstance = io;
    return io;
}

function getIo() {
    return ioInstance;
}

module.exports = { initSocket, getIo };
