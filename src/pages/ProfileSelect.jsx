import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function ProfileSelect() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    loadProfiles()
  }, [])

  async function loadProfiles() {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      navigate('/')
      return
    }

    const { data: adminRow } = await supabase
      .from('content_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    setIsAdmin(!!adminRow)

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('parent_id', user.id)

    if (!error) setProfiles(data || [])
    setLoading(false)
  }

  async function addProfile(e) {
    e.preventDefault()
    if (!newName.trim()) return

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      navigate('/')
      return
    }

    const { error } = await supabase
      .from('profiles')
      .insert({ parent_id: user.id, child_name: newName.trim() })

    if (!error) {
      setNewName('')
      loadProfiles()
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/')
  }

  if (loading) return <div className="loading">...جاري التحميل</div>

  return (
    <div className="container">
      <h2>اختر ملف الطفل</h2>

      {isAdmin && (
        <button
          onClick={() => navigate('/admin')}
          className="primary-btn admin-btn"
          style={{ marginBottom: 20 }}
        >
          ⚙️ إدارة البطاقات
        </button>
      )}

      <div className="profile-grid">
        {profiles.map((p) => (
          <div
            key={p.id}
            className="profile-card"
            onClick={() => navigate(`/board/${p.id}`)}
            style={{ cursor: 'pointer' }}
          >
            👦 {p.child_name}
          </div>
        ))}
      </div>

      <form onSubmit={addProfile} style={{ marginTop: 32, maxWidth: 320, margin: '32px auto 0' }}>
        <input
          type="text"
          placeholder="اسم الطفل"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid #ccc' }}
        />
        <button type="submit" className="primary-btn" style={{ width: '100%' }}>
          + إضافة ملف جديد
        </button>
      </form>

      <button
        onClick={handleLogout}
        style={{
          marginTop: 24,
          background: 'transparent',
          color: '#777',
          textDecoration: 'underline',
          fontSize: 15,
        }}
      >
        تسجيل الخروج
      </button>
    </div>
  )
}
