import { useEffect, useMemo, useRef, useState } from 'react';
import OneSignal from 'react-onesignal';

const COPY = {
  ru: {
    home: 'Главная',
    lore: 'Лор',
    characters: 'Персонажи',
    comic: 'Комикс',
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
    comicIntro: 'Первая глава в покадровой сборке. Арт без встроенного текста, все надписи добавляются отдельно.',
    backToReading: 'Вернуться к чтению',
    seoTitle: 'О проекте Avotu',
    seoText:
      'Добро пожаловать в мир Avotu — эпическую дарк-фэнтези сагу, доступную для чтения онлайн бесплатно. Это хроники огненного эльфа, людей из другого мира и тех, кто пытается сохранить человечность в мире пепла.',
    audioMissing: 'Озвучка этой главы еще готовится. Подождите пару минут.',
    learnModeOn: 'Режим обучения: Вкл 🎓',
    learnModeOff: 'Режим обучения: Выкл 🎓',
    learnInstructions: 'Нажмите на слово или выделите фразу для дословного перевода.'
  },
  en: {
    home: 'Home',
    lore: 'Lore',
    characters: 'Characters',
    comic: 'Comic',
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
    comicIntro: 'Chapter one assembled panel by panel. Art stays text-free; lettering is added separately.',
    backToReading: 'Back to reading',
    seoTitle: 'About Avotu Project',
    seoText:
      'Welcome to the world of Avotu, an epic dark fantasy saga available to read online for free. These are chronicles of a fire elf, people from another world, and survivors trying to keep their humanity in a world of ash.',
    audioMissing: 'The audio for this chapter is still being prepared. Please wait a little.',
    learnModeOn: 'Learn Mode: On 🎓',
    learnModeOff: 'Learn Mode: Off 🎓',
    learnInstructions: 'Click any word or highlight a phrase for literal translation.'
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
  if (route.view === 'COMIC') return '#comic';
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
  if (cleanHash === 'comic') return { view: 'COMIC' };
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
  const [comicIssue, setComicIssue] = useState(null);
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

  const [isLearnMode, setIsLearnMode] = useState(false);
  const [parallelContent, setParallelContent] = useState(null);
  const [visibleParallelParagraphs, setVisibleParallelParagraphs] = useState({});
  const [activeWordInfo, setActiveWordInfo] = useState(null);
  const [translationCache, setTranslationCache] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('avotu_translations') || '{}');
    } catch (e) {
      return {};
    }
  });

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
      }),
      fetch('/comics/issue-001/manifest.json')
        .then((res) => {
          if (!res.ok) return null;
          return res.json();
        })
        .catch(() => null)
    ])
      .then(([indexData, characterData, comicData]) => {
        if (cancelled) return;
        setBookIndex(indexData);
        setCharacters(characterData.characters || []);
        setComicIssue(comicData);
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
    } else if (view === 'COMIC') {
      title = `${t.comic} | Avotu Saga`;
      desc = 'Panel-by-panel comic adaptation of Avotu Saga.';
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

    if (route.view === 'COMIC') {
      stopAudio();
      setSelectedCharacterId(null);
      setCurrentIdx(null);
      setCurrentLoreFile(null);
      setCurrentContent(null);
      setView('COMIC');
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
    setActiveWordInfo(null);
    setVisibleParallelParagraphs({});

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

    const promises = [
      fetch(chapterPath).then((res) => {
        stopAudio();
        if (!res.ok) throw new Error(`Failed to load ${chapterPath}`);
        return res.json();
      })
    ];

    if (lang === 'en') {
      const ruPath = `/content/ru/${chapter.file.replace('/content/', '')}`;
      promises.push(
        fetch(ruPath)
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null)
      );
    } else {
      promises.push(Promise.resolve(null));
    }

    Promise.all(promises)
      .then(([enData, ruData]) => {
        setCurrentContent({ ...enData, index, chapterData: chapter });
        setParallelContent(ruData);
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

  function openComic(options = {}) {
    if (!options.skipHistory) {
      rememberCurrentScroll();
      writeRoute({ view: 'COMIC' });
    }

    stopAudio();
    setSelectedCharacterId(null);
    setCurrentIdx(null);
    setCurrentLoreFile(null);
    setCurrentContent(null);
    setView('COMIC');
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

  const performTranslation = async (text) => {
    const from = 'en';
    const to = 'ru';
    const cacheKey = `${from}_${to}_${text.toLowerCase().trim()}`;
    if (translationCache[cacheKey]) {
      return translationCache[cacheKey];
    }

    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Translation failed');
      const data = await res.json();
      const result = data[0].map(item => item[0]).join('');
      
      setTranslationCache(prev => {
        const updated = { ...prev, [cacheKey]: result };
        localStorage.setItem('avotu_translations', JSON.stringify(updated));
        return updated;
      });
      return result;
    } catch (err) {
      console.error(err);
      return 'Ошибка перевода';
    }
  };

  const handleWordClick = async (e, word, paragraphText, paragraphIndex) => {
    e.stopPropagation();
    
    const sentences = paragraphText.split(/(?<=[.!?])\s+/);
    const sentence = sentences.find(s => s.includes(word)) || word;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + window.scrollX + rect.width / 2;
    const y = rect.top + window.scrollY;

    setActiveWordInfo({
      word,
      sentence,
      paragraphIndex,
      x,
      y,
      translation: 'Загрузка...',
      sentenceTranslation: '',
      loading: true,
      showSentenceTranslation: false
    });

    const wordTranslation = await performTranslation(word);
    
    setActiveWordInfo(prev => {
      if (!prev || prev.word !== word || prev.paragraphIndex !== paragraphIndex) return prev;
      return {
        ...prev,
        translation: wordTranslation,
        loading: false
      };
    });
  };

  const handleTranslateSentence = async () => {
    if (!activeWordInfo) return;
    setActiveWordInfo(prev => ({ ...prev, loadingSentence: true, showSentenceTranslation: true }));
    const sentenceTranslation = await performTranslation(activeWordInfo.sentence);
    setActiveWordInfo(prev => {
      if (!prev) return null;
      return {
        ...prev,
        sentenceTranslation,
        loadingSentence: false
      };
    });
  };

  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    } else {
      alert('Text-to-speech is not supported in this browser.');
    }
  };

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (activeWordInfo && !e.target.closest('.translation-tooltip') && !e.target.closest('.interactive-word')) {
        setActiveWordInfo(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [activeWordInfo]);

  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();
      if (selectedText.length > 1 && selectedText.length < 150 && view === 'CHAPTER' && isLearnMode) {
        const anchorNode = selection.anchorNode;
        if (anchorNode && anchorNode.parentElement && anchorNode.parentElement.closest('.interactive-paragraph')) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const x = rect.left + window.scrollX + rect.width / 2;
          const y = rect.top + window.scrollY;

          const paragraphElement = anchorNode.parentElement.closest('.interactive-paragraph');
          const paragraphIndex = parseInt(paragraphElement.dataset.index, 10);

          setActiveWordInfo({
            word: selectedText,
            sentence: selectedText,
            paragraphIndex,
            x,
            y,
            translation: 'Загрузка...',
            sentenceTranslation: '',
            loading: true,
            showSentenceTranslation: false,
            isPhrase: true
          });

          performTranslation(selectedText).then(translated => {
            setActiveWordInfo(prev => {
              if (!prev || prev.word !== selectedText) return prev;
              return {
                ...prev,
                translation: translated,
                loading: false
              };
            });
          });
        }
      }
    };

    document.addEventListener('mouseup', handleSelection);
    return () => document.removeEventListener('mouseup', handleSelection);
  }, [view, isLearnMode, translationCache]);

  const renderInteractiveParagraph = (paragraph, index) => {
    if (paragraph === '***') {
      return <div key={index} className="scene-break" />;
    }

    const tokens = paragraph.split(/(\b[a-zA-Z0-9'’-]+)/u);

    return (
      <div key={index} className="paragraph-container">
        <p 
          className={`interactive-paragraph ${index === 0 ? 'dropcap' : ''}`}
          data-index={index}
        >
          {tokens.map((token, tokenIdx) => {
            const isWord = /^[a-zA-Z0-9'’-]+$/.test(token);
            if (isWord) {
              return (
                <span
                  key={tokenIdx}
                  className="interactive-word"
                  onClick={(e) => handleWordClick(e, token, paragraph, index)}
                >
                  {token}
                </span>
              );
            } else {
              return token;
            }
          })}
        </p>

        {visibleParallelParagraphs[index] && parallelContent && parallelContent.paragraphs[index] && (
          <div className="parallel-translation-container">
            <span className="parallel-label">Перевод:</span>
            <p className="parallel-paragraph">
              {parallelContent.paragraphs[index]}
            </p>
          </div>
        )}
      </div>
    );
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
          <button className={`nav-link ${view === 'COMIC' ? 'active' : ''}`} onClick={openComic}>
            {t.comic}
          </button>
        </nav>
      </header>

      <main className={`content-wrapper ${view === 'CHARACTERS' ? 'characters-wide' : ''} ${view === 'LORE' ? 'lore-wide' : ''} ${view === 'COMIC' ? 'comic-wide' : ''}`}>
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

        {view === 'COMIC' && (
          <section className="comic-reader">
            <div className="comic-heading">
              <h2 className="chapter-title">{comicIssue?.title || t.comic}</h2>
              <p>{t.comicIntro}</p>
            </div>

            <div className="comic-pages">
              {(comicIssue?.pages || []).map((page, index) => (
                <figure key={page.id || page.image} className="comic-page">
                  <img
                    src={page.image}
                    alt={page.title || `${t.comic} ${index + 1}`}
                    loading={index === 0 ? 'eager' : 'lazy'}
                  />
                </figure>
              ))}
            </div>
          </section>
        )}

        {view === 'CHAPTER' && currentContent && (
          <article className="book-content">
            <div className="chapter-header">
              <h2 className="chapter-title">{currentContent.title}</h2>
              <div className="chapter-actions">
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

                {lang === 'en' && (
                  <button
                    className={`learn-toggle-btn ${isLearnMode ? 'active' : ''}`}
                    onClick={() => {
                      setIsLearnMode(!isLearnMode);
                      setActiveWordInfo(null);
                    }}
                    type="button"
                  >
                    <span className="learn-icon">🎓</span>
                    <span className="learn-tooltip">{isLearnMode ? t.learnModeOn : t.learnModeOff}</span>
                  </button>
                )}
              </div>
            </div>

            {lang === 'en' && isLearnMode && (
              <p className="learn-instructions-banner">
                {t.learnInstructions}
              </p>
            )}

            {currentContent.paragraphs.map((paragraph, index) => {
              if (paragraph === '***') {
                return <div key={index} className="scene-break" />;
              }

              if (lang === 'en' && isLearnMode) {
                return renderInteractiveParagraph(paragraph, index);
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
          <article className="book-content lore-content">
            {currentContent.kicker && <p className="lore-kicker">{currentContent.kicker}</p>}
            <h2 className="chapter-title">{currentContent.title}</h2>
            {currentContent.intro && <p className="lore-intro">{renderCharacterLinkedText(currentContent.intro)}</p>}

            {Array.isArray(currentContent.facts) && currentContent.facts.length > 0 && (
              <div className="lore-facts" aria-label={currentContent.factsLabel || currentContent.title}>
                {currentContent.facts.map((fact, index) => (
                  <div key={`${fact.label}-${index}`} className="lore-fact">
                    <span className="lore-fact-label">{fact.label}</span>
                    <span className="lore-fact-value">{renderCharacterLinkedText(fact.value)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="lore-grid">
              {currentContent.sections.map((section, index) => (
                <section key={`${section.name}-${index}`} className="lore-section">
                  {section.tag && <span className="lore-section-tag">{section.tag}</span>}
                  <h3>{section.name}</h3>
                  <p>{renderCharacterLinkedText(section.content)}</p>
                </section>
              ))}
            </div>

            {currentContent.canonNote && <p className="lore-canon-note">{renderCharacterLinkedText(currentContent.canonNote)}</p>}
          </article>
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

      {activeWordInfo && (
        <div
          className="translation-tooltip"
          style={{
            position: 'absolute',
            left: `${activeWordInfo.x}px`,
            top: `${activeWordInfo.y - 10}px`,
            transform: 'translate(-50%, -100%)',
            zIndex: 1000
          }}
        >
          <div className="tooltip-arrow" />
          <div className="tooltip-content">
            <div className="tooltip-header">
              <span className="original-word">{activeWordInfo.word}</span>
              <div className="tooltip-header-actions">
                <button className="tooltip-speech-btn" onClick={() => speakText(activeWordInfo.word)} title="Listen">
                  🔊
                </button>
                <button className="tooltip-close-btn" onClick={() => setActiveWordInfo(null)}>
                  ✕
                </button>
              </div>
            </div>
            
            <div className="translation-result">
              {activeWordInfo.loading ? (
                <span className="tooltip-loading">Загрузка перевода...</span>
              ) : (
                <span className="translated-text">{activeWordInfo.translation}</span>
              )}
            </div>

            <div className="tooltip-actions">
              {!activeWordInfo.isPhrase && (
                <button className="tooltip-action-btn" onClick={handleTranslateSentence}>
                  Предложение целиком
                </button>
              )}
              {parallelContent && parallelContent.paragraphs && parallelContent.paragraphs[activeWordInfo.paragraphIndex] && (
                <button 
                  className="tooltip-action-btn" 
                  onClick={() => {
                    setVisibleParallelParagraphs(prev => ({
                      ...prev,
                      [activeWordInfo.paragraphIndex]: !prev[activeWordInfo.paragraphIndex]
                    }));
                  }}
                >
                  {visibleParallelParagraphs[activeWordInfo.paragraphIndex] ? 'Скрыть RU абзац' : 'Показать RU абзац'}
                </button>
              )}
            </div>

            {activeWordInfo.showSentenceTranslation && (
              <div className="sentence-translation-box">
                <p className="sentence-en">{activeWordInfo.sentence}</p>
                <p className="sentence-ru">
                  {activeWordInfo.loadingSentence ? 'Загрузка...' : activeWordInfo.sentenceTranslation}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
