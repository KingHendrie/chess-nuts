const fs = require('fs');
const path = require('path'); 

const logDir = path.join(__dirname, 'logs');

// make sure the log directory exists
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

function getLogFileName() {
    const now = new Date();
    const date = now.toISOString().slice(0, 10); // YYYY-MM-DD
    return path.join(logDir, `app-${date}.log`);
}

function writeLog(level, message) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
    fs.appendFile(getLogFileName(), line, err => {
        if (err) {
            console.log('Failed to write to log file:', err);
        }
    });
}

module.exports = {
    info: (msg) => writeLog('info', msg),
    warn: (msg) => writeLog('warn', msg),
    error: (msg) => writeLog('error', msg),
};