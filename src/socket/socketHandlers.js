const config = require('../config/config');

class SocketHandler {
    constructor() {
        this.count = 0;
        this.users = new Map();        // Kullanıcı bilgilerini Map olarak tutuyoruz
        this.userClicks = new Map();   // Tıklama sayılarını da Map olarak tutuyoruz
        this.disconnectTimers = new Map(); // Bağlantı kopması durumunda zamanlayıcıları tutuyoruz
    }

    // Aktif kullanıcı sayısını hesapla (her kullanıcıyı bir kez say)
    getOnlineUserCount() {
        return this.users.size;
    }

    // Kullanıcının tüm socket bağlantılarını getir
    getUserSockets(userId) {
        return this.users.get(userId) || new Set();
    }

    // Kullanıcının herhangi bir socket bağlantısı var mı?
    isUserConnected(userId) {
        const sockets = this.getUserSockets(userId);
        return sockets.size > 0;
    }

    handleConnection(io, socket) {
        console.log(`🔗 Bir kullanıcı bağlandı: ${socket.id}`);

        // Config bilgisini gönder
        socket.emit("config", {
            TARGET_COUNT: config.TARGET_COUNT
        });

        socket.emit("updateCount", this.count);
        this.setupSocketEvents(io, socket);
    }

    setupSocketEvents(io, socket) {
        socket.on("registerUser", (userId) => this.handleRegisterUser(io, socket, userId));
        socket.on("increment", (userId) => this.handleIncrement(io, socket, userId));
        socket.on("resetCount", () => this.handleResetCount(io));
        socket.on("disconnect", () => this.handleDisconnect(io, socket));
        
        // Güncel durum isteğini karşıla
        socket.on("requestUpdate", () => {
            console.log(`📲 ${socket.userId} için güncel durum gönderiliyor`);
            
            // Ana sayacı gönder
            socket.emit("updateCount", this.count);
            
            // Kişisel sayacı gönder
            if (socket.userId) {
                const personalCount = this.userClicks.get(socket.userId) || 0;
                socket.emit("personalCount", personalCount);
            }
            
            // Online kullanıcı sayısını gönder
            socket.emit("onlineCount", this.getOnlineUserCount());
        });
    }

    handleRegisterUser(io, socket, userId) {
        // Eğer bu kullanıcı için bekleyen bir disconnect timer varsa iptal et
        if (this.disconnectTimers.has(userId)) {
            clearTimeout(this.disconnectTimers.get(userId));
            this.disconnectTimers.delete(userId);
            console.log(`⏱️ ${userId} için disconnect timer iptal edildi`);
        }
        
        // Kullanıcıyı kaydet ve kişisel sayacı sıfırla
        if (!this.users.has(userId)) {
            this.users.set(userId, new Set());
            console.log(`🆕 Yeni kullanıcı kaydı alındı: ${userId}`);
        } else {
            console.log(`🔄 Mevcut kullanıcı yeni sekmede: ${userId}`);
        }
        
        // Her yeni bağlantıda kişisel sayacı sıfırla
        this.userClicks.set(userId, 0);
        
        this.users.get(userId).add(socket.id);
        socket.userId = userId; // Socket nesnesine userId'yi ekle

        const onlineCount = this.getOnlineUserCount();
        console.log(`📊 Güncellenmiş kullanıcı sayısı: ${onlineCount}`);
        io.emit("onlineCount", onlineCount);
        
        // Kişisel sayacı sıfır olarak gönder
        socket.emit("personalCount", 0);
    }

    handleIncrement(io, socket, userId) {
        this.count++;
        this.userClicks.set(userId, (this.userClicks.get(userId) || 0) + 1);
        const personalCount = this.userClicks.get(userId);

        io.emit("updateCount", this.count);
        
        // Kullanıcının tüm aktif sekmelerine kişisel sayacı gönder
        const userSockets = this.getUserSockets(userId);
        for (const socketId of userSockets) {
            io.to(socketId).emit("personalCount", personalCount);
        }
    }

    handleResetCount(io) {
        // Ana sayacı sıfırla
        this.count = 0;
        
        // Tüm kullanıcıların kişisel sayaçlarını sıfırla
        for (const [userId, sockets] of this.users) {
            this.userClicks.set(userId, 0);
            // Her kullanıcının tüm aktif sekmelerine sıfır değerini gönder
            for (const socketId of sockets) {
                io.to(socketId).emit("personalCount", 0);
            }
        }

        // Diğer güncellemeleri gönder
        io.emit("updateCount", this.count);
        io.emit("closeModal");
        io.emit("resetState");
    }

    handleDisconnect(io, socket) {
        const userId = socket.userId;
        if (!userId) return;

        console.log(`❌ Socket bağlantısı koptu: ${socket.id} (Kullanıcı: ${userId})`);
        
        // Önce socket'i kullanıcının socket listesinden çıkar
        const userSockets = this.getUserSockets(userId);
        userSockets.delete(socket.id);

        // Eğer kullanıcının başka aktif soketi yoksa
        if (userSockets.size === 0) {
            console.log(`⏱️ ${userId} için bağlantı kesme işlemi başlatıldı`);
            
            // Eğer önceden bir timer varsa onu temizle
            if (this.disconnectTimers.has(userId)) {
                clearTimeout(this.disconnectTimers.get(userId));
            }
            
            const timer = setTimeout(() => {
                // Timer dolduğunda tekrar kontrol et
                const currentSockets = this.getUserSockets(userId);
                if (!currentSockets || currentSockets.size === 0) {
                    console.log(`⌛ ${userId} için süre doldu, kullanıcı siliniyor`);
                    
                    // Kullanıcıyı tamamen temizle
                    this.users.delete(userId);
                    this.userClicks.delete(userId);
                    this.disconnectTimers.delete(userId);
                    
                    // Online sayısını güncelle ve yayınla
                    const onlineCount = this.getOnlineUserCount();
                    console.log(`📉 Güncellenmiş online kullanıcı sayısı: ${onlineCount}`);
                    io.emit("onlineCount", onlineCount);
                } else {
                    console.log(`🔄 ${userId} hala bağlı socket'lere sahip, silme işlemi iptal edildi`);
                }
            }, 5000); // 5 saniyeye düşürdük

            this.disconnectTimers.set(userId, timer);
        } else {
            console.log(`ℹ️ ${userId} için hala ${userSockets.size} aktif bağlantı var`);
        }

        // Her disconnect'te online sayısını güncelle
        const onlineCount = this.getOnlineUserCount();
        console.log(`📊 Anlık online kullanıcı sayısı: ${onlineCount}`);
        io.emit("onlineCount", onlineCount);
    }
}

module.exports = new SocketHandler(); 