const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("./../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_poll_key_123";
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || "1d";
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function signAccessToken(userId) {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
}

function createRefreshToken() {
    return crypto.randomBytes(40).toString("hex");
}

function hashRefreshToken(plainToken) {
    return crypto.createHash("sha256").update(plainToken).digest("hex");
}

async function saveRefreshToken(user, plainRefreshToken) {
    user.refreshTokenHash = hashRefreshToken(plainRefreshToken);
    user.refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TTL_MS);
    await user.save();
}

async function issueAuthTokens(user) {
    const token = signAccessToken(user._id);
    const refreshToken = createRefreshToken();
    await saveRefreshToken(user, refreshToken);
    return { token, refreshToken };
}

router.post("/register", async (req, res) => {
    try {
        const { username, email, password } = req.body;

        let userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: "User with this email already exists" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            username,
            email,
            password: hashedPassword,
        });
        await newUser.save();

        const { token, refreshToken } = await issueAuthTokens(newUser);

        res.status(201).json({
            token,
            refreshToken,
            user: { id: newUser._id, username: newUser.username, email: newUser.email },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error during registration" });
    }
});

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email }).select("+password");
        if (!user) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const { token, refreshToken } = await issueAuthTokens(user);

        res.json({
            token,
            refreshToken,
            user: { id: user._id, username: user.username, email: user.email },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error during login" });
    }
});

router.post("/refresh", async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(401).json({ message: "Refresh token required" });
        }

        const refreshTokenHash = hashRefreshToken(refreshToken);
        const user = await User.findOne({
            refreshTokenHash,
            refreshTokenExpiresAt: { $gt: new Date() },
        });

        if (!user) {
            return res.status(401).json({ message: "Invalid or expired refresh token" });
        }

        const tokens = await issueAuthTokens(user);

        res.json(tokens);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error during token refresh" });
    }
});

module.exports = router;
