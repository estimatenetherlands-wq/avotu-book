import { useState, useEffect, useRef, useCallback } from 'react';

const TRANSLATE_CACHE_KEY = 'avotu_learn_translations_v2';
const VOCAB_KEY = 'avotu_learn_vocab_v2';
const PROGRESS_KEY = 'avotu_learn_progress_v2';

function loadCache() {
  try { return JSON.parse(localStorage.getItem(TRANSLATE_CACHE_KEY) || '{}'); } catch { return {}; }
}
function saveCache(c) {
  try { localStorage.setItem(TRANSLATE_CACHE_KEY, JSON.stringify(c)); } catch {}
}
function loadVocab() {
  try { return JSON.parse(localStorage.getItem(VOCAB_KEY) || '[]'); } catch { return []; }
}
function saveVocab(v) {
  try { localStorage.setItem(VOCAB_KEY, JSON.stringify(v)); } catch {}
}
function loadProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}'); } catch { return {}; }
}
function saveProgress(p) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch {}
}

async function translate(text, cacheRef, setCache) {
  const key = text.toLowerCase().trim();
  if (cacheRef.current[key]) return cacheRef.current[key];
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ru&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    const data = await res.json();
    const result = data[0].map(i => i[0]).join('');
    cacheRef.current[key] = result;
    saveCache(cacheRef.current);
    setCache({ ...cacheRef.current });
    return result;
  } catch {
    return '–';
  }
}

function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
}

function tokenize(text) {
  // Split into word tokens and non-word tokens (spaces, punctuation)
  return text.split(/(\b[A-Za-zА-Яа-яёЁ'''-]+\b)/);
}

function getSentence(paragraph, word) {
  const sentences = paragraph.match(/[^.!?"]+[.!?"]+/g) || [paragraph];
  return sentences.find(s => s.toLowerCase().includes(word.toLowerCase())) || paragraph.slice(0, 200);
}

export default function LearnApp() {
  const [bookIndex, setBookIndex] = useState(null);
  const [view, setView] = useState('home'); // home | reader
  const [currentChapterIdx, setCurrentChapterIdx] = useState(null);
  const [enContent, setEnContent] = useState(null);
  const [ruContent, setRuContent] = useState(null);
  const [chapterLoading, setChapterLoading] = useState(false);

  // Translation
  const [, setCache] = useState({});
  const cacheRef = useRef(loadCache());
  const [activeWord, setActiveWord] = useState(null); // {word, translation, loading, paraIdx, sentence, sentenceTranslation, sentenceLoading, showSentence, isPhrase}
  const [sideTab, setSideTab] = useState('translate'); // translate | vocab

  // Vocab (saved words)
  const [vocab, setVocab] = useState(loadVocab);

  // Progress (read chapters)
  const [progress] = useState(loadProgress);

  // Parallel paragraph visibility
  const [showParallel, setShowParallel] = useState({});

  const readerPaneRef = useRef(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Load book index
  useEffect(() => {
    fetch('/content/en/book_index.json')
      .then(r => r.json())
      .then(d => setBookIndex(d))
      .catch(console.error);
  }, []);

  // Track scroll progress
  useEffect(() => {
    const pane = readerPaneRef.current;
    if (!pane) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = pane;
      const pct = scrollHeight - clientHeight > 0
        ? Math.round((scrollTop / (scrollHeight - clientHeight)) * 100)
        : 0;
      setScrollProgress(pct);
    };
    pane.addEventListener('scroll', onScroll);
    return () => pane.removeEventListener('scroll', onScroll);
  }, [view, chapterLoading]);

  // Mark chapter as read when scroll reaches 80%
  useEffect(() => {
    if (scrollProgress >= 80 && currentChapterIdx !== null) {
      const p = loadProgress();
      if (!p[currentChapterIdx]) {
        p[currentChapterIdx] = true;
        saveProgress(p);
      }
    }
  }, [scrollProgress, currentChapterIdx]);

  // Handle text selection for phrase translation
  useEffect(() => {
    if (view !== 'reader') return;
    const onMouseUp = () => {
      const sel = window.getSelection();
      const text = sel?.toString().trim();
      if (text && text.length > 1 && text.length < 200) {
        const node = sel.anchorNode;
        const paraEl = node?.parentElement?.closest('[data-para-idx]');
        const paraIdx = paraEl ? parseInt(paraEl.dataset.paraIdx) : null;
        setActiveWord({
          word: text,
          isPhrase: true,
          translation: null,
          loading: true,
          paraIdx,
          sentence: text,
          sentenceTranslation: null,
          sentenceLoading: false,
          showSentence: false,
        });
        setSideTab('translate');
        translate(text, cacheRef, setCache).then(t => {
          setActiveWord(prev => prev?.word === text ? { ...prev, translation: t, loading: false } : prev);
        });
      }
    };
    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, [view]);

  const openChapter = useCallback(async (chapter, idx) => {
    setChapterLoading(true);
    setView('reader');
    setCurrentChapterIdx(idx);
    setActiveWord(null);
    setShowParallel({});
    setScrollProgress(0);

    const [en, ru] = await Promise.all([
      fetch(`/content/en/${chapter.file}`).then(r => r.json()).catch(() => null),
      fetch(`/content/ru/${chapter.file}`).then(r => r.json()).catch(() => null),
    ]);
    setEnContent(en);
    setRuContent(ru);
    setChapterLoading(false);
    // Scroll to top
    setTimeout(() => { if (readerPaneRef.current) readerPaneRef.current.scrollTop = 0; }, 50);
  }, []);

  const handleWordClick = useCallback((word, paraIdx, paragraph) => {
    const sentence = getSentence(paragraph, word);
    setActiveWord({
      word,
      isPhrase: false,
      translation: null,
      loading: true,
      paraIdx,
      sentence,
      sentenceTranslation: null,
      sentenceLoading: false,
      showSentence: false,
    });
    setSideTab('translate');
    translate(word, cacheRef, setCache).then(t => {
      setActiveWord(prev => (prev?.word === word && prev?.paraIdx === paraIdx) ? { ...prev, translation: t, loading: false } : prev);
    });
  }, []);

  const handleTranslateSentence = useCallback(async () => {
    if (!activeWord) return;
    setActiveWord(prev => ({ ...prev, showSentence: true, sentenceLoading: true }));
    const t = await translate(activeWord.sentence, cacheRef, setCache);
    setActiveWord(prev => prev ? { ...prev, sentenceTranslation: t, sentenceLoading: false } : null);
  }, [activeWord]);

  const handleSaveWord = useCallback(() => {
    if (!activeWord) return;
    const word = activeWord.word;
    const translation = activeWord.translation;
    if (!translation || translation === '–') return;
    setVocab(prev => {
      if (prev.find(v => v.word.toLowerCase() === word.toLowerCase())) return prev;
      const updated = [{ word, translation, addedAt: Date.now() }, ...prev];
      saveVocab(updated);
      return updated;
    });
  }, [activeWord]);

  const handleDeleteVocab = (word) => {
    setVocab(prev => {
      const updated = prev.filter(v => v.word !== word);
      saveVocab(updated);
      return updated;
    });
  };

  const isWordSaved = activeWord ? vocab.some(v => v.word.toLowerCase() === activeWord.word.toLowerCase()) : false;

  const toggleParallel = (idx) => {
    setShowParallel(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  // Stats
  const totalChapters = bookIndex?.chapters?.length || 0;
  const readCount = Object.values(progress).filter(Boolean).length;
  const vocabCount = vocab.length;

  // Render interactive paragraph
  const renderParagraph = (paragraph, idx, isFirst) => {
    if (paragraph === '***') {
      return (
        <div key={idx} className="scene-break-divider">
          <span>✦</span>
        </div>
      );
    }

    const tokens = tokenize(paragraph);
    return (
      <div key={idx} className="learn-para-block">
        <p
          className={`learn-para${isFirst ? ' first-para' : ''}`}
          data-para-idx={idx}
        >
          {tokens.map((token, ti) => {
            const isWord = /^[A-Za-z'''-]+$/.test(token) && token.length > 1;
            const isSaved = isWord && vocab.some(v => v.word.toLowerCase() === token.toLowerCase());
            const isHighlighted = activeWord?.word?.toLowerCase() === token.toLowerCase() && activeWord?.paraIdx === idx;
            if (isWord) {
              return (
                <span
                  key={ti}
                  className={`iword${isSaved ? ' saved' : ''}${isHighlighted ? ' highlighted' : ''}`}
                  onClick={() => handleWordClick(token, idx, paragraph)}
                >
                  {token}
                </span>
              );
            }
            return token;
          })}
        </p>

        {/* Toggle parallel translation button */}
        {ruContent?.paragraphs?.[idx] && paragraph !== '***' && (
          <button
            style={{
              fontSize: '0.7rem',
              color: showParallel[idx] ? 'var(--accent)' : 'var(--text-dim)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 0',
              letterSpacing: '0.06em',
              marginTop: '-0.5rem',
              marginBottom: '0.3rem',
              display: 'block',
            }}
            onClick={() => toggleParallel(idx)}
          >
            {showParallel[idx] ? '▲ Скрыть русский перевод' : '▼ Показать русский перевод'}
          </button>
        )}

        {showParallel[idx] && ruContent?.paragraphs?.[idx] && (
          <div className="parallel-ru">
            <span className="parallel-ru-label">Перевод</span>
            {ruContent.paragraphs[idx]}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="learn-app">
      {/* TOP BAR */}
      <header className="learn-topbar">
        <div className="topbar-brand">
          <span className="topbar-brand-icon">📖</span>
          <span className="topbar-brand-name">Avotu <span>Learn</span></span>
        </div>

        {view === 'reader' && (
          <button className="topbar-back" onClick={() => setView('home')}>
            ← Все главы
          </button>
        )}

        <div className="topbar-stats">
          <div className="topbar-stat">
            <span className="topbar-stat-icon">✅</span>
            <span className="topbar-stat-val">{readCount}</span>
            <span>/ {totalChapters} глав</span>
          </div>
          <div className="topbar-stat">
            <span className="topbar-stat-icon">⭐</span>
            <span className="topbar-stat-val">{vocabCount}</span>
            <span>слов</span>
          </div>
        </div>
      </header>

      {/* HOME: Chapter Selection */}
      {view === 'home' && (
        <main className="learn-home">
          {!bookIndex ? (
            <div className="learn-loading"><div className="loading-spinner" /><span>Загрузка...</span></div>
          ) : (
            <>
              <div className="learn-home-hero">
                <h1>Учи английский,<br />читая <em>Avotu</em></h1>
                <p>Нажми на любое слово в тексте, чтобы увидеть дословный перевод. Выдели фразу — получи перевод фразы.</p>
                <div className="learn-how-to">
                  <div className="learn-how-item">
                    <div className="learn-how-item-icon">👆</div>
                    <span>Кликни на слово</span>
                  </div>
                  <div className="learn-how-item">
                    <div className="learn-how-item-icon">🖊️</div>
                    <span>Выдели фразу</span>
                  </div>
                  <div className="learn-how-item">
                    <div className="learn-how-item-icon">🔊</div>
                    <span>Послушай произношение</span>
                  </div>
                  <div className="learn-how-item">
                    <div className="learn-how-item-icon">⭐</div>
                    <span>Сохрани в словарь</span>
                  </div>
                  <div className="learn-how-item">
                    <div className="learn-how-item-icon">🇷🇺</div>
                    <span>Покажи русский абзац</span>
                  </div>
                </div>
              </div>

              <div className="learn-section-title">Выбери главу</div>
              <div className="chapter-grid">
                {bookIndex.chapters.map((ch, i) => (
                  <button
                    key={ch.id}
                    className="chapter-card"
                    onClick={() => openChapter(ch, i)}
                  >
                    <div className="chapter-card-num">{i + 1}</div>
                    <div>
                      <div className="chapter-card-title">{ch.title}</div>
                      <div className="chapter-card-meta">
                        {progress[i] ? '✅ Прочитана' : 'Не читалась'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </main>
      )}

      {/* READER */}
      {view === 'reader' && (
        <div className="learn-reader">
          {/* Progress bar */}
          <div className="reader-progress-bar">
            <div className="reader-progress-fill" style={{ width: `${scrollProgress}%` }} />
          </div>

          {/* Left: text pane */}
          <div className="reader-pane" ref={readerPaneRef}>
            {chapterLoading ? (
              <div className="learn-loading"><div className="loading-spinner" /><span>Загрузка главы...</span></div>
            ) : enContent ? (
              <>
                <div className="reader-chapter-header">
                  <h2 className="reader-chapter-title">{enContent.title}</h2>
                  <div className="reader-controls">
                    <button className="reader-btn" onClick={() => speak(enContent.paragraphs.filter(p => p !== '***').join(' '))}>
                      🔊 Читать вслух
                    </button>
                    <button className="reader-btn" onClick={() => window.speechSynthesis?.cancel()}>
                      ⏹ Стоп
                    </button>
                    <button
                      className="reader-btn"
                      onClick={() => {
                        const allVisible = enContent.paragraphs.reduce((acc, _, i) => ({ ...acc, [i]: true }), {});
                        const anyHidden = enContent.paragraphs.some((_, i) => !showParallel[i]);
                        setShowParallel(anyHidden ? allVisible : {});
                      }}
                    >
                      🇷🇺 Параллельный текст
                    </button>
                  </div>
                </div>

                <div className="reader-divider" />

                {enContent.paragraphs.map((para, i) => renderParagraph(para, i, i === 0))}

                {/* Navigation buttons */}
                <div className="reader-nav-buttons">
                  {currentChapterIdx > 0 && (
                    <button
                      className="reader-nav-btn"
                      onClick={() => openChapter(bookIndex.chapters[currentChapterIdx - 1], currentChapterIdx - 1)}
                    >
                      ← Предыдущая глава
                    </button>
                  )}
                  <button className="reader-nav-btn" onClick={() => setView('home')}>
                    📋 К списку глав
                  </button>
                  {currentChapterIdx < bookIndex.chapters.length - 1 && (
                    <button
                      className="reader-nav-btn accent"
                      onClick={() => openChapter(bookIndex.chapters[currentChapterIdx + 1], currentChapterIdx + 1)}
                    >
                      Следующая глава →
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="learn-loading"><span>Ошибка загрузки главы</span></div>
            )}
          </div>

          {/* Right: Translation + Vocabulary Panel */}
          <div className="side-panel">
            <div className="side-tabs">
              <button className={`side-tab${sideTab === 'translate' ? ' active' : ''}`} onClick={() => setSideTab('translate')}>
                Перевод
              </button>
              <button className={`side-tab${sideTab === 'vocab' ? ' active' : ''}`} onClick={() => setSideTab('vocab')}>
                Словарь {vocabCount > 0 && `(${vocabCount})`}
              </button>
            </div>

            <div className="side-content">
              {/* TRANSLATE TAB */}
              {sideTab === 'translate' && (
                <>
                  {activeWord ? (
                    <div className="translation-card">
                      <div className="trans-word">
                        {activeWord.word}
                        <button className="trans-speak-btn" onClick={() => speak(activeWord.word)} title="Произнести">
                          🔊
                        </button>
                      </div>

                      <span className="trans-type-badge">
                        {activeWord.isPhrase ? 'фраза' : 'слово'}
                      </span>

                      <div className="translation-result">
                        {activeWord.loading ? (
                          <span className="trans-loading">Переводим...</span>
                        ) : (
                          <div className="trans-translation">{activeWord.translation}</div>
                        )}
                      </div>

                      <div className="trans-actions">
                        {!activeWord.isPhrase && (
                          <button
                            className="trans-action-btn"
                            onClick={handleTranslateSentence}
                          >
                            📝 Предложение
                          </button>
                        )}
                        <button
                          className={`trans-action-btn${isWordSaved ? ' saved' : ''}`}
                          onClick={handleSaveWord}
                          disabled={isWordSaved || !activeWord.translation || activeWord.translation === '–'}
                        >
                          {isWordSaved ? '⭐ Сохранено' : '☆ В словарь'}
                        </button>
                      </div>

                      {activeWord.showSentence && (
                        <div className="trans-sentence-box">
                          <p className="trans-sentence-en">{activeWord.sentence}</p>
                          <p className="trans-sentence-ru">
                            {activeWord.sentenceLoading ? 'Переводим...' : activeWord.sentenceTranslation}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="trans-placeholder">
                      <div className="trans-placeholder-icon">👆</div>
                      <div className="trans-placeholder-text">
                        Нажми на любое слово<br />или выдели фразу,<br />чтобы увидеть перевод
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* VOCAB TAB */}
              {sideTab === 'vocab' && (
                <>
                  {vocab.length === 0 ? (
                    <div className="vocab-empty">
                      <div style={{ fontSize: '2rem' }}>⭐</div>
                      <span style={{ fontSize: '0.88rem' }}>
                        Сохраняй слова в словарь,<br />нажав «В словарь» при переводе
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="vocab-count">{vocab.length} слов сохранено</div>
                      <div className="vocab-list">
                        {vocab.map(v => (
                          <div key={v.word} className="vocab-item">
                            <div className="vocab-item-left">
                              <span className="vocab-item-word">{v.word}</span>
                              <span className="vocab-item-translation">{v.translation}</span>
                            </div>
                            <div className="vocab-item-actions">
                              <button
                                className="vocab-icon-btn"
                                onClick={() => speak(v.word)}
                                title="Произнести"
                              >
                                🔊
                              </button>
                              <button
                                className="vocab-icon-btn danger"
                                onClick={() => handleDeleteVocab(v.word)}
                                title="Удалить"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
