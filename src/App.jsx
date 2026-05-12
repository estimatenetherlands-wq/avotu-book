import { useEffect, useMemo, useRef, useState } from 'react';
import OneSignal from 'react-onesignal';

const COPY = {
  ru: {
    home: 'Главная',
    lore: 'Лор',
    characters: 'Персонажи',
    toc: 'Оглавление',
    toToc: 'К оглавлению',
    prev: 'Предыдущая глава',
    next: 'Следующая глава',
    author: 'Автор',
    telegram: 'Телеграм-канал',
    subscribe: 'Уведомлять о новых главах',
    views: 'просмотров',
    likes: 'лайков',
    listen: 'Слушать главу',
    stop: 'Остановить',
    generating: 'Загрузка...',
    loading: 'Загрузка...',
    characterIndex: 'Список персонажей',
    characterIntro: 'Референсы и краткие описания ключевых персонажей.',
    backToReading: 'Вернуться к чтению',
    seoTitle: 'О проекте Avotu',
    seoText:
      'Добро пожаловать в мир Avotu — эпическую дарк-фэнтези сагу, доступную для чтения онлайн бесплатно. Это хроники огненного эльфа, людей из другого мира и тех, кто пытается сохранить человечность в мире пепла.',
    audioMissing: 'Озвучка этой главы еще готовится. Подождите пару минут.'
  },
  en: {
    home: 'Home',
    lore: 'Lore',
    characters: 'Characters',
    toc: 'Table of Contents',
    toToc: 'To Contents',
    prev: 'Previous Chapter',
    next: 'Next Chapter',
    author: 'Author',
    telegram: 'Join Telegram',
    subscribe: 'Notify me about new chapters',
    views: 'views',
    likes: 'likes',
    listen: 'Listen to Chapter',
    stop: 'Stop Narrating',
    generating: 'Loading...',
    loading: 'Loading...',
    characterIndex: 'Character Index',
    characterIntro: 'Reference sheets and short descriptions for key characters.',
    backToReading: 'Back to reading',
    seoTitle: 'About Avotu Project',
    seoText:
      'Welcome to the world of Avotu, an epic dark fantasy saga available to read online for free. These are chronicles of a fire elf, people from another world, and survivors trying to keep their humanity in a world of ash.',
    audioMissing: 'The audio for this chapter is still being prepared. Please wait a little.'
  }
};

const oneSignalId = 'de082089-29d1-4cbc-8240-78230e587908';
const wordBoundary = '[^\\p{L}\\p{N}_]';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normaliseAlias(value, lang) {
  return value.toLocaleLowerCase(lang === 'ru' ? 'ru-RU' : 'en-US');
}

function buildRouteHash(route) {
  if (route.view === 'CHAPTER') return `#chapter-${route.index + 1}`;
  if (route.view === 'LORE') return '#lore';
  if (route.view === 'CHARACTERS' && route.characterId) return `#characters/${encodeURIComponent(route.characterId)}`;
  if (route.view === 'CHARACTERS') return '#characters';
  return '#home';
}

function parseRouteHash(hash) {
  const cleanHash = hash.replace(/^#/, '');
  const chapterMatch = cleanHash.match(/^chapter-(\d+)$/);

  if (chapterMatch) {
    return { view: 'CHAPTER', index: Number(chapterMatch[1]) - 1 };
  }

  if (cleanHash === 'lore') return { view: 'LORE' };
  if (cleanHash === 'characters') return { view: 'CHARACTERS' };
  if (cleanHash.startsWith('characters/')) {
    return { view: 'CHARACTERS', characterId: decodeURIComponent(cleanHash.replace('characters/', '')) };
  }

  return { view: 'HOME' };
}

function App() {
  const [lang, setLang] = useState('ru');
  const [view, setView] = useState('HOME');
  const [bookIndex, setBookIndex] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState(null);
  const [currentContent, setCurrentContent] = useState(null);
  const [currentIdx, setCurrentIdx] = useState(null);
  const [currentLoreFile, setCurrentLoreFile] = useState(null);
  const [readingReturnRoute, setReadingReturnRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [views, setViews] = useState(null);
  const [likes, setLikes] = useState(null);
  const [hasLiked, setHasLiked] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);

  const audioRef = useRef(null);
  const routeReadyRef = useRef(false);
  const oneSignalEnabled = window.location.hostname === 'avotu-book.vercel.app';
  const t = COPY[lang];

  const characterById = useMemo(() => {
    return new Map(characters.map((character) => [character.id, character]));
  }, [characters]);

  const aliasLookup = useMemo(() => {
    const lookup = new Map();

    characters.forEach((character) => {
      character.aliases?.forEach((alias) => {
        lookup.set(normaliseAlias(alias, lang), character.id);
      });
    });

    return lookup;
  }, [characters, lang]);

  const characterRegex = useMemo(() => {
    const aliases = characters
      .flatMap((character) => character.aliases || [])
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp);

    if (aliases.length === 0) return null;
    return new RegExp(`(^|${wordBoundary})(${aliases.join('|')})(?=$|${wordBoundary})`, 'giu');
  }, [characters]);

  const selectedCharacter = selectedCharacterId
    ? characterById.get(selectedCharacterId)
    : null;

  function writeRoute(route, options = {}) {
    const routeState = { avotuRoute: true, ...route };
    const method = options.replace ? 'replaceState' : 'pushState';
    window.history[method](routeState, '', buildRouteHash(routeState));
  }

  function rememberCurrentScroll() {
    if (view === 'CHAPTER' && currentIdx !== null) {
      const readingRoute = { view: 'CHAPTER', index: currentIdx, scrollY: window.scrollY };
      setReadingReturnRoute(readingRoute);
      writeRoute(readingRoute, { replace: true });
    }
  }

  useEffect(() => {
    if (!oneSignalEnabled) {
      console.log('OneSignal: skipped outside production domain');
      return;
    }

    OneSignal.init({
      appId: oneSignalId,
      allowLocalhostAsSecureOrigin: true
    }).catch((err) => {
      console.error('OneSignal: initialization failed', err);
    });
  }, [oneSignalEnabled]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      fetch(`/content/${lang}/book_index.json`).then((res) => {
        if (!res.ok) throw new Error(`Failed to load book index: ${res.status}`);
        return res.json();
      }),
      fetch(`/content/${lang}/characters.json`).then((res) => {
        if (!res.ok) throw new Error(`Failed to load characters: ${res.status}`);
        return res.json();
      })
    ])
      .then(([indexData, characterData]) => {
        if (cancelled) return;
        setBookIndex(indexData);
        setCharacters(characterData.characters || []);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Could not load site content', err);
        setCharacters([]);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [lang]);

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useEffect(() => {
    if (!bookIndex || routeReadyRef.current) return;

    const route = window.history.state?.avotuRoute
      ? window.history.state
      : parseRouteHash(window.location.hash);

    routeReadyRef.current = true;
    writeRoute(route, { replace: true });
    applyRoute(route, { skipHistory: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookIndex]);

  useEffect(() => {
    if (!bookIndex) return undefined;

    const handlePopState = (event) => {
      const route = event.state?.avotuRoute
        ? event.state
        : parseRouteHash(window.location.hash);

      applyRoute(route, { skipHistory: true });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookIndex, lang]);

  useEffect(() => {
    let title = 'Avotu - Dark Fantasy Saga';
    let desc = t.seoText;

    if (view === 'CHAPTER' && currentContent) {
      title = `${currentContent.title} | Avotu Saga`;
      desc = `${currentContent.title}. Avotu dark fantasy saga.`;
    } else if (view === 'LORE') {
      title = `${t.lore} | Avotu Saga`;
      desc = 'Lore, history, magic, and worldbuilding of Avotu.';
    } else if (view === 'CHARACTERS') {
      title = `${t.characters} | Avotu Saga`;
      desc = 'Character gallery and reference sheets for Avotu.';
    }

    document.title = title;

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', desc);

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', title);

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', desc);
  }, [view, currentContent, lang, t]);

  useEffect(() => {
    if (!bookIndex) return;

    if (view === 'CHAPTER' && currentIdx !== null) {
      loadChapter(bookIndex.chapters[currentIdx], currentIdx);
    } else if (view === 'LORE' && currentLoreFile !== null) {
      loadLore(currentLoreFile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, bookIndex]);

  const handleSubscribe = () => {
    if (!oneSignalEnabled) {
      console.log('OneSignal: push prompt skipped outside production domain');
      return;
    }

    OneSignal.Slidedown.promptPush().catch((err) => console.error(err));
  };

  function scrollToRoutePosition(scrollY) {
    requestAnimationFrame(() => {
      window.scrollTo(0, Number.isFinite(scrollY) ? scrollY : 0);
    });
  }

  function applyRoute(route, options = {}) {
    if (route.view === 'CHAPTER') {
      const chapter = bookIndex?.chapters?.[route.index];
      if (chapter) {
        loadChapter(chapter, route.index, { ...options, skipHistory: true, scrollY: route.scrollY });
        return;
      }
    }

    if (route.view === 'LORE' && bookIndex?.lore) {
      loadLore(bookIndex.lore, { ...options, skipHistory: true, scrollY: route.scrollY });
      return;
    }

    if (route.view === 'CHARACTERS') {
      stopAudio();
      setSelectedCharacterId(route.characterId || null);
      setView('CHARACTERS');
      setLoading(false);
      scrollToRoutePosition(route.scrollY);
      return;
    }

    stopAudio();
    setSelectedCharacterId(null);
    setCurrentIdx(null);
    setCurrentLoreFile(null);
    setCurrentContent(null);
    setView('HOME');
    setLoading(false);
    scrollToRoutePosition(route.scrollY);
  }

  function stopAudio() {
    if (audioRef.current) audioRef.current.pause();
    setIsReading(false);
  }

  function loadChapter(chapter, index, options = {}) {
    if (!chapter || !bookIndex) return;

    if (!options.skipHistory) {
      rememberCurrentScroll();
      writeRoute({ view: 'CHAPTER', index });
    }

    setLoading(true);
    setCurrentIdx(index);
    const chapterPath = `/content/${lang}/${chapter.file.replace('/content/', '')}`;
    const totalChapters = bookIndex.chapters.length;
    const reverseIdx = totalChapters - index;
    const baseViews = 1200 + reverseIdx * 120 + (index % 3) * 45;
    const baseLikes = 120 + reverseIdx * 15 + (index % 2) * 8;
    const chapterId = `v5_chapter_${index + 1}`;
    const likedChapters = JSON.parse(localStorage.getItem('avotu_v5_likes') || '[]');
    const isLiked = likedChapters.includes(chapterId);

    setViews(baseViews);
    setHasLiked(isLiked);
    setLikes(isLiked ? baseLikes + 1 : baseLikes);

    fetch(chapterPath)
      .then((res) => {
        stopAudio();
        if (!res.ok) throw new Error(`Failed to load ${chapterPath}`);
        return res.json();
      })
      .then((data) => {
        setCurrentContent({ ...data, index, chapterData: chapter });
        setView('CHAPTER');
        setLoading(false);
        scrollToRoutePosition(options.scrollY);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }

  function loadLore(file, options = {}) {
    if (!file) return;

    if (!options.skipHistory) {
      rememberCurrentScroll();
      writeRoute({ view: 'LORE' });
    }

    setLoading(true);
    setCurrentLoreFile(file);

    fetch(`/content/${lang}/${file.replace('/content/', '')}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load lore: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setCurrentContent(data);
        setView('LORE');
        setLoading(false);
        scrollToRoutePosition(options.scrollY);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }

  function openHome(options = {}) {
    if (!options.skipHistory) {
      rememberCurrentScroll();
      writeRoute({ view: 'HOME' });
    }

    stopAudio();
    setSelectedCharacterId(null);
    setCurrentIdx(null);
    setCurrentLoreFile(null);
    setCurrentContent(null);
    setView('HOME');
    setLoading(false);
    scrollToRoutePosition(options.scrollY);
  }

  function openCharacters(options = {}) {
    if (!options.skipHistory) {
      rememberCurrentScroll();
      writeRoute({ view: 'CHARACTERS' });
    }

    stopAudio();
    setSelectedCharacterId(null);
    setView('CHARACTERS');
    setLoading(false);
    scrollToRoutePosition(options.scrollY);
  }

  function openCharacter(characterId, options = {}) {
    if (!options.skipHistory) {
      rememberCurrentScroll();
      writeRoute({ view: 'CHARACTERS', characterId });
    }

    stopAudio();
    setSelectedCharacterId(characterId);
    setView('CHARACTERS');
    setLoading(false);
    scrollToRoutePosition(options.scrollY);
  }

  function returnToReading() {
    if (!readingReturnRoute) return;

    writeRoute(readingReturnRoute);
    applyRoute(readingReturnRoute, { skipHistory: true });
  }

  const toggleSpeech = async () => {
    if (isReading) {
      stopAudio();
      return;
    }

    setTtsLoading(true);
    try {
      const audio = new Audio(`/audio/${lang}/chapter-${currentIdx + 1}.mp3`);
      audioRef.current = audio;

      audio.onended = () => {
        setIsReading(false);
        setTtsLoading(false);
      };

      audio.oncanplaythrough = () => {
        setTtsLoading(false);
        setIsReading(true);
        audio.play().catch((err) => console.error('Playback error:', err));
      };

      audio.onerror = () => {
        setTtsLoading(false);
        setIsReading(false);
        alert(t.audioMissing);
      };
    } catch (error) {
      console.error('Audio error:', error);
      setTtsLoading(false);
      setIsReading(false);
    }
  };

  const handleLike = () => {
    if (hasLiked || currentIdx === null) return;

    const chapterKey = `v5_chapter_${currentIdx + 1}`;
    const likedChapters = JSON.parse(localStorage.getItem('avotu_v5_likes') || '[]');
    likedChapters.push(chapterKey);

    setLikes((prev) => (prev || 0) + 1);
    setHasLiked(true);
    localStorage.setItem('avotu_v5_likes', JSON.stringify(likedChapters));
  };

  function renderCharacterLinkedText(text) {
    if (!characterRegex) return text;

    const parts = [];
    let lastIndex = 0;
    let match;
    characterRegex.lastIndex = 0;

    while ((match = characterRegex.exec(text)) !== null) {
      const prefix = match[1] || '';
      const alias = match[2];
      const aliasStart = match.index + prefix.length;
      const aliasEnd = aliasStart + alias.length;
      const characterId = aliasLookup.get(normaliseAlias(alias, lang));

      if (aliasStart > lastIndex) {
        parts.push(text.slice(lastIndex, aliasStart));
      }

      if (characterId) {
        parts.push(
          <button
            key={`${aliasStart}-${alias}`}
            type="button"
            className="character-link"
            onClick={() => openCharacter(characterId)}
          >
            {alias}
          </button>
        );
      } else {
        parts.push(alias);
      }

      lastIndex = aliasEnd;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  }

  if (loading || !bookIndex) {
    return (
      <div className="app-container loading-screen">
        <h2>{t.loading}</h2>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="header">
        <div className="top-bar">
          <div className="lang-switcher">
            <button className={lang === 'ru' ? 'active' : ''} onClick={() => setLang('ru')}>
              RU
            </button>
            <span className="divider">|</span>
            <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>
              EN
            </button>
          </div>
        </div>

        <div className="hero-content">
          <h1 onClick={() => openHome()}>{bookIndex.title}</h1>
          <p className="subtitle">
            {t.author}: {bookIndex.author}
          </p>
        </div>

        <nav className="main-nav">
          <button className={`nav-link ${view === 'HOME' ? 'active' : ''}`} onClick={() => openHome()}>
            {t.home}
          </button>
          <button className={`nav-link ${view === 'LORE' ? 'active' : ''}`} onClick={() => loadLore(bookIndex.lore)}>
            {t.lore}
          </button>
          <button className={`nav-link ${view === 'CHARACTERS' ? 'active' : ''}`} onClick={openCharacters}>
            {t.characters}
          </button>
        </nav>
      </header>

      <main className={`content-wrapper ${view === 'CHARACTERS' ? 'characters-wide' : ''}`}>
        {view === 'HOME' && (
          <div className="book-content">
            <h2 className="chapter-title">{t.toc}</h2>
            <p className="home-description">{bookIndex.description}</p>
            <div className="chapter-list">
              {bookIndex.chapters.map((chapter, idx) => (
                <button key={chapter.id} onClick={() => loadChapter(chapter, idx)}>
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
            <div className="chapter-header">
              <h2 className="chapter-title">{currentContent.title}</h2>
              <button
                className={`tts-btn ${isReading ? 'reading' : ''} ${ttsLoading ? 'loading' : ''}`}
                onClick={toggleSpeech}
                disabled={ttsLoading}
                type="button"
                aria-label={ttsLoading ? t.generating : isReading ? t.stop : t.listen}
              >
                <span className="tts-icon">{ttsLoading ? '...' : isReading ? '■' : '♪'}</span>
                <span className="tts-tooltip">{ttsLoading ? t.generating : isReading ? t.stop : t.listen}</span>
              </button>
            </div>

            {currentContent.paragraphs.map((paragraph, index) => {
              if (paragraph === '***') {
                return <div key={index} className="scene-break" />;
              }

              return (
                <p key={index} className={index === 0 ? 'dropcap' : ''}>
                  {renderCharacterLinkedText(paragraph)}
                </p>
              );
            })}

            <div className="chapter-stats-footer">
              <div className="stat-item">
                <span className="stat-icon">◈</span>
                <span className="stat-value">{views !== null ? views : '...'}</span>
                <span className="stat-label">{t.views}</span>
              </div>
              <button className={`like-btn ${hasLiked ? 'active' : ''}`} onClick={handleLike} disabled={hasLiked}>
                <span className="stat-icon">{hasLiked ? '♥' : '♡'}</span>
                <span className="stat-value">{likes !== null ? likes : '...'}</span>
                <span className="stat-label">{t.likes}</span>
              </button>
            </div>

            <div className="nav-buttons">
              {currentContent.index !== undefined && currentContent.index > 0 && (
                <button onClick={() => loadChapter(bookIndex.chapters[currentContent.index - 1], currentContent.index - 1)} className="nav-btn">
                  ← {t.prev}
                </button>
              )}
              <button onClick={() => openHome()} className="nav-btn">
                {t.toToc}
              </button>
              {currentContent.index !== undefined && currentContent.index < bookIndex.chapters.length - 1 && (
                <button onClick={() => loadChapter(bookIndex.chapters[currentContent.index + 1], currentContent.index + 1)} className="nav-btn accent">
                  {t.next} →
                </button>
              )}
            </div>
          </article>
        )}

        {view === 'LORE' && currentContent && (
          <div className="book-content">
            <h2 className="chapter-title">{currentContent.title}</h2>
            {currentContent.sections.map((section, index) => (
              <section key={index} className="lore-section">
                <h3>{section.name}</h3>
                <p>{section.content}</p>
              </section>
            ))}
          </div>
        )}

        {view === 'CHARACTERS' && (
          <section className="characters-content">
            {readingReturnRoute && (
              <div className="character-toolbar">
                <button type="button" className="return-reading-btn" onClick={returnToReading}>
                  ← {t.backToReading}
                </button>
              </div>
            )}

            <div className="characters-heading">
              <h2 className="chapter-title">{t.characters}</h2>
              <p>{t.characterIntro}</p>
            </div>

            {selectedCharacter && (
              <article className="character-feature" id={`character-${selectedCharacter.id}`}>
                <img src={selectedCharacter.image} alt={selectedCharacter.name} />
                <div className="character-feature-details">
                  <p className="character-role">{selectedCharacter.role}</p>
                  <h3>{selectedCharacter.name}</h3>
                  <p>{selectedCharacter.description}</p>
                </div>
              </article>
            )}

            <h3 className="character-index-title">{t.characterIndex}</h3>
            <div className="character-grid">
              {characters.map((character) => (
                <button
                  key={character.id}
                  className={`character-card ${selectedCharacterId === character.id ? 'active' : ''}`}
                  onClick={() => openCharacter(character.id)}
                  type="button"
                >
                  <img src={character.avatar || character.image} alt={character.name} loading="lazy" />
                  <span className="character-card-body">
                    <span className="character-card-name">{character.name}</span>
                    <span className="character-card-role">{character.role}</span>
                    <span className="character-card-description">{character.shortDescription}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="footer">
        <div className="footer-actions">
          <button onClick={handleSubscribe} className="social-btn push" type="button">
            <span>+ {t.subscribe}</span>
          </button>
        </div>
        <div className="footer-actions">
          <a href="https://t.me/avotubook" target="_blank" rel="noopener noreferrer" className="social-btn telegram">
            <span>{t.telegram}</span>
          </a>
          <a href="https://www.instagram.com/mays_csq?igsh=Zmh6aGo3cG42OHk4" target="_blank" rel="noopener noreferrer" className="social-btn instagram">
            <span>Instagram</span>
          </a>
        </div>
      </footer>
    </div>
  );
}

export default App;
