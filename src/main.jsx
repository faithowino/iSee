import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  Heart,
  Menu,
  MessageCircle,
  MoreVertical,
  Plus,
  Search,
  Send,
  X,
} from 'lucide-react';
import './styles.css';

const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
}).format(new Date());
const fallbackLocations = [
  'CC', 'Terraces', 'CNS', 'CHS', 'Gym', 'Towers', 'Circles',
  'Upper Quads', 'Lower Quads', 'Gardens', 'Emerson', 'On Campus',
  'Williams', 'Friends', 'Textor', 'Smiddy', 'Park Com', 'Park Bus',
  'Ceracche', 'Hill',
];

const formatDate = (date) => new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'America/New_York',
}).format(new Date(`${date}T12:00:00`));

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function Modal({ title, children, onClose, wide = false }) {
  return (
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={`modal ${wide ? 'wide' : ''}`}>
        <button className="close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>
  );
}

function Header({ user, navigate, setModal, logout }) {
  return (
    <header className="top">
      <button className="brand" onClick={() => navigate('board')} aria-label="Go to board">
        <b>iSee</b>
        <span>Missed Connections</span>
      </button>

      <nav>
        <button onClick={() => navigate('rules')}>Board Rules</button>
        <button onClick={() => navigate('faq')}>FAQ</button>
      </nav>

      <div className="actions">
        <button className="outline" onClick={() => setModal('search')}>
          <Search size={15} />
          <span>Search</span>
        </button>
        <button className="outline desktop" onClick={user ? logout : () => setModal('auth')}>
          {user ? `@${user.username}` : 'Sign Up / Log In'}
        </button>
        <button className="primary desktop" onClick={() => setModal('create')}>
          <Plus size={16} /> Create a Missed Connection
        </button>
        <button className="menu" onClick={() => setModal('search')} aria-label="Open menu">
          <Menu size={20} />
        </button>
      </div>
    </header>
  );
}

function Auth({ close, setUser, afterAuth, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      if (mode === 'signup') {
        const data = await api('/api/auth/signup', {
          method: 'POST',
          body: JSON.stringify({ username, password, email }),
        });
        setUser(data.user);
        await afterAuth?.(data.user);
        close();
      } else if (mode === 'login') {
        const data = await api('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username, password }),
        });
        setUser(data.user);
        close();
      } else if (!sent) {
        await api('/api/auth/request-otp', {
          method: 'POST',
          body: JSON.stringify({ username }),
        });
        setSent(true);
      } else {
        const data = await api('/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ username, otp, password }),
        });
        setUser(data.user);
        close();
      }
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal
      title={mode === 'signup' ? 'Create your account' : mode === 'recover' ? 'Recover your account' : 'Welcome back'}
      onClose={close}
    >
      <form className="form" onSubmit={submit}>
        <label>
          Username
          <input required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="3–30 characters" />
        </label>

        {mode === 'signup' && (
          <label>
            Email <small>(optional)</small>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="For account recovery" />
          </label>
        )}

        {mode === 'recover' && sent && (
          <label>
            OTP code
            <input required value={otp} onChange={(e) => setOtp(e.target.value)} maxLength="6" inputMode="numeric" />
          </label>
        )}

        <label>
          {mode === 'recover' && sent ? 'New password' : 'Password'}
          <input required type="password" minLength="8" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
        </label>

        {error && <div className="error">{error}</div>}

        <button className="primary-wide">
          {mode === 'signup' ? 'Create Account' : mode === 'login' ? 'Log In' : sent ? 'Reset Password' : 'Send OTP'}
        </button>
      </form>

      <div className="auth-links">
        {mode === 'login' ? (
          <>
            <button onClick={() => setMode('signup')}>Create an account</button>
            <button onClick={() => setMode('recover')}>Forgot password?</button>
          </>
        ) : (
          <button onClick={() => { setMode('login'); setSent(false); }}>Back to login</button>
        )}
      </div>

      {mode === 'signup' && (
        <p className="muted">Email is optional. Without an email, a forgotten password cannot be recovered.</p>
      )}
    </Modal>
  );
}

function Create({ close, locations, user, setModal, reload, setPendingPost }) {
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(today);
  const [time, setTime] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);

  async function post() {
    setError('');
    try {
      await api('/api/posts', {
        method: 'POST',
        body: JSON.stringify({ location, date, time, content: text }),
      });
      await reload();
      close();
    } catch (err) {
      setError(err.message);
    }
  }

  if (confirm) {
    return (
      <Modal title="Save your post?" onClose={close}>
        <p className="choice-text">
          Would you like to create an account to save this post, edit or delete it later, and see your post history?
        </p>
        <button className="primary-wide" onClick={() => { setPendingPost({ location, date, time, content: text }); close(); setModal('auth'); }}>
          Sign Up &amp; Save
        </button>
        <button className="secondary-wide" onClick={post}>Submit Anonymously</button>
      </Modal>
    );
  }

  return (
    <Modal title="Create a Missed Connection" onClose={close}>
      {!user && (
        <div className="notice">
          You can post anonymously. Before submitting, we&apos;ll give you the option to save it to an account.
        </div>
      )}

      <form
        className="form"
        onSubmit={(event) => {
          event.preventDefault();
          user ? post() : setConfirm(true);
        }}
      >
        <label>
          Where did you see them?
          <select required value={location} onChange={(e) => setLocation(e.target.value)}>
            <option value="">Choose a campus location…</option>
            {locations.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>

        <div className="two">
          <label>
            When?
            <input required type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            Approx. time
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>

        <label>
          What happened?
          <textarea required minLength="10" maxLength="500" value={text} onChange={(e) => setText(e.target.value)} placeholder="Tell us about the moment…" />
        </label>

        <div className="counter">{text.length}/500</div>
        {error && <div className="error">{error}</div>}
        <button className="primary-wide">Continue</button>
      </form>
    </Modal>
  );
}

function Report({ id, close }) {
  const [reason, setReason] = useState('Inappropriate content');
  const [details, setDetails] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function send(event) {
    event.preventDefault();
    try {
      await api('/api/report', {
        method: 'POST',
        body: JSON.stringify({ type: 'post', id, reason, details }),
      });
      setDone(true);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal title="Report this post" onClose={close}>
      {done ? (
        <>
          <div className="success">Thanks. Your report has been submitted for review.</div>
          <button className="primary-wide" onClick={close}>Done</button>
        </>
      ) : (
        <form className="form" onSubmit={send}>
          <label>
            Reason
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              <option>Inappropriate content</option>
              <option>Personal information</option>
              <option>Harassment</option>
              <option>Threat or violence</option>
              <option>Spam</option>
              <option>Other</option>
            </select>
          </label>
          <label>
            Details <small>(optional)</small>
            <textarea maxLength="500" value={details} onChange={(e) => setDetails(e.target.value)} />
          </label>
          {error && <div className="error">{error}</div>}
          <button className="primary-wide"><Flag size={15} /> Submit Report</button>
        </form>
      )}
    </Modal>
  );
}

function Post({ id, close, reload }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('connect');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [reportOpen, setReportOpen] = useState(false);

  async function load() {
    try {
      setData(await api(`/api/posts/${id}`));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function add(type) {
    try {
      await api(`/api/posts/${id}/${type}`, {
        method: 'POST',
        body: JSON.stringify({ content: text }),
      });
      setText('');
      await load();
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!data) {
    return <Modal title="Missed Connection" onClose={close}><p>{error || 'Loading…'}</p></Modal>;
  }

  return (
    <>
      {reportOpen && <Report id={id} close={() => setReportOpen(false)} />}
      <Modal wide onClose={close}>
        <button className="modal-back" onClick={close}>
          <ChevronLeft size={16} /> Back to Board
        </button>

        <div className="detail-head">
          <div>
            <span className="location">⌖ {data.post.location}</span>
            <span className="time">{data.post.time}</span>
          </div>
          <button className="dots" onClick={() => setReportOpen(true)} aria-label="Report post">
            <MoreVertical />
          </button>
        </div>

        <div className="detail-text">{data.post.content}</div>

        <div className="stats">
          <span><Heart size={16} /> {data.post.like_count}</span>
          <span><MessageCircle size={16} /> {data.post.comment_count}</span>
        </div>

        <div className="tabs">
          <button className={tab === 'connect' ? 'active' : ''} onClick={() => setTab('connect')}>
            Connect ({data.replies.length}/5)
          </button>
          <button className={tab === 'comments' ? 'active' : ''} onClick={() => setTab('comments')}>
            Comments ({data.comments.length})
          </button>
        </div>

        {tab === 'connect' ? (
          <div className="side-by-side">
            <div className="original">
              <b>Missed connection</b>
              <p>{data.post.content}</p>
            </div>
            <div>
              <div className="list">
                {data.replies.map((reply) => (
                  <div className="note" key={reply.id}>
                    <p>{reply.content}</p>
                    <small>Anonymous</small>
                  </div>
                ))}
                {!data.replies.length && <p className="muted">No one has connected yet.</p>}
              </div>
              {data.replies.length < 5 && (
                <form className="reply-form" onSubmit={(event) => { event.preventDefault(); add('replies'); }}>
                  <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength="500" placeholder="I think this was me…" />
                  <button className="primary-wide"><Send size={15} /> Connect</button>
                </form>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="list">
              {data.comments.map((comment) => (
                <div className="comment" key={comment.id}>
                  <p>{comment.content}</p>
                  <small>Anonymous</small>
                </div>
              ))}
              {!data.comments.length && <p className="muted">No comments yet.</p>}
            </div>
            <form className="reply-form" onSubmit={(event) => { event.preventDefault(); add('comments'); }}>
              <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength="300" placeholder="What do you think?" />
              <button className="primary-wide"><Send size={15} /> Comment</button>
            </form>
          </>
        )}

        {error && <div className="error">{error}</div>}
      </Modal>
    </>
  );
}

function Rules({ navigate }) {
  return (
    <Page title="Board Rules" navigate={navigate}>
      <h3>💗 Be kind.</h3>
      <p>Keep posts, Connections, and Comments respectful.</p>
      <h3>🔒 Protect privacy.</h3>
      <p>Don&apos;t share someone&apos;s private contact information.</p>
      <h3>📍 Keep it campus-related.</h3>
      <p>Posts should relate to the campus community.</p>
      <h3>💌 Connect honestly.</h3>
      <p>Only use Connect if you genuinely think you&apos;re the person being sought.</p>
      <h3>🚩 Report inappropriate posts.</h3>
      <p>Use the three-dot menu to report something that breaks the rules.</p>
    </Page>
  );
}

function FAQ({ navigate }) {
  const questions = [
    ['Do I need an account?', 'No. You can submit a Missed Connection anonymously. An account is only needed if you want to save and manage your own posts.'],
    ['What is Connect?', 'Connect is for someone who thinks a Missed Connection might be about them. A post can have up to five Connect responses.'],
    ['What is Comment?', 'Comments are for general reactions and conversation.'],
    ['Can I edit an anonymous post?', 'No. Anonymous posts cannot later be claimed.'],
    ['How does recovery work?', 'If you add an email, iSee can send a one-time recovery code.'],
    ['What happens when something is reported?', 'The reported content will be reviewed by moderators and may be removed if it violates the rules.'],
  ];

  return (
    <Page title="FAQ" navigate={navigate}>
      {questions.map(([question, answer]) => (
        <details key={question}>
          <summary>{question}</summary>
          <p>{answer}</p>
        </details>
      ))}
    </Page>
  );
}

function Page({ title, children, navigate }) {
  return (
    <main className="page">
      <section className="page-card">
        <button className="back-to-board" onClick={() => navigate('board')}>
          <ChevronLeft size={16} /> Back to Board
        </button>
        <h1>{title}</h1>
        {children}
      </section>
    </main>
  );
}

function App() {
  const readUrl = () => {
    const params = new URLSearchParams(window.location.search);
    return {
      page: params.get('view') || 'board',
      modal: params.get('modal') || null,
    };
  };

  const initial = readUrl();
  const [page, setPage] = useState(initial.page);
  const [date, setDate] = useState(today);
  const [posts, setPosts] = useState([]);
  const [locations, setLocations] = useState(fallbackLocations);
  const [location, setLocation] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [user, setUser] = useState(null);
  const [modal, setModalState] = useState(initial.modal);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingPost, setPendingPost] = useState(null);

  const syncUrl = (nextPage, nextModal) => {
    const params = new URLSearchParams();
    if (nextPage !== 'board') params.set('view', nextPage);
    if (nextModal) params.set('modal', nextModal);
    const query = params.toString();
    window.history.pushState(
      { page: nextPage, modal: nextModal },
      '',
      query ? `?${query}` : window.location.pathname,
    );
  };

  const navigate = (nextPage) => {
    setPage(nextPage);
    setModalState(null);
    syncUrl(nextPage, null);
  };

  const setModal = (nextModal) => {
    if (nextModal === null) {
      setModalState(null);
      if (window.history.state?.modal) window.history.back();
      else syncUrl(page, null);
      return;
    }
    setModalState(nextModal);
    syncUrl(page, nextModal);
  };

  useEffect(() => {
    const onPopState = () => {
      const state = readUrl();
      setPage(state.page);
      setModalState(state.modal);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  async function loadPosts() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date, sort });
      if (location) params.set('location', location);
      if (search) params.set('search', search);
      const data = await api(`/api/posts?${params}`);
      setPosts(data.posts);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api('/api/me').then((data) => setUser(data.user)).catch(() => {});
    api('/api/locations').then((data) => setLocations(data.locations.map((item) => item.name))).catch(() => {});
  }, []);

  useEffect(() => {
    if (page === 'board') loadPosts();
  }, [page, date, location, search, sort]);

  async function like(id) {
    try {
      const data = await api(`/api/posts/${id}/like`, { method: 'POST' });
      setPosts((current) => current.map((post) => post.id === id ? { ...post, like_count: data.count } : post));
    } catch (err) {
      setError(err.message);
    }
  }

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    setUser(null);
  }

  function shiftDate(amount) {
    setDate((current) => new Date(new Date(`${current}T12:00:00`).getTime() + amount * 86400000).toISOString().slice(0, 10));
  }

  async function finishAuthentication() {
    if (!pendingPost) return;
    try {
      await api('/api/posts', { method: 'POST', body: JSON.stringify(pendingPost) });
      setPendingPost(null);
      await loadPosts();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="app">
      <Header user={user} navigate={navigate} setModal={setModal} logout={logout} />

      {page === 'rules' ? (
        <Rules navigate={navigate} />
      ) : page === 'faq' ? (
        <FAQ navigate={navigate} />
      ) : (
        <main className="board-page">
          <div className="board-toolbar">
            <div className="date-head">
              <button onClick={() => shiftDate(-1)} aria-label="Previous date"><ChevronLeft /></button>
              <div>
                <h1>{formatDate(date)}</h1>
                <span>{date === today ? "Today's connections" : 'Missed connections'}</span>
              </div>
              <button onClick={() => shiftDate(1)} disabled={date >= today} aria-label="Next date"><ChevronRight /></button>
            </div>

            <div className="filters">
              <div className="search">
                <Search size={15} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search connections…" />
              </div>
              <select value={location} onChange={(e) => setLocation(e.target.value)} aria-label="Filter by location">
                <option value="">All locations</option>
                {locations.map((item) => <option key={item}>{item}</option>)}
              </select>
              <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort posts">
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </select>
            </div>
          </div>

          {error && <div className="board-error">{error}</div>}

          {loading ? (
            <div className="empty">Loading connections…</div>
          ) : posts.length ? (
            <div className="grid">
              {posts.map((post) => (
                <article className="card" key={post.id} onClick={() => setModal(`post:${post.id}`)}>
                  <div className="card-top">
                    <button
                      className="dots"
                      onClick={(event) => {
                        event.stopPropagation();
                        setModal(`report:${post.id}`);
                      }}
                      aria-label="Report post"
                    >
                      <MoreVertical size={18} />
                    </button>
                    <div>
                      <span className="location">⌖ {post.location}</span>
                      <span className="time">{post.time}</span>
                    </div>
                  </div>

                  <div className="card-text">
                    {post.content.length > 190 ? `${post.content.slice(0, 190).trim()}…` : post.content}
                  </div>

                  <div className="card-actions" onClick={(event) => event.stopPropagation()}>
                    <button className="connect" onClick={() => setModal(`post:${post.id}`)}>↪ Connect</button>
                    <button onClick={() => like(post.id)} aria-label="Like post">
                      <Heart size={17} /> {post.like_count}
                    </button>
                    <button onClick={() => setModal(`post:${post.id}`)} aria-label="Comment on post">
                      <MessageCircle size={17} /> {post.comment_count}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty">
              <div className="heart">♡</div>
              <h2>No missed connections here yet.</h2>
              <p>Maybe you&apos;re the first one to write one.</p>
              <button className="primary" onClick={() => setModal('create')}>
                <Plus size={16} /> Create a Missed Connection
              </button>
            </div>
          )}
        </main>
      )}

      <footer>
        <div>Sometimes a moment is all it takes. ♡</div>
        <div>@ iSee 2026</div>
        <button onClick={() => navigate('faq')}>FAQ</button>
      </footer>

      <button className="fab" onClick={() => setModal('create')} aria-label="Create a missed connection">
        <Plus />
      </button>

      {modal === 'auth' && <Auth close={() => { setPendingPost(null); setModal(null); }} setUser={setUser} afterAuth={finishAuthentication} initialMode={pendingPost ? 'signup' : 'login'} />}
      {modal === 'create' && <Create close={() => setModal(null)} locations={locations} user={user} setModal={setModal} reload={loadPosts} setPendingPost={setPendingPost} />}
      {modal?.startsWith('post:') && <Post id={modal.split(':')[1]} close={() => setModal(null)} reload={loadPosts} />}
      {modal?.startsWith('report:') && <Report id={modal.split(':')[1]} close={() => setModal(null)} />}
      {modal === 'search' && (
        <Modal title="Search" onClose={() => setModal(null)}>
          <div className="form">
            <label>
              Search
              <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            <label>
              Location
              <select value={location} onChange={(e) => setLocation(e.target.value)}>
                <option value="">All locations</option>
                {locations.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              Sort
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </select>
            </label>
            <button className="primary-wide" onClick={() => setModal(null)}>Done</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
