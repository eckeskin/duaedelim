const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");
const config = require("./src/config/config");
const socketHandler = require("./src/socket/socketHandlers");
const mongoose = require('mongoose');

// Model'leri import et
const Counter = require('./models/Counter');
const Section = require('./models/Section');

// MongoDB bağlantısı
mongoose.connect('mongodb://localhost:27017/dhikr_counter', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('MongoDB bağlantısı başarılı');
}).catch((err) => {
    console.error('MongoDB bağlantı hatası:', err);
});

class App {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = new Server(this.server, {
            cors: config.CORS_OPTIONS
        });

        this.setupMiddleware();
        this.setupRoutes();
        this.initialize();
    }

    async initialize() {
        await this.initializeCounter();
        this.setupSocketIO();
    }

    async initializeCounter() {
        try {
            currentCounter = await Counter.findOne();
            if (!currentCounter) {
                currentCounter = await Counter.create({
                    totalCount: 0,
                    target: 100,
                    personalCounts: new Map()
                });
            }
            console.log('Counter başarıyla başlatıldı:', currentCounter.totalCount);
        } catch (err) {
            console.error('Counter başlatma hatası:', err);
        }
    }

    setupMiddleware() {
        this.app.use(express.static(path.join(__dirname, "public")));
        this.app.use(cors());
        this.app.use(express.json());
    }

    setupRoutes() {
        this.app.get('/api/sections', async (req, res) => {
            try {
                const sections = await Section.find().sort('order');
                res.json(sections);
            } catch (err) {
                res.status(500).json({ error: 'Bölümler alınamadı' });
            }
        });

        this.app.post('/api/sections', async (req, res) => {
            try {
                const section = new Section({
                    title: req.body.title,
                    text: req.body.text || '',
                    target: req.body.target || 100,
                    color: req.body.color || '#22c55e',
                    count: 0
                });
                
                await section.save();
                res.json(section);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        this.app.delete('/api/sections/:id', async (req, res) => {
            try {
                await Section.findByIdAndDelete(req.params.id);
                res.status(200).json({ message: 'Bölüm silindi' });
            } catch (err) {
                res.status(400).json({ error: 'Bölüm silinemedi' });
            }
        });

        this.app.put('/api/sections/:id', async (req, res) => {
            try {
                console.log('Updating section with data:', req.body); // Debug için
                const section = await Section.findByIdAndUpdate(
                    req.params.id,
                    { 
                        title: req.body.title, 
                        text: req.body.text,
                        target: parseInt(req.body.target) || 100,
                        color: req.body.color || '#22c55e',
                        updatedAt: Date.now() 
                    },
                    { new: true }
                );
                console.log('Updated section:', section); // Debug için
                res.json(section);
            } catch (err) {
                console.error('Section update error:', err); // Debug için
                res.status(400).json({ error: 'Bölüm güncellenemedi' });
            }
        });
    }

    setupSocketIO() {
        this.io.on("connection", async (socket) => {
            console.log('Yeni kullanıcı bağlandı');
            let activeSection = null;

            socket.on('registerUser', async (userId) => {
                onlineUsers.add(userId);
                this.io.emit('onlineCount', onlineUsers.size);
                
                // Kullanıcıya mevcut sayaç durumunu gönder
                if (activeSection) {
                    socket.emit('updateCount', activeSection.count);
                    socket.emit('personalCount', activeSection.personalCounts.get(userId) || 0);
                    socket.emit('config', { TARGET_COUNT: activeSection.target });
                }
            });

            socket.on('setActiveSection', async (sectionId) => {
                try {
                    activeSection = await Section.findById(sectionId);
                    if (activeSection) {
                        socket.emit('updateCount', activeSection.count);
                        socket.emit('personalCount', activeSection.personalCounts.get(socket.userId) || 0);
                        socket.emit('config', { TARGET_COUNT: activeSection.target });
                    }
                } catch (err) {
                    console.error('Aktif bölüm değiştirme hatası:', err);
                }
            });

            socket.on('increment', async (data) => {
                try {
                    const { userId, sectionId } = data;
                    const section = await Section.findById(sectionId);
                    if (!section) return;

                    // Toplam sayacı artır
                    section.count += 1;
                    
                    // Kişisel sayacı artır
                    let personalCount = section.personalCounts.get(userId) || 0;
                    section.personalCounts.set(userId, personalCount + 1);
                    
                    // Veritabanını güncelle
                    await section.save();
                    
                    // Tüm kullanıcılara güncel sayıları gönder
                    this.io.emit('updateCount', section.count);
                    socket.emit('personalCount', section.personalCounts.get(userId));
                } catch (err) {
                    console.error('Sayaç güncelleme hatası:', err);
                }
            });

            socket.on('resetCount', async (sectionId) => {
                try {
                    const section = await Section.findById(sectionId);
                    if (!section) return;

                    section.count = 0;
                    section.personalCounts.clear();
                    await section.save();
                    
                    this.io.emit('updateCount', 0);
                    this.io.emit('personalCount', 0);
                    this.io.emit('resetState');
                } catch (err) {
                    console.error('Sayaç sıfırlama hatası:', err);
                }
            });

            socket.on('disconnect', () => {
                onlineUsers.delete(socket.userId);
                this.io.emit('onlineCount', onlineUsers.size);
            });

            socket.on('requestUpdate', () => {
                socket.emit('updateCount', currentCounter.totalCount);
                socket.emit('personalCount', currentCounter.personalCounts.get(socket.userId) || 0);
                socket.emit('config', { TARGET_COUNT: currentCounter.target });
                socket.emit('onlineCount', onlineUsers.size);
            });
        });
    }

    start() {
        this.server.listen(config.PORT, () => {
            console.log(`🚀 Sunucu ${config.PORT} portunda çalışıyor...`);
        });
    }
}

// Global değişkenler
let onlineUsers = new Set();
let currentCounter = null;

const app = new App();
app.start(); 