import { useState, useEffect } from 'react';

function App() {
  const [view, setView] = useState('HOME');
  const [bookIndex, setBookIndex] = useState(null);
  const [currentContent, setCurrentContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/content/book_index.json')
      .then(res => res.json())
      .then(data => {
        setBookIndex(data);
        setLoading(false);
      })
      .catch(err => console.error("Could not load book index", err));
  }, []);

  const loadChapter = (chapter, index) => {
    setLoading(true);
    fetch(chapter.file)
      .then(res => res.json())
      .then(data => {
        setCurrentContent({ ...data, index, chapterData: chapter });
        setView('CHAPTER');
        setLoading(false);
        window.scrollTo(0,0);
      });
  };

  const loadLore = (file) => {
    setLoading(true);
    fetch(file)
      .then(res => res.json())
      .then(data => {
        setCurrentContent(data);
        setView('LORE');
        setLoading(false);
        window.scrollTo(0,0);
      });
  };

  if (loading || !bookIndex) {
    return <div className="app-container" style={{justifyContent: 'center', alignItems: 'center'}}>
      <h2>Загрузка...</h2>
    </div>;
  }

  return (
    <div className="app-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="header">
        <h1 onClick={() => setView('HOME')} style={{cursor: 'pointer'}}>{bookIndex.title}</h1>
        <p>Автор: {bookIndex.author}</p>
        <nav>
          <button className={`nav-link ${view === 'HOME' ? 'active' : ''}`} onClick={() => setView('HOME')}>Главная</button>
          <button className={`nav-link ${view === 'LORE' ? 'active' : ''}`} onClick={() => loadLore(bookIndex.lore)}>Лор</button>
        </nav>
      </header>

      <main className="content-wrapper" style={{ flex: 1 }}>
        {view === 'HOME' && (
          <div className="book-content">
            <h2 className="chapter-title">Оглавление</h2>
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
                К оглавлению
              </button>
              {currentContent.index !== undefined && currentContent.index < bookIndex.chapters.length - 1 && (
                <button 
                  onClick={() => loadChapter(bookIndex.chapters[currentContent.index + 1], currentContent.index + 1)}
                  className="nav-btn"
                  style={{padding: '10px 20px', border: '1px solid var(--accent-flame)', color: 'var(--accent-flame)', borderRadius: '4px'}}
                >
                  Следующая глава &rarr;
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
        <a href="https://www.instagram.com/mays_csq?igsh=Zmh6aGo3cG42OHk4" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', textDecoration: 'none', background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '8px' }}>
          <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png" alt="Instagram" style={{ width: '24px', height: '24px', filter: 'grayscale(100%) brightness(200%)', opacity: 0.8 }} />
          <span>Создатель: @mays_csq</span>
        </a>
        
        <div style={{ background: '#1a1a1a', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'inline-block' }}>
          <p style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-flame)', fontWeight: 'bold' }}>Поддержать автора проекта:</p>
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
