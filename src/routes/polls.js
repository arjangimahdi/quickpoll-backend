const express = require("express");
const router = express.Router();

const Poll = require("./../models/Poll");

const protect = require("./authMiddleware");

router.get("/me", protect, async (req, res) => {
    try {
        console.log("💼 Full req.user contents from token:", req.user);
        const targetUserId = req.user.userId || req.user.id;
        console.log("🔍 Extracting targetUserId string:", targetUserId);

        const myPolls = await Poll.find({ creator: targetUserId }).sort({ createdAt: -1 });
        return res.json(myPolls);
    } catch (error) {
        console.error("❌ Dashboard Fetch Error:", error.message);
        res.status(500).send("Server Error");
    }
});

router.post("/", protect, async (req, res) => {
    try {
        const { question, options, expiresAt } = req.body;

        if (!options || options.length < 2) {
            return res.status(400).json({ message: "A poll must have at least 2 options" });
        }

        const formattedOptions = options.map(({ optionText }) => ({
            text: optionText,
            votes: 0,
        }));

        const newPoll = new Poll({
            creator: req.user.userId,
            question,
            options: formattedOptions,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
        });

        await newPoll.save();
        res.status(201).json(newPoll);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error while creating poll" });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const poll = await Poll.findById(req.params.id);

        if (!poll) {
            return res.status(404).json({ message: "Poll not found" });
        }

        res.json(poll);
    } catch (error) {
        console.error(error);

        if (error.kind === "ObjectId") {
            return res.status(404).json({ message: "Poll not found" });
        }
        res.status(500).json({ message: "Server error retrieving poll" });
    }
});

// @route   POST api/polls/:id/vote
// @desc    Cast a live vote on a specific poll
// @access  Public (Anonymous voting protected by IP tracking)
router.post("/:id/vote", async (req, res) => {
    try {
        const { optionIndex } = req.body; // Expects something like { optionIndex: 1 }
        const pollId = req.params.id;

        // 1. Grabs the real user's IP address passed forward by our Nginx proxy!
        const voterIp = req.headers["x-real-ip"] || req.socket.remoteAddress;

        // Fetching poll directly using standard mongoose model resolution
        const currentPoll = await Poll.findById(pollId);
        if (!currentPoll) {
            return res.status(404).json({ message: "Poll not found" });
        }

        // 3. Prevent Double Voting: Check if this IP address has already voted
        if (currentPoll.voters.includes(voterIp)) {
            return res.status(400).json({ message: "You have already voted on this poll!" });
        }

        // 4. Validate option choice
        if (optionIndex === undefined || optionIndex < 0 || optionIndex >= currentPoll.options.length) {
            return res.status(400).json({ message: "Invalid poll option selected" });
        }

        // 5. Update data: Increment the specific option vote count & register the voter's IP
        currentPoll.options[optionIndex].votes += 1;
        currentPoll.voters.push(voterIp);

        // Save the updated document back to MongoDB
        await currentPoll.save();

        const io = req.app.get("io");
        const room = currentPoll._id.toString();

        if (io) {
            io.to(room).emit("pollUpdated", {
                pollId: currentPoll._id,
                options: currentPoll.options,
            });
        }

        // 7. Respond to the client who just voted to confirm success
        res.json({ message: "Vote cast successfully!", options: currentPoll.options });
    } catch (err) {
        console.error("❌ Voting Error:", err.message);
        res.status(500).send("Server Error");
    }
});

module.exports = router;
