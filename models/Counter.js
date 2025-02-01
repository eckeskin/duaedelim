const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
    totalCount: {
        type: Number,
        default: 0
    },
    target: {
        type: Number,
        default: 100
    },
    personalCounts: {
        type: Map,
        of: Number,
        default: new Map()
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

module.exports = mongoose.model('Counter', counterSchema); 