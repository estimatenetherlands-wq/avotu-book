import { useState, useEffect } from 'react';
import OneSignal from 'react-onesignal';

function App() {
  const [lang, setLang] = useState('ru');
  const [view, setView] = useState('HOME');
  const [bookIndex, setBookIndex] = useState(null);
  const [currentContent, setCurrentContent] = useState(null);
  const [currentIdx, setCurrentIdx] = useState(null); // Track chapter number
  const [currentLoreFile, setCurrentLoreFile] = useState(null); // Track lore filename
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [views, setViews] = useState(0);
  const [likes, setLikes] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);

  const t = {
    ru: {
      home: "Главная",
      lore: "Лор",
      toc: "Оглавление",
      toToc: "К оглавлению",
      next: "Следующая глава",
      author: "Автор",
      creator: "Создатель",
      telegram: "Телеграм-канал",
      push: "Пуш-уведомления",
      subscribe: "Уведомлять о новых главах",
      support: "Поддержать автора",
      supportDesc: "Каждая монета помогает ковать будущее хроник Авоту.",
      receiver: "Получатель:",
      bank: "Банк:",
      copied: "Скопировано!",
      views: "просмотров",
      likes: "лайков",
      seoTitle: "О проекте Avotu",
      seoText: "Добро пожаловать в мир Авоту — эпическую дарк фэнтези сагу, доступную для чтения онлайн бесплатно. Исследуйте мрачные хроники огненного эльфа в мире, поглощенном пеплом. Наша гримдарк история полна магии, неоднозначных героев и суровых испытаний. Если вы ищете лучшее темное фэнтези 2026 года, вы попали по адресу.",
      loading: "Загрузка..."
    },
    en: {
      home: "Home",
      lore: "Lore",
      toc: "Table of Contents",
      toToc: "To Contents",
      next: "Next Chapter",
      author: "Author",
      creator: "Creator",
      telegram: "Join Telegram",
      push: "Push Notifications",
      subscribe: "Notify me about new chapters",
      support: "Support the author",
      supportDesc: "Every coin helps forge the future of Avotu Chronicles.",
      receiver: "Receiver:",
      bank: "Bank:",
      copied: "Copied!",
      views: "views",
      likes: "likes",
      seoTitle: "About Avotu Project",
      seoText: "Welcome to the world of Avotu — an epic dark fantasy saga available to read online for free. Explore the grim chronicles of a fire elf in a world consumed by ash. Our grimdark story is filled with magic, morally grey heroes, and harsh trials. If you are looking for the best dark fantasy books of 2026, you have come to the right place.",
      loading: "Loading..."
    }
  }[lang];

  useEffect(() => {
    // Only init once on mount
    const onsignalId = "de082089-29d1-4cbc-8240-78230e587908";
    console.log("OneSignal: Initializing with ID", onsignalId);
    
    OneSignal.init({ 
      appId: onsignalId,
      allowLocalhostAsSecureOrigin: true
    }).then(() => {
      console.log("OneSignal: Initialized Successfully");
    }).catch(err => {
      console.error("OneSignal: Initialization Failed", err);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    // Ensure the path is correct: /content/ru/book_index.json or /content/en/book_index.json
    const indexPath = `/content/${lang}/book_index.json`;
    console.log("Fetching index:", indexPath);
    
    fetch(indexPath)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load ${indexPath}: ${res.status}`);
        return res.json();
      })
      .then(data => {
        setBookIndex(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Could not load book index", err);
        setLoading(false); // Stop loading even on error to show state
      });
  }, [lang]);

  // Sync content when language or bookIndex changes
  useEffect(() => {
    if (!bookIndex) return;
    
    if (view === 'CHAPTER' && currentIdx !== null) {
      loadChapter(bookIndex.chapters[currentIdx], currentIdx);
    } else if (view === 'LORE' && currentLoreFile !== null) {
      loadLore(currentLoreFile);
    }
  }, [lang, bookIndex]);

  const handleSubscribe = () => {
    OneSignal.Slidedown.promptPush().catch(err => console.error(err));
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const loadChapter = (chapter, index) => {
    if (!chapter) return;
    setLoading(true);
    setCurrentIdx(index);
    // chapter.file is now just "chapter-1.json"
    const chapterPath = `/content/${lang}/${chapter.file.replace('/content/', '')}`;
    
    // Fetch view count from CounterAPI (Shared across languages)
    const counterKey = `avotu-chapter-${index + 1}`;
    fetch(`https://api.counterapi.dev/v1/avotu-book/${counterKey}/increment`)
      .then(res => res.json())
      .then(data => setViews(data.count || 0))
      .catch(() => {});

    // Fetch likes count
    const likeKey = `avotu-likes-chapter-${index + 1}`;
    fetch(`https://api.counterapi.dev/v1/avotu-book/${likeKey}`)
      .then(res => res.json())
      .then(data => setLikes(data.count || 0))
      .catch(() => {});

    // Check if user already liked
    const likedChapters = JSON.parse(localStorage.getItem('avotu-liked') || '[]');
    setHasLiked(likedChapters.includes(likeKey));

    fetch(chapterPath)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load ${chapterPath}`);
        return res.json();
      })
      .then(data => {
        setCurrentContent({ ...data, index, chapterData: chapter });
        setView('CHAPTER');
        setLoading(false);
        window.scrollTo(0,0);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  const handleLike = () => {
    if (hasLiked || currentIdx === null) return;
    const likeKey = `avotu-likes-chapter-${currentIdx + 1}`;
    
    fetch(`https://api.counterapi.dev/v1/avotu-book/${likeKey}/increment`)
      .then(res => res.json())
      .then(data => {
        setLikes(data.count);
        setHasLiked(true);
        const likedChapters = JSON.parse(localStorage.getItem('avotu-liked') || '[]');
        likedChapters.push(likeKey);
        localStorage.setItem('avotu-liked', JSON.stringify(likedChapters));
      })
      .catch(err => console.error(err));
  };

  const loadLore = (file) => {
    if (!file) return;
    setLoading(true);
    setCurrentLoreFile(file);
    const lorePath = `/content/${lang}/${file.replace('/content/', '')}`;
    fetch(lorePath)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load ${lorePath}`);
        return res.json();
      })
      .then(data => {
        setCurrentContent(data);
        setView('LORE');
        setLoading(false);
        window.scrollTo(0,0);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  if (loading || !bookIndex) {
    return <div className="app-container" style={{justifyContent: 'center', alignItems: 'center'}}>
      <h2>{t.loading}</h2>
    </div>;
  }

  return (
    <div className="app-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="header">
        <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={() => setLang('ru')} 
            style={{ color: lang === 'ru' ? 'var(--accent-flame)' : '#555', fontSize: '0.9rem', padding: '5px' }}
          >
            RU
          </button>
          <span style={{ color: '#333' }}>|</span>
          <button 
            onClick={() => setLang('en')} 
            style={{ color: lang === 'en' ? 'var(--accent-flame)' : '#555', fontSize: '0.9rem', padding: '5px' }}
          >
            EN
          </button>
        </div>
        <h1 onClick={() => setView('HOME')} style={{cursor: 'pointer'}}>{bookIndex.title}</h1>
        <p>{t.author}: {bookIndex.author}</p>
        <nav>
          <button className={`nav-link ${view === 'HOME' ? 'active' : ''}`} onClick={() => setView('HOME')}>{t.home}</button>
          <button className={`nav-link ${view === 'LORE' ? 'active' : ''}`} onClick={() => loadLore(bookIndex.lore)}>{t.lore}</button>
        </nav>
      </header>

      <main className="content-wrapper" style={{ flex: 1 }}>
        {view === 'HOME' && (
          <div className="book-content">
            <h2 className="chapter-title">{t.toc}</h2>
            <p style={{textAlign: 'center', marginBottom: '3rem', fontStyle: 'italic', textIndent: '0'}}>{bookIndex.description}</p>
            <div style={{display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center'}}>
              {bookIndex.chapters.map((chapter, idx) => (
                <button 
                  key={chapter.id} 
                  onClick={() => loadChapter(chapter, idx)}
                  style={{fontSize: '1.5rem', color: 'var(--accent-flame)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', width: '100%', textAlign: 'center'}}
                >
                  {chapter.title}
                </button>
              ))}
            </div>
            
            <section className="seo-section">
              <h3 className="seo-title">{t.seoTitle}</h3>
              <p className="seo-text">{t.seoText}</p>
            </section>
          </div>
        )}

        {view === 'CHAPTER' && currentContent && (
          <article className="book-content">
            <h2 className="chapter-title">{currentContent.title}</h2>
            {currentContent.paragraphs.map((p, i) => {
              if (p === "***") {
                return <div key={i} className="scene-break"></div>;
              }
              return <p key={i} className={i === 0 ? "dropcap" : ""}>{p}</p>;
            })}

            <div className="chapter-stats-footer">
              <div className="stat-item">
                <span className="stat-icon">👁️</span>
                <span className="stat-value">{views}</span>
                <span className="stat-label">{t.views}</span>
              </div>
              <button 
                className={`like-btn ${hasLiked ? 'active' : ''}`}
                onClick={handleLike}
                disabled={hasLiked}
              >
                <span className="stat-icon">{hasLiked ? '❤️' : '🤍'}</span>
                <span className="stat-value">{likes}</span>
                <span className="stat-label">{t.likes}</span>
              </button>
            </div>

            <div className="nav-buttons" style={{marginTop: '4rem', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem'}}>
              <button 
                onClick={() => setView('HOME')}
                className="nav-btn"
                style={{padding: '10px 20px', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '4px'}}
              >
                {t.toToc}
              </button>
              {currentContent.index !== undefined && currentContent.index < bookIndex.chapters.length - 1 && (
                <button 
                  onClick={() => loadChapter(bookIndex.chapters[currentContent.index + 1], currentContent.index + 1)}
                  className="nav-btn"
                  style={{padding: '10px 20px', border: '1px solid var(--accent-flame)', color: 'var(--accent-flame)', borderRadius: '4px'}}
                >
                  {t.next} &rarr;
                </button>
              )}
            </div>
          </article>
        )}

        {view === 'LORE' && currentContent && (
          <div className="book-content">
            <h2 className="chapter-title">{currentContent.title}</h2>
            {currentContent.sections.map((sec, idx) => (
              <div key={idx} style={{marginBottom: '2rem'}}>
                <h3 style={{color: 'var(--accent-flame)', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem'}}>
                  {sec.name}
                </h3>
                <p>{sec.content}</p>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer style={{ marginTop: 'auto', padding: '2rem 1rem', textAlign: 'center', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '1rem' }}>
          <button onClick={handleSubscribe} className="social-btn push">
            <span>🔔 {t.subscribe}</span>
          </button>
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <a href="https://t.me/avotubook" target="_blank" rel="noopener noreferrer" className="social-btn telegram">
            <span>{t.telegram}</span>
          </a>
          <a href="https://www.instagram.com/mays_csq?igsh=Zmh6aGo3cG42OHk4" target="_blank" rel="noopener noreferrer" className="social-btn instagram">
            <span>Instagram</span>
          </a>
        </div>
        
        <div className="support-card">
          <div className="support-card-header">
            <span className="support-icon">🏛️</span>
            <div>
              <p className="support-title">{t.support}</p>
              <p className="support-desc">{t.supportDesc}</p>
            </div>
          </div>
          <div className="support-info">
            <div className="support-details">
              <span className="support-label">{t.receiver}</span>
              <span className="support-value">Anar Agadzhanov</span>
            </div>
            <div className="support-details">
              <span className="support-label">{t.bank}</span>
              <span className="support-value">ING Bank</span>
            </div>
            <div className="support-details">
              <span className="support-label">IBAN:</span>
              <div className="support-iban-wrapper">
                <code className="support-iban">NL74 INGB 0117 7006 22</code>
                <button 
                  onClick={() => copyToClipboard("NL74 INGB 0117 7006 22")}
                  className={`copy-btn ${copied ? 'copied' : ''}`}
                >
                  {copied ? `✓ ${t.copied}` : '📋'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
