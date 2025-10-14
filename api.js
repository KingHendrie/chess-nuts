const express = require('express');
const router = express.Router();
const transporter = require('./utils/mailer');
const logger = require('./utils/logger');
const { htmlToText } = require('html-to-text');
const db = require('./utils/db');
const bcrypt = require('bcrypt');

function generate2FACode() {
    const digits = () => Math.floor(100 + Math.random() * 900);
    return `${digits()}-${digits()}-${digits()}`;
}

// Enable JSON parsing for API routes
router.use(express.json({ limit: '5mb' }));
router.use(express.urlencoded({ limit: '5mb', extended: true }));

// Emails
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

//#endregion User Registration and Authentication