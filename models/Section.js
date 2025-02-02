const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    text: {
        type: String,
        default: ''
    },
    target: {
        type: Number,
        default: 100
    },
    color: {
        type: String,
        default: '#22c55e' // Varsayılan yeşil renk
    },
    count: {
        type: Number,
        default: 0
    },
    personalCounts: {
        type: Map,
        of: Number,
        default: new Map()
    },
    order: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: false
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

module.exports = mongoose.model('Section', sectionSchema); 