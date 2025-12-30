(function() {
    'use strict';

    const STORAGE_KEY = 'dastyar_custom_background';
    const BING_BASE_URL = 'https://bing.biturl.top/?resolution=1920&format=image&index=';

    // لود فوری بک‌گراند قبل از هر چیز
    (function instantLoad() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const settings = JSON.parse(saved);
                let imageUrl = settings.imageUrl;

                if (settings.useBingDaily) {
                    const index = settings.bingIndex || 0;
                    imageUrl = BING_BASE_URL + index;
                }

                if (imageUrl) {
                    const body = document.body;
                    body.classList.add('bg-custom-image');
                    body.style.setProperty('--custom-bg-image', `url('${imageUrl}')`);
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
                useBingDaily: false,
                bingIndex: 0
            };
        }

        saveSettings() {
            localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
        }

        applyBackground() {
            const body = document.body;

            body.classList.remove('bg-custom-image', 'bg-overlay');
            body.style.removeProperty('--custom-bg-image');

            let imageUrl = this.settings.imageUrl;

            if (this.settings.useBingDaily) {
                const index = this.settings.bingIndex || 0;
                imageUrl = BING_BASE_URL + index;
            }

            if (imageUrl) {
                body.classList.add('bg-custom-image');
                body.style.setProperty('--custom-bg-image', `url('${imageUrl}')`);
            }
        }

        addSettingsButton() {
            const button = document.createElement('button');
            button.id = 'custom-bg-settings-btn';
            button.innerHTML = '🎨';
            button.title = 'تنظیمات بک‌گراند';
            button.style.cssText = 'position:fixed;bottom:24px;left:24px;width:32px;height:32px;border-radius:16px;border:none;background:rgba(255,255,255,.85);backdrop-filter:blur(20px);cursor:pointer;font-size:24px;z-index:10000;transition:all .3s cubic-bezier(0.4, 0, 0.2, 1);box-shadow:0 8px 32px rgba(0,0,0,.12);color:#1e293b';

            button.addEventListener('mouseenter', () => {
                button.style.transform = 'scale(1.08) translateY(-2px)';
                button.style.background = 'rgba(255,255,255,.95)';
                button.style.boxShadow = '0 12px 40px rgba(0,0,0,.18)';
            });

            button.addEventListener('mouseleave', () => {
                button.style.transform = 'scale(1) translateY(0)';
                button.style.background = 'rgba(255,255,255,.85)';
                button.style.boxShadow = '0 8px 32px rgba(0,0,0,.12)';
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
            panel.style.cssText = 'position:fixed;bottom:80px;left:20px;width:380px;background:#ffffff;backdrop-filter:blur(20px);border-radius:20px;padding:28px;z-index:10001;box-shadow:0 20px 60px rgba(0,0,0,.15),0 8px 25px rgba(0,0,0,.08);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;direction:rtl;opacity:0;transform:scale(0.95);transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';

            // Animate in
            setTimeout(() => {
                panel.style.opacity = '1';
                panel.style.transform = 'scale(1)';
            }, 10);

            const bingIndex = this.settings.bingIndex || 0;

            panel.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
                    <h3 style="margin:0;color:#1a1a1a;font-size:18px;font-weight:600">تنظیمات بک‌گراند</h3>
                    <span style="font-size:20px">🎨</span>
                </div>

                <div style="margin-bottom:16px;padding:16px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0">
                    <label style="display:flex;align-items:center;color:#1e293b;cursor:pointer">
                        <input type="checkbox" id="bing-daily-check" ${this.settings.useBingDaily ? 'checked' : ''} style="margin-left:12px;width:20px;height:20px;cursor:pointer;accent-color:#6366f1">
                        <div style="flex:1">
                            <div style="font-weight:600;color:#1e293b;font-size:14px">تصویر روزانه Bing</div>
                            <div style="font-size:12px;color:#64748b;margin-top:2px">تصویر زیبای هر روز</div>
                        </div>
                    </label>
                </div>

                <div style="margin-bottom:20px">
                    <label style="display:block;margin-bottom:8px;color:#475569;font-size:13px;font-weight:500">انتخاب روز</label>
                    <select id="bing-index" style="width:100%;padding:12px 16px;border-radius:12px;border:1.5px solid #e2e8f0;background:#fafbfc;color:#1e293b;font-size:14px;cursor:pointer;transition:all 0.2s">
                        <option value="0" ${bingIndex === 0 ? 'selected' : ''}>امروز</option>
                        <option value="1" ${bingIndex === 1 ? 'selected' : ''}>دیروز</option>
                        <option value="2" ${bingIndex === 2 ? 'selected' : ''}>2 روز قبل</option>
                        <option value="3" ${bingIndex === 3 ? 'selected' : ''}>3 روز قبل</option>
                        <option value="4" ${bingIndex === 4 ? 'selected' : ''}>4 روز قبل</option>
                        <option value="5" ${bingIndex === 5 ? 'selected' : ''}>5 روز قبل</option>
                    </select>
                </div>

                <div style="margin-bottom:20px">
                    <label style="display:block;margin-bottom:8px;color:#475569;font-size:13px;font-weight:500">آدرس تصویر</label>
                    <input type="text" id="image-url" value="${this.settings.imageUrl}" placeholder="https://example.com/image.jpg" style="width:100%;padding:12px 16px;border-radius:12px;border:1.5px solid #e2e8f0;background:#fafbfc;color:#1e293b;font-size:14px;transition:all 0.2s;box-sizing:border-box">
                </div>

                <div style="margin-bottom:24px">
                    <label style="display:block;margin-bottom:8px;color:#475569;font-size:13px;font-weight:500">آپلود از دستگاه</label>
                    <input type="file" id="image-file" accept="image/*" style="width:100%;padding:10px;border-radius:12px;border:1.5px dashed #cbd5e1;background:#fafbfc;color:#475569;font-size:13px;cursor:pointer;transition:all 0.2s">
                </div>

                <div style="display:flex;gap:10px">
                    <button id="apply-bg-btn" style="flex:1;padding:14px;border:none;background:#1e293b;color:white;border-radius:12px;cursor:pointer;font-size:14px;font-weight:600;transition:all 0.2s">اعمال</button>
                    <button id="clear-bg-btn" style="flex:1;padding:14px;border:none;background:#f1f5f9;color:#64748b;border-radius:12px;cursor:pointer;font-size:14px;font-weight:600;transition:all 0.2s">پاک</button>
                </div>
            `;

            document.body.appendChild(panel);

            // Style improvements for inputs
            const urlInput = panel.querySelector('#image-url');
            const fileInput = panel.querySelector('#image-file');
            const bingSelect = panel.querySelector('#bing-index');
            const applyBtn = panel.querySelector('#apply-bg-btn');
            const clearBtn = panel.querySelector('#clear-bg-btn');

            // Bing select style
            bingSelect.addEventListener('focus', () => {
                bingSelect.style.borderColor = '#6366f1';
                bingSelect.style.background = '#fff';
                bingSelect.style.outline = 'none';
            });

            bingSelect.addEventListener('blur', () => {
                bingSelect.style.borderColor = '#e2e8f0';
                bingSelect.style.background = '#fafbfc';
            });

            urlInput.addEventListener('focus', () => {
                urlInput.style.borderColor = '#6366f1';
                urlInput.style.background = '#fff';
                urlInput.style.outline = 'none';
            });

            urlInput.addEventListener('blur', () => {
                urlInput.style.borderColor = '#e2e8f0';
                urlInput.style.background = '#fafbfc';
            });

            fileInput.addEventListener('mouseenter', () => {
                fileInput.style.borderColor = '#94a3b8';
                fileInput.style.background = '#fff';
            });

            fileInput.addEventListener('mouseleave', () => {
                fileInput.style.borderColor = '#cbd5e1';
                fileInput.style.background = '#fafbfc';
            });

            applyBtn.addEventListener('mouseenter', () => {
                applyBtn.style.background = '#334155';
                applyBtn.style.transform = 'translateY(-1px)';
            });

            applyBtn.addEventListener('mouseleave', () => {
                applyBtn.style.background = '#1e293b';
                applyBtn.style.transform = 'translateY(0)';
            });

            clearBtn.addEventListener('mouseenter', () => {
                clearBtn.style.background = '#e2e8f0';
                clearBtn.style.transform = 'translateY(-1px)';
            });

            clearBtn.addEventListener('mouseleave', () => {
                clearBtn.style.background = '#f1f5f9';
                clearBtn.style.transform = 'translateY(0)';
            });

            // Bing daily checkbox toggle
            const bingCheckbox = panel.querySelector('#bing-daily-check');

            bingCheckbox.addEventListener('change', () => {
                if (bingCheckbox.checked) {
                    urlInput.disabled = true;
                    urlInput.style.opacity = '0.4';
                    urlInput.style.cursor = 'not-allowed';
                    bingSelect.disabled = false;
                    bingSelect.style.opacity = '1';
                    bingSelect.style.cursor = 'pointer';
                } else {
                    urlInput.disabled = false;
                    urlInput.style.opacity = '1';
                    urlInput.style.cursor = 'text';
                    bingSelect.disabled = true;
                    bingSelect.style.opacity = '0.4';
                    bingSelect.style.cursor = 'not-allowed';
                }
            });

            // Initialize state
            if (bingCheckbox.checked) {
                urlInput.disabled = true;
                urlInput.style.opacity = '0.4';
                urlInput.style.cursor = 'not-allowed';
            } else {
                bingSelect.disabled = true;
                bingSelect.style.opacity = '0.4';
                bingSelect.style.cursor = 'not-allowed';
            }

            // File upload
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
                this.settings.useBingDaily = panel.querySelector('#bing-daily-check').checked;
                this.settings.bingIndex = parseInt(panel.querySelector('#bing-index').value);
                this.settings.imageUrl = panel.querySelector('#image-url').value;
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
