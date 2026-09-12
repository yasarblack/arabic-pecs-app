import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function Board() {
  const { profileId } = useParams()
  const [categories, setCategories] = useState([])
  const [activeCategory, setActiveCategory] = useState(null)
  const [cards, setCards] = useState([])
  const [sentence, setSentence] = useState([]) // مصفوفة بطاقات مركّبة
  const [loading, setLoading] = useState(true)
  const audioRef = useRef(null)

  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    if (activeCategory) loadCards(activeCategory)
  }, [activeCategory])

  async function loadCategories() {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order')

    if (!error && data?.length) {
      setCategories(data)
      setActiveCategory(data[0].id)
    }
    setLoading(false)
  }

  async function loadCards(categoryId) {
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('category_id', categoryId)

    if (!error) setCards(data || [])
  }

  // نطق البطاقة: يشغّل ملف صوتي مسجّل، أو TTS كخيار احتياطي
  function playCard(card) {
    if (card.audio_url) {
      const audio = new Audio(card.audio_url)
      audio.play().catch(() => speakFallback(card.label_ar))
    } else {
      speakFallback(card.label_ar)
    }
  }

  function speakFallback(text) {
    if ('speechSynthesis' in window) {
      const utter = new SpeechSynthesisUtterance(text)
      utter.lang = 'ar-SA'
      window.speechSynthesis.speak(utter)
    }
  }

  function handleCardPress(card) {
    playCard(card)
    setSentence((prev) => [...prev, card])
    logProgress(card.id)
  }

  async function logProgress(cardId) {
    // تسجيل تفاعل بسيط (اختياري - يحتاج upsert لاحقًا لتحديث times_pressed)
    await supabase.from('progress').insert({
      profile_id: profileId,
      card_id: cardId,
      times_pressed: 1,
    })
  }

  function playFullSentence() {
    const text = sentence.map((c) => c.label_ar).join(' ')
    speakFallback(text)
  }

  function clearSentence() {
    setSentence([])
  }

  if (loading) return <div className="loading">...جاري التحميل</div>

  return (
    <div className="container">
      <h2>اضغط على الصورة للتحدث</h2>

      {/* شريط الجملة المركّبة */}
      <div className="sentence-bar">
        {sentence.length === 0 && <span style={{ color: '#aaa' }}>اضغط على البطاقات لتكوين جملة...</span>}
        {sentence.map((c, i) => (
          <img key={i} src={c.image_url} alt={c.label_ar} />
        ))}
      </div>

      {sentence.length > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={playFullSentence} className="primary-btn">🔊 نطق الجملة</button>
          <button onClick={clearSentence} className="primary-btn" style={{ background: '#e63946' }}>🗑 مسح</button>
        </div>
      )}

      {/* تبويبات الفئات */}
      <div className="category-tabs">
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`category-tab ${activeCategory === cat.id ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat.id)}
          >
            {cat.icon} {cat.name_ar}
          </button>
        ))}
      </div>

      {/* شبكة البطاقات */}
      <div className="cards-grid">
        {cards.map((card) => (
          <button key={card.id} className="card-item" onClick={() => handleCardPress(card)}>
            <img src={card.image_url} alt={card.label_ar} />
            <span className="card-label">{card.label_ar}</span>
          </button>
        ))}
        {cards.length === 0 && <p>لا توجد بطاقات بهاي الفئة بعد</p>}
      </div>
    </div>
  )
}
