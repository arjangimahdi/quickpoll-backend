const express = require("express");
const router = express.Router();

const protect = require("./authMiddleware");

router.post("/", protect, async (req, res) => {
    try {
        const { question, options, expiresAt } = req.body;

        if (!options || options.length < 2) {
            return res.status(400).json({ message: "A poll must have at least 2 options" });
        }

        const formattedOptions = options.map((optionText) => ({
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

module.exports = router;
