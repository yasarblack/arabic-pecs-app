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
      .order('created_at', { ascending: false })

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
      .insert({ 
        parent_id: user.id, 
        child_name: newName.trim(),
        level: 1
      })

    if (!error) {
      setNewName('')
      loadProfiles()
    }
  }

  async function deleteProfile(profileId, childName) {
    const confirmed = window.confirm(
      `هل أنت متأكد من حذف ملف "${childName}"؟\n\nسيتم حذف جميع بيانات التقدم والجمل المرتبطة به.`
    )

    if (!confirmed) return

    // حذف البيانات المرتبطة أولاً (اختياري لكنه أفضل)
    await supabase.from('progress').delete().eq('profile_id', profileId)
    await supabase.from('sentences').delete().eq('profile_id', profileId)

    // حذف الملف الشخصي
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', profileId)

    if (error) {
      alert('حدث خطأ أثناء الحذف: ' + error.message)
      return
    }

    // تحديث القائمة
    setProfiles(prev => prev.filter(p => p.id !== profileId))
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
          <div key={p.id} className="profile-card" style={{ position: 'relative' }}>
            
            {/* زر الحذف */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                deleteProfile(p.id, p.child_name)
              }}
              style={{
                position: 'absolute',
                top: 8,
                left: 8,
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: 'none',
                background: '#fee2e2',
                color: '#dc2626',
                fontSize: 16,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2
              }}
              title="حذف الملف"
            >
              🗑️
            </button>

            <div
              onClick={() => navigate(`/board/${p.id}`)}
              style={{ cursor: 'pointer', marginBottom: 12, paddingTop: 8 }}
            >
              👦 {p.child_name}
              <div style={{ fontSize: 14, color: '#666', marginTop: 6 }}>
                المستوى: {p.level || 1}
              </div>
            </div>

            <button
              className="primary-btn"
              style={{ width: '100%', padding: '10px', fontSize: 15, marginTop: 8 }}
              onClick={() => navigate(`/training/${p.id}`)}
            >
              🎯 بدء التدريب
            </button>
          </div>
        ))}
      </div>

      {profiles.length === 0 && (
        <p style={{ color: '#666', marginTop: 20 }}>
          لا يوجد أطفال بعد. أضف طفلاً جديداً من الأسفل.
        </p>
      )}

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
