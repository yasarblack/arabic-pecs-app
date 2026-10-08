import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useNavigate, useParams } from 'react-router-dom'

export default function Board() {
  const { profileId } = useParams()
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [activeCategory, setActiveCategory] = useState(null)
  const [cards, setCards] = useState([])
  const [sentence, setSentence] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingSentence, setSavingSentence] = useState(false)
  const [message, setMessage] = useState('')
  const [mode, setMode] = useState('request') // request | feeling

  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    if (activeCategory) {
      loadCards(activeCategory)
    }
  }, [activeCategory, mode])

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
    let query = supabase
      .from('cards')
      .select('*')
      .eq('category_id', categoryId)
      .order('created_at')

    if (mode === 'request') {
      query = query.or('card_type.eq.request,card_type.is.null')
    } else {
      query = query.eq('card_type', 'feeling')
    }

    const { data, error } = await query
    if (!error) setCards(data || [])
  }

  function playCard(card) {
    if (card.audio_url) {
      const audio = new Audio(card.audio_url)
      audio.play().catch(() => speakFallback(card.label_ar))
    } else {
      speakFallback(card.label_ar)
    }
  }

  function speakFallback(text) {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'ar-SA'
    utter.rate = 0.9
    window.speechSynthesis.speak(utter)
  }

  function handleCardPress(card) {
    playCard(card)
    setSentence((prev) => [...prev, card])
    logProgress(card.id)
  }

  async function logProgress(cardId) {
    await supabase.from('progress').insert({
      profile_id: profileId,
      card_id: cardId,
      times_pressed: 1,
    })
  }

  function playFullSentence() {
    if (sentence.length === 0) return
    const prefix = mode === 'feeling' ? 'أشعر ' : 'أريد '
    const text = prefix + sentence.map((c) => c.label_ar).join(' ')
    speakFallback(text)
  }

  function removeSentenceCard(index) {
    setSentence((prev) => prev.filter((_, i) => i !== index))
  }

  function clearSentence() {
    window.speechSynthesis?.cancel()
    setSentence([])
    setMessage('')
  }

  function handleDragStart(event, index) {
    event.dataTransfer.setData('text/plain', String(index))
  }

  function handleDrop(event, targetIndex) {
    event.preventDefault()
    const sourceIndex = Number(event.dataTransfer.getData('text/plain'))
    if (Number.isNaN(sourceIndex) || sourceIndex === targetIndex) return
    setSentence((prev) => {
      const updated = [...prev]
      const [moved] = updated.splice(sourceIndex, 1)
      updated.splice(targetIndex, 0, moved)
      return updated
    })
  }

  async function saveSentence() {
    if (sentence.length === 0) return
    setSavingSentence(true)
    setMessage('')

    const prefix = mode === 'feeling' ? 'أشعر ' : 'أريد '
    const fullText = prefix + sentence.map((c) => c.label_ar).join(' ')

    const { error } = await supabase.from('sentences').insert({
      profile_id: profileId,
      card_ids: sentence.map((c) => c.id),
      full_text_ar: fullText,
    })

    setMessage(error ? 'حدث خطأ أثناء حفظ الجملة' : '✅ تم حفظ الجملة')
    setSavingSentence(false)
  }

  function switchMode(next) {
    setMode(next)
    setSentence([])
    setMessage('')
  }

  if (loading) return <div className="loading">...جاري التحميل</div>

  return (
    <div className="container">
      <h2>اضغط على الصورة للتحدث</h2>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <button onClick={() => navigate(`/sentence-builder/${profileId}`)} className="primary-btn">
          🧩 تركيب جملة
        </button>
        <button
          onClick={() => navigate(`/training/${profileId}`)}
          className="primary-btn"
          style={{ background: '#2a9d8f' }}
        >
          🎯 تدريب
        </button>
      </div>

      {/* فصل الطلب عن الشعور */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 20 }}>
        <button
          className="primary-btn"
          onClick={() => switchMode('request')}
          style={{
            background: mode === 'request' ? '#4361ee' : '#e0e7ff',
            color: mode === 'request' ? '#fff' : '#333',
            minWidth: 140,
            fontSize: 18,
          }}
        >
          🙋 أريد
        </button>
        <button
          className="primary-btn"
          onClick={() => switchMode('feeling')}
          style={{
            background: mode === 'feeling' ? '#e76f51' : '#ffedd5',
            color: mode === 'feeling' ? '#fff' : '#333',
            minWidth: 140,
            fontSize: 18,
          }}
        >
          💭 أشعر
        </button>
      </div>

      <p style={{ textAlign: 'center', color: '#666', marginBottom: 12, fontSize: 15 }}>
        {mode === 'request' ? 'وضع الطلب: اختر ما يريده الطفل' : 'وضع الشعور: اختر كيف يشعر الطفل'}
      </p>

      <div className="sentence-bar">
        {sentence.length === 0 && (
          <span style={{ color: '#aaa' }}>{mode === 'request' ? 'أريد ...' : 'أشعر ...'}</span>
        )}
        {sentence.length > 0 && (
          <span style={{ fontWeight: 'bold', marginLeft: 8, color: mode === 'feeling' ? '#e76f51' : '#4361ee' }}>
            {mode === 'feeling' ? 'أشعر' : 'أريد'}
          </span>
        )}
        {sentence.map((card, index) => (
          <div
            key={`\( {card.id}- \){index}`}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, index)}
            style={{
              position: 'relative',
              cursor: 'grab',
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              margin: 4,
            }}
          >
            <button
              onClick={() => removeSentenceCard(index)}
              style={{
                position: 'absolute',
                top: -8,
                right: -8,
                width: 25,
                height: 25,
                borderRadius: '50%',
                border: 'none',
                background: '#e63946',
                color: 'white',
                fontWeight: 'bold',
                cursor: 'pointer',
                zIndex: 2,
                padding: 0,
              }}
            >
              ×
            </button>
            <img src={card.image_url} alt={card.label_ar} style={{ width: 70, height: 70, objectFit: 'contain', borderRadius: 10 }} />
            <span style={{ fontSize: 13, marginTop: 3 }}>{card.label_ar}</span>
          </div>
        ))}
      </div>

      {sentence.length > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={playFullSentence} className="primary-btn">🔊 نطق الجملة</button>
          <button onClick={saveSentence} className="primary-btn" disabled={savingSentence}>
            {savingSentence ? '...جاري الحفظ' : '💾 حفظ الجملة'}
          </button>
          <button onClick={clearSentence} className="primary-btn" style={{ background: '#e63946' }}>🗑 مسح</button>
        </div>
      )}

      {message && (
        <p style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: 15 }}>{message}</p>
      )}

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

      <div className="cards-grid">
        {cards.map((card) => (
          <button key={card.id} className="card-item" onClick={() => handleCardPress(card)}>
            <img src={card.image_url} alt={card.label_ar} />
            <span className="card-label">{card.label_ar}</span>
          </button>
        ))}
        {cards.length === 0 && (
          <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#888' }}>
            {mode === 'feeling'
              ? 'لا توجد بطاقات مشاعر بعد. أضفها من الإدارة ونوعها "شعور".'
              : 'لا توجد بطاقات طلب في هذه الفئة بعد'}
          </p>
        )}
      </div>
    </div>
  )
}
