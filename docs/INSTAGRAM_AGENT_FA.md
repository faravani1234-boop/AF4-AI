# راه‌اندازی ایجنت اینستاگرام در AF4 AI

این راهنما برای پروژه‌ی فعلی AF4 AI (Node.js / Express روی Render) نوشته شده است.

## نکته‌ی مهم درباره اکانت شخصی

API رسمی Meta برای دایرکت، مدیریت کامنت، انتشار محتوا و آمار، حساب‌های حرفه‌ای Instagram یعنی **Creator** یا **Business** را پشتیبانی می‌کند؛ حساب شخصی معمولی قابل اتصال به این قابلیت‌ها از طریق API رسمی نیست. برای استفاده از ایجنت، اکانت را در Instagram به Creator یا Business تبدیل کن. این کار از تنظیمات خود Instagram انجام می‌شود و رایگان است. اگر پیج شخصی/تولید محتواست، معمولاً Creator انتخاب مناسبی است.

مراجع Meta:
- https://developers.facebook.com/docs/instagram-platform/
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/
- https://developers.facebook.com/docs/messenger-platform/instagram/

## قابلیت‌های هدف

1. دریافت دایرکت از طریق Webhooks و پیشنهاد پاسخ با مدل فعلی AF4 AI.
2. پاسخ خودکار فقط برای پیام‌های ساده و کم‌خطر، در محدوده و سیاست‌های مجاز Meta.
3. ارسال موارد حساس (پول، سفارش قطعی، شکایت، اطلاعات شخصی، درخواست غیرعادی یا اطمینان پایین مدل) به صف تأیید انسانی.
4. خواندن و پاسخ به کامنت‌ها با مجوز رسمی.
5. ساخت پیش‌نویس کپشن و پیشنهاد محتوا؛ انتشار فقط پس از تأیید اولیه و فعال‌سازی مجوز انتشار.
6. آمار و گزارش عملکرد، در حد مجوزهای API.
7. ثبت رویدادها، جلوگیری از پردازش دوباره‌ی webhook، محدودیت نرخ و دکمه/فرمان توقف خودکار.

## مراحل راه‌اندازی

### ۱) آماده‌سازی اکانت
- در Instagram به Settings and activity برو.
- گزینه‌ی Account type and tools / Switch to professional account را پیدا کن.
- Creator یا Business را انتخاب کن.
- اگر روش Facebook Login را انتخاب می‌کنی، حساب را به یک Facebook Page متصل کن. در روش Instagram Login شرایط و مجوزهای همان مسیر را در پنل Meta بررسی کن.

نام دقیق منوها ممکن است با زبان و نسخه‌ی برنامه فرق کند.

### ۲) ساخت برنامه در Meta
- وارد https://developers.facebook.com/ شو و یک Meta app بساز.
- محصول Instagram و قابلیت‌های موردنیاز (Messaging، Comments و Content Publishing) را طبق مسیر ورود انتخابی اضافه کن.
- مجوزهای موردنیاز را فقط برای قابلیت‌هایی که واقعاً فعال می‌کنی درخواست بده؛ برای Instagram Login نام‌های رایج شامل `instagram_business_basic`, `instagram_business_manage_messages`, `instagram_business_manage_comments`, و برای انتشار `instagram_business_content_publish` است. نام مجوزها به مسیر API بستگی دارد.
- حساب خودت را به‌عنوان تستر/نقش برنامه اضافه کن و مجوزها را تأیید کن. استفاده‌ی عمومی ممکن است به App Review و دسترسی پیشرفته نیاز داشته باشد.

### ۳) اتصال به Render
آدرس سرویس فعلی AF4 AI: https://af4-ai.onrender.com

برای webhook، پس از اضافه شدن مسیرهای backend، از URL نهایی HTTPS استفاده می‌شود:
- Callback URL: `https://af4-ai.onrender.com/api/instagram/webhook`
- Verify token: یک رشته‌ی تصادفی محرمانه که خودت تولید می‌کنی؛ با Access Token اشتباه گرفته نشود.

**توجه:** مسیر webhook بالا تا وقتی کد endpoint و تأیید challenge به پروژه اضافه و deploy نشده باشد، فعال نیست. قبل از ثبت آن در Meta باید پیاده‌سازی و آزمایش شود.

### ۴) اسرار و متغیرهای محیطی
این مقادیر را فقط در Render → سرویس AF4 AI → Environment اضافه کن؛ هرگز در کد، GitHub، چت یا APK قرار نده:
- `META_APP_ID`
- `META_APP_SECRET`
- `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`
- `INSTAGRAM_ACCESS_TOKEN` (پس از پیاده‌سازی ورود امن و مدیریت/تمدید توکن)
- `INSTAGRAM_ACCOUNT_ID`

مقادیر واقعی را تا وقتی اپ Meta و مجوزها ساخته نشده‌اند، نمی‌توان حدس زد. توکن‌ها باید محرمانه بمانند و در لاگ‌ها نمایش داده نشوند.

## طرح ایمنی پیش‌فرض

- ابتدا حالت **پیشنهاد پاسخ فقط**؛ ارسال خودکار خاموش.
- پس از آزمایش، فقط پاسخ‌های کم‌خطر را می‌توان خودکار کرد.
- انتشار پست/ریل، حذف کامنت، پیام‌های حساس و اقدام‌های غیرقابل‌برگشت نیازمند تأیید صریح تو باشد.
- رعایت محدودیت‌های پنجره‌ی پیام‌رسانی و سیاست‌های Meta الزامی است؛ از ارسال انبوه، پیام ناخواسته و روش‌های غیررسمی/استخراج کوکی استفاده نشود.
- توکن و App Secret در کلاینت اندروید قرار نگیرد؛ تمام درخواست‌های Meta باید از backend امن عبور کنند.

## گام بعدی

اول اکانت Instagram را به Creator یا Business تبدیل کن و در Meta for Developers برنامه را بساز. بعد از آماده شدن App ID و انتخاب مسیر ورود (Instagram Login یا Facebook Login)، می‌توانیم endpointهای OAuth، webhook، صف تأیید و اتصال به مدل‌های موجود AF4 AI را با تنظیمات درست پیاده کنیم.
