const cors = require("cors");
const http = require("http");
const express = require("express");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://db:27017/quickpoll";

// MIDDLEWARE
app.use(cors());
app.use(express.json());

// 3. Create an HTTP Server by wrapping our Express 'app'
const server = http.createServer(app);

// 4. Initialize Socket.io on top of our new HTTP server
const io = new Server(server, {
    cors: {
        origin: "*", // Allows any frontend origin to connect for local testing
        methods: ["GET", "POST"],
    },
});

app.set("io", io);

// CONNECT TO MONGO_DB
mongoose
    .connect(MONGO_URI)
    .then(() => console.log("🍃 MongoDB Connected Successfully!"))
    .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// LINK ROUTES
app.use("/api/auth", require("./routes/auth"));
app.use("/api/polls", require("./routes/polls"));

// HEALTH CHECK ROUTE
app.get("/health", (req, res) => {
    res.json({ status: "UP", database: "CONNECTED", sockets: "READY" });
});

// 5. Basic Socket.io Connection Listener (For testing)
io.on("connection", (socket) => {
    console.log(`🔌 A user connected! Socket ID: ${socket.id}`);

    socket.on("disconnect", () => {
        console.log(`❌ User disconnected. Socket ID: ${socket.id}`);
    });
});

// 6. CRUCIAL CHANGE: Change app.listen to server.listen!
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
