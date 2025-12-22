# 🎨 ابزار شخصی‌سازی بک‌گراند برای اکستنشن Dastyar

این ابزار به شما اجازه می‌دهد تصویر دلخواه خود را به عنوان بک‌گراند اکستنشن Dastyar قرار دهید.

---

## 📋 نصب (4 مرحله ساده)

### مرحله 1️⃣: کپی کردن فولدر

فولدر `custom-background` را در مسیر اکستنشن Dastyar کپی کنید.

**مسیر دقیق:**
```
اگر مسیر اکستنشن شما این است:
C:\Users\YourName\AppData\Local\Google\Chrome\User Data\Default\Extensions\ebilacdhmebcihmbjgibcbeaihbecapj\4.2.4_1

فولدر را اینجا بگذارید:
C:\Users\YourName\AppData\Local\Google\Chrome\User Data\Default\Extensions\ebilacdhmebcihmbjgibcbeaihbecapj\4.2.4_1\custom-background\
```

**نتیجه باید این شکلی باشد:**
```
4.2.4_0\
├── custom-background\      ← فولدر جدید
│   ├── custom-bg.css
│   ├── custom-bg.js
│   └── README.md
├── dist\
├── assets\
├── manifest.json
└── background.js
```

---

### مرحله 2️⃣: ویرایش فایل manifest.json

1. فایل `manifest.json` را در مسیر اصلی اکستنشن باز کنید
2. قسمت `"web_accessible_resources"` را پیدا کنید
3. در قسمت `"resources"` این خط را اضافه کنید:

**قبل از تغییر:**
```json
"web_accessible_resources": [ {
  "matches": [ "<all_urls>" ],
  "resources": [ "assets/img/lib/*" ]
} ]
```

**بعد از تغییر:**
```json
"web_accessible_resources": [ {
  "matches": [ "<all_urls>" ],
  "resources": [
    "assets/img/lib/*",
    "custom-background/*"
  ]
} ]
```

⚠️ **نکته مهم:** فقط `"custom-background/*"` را اضافه کنید و ویرگول (,) را فراموش نکنید!

---

### مرحله 3️⃣: ویرایش فایل index.html

1. به مسیر `dist\override\` بروید
2. فایل `index.html` را باز کنید
3. این 2 خط را **قبل از** `</head>` اضافه کنید:

```html
<link rel="stylesheet" href="/custom-background/custom-bg.css">
<script src="/custom-background/custom-bg.js"></script>
```

**مثال کامل:**
```html
<!doctype html>
<html lang="fa" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <base target="_blank" />
    <title>New tab</title>
    <script type="module" crossorigin src="/dist/assets/override-DDlCyY7i.js"></script>
    <link rel="modulepreload" crossorigin href="/dist/assets/_commonjsHelpers-CNBic1d4.js">
    <link rel="modulepreload" crossorigin href="/dist/assets/vendor-BxtyZXV1.js">
    <link rel="modulepreload" crossorigin href="/dist/assets/ui-rnakXG1H.js">
    <link rel="stylesheet" crossorigin href="/dist/assets/override-DIrjmJxV.css">
    <-- فایل های جدید -->
    <link rel="stylesheet" href="/custom-background/custom-bg.css">
    <script src="/custom-background/custom-bg.js"></script>
  </head>

  <body class="override-body">
    <div id="app"></div>
  </body>
</html>
```

---

### مرحله 4️⃣: بارگذاری مجدد اکستنشن

1. مرورگر Chrome را باز کنید
2. آدرس `chrome://extensions/` را در نوار آدرس تایپ کنید
3. حالت **Developer mode** را در گوشه بالا راست فعال کنید
4. اکستنشن Dastyar را پیدا کنید
5. روی دکمه **🔄 Reload** کلیک کنید
6. یک تب جدید باز کنید

---

## 🎯 استفاده

پس از نصب، یک دکمه 🎨 در گوشه پایین سمت چپ صفحه ظاهر می‌شود.

**مراحل استفاده:**

1. **روی دکمه 🎨 کلیک کنید**
2. **یکی از این روش‌ها را انتخاب کنید:**
   - **لینک تصویر:** آدرس تصویر را در کادر بالا بگذارید (مثل: `https://example.com/image.jpg`)
   - **آپلود فایل:** روی "Choose File" کلیک کنید و تصویر از کامپیوتر انتخاب کنید
3. **اختیاری:** اگر می‌خواهید یک لایه تیره روی تصویر باشد، تیک "لایه تیره" را بزنید
4. **روی دکمه "✅ اعمال" کلیک کنید**

همین! تصویر شما به عنوان بک‌گراند اعمال می‌شود. ✨

---

**ساخته شده با ❤️**
