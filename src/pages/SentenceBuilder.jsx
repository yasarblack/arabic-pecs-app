import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function SentenceBuilder() {
  const { profileId } = useParams()
  const navigate = useNavigate()

  const [categories, setCategories] = useState([])
  const [activeCategory, setActiveCategory] = useState(null)
  const [cards, setCards] = useState([])
  const [sentence, setSentence] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

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
      .eq('is_sentence_category', true)
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
      .order('created_at')

    if (!error) setCards(data || [])
  }

  function addCard(card) {
    setSentence((prev) => [...prev, card])
  }

  function removeCard(index) {
    setSentence((prev) =>
      prev.filter((_, i) => i !== index)
    )
  }

  function clearSentence() {
    window.speechSynthesis?.cancel()
    setSentence([])
    setMessage('')
  }

  function speakSentence() {
    if (!sentence.length) return
    if (!('speechSynthesis' in window)) return

    window.speechSynthesis.cancel()

    const text = sentence
      .map((card) => card.label_ar)
      .join(' ')

    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'ar-SA'
    utter.rate = 0.9

    window.speechSynthesis.speak(utter)
  }

  async function saveSentence() {
    if (!sentence.length) return

    const { error } = await supabase
      .from('sentences')
      .insert({
        profile_id: profileId,
        card_ids: sentence.map((card) => card.id),
        full_text_ar: sentence
          .map((card) => card.label_ar)
          .join(' '),
      })

    setMessage(
      error
        ? 'حدث خطأ أثناء حفظ الجملة'
        : '✅ تم حفظ الجملة'
    )
  }

  if (loading) {
    return (
      <div className="loading">
        ...جاري التحميل
      </div>
    )
  }

  return (
    <div className="container">

      <button
        onClick={() => navigate(`/board/${profileId}`)}
        style={{
          background: 'transparent',
          color: '#4361ee',
          fontSize: '17px',
          marginBottom: '10px',
        }}
      >
        ← العودة إلى لوحة التواصل
      </button>

      <h2>🧩 تركيب جملة</h2>

      <div className="sentence-bar">
        {sentence.length === 0 && (
          <span style={{ color: '#aaa' }}>
            اختر الكلمات لتكوين جملة...
          </span>
        )}

        {sentence.map((card, index) => (
          <div
            key={`${card.id}-${index}`}
            style={{
              position: 'relative',
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              margin: '4px',
            }}
          >
            <button
              onClick={() => removeCard(index)}
              style={{
                position: 'absolute',
                top: '-8px',
                right: '-8px',
                width: '25px',
                height: '25px',
                borderRadius: '50%',
                background: '#e63946',
                color: 'white',
                fontWeight: 'bold',
                zIndex: 2,
              }}
            >
              ×
            </button>

            <img
              src={card.image_url}
              alt={card.label_ar}
              style={{
                width: '70px',
                height: '70px',
                objectFit: 'contain',
              }}
            />

            <span style={{ fontSize: '13px' }}>
              {card.label_ar}
            </span>
          </div>
        ))}
      </div>

      {sentence.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginBottom: '16px',
          }}
        >
          <button
            onClick={speakSentence}
            className="primary-btn"
          >
            🔊 نطق الجملة
          </button>

          <button
            onClick={saveSentence}
            className="primary-btn"
          >
            💾 حفظ الجملة
          </button>

          <button
            onClick={clearSentence}
            className="primary-btn"
            style={{ background: '#e63946' }}
          >
            🗑 مسح
          </button>
        </div>
      )}

      {message && (
        <p style={{ fontWeight: 'bold' }}>
          {message}
        </p>
      )}

      <div className="category-tabs">
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`category-tab ${
              activeCategory === cat.id ? 'active' : ''
            }`}
            onClick={() => setActiveCategory(cat.id)}
          >
            {cat.icon} {cat.name_ar}
          </button>
        ))}
      </div>

      <div className="cards-grid">
        {cards.map((card) => (
          <button
            key={card.id}
            className="card-item"
            onClick={() => addCard(card)}
          >
            <img
              src={card.image_url}
              alt={card.label_ar}
            />

            <span className="card-label">
              {card.label_ar}
            </span>
          </button>
        ))}

        {cards.length === 0 && (
          <p>
            لا توجد بطاقات بهذه المجموعة بعد
          </p>
        )}
      </div>

    </div>
  )
}
