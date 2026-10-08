import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cards-admin`

const CARD_TYPES = [
  { value: 'request', label: 'طلب (أريد)' },
  { value: 'feeling', label: 'شعور (أشعر)' },
  { value: 'comment', label: 'تعليق' },
]

export default function Admin() {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [categories, setCategories] = useState([])
  const [cards, setCards] = useState([])
  const [label, setLabel] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [difficulty, setDifficulty] = useState('1')
  const [cardType, setCardType] = useState('request')
  const [image, setImage] = useState(null)
  const [audio, setAudio] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    async function init() {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return

      setSession(data.session || null)

      if (data.session) {
        await loadCategories()
        await loadCards(data.session)
      }

      setLoading(false)
    }

    init()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return
      setSession(nextSession)
      if (!nextSession) {
        setCards([])
        setCategories([])
      }
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  async function getFreshSession() {
    const { data, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw new Error(sessionError.message)
    if (!data.session) {
      setSession(null)
      throw new Error('انتهت جلسة الدخول. يرجى تسجيل الدخول مرة أخرى.')
    }
    setSession(data.session)
    return data.session
  }

  async function loadCategories() {
    const { data, error: categoryError } = await supabase
      .from('categories')
      .select('id,name_ar,icon')
      .order('sort_order')

    if (categoryError) {
      setError(categoryError.message)
      return
    }

    setCategories(data || [])
    if (!categoryId && data?.length) {
      setCategoryId(data[0].id)
    }
  }

  async function loadCards(currentSession = null) {
    try {
      const freshSession = currentSession || (await getFreshSession())

      const response = await fetch(`${FUNCTION_URL}?api=list`, {
        headers: { Authorization: `Bearer ${freshSession.access_token}` },
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(result.error || 'تعذر تحميل البطاقات')
        return
      }

      const listed = result.cards || []
      const ids = listed.map((c) => c.id).filter(Boolean)

      if (ids.length) {
        const { data: typed } = await supabase
          .from('cards')
          .select('id, card_type')
          .in('id', ids)

        const typeMap = {}
        ;(typed || []).forEach((row) => {
          typeMap[row.id] = row.card_type || 'request'
        })

        setCards(
          listed.map((c) => ({
            ...c,
            card_type: typeMap[c.id] || c.card_type || 'request',
          })),
        )
      } else {
        setCards(listed)
      }
    } catch (err) {
      setError(err.message || 'تعذر تحميل البطاقات')
    }
  }

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setMessage('')

    const form = new FormData(e.currentTarget)
    const email = String(form.get('email') || '')
    const password = String(form.get('password') || '')

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
      return
    }

    const { data } = await supabase.auth.getSession()
    const newSession = data.session || null
    setSession(newSession)
    await loadCategories()
    if (newSession) await loadCards(newSession)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/')
  }

  async function handleAdd(e) {
    e.preventDefault()
    const formElement = e.currentTarget
    setError('')
    setMessage('')

    if (!session) return
    if (!label.trim() || !categoryId || !image) {
      setError('الاسم والتصنيف والصورة مطلوبة.')
      return
    }

    setSaving(true)
    const savedLabel = label.trim()
    const savedType = cardType

    try {
      const form = new FormData()
      form.append('label_ar', savedLabel)
      form.append('category_id', categoryId)
      form.append('difficulty_level', difficulty)
      form.append('card_type', savedType)
      form.append('image', image)
      if (audio) form.append('audio', audio)

      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'فشل إضافة البطاقة')

      // تحديث نوع البطاقة بعد الإضافة
      const newId = result.card?.id || result.id
      if (newId) {
        await supabase.from('cards').update({ card_type: savedType }).eq('id', newId)
      } else {
        const { data: recent } = await supabase
          .from('cards')
          .select('id')
          .eq('label_ar', savedLabel)
          .order('created_at', { ascending: false })
          .limit(1)

        if (recent?.[0]?.id) {
          await supabase
            .from('cards')
            .update({ card_type: savedType })
            .eq('id', recent[0].id)
        }
      }

      setLabel('')
      setDifficulty('1')
      setCardType('request')
      setImage(null)
      setAudio(null)
      formElement.reset()
      setMessage('تمت إضافة البطاقة بنجاح ❤️')
      await loadCards(session)
    } catch (err) {
      setError(err.message || 'حدث خطأ غير متوقع')
    } finally {
      setSaving(false)
    }
  }

  async function handleChangeType(cardId, newType) {
    setError('')
    setMessage('')

    const { error: updateError } = await supabase
      .from('cards')
      .update({ card_type: newType })
      .eq('id', cardId)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, card_type: newType } : c)),
    )
    setMessage('تم تحديث نوع البطاقة')
  }

  async function handleDelete(cardId) {
    if (!window.confirm('هل تريد حذف هذه البطاقة؟')) return

    setError('')
    setMessage('')

    try {
      const freshSession = await getFreshSession()
      const response = await fetch(`${FUNCTION_URL}?api=delete`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${freshSession.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: cardId }),
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'فشل حذف البطاقة')

      await loadCards()
      setMessage('تم حذف البطاقة.')
    } catch (err) {
      setError(err.message || 'حدث خطأ أثناء حذف البطاقة.')
    }
  }

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading">جاري التحميل…</div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="admin-page">
        <div className="admin-shell admin-login-card">
          <button className="admin-back" onClick={() => navigate('/')}>
            ← العودة
          </button>
          <div className="admin-header">
            <span className="admin-icon">🧩</span>
            <div>
              <h1>إدارة البطاقات</h1>
              <p>لوحة خاصة لإضافة محتوى تطبيق التواصل بالصور</p>
            </div>
          </div>
          <form onSubmit={handleLogin} className="admin-form">
            <label>
              البريد الإلكتروني
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              كلمة المرور
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            {error && <div className="admin-alert error">{error}</div>}
            <button className="admin-primary" type="submit">
              دخول
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-shell">
        <header className="admin-topbar">
          <div>
            <h1>إدارة بطاقات التواصل</h1>
            <p>أضيفي الصور والأصوات من هون مباشرة.</p>
          </div>
          <div className="admin-actions">
            <button className="admin-secondary" onClick={() => navigate('/profiles')}>
              لوحة الأطفال
            </button>
            <button className="admin-secondary" onClick={handleLogout}>
              خروج
            </button>
          </div>
        </header>

        <section className="admin-panel">
          <h2>➕ إضافة بطاقة جديدة</h2>
          <form onSubmit={handleAdd} className="admin-form">
            <div className="admin-row">
              <label>
                اسم البطاقة بالعربي
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="مثال: ماء"
                  required
                />
              </label>
              <label>
                الفئة
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.icon ? `${category.icon} ` : ''}
                      {category.name_ar}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="admin-row">
              <label>
                نوع البطاقة
                <select value={cardType} onChange={(e) => setCardType(e.target.value)}>
                  {CARD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                مستوى الصعوبة
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="admin-row">
              <label>
                الصورة
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImage(e.target.files?.[0] || null)}
                  required
                />
              </label>
              <label>
                الصوت العربي <span>(اختياري)</span>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => setAudio(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            {error && <div className="admin-alert error">{error}</div>}
            {message && <div className="admin-alert success">{message}</div>}

            <button className="admin-primary" type="submit" disabled={saving}>
              {saving ? 'جاري رفع البطاقة…' : 'إضافة البطاقة'}
            </button>
          </form>
        </section>

        <section className="admin-panel">
          <div className="admin-section-title">
            <div>
              <h2>📚 البطاقات الحالية</h2>
              <p>{cards.length} بطاقة</p>
            </div>
            <button className="admin-secondary" onClick={() => loadCards()}>
              تحديث
            </button>
          </div>

          {cards.length === 0 ? (
            <div className="admin-empty">ما في بطاقات بعد. أضيفي أول بطاقة من الأعلى.</div>
          ) : (
            <div className="admin-grid">
              {cards.map((card) => (
                <article className="admin-card" key={card.id}>
                  <img src={card.image_url} alt={card.label_ar} />
                  <div className="admin-card-body">
                    <h3>{card.label_ar}</h3>
                    <p>
                      {card.category_name || 'بدون فئة'} · صعوبة {card.difficulty_level ?? 1}
                    </p>

                    <label style={{ display: 'block', marginTop: 8, fontSize: 13 }}>
                      النوع
                      <select
                        value={card.card_type || 'request'}
                        onChange={(e) => handleChangeType(card.id, e.target.value)}
                        style={{ width: '100%', marginTop: 4 }}
                      >
                        {CARD_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    {card.audio_url && <audio controls src={card.audio_url} />}

                    <button className="admin-danger" onClick={() => handleDelete(card.id)}>
                      حذف البطاقة
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
