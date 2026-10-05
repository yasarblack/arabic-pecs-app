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
  const [successCount, setSuccessCount] = useState(0)

  // نستخدم refs عشان نتجنب مشاكل الـ stale state
  const cardsRef = useRef([])
  const profileRef = useRef(null)
  const lastCardIdRef = useRef(null)

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

    const maxDifficulty = profileData.level || 1

    const { data: cardsData } = await supabase
      .from('cards')
      .select('*')
      .lte('difficulty_level', maxDifficulty)
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
    if (!availableCards.length) return null

    let pool = availableCards
    if (excludeId && availableCards.length > 1) {
      pool = availableCards.filter(c => c.id !== excludeId)
    }

    return pool[Math.floor(Math.random() * pool.length)]
  }

  function startActivity(level, availableCards) {
    setMessage('')
    setSuccessCount(0)

    if (level <= 2) {
      const card = getRandomCard(availableCards, lastCardIdRef.current)
      if (card) {
        lastCardIdRef.current = card.id
        setCurrentCard(card)
        setOptions([])
        setTargetCard(null)
      }
    } else if (level === 3) {
      startDiscrimination(availableCards)
    } else {
      setCurrentCard(null)
      setOptions([])
      setTargetCard(null)
    }
  }

  function startDiscrimination(availableCards) {
    if (availableCards.length < 2) {
      setMessage('تحتاج بطاقات أكثر لهذا المستوى')
      return
    }

    // نتجنب تكرار نفس البطاقة الصحيحة مباشرة
    const correct = getRandomCard(availableCards, lastCardIdRef.current)
    if (!correct) return

    lastCardIdRef.current = correct.id
    setTargetCard(correct)

    // اختيار بطاقات خاطئة
    const others = availableCards
      .filter(c => c.id !== correct.id)
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.min(2, availableCards.length - 1))

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
    setSuccessCount(prev => prev + 1)

    // تسجيل التقدم
    await supabase.from('progress').upsert({
      profile_id: profileId,
      card_id: card.id,
      times_pressed: 1,
      mastered: true,
      last_pressed_at: new Date().toISOString()
    }, { onConflict: 'profile_id,card_id' })

    const currentLevel = profileRef.current?.level || 1

    // رفع المستوى بعد 5 نجاحات
    if (successCount + 1 >= 5 && currentLevel < 6) {
      const newLevel = currentLevel + 1
      await supabase
        .from('profiles')
        .update({ level: newLevel })
        .eq('id', profileId)

      const updatedProfile = { ...profileRef.current, level: newLevel }
      setProfile(updatedProfile)
      profileRef.current = updatedProfile
      setMessage(`رائع! انتقلت إلى المستوى ${newLevel} 🎉`)
    }

    // ننتظر شوية ثم نبدأ نشاط جديد باستخدام القيم الحديثة من الـ refs
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
        {
