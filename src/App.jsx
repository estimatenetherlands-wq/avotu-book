import { useState, useEffect } from 'react';
import OneSignal from 'react-onesignal';

function App() {
  const [lang, setLang] = useState('ru');
  const [view, setView] = useState('HOME');
  const [bookIndex, setBookIndex] = useState(null);
  const [currentContent, setCurrentContent] = useState(null);
  const [loading, setLoading] = useState(true);

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
      support: "Поддержать автора проекта:",
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
      support: "Support the author:",
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

  const handleSubscribe = () => {
    OneSignal.Slidedown.promptPush().catch(err => console.error(err));
  };

  const loadChapter = (chapter, index) => {
    setLoading(true);
    // chapter.file is now just "chapter-1.json"
    const chapterPath = `/content/${lang}/${chapter.file.replace('/content/', '')}`;
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

  const loadLore = (file) => {
    setLoading(true);
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
        
        <div style={{ background: '#1a1a1a', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'inline-block' }}>
          <p style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-flame)', fontWeight: 'bold' }}>{t.support}</p>
          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <span style={{color: '#888'}}>IBAN:</span>
            <code style={{ userSelect: 'all', padding: '0.5rem', background: '#000', fontFamily: 'monospace', fontSize: '1.2rem', color: '#fff', borderRadius: '4px' }}>NL90 YOUR 0316 3942 54</code>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
