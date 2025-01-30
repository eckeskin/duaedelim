const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");
const config = require("./src/config/config");
const socketHandler = require("./src/socket/socketHandlers");

class App {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = new Server(this.server, {
            cors: config.CORS_OPTIONS
        });

        this.setupMiddleware();
        this.setupSocketIO();
    }

    setupMiddleware() {
        this.app.use(express.static(path.join(__dirname, "public")));
        this.app.use(cors());
    }

    setupSocketIO() {
        this.io.on("connection", (socket) => {
            socketHandler.handleConnection(this.io, socket);
        });
    }

    start() {
        this.server.listen(config.PORT, () => {
            console.log(`🚀 Sunucu ${config.PORT} portunda çalışıyor...`);
        });
    }
}

const app = new App();
app.start(); 