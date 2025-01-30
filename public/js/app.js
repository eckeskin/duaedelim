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

// Yeni eklenen kodlar
document.addEventListener('DOMContentLoaded', function() {
    const addButton = document.getElementById('add-section');
    const sectionsWrapper = document.getElementById('sections-wrapper');
    let sectionCount = 0;

    // Modal HTML'ini oluştur
    const modalHTML = `
        <div class="edit-modal-backdrop">
            <div class="edit-modal" onclick="event.stopPropagation()">
                <div class="edit-modal-header">
                    <h3 class="edit-modal-title">Bölüm İçeriği</h3>
                </div>
                <input type="text" class="edit-modal-input" placeholder="Metin girin...">
                <div class="edit-modal-actions">
                    <button class="edit-modal-button edit-modal-cancel">İptal</button>
                    <button class="edit-modal-button edit-modal-save">Kaydet</button>
                </div>
            </div>
        </div>
    `;

    // Modal'ı body'e ekle
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Modal elementlerini seç
    const modalBackdrop = document.querySelector('.edit-modal-backdrop');
    const modal = document.querySelector('.edit-modal');
    const modalInput = document.querySelector('.edit-modal-input');
    const saveButton = document.querySelector('.edit-modal-save');
    const cancelButton = document.querySelector('.edit-modal-cancel');
    let activeSection = null;

    // Modal'ı aç
    function openModal(section) {
        activeSection = section;
        const sectionText = section.querySelector('span').textContent;
        modalInput.value = sectionText;
        modalBackdrop.classList.add('show');
        setTimeout(() => modal.classList.add('show'), 10);
        modalInput.focus();
    }

    // Modal'ı kapat
    function closeModal() {
        modal.classList.remove('show');
        setTimeout(() => {
            modalBackdrop.classList.remove('show');
            modalInput.value = '';
        }, 200);
    }

    // Kaydet butonu
    saveButton.addEventListener('click', () => {
        if (activeSection && modalInput.value.trim()) {
            activeSection.querySelector('span').textContent = modalInput.value;
            closeModal();
        }
    });

    // İptal butonu
    cancelButton.addEventListener('click', closeModal);

    // Modal dışına tıklama
    modalBackdrop.addEventListener('mousedown', (e) => {
        if (e.target === modalBackdrop) {
            closeModal();
        }
    });

    // Enter tuşu ile kaydet
    modalInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter' && modalInput.value.trim()) {
            saveButton.click();
        }
    });

    // Escape tuşu ile kapat
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalBackdrop.classList.contains('show')) {
            closeModal();
        }
    });

    addButton.addEventListener('click', function() {
        const sectionItem = document.createElement('div');
        sectionItem.className = 'section-item';
        
        const sectionText = document.createElement('span');
        sectionText.textContent = `Bölüm ${sectionCount + 1}`;
        
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-button';
        deleteButton.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
        
        deleteButton.addEventListener('click', function(e) {
            e.stopPropagation();
            sectionItem.style.opacity = '0';
            sectionItem.style.transform = 'scale(0.9)';
            setTimeout(() => {
                sectionItem.remove();
            }, 200);
        });

        // Sadece uzun basma olayları
        let pressTimer;
        let isDragging = false;
        let isPressed = false;

        sectionItem.addEventListener('mousedown', (e) => {
            isPressed = true;
            pressTimer = setTimeout(() => {
                if (!isDragging && isPressed) {
                    openModal(sectionItem);
                }
            }, 500);
        });

        sectionItem.addEventListener('touchstart', (e) => {
            isPressed = true;
            pressTimer = setTimeout(() => {
                if (!isDragging && isPressed) {
                    openModal(sectionItem);
                }
            }, 500);
        });

        // Sürükleme kontrolü
        sectionItem.addEventListener('mousemove', () => {
            if (isPressed) {
                isDragging = true;
            }
        });

        // Basma iptal
        const cancelPress = () => {
            isPressed = false;
            clearTimeout(pressTimer);
            setTimeout(() => {
                isDragging = false;
            }, 100);
        };

        sectionItem.addEventListener('mouseup', cancelPress);
        sectionItem.addEventListener('mouseleave', cancelPress);
        sectionItem.addEventListener('touchend', cancelPress);
        sectionItem.addEventListener('touchcancel', cancelPress);
        
        sectionItem.appendChild(sectionText);
        sectionItem.appendChild(deleteButton);
        sectionsWrapper.appendChild(sectionItem);
        sectionCount++;
        
        sectionsWrapper.scrollLeft = sectionsWrapper.scrollWidth;
    });
}); 