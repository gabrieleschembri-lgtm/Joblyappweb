import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword } from 'firebase/auth'
import { collection, doc, getDoc, onSnapshot, orderBy, query, where } from 'firebase/firestore'

import './App.css'
import { auth, db } from './firebase'
import { groupChatItemsByCounterpart, mapChatDocToItem } from './chatHelpers'
import { getJobStartDate, isJobPast } from './jobTime'
import { getOrCreateChat, getOrCreatePairChat, markChatOpened, sendMessage, subscribeToMessages } from './chatApi'
import { authenticateProfile, getProfileByEmail } from './profileApi'

const JoblyContext = createContext(null)

const useJobly = () => {
  const ctx = useContext(JoblyContext)
  if (!ctx) throw new Error('useJobly must be used within JoblyProvider')
  return ctx
}

const JoblyProvider = ({ children }) => {
  const [uid, setUid] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const storageKeyRef = useRef('jobly.profile')

  useEffect(() => {
    let cancelled = false
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (cancelled) return
      if (!user) {
        try {
          const cred = await signInAnonymously(auth)
          setUid(cred.user.uid)
          console.log('[WEB_DEBUG] uid=', cred.user.uid)
        } catch (error) {
          console.error('[WEB_DEBUG] signIn error', error)
          setUid(null)
        } finally {
          setAuthReady(true)
        }
        return
      }
      setUid(user.uid)
      console.log('[WEB_DEBUG] uid=', user.uid)
      setAuthReady(true)
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  useEffect(() => {
    setProfileLoading(true)
    try {
      const raw = localStorage.getItem(storageKeyRef.current)
      if (raw) {
        const parsed = JSON.parse(raw)
        setProfile(parsed)
      } else {
        setProfile(null)
      }
    } catch (error) {
      console.warn('[WEB_DEBUG] failed to load profile', error)
      setProfile(null)
    } finally {
      setProfileLoading(false)
    }
  }, [])

  const login = useCallback(async (nextProfile) => {
    setProfile(nextProfile)
    localStorage.setItem(storageKeyRef.current, JSON.stringify(nextProfile))
  }, [])

  const logout = useCallback(async () => {
    setProfile(null)
    localStorage.removeItem(storageKeyRef.current)
  }, [])

  const value = useMemo(
    () => ({
      uid,
      authReady,
      profile,
      profileLoading,
      login,
      logout,
    }),
    [uid, authReady, profile, profileLoading, login, logout]
  )

  return <JoblyContext.Provider value={value}>{children}</JoblyContext.Provider>
}

const RequireProfile = ({ children }) => {
  const { profile, profileLoading } = useJobly()
  if (profileLoading) {
    return (
      <div className="screen">
        <div className="card centered">Caricamento profilo...</div>
      </div>
    )
  }
  if (!profile) {
    return <Navigate to="/" replace />
  }
  return children
}

const LandingScreen = () => {
  const navigate = useNavigate()
  const { uid, profile, profileLoading, login } = useJobly()
  const isDatore = profile?.role === 'datore'
  const isLavoratore = profile?.role === 'lavoratore'
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [nome, setNome] = useState('')
  const [cognome, setCognome] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSelect = (role) => {
    if (role === 'datore' && isDatore) navigate('/employer')
    if (role === 'lavoratore' && isLavoratore) navigate('/worker')
  }

  const isEmailLogin = /.+@.+\..+/.test(email.trim())
  const isLoginValid =
    password.trim().length > 0 &&
    (isEmailLogin || username.trim().length >= 3 || (nome.trim().length > 0 && cognome.trim().length > 0))

  const handleLogin = async () => {
    if (!isLoginValid || submitting) return
    setSubmitting(true)
    setError('')
    try {
      let resolvedProfile = null
      if (isEmailLogin) {
        await signInWithEmailAndPassword(auth, email.trim(), password)
        resolvedProfile = await getProfileByEmail(email.trim())
      } else {
        resolvedProfile = await authenticateProfile({
          nome: nome.trim(),
          cognome: cognome.trim(),
          username: username.trim(),
          password,
        })
      }
      await login(resolvedProfile)
    } catch (err) {
      const code = err?.code
      if (code === 'auth/profile-not-found') {
        setError('Profilo non trovato. Verifica i dati inseriti.')
      } else if (code === 'auth/invalid-password') {
        setError('Password errata. Riprova.')
      } else if (code === 'auth/invalid-input') {
        setError('Compila almeno username o nome e cognome.')
      } else {
        console.warn('[WEB_DEBUG] login error', err)
        setError('Accesso non riuscito. Riprova.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="screen">
      <div className="card">
        <div className="brand-row">
          <div className="brand-dot" />
          <div>
            <div className="brand-title">Jobly</div>
            <div className="subtitle">Accedi per continuare</div>
          </div>
        </div>
        {profileLoading ? (
          <div className="muted">Caricamento profilo...</div>
        ) : profile ? (
          <>
            <div className="muted">Profilo trovato: {profile.nome} {profile.cognome}</div>
            <div className="role-grid">
              <button
                className={`role-card ${isDatore ? 'active' : 'disabled'}`}
                onClick={() => handleSelect('datore')}
                disabled={!isDatore}
              >
                <div className="role-title">Datore</div>
                <div className="role-text">Gestisci incarichi e collaboratori.</div>
              </button>
              <button
                className={`role-card ${isLavoratore ? 'active' : 'disabled'}`}
                onClick={() => handleSelect('lavoratore')}
                disabled={!isLavoratore}
              >
                <div className="role-title">Lavoratore</div>
                <div className="role-text">Candidati e chatta con i datori.</div>
              </button>
            </div>
          </>
        ) : (
          <div className="form-card">
            <label className="label">Email (opzionale)</label>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@esempio.com" />

            <label className="label">Username (opzionale)</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="es. mario.rossi" />

            <label className="label">Nome</label>
            <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Inserisci il nome" />

            <label className="label">Cognome</label>
            <input className="input" value={cognome} onChange={(e) => setCognome(e.target.value)} placeholder="Inserisci il cognome" />

            <label className="label">Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Inserisci la password" />

            {error ? <div className="muted">{error}</div> : null}

            <button className={`login-button ${(!isLoginValid || submitting) ? 'button-disabled' : ''}`} onClick={handleLogin} disabled={!isLoginValid || submitting}>
              {submitting ? 'Accesso...' : 'Accedi'}
            </button>
          </div>
        )}
        {import.meta.env.DEV ? <div className="dev-box">UID: {uid || '-'}</div> : null}
      </div>
    </div>
  )
}

const EmployerHomeScreen = () => {
  const navigate = useNavigate()
  const { profile } = useJobly()
  const [jobs, setJobs] = useState([])
  const [jobsLoading, setJobsLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    setJobsLoading(true)
    const jobsRef = collection(db, 'jobs')
    const q = query(jobsRef, where('ownerProfileId', '==', profile.profileId), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        const mapped = snap.docs.map((docSnap) => {
          const data = docSnap.data() || {}
          return {
            id: docSnap.id,
            tipo: data.tipo || {},
            descrizione: data.descrizione || '',
            data: data.data || data.jobDate || '',
            oraInizio: data.oraInizio || data.jobStartTime || '',
            oraFine: data.oraFine || data.jobEndTime || '',
            indirizzo: data.indirizzo || {},
            compensoOrario: Number(data.compensoOrario || 0),
            applicants: Array.isArray(data.applicants) ? data.applicants : [],
            raw: data,
          }
        })
        const filtered = mapped.filter((job) => !isJobPast(job.raw))
        setJobs(filtered)
        setJobsLoading(false)
      },
      (error) => {
        console.warn('[WEB_DEBUG] jobs subscribe error', error)
        setJobs([])
        setJobsLoading(false)
      }
    )
    return () => unsub()
  }, [profile])

  const fullName = `${profile?.nome || ''} ${profile?.cognome || ''}`.trim()
  const nextJobLabel = useMemo(() => {
    const upcoming = jobs
      .map((job) => {
        const start = getJobStartDate(job.raw)
        return start ? { job, time: start.getTime() } : null
      })
      .filter(Boolean)
      .filter((entry) => entry.time >= Date.now())
      .sort((a, b) => a.time - b.time)
    const next = upcoming[0]?.job
    if (!next) return 'Nessun incarico imminente'
    const start = getJobStartDate(next.raw)
    if (!start) return 'Nessun incarico imminente'
    const date = start.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const time = start.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    return `${date} - ${time}`
  }, [jobs])

  return (
    <div className="screen">
      <div className="home-header">
        <div>
          <div className="greeting">Ciao {fullName || '-'}</div>
          <div className="subtitle">
            Benvenuto nella tua area Datore. Qui puoi gestire incarichi e collaboratori.
          </div>
        </div>
        <button className="icon-button" onClick={() => navigate('/chats')} aria-label="Vai ai messaggi">
          <ChatIcon />
        </button>
      </div>

      <div className="overview-card">
        <div>
          <div className="overview-label">Totale incarichi</div>
          <div className="overview-value">{jobs.length}</div>
        </div>
        <div className="overview-divider" />
        <div>
          <div className="overview-label">Prossimo incarico</div>
          <div className="overview-subvalue">{nextJobLabel}</div>
        </div>
      </div>

      <div className="action-card">
        <div className="action-icon">
          <BriefcaseIcon />
        </div>
        <div>
          <div className="action-title">Assunzioni</div>
          <div className="action-subtitle">Gestisci proposte e incarichi confermati.</div>
        </div>
      </div>

      <div className="card-grid">
        <div className="grid-card">
          <div className="grid-icon">
            <GroupIcon />
          </div>
          <div className="grid-title">Team</div>
          <div className="grid-text">Invita nuovi collaboratori e monitora le loro attivita.</div>
        </div>
        <div className="grid-card">
          <div className="grid-icon">
            <CheckIcon />
          </div>
          <div className="grid-title">Incarichi attivi</div>
          <div className="grid-text">Visualizza lo stato dei progetti e approva le richieste.</div>
        </div>
      </div>

      <div className="profile-summary">
        <div className="profile-icon">
          <PersonIcon />
        </div>
        <div>
          <div className="summary-label">Profilo</div>
          <div className="summary-value">{fullName || '-'}</div>
          <div className="summary-meta">Data di nascita: {profile?.dataNascita || '-'}</div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">I tuoi incarichi</div>
        {jobsLoading ? (
          <div className="card centered">Caricamento incarichi...</div>
        ) : jobs.length === 0 ? (
          <div className="empty-card">
            <div className="empty-title">Ancora nessun incarico</div>
            <div className="empty-subtitle">
              Crea un nuovo incarico dalla pagina principale per iniziare a organizzare le tue attivita.
            </div>
          </div>
        ) : (
          <div className="list">
            {jobs.map((job) => {
              const tipo = job.tipo?.categoria === 'altro'
                ? job.tipo?.altroDettaglio || 'Altro'
                : job.tipo?.categoria
                  ? `${job.tipo.categoria}`.charAt(0).toUpperCase() + job.tipo.categoria.slice(1)
                  : 'Incarico'
              const pay = job.compensoOrario > 0
                ? `EUR ${job.compensoOrario.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ora`
                : 'Compenso non specificato'
              const applicantsCount = Array.isArray(job.applicants) ? job.applicants.length : 0
              return (
                <Link className="list-card" to={`/jobs/${job.id}`} key={job.id}>
                  <div className="list-title">{tipo}</div>
                  <div className="list-subtitle">
                    {job.data} - {job.oraInizio} - {job.oraFine}
                  </div>
                  <div className="list-subtitle">
                    {job.indirizzo?.via || ''} {job.indirizzo?.civico || ''} {job.indirizzo?.citta || ''}
                    {' '}({job.indirizzo?.provincia || ''}) {job.indirizzo?.cap || ''}
                  </div>
                  <div className="list-subtitle">{pay}</div>
                  <div className="pill">Candidati: {applicantsCount}</div>
                  <div className="list-subtitle">{job.descrizione}</div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

const WorkerHomeScreen = () => {
  const navigate = useNavigate()
  const { profile } = useJobly()
  const [jobs, setJobs] = useState([])
  const [jobsLoading, setJobsLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    setJobsLoading(true)
    const jobsRef = collection(db, 'jobs')
    const q = query(jobsRef, orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        const mapped = snap.docs.map((docSnap) => {
          const data = docSnap.data() || {}
          return {
            id: docSnap.id,
            tipo: data.tipo || {},
            descrizione: data.descrizione || '',
            data: data.data || data.jobDate || '',
            oraInizio: data.oraInizio || data.jobStartTime || '',
            oraFine: data.oraFine || data.jobEndTime || '',
            indirizzo: data.indirizzo || {},
            compensoOrario: Number(data.compensoOrario || 0),
            raw: data,
          }
        })
        const filtered = mapped.filter((job) => !isJobPast(job.raw))
        setJobs(filtered)
        setJobsLoading(false)
      },
      (error) => {
        console.warn('[WEB_DEBUG] jobs subscribe error', error)
        setJobs([])
        setJobsLoading(false)
      }
    )
    return () => unsub()
  }, [profile])

  const fullName = `${profile?.nome || ''} ${profile?.cognome || ''}`.trim()

  return (
    <div className="screen">
      <div className="home-header">
        <div>
          <div className="greeting">Ciao {fullName || '-'}</div>
          <div className="subtitle">
            Benvenuto! Qui trovi un riepilogo dei tuoi prossimi incarichi e l'area per la mappa.
          </div>
        </div>
        <button className="icon-button" onClick={() => navigate('/chats')} aria-label="Vai ai messaggi">
          <ChatIcon />
        </button>
      </div>

      <div className="actions-row">
        <div className="action-chip">Proposte</div>
        <div className="action-chip">I miei incarichi</div>
      </div>

      <div className="section">
        <div className="section-title">Incarichi disponibili</div>
        {jobsLoading ? (
          <div className="card centered">Caricamento incarichi...</div>
        ) : jobs.length === 0 ? (
          <div className="empty-card">
            <div className="empty-title">Nessun incarico disponibile</div>
            <div className="empty-subtitle">Attendi nuove opportunita o aggiorna la tua disponibilita.</div>
          </div>
        ) : (
          <div className="list">
            {jobs.map((job) => {
              const tipo = job.tipo?.categoria === 'altro'
                ? job.tipo?.altroDettaglio || 'Altro'
                : job.tipo?.categoria
                  ? `${job.tipo.categoria}`.charAt(0).toUpperCase() + job.tipo.categoria.slice(1)
                  : 'Incarico'
              const pay = job.compensoOrario > 0
                ? `EUR ${job.compensoOrario.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ora`
                : 'Compenso non specificato'
              return (
                <Link className="list-card" to={`/jobs/${job.id}`} key={job.id}>
                  <div className="list-title">{tipo}</div>
                  <div className="list-subtitle">
                    {job.data} - {job.oraInizio} - {job.oraFine}
                  </div>
                  <div className="list-subtitle">
                    {job.indirizzo?.via || ''} {job.indirizzo?.civico || ''} {job.indirizzo?.citta || ''}
                    {' '}({job.indirizzo?.provincia || ''}) {job.indirizzo?.cap || ''}
                  </div>
                  <div className="list-subtitle">{pay}</div>
                  <div className="list-subtitle">{job.descrizione}</div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

const ChatListScreen = () => {
  const navigate = useNavigate()
  const { profile } = useJobly()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])

  useEffect(() => {
    if (!profile) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    let cancelled = false
    const chatsRef = collection(db, 'chats')
    const field = profile.role === 'datore' ? 'employerId' : 'workerId'
    const q = query(chatsRef, where(field, '==', profile.profileId), orderBy('updatedAt', 'desc'))
    const unsub = onSnapshot(
      q,
      async (snap) => {
        try {
          const mapped = await Promise.all(snap.docs.map((docSnap) => mapChatDocToItem(profile, docSnap)))
          if (!cancelled) {
            setItems(groupChatItemsByCounterpart(mapped))
          }
        } catch (error) {
          console.warn('[WEB_DEBUG] chat list mapping error', error)
          if (!cancelled) setItems([])
        } finally {
          if (!cancelled) setLoading(false)
        }
      },
      (error) => {
        console.warn('[WEB_DEBUG] chat list subscribe error', error)
        if (!cancelled) {
          setItems([])
          setLoading(false)
        }
      }
    )
    return () => {
      cancelled = true
      unsub()
    }
  }, [profile])

  const handleOpen = useCallback(
    async (item) => {
      if (!profile) return
      const employerId = profile.role === 'datore' ? profile.profileId : item.otherId
      const workerId = profile.role === 'lavoratore' ? profile.profileId : item.otherId
      if (!employerId || !workerId) return
      const chat = await getOrCreatePairChat(employerId, workerId)
      navigate(`/chats/${chat.id}`, { state: { otherName: item.otherName } })
    },
    [navigate, profile]
  )

  return (
    <div className="screen">
      <div className="header-row">
        <button className="back-button" onClick={() => navigate(-1)}>
          <BackIcon />
          Indietro
        </button>
        <h2>Chat</h2>
        <div className="header-spacer" />
      </div>

      {loading ? (
        <div className="card centered">Caricamento chat...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-title">
            {profile?.role === 'lavoratore' ? 'Nessuna conversazione' : 'Ancora nessuna conversazione'}
          </div>
          <div className="empty-subtitle">
            {profile?.role === 'lavoratore'
              ? 'Quando un datore ti contatta, vedrai qui i suoi messaggi.'
              : 'Scrivi o rispondi ai candidati per iniziare una chat.'}
          </div>
        </div>
      ) : (
        <div className="list">
          {items.map((item) => (
            <button className="list-card" type="button" key={item.otherId || item.id} onClick={() => handleOpen(item)}>
              <div className="list-row">
                <div className={`list-title ${item.isUnread ? 'unread' : ''}`}>{item.otherName}</div>
                {item.lastMessageAt ? (
                  <div className="list-time">
                    {item.lastMessageAt.toLocaleString('it-IT', {
                      hour: '2-digit',
                      minute: '2-digit',
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </div>
                ) : null}
              </div>
              <div className="list-row">
                <div className={`list-subtitle ${item.isUnread ? 'unread' : ''}`}>
                  {item.lastMessage || 'Nessun messaggio'}
                </div>
                {item.isUnread ? <span className="unread-dot" /> : null}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const ChatThreadScreen = () => {
  const { threadId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { profile } = useJobly()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [otherName, setOtherName] = useState('')

  useEffect(() => {
    if (!threadId || !profile) return
    const unsub = subscribeToMessages(threadId, (next) => {
      setMessages(next)
      setLoading(false)
    })
    return () => unsub()
  }, [threadId, profile])

  useEffect(() => {
    if (!threadId || !profile) return
    markChatOpened(threadId, profile.role)
  }, [threadId, profile])

  useEffect(() => {
    const stateName = location.state?.otherName
    if (typeof stateName === 'string' && stateName) {
      setOtherName(stateName)
      return
    }
    if (!threadId || !profile) return
    let cancelled = false
    const load = async () => {
      try {
        const chatSnap = await getDoc(doc(db, 'chats', threadId))
        const data = chatSnap.data() || {}
        const otherId = profile.role === 'datore' ? data.workerId : data.employerId
        if (!otherId) return
        const profileSnap = await getDoc(doc(db, 'profiles', otherId))
        const p = profileSnap.data() || {}
        const nome = typeof p.nome === 'string' ? p.nome : typeof p.name === 'string' ? p.name : ''
        const cognome = typeof p.cognome === 'string' ? p.cognome : typeof p.surname === 'string' ? p.surname : ''
        const full = `${nome} ${cognome}`.trim()
        if (!cancelled) setOtherName(full || otherId)
      } catch (error) {
        console.warn('[WEB_DEBUG] chat header error', error)
      }
    }
    load()
    return () => { cancelled = true }
  }, [location.state, profile, threadId])

  const handleSend = async () => {
    if (!threadId || !profile) return
    try {
      await sendMessage(threadId, profile.profileId, text)
      setText('')
    } catch (error) {
      console.warn('[WEB_DEBUG] send message error', error)
    }
  }

  return (
    <div className="screen">
      <div className="header-row">
        <button className="back-button" onClick={() => navigate(-1)}>
          <BackIcon />
          Indietro
        </button>
        <h2>{otherName || 'Chat'}</h2>
        <div className="header-spacer" />
      </div>

      <div className="chat-thread">
        {loading ? (
          <div className="card centered">Caricamento messaggi...</div>
        ) : messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-title">Nessun messaggio</div>
            <div className="empty-subtitle">Inizia a scrivere per aprire la conversazione.</div>
          </div>
        ) : (
          <div className="message-list">
            {messages.map((msg) => {
              const isMine = msg.senderId === profile?.profileId
              return (
                <div key={msg.id} className={`message ${isMine ? 'mine' : 'theirs'}`}>
                  <div className="message-text">{msg.text}</div>
                  {msg.createdAt ? (
                    <div className="message-time">
                      {msg.createdAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="chat-input">
        <input
          type="text"
          value={text}
          placeholder="Scrivi un messaggio"
          onChange={(event) => setText(event.target.value)}
        />
        <button type="button" onClick={handleSend} disabled={!text.trim()}>
          Invia
        </button>
      </div>
    </div>
  )
}

const JobDetailsScreen = () => {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const { profile } = useJobly()
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [candidates, setCandidates] = useState([])

  useEffect(() => {
    if (!jobId) return
    const ref = doc(db, 'jobs', jobId)
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setJob(null)
          setLoading(false)
          return
        }
        const data = snap.data() || {}
        setJob({
          id: snap.id,
          data,
          title: data?.tipo?.categoria === 'altro'
            ? data?.tipo?.altroDettaglio || 'Altro'
            : typeof data?.tipo?.categoria === 'string'
              ? data.tipo.categoria.charAt(0).toUpperCase() + data.tipo.categoria.slice(1)
              : 'Incarico',
        })
        setLoading(false)
      },
      (error) => {
        console.warn('[WEB_DEBUG] job details error', error)
        setJob(null)
        setLoading(false)
      }
    )
    return () => unsub()
  }, [jobId])

  useEffect(() => {
    if (!job || !profile || profile.role !== 'datore') {
      setCandidates([])
      return
    }
    let cancelled = false
    const loadCandidates = async () => {
      const ids = Array.isArray(job.data?.applicants) ? job.data.applicants : []
      if (ids.length === 0) {
        setCandidates([])
        return
      }
      const result = []
      for (const id of ids) {
        try {
          const profileSnap = await getDoc(doc(db, 'profiles', id))
          if (!profileSnap.exists()) continue
          const pdata = profileSnap.data() || {}
          const nome = pdata.nome || pdata.name || ''
          const cognome = pdata.cognome || pdata.surname || ''
          result.push({
            id,
            nome,
            cognome,
          })
        } catch {
          // ignore
        }
      }
      if (!cancelled) setCandidates(result)
    }
    loadCandidates()
    return () => { cancelled = true }
  }, [job, profile])

  const handleOpenChat = async (otherProfileId) => {
    if (!profile || !jobId) return
    const employerId = profile.role === 'datore' ? profile.profileId : job?.data?.ownerProfileId
    const workerId = profile.role === 'lavoratore' ? profile.profileId : otherProfileId
    if (!employerId || !workerId) return
    const chat = await getOrCreateChat(jobId, employerId, workerId)
    navigate(`/chats/${chat.id}`, { state: { otherName: '' } })
  }

  if (loading) {
    return (
      <div className="screen">
        <div className="card centered">Caricamento incarico...</div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="screen">
        <div className="card centered">Incarico non trovato.</div>
      </div>
    )
  }

  const pay = job.data?.compensoOrario
    ? `EUR ${Number(job.data.compensoOrario).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ora`
    : 'Compenso non specificato'

  return (
    <div className="screen">
      <div className="header-row">
        <button className="back-button" onClick={() => navigate(-1)}>
          <BackIcon />
          Indietro
        </button>
        <h2>{job.title}</h2>
        <div className="header-spacer" />
      </div>

      <div className="card">
        <div className="list-title">{job.title}</div>
        <div className="list-subtitle">
          {job.data?.data || job.data?.jobDate || ''} - {job.data?.oraInizio || job.data?.jobStartTime || ''} - {job.data?.oraFine || job.data?.jobEndTime || ''}
        </div>
        <div className="list-subtitle">
          {job.data?.indirizzo?.via || ''} {job.data?.indirizzo?.civico || ''} {job.data?.indirizzo?.citta || ''}
          {' '}({job.data?.indirizzo?.provincia || ''}) {job.data?.indirizzo?.cap || ''}
        </div>
        <div className="list-subtitle">{pay}</div>
        <div className="list-subtitle">{job.data?.descrizione || ''}</div>
      </div>

      {profile?.role === 'datore' ? (
        <div className="section">
          <div className="section-title">Candidati</div>
          {candidates.length === 0 ? (
            <div className="empty-card">
              <div className="empty-title">Nessun candidato</div>
              <div className="empty-subtitle">Quando qualcuno si candida, lo vedrai qui.</div>
            </div>
          ) : (
            <div className="list">
              {candidates.map((candidate) => (
                <div className="list-card" key={candidate.id}>
                  <div className="list-title">{candidate.nome} {candidate.cognome}</div>
                  <button type="button" className="primary" onClick={() => handleOpenChat(candidate.id)}>
                    Chat
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="card">
          <button type="button" className="primary" onClick={() => handleOpenChat(profile?.profileId)}>
            Chatta con il datore
          </button>
        </div>
      )}
    </div>
  )
}

const HireNotificationBanner = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { profile, uid } = useJobly()
  const [banner, setBanner] = useState(null)
  const lastSeenRef = useRef(new Map())
  const lastNotifiedRef = useRef(null)
  const timerRef = useRef(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (!profile || profile.role !== 'lavoratore' || !uid) {
      setBanner(null)
      lastSeenRef.current = new Map()
      lastNotifiedRef.current = null
      initializedRef.current = false
      return
    }

    const q = query(
      collection(db, 'hires'),
      where('workerUid', '==', uid),
      where('status', '==', 'proposed'),
      orderBy('updatedAt', 'desc')
    )

    const unsub = onSnapshot(
      q,
      async (snap) => {
        const isOnChats = location.pathname.startsWith('/chats')
        const isOnProposals = location.pathname.startsWith('/proposte')
        if (isOnChats || isOnProposals) return

        let latest = null
        const nextSeen = new Map(lastSeenRef.current)

        if (!initializedRef.current) {
          snap.docs.forEach((docSnap) => {
            const data = docSnap.data() || {}
            const ts = data.updatedAt?.toDate?.() || data.createdAt?.toDate?.() || null
            if (ts instanceof Date) {
              nextSeen.set(docSnap.id, ts.getTime())
            }
          })
          lastSeenRef.current = nextSeen
          initializedRef.current = true
          return
        }

        for (const docSnap of snap.docs) {
          const data = docSnap.data() || {}
          const ts = data.updatedAt?.toDate?.() || data.createdAt?.toDate?.() || null
          const time = ts instanceof Date ? ts.getTime() : 0
          const prev = lastSeenRef.current.get(docSnap.id) || 0
          nextSeen.set(docSnap.id, time)
          if (time <= prev) continue

          let employerName = 'Un datore'
          if (data.employerProfileId) {
            try {
              const profSnap = await getDoc(doc(db, 'profiles', data.employerProfileId))
              const pdata = profSnap.data() || {}
              const nome = pdata.nome || pdata.name || ''
              const cognome = pdata.cognome || pdata.surname || ''
              const full = `${nome} ${cognome}`.trim()
              if (full) employerName = full
            } catch {
              // ignore
            }
          }

          latest = { hireId: docSnap.id, employerName }
        }

        lastSeenRef.current = nextSeen

        if (latest && latest.hireId !== lastNotifiedRef.current) {
          if (timerRef.current) clearTimeout(timerRef.current)
          setBanner(latest)
          lastNotifiedRef.current = latest.hireId
          if (navigator.vibrate) navigator.vibrate(200)
          timerRef.current = setTimeout(() => setBanner(null), 3000)
        }
      },
      (error) => {
        console.warn('[WEB_DEBUG] hire notifications error', error)
      }
    )

    return () => {
      unsub()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [profile, location.pathname])

  if (!banner) return null

  return (
    <div className="hire-banner" role="button" onClick={() => navigate('/worker')}>
      <div className="hire-banner-title">{banner.employerName} ti ha scelto per un incarico</div>
      <div className="hire-banner-subtitle">Apri le proposte per rispondere.</div>
    </div>
  )
}

const AppRoutes = () => {
  return (
    <div className="app-shell">
      <HireNotificationBanner />
      <Routes>
        <Route path="/" element={<LandingScreen />} />
        <Route
          path="/employer"
          element={
            <RequireProfile>
              <RoleGuard role="datore">
                <EmployerHomeScreen />
              </RoleGuard>
            </RequireProfile>
          }
        />
        <Route
          path="/worker"
          element={
            <RequireProfile>
              <RoleGuard role="lavoratore">
                <WorkerHomeScreen />
              </RoleGuard>
            </RequireProfile>
          }
        />
        <Route
          path="/chats"
          element={
            <RequireProfile>
              <ChatListScreen />
            </RequireProfile>
          }
        />
        <Route
          path="/chats/:threadId"
          element={
            <RequireProfile>
              <ChatThreadScreen />
            </RequireProfile>
          }
        />
        <Route
          path="/jobs/:jobId"
          element={
            <RequireProfile>
              <JobDetailsScreen />
            </RequireProfile>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

const RoleGuard = ({ role, children }) => {
  const { profile } = useJobly()
  if (!profile) return null
  if (profile.role !== role) {
    return <Navigate to={profile.role === 'datore' ? '/employer' : '/worker'} replace />
  }
  return children
}

const App = () => (
  <BrowserRouter>
    <JoblyProvider>
      <AppRoutes />
    </JoblyProvider>
  </BrowserRouter>
)

export default App

const ChatIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="icon-svg">
    <path
      d="M7 9h10M7 13h6M4 12a7 7 0 1 1 3 6.48L4 20l1.52-3.04A7 7 0 0 1 4 12Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const BackIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="icon-svg">
    <path
      d="m15 6-6 6 6 6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const BriefcaseIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="icon-svg">
    <path
      d="M8 7V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1M4 9h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const GroupIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="icon-svg">
    <path
      d="M8 11a3 3 0 1 0-0.001-6.001A3 3 0 0 0 8 11Zm8 0a3 3 0 1 0-0.001-6.001A3 3 0 0 0 16 11ZM4 19a4 4 0 0 1 8 0M12 19a4 4 0 0 1 8 0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="icon-svg">
    <path
      d="m6 12 4 4 8-8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const PersonIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="icon-svg">
    <path
      d="M12 12a4 4 0 1 0-0.001-8.001A4 4 0 0 0 12 12Zm-7 8a7 7 0 0 1 14 0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)
