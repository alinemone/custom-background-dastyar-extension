(function () {
    'use strict';

    // جلوگیری از اجرای دوباره اگر اسکریپت دو بار به صفحه اضافه شده باشد
    if (window.__dastyarCustomBg) return;
    window.__dastyarCustomBg = true;

    const STORAGE_KEY = 'dastyar_custom_background';
    const DB_NAME = 'dastyar_custom_background';
    const DB_STORE = 'images';
    const UPLOAD_KEY = 'upload';
    // Bing's own HPImageArchive has the correct image for every day, but it sends no CORS
    // headers: it is readable only after the user grants the optional bing.com permission
    // (install.ps1 adds it to the manifest). biturl is the fallback; its index skips days.
    const BING_ORIGIN = 'https://www.bing.com/*';
    const HP_ARCHIVE_URL = 'https://www.bing.com/HPImageArchive.aspx?format=js&n=1&mkt=en-US&idx=';
    const BITURL_URL = 'https://bing.biturl.top/?resolution=1920&mkt=en-US&format=';
    const REMOTE_KEY = 'remote';
    const BING_RECHECK_MS = 60 * 60 * 1000;
    const REQUEST_TIMEOUT_MS = 8000;
    const MAX_UPLOAD_SIDE = 2560;
    const KEEP_ORIGINAL_BYTES = 3 * 1024 * 1024;
    const MAX_DIM = 80;

    const MODES = [
        { id: 'none', label: 'بدون' },
        { id: 'bing', label: 'Bing' },
        { id: 'url', label: 'لینک' },
        { id: 'upload', label: 'آپلود' },
    ];
    const BING_DAYS = ['امروز', 'دیروز', '۲ روز قبل', '۳ روز قبل', '۴ روز قبل', '۵ روز قبل', '۶ روز قبل', '۷ روز قبل'];
    const DEFAULTS = { mode: 'none', url: '', bingIndex: 0, dim: 0 };

    const ICON_IMAGE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3.5"/><circle cx="9" cy="9.5" r="1.7"/><path d="m21 15.5-4.6-4.6L7.5 20"/></svg>';
    const ICON_CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

    // ---------------------------------------------------------------- settings

    function clampInt(value, min, max, fallback) {
        const n = parseInt(value, 10);
        return Number.isNaN(n) ? fallback : Math.min(max, Math.max(min, n));
    }

    function normalize(raw) {
        return {
            mode: MODES.some(m => m.id === raw.mode) ? raw.mode : 'none',
            url: typeof raw.url === 'string' ? raw.url : '',
            bingIndex: clampInt(raw.bingIndex, 0, BING_DAYS.length - 1, 0),
            dim: clampInt(raw.dim, 0, MAX_DIM, 0),
        };
    }

    function readSettings() {
        let raw = null;
        try {
            raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        } catch (e) {
            raw = null;
        }
        if (!raw || typeof raw !== 'object') return { ...DEFAULTS };
        if (!('mode' in raw)) return migrateLegacy(raw);
        return normalize(raw);
    }

    function writeSettings(settings) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
            return true;
        } catch (e) {
            console.warn('[custom-bg] could not save settings:', e);
            return false;
        }
    }

    // نسخهٔ قبلی {imageUrl, useBingDaily, bingIndex} ذخیره می‌کرد و عکس آپلودی را
    // به صورت data URL داخل localStorage می‌گذاشت؛ آن را به IndexedDB منتقل می‌کنیم.
    function migrateLegacy(raw) {
        const imageUrl = typeof raw.imageUrl === 'string' ? raw.imageUrl : '';
        const settings = normalize({
            mode: raw.useBingDaily ? 'bing' : (imageUrl ? 'url' : 'none'),
            url: imageUrl,
            bingIndex: raw.bingIndex,
        });

        if (settings.mode === 'url' && imageUrl.startsWith('data:')) {
            fetch(imageUrl)
                .then(r => r.blob())
                .then(saveUpload)
                .then(() => writeSettings({ ...settings, mode: 'upload', url: '' }))
                .catch(e => console.warn('[custom-bg] legacy migration failed:', e));
        } else {
            writeSettings(settings);
        }
        return settings;
    }

    // --------------------------------------------------------------- indexedDB

    function openDbVersion(version) {
        return new Promise((resolve, reject) => {
            const req = version ? indexedDB.open(DB_NAME, version) : indexedDB.open(DB_NAME);
            req.onupgradeneeded = () => {
                if (!req.result.objectStoreNames.contains(DB_STORE)) req.result.createObjectStore(DB_STORE);
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    // اگر دیتابیس قبلاً بدون store ساخته شده باشد، با یک نسخهٔ بالاتر store را می‌سازیم
    async function openDb() {
        const db = await openDbVersion();
        if (db.objectStoreNames.contains(DB_STORE)) return db;
        const next = db.version + 1;
        db.close();
        return openDbVersion(next);
    }

    async function withStore(mode, fn) {
        const db = await openDb();
        try {
            return await new Promise((resolve, reject) => {
                const tx = db.transaction(DB_STORE, mode);
                const req = fn(tx.objectStore(DB_STORE));
                tx.oncomplete = () => resolve(req.result);
                tx.onerror = tx.onabort = () => reject(tx.error);
            });
        } finally {
            db.close();
        }
    }

    const loadUpload = () => withStore('readonly', s => s.get(UPLOAD_KEY));
    const saveUpload = blob => withStore('readwrite', s => s.put(blob, UPLOAD_KEY));
    const loadRemote = () => withStore('readonly', s => s.get(REMOTE_KEY));
    const saveRemote = record => withStore('readwrite', s => s.put(record, REMOTE_KEY));
    const forgetRemote = () => withStore('readwrite', s => s.delete(REMOTE_KEY));

    // -------------------------------------------------------------- background

    let storedUploadUrl = null;
    let remoteObjectUrl = null;
    let paintToken = 0;

    function cssUrl(url) {
        return 'url("' + url.replace(/["\\\n\r]/g, c => '\\' + c.charCodeAt(0).toString(16) + ' ') + '")';
    }

    async function storedUploadObjectUrl() {
        if (storedUploadUrl) return storedUploadUrl;
        const blob = await loadUpload().catch(() => null);
        if (!blob) return '';
        storedUploadUrl = URL.createObjectURL(blob);
        return storedUploadUrl;
    }

    // تصویر Bing یا لینک بعد از اولین دانلود در IndexedDB ذخیره می‌شود (فقط آخرین تصویر)،
    // تا تب‌های بعدی بدون هیچ درخواست شبکه‌ای باز شوند.
    function remoteSource(settings) {
        if (settings.mode === 'bing') return 'bing:' + settings.bingIndex;
        if (settings.mode === 'url') return 'url:' + settings.url.trim();
        return '';
    }

    function remoteObjectUrlFor(blob) {
        if (remoteObjectUrl) URL.revokeObjectURL(remoteObjectUrl);
        remoteObjectUrl = URL.createObjectURL(blob);
        return remoteObjectUrl;
    }

    async function fetchWithTimeout(url, options) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            const res = await fetch(url, { ...options, signal: controller.signal });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res;
        } finally {
            clearTimeout(timer);
        }
    }

    const isHttps = value => typeof value === 'string' && value.startsWith('https://');

    const permissionsApi = () => (typeof chrome !== 'undefined' && chrome.permissions) || null;

    // false وقتی نسخهٔ فعلی manifest هنوز پچ نشده (مثلاً درست بعد از آپدیت دستیار)
    function canRequestBingAccess() {
        try {
            const optional = chrome.runtime.getManifest().optional_host_permissions || [];
            return Boolean(permissionsApi()) && optional.includes(BING_ORIGIN);
        } catch (e) {
            return false;
        }
    }

    async function hasBingAccess() {
        const api = permissionsApi();
        if (!api) return false;
        try {
            return await api.contains({ origins: [BING_ORIGIN] });
        } catch (e) {
            return false;
        }
    }

    async function fetchBingImageUrl(index) {
        if (await hasBingAccess()) {
            try {
                const data = await (await fetchWithTimeout(HP_ARCHIVE_URL + index, { cache: 'no-store' })).json();
                const image = data.images && data.images[0];
                if (image && typeof image.urlbase === 'string' && image.urlbase.startsWith('/th?id=')) {
                    return 'https://www.bing.com' + image.urlbase + '_1920x1080.jpg';
                }
            } catch (e) {
                // fall back to biturl
            }
        }
        try {
            const data = await (await fetchWithTimeout(BITURL_URL + 'json&index=' + index, { cache: 'no-store' })).json();
            return isHttps(data.url) ? data.url : '';
        } catch (e) {
            return '';
        }
    }

    // فایل تصویر فقط وقتی در IndexedDB ذخیره می‌شود که سرورش CORS بدهد (مثل bing.com)؛
    // در غیر این صورت فقط آدرس ذخیره می‌شود و تصویر از کش خود مرورگر می‌آید.
    async function cacheRemote(source, url) {
        let blob = null;
        let finalUrl = url;
        for (const candidate of withMirrors(url)) {
            try {
                const res = await fetchWithTimeout(candidate, {});
                const body = await res.blob();
                if (body.type.startsWith('image/')) {
                    blob = body;
                    finalUrl = res.url || candidate;
                    break;
                }
            } catch (e) {
                // no CORS, or this host timed out
            }
        }
        const record = { source, url: finalUrl, blob, checkedAt: Date.now() };
        await saveRemote(record).catch(() => {});
        return record;
    }

    function recordImageUrl(record) {
        return record.blob ? remoteObjectUrlFor(record.blob) : record.url;
    }

    // هر ساعت حداکثر یک درخواست کوچک JSON؛ خود تصویر فقط وقتی دوباره دانلود می‌شود که عوض شده باشد.
    async function refreshBing(settings, record, token) {
        const url = await fetchBingImageUrl(settings.bingIndex);
        if (!url) return;
        if (withMirrors(url).includes(record.url)) {
            saveRemote({ ...record, checkedAt: Date.now() }).catch(() => {});
            return;
        }
        const fresh = await cacheRemote(record.source, url);
        if (token !== paintToken) return;
        const freshUrl = recordImageUrl(fresh);
        if (fresh.blob || (await checkImage(freshUrl) && token === paintToken)) paint(freshUrl, settings.dim);
    }

    // لیست آدرس‌ها به ترتیب اولویت؛ اولین آدرسی که لود شود استفاده می‌شود.
    function imageCandidates(settings, pendingUploadUrl) {
        switch (settings.mode) {
            case 'bing': return [
                () => fetchBingImageUrl(settings.bingIndex),
                () => BITURL_URL + 'image&index=' + settings.bingIndex,
            ];
            case 'url': return [() => settings.url.trim()];
            case 'upload': return [() => pendingUploadUrl || storedUploadObjectUrl()];
            default: return [];
        }
    }

    // سرور عکس www.bing.com روی بعضی شبکه‌ها timeout می‌خورد؛ همان عکس روی cn.bing.com هم هست.
    function withMirrors(url) {
        if (!url) return [];
        const match = url.match(/^https:\/\/www\.bing\.com(\/th\?.*)$/);
        return match ? [url, 'https://cn.bing.com' + match[1]] : [url];
    }

    function checkImage(url) {
        return new Promise(resolve => {
            const img = new Image();
            const timer = setTimeout(() => done(false), REQUEST_TIMEOUT_MS);
            function done(ok) {
                clearTimeout(timer);
                img.onload = img.onerror = null;
                resolve(ok);
            }
            img.onload = () => done(true);
            img.onerror = () => done(false);
            img.src = url;
        });
    }

    // دستیار موقع اعمال تم همهٔ کلاس‌های <html> را پاک می‌کند (classList = "") و عکس خودش را
    // روی html.style.backgroundImage می‌گذارد؛ برای همین به جای کلاس، یک <style> اختصاصی
    // می‌نویسیم که در <head> است و دستیار به آن دست نمی‌زند.
    let backgroundStyle = null;
    let paintedUrl = '';

    function writeBackgroundCss(css) {
        if (!backgroundStyle || !backgroundStyle.isConnected) {
            backgroundStyle = document.getElementById('cbg-background') || document.createElement('style');
            backgroundStyle.id = 'cbg-background';
            (document.head || document.documentElement).append(backgroundStyle);
        }
        backgroundStyle.textContent = css;
    }

    // والپیپر خود دستیار یک لایهٔ fixed تمام‌صفحه است (div.fixed.inset-0.-z-10) که داخلش
    // div.background (عکس) یا <video> است و روی body کشیده می‌شود؛ پس عکس ما روی همان لایه
    // هم اعمال و محتوای داخلش مخفی می‌شود. body برای صفحهٔ onboarding که این لایه را ندارد.
    const WALLPAPER_LAYER = 'body .fixed.inset-0:has(> .background), body .fixed.inset-0:has(> video)';
    const WALLPAPER_CONTENT = 'body .fixed.inset-0:has(> .background) > *, body .fixed.inset-0:has(> video) > *';

    // تا وقتی تصویر از کش خوانده شود، تصویر پیش‌فرض دستیار نمایش داده نشود
    function hideDefaultBackground() {
        writeBackgroundCss(
            'html, html body { background-image: none !important; }\n' +
            WALLPAPER_CONTENT + ' { visibility: hidden !important; }');
    }

    function paint(url, dim) {
        paintedUrl = url;
        if (!url) {
            writeBackgroundCss('');
            return;
        }
        const shade = 'rgba(0, 0, 0, ' + (dim / 100) + ')';
        writeBackgroundCss(
            'html { background-image: none !important; }\n' +
            'html body, ' + WALLPAPER_LAYER + ' {\n' +
            '    background-color: #111 !important;\n' +
            '    background-image: linear-gradient(' + shade + ', ' + shade + '), ' + cssUrl(url) + ' !important;\n' +
            '    background-size: cover !important;\n' +
            '    background-position: center !important;\n' +
            '    background-repeat: no-repeat !important;\n' +
            '    background-attachment: fixed !important;\n' +
            '    background-blend-mode: normal !important;\n' +
            '}\n' +
            WALLPAPER_CONTENT + ' { visibility: hidden !important; }');
    }

    function setDim(dim) {
        if (paintedUrl) paint(paintedUrl, dim);
    }

    // true = تصویر لود شد، false = لود نشد (بک‌گراند پیش‌فرض دستیار برمی‌گردد)، null = تصویری نیست یا درخواست جدیدتری آمده
    async function applyBackground(settings, pendingUploadUrl) {
        const token = ++paintToken;
        const source = remoteSource(settings);

        if (source) {
            const record = await loadRemote().catch(() => null);
            if (token !== paintToken) return null;
            if (record && record.source === source && (record.blob || record.url)) {
                const url = recordImageUrl(record);
                // تصویری که فقط آدرسش ذخیره شده ممکن است از کش مرورگر پاک شده و آفلاین باشیم
                const ok = record.blob ? true : await checkImage(url);
                if (token !== paintToken) return null;
                if (ok) {
                    paint(url, settings.dim);
                    if (settings.mode === 'bing' && Date.now() - record.checkedAt > BING_RECHECK_MS) {
                        refreshBing(settings, record, token);
                    }
                    return true;
                }
            }
        }

        const tried = [];
        for (const candidate of imageCandidates(settings, pendingUploadUrl)) {
            const resolved = await candidate();
            if (token !== paintToken) return null;

            for (const url of withMirrors(resolved)) {
                if (tried.includes(url)) continue;
                tried.push(url);

                // اول کامل لود می‌شود و بعد روی صفحه می‌آید، تا موقع انتظار صفحه سیاه نشود
                const ok = await checkImage(url);
                if (token !== paintToken) return null;
                if (ok) {
                    paint(url, settings.dim);
                    if (source) cacheRemote(source, url);
                    return true;
                }
            }
        }

        paint('', settings.dim);
        if (!tried.length) return null;
        console.warn('[custom-bg] image failed to load:', tried.map(u => u.slice(0, 120)).join(' | '));
        return false;
    }

    async function prepareUpload(file) {
        if (!file || !file.type.startsWith('image/')) {
            throw new Error('فقط فایل تصویری قابل قبول است.');
        }
        if (file.size <= KEEP_ORIGINAL_BYTES || file.type === 'image/gif' || file.type === 'image/svg+xml') {
            return file;
        }

        let bitmap;
        try {
            bitmap = await createImageBitmap(file);
        } catch (e) {
            throw new Error('مرورگر نتوانست این تصویر را بخواند.');
        }
        const scale = Math.min(1, MAX_UPLOAD_SIDE / Math.max(bitmap.width, bitmap.height));
        const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
    }

    function isValidImageUrl(value) {
        try {
            return ['http:', 'https:', 'data:'].includes(new URL(value).protocol);
        } catch (e) {
            return false;
        }
    }

    // ---------------------------------------------------------------------- UI

    function el(tag, props, ...children) {
        const node = document.createElement(tag);
        Object.entries(props || {}).forEach(([key, value]) => {
            if (key === 'class') node.className = value;
            else if (key === 'html') node.innerHTML = value;
            else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
            else if (key in node) node[key] = value;
            else node.setAttribute(key, value);
        });
        children.flat().forEach(child => child != null && node.append(child));
        return node;
    }

    class SettingsUi {
        constructor() {
            this.saved = readSettings();
            this.panel = null;
            this.updateSeq = 0;
        }

        mount() {
            this.trigger = el('button', {
                class: 'cbg-trigger',
                type: 'button',
                title: 'تغییر پس‌زمینه (Alt+B)',
                'aria-label': 'تغییر پس‌زمینه',
                html: ICON_IMAGE,
                onclick: () => this.toggle(),
            });
            document.body.append(el('div', { class: 'cbg-corner' }, this.trigger));

            document.addEventListener('keydown', e => {
                if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyB') {
                    e.preventDefault();
                    this.toggle();
                } else if (e.key === 'Escape' && this.panel) {
                    this.close(false);
                }
            });
        }

        toggle() {
            if (this.panel) this.close(false);
            else this.open();
        }

        open() {
            this.draft = { ...this.saved };
            this.pendingBlob = null;
            this.pendingUrl = null;
            this.panel = this.buildPanel();
            document.body.append(this.panel);
            this.trigger.classList.add('cbg-trigger--open');
            requestAnimationFrame(() => this.panel && this.panel.classList.add('cbg-panel--visible'));

            this.onOutsideClick = e => {
                if (this.panel && !this.panel.contains(e.target) && !this.trigger.contains(e.target)) {
                    this.close(false);
                }
            };
            setTimeout(() => document.addEventListener('mousedown', this.onOutsideClick), 0);
        }

        close(keepDraft) {
            if (!this.panel) return;
            clearTimeout(this.urlTimer);
            this.updateSeq++;
            document.removeEventListener('mousedown', this.onOutsideClick);
            this.panel.remove();
            this.panel = null;
            this.trigger.classList.remove('cbg-trigger--open');

            if (!keepDraft) {
                if (this.pendingUrl) URL.revokeObjectURL(this.pendingUrl);
                applyBackground(this.saved);
            }
            this.pendingBlob = null;
            this.pendingUrl = null;
        }

        buildPanel() {
            this.tabs = MODES.map(mode => el('button', {
                class: 'cbg-tab',
                type: 'button',
                textContent: mode.label,
                onclick: () => this.update({ mode: mode.id }),
            }));

            this.bingSelect = el('select', {
                class: 'cbg-input',
                onchange: () => this.update({ bingIndex: Number(this.bingSelect.value) }),
            }, BING_DAYS.map((label, i) => el('option', { value: String(i), textContent: label })));

            this.urlInput = el('input', {
                class: 'cbg-input',
                type: 'url',
                dir: 'ltr',
                placeholder: 'https://example.com/image.jpg',
                oninput: () => {
                    clearTimeout(this.urlTimer);
                    this.urlTimer = setTimeout(() => this.update({ url: this.urlInput.value.trim() }), 400);
                },
            });

            this.fileInput = el('input', {
                type: 'file',
                accept: 'image/*',
                hidden: true,
                onchange: () => this.pickFile(this.fileInput.files[0]),
            });
            this.dropLabel = el('span', { textContent: 'انتخاب تصویر یا رها کردن فایل اینجا' });
            const drop = el('button', {
                class: 'cbg-drop',
                type: 'button',
                onclick: () => this.fileInput.click(),
                ondragover: e => { e.preventDefault(); drop.classList.add('cbg-drop--over'); },
                ondragleave: () => drop.classList.remove('cbg-drop--over'),
                ondrop: e => {
                    e.preventDefault();
                    drop.classList.remove('cbg-drop--over');
                    this.pickFile(e.dataTransfer.files[0]);
                },
            }, el('span', { class: 'cbg-drop-icon', html: ICON_IMAGE }), this.dropLabel);

            this.sections = {
                none: el('p', { class: 'cbg-hint', textContent: 'پس‌زمینهٔ پیش‌فرض دستیار نمایش داده می‌شود.' }),
                bing: el('div', { class: 'cbg-field' },
                    el('label', { class: 'cbg-field' }, el('span', { class: 'cbg-label', textContent: 'تصویر روز' }), this.bingSelect),
                    this.buildBingAccessRow()),
                url: el('label', { class: 'cbg-field' }, el('span', { class: 'cbg-label', textContent: 'آدرس تصویر' }), this.urlInput),
                upload: el('div', { class: 'cbg-field' }, drop, this.fileInput),
            };

            this.dimInput = el('input', {
                class: 'cbg-range',
                type: 'range',
                min: '0',
                max: String(MAX_DIM),
                step: '5',
                oninput: () => this.update({ dim: Number(this.dimInput.value) }),
            });
            this.dimValue = el('span', { class: 'cbg-range-value' });
            this.dimRow = el('label', { class: 'cbg-field' },
                el('span', { class: 'cbg-label' }, 'تیرگی', this.dimValue),
                this.dimInput);

            this.status = el('p', { class: 'cbg-status', role: 'status' });
            this.saveBtn = el('button', {
                class: 'cbg-btn cbg-btn--primary',
                type: 'button',
                textContent: 'ذخیره',
                onclick: () => this.save(),
            });

            this.bingSelect.value = String(this.draft.bingIndex);
            this.urlInput.value = this.draft.url;
            this.dimInput.value = String(this.draft.dim);

            const panel = el('div', { class: 'cbg-panel', dir: 'rtl', role: 'dialog', 'aria-label': 'تنظیمات پس‌زمینه' },
                el('div', { class: 'cbg-header' },
                    el('span', { class: 'cbg-title', textContent: 'پس‌زمینه' }),
                    el('button', {
                        class: 'cbg-icon-btn',
                        type: 'button',
                        title: 'بستن',
                        html: ICON_CLOSE,
                        onclick: () => this.close(false),
                    })),
                el('div', { class: 'cbg-tabs', role: 'tablist' }, this.tabs),
                Object.values(this.sections),
                this.dimRow,
                this.status,
                el('div', { class: 'cbg-actions' },
                    this.saveBtn,
                    el('button', {
                        class: 'cbg-btn',
                        type: 'button',
                        textContent: 'انصراف',
                        onclick: () => this.close(false),
                    })));

            this.render();
            return panel;
        }

        // بدون این دسترسی تصاویر روزهای قبل از biturl می‌آیند که تاریخ‌هایش جاافتادگی دارد
        buildBingAccessRow() {
            const row = el('div', { class: 'cbg-access', hidden: true },
                el('span', { textContent: 'برای تصویر دقیق هر روز، دسترسی به bing.com لازم است.' }),
                el('button', {
                    class: 'cbg-access-btn',
                    type: 'button',
                    textContent: 'اجازه دادن',
                    onclick: async () => {
                        let granted = false;
                        try {
                            granted = await permissionsApi().request({ origins: [BING_ORIGIN] });
                        } catch (e) {
                            granted = false;
                        }
                        if (!granted || !this.panel) return;
                        row.hidden = true;
                        await forgetRemote().catch(() => {});
                        this.update({});
                    },
                }));
            if (canRequestBingAccess()) {
                hasBingAccess().then(has => { row.hidden = has; });
            }
            return row;
        }

        render() {
            const { mode, dim } = this.draft;
            this.tabs.forEach((tab, i) => tab.classList.toggle('cbg-tab--active', MODES[i].id === mode));
            Object.entries(this.sections).forEach(([id, section]) => { section.hidden = id !== mode; });
            this.dimRow.hidden = mode === 'none';
            this.dimValue.textContent = dim.toLocaleString('fa-IR') + '٪';
        }

        setStatus(text, kind) {
            this.status.textContent = text || '';
            this.status.classList.toggle('cbg-status--error', kind === 'error');
            this.status.classList.toggle('cbg-status--loading', kind === 'loading');
        }

        async update(patch) {
            Object.assign(this.draft, patch);
            this.render();

            if (this.draft.mode === 'url' && this.draft.url && !isValidImageUrl(this.draft.url)) {
                this.setStatus('آدرس باید با http یا https شروع شود.', 'error');
                return;
            }

            // تغییر تیرگی نیازی به لود دوباره تصویر ندارد
            if (Object.keys(patch).length === 1 && 'dim' in patch) {
                setDim(this.draft.dim);
                return;
            }

            const seq = ++this.updateSeq;
            this.setStatus(this.draft.mode === 'none' ? '' : 'در حال بارگذاری…', 'loading');
            const ok = await applyBackground(this.draft, this.pendingUrl);
            if (!this.panel || seq !== this.updateSeq) return;
            if (ok === false) this.setStatus('تصویر بارگذاری نشد. آدرس یا اتصال اینترنت را بررسی کنید.', 'error');
            else if (ok === true || this.draft.mode === 'none') this.setStatus('');
            else if (this.draft.mode === 'url') this.setStatus('آدرس تصویر را وارد کنید.');
            else if (this.draft.mode === 'upload') this.setStatus('یک تصویر انتخاب کنید.');
        }

        async pickFile(file) {
            if (!file) return;
            this.setStatus('در حال آماده‌سازی تصویر…', 'loading');
            try {
                const blob = await prepareUpload(file);
                if (!this.panel) return;
                if (this.pendingUrl) URL.revokeObjectURL(this.pendingUrl);
                this.pendingBlob = blob;
                this.pendingUrl = URL.createObjectURL(blob);
                this.dropLabel.textContent = file.name;
                this.update({ mode: 'upload' });
            } catch (e) {
                this.setStatus(e.message, 'error');
            }
        }

        async save() {
            const draft = { ...this.draft, url: this.urlInput.value.trim() };

            if (draft.mode === 'url' && !isValidImageUrl(draft.url)) {
                this.setStatus('یک آدرس معتبر وارد کنید.', 'error');
                return;
            }
            if (draft.mode === 'upload' && !this.pendingBlob && !(await storedUploadObjectUrl())) {
                this.setStatus('ابتدا یک تصویر انتخاب کنید.', 'error');
                return;
            }

            this.saveBtn.disabled = true;
            try {
                if (draft.mode === 'upload' && this.pendingBlob) {
                    await saveUpload(this.pendingBlob);
                    if (storedUploadUrl) URL.revokeObjectURL(storedUploadUrl);
                    storedUploadUrl = this.pendingUrl;
                    this.pendingUrl = null;
                }
                if (!writeSettings(draft)) throw new Error('ذخیرهٔ تنظیمات ممکن نشد.');
            } catch (e) {
                this.saveBtn.disabled = false;
                this.setStatus(e.message || 'ذخیره‌سازی ناموفق بود.', 'error');
                return;
            }

            this.saved = draft;
            this.close(true);
            applyBackground(this.saved);
        }
    }

    // ------------------------------------------------------------------- start

    const initialSettings = readSettings();
    if (initialSettings.mode !== 'none') hideDefaultBackground();
    applyBackground(initialSettings);
    localStorage.removeItem('dastyar_custom_background_bing'); // cache of the previous version

    function mountUi() {
        new SettingsUi().mount();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountUi, { once: true });
    } else {
        mountUi();
    }
})();
