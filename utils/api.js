const express = require('express');
const router = express.Router();
const { htmlToText } = require('html-to-text');
const bcrypt = require('bcrypt');

const logger = require('./logger');
const db = require('./db');
const transporter = require('./mailer');

function generate2FACode() {
    const digits = () => Math.floor(100 + Math.random() * 900);
    return `${digits()}-${digits()}-${digits()}`;
}

// Enable JSON parsing for API routes
router.use(express.json({ limit: '5mb' }));
router.use(express.urlencoded({ limit: '5mb', extended: true }));

module.exports = router;