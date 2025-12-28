const translations = {
  ko: {
    logo: '어좁이 테스트',
    heroTitle: '어좁이 테스트',
    heroSub: '얼굴 폭 대비 어깨 폭 비율(S/H ratio)로 내 어깨 넓이를 측정',
    introTitle: '어깨 넓이 테스트 소개',
    introDesc: '어좁이 테스트는 얼굴 폭 대비 어깨 폭 비율(S/H ratio)을 계산해 어깨 넓이를 빠르게 확인하는 도구입니다. 남자 어깨 비율을 포함한 다양한 어깨 넓이를 재미로 체크할 수 있어요.',
    introStepsTitle: '사용 방법',
    introStep1: '정면 사진 1장을 업로드',
    introStep2: '얼굴과 어깨가 모두 보이도록 프레임에 맞추기',
    introStep3: '측정된 S/H ratio와 퍼센트를 확인',
    badgeAI: '🧠 AI 분석',
    badgePrivacy: '🔒 데이터 저장 X',
    badgeSpeed: '⚡ 빠른 결과',
    uploadTitle: '사진 업로드',
    uploadHelper: '정면 1장 · 한 명만 · 어깨와 얼굴 모두 프레임 안에 위치',
    placeholder: '이미지를 탭하거나 끌어놓기',
    analyzeError: '분석 실패',
    statusDefault: '사진을 선택하면 미리보기 후, 결과가 바로 위 영역에 표시됩니다.',
    statusPrompt: '분석을 시작하세요.',
    statusSelect: '사진을 선택하세요.',
    analyzing: '분석 중...',
    done: '완료',
    statusLocked: '다른 사진으로 시도하기 버튼을 눌러주세요.',
    nicknameDefault: '별명 대기중',
    percentileDefault: '상위/하위 퍼센트',
    quipDefault: '한줄평은 분석 후 표시됩니다.',
    ratioLabel: 'S/H RATIO',
    retry: '다른 사진으로 시도하기',
    mosaicOn: '얼굴 모자이크 0',
    mosaicOff: '얼굴 모자이크 X',
    share: '공유하기',
    sharePrep: '준비 중...',
    shareFallback: '이미지를 새 탭에 열었어요. 길게 눌러 저장/공유하세요.',
  },
  en: {
    logo: 'Shoulder Ratio Test',
    heroTitle: 'Shoulder Ratio Test',
    heroSub: 'Check your shoulder type with the S/H ratio, just for fun.',
    introTitle: 'About the Shoulder Width Test',
    introDesc: 'The Shoulder Ratio Test estimates shoulder width by comparing shoulder width to face width (S/H ratio). It is a quick, fun way to check shoulder proportions.',
    introStepsTitle: 'How it works',
    introStep1: 'Upload one front-facing photo',
    introStep2: 'Keep your face and shoulders fully in frame',
    introStep3: 'Review your S/H ratio and percentile',
    badgeAI: '🧠 AI Analysis',
    badgePrivacy: '🔒 No data saved',
    badgeSpeed: '⚡ Quick result',
    uploadTitle: 'Upload photo',
    uploadHelper: 'One person, front-facing, shoulders & face in frame',
    placeholder: 'Tap or drop an image',
    analyzeError: 'Analysis failed',
    statusDefault: 'Pick a photo to preview; result will appear above.',
    statusPrompt: 'Ready to analyze.',
    statusSelect: 'Select a photo.',
    analyzing: 'Analyzing...',
    done: 'Done',
    statusLocked: 'Tap “Try another photo” first.',
    nicknameDefault: 'Waiting for nickname',
    percentileDefault: 'Percentile',
    quipDefault: 'A one-liner will appear after analysis.',
    ratioLabel: 'S/H RATIO',
    retry: 'Try another photo',
    mosaicOn: 'Mosaic On',
    mosaicOff: 'Mosaic Off',
    share: 'Share',
    sharePrep: 'Preparing...',
    shareFallback: 'Opened image in a new tab. Save/share from there.',
  },
};

let currentLang = 'ko';
let isLoading = false;
let mosaicEnabled = true;
let uploadLocked = false;
const fileInput = document.getElementById('fileInput');
const viewer = document.getElementById('viewer');
const statusText = document.getElementById('statusText');
const statsBox = document.getElementById('stats');
const nickBadge = document.getElementById('nickBadge');
const percentChip = document.getElementById('percentChip');
const quipText = document.getElementById('quipText');
const logoText = document.getElementById('logoText');
const langBtn = document.getElementById('langBtn');
const heroTitle = document.getElementById('heroTitle');
const heroSub = document.getElementById('heroSub');
const introTitle = document.getElementById('introTitle');
const introDesc = document.getElementById('introDesc');
const introStepsTitle = document.getElementById('introStepsTitle');
const introStep1 = document.getElementById('introStep1');
const introStep2 = document.getElementById('introStep2');
const introStep3 = document.getElementById('introStep3');
const badgeAI = document.getElementById('badgeAI');
const badgePrivacy = document.getElementById('badgePrivacy');
const badgeSpeed = document.getElementById('badgeSpeed');
const uploadTitle = document.getElementById('uploadTitle');
const uploadHelper = document.getElementById('uploadHelper');
const viewerPlaceholder = document.getElementById('viewerPlaceholder');
const viewerPlaceholderText = document.getElementById('viewerPlaceholderText');
const retryBtn = document.getElementById('retryBtn');
const mosaicOnBtn = document.getElementById('mosaicOn');
const mosaicOffBtn = document.getElementById('mosaicOff');
const shareBtn = document.getElementById('shareBtn');
const shareArea = document.getElementById('shareArea');
const stickerL = document.getElementById('stickerL');
const stickerR = document.getElementById('stickerR');
const loaderId = 'viewerLoader';
const pageLoader = document.getElementById('pageLoader');
const pageLoaderText = document.getElementById('pageLoaderText');

let selectedFile = null;

fileInput.addEventListener('change', (e) => {
  if (uploadLocked) {
    fileInput.value = '';
    statusText.textContent = translations[currentLang].statusLocked;
    return;
  }
  if (e.target.files && e.target.files[0]) {
    setFile(e.target.files[0]);
  }
});

viewer.addEventListener('dragover', (e) => {
  e.preventDefault();
  viewer.style.borderColor = 'rgba(248, 113, 113, 0.9)';
});
viewer.addEventListener('dragleave', () => {
  viewer.style.borderColor = 'rgba(15, 23, 42, 0.14)';
});
viewer.addEventListener('drop', (e) => {
  e.preventDefault();
  viewer.style.borderColor = 'rgba(15, 23, 42, 0.14)';
  const file = e.dataTransfer.files[0];
  if (uploadLocked) {
    statusText.textContent = translations[currentLang].statusLocked;
    return;
  }
  if (file) setFile(file);
});
viewer.addEventListener('click', () => {
  if (uploadLocked) {
    statusText.textContent = translations[currentLang].statusLocked;
    return;
  }
  fileInput.click();
});

mosaicOnBtn.addEventListener('click', () => {
  mosaicEnabled = true;
  updateMosaicButtons();
  if (selectedFile) analyzeSelectedFile();
});
mosaicOffBtn.addEventListener('click', () => {
  mosaicEnabled = false;
  updateMosaicButtons();
  if (selectedFile) analyzeSelectedFile();
});

retryBtn.addEventListener('click', () => {
  resetMeta();
  renderStats({});
  selectedFile = null;
  fileInput.value = '';
  statusText.textContent = translations[currentLang].statusSelect;
  uploadLocked = false;
  viewer.innerHTML = `
    <div class="placeholder" id="viewerPlaceholder">
      <div style="font-size:30px;">📷</div>
      <div id="viewerPlaceholderText">${translations[currentLang].placeholder}</div>
    </div>
  `;
});

shareBtn.addEventListener('click', async () => {
  if (!shareArea) return;
  shareBtn.disabled = true;
  const originalText = shareBtn.textContent;
  shareBtn.textContent = translations[currentLang].sharePrep;
  try {
    const canvas = await html2canvas(shareArea, {
      useCORS: true,
      backgroundColor: getComputedStyle(document.body).backgroundColor || '#ffffff',
      scale: 2,
    });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('capture failed');
    const file = new File([blob], 'shoulder-result.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: translations[currentLang].logo, text: translations[currentLang].heroSub });
    } else {
      const url = canvas.toDataURL('image/png');
      window.open(url, '_blank');
      statusText.textContent = translations[currentLang].shareFallback;
    }
  } catch (e) {
    statusText.textContent = translations[currentLang].shareFallback;
  } finally {
    shareBtn.disabled = false;
    shareBtn.textContent = originalText;
  }
});

async function analyzeSelectedFile() {
  if (!selectedFile || isLoading) return;
  setLoading(true);
  statsBox.innerHTML = '';
  statusText.textContent = translations[currentLang].analyzing;

  const formData = new FormData();
  formData.append('file', selectedFile);
  formData.append('mosaic', mosaicEnabled ? 'true' : 'false');

  try {
    const res = await fetch('/analyze', { method: 'POST', body: formData });
    if (!res.ok) {
      let message = translations[currentLang].analyzeError || '분석 실패';
      try {
        const data = await res.json();
        if (data && data.detail) {
          if (typeof data.detail === 'string') {
            message = data.detail;
          } else if (typeof data.detail === 'object') {
            message = data.detail[currentLang] || Object.values(data.detail)[0] || message;
          }
        }
      } catch (_) { /* ignore */ }
      throw new Error(message);
    }

    const analysisHeader = res.headers.get('X-Analysis');
    if (analysisHeader) {
      const info = JSON.parse(analysisHeader);
      renderBadges(info);
      renderStats(info);
    } else {
      statsBox.innerHTML = '<div class="stat"><label>Info</label><strong>헤더 없음</strong></div>';
    }
    const blob = await res.blob();
    const imgUrl = URL.createObjectURL(blob);
    renderImage(imgUrl);
    statusText.textContent = translations[currentLang].done;
    uploadLocked = true;
  } catch (err) {
    statusText.textContent = err.message || '분석 실패';
    resetMeta();
    renderStats({});
    viewer.innerHTML = `<div class="placeholder">${err.message || '이미지 표시 실패'}</div>`;
  } finally {
    setLoading(false);
  }
}

function setFile(file) {
  selectedFile = file;
  statusText.textContent = selectedFile ? translations[currentLang].statusPrompt : translations[currentLang].statusSelect;
  renderPreview(file);
  analyzeSelectedFile();
}

function renderPreview(file) {
  const reader = new FileReader();
  reader.onload = () => {
    viewer.innerHTML = `<img src="${reader.result}" alt="Preview" />`;
  };
  reader.readAsDataURL(file);
}

function renderImage(url) {
  viewer.innerHTML = '';
  const img = document.createElement('img');
  img.src = url;
  img.alt = 'Result overlay';
  viewer.appendChild(img);
}

function renderBadges(info) {
  const nick = currentLang === 'en'
    ? (info.nickname_en || info.nickname)
    : (info.nickname || info.nickname_en);
  const pct = currentLang === 'en'
    ? (info.percentile_en || info.percentile)
    : (info.percentile || info.percentile_en);
  const quip = currentLang === 'en'
    ? (info.quip_en || info.quip)
    : (info.quip || info.quip_en);

  if (nick) {
    nickBadge.textContent = nick;
    nickBadge.classList.remove('muted');
    nickBadge.dataset.hasResult = '1';
    nickBadge.style.color = pickNickColor(info.ratio);
  } else {
    nickBadge.textContent = translations[currentLang].nicknameDefault;
    nickBadge.classList.add('muted');
    nickBadge.dataset.hasResult = '';
    nickBadge.style.color = '';
  }
  const [sL, sR] = pickStickers(info.ratio);
  stickerL.textContent = sL;
  stickerR.textContent = sR;
  percentChip.textContent = pct || translations[currentLang].percentileDefault;
  percentChip.dataset.hasResult = pct ? '1' : '';
  quipText.textContent = quip || translations[currentLang].quipDefault;
  quipText.classList.toggle('muted', !quip);
  quipText.dataset.hasQuip = quip ? '1' : '';
}

function ratioMeter(ratio) {
  if (!ratio) return '';
  const min = 1.5;
  const max = 2.8;
  const pos = Math.max(0, Math.min(1, (ratio - min) / (max - min)));
  const width = (pos * 100).toFixed(0);
  return `<div class="meter"><span style="width:${width}%;"></span></div>`;
}

function pickNickColor(ratio) {
  const palette = ['#4f46e5', '#06b6d4', '#f59e0b', '#ef4444', '#10b981'];
  if (!ratio) return palette[0];
  if (ratio < 1.8) return palette[1];
  if (ratio < 2.0) return palette[4];
  if (ratio < 2.2) return palette[0];
  if (ratio < 2.4) return palette[2];
  return palette[3];
}

function pickStickers(ratio) {
  if (!ratio) return ['💪', '💪'];
  if (ratio < 1.75) return ['🪽', '🪽'];
  if (ratio < 1.95) return ['🙂', '🙂'];
  if (ratio < 2.2) return ['💪', '💪'];
  if (ratio < 2.45) return ['🔥', '🔥'];
  return ['🦍', '🦍'];
}

function renderStats(info) {
  const label = translations[currentLang].ratioLabel || 'S/H RATIO';
  if (info.ratio) {
    statsBox.innerHTML = `<div class="stat"><label>${label}</label><strong>${info.ratio.toFixed(2)}</strong>${ratioMeter(info.ratio)}</div>`;
  } else {
    statsBox.innerHTML = `<div class="stat"><label>${label}</label><strong>N/A</strong></div>`;
  }
}

function resetMeta() {
  nickBadge.textContent = translations[currentLang].nicknameDefault;
  nickBadge.classList.add('muted');
  nickBadge.dataset.hasResult = '';
  percentChip.textContent = translations[currentLang].percentileDefault;
  percentChip.dataset.hasResult = '';
  quipText.textContent = translations[currentLang].quipDefault;
  quipText.classList.add('muted');
  quipText.dataset.hasQuip = '';
  if (stickerL && stickerR) {
    const [sL, sR] = pickStickers(null);
    stickerL.textContent = sL;
    stickerR.textContent = sR;
  }
}

function updateMosaicButtons() {
  if (mosaicEnabled) {
    mosaicOnBtn.classList.add('active');
    mosaicOffBtn.classList.remove('active');
  } else {
    mosaicOnBtn.classList.remove('active');
    mosaicOffBtn.classList.add('active');
  }
}

function setLoading(loading) {
  isLoading = !!loading;
  viewer.classList.toggle('loading', loading);
  if (pageLoader) {
    pageLoader.classList.toggle('show', loading);
    if (pageLoaderText) {
      pageLoaderText.textContent = translations[currentLang].analyzing || 'Loading...';
    }
  }
  if (loading) {
    removeLoader();
    const overlay = document.createElement('div');
    overlay.className = 'loader-overlay';
    overlay.id = loaderId;
    overlay.innerHTML = `
      <div class="spinner"></div>
      <div class="loader-text">${translations[currentLang].analyzing || 'Loading...'}</div>
    `;
    viewer.appendChild(overlay);
  } else {
    removeLoader();
  }
}

function removeLoader() {
  const exist = document.getElementById(loaderId);
  if (exist) exist.remove();
}

function setLanguage(lang) {
  currentLang = lang;
  const t = translations[lang] || translations.ko;
  langBtn.textContent = lang === 'ko' ? '🌐 EN' : '🌐 KR';
  logoText.textContent = t.logo;
  heroTitle.textContent = t.heroTitle;
  heroSub.textContent = t.heroSub;
  if (introTitle) introTitle.textContent = t.introTitle;
  if (introDesc) introDesc.textContent = t.introDesc;
  if (introStepsTitle) introStepsTitle.textContent = t.introStepsTitle;
  if (introStep1) introStep1.textContent = t.introStep1;
  if (introStep2) introStep2.textContent = t.introStep2;
  if (introStep3) introStep3.textContent = t.introStep3;
  badgeAI.textContent = t.badgeAI;
  badgePrivacy.textContent = t.badgePrivacy;
  badgeSpeed.textContent = t.badgeSpeed;
  uploadTitle.textContent = t.uploadTitle;
  uploadHelper.textContent = t.uploadHelper;
  if (viewerPlaceholderText) viewerPlaceholderText.textContent = t.placeholder;
  retryBtn.textContent = t.retry;
  mosaicOnBtn.textContent = t.mosaicOn;
  mosaicOffBtn.textContent = t.mosaicOff;
  shareBtn.textContent = t.share;
  if (!selectedFile && !isLoading) {
    statusText.textContent = t.statusDefault;
  } else if (selectedFile && !isLoading) {
    statusText.textContent = t.statusPrompt;
  }
  if (nickBadge.dataset.hasResult !== '1') {
    nickBadge.textContent = t.nicknameDefault;
    nickBadge.classList.add('muted');
    nickBadge.style.color = '';
  }
  if (stickerL && stickerR) {
    const [sL, sR] = pickStickers(null);
    stickerL.textContent = sL;
    stickerR.textContent = sR;
  }
  if (percentChip.dataset.hasResult !== '1') {
    percentChip.textContent = t.percentileDefault;
  }
  if (quipText.dataset.hasQuip !== '1') {
    quipText.textContent = t.quipDefault;
    quipText.classList.add('muted');
  }
  if (!statsBox.innerHTML.trim()) {
    renderStats({});
  }
  updateMosaicButtons();
}

langBtn.addEventListener('click', () => {
  setLanguage(currentLang === 'ko' ? 'en' : 'ko');
});

setLanguage('ko');
updateMosaicButtons();
