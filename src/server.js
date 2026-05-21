const cors = require("cors");
const http = require("http");
const express = require("express");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://db:27017/quickpoll";

// 1. Express app + global middleware
app.use(cors());
app.use(express.json());

// 2. HTTP server wrapping Express
const server = http.createServer(app);

// 3. Socket.io on the HTTP server
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

// 4. Bind io on Express before any route modules load
app.set("io", io);

// 5. MongoDB
mongoose
    .connect(MONGO_URI)
    .then(() => console.log("🍃 MongoDB Connected Successfully!"))
    .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// 6. API routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/polls", require("./routes/polls"));

// 7. Health check
app.get("/health", (req, res) => {
    res.json({ status: "UP", database: "CONNECTED", sockets: "READY" });
});

// 8. Socket.io connection handlers
io.on("connection", (socket) => {
    console.log(`🔌 New client connected. Socket ID: ${socket.id}`);

    socket.on("joinPollRoom", (data) => {
        const pollId = typeof data === "string" ? data : data?.pollId;
        if (pollId) {
            const room = String(pollId);
            socket.join(room);
            console.log(`✅ Socket ${socket.id} joined room: ${room}`);
        }
    });

    socket.on("disconnect", (reason) => {
        console.log(`❌ Socket ${socket.id} disconnected. Reason: ${reason}`);
    });
});

// 9. Listen on HTTP server (not app.listen)
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
