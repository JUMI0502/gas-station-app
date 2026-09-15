import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const userEmails = {
  afrid: 'safrid0502@gmail.com',
  father: 'safrid093@gmail.com',
  uncle: 'safrid2811@gmail.com',
}

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [stations, setStations] = useState([])
  const [selectedStation, setSelectedStation] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setProfile(null)
      return
    }

    setLoadingProfile(true)
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        setLoadingProfile(false)
        if (error) {
          console.error('Failed to load profile:', error)
          return
        }
        setProfile(data)
      })
  }, [session])

  // Once we have a profile, fetch the stations this person can access
  useEffect(() => {
    if (!profile) return

    supabase
      .from('stations')
      .select('*')
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to load stations:', error)
          return
        }

        let visibleStations = data

        // Uncle only sees his assigned station
        if (profile.role === 'uncle') {
          visibleStations = data.filter((s) => s.id === profile.station_id)
        }

        setStations(visibleStations)
        setSelectedStation(visibleStations[0] || null)
      })
  }, [profile])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setStations([])
    setSelectedStation(null)
  }

  if (!session) {
    return <LoginForm />
  }

  if (loadingProfile || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-600">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-lg font-semibold">Hi, {profile.name}</h1>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 underline"
          >
            Log out
          </button>
        </div>

        {stations.length > 1 && (
          <div className="flex gap-2 mb-4">
            {stations.map((station) => (
              <button
                key={station.id}
                onClick={() => setSelectedStation(station)}
                className={`flex-1 text-sm py-2 rounded-lg border ${
                  selectedStation?.id === station.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'text-gray-600'
                }`}
              >
                {station.name}
              </button>
            ))}
          </div>
        )}

        {selectedStation ? (
          <div className="text-sm text-gray-700">
            <p className="font-medium mb-1">{selectedStation.name}</p>
            <p>{selectedStation.brand} · {selectedStation.location}</p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No station assigned.</p>
        )}
      </div>
    </div>
  )
}

function LoginForm() {
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const email = userEmails[name.toLowerCase()]

    if (!email) {
      setError('Unknown user.')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pin,
    })

    setLoading(false)

    if (error) {
      setError('Login failed. Check your name and PIN.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form
        onSubmit={handleLogin}
        className="bg-white p-8 rounded-2xl shadow-md w-80 flex flex-col gap-4"
      >
        <h1 className="text-xl font-semibold text-center">Gas Station Login</h1>

        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border rounded-lg px-3 py-2"
          required
        />

        <input
          type="password"
          placeholder="PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="border rounded-lg px-3 py-2"
          required
        />

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white rounded-lg py-2 font-medium"
        >
          {loading ? 'Logging in...' : 'Log in'}
        </button>
      </form>
    </div>
  )
}

export default App