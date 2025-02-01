const mongoose = require('mongoose');

const dhikrSchema = new mongoose.Schema({
    arabicText: {
        type: String,
        required: true
    },
    transliteration: {
        type: String,
        required: true
    },
    meaning: {
        type: String
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Dhikr', dhikrSchema);