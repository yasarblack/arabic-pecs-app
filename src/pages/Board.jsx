import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function Board() {
  const { profileId } = useParams()

  const [categories, setCategories] = useState([])
  const [activeCategory, setActiveCategory] = useState(null)
  const [cards, setCards] = useState([])
  const [sentence, setSentence] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingSentence, setSavingSentence] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    if (activeCategory) {
      loadCards(activeCategory)
    }
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
      .order('created_at')

    if (!error) {
      setCards(data || [])
    }
  }

  function playCard(card) {
    if (card.audio_url) {
      const audio = new Audio(card.audio_url)

      audio.play().catch(() => {
        speakFallback(card.label_ar)
      })
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

    const text = sentence
      .map((card) => card.label_ar)
      .join(' ')

    speakFallback(text)
  }

  function removeSentenceCard(index) {
    setSentence((prev) =>
      prev.filter((_, i) => i !== index)
    )
  }

  function clearSentence() {
    window.speechSynthesis?.cancel()
    setSentence([])
    setMessage('')
  }

  function handleDragStart(event, index) {
    event.dataTransfer.setData(
      'text/plain',
      String(index)
    )
  }

  function handleDrop(event, targetIndex) {
    event.preventDefault()

    const sourceIndex = Number(
      event.dataTransfer.getData('text/plain')
    )

    if (Number.isNaN(sourceIndex)) return
    if (sourceIndex === targetIndex) return

    setSentence((prev) => {
      const updated = [...prev]
      const [movedCard] = updated.splice(sourceIndex, 1)

      updated.splice(targetIndex, 0, movedCard)

      return updated
    })
  }

  async function saveSentence() {
    if (sentence.length === 0) return

    setSavingSentence(true)
    setMessage('')

    const { error } = await supabase
      .from('sentences')
      .insert({
        profile_id: profileId,
        card_ids: sentence.map((card) => card.id),
        full_text_ar: sentence
          .map((card) => card.label_ar)
          .join(' '),
      })

    if (error) {
      setMessage('حدث خطأ أثناء حفظ الجملة')
    } else {
      setMessage('✅ تم حفظ الجملة')
    }

    setSavingSentence(false)
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
      <h2>اضغط على الصورة للتحدث</h2>

      {/* Sentence Builder */}
      <div className="sentence-bar">
        {sentence.length === 0 && (
          <span style={{ color: '#aaa' }}>
            اضغط على البطاقات لتكوين جملة...
          </span>
        )}

        {sentence.map((card, index) => (
          <div
            key={`${card.id}-${index}`}
            draggable
            onDragStart={(event) =>
              handleDragStart(event, index)
            }
            onDragOver={(event) =>
              event.preventDefault()
            }
            onDrop={(event) =>
              handleDrop(event, index)
            }
            style={{
              position: 'relative',
              cursor: 'grab',
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              margin: '4px',
            }}
          >
            <button
              onClick={() => removeSentenceCard(index)}
              aria-label="حذف البطاقة"
              style={{
                position: 'absolute',
                top: '-8px',
                right: '-8px',
                width: '25px',
                height: '25px',
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

            <img
              src={card.image_url}
              alt={card.label_ar}
              style={{
                width: '70px',
                height: '70px',
                objectFit: 'contain',
                borderRadius: '10px',
              }}
            />

            <span
              style={{
                fontSize: '13px',
                marginTop: '3px',
              }}
            >
              {card.label_ar}
            </span>
          </div>
        ))}
      </div>

      {/* Sentence controls */}
      {sentence.length > 0 && (
        <div
          style={{
            marginBottom: 16,
            display: 'flex',
            gap: 8,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={playFullSentence}
            className="primary-btn"
          >
            🔊 نطق الجملة
          </button>

          <button
            onClick={saveSentence}
            className="primary-btn"
            disabled={savingSentence}
          >
            {savingSentence
              ? '...جاري الحفظ'
              : '💾 حفظ الجملة'}
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

      {sentence.length > 1 && (
        <p
          style={{
            textAlign: 'center',
            color: '#777',
            fontSize: '14px',
            marginBottom: '12px',
          }}
        >
          ↔️ اسحب البطاقات لتغيير ترتيب الجملة
        </p>
      )}

      {message && (
        <p
          style={{
            textAlign: 'center',
            fontWeight: 'bold',
            marginBottom: '15px',
          }}
        >
          {message}
        </p>
      )}

      {/* Categories */}
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

      {/* Cards */}
      <div className="cards-grid">
        {cards.map((card) => (
          <button
            key={card.id}
            className="card-item"
            onClick={() => handleCardPress(card)}
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
            لا توجد بطاقات بهاي الفئة بعد
          </p>
        )}
      </div>
    </div>
  )
}
