import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// مهم: اسم الـ repo لازم يطابق ما بعد الـ / بالضبط
// لو اسم الـ repo عندك مختلف عن "arabic-pecs-app" غيّر القيمة تحت
export default defineConfig({
  plugins: [react()],
  base: '/arabic-pecs-app/',
})
