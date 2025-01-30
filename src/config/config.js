module.exports = {
    PORT: process.env.PORT || 3000,
    CORS_OPTIONS: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    TARGET_COUNT: 25
}; 