class CounterApp {
    constructor() {
        this.socket = io();
        this.target = 100;
        this.hasReachedTarget = false;
        this.userId = this.initializeUserId();
        this.activeSection = null;
        
        // CounterApp instance'ına erişim için referans ekle
        document.getElementById("count-display").__counterApp = this;
        
        // Sayfa yüklendiğinde kişisel sayacı sıfırla
        document.getElementById("personal-count").textContent = "0";
        
        // Sayfa görünürlük değişikliğini izle
        this.setupVisibilityListener();

        this.initializeSocketEvents();
        this.initializeEventListeners();
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
            
            // Renkleri güncelle
            if (config.color) {
                const countDisplay = document.getElementById('count-display');
                const progressBar = document.getElementById('progress-bar');
                const personalCount = document.getElementById('personal-count');
                
                countDisplay.style.color = config.color;
                progressBar.style.backgroundColor = config.color;
                personalCount.style.backgroundColor = config.color;
                countDisplay.style.background = `${config.color}1a`;
            }
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
        // Ana sayacı güncelle
        const mainDisplay = document.getElementById("count-display");
        const mainCountSpan = document.createElement("span");
        mainCountSpan.className = "main-count";
        mainCountSpan.textContent = count;
        
        const existingMainCount = mainDisplay.querySelector(".main-count");
        if (existingMainCount) {
            existingMainCount.textContent = count;
        } else {
            mainDisplay.insertBefore(mainCountSpan, mainDisplay.firstChild);
        }

        // Progress bar ve yüzdeyi güncelle
        const progress = (count / this.target) * 100;
        document.getElementById("progress-bar").style.width = `${progress}%`;
        document.getElementById("progress-text").textContent = `${Math.round(progress)}%`;

        // Hedefe ulaşıldığında
        if (count >= this.target && !this.hasReachedTarget) {
            this.hasReachedTarget = true;
            
            // Kişisel sayacı gizle
            document.getElementById("personal-count").style.opacity = "0";
            
            // Ana sayacı devre dışı bırak
            document.getElementById("count-display").style.pointerEvents = "none";
            
            // Success modal'ı göster
            document.getElementById("success-modal").style.display = "flex";
        }
    }

    initializeEventListeners() {
        document.getElementById("count-display").addEventListener("click", (e) => {
            // Eğer inspect modunda ise (F12 veya sağ tık + incele) tıklamayı engelle
            if (e.isTrusted === false) return;

            if (!this.hasReachedTarget && this.activeSection) {
                this.socket.emit("increment", {
                    userId: this.userId,
                    sectionId: this.activeSection
                });
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
        if (!this.activeSection) return;
        
        this.hasReachedTarget = false;
        document.getElementById("personal-count").style.opacity = "1";
        document.getElementById("count-display").style.pointerEvents = "auto";
        document.getElementById("success-modal").style.display = "none";
        this.socket.emit("resetCount", this.activeSection);
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

    // Mouse ile kaydırma için değişkenler
    let isScrolling = false;
    let startX;
    let scrollLeft;

    // Mouse ile kaydırma olayları
    sectionsWrapper.addEventListener('mousedown', (e) => {
        isScrolling = true;
        startX = e.pageX - sectionsWrapper.offsetLeft;
        scrollLeft = sectionsWrapper.scrollLeft;
        sectionsWrapper.style.cursor = 'grabbing';
    });

    sectionsWrapper.addEventListener('mousemove', (e) => {
        if (!isScrolling) return;
        e.preventDefault();
        const x = e.pageX - sectionsWrapper.offsetLeft;
        const walk = (x - startX) * 1.5;
        sectionsWrapper.scrollLeft = scrollLeft - walk;
    });

    sectionsWrapper.addEventListener('mouseup', () => {
        isScrolling = false;
        sectionsWrapper.style.cursor = 'grab';
    });

    sectionsWrapper.addEventListener('mouseleave', () => {
        isScrolling = false;
        sectionsWrapper.style.cursor = 'grab';
    });

    // Başlangıçta cursor'ı grab yap
    sectionsWrapper.style.cursor = 'grab';

    // Modal HTML'ini oluştur
    const modalHTML = `
        <div class="edit-modal-backdrop">
            <div class="edit-modal" onclick="event.stopPropagation()">
                <div class="edit-modal-header">
                    <h3 class="edit-modal-title">Bölüm İçeriği</h3>
                </div>
                <input type="text" class="edit-modal-input" placeholder="Bölüm başlığı...">
                <textarea class="edit-modal-textarea" placeholder="Zikir metni..."></textarea>
                <div class="edit-modal-target">
                    <label for="target-count">Hedef Sayı:</label>
                    <input type="number" id="target-count" class="edit-modal-target-input" min="1" placeholder="100">
                </div>
                <div class="edit-modal-colors">
                    <label>Sayaç Rengi:</label>
                    <div class="color-options">
                        <button type="button" class="color-option" data-color="#22c55e" style="background-color: #22c55e"></button>
                        <button type="button" class="color-option" data-color="#3b82f6" style="background-color: #3b82f6"></button>
                        <button type="button" class="color-option" data-color="#ef4444" style="background-color: #ef4444"></button>
                        <button type="button" class="color-option" data-color="#f59e0b" style="background-color: #f59e0b"></button>
                        <button type="button" class="color-option" data-color="#8b5cf6" style="background-color: #8b5cf6"></button>
                        <button type="button" class="color-option" data-color="#ec4899" style="background-color: #ec4899"></button>
                        <button type="button" class="color-option" data-color="#06b6d4" style="background-color: #06b6d4"></button>
                        <button type="button" class="color-option" data-color="#64748b" style="background-color: #64748b"></button>
                    </div>
                </div>
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
    const modalTextarea = document.querySelector('.edit-modal-textarea');
    const modalTargetInput = document.querySelector('.edit-modal-target-input');
    const colorOptions = document.querySelectorAll('.color-option');
    const saveButton = document.querySelector('.edit-modal-save');
    const cancelButton = document.querySelector('.edit-modal-cancel');
    let activeSection = null;
    let selectedColor = '#22c55e'; // Varsayılan renk

    // Renk seçimi için event listener'lar
    colorOptions.forEach(option => {
        option.addEventListener('click', () => {
            // Önceki seçili rengi kaldır
            document.querySelector('.color-option.selected')?.classList.remove('selected');
            // Yeni rengi seç
            option.classList.add('selected');
            selectedColor = option.dataset.color;
        });
    });

    // Modal'ı aç
    function openModal(section) {
        activeSection = section;
        modalInput.value = section.querySelector('span').textContent;
        modalTextarea.value = section.dataset.text || '';
        modalTargetInput.value = section.dataset.target || '100';
        
        // Mevcut rengi seç
        const currentColor = section.dataset.color || '#22c55e';
        document.querySelector(`.color-option[data-color="${currentColor}"]`)?.classList.add('selected');
        selectedColor = currentColor;
        
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
            modalTextarea.value = '';
            modalTargetInput.value = '100';
            document.querySelector('.color-option.selected')?.classList.remove('selected');
            selectedColor = '#22c55e';
        }, 200);
    }

    // Bölüm elementi oluşturma fonksiyonu
    function createSectionElement(section) {
        const sectionItem = document.createElement('div');
        sectionItem.className = 'section-item';
        sectionItem.dataset.id = section._id;
        sectionItem.dataset.text = section.text || '';
        sectionItem.dataset.target = section.target || 100;
        sectionItem.dataset.color = section.color || '#22c55e';
        
        const sectionText = document.createElement('span');
        sectionText.textContent = section.title;

        // Renk göstergesi ekle
        const colorIndicator = document.createElement('div');
        colorIndicator.className = 'color-indicator';
        colorIndicator.style.backgroundColor = section.color || '#22c55e';

        // Basılı tutma ile silme
        let pressTimer;

        function startPress() {
            pressTimer = setTimeout(() => {
                // Bölümü sil
                fetch(`/api/sections/${section._id}`, {
                    method: 'DELETE'
                }).then(() => {
                    sectionItem.style.opacity = '0';
                    sectionItem.style.transform = 'scale(0.9)';
                    setTimeout(() => sectionItem.remove(), 200);
                }).catch(err => {
                    console.error('Bölüm silinirken hata:', err);
                });
            }, 500);
        }

        function cancelPress() {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        }

        sectionItem.addEventListener('mousedown', startPress);
        sectionItem.addEventListener('touchstart', startPress);
        sectionItem.addEventListener('mouseup', cancelPress);
        sectionItem.addEventListener('mouseleave', cancelPress);
        sectionItem.addEventListener('touchend', cancelPress);
        sectionItem.addEventListener('touchcancel', cancelPress);

        // Çift tıklama ile modalı aç
        sectionItem.addEventListener('dblclick', () => {
            openModal(sectionItem);
        });

        // Bölüme tıklandığında shahada metnini, hedefi ve rengi güncelle
        sectionItem.addEventListener('click', async (e) => {
            // Eğer inspect modunda ise (F12 veya sağ tık + incele) tıklamayı engelle
            if (e.isTrusted === false) return;

            const shahada = document.querySelector('.shahada');
            if (shahada) {
                shahada.textContent = sectionItem.dataset.text || '';
            }
            
            const targetValue = parseInt(sectionItem.dataset.target) || 100;
            const color = sectionItem.dataset.color || '#22c55e';
            
            // Hedefi güncelle
            document.getElementById('target-input').textContent = targetValue.toLocaleString();
            
            // CounterApp instance'ını güncelle
            const counterApp = document.querySelector('#count-display').__counterApp;
            if (counterApp) {
                counterApp.target = targetValue;
                counterApp.activeSection = sectionItem.dataset.id;
                
                // Renkleri güncelle
                const countDisplay = document.getElementById('count-display');
                const progressBar = document.getElementById('progress-bar');
                const personalCount = document.getElementById('personal-count');
                
                countDisplay.style.color = color;
                progressBar.style.backgroundColor = color;
                personalCount.style.backgroundColor = color;
                countDisplay.style.background = `${color}1a`; // Rengin açık tonu için
                
                // Socket'e aktif bölümü bildir
                counterApp.socket.emit('setActiveSection', sectionItem.dataset.id);
                
                // Aktif bölümü API'ye kaydet
                try {
                    await fetch(`/api/sections/${sectionItem.dataset.id}/activate`, {
                        method: 'PUT'
                    });
                } catch (err) {
                    console.error('Aktif bölüm güncellenirken hata:', err);
                }
            }
            
            // Aktif bölümü güncelle
            document.querySelectorAll('.section-item').forEach(item => {
                item.classList.remove('active');
                item.style.borderColor = 'transparent';
            });
            sectionItem.classList.add('active');
            sectionItem.style.borderColor = color;
        });
        
        // Elementleri doğru sırayla ekle
        sectionItem.appendChild(colorIndicator);
        sectionItem.appendChild(sectionText);
        return sectionItem;
    }

    // Kaydet butonu
    saveButton.addEventListener('click', async () => {
        if (activeSection && modalInput.value.trim()) {
            try {
                const targetValue = parseInt(modalTargetInput.value) || 100;
                const response = await fetch(`/api/sections/${activeSection.dataset.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        title: modalInput.value,
                        text: modalTextarea.value,
                        target: targetValue,
                        color: selectedColor
                    })
                });
                
                if (!response.ok) throw new Error('Bölüm güncellenemedi');
                
                const updatedSection = await response.json();
                activeSection.querySelector('span').textContent = updatedSection.title;
                activeSection.dataset.text = updatedSection.text;
                activeSection.dataset.target = updatedSection.target;
                activeSection.dataset.color = updatedSection.color;
                activeSection.querySelector('.color-indicator').style.backgroundColor = updatedSection.color;
                
                // Border rengini hemen güncelle
                if (activeSection.classList.contains('active')) {
                    activeSection.style.borderColor = updatedSection.color;
                    
                    const shahada = document.querySelector('.shahada');
                    if (shahada) {
                        shahada.textContent = updatedSection.text;
                    }
                    
                    // Hedefi ve renkleri güncelle
                    document.getElementById('target-input').textContent = updatedSection.target.toLocaleString();
                    const countDisplay = document.getElementById('count-display');
                    const progressBar = document.getElementById('progress-bar');
                    const personalCount = document.getElementById('personal-count');
                    
                    countDisplay.style.color = updatedSection.color;
                    progressBar.style.backgroundColor = updatedSection.color;
                    personalCount.style.backgroundColor = updatedSection.color;
                    countDisplay.style.background = `${updatedSection.color}1a`; // Rengin açık tonu için
                    
                    // CounterApp instance'ını güncelle
                    const counterApp = document.querySelector('#count-display').__counterApp;
                    if (counterApp) {
                        counterApp.target = updatedSection.target;
                        counterApp.activeSection = updatedSection._id;
                        counterApp.socket.emit('setActiveSection', updatedSection._id);
                    }
                }
                
                closeModal();
            } catch (err) {
                console.error('Bölüm güncellenirken hata:', err);
            }
        }
    });

    addButton.addEventListener('click', async function() {
        const sectionCount = sectionsWrapper.children.length;
        const title = `Bölüm ${sectionCount + 1}`;
        
        try {
            // Yeni bölümü API'ye gönder
            const response = await fetch('/api/sections', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    title,
                    text: '',
                    target: 100,
                    color: '#22c55e' // Her zaman varsayılan renk ile başla
                })
            });
            
            const section = await response.json();
            if (!response.ok) throw new Error(section.error);
            
            // Bölümü UI'a ekle
            const sectionItem = createSectionElement(section);
            sectionsWrapper.appendChild(sectionItem);
            sectionsWrapper.scrollLeft = sectionsWrapper.scrollWidth;

            // Yeni eklenen bölümü otomatik olarak aktif yap
            sectionItem.click();
        } catch (err) {
            console.error('Bölüm eklenirken hata:', err);
        }
    });

    // Modal event listener'ları
    cancelButton.addEventListener('click', closeModal);

    modalBackdrop.addEventListener('mousedown', (e) => {
        if (e.target === modalBackdrop) {
            closeModal();
        }
    });

    modalInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter' && modalInput.value.trim()) {
            saveButton.click();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalBackdrop.classList.contains('show')) {
            closeModal();
        }
    });

    // Sayfa yüklendiğinde mevcut bölümleri getir
    async function loadSections() {
        try {
            const [sectionsResponse, activeResponse] = await Promise.all([
                fetch('/api/sections'),
                fetch('/api/sections/active')
            ]);
            
            const sections = await sectionsResponse.json();
            const activeSection = await activeResponse.json();
            
            sections.forEach(section => {
                const sectionElement = createSectionElement(section);
                sectionsWrapper.appendChild(sectionElement);
                
                // Eğer bu bölüm aktifse, hedefi ve diğer özellikleri ayarla
                if (activeSection && section._id === activeSection._id) {
                    const targetValue = parseInt(section.target) || 100;
                    const color = section.color || '#22c55e';
                    
                    // Hedefi güncelle
                    document.getElementById('target-input').textContent = targetValue.toLocaleString();
                    
                    // CounterApp instance'ını güncelle
                    const counterApp = document.querySelector('#count-display').__counterApp;
                    if (counterApp) {
                        counterApp.target = targetValue;
                        counterApp.activeSection = section._id;
                        
                        // Renkleri güncelle
                        const countDisplay = document.getElementById('count-display');
                        const progressBar = document.getElementById('progress-bar');
                        const personalCount = document.getElementById('personal-count');
                        
                        countDisplay.style.color = color;
                        progressBar.style.backgroundColor = color;
                        personalCount.style.backgroundColor = color;
                        countDisplay.style.background = `${color}1a`;
                    }
                    
                    // Aktif bölümü işaretle
                    sectionElement.classList.add('active');
                    sectionElement.style.borderColor = color;
                    
                    // Zikir metnini güncelle
                    const shahada = document.querySelector('.shahada');
                    if (shahada) {
                        shahada.textContent = section.text || '';
                    }

                    // Aktif bölümü görünür yap
                    setTimeout(() => {
                        const sectionRect = sectionElement.getBoundingClientRect();
                        const containerRect = sectionsWrapper.getBoundingClientRect();
                        const scrollLeft = sectionRect.left - containerRect.left - 10; // 10px boşluk bırak
                        sectionsWrapper.scrollTo({
                            left: scrollLeft,
                            behavior: 'smooth'
                        });
                    }, 100);
                }
            });
        } catch (err) {
            console.error('Bölümler yüklenirken hata:', err);
        }
    }

    // Bölümleri yükle
    loadSections();
}); 