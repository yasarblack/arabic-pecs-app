import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function Training() {
  const { profileId } = useParams()
  const navigate = useNavigate()

  const [profile, setProfile] = useState(null)
  const [cards, setCards] = useState([])
  const [currentCard, setCurrentCard] = useState(null)
  const [options, setOptions] = useState([])
  const [targetCard, setTargetCard] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  // نستخدم refs لتتبع التقدم بشكل موثوق
  const cardsRef = useRef([])
  const profileRef = useRef(null)
  const lastCardIdRef = useRef(null)
  const successCountRef = useRef(0) // ← مهم: نتتبع النجاح هنا

  useEffect(() => {
    loadData()
  }, [profileId])

  async function loadData() {
    setLoading(true)

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .single()

    if (!profileData) {
      navigate('/profiles')
      return
    }

    setProfile(profileData)
    profileRef.current = profileData

    const maxDifficulty = Math.max(profileData.level || 1, 1)

    const { data: cardsData } = await supabase
      .from('cards')
      .select('*')
      .lte('difficulty_level', maxDifficulty + 1) // نجيب شوية بطاقات إضافية
      .order('difficulty_level')

    const safeCards = cardsData || []
    setCards(safeCards)
    cardsRef.current = safeCards
    setLoading(false)

    if (safeCards.length) {
      startActivity(profileData.level || 1, safeCards)
    }
  }

  function getRandomCard(availableCards, excludeId = null) {
    if (!availableCards?.length) return null
    let pool = availableCards
    if (excludeId && availableCards.length > 1) {
      pool = availableCards.filter(c => c.id !== excludeId)
    }
    return pool[Math.floor(Math.random() * pool.length)]
  }

  function startActivity(level, availableCards) {
    setMessage('')

    if (level <= 1) {
      // المستوى 1: بطاقة واحدة + لازم يسمع الاسم أولاً (أكثر تحدياً)
      const card = getRandomCard(availableCards, lastCardIdRef.current)
      if (card) {
        lastCardIdRef.current = card.id
        setCurrentCard(card)
        setOptions([])
        setTargetCard(null)
      }
    } else if (level === 2) {
      // المستوى 2: تمييز بسيط (بطاقتين)
      startDiscrimination(availableCards, 1) // بطاقة خاطئة واحدة
    } else if (level === 3) {
      // المستوى 3: تمييز أقوى (3 بطاقات)
      startDiscrimination(availableCards, 2)
    } else {
      // المستوى 4+
      setCurrentCard(null)
      setOptions([])
      setTargetCard(null)
    }
  }

  function startDiscrimination(availableCards, wrongCount = 2) {
    if (availableCards.length < 2) {
      setMessage('تحتاج بطاقات أكثر لهذا المستوى')
      return
    }

    const correct = getRandomCard(availableCards, lastCardIdRef.current)
    if (!correct) return

    lastCardIdRef.current = correct.id
    setTargetCard(correct)

    const others = availableCards
      .filter(c => c.id !== correct.id)
      .sort(() => 0.5 - Math.random())
      .slice(0, wrongCount)

    const mixed = [correct, ...others].sort(() => 0.5 - Math.random())
    setOptions(mixed)
    setCurrentCard(null)
  }

  function playAudio(card) {
    if (!card) return
    if (card.audio_url) {
      const audio = new Audio(card.audio_url)
      audio.play().catch(() => speak(card.label_ar))
    } else {
      speak(card.label_ar)
    }
  }

  function speak(text) {
    if (!('speechSynthesis' in window) || !text) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'ar-SA'
    utter.rate = 0.85
    window.speechSynthesis.speak(utter)
  }

  async function handleSuccess(card) {
    if (!card) return

    setMessage('ممتاز! أحسنت 👏')
    playAudio(card)

    // زيادة عدد النجاحات بشكل موثوق
    successCountRef.current += 1
    const currentSuccesses = successCountRef.current

    // تسجيل التقدم
    await supabase.from('progress').upsert({
      profile_id: profileId,
      card_id: card.id,
      times_pressed: 1,
      mastered: true,
      last_pressed_at: new Date().toISOString()
    }, { onConflict: 'profile_id,card_id' })

    const currentLevel = profileRef.current?.level || 1

    // شرط الانتقال للمستوى التالي (5 نجاحات)
    if (currentSuccesses >= 5 && currentLevel < 6) {
      const newLevel = currentLevel + 1

      await supabase
        .from('profiles')
        .update({ level: newLevel })
        .eq('id', profileId)

      const updatedProfile = { ...profileRef.current, level: newLevel }
      setProfile(updatedProfile)
      profileRef.current = updatedProfile

      successCountRef.current = 0 // نبدأ عداد جديد للمستوى الجديد
      setMessage(`رائع! انتقلت إلى المستوى ${newLevel} 🎉`)
    }

    // ننتظر ثم نبدأ نشاط جديد
    setTimeout(() => {
      const latestCards = cardsRef.current
      const latestLevel = profileRef.current?.level || 1
      startActivity(latestLevel, latestCards)
    }, 1600)
  }

  function handleWrong() {
    setMessage('حاول مرة أخرى 💪')
    speak('حاول مرة أخرى')
  }

  if (loading) {
    return <div className="loading">...جاري تحميل وضع التدريب</div>
  }

  if (!profile) return null

  return (
    <div className="container">
      <button
        onClick={() => navigate(`/board/${profileId}`)}
        style={{ background: 'transparent', color: '#4361ee', marginBottom: 12 }}
      >
        ← العودة إلى اللوحة
      </button>

      <h2>🎯 وضع التدريب</h2>
      <p style={{ fontSize: 18, marginBottom: 8 }}>
        {profile.child_name} — المستوى الحالي: <strong>{profile.level || 1}</strong>
      </p>
      <p style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>
        النجاحات الحالية: {successCountRef.current} / 5
      </p>

      {message && (
        <div style={{
          background: message.includes('ممتاز') || message.includes('رائع') ? '#d8f3dc' : '#fff3cd',
          padding: '12px 20px',
          borderRadius: 16,
          marginBottom: 20,
          fontWeight: 'bold',
          fontSize: 18
        }}>
          {message}
        </div>
      )}

      {/* المستوى 1: بطاقة واحدة + يجب سماع الاسم أولاً */}
      {currentCard && (
        <div style={{ marginTop: 30 }}>
          <p style={{ fontSize: 20, marginBottom: 12 }}>استمع ثم اضغط على الصورة:</p>
          
          <button
            onClick={() => playAudio(currentCard)}
            className="primary-btn"
            style={{ marginBottom: 20 }}
          >
            🔊 اسمع الاسم
          </button>

          <button
            className="card-item"
            style={{ maxWidth: 220, margin: '0 auto', display: 'block' }}
            onClick={() => handleSuccess(currentCard)}
          >
            <img src={currentCard.image_url} alt={currentCard.label_ar} />
            <span className="card-label">{currentCard.label_ar}</span>
          </button>
        </div>
      )}

      {/* المستوى 2 و 3: تمييز */}
      {options.length > 0 && targetCard && (
        <div style={{ marginTop: 30 }}>
          <p style={{ fontSize: 20, marginBottom: 8 }}>
            أين صورة <strong>{targetCard.label_ar}</strong>؟
          </p>
          <button
            onClick={() => playAudio(targetCard)}
            className="primary-btn"
            style={{ marginBottom: 20 }}
          >
            🔊 اسمع الاسم
          </button>

          <div className="cards-grid" style={{ maxWidth: 500, margin: '0 auto' }}>
            {options.map(card => (
              <button
                key={card.id}
                className="card-item"
                onClick={() => {
                  if (card.id === targetCard.id) {
                    handleSuccess(card)
                  } else {
                    handleWrong()
                  }
                }}
              >
                <img src={card.image_url} alt={card.label_ar} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* المستوى 4+ */}
      {(profile.level || 1) >= 4 && !currentCard && options.length === 0 && (
        <div style={{ marginTop: 40 }}>
          <p style={{ fontSize: 18 }}>
            أنت في مستوى بناء الجمل.<br />
            انتقل إلى صفحة تركيب الجملة للتدريب.
          </p>
          <button
            className="primary-btn"
            onClick={() => navigate(`/sentence-builder/${profileId}`)}
            style={{ marginTop: 16 }}
          >
            🧩 الذهاب لتركيب الجملة
          </button>
        </div>
      )}

      <div style={{ marginTop: 40 }}>
        <button
          className="primary-btn"
          style={{ background: '#2a9d8f' }}
          onClick={() => {
            successCountRef.current = 0
            startActivity(profile.level || 1, cards)
          }}
        >
          🔄 نشاط جديد
        </button>
      </div>
    </div>
  )
}
