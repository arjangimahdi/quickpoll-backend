const mongoose = require("mongoose");

const PollSchema = new mongoose.Schema({
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    question: {
        type: String,
        required: [true, "A poll must have a question"],
        trim: true,
    },
    options: [
        {
            text: { type: String, required: true },
            votes: { type: Number, default: 0 },
        },
    ],
    voters: [
        {
            voterId: { type: String },
            optionIndex: { type: Number },
            votedAt: { type: Date, default: Date.now },
        },
    ],
    isActive: {
        type: Boolean,
        default: true,
    },
    expiresAt: {
        type: Date,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model("Poll", PollSchema);
