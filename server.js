const express = require("express");
const fs = require("fs");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());

const SECRET = "TRIAL_IPTV_SECRET_2026";
const DB_FILE = "./trialUsers.json";

/* ---------------- LOAD USERS ---------------- */
function getUsers() {
    if (!fs.existsSync(DB_FILE)) return {};
    return JSON.parse(fs.readFileSync(DB_FILE));
}

/* ---------------- SAVE USERS ---------------- */
function saveUsers(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

/* ---------------- CREATE TRIAL USER ---------------- */
app.post("/trial/start", (req, res) => {
    const { deviceId } = req.body;

    if (!deviceId) {
        return res.status(400).json({ error: "Device ID required" });
    }

    let users = getUsers();

    // if already exists
    if (users[deviceId]) {
        return res.json({
            message: "Trial already exists",
            trialStart: users[deviceId].trialStart,
            expiresAt: users[deviceId].expiresAt
        });
    }

    const now = Date.now();
    const expiresAt = now + (3 * 24 * 60 * 60 * 1000); // 3 days

    users[deviceId] = {
        trialStart: now,
        expiresAt
    };

    saveUsers(users);

    const token = jwt.sign({ deviceId }, SECRET, { expiresIn: "3d" });

    res.json({
        message: "Trial activated",
        token,
        trialStart: now,
        expiresAt
    });
});

/* ---------------- MIDDLEWARE (CHECK TRIAL) ---------------- */
function verifyTrial(req, res, next) {
    const auth = req.headers.authorization;

    if (!auth) {
        return res.status(401).json({ error: "No token provided" });
    }

    try {
        const token = auth.split(" ")[1];
        const decoded = jwt.verify(token, SECRET);

        const users = getUsers();
        const user = users[decoded.deviceId];

        if (!user) {
            return res.status(403).json({ error: "No trial found" });
        }

        if (Date.now() > user.expiresAt) {
            return res.status(403).json({ error: "Trial expired" });
        }

        req.user = decoded;
        next();

    } catch (err) {
        return res.status(403).json({ error: "Invalid token" });
    }
}

/* ---------------- PROTECTED ROUTE ---------------- */
app.get("/trial/channels", verifyTrial, (req, res) => {
    res.json({
        status: "active",
        message: "Trial valid",
        channels: [
            {
                name: "Sample News",
                url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
            },
            {
                name: "Sample Sports",
                url: "https://test-streams.mux.dev/test_001/stream.m3u8"
            }
        ]
    });
});

/* ---------------- CHECK STATUS ---------------- */
app.get("/trial/status", verifyTrial, (req, res) => {
    res.json({
        status: "active",
        message: "Trial is still valid"
    });
});

/* ---------------- START SERVER ---------------- */
app.listen(3000, () => {
    console.log("🚀 Trial Backend running on http://localhost:3000");
});
const express = require("express");
const fs = require("fs");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const Stripe = require("stripe");

const app = express();
app.use(cors());
app.use(express.json());

const SECRET = "IPTV_SECRET_2026";

/* =======================
   PAYMENT KEYS
======================= */

// STRIPE
const stripe = Stripe("YOUR_STRIPE_SECRET_KEY");

// PAYSTACK
const PAYSTACK_SECRET = "YOUR_PAYSTACK_SECRET_KEY";

const DB_FILE = "./users.json";
