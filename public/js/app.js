class CounterApp {
    constructor() {
        this.socket = io();
        this.target = 100;
        this.hasReachedTarget = false;
        this.userId = this.initializeUserId();
        this.activeSection = null;
        this.lastActiveSection = null;
        this.personalCount = 0;
        this.lastCount = 0; // Son sayaç değerini sakla
        
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
                
                // Aktif bölümü ve hedefi koruyarak güncel durumu al
                if (this.activeSection) {
                    this.socket.emit('setActiveSection', this.activeSection);
                }
                this.socket.emit('requestUpdate');
            }
        });

        // Ekran açıldığında da kontrol et (iOS için)
        window.addEventListener('focus', () => {
            console.log('📱 Ekran odağı alındı, güncel durumu alınıyor...');
            // Aktif bölümü ve hedefi koruyarak güncel durumu al
            if (this.activeSection) {
                this.socket.emit('setActiveSection', this.activeSection);
            }
            this.socket.emit('requestUpdate');
        });

        // Ağ bağlantısı değişikliklerini izle
        window.addEventListener('online', () => {
            console.log('🌐 İnternet bağlantısı sağlandı, güncel durumu alınıyor...');
            if (!this.socket.connected) {
                this.socket.connect();
            }
            // Aktif bölümü ve hedefi koruyarak güncel durumu al
            if (this.activeSection) {
                this.socket.emit('setActiveSection', this.activeSection);
            }
            this.socket.emit('requestUpdate');
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
        this.personalCount = 0;
        document.getElementById("personal-count").textContent = "0";
        this.socket.emit("registerUser", this.userId);

        // İlk veri geldiğinde elementleri göster
        this.socket.on("config", (config) => {
            this.target = config.TARGET_COUNT;
            document.getElementById("target-input").textContent = this.target.toLocaleString();
            
            // Son sayaç değeri varsa progress bar'ı güncelle
            if (this.lastCount > 0) {
                const progress = (this.lastCount / this.target) * 100;
                document.getElementById("progress-bar").style.width = `${progress}%`;
                document.getElementById("progress-text").textContent = `${Math.round(progress)}%`;
            }
            
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
            // Sadece aktif bölüm değişmediyse sayacı güncelle
            if (this.lastActiveSection === this.activeSection) {
                this.personalCount = count;
                document.getElementById("personal-count").textContent = count;
            }
            this.showElements();
        });

        // Yeniden bağlanma durumunda
        this.socket.on("connect", () => {
            this.personalCount = 0;
            document.getElementById("personal-count").textContent = "0";
            this.socket.emit("registerUser", this.userId);
        });
    }

    updateCountDisplay(count) {
        // Son sayaç değerini sakla
        this.lastCount = count;
        
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
        const progressBar = document.getElementById("progress-bar");
        const progressText = document.getElementById("progress-text");
        
        // Animasyonlu geçiş için
        progressBar.style.transition = 'width 0.3s ease';
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `${Math.round(progress)}%`;
        progressText.style.opacity = "1";

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
                // Kişisel sayacı güncelle
                this.personalCount++;
                document.getElementById("personal-count").textContent = this.personalCount;
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
        // Kişisel sayacı sıfırla ve görünür yap
        this.personalCount = 0;
        const personalCountElement = document.getElementById("personal-count");
        personalCountElement.textContent = "0";
        personalCountElement.style.opacity = "1";
        
        // Ana sayacı aktif hale getir
        document.getElementById("count-display").style.pointerEvents = "auto";
        document.getElementById("success-modal").style.display = "none";
        
        // Socket'e bildir
        this.socket.emit("resetCount", this.activeSection);
        this.socket.emit("resetPersonalCount");
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

    // Bölüm değiştiğinde kişisel sayacı sıfırla
    resetPersonalCounter() {
        this.personalCount = 0;
        document.getElementById("personal-count").textContent = "0";
        this.socket.emit("resetPersonalCount");
    }

    // Aktif bölümü değiştir
    setActiveSection(sectionId) {
        if (this.activeSection !== sectionId) {
            this.lastActiveSection = this.activeSection;
            this.activeSection = sectionId;
            
            // Kişisel sayacı sıfırla
            this.personalCount = 0;
            document.getElementById("personal-count").textContent = "0";
            this.socket.emit("resetPersonalCount");
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
        // Scroll pozisyonunu kaydet
        localStorage.setItem('sectionsScrollPosition', sectionsWrapper.scrollLeft);
    });

    sectionsWrapper.addEventListener('mouseup', () => {
        isScrolling = false;
        sectionsWrapper.style.cursor = 'grab';
    });

    sectionsWrapper.addEventListener('mouseleave', () => {
        isScrolling = false;
        sectionsWrapper.style.cursor = 'grab';
    });

    // Touch olayları için scroll pozisyonunu kaydet
    sectionsWrapper.addEventListener('touchend', () => {
        localStorage.setItem('sectionsScrollPosition', sectionsWrapper.scrollLeft);
    });

    // Scroll olayında pozisyonu kaydet
    sectionsWrapper.addEventListener('scroll', () => {
        localStorage.setItem('sectionsScrollPosition', sectionsWrapper.scrollLeft);
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

        <div class="delete-modal-backdrop">
            <div class="delete-modal" onclick="event.stopPropagation()">
                <div class="delete-modal-header">
                    <h3 class="delete-modal-title">Bölümü Sil</h3>
                </div>
                <p class="delete-modal-text">Bu bölümü silmek istediğinizden emin misiniz?</p>
                <div class="delete-modal-actions">
                    <button class="delete-modal-button delete-modal-cancel">İptal</button>
                    <button class="delete-modal-button delete-modal-confirm">Sil</button>
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

    // Silme modalı için elementleri seç
    const deleteModalBackdrop = document.querySelector('.delete-modal-backdrop');
    const deleteModal = document.querySelector('.delete-modal');
    const deleteConfirmButton = document.querySelector('.delete-modal-confirm');
    const deleteCancelButton = document.querySelector('.delete-modal-cancel');
    let sectionToDelete = null;

    // Silme modalını aç
    function openDeleteModal(section) {
        sectionToDelete = section;
        deleteModalBackdrop.classList.add('show');
        setTimeout(() => deleteModal.classList.add('show'), 10);
    }

    // Silme modalını kapat
    function closeDeleteModal() {
        deleteModal.classList.remove('show');
        setTimeout(() => {
            deleteModalBackdrop.classList.remove('show');
            sectionToDelete = null;
        }, 200);
    }

    // Silme modalı event listener'ları
    deleteCancelButton.addEventListener('click', closeDeleteModal);
    deleteModalBackdrop.addEventListener('mousedown', (e) => {
        if (e.target === deleteModalBackdrop) {
            closeDeleteModal();
        }
    });

    deleteConfirmButton.addEventListener('click', async () => {
        if (sectionToDelete) {
            try {
                await fetch(`/api/sections/${sectionToDelete.dataset.id}`, {
                    method: 'DELETE'
                });
                sectionToDelete.style.opacity = '0';
                sectionToDelete.style.transform = 'scale(0.9)';
                setTimeout(() => sectionToDelete.remove(), 200);
                closeDeleteModal();
            } catch (err) {
                console.error('Bölüm silinirken hata:', err);
            }
        }
    });

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
                openDeleteModal(sectionItem);
            }, 1000);
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
                
                // Kişisel sayacı sıfırla ve aktif bölümü güncelle
                counterApp.personalCount = 0;
                document.getElementById('personal-count').textContent = '0';
                counterApp.activeSection = sectionItem.dataset.id;
                
                // Renkleri güncelle
                const countDisplay = document.getElementById('count-display');
                const progressBar = document.getElementById('progress-bar');
                const personalCount = document.getElementById('personal-count');
                
                countDisplay.style.color = color;
                progressBar.style.backgroundColor = color;
                personalCount.style.backgroundColor = color;
                countDisplay.style.background = `${color}1a`; // Rengin açık tonu için
                
                // Socket'e aktif bölümü bildir ve kişisel sayacı sıfırla
                counterApp.socket.emit('setActiveSection', sectionItem.dataset.id);
                counterApp.socket.emit('resetPersonalCount');
                
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
                }
            });

            // Kaydedilmiş scroll pozisyonunu geri yükle
            const savedScrollPosition = localStorage.getItem('sectionsScrollPosition');
            if (savedScrollPosition !== null) {
                sectionsWrapper.scrollLeft = parseInt(savedScrollPosition);
            }
        } catch (err) {
            console.error('Bölümler yüklenirken hata:', err);
        }
    }

    // Bölümleri yükle
    loadSections();
}); 