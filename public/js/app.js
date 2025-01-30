class CounterApp {
    constructor() {
        this.socket = io();
        this.target = 100; // Bu değer backend'den gelecek
        this.hasReachedTarget = false;
        this.userId = this.initializeUserId();
        
        // Sayfa yüklendiğinde kişisel sayacı sıfırla
        document.getElementById("personal-count").textContent = "0";
        
        // Sayfa görünürlük değişikliğini izle
        this.setupVisibilityListener();
        
        this.initializeSocketEvents();
        this.initializeEventListeners();
        
        // Hedef sayıyı güncelle
        document.getElementById("target-input").textContent = this.target.toLocaleString();
    }

    setupVisibilityListener() {
        // Sayfa görünürlük değişikliğini izle
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                console.log('📱 Sayfa görünür oldu, güncel durumu alınıyor...');
                
                // Socket bağlantısını kontrol et
                if (!this.socket.connected) {
                    console.log('🔄 Socket yeniden bağlanıyor...');
                    this.socket.connect();
                }
                
                // Güncel durumu almak için sunucuya istek gönder
                this.socket.emit('requestUpdate');
            }
        });

        // Ekran açıldığında da kontrol et (iOS için)
        window.addEventListener('focus', () => {
            console.log('📱 Ekran odağı alındı, güncel durumu alınıyor...');
            this.socket.emit('requestUpdate');
        });

        // Ağ bağlantısı değişikliklerini izle
        window.addEventListener('online', () => {
            console.log('🌐 İnternet bağlantısı sağlandı, güncel durumu alınıyor...');
            if (this.socket.connected) {
                this.socket.emit('requestUpdate');
            } else {
                this.socket.connect();
            }
        });
    }

    initializeUserId() {
        let userId = localStorage.getItem("userId");
        if (!userId) {
            userId = Math.random().toString(36).substring(2);
            localStorage.setItem("userId", userId);
        }
        return userId;
    }

    initializeSocketEvents() {
        // Önce kişisel sayacı sıfırla, sonra kullanıcı kaydı yap
        document.getElementById("personal-count").textContent = "0";
        this.socket.emit("registerUser", this.userId);

        // İlk veri geldiğinde elementleri göster
        this.socket.on("config", (config) => {
            this.target = config.TARGET_COUNT;
            document.getElementById("target-input").textContent = this.target.toLocaleString();
        });

        this.socket.on("onlineCount", (count) => {
            console.log("🔹 Online Kullanıcı Sayısı:", count);
            document.getElementById("online-count").textContent = count;
            this.showElements(); // Online sayısı geldiğinde göster
        });

        this.socket.on("updateCount", (count) => {
            this.updateCountDisplay(count);
            this.showElements(); // Sayaç değeri geldiğinde göster
        });

        this.socket.on("closeModal", () => {
            document.getElementById("success-modal").style.display = "none";
        });

        this.socket.on("resetState", () => {
            this.hasReachedTarget = false;
            document.getElementById("count-display").style.pointerEvents = "auto";
        });

        this.socket.on("personalCount", (count) => {
            document.getElementById("personal-count").textContent = count;
            this.showElements(); // Kişisel sayaç geldiğinde göster
        });

        // Yeniden bağlanma durumunda
        this.socket.on("connect", () => {
            document.getElementById("personal-count").textContent = "0";
            this.socket.emit("registerUser", this.userId);
        });
    }

    updateCountDisplay(count) {
        // Ana sayacı güncelle (sayıyı direkt içerik olarak ekle)
        const mainDisplay = document.getElementById("count-display");
        const mainCountSpan = document.createElement("span");
        mainCountSpan.className = "main-count";
        mainCountSpan.textContent = count;
        
        // Eğer zaten bir main-count span varsa, onu güncelle
        const existingMainCount = mainDisplay.querySelector(".main-count");
        if (existingMainCount) {
            existingMainCount.textContent = count;
        } else {
            // Yoksa yeni span'i ekle
            mainDisplay.insertBefore(mainCountSpan, mainDisplay.firstChild);
        }

        // Progress bar ve yüzdeyi güncelle
        const progress = (count / this.target) * 100;
        document.getElementById("progress-bar").style.width = `${progress}%`;
        document.getElementById("progress-text").textContent = `${Math.round(progress)}%`;

        // Hedefe ulaşıldığında
        if (count >= this.target && !this.hasReachedTarget) {
            this.hasReachedTarget = true;
            
            // Kişisel sayacı hemen gizle ve pointer-events'i kapat
            const personalCount = document.getElementById("personal-count");
            personalCount.style.opacity = "0";
            personalCount.style.pointerEvents = "none";
            
            // Başarı mesajını göster
            this.showSuccessMessage();
            
            // 800ms sonra sayacı otomatik sıfırla
            setTimeout(() => {
                this.resetCounter();
            }, 800);
        }
    }

    showSuccessMessage() {
        const message = document.getElementById("success-message");
        const targetText = document.getElementById("target-input").parentElement;
        
        // Hedef yazısını gizle
        targetText.style.opacity = "0";
        
        // Başarı mesajını göster
        message.classList.add("show");
        
        // 800ms sonra mesajı gizle ve hedef yazısını göster
        setTimeout(() => {
            message.classList.remove("show");
            targetText.style.opacity = "1";
            
            // Kişisel sayacı tekrar göster
            document.getElementById("personal-count").style.opacity = "1";
        }, 800);
    }

    initializeEventListeners() {
        document.getElementById("count-display").addEventListener("click", () => {
            if (!this.hasReachedTarget) {
                this.socket.emit("increment", this.userId);
            }
        });

        document.getElementById("close-modal").addEventListener("click", () => this.resetCounter());
        
        this.initializeUIEventListeners();
    }

    initializeUIEventListeners() {
        document.getElementById("close-modal").addEventListener("mousedown", function(event) {
            event.preventDefault();
            this.blur();
        });

        document.getElementById("success-modal").addEventListener("mousedown", function(event) {
            if (event.target === this) {
                event.preventDefault();
                document.activeElement.blur();
                document.getElementById("close-modal").blur();
            }
        });

        document.getElementById("close-modal").addEventListener("focus", function() {
            this.blur();
        });

        document.addEventListener("dblclick", function(event) {
            event.preventDefault();
        });

        document.addEventListener("gesturestart", function(event) {
            event.preventDefault();
        });
    }

    resetCounter() {
        this.hasReachedTarget = false;
        const personalCount = document.getElementById("personal-count");
        personalCount.style.opacity = "1";
        personalCount.style.pointerEvents = "auto";
        document.getElementById("count-display").style.pointerEvents = "auto";
        this.socket.emit("resetCount");
    }

    // Elementleri görünür yap
    showElements() {
        // Hedefe ulaşıldıysa kişisel sayacı gösterme
        if (this.hasReachedTarget) {
            const elements = [
                document.getElementById("count-display"),
                document.getElementById("progress-bar"),
                document.getElementById("progress-text"),
                document.getElementById("online-count")
            ];

            requestAnimationFrame(() => {
                elements.forEach(element => {
                    element.style.opacity = "1";
                });
            });
        } else {
            const elements = [
                document.getElementById("count-display"),
                document.getElementById("personal-count"),
                document.getElementById("progress-bar"),
                document.getElementById("progress-text"),
                document.getElementById("online-count")
            ];

            requestAnimationFrame(() => {
                elements.forEach(element => {
                    element.style.opacity = "1";
                });
            });
        }
    }
}

// Uygulama başlatma
document.addEventListener("DOMContentLoaded", () => {
    new CounterApp();
}); 