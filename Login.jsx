import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: authError } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    navigate('/profiles')
  }

  return (
    <div className="container">
      <h1>تطبيق التواصل بالصور</h1>
      <p>سجّل دخولك كأحد الوالدين أو المعالج</p>

      <form onSubmit={handleSubmit} style={{ maxWidth: 320, margin: '0 auto' }}>
        <input
          type="email"
          placeholder="البريد الإلكتروني"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: '100%', padding: 12, marginBottom: 10, borderRadius: 10, border: '1px solid #ccc' }}
        />
        <input
          type="password"
          placeholder="كلمة المرور"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ width: '100%', padding: 12, marginBottom: 10, borderRadius: 10, border: '1px solid #ccc' }}
        />

        {error && <p style={{ color: 'red' }}>{error}</p>}

        <button type="submit" className="primary-btn" disabled={loading} style={{ width: '100%' }}>
          {loading ? '...جاري التحميل' : isSignUp ? 'إنشاء حساب' : 'دخول'}
        </button>
      </form>

      <p style={{ marginTop: 16 }}>
        <button onClick={() => setIsSignUp(!isSignUp)} style={{ background: 'none', color: '#4361ee', textDecoration: 'underline' }}>
          {isSignUp ? 'عندي حساب بالفعل؟ دخول' : 'ما عندي حساب؟ إنشاء حساب جديد'}
        </button>
      </p>
    </div>
  )
}
