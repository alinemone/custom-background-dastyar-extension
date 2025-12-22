(function() {
    'use strict';

    const STORAGE_KEY = 'dastyar_custom_background';

    // لود فوری بک‌گراند قبل از هر چیز
    (function instantLoad() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const settings = JSON.parse(saved);
                if (settings.imageUrl) {
                    const body = document.body;
                    body.classList.add('bg-custom-image');
                    body.style.setProperty('--custom-bg-image', `url('${settings.imageUrl}')`);
                    if (settings.overlay) {
                        body.classList.add('bg-overlay');
                    }
                }
            }
        } catch (e) {
            console.error('Failed to load background:', e);
        }
    })();

    class CustomBackgroundManager {
        constructor() {
            this.storageKey = STORAGE_KEY;
            this.init();
        }

        async init() {
            await this.loadSettings();
            this.applyBackground();
            this.addSettingsButton();
        }

        async loadSettings() {
            try {
                const saved = localStorage.getItem(this.storageKey);
                this.settings = saved ? JSON.parse(saved) : this.getDefaultSettings();
            } catch (e) {
                this.settings = this.getDefaultSettings();
            }
        }

        getDefaultSettings() {
            return {
                imageUrl: '',
                overlay: false
            };
        }

        saveSettings() {
            localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
        }

        applyBackground() {
            const body = document.body;

            body.classList.remove('bg-custom-image', 'bg-overlay');
            body.style.removeProperty('--custom-bg-image');

            if (this.settings.imageUrl) {
                body.classList.add('bg-custom-image');
                body.style.setProperty('--custom-bg-image', `url('${this.settings.imageUrl}')`);
            }

            if (this.settings.overlay) {
                body.classList.add('bg-overlay');
            }
        }

        addSettingsButton() {
            const button = document.createElement('button');
            button.id = 'custom-bg-settings-btn';
            button.innerHTML = '🎨';
            button.title = 'تنظیمات بک‌گراند';
            button.style.cssText = 'position:fixed;bottom:20px;left:20px;width:50px;height:50px;border-radius:50%;border:none;background:rgba(255,255,255,.2);backdrop-filter:blur(10px);cursor:pointer;font-size:24px;z-index:10000;transition:all .3s;box-shadow:0 4px 15px rgba(0,0,0,.2)';

            button.addEventListener('mouseenter', () => {
                button.style.transform = 'scale(1.1)';
                button.style.background = 'rgba(255,255,255,.3)';
            });

            button.addEventListener('mouseleave', () => {
                button.style.transform = 'scale(1)';
                button.style.background = 'rgba(255,255,255,.2)';
            });

            button.addEventListener('click', () => this.showSettingsPanel());
            document.body.appendChild(button);
        }

        showSettingsPanel() {
            let panel = document.getElementById('custom-bg-settings-panel');
            if (panel) {
                panel.remove();
                return;
            }

            panel = document.createElement('div');
            panel.id = 'custom-bg-settings-panel';
            panel.style.cssText = 'position:fixed;bottom:80px;left:20px;width:350px;background:rgba(255,255,255,.95);backdrop-filter:blur(20px);border-radius:15px;padding:20px;z-index:10001;box-shadow:0 8px 32px rgba(0,0,0,.3);font-family:sans-serif;direction:rtl';

            panel.innerHTML = `
                <h3 style="margin-top:0;color:#333">🎨 تنظیمات بک‌گراند</h3>
                <div style="margin-bottom:15px">
                    <label style="display:block;margin-bottom:5px;color:#333;font-weight:bold">آدرس تصویر:</label>
                    <input type="text" id="image-url" value="${this.settings.imageUrl}" placeholder="https://example.com/image.jpg" style="width:100%;padding:10px;border-radius:8px;border:1px solid #ddd;background:white;color:#333">
                </div>
                <div style="margin-bottom:15px">
                    <label style="display:block;margin-bottom:5px;color:#333;font-weight:bold">📁 آپلود:</label>
                    <input type="file" id="image-file" accept="image/*" style="width:100%;padding:8px;border-radius:8px;border:1px solid #ddd;background:white;color:#333;cursor:pointer">
                </div>
                <div style="margin-bottom:15px">
                    <label style="display:flex;align-items:center;color:#333;cursor:pointer">
                        <input type="checkbox" id="overlay-check" ${this.settings.overlay ? 'checked' : ''} style="margin-left:8px;width:18px;height:18px">
                        <span>لایه تیره</span>
                    </label>
                </div>
                <div style="display:flex;gap:10px">
                    <button id="apply-bg-btn" style="flex:1;padding:12px;border:none;background:#667eea;color:white;border-radius:8px;cursor:pointer;font-weight:bold">✅ اعمال</button>
                    <button id="clear-bg-btn" style="flex:1;padding:12px;border:none;background:#f5576c;color:white;border-radius:8px;cursor:pointer;font-weight:bold">🗑️ پاک</button>
                </div>
            `;

            document.body.appendChild(panel);

            // File upload
            const fileInput = panel.querySelector('#image-file');
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    if (!file.type.startsWith('image/')) {
                        alert('⚠️ فقط فایل تصویری!');
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        panel.querySelector('#image-url').value = event.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            });

            // Apply button
            panel.querySelector('#apply-bg-btn').addEventListener('click', () => {
                this.settings.imageUrl = panel.querySelector('#image-url').value;
                this.settings.overlay = panel.querySelector('#overlay-check').checked;
                this.saveSettings();
                this.applyBackground();
                panel.remove();
            });

            // Clear button
            panel.querySelector('#clear-bg-btn').addEventListener('click', () => {
                this.settings = this.getDefaultSettings();
                this.saveSettings();
                this.applyBackground();
                panel.remove();
            });

            // Close on outside click
            setTimeout(() => {
                const closePanel = (e) => {
                    if (!panel.contains(e.target) && e.target.id !== 'custom-bg-settings-btn') {
                        panel.remove();
                        document.removeEventListener('click', closePanel);
                    }
                };
                document.addEventListener('click', closePanel);
            }, 100);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => new CustomBackgroundManager());
    } else {
        new CustomBackgroundManager();
    }
})();
