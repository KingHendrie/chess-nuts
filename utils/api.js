const express = require('express');
const router = express.Router();
const transporter = require('./mailer');
const logger = require('./logger');
const { htmlToText } = require('html-to-text');
const db = require('./db');
const bcrypt = require('bcrypt');

function generate2FACode() {
    const digits = () => Math.floor(100 + Math.random() * 900);
    return `${digits()}-${digits()}-${digits()}`;
}

// Enable JSON parsing for API routes
router.use(express.json({ limit: '5mb' }));
router.use(express.urlencoded({ limit: '5mb', extended: true }));

//#region Emails

router.post('/email/send-email', async (req, res) => {
    const { to, subject, text, html } = req.body;

    if (!to || !subject || (!text && !html)) {
        logger.warn('Email send attempt waith missing fields');
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
    } catch ( error) {
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
        return res.status(400).json({ error: "Missing required fields!" });
    }

    try {
        const user = await db.checkUserCredentials(email, password);
        if (user) {
            if (user.two_factor_enabled) {
                const code = generate2FACode();
                req.session.pending2FA = {
                    userId: user.id,
                    email: user.email,
                    role: user.role,
                    code,
                    expires: Date.now() + 5 * 60 * 1000
                };

                await transporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to: user.email,
                    subject: "Your 2FA Code",
                    text: `Your 2FA code: ${code}`,
                    html: `<p>Your 2FA code: <b>${code}</b></p>`
                });

                logger.info(`2FA code sent to ${user.email}`);
                return res.json({ twoFA: true, message: "Two-factor authentication required." });
            } else {
                req.session.user = {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    firstName: user.firstName,
                    lastName: user.lastName
                };
                logger.info(`User ${email} logged in successfully`);
                res.json({ success: true, message: "Login successful." });
            }
        } else {
            logger.warn(`Login failed for user ${email}`);
            res.status(401).json({ error: "Invalid email or password." });
        }
    } catch (error) {
        logger.error('Error during login: ' + error.stack);
        res.status(500).json({ error: "Failed to process login." });
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

module.exports = router;