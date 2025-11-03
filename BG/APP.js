// Adjust this path to your JSON file
const DATA_URL = '.C:\Users\Nishant\OneDrive\Desktop\BG\SHLOAK.json';

// If your JSON is large, you can lazy-load and keep in memory.
let GITA = null;
let current = null;

// Map a verse object from your schema into a normalized structure the UI expects.
// Update this to match your JSON fields.
function mapVerse(rec) {
  // Try several common schemas; fall back gracefully.
  // Example A: flattened records
  // { chapter: 1, verse: 1, sanskrit: "...", transliteration: "...", translation_en: "..." }
  if (rec.sanskrit || rec.verse_in_sanskrit || rec.text) {
    return {
      chapter: rec.chapter || rec.chapter_number || rec.chapterNo || rec.chapterNum || rec.chapterIndex,
      verse: rec.verse || rec.verse_number || rec.verseNo || rec.verseIndex,
      skt: rec.sanskrit || rec.verse_in_sanskrit || rec.text,
      translit: rec.transliteration || rec.sanskrit_verse_transliteration || rec.translit || '',
      translation: rec.translation_in_english || rec.meaning_in_english || rec.translation_en || rec.translation || rec.meaning || '',
      id: rec.id || `${rec.chapter || rec.chapter_number}-${rec.verse || rec.verse_number}`
    };
  }

  // Example B: nested { chapters: { "1": {...} }, verses: { "1": { "1": { text, meaning } } } }
  if (rec.verses) {
    // Not used when passing a single record; this branch is for full dataset structure.
    // Handled in getRandomVerse by navigating GITA.verses[chapter][verse].
  }

  // Unknown schema: return minimal
  return { chapter: '?', verse: '?', skt: JSON.stringify(rec), translit: '', translation: '', id: crypto.randomUUID() };
}

async function loadData() {
  if (GITA) return GITA;
  const res = await fetch(DATA_URL);
  const json = await res.json();
  GITA = json;
  return GITA;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function flattenDataset(dataset) {
  // Handle a few common shapes into a flat array of verse records.
  if (Array.isArray(dataset)) {
    return dataset.map(mapVerse).filter(v => v.skt);
  }
  // GitHub schema like kashishkhullar/gita_json: verses nested by chapter/verse
  if (dataset.verses) {
    const out = [];
    const chapters = dataset.verses;
    Object.keys(chapters).forEach(ch => {
      const verses = chapters[ch];
      Object.keys(verses).forEach(vno => {
        const v = verses[vno];
        out.push(mapVerse({
          chapter: Number(ch),
          verse: Number(vno),
          text: v.text,
          meaning: v.meaning,
          word_meanings: v.word_meanings
        }));
      });
    });
    return out.filter(v => v.skt);
  }
  // Kaggle-style: key names vary; try best effort
  if (dataset.records) {
    return dataset.records.map(mapVerse).filter(v => v.skt);
  }
  // Fallback: collect all values that look like verses
  return Object.values(dataset).flatMap(v => Array.isArray(v) ? v : []).map(mapVerse).filter(v => v.skt);
}

async function getRandomVerse() {
  const data = await loadData();
  const flat = flattenDataset(data);
  return pickRandom(flat);
}

function render(verse) {
  current = verse;
  const meta = document.getElementById('meta');
  const sanskrit = document.getElementById('sanskrit');
  const translit = document.getElementById('translit');
  const translation = document.getElementById('translation');
  const favBtn = document.getElementById('btn-fav');

  meta.textContent = `Chapter ${verse.chapter} • Verse ${verse.verse}`;
  sanskrit.textContent = verse.skt || '—';
  translit.textContent = verse.translit ? `Transliteration: ${verse.translit}` : '';
  translation.textContent = verse.translation || '';

  // Toggle favourite state
  const fav = isFavourite(verse);
  favBtn.textContent = fav ? '♥ Saved' : '♡ Save';
}

function favKey(v) { return `${v.chapter}:${v.verse}:${(v.skt||'').slice(0,24)}`; }

function getFavourites() {
  try {
    return JSON.parse(localStorage.getItem('gita_favs') || '[]');
  } catch {
    return [];
  }
}

function saveFavourites(list) {
  localStorage.setItem('gita_favs', JSON.stringify(list));
  renderFavList();
}

function isFavourite(v) {
  return getFavourites().some(x => favKey(x) === favKey(v));
}

function toggleFavourite(v) {
  const list = getFavourites();
  const idx = list.findIndex(x => favKey(x) === favKey(v));
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.unshift(v);
  }
  saveFavourites(list);
  render(v);
}

function renderFavList() {
  const box = document.getElementById('fav-list');
  const favs = getFavourites();
  box.innerHTML = '';
  if (!favs.length) {
    const p = document.createElement('div');
    p.className = 'muted small';
    p.textContent = 'No favourites yet.';
    box.appendChild(p);
    return;
  }
  favs.forEach(v => {
    const item = document.createElement('div');
    item.className = 'fav-item small';
    const left = document.createElement('div');
    left.innerHTML = `<div>Ch ${v.chapter}, V ${v.verse}</div><div class="muted">${(v.skt||'').slice(0, 64)}${(v.skt||'').length>64?'…':''}</div>`;
    const right = document.createElement('div');
    const go = document.createElement('button'); go.textContent = 'Open';
    const rm = document.createElement('button'); rm.textContent = 'Remove';
    go.addEventListener('click', () => render(v));
    rm.addEventListener('click', () => {
      const list = getFavourites().filter(x => favKey(x) !== favKey(v));
      saveFavourites(list);
    });
    right.appendChild(go);
    right.appendChild(rm);
    item.appendChild(left);
    item.appendChild(right);
    box.appendChild(item);
  });
}

async function init() {
  renderFavList();
  const verse = await getRandomVerse();
  render(verse);

  document.getElementById('btn-random').addEventListener('click', async () => {
    const v = await getRandomVerse();
    render(v);
  });

  document.getElementById('btn-fav').addEventListener('click', () => {
    if (current) toggleFavourite(current);
  });

  document.getElementById('btn-copy').addEventListener('click', async () => {
    if (!current) return;
    const text = `Bhagavad Gita\nChapter ${current.chapter}, Verse ${current.verse}\n\n${current.skt}\n\n${current.translit ? 'Transliteration: ' + current.translit + '\n\n' : ''}${current.translation ? 'Translation: ' + current.translation : ''}`;
    try { await navigator.clipboard.writeText(text); } catch {}
  });

  document.getElementById('btn-share').addEventListener('click', async () => {
    if (!current) return;
    const shareData = {
      title: `Gita ${current.chapter}:${current.verse}`,
      text: `${current.skt}\n\n${current.translation || ''}`,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch {}
    } else {
      try { await navigator.clipboard.writeText(`${shareData.title}\n\n${shareData.text}`); } catch {}
    }
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    localStorage.removeItem('gita_favs');
    renderFavList();
    if (current) render(current);
  });
}

init();
