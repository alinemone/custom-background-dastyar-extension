/**
 * اسکریپت شخصی‌سازی بک‌گراند
 * Custom Background Script
 *
 * این اسکریپت امکان تنظیم بک‌گراند شخصی را فراهم می‌کند
 * This script enables custom background functionality
 */

(function() {
    'use strict';

    // کلاس اصلی مدیریت بک‌گراند
    class CustomBackgroundManager {
        constructor() {
            this.storageKey = 'dastyar_custom_background';

            // اعمال فوری رنگ پیش‌فرض برای جلوگیری از فلش سیاه
            this.applyDefaultBackground();

            this.init();
        }

        // اعمال فوری بک‌گراند پیش‌فرض
        applyDefaultBackground() {
            const body = document.body;
            // اگر هیچ background-image‌ای نیست، یک رنگ تیره بگذار
            if (!body.style.backgroundImage || body.style.backgroundImage === 'none') {
                body.style.backgroundColor = '#1a1a2e';
            }
        }

        // مقداردهی اولیه
        async init() {
            // بارگذاری تنظیمات ذخیره شده
            await this.loadSettings();

            // اعمال بک‌گراند به صورت فوری (بدون تاخیر)
            this.applyBackgroundFast();

            // اضافه کردن دکمه تنظیمات به صفحه
            this.addSettingsButton();
        }

        // بارگذاری تنظیمات از localStorage
        async loadSettings() {
            try {
                const saved = localStorage.getItem(this.storageKey);
                this.settings = saved ? JSON.parse(saved) : this.getDefaultSettings();
            } catch (e) {
                this.settings = this.getDefaultSettings();
            }
        }

        // تنظیمات پیش‌فرض
        getDefaultSettings() {
            return {
                imageUrl: '',
                overlay: false
            };
        }

        // ذخیره تنظیمات
        saveSettings() {
            localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
        }

        // اعمال سریع بک‌گراند (بدون انیمیشن برای بارگذاری اولیه)
        applyBackgroundFast() {
            const body = document.body;

            // حذف کلاس‌های قبلی
            body.classList.remove(
                'bg-night-gradient', 'bg-sunset-gradient', 'bg-ocean-gradient',
                'bg-forest-gradient', 'bg-dark', 'bg-light', 'bg-custom-image',
                'bg-overlay', 'bg-blur'
            );

            // اعمال فوری تصویر
            if (this.settings.imageUrl) {
                // اضافه کردن استایل inline برای سرعت بیشتر
                body.style.setProperty('--custom-bg-image', `url('${this.settings.imageUrl}')`);
                body.classList.add('bg-custom-image');

                // preload تصویر برای جلوگیری از فلش سفید
                this.preloadImage(this.settings.imageUrl);
            }

            // اعمال لایه تیره
            if (this.settings.overlay) {
                body.classList.add('bg-overlay');
            }
        }

        // Preload کردن تصویر برای سرعت بیشتر
        preloadImage(url) {
            // اگر Base64 است، نیازی به preload نیست
            if (url.startsWith('data:')) {
                return;
            }

            // ایجاد یک Image object برای preload
            const img = new Image();
            img.src = url;
        }

        // اعمال بک‌گراند
        applyBackground() {
            const body = document.body;

            // حذف کلاس‌های قبلی
            body.classList.remove(
                'bg-night-gradient', 'bg-sunset-gradient', 'bg-ocean-gradient',
                'bg-forest-gradient', 'bg-dark', 'bg-light', 'bg-custom-image',
                'bg-overlay', 'bg-blur'
            );

            // حذف استایل‌های inline قبلی
            body.style.removeProperty('--custom-bg-color');
            body.style.removeProperty('--custom-bg-image');

            // اعمال تصویر اگر وجود داشته باشد
            if (this.settings.imageUrl) {
                body.classList.add('bg-custom-image');
                body.style.setProperty('--custom-bg-image', `url('${this.settings.imageUrl}')`);

                // preload تصویر
                this.preloadImage(this.settings.imageUrl);
            }

            // اعمال لایه تیره
            if (this.settings.overlay) {
                body.classList.add('bg-overlay');
            }
        }

        // اضافه کردن دکمه تنظیمات
        addSettingsButton() {
            // ایجاد دکمه شناور
            const button = document.createElement('button');
            button.id = 'custom-bg-settings-btn';
            button.innerHTML = '🎨';
            button.title = 'تنظیمات بک‌گراند';
            button.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 20px;
                width: 50px;
                height: 50px;
                border-radius: 50%;
                border: none;
                background: rgba(255, 255, 255, 0.2);
                backdrop-filter: blur(10px);
                cursor: pointer;
                font-size: 24px;
                z-index: 10000;
                transition: all 0.3s ease;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            `;

            button.addEventListener('mouseenter', () => {
                button.style.transform = 'scale(1.1)';
                button.style.background = 'rgba(255, 255, 255, 0.3)';
            });

            button.addEventListener('mouseleave', () => {
                button.style.transform = 'scale(1)';
                button.style.background = 'rgba(255, 255, 255, 0.2)';
            });

            button.addEventListener('click', () => this.showSettingsPanel());

            document.body.appendChild(button);
        }

        // نمایش پنل تنظیمات
        showSettingsPanel() {
            // بررسی اینکه پنل قبلاً وجود دارد یا نه
            let panel = document.getElementById('custom-bg-settings-panel');
            if (panel) {
                panel.remove();
                return;
            }

            // ایجاد پنل
            panel = document.createElement('div');
            panel.id = 'custom-bg-settings-panel';
            panel.style.cssText = `
                position: fixed;
                bottom: 80px;
                left: 20px;
                width: 350px;
                max-height: 500px;
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(20px);
                border-radius: 15px;
                padding: 20px;
                z-index: 10001;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                overflow-y: auto;
                direction: rtl;
            `;

            panel.innerHTML = `
                <h3 style="margin-top: 0; color: #333; font-size: 18px;">🎨 تنظیمات بک‌گراند</h3>

                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; color: #333; font-weight: bold;">آدرس تصویر (URL):</label>
                    <input type="text" id="image-url" value="${this.settings.imageUrl}" placeholder="https://example.com/image.jpg"
                           style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #ddd; box-sizing: border-box; background: white; color: #333; font-size: 14px;">
                    <small style="display: block; margin-top: 5px; color: #666; font-size: 12px;">💡 یا تصویر را در فولدر custom-background قرار دهید</small>
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; color: #333; font-weight: bold;">📁 آپلود تصویر:</label>
                    <input type="file" id="image-file" accept="image/*"
                           style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #ddd; background: white; color: #333; font-size: 14px; cursor: pointer;">
                    <small style="display: block; margin-top: 5px; color: #666; font-size: 12px;">✨ فرمت‌های پشتیبانی: JPG, PNG, WebP</small>
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display: flex; align-items: center; color: #333; cursor: pointer; font-size: 14px;">
                        <input type="checkbox" id="overlay-check" ${this.settings.overlay ? 'checked' : ''}
                               style="margin-left: 8px; width: 18px; height: 18px; cursor: pointer;">
                        <span>لایه تیره (برای خوانایی بهتر)</span>
                    </label>
                </div>

                <div style="display: flex; gap: 10px;">
                    <button id="apply-bg-btn" style="flex: 1; padding: 12px; border: none; background: #667eea; color: white; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 14px;">
                        ✅ اعمال
                    </button>
                    <button id="clear-bg-btn" style="flex: 1; padding: 12px; border: none; background: #f5576c; color: white; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 14px;">
                        🗑️ پاک کردن
                    </button>
                </div>
            `;

            document.body.appendChild(panel);

            // Event listeners

            // مدیریت آپلود فایل
            const fileInput = panel.querySelector('#image-file');
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    // بررسی نوع فایل
                    if (!file.type.startsWith('image/')) {
                        alert('⚠️ لطفاً یک فایل تصویری انتخاب کنید!');
                        return;
                    }

                    // خواندن فایل به عنوان Data URL
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const imageUrl = event.target.result;
                        panel.querySelector('#image-url').value = imageUrl;
                    };
                    reader.readAsDataURL(file);
                }
            });

            // دکمه اعمال
            panel.querySelector('#apply-bg-btn').addEventListener('click', () => {
                this.settings.imageUrl = panel.querySelector('#image-url').value;
                this.settings.overlay = panel.querySelector('#overlay-check').checked;

                this.saveSettings();
                this.applyBackground();
                panel.remove();
            });

            // دکمه پاک کردن
            panel.querySelector('#clear-bg-btn').addEventListener('click', () => {
                this.settings = this.getDefaultSettings();
                this.saveSettings();
                this.applyBackground();
                panel.remove();
            });

            // بستن پنل با کلیک خارج از آن
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

    // راه‌اندازی پس از بارگذاری کامل صفحه
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            new CustomBackgroundManager();
        });
    } else {
        new CustomBackgroundManager();
    }

})();
