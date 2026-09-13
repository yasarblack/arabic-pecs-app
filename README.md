# تطبيق التواصل بالصور (PECS) - عربي

تطبيق ويب لتطوير التواصل البصري واللغوي عند الأطفال، يعتمد على نظام تبادل الصور (PECS) لتحويل الصور إلى أصوات عربية.
<..تحديث..>

## التقنيات
- React + Vite
- Supabase (Database + Auth + Storage)
- GitHub Pages (استضافة)

## التشغيل محليًا

1. ثبّت الحزم:
   \`\`\`bash
   npm install
   \`\`\`

2. انسخ ملف `.env.example` باسم `.env` واملأ بيانات مشروع Supabase:
   \`\`\`
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   \`\`\`

3. شغّل المشروع:
   \`\`\`bash
   npm run dev
   \`\`\`

## النشر

النشر يتم تلقائيًا عبر GitHub Actions عند كل push على فرع `main`.

لازم تضيف الأسرار (Secrets) بإعدادات الـ Repository:
- Settings → Secrets and variables → Actions → New repository secret
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

وتفعّل GitHub Pages من:
- Settings → Pages → Source: GitHub Actions
<!-- تحديث -->)<!-- تحديث -->)

