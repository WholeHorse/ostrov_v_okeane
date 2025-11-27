// --- КОНСТАНТЫ ---
const TARGET_CHANNEL_HANDLE = "@solekxnarezka";
const SOUND_FILE = "okeane_ane_ane.mp3";
const AUDIO_DURATION_MS = 8000; // 8 секунд

// --- ПЕРЕМЕННЫЕ СОСТОЯНИЯ ---
let audioObj = null;
let isCurrentTarget = false; // Флаг: находимся ли мы сейчас на нужном канале
let checkInterval = null;    // Переменная для таймера проверки

// Получаем URL аудиофайла
const soundUrl = chrome.runtime.getURL(SOUND_FILE);


// --- СЛУШАТЕЛЬ НАСТРОЕК ---
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (audioObj && changes.volume) {
      audioObj.volume = changes.volume.newValue / 100;
    }
    if (changes.isEnabled && changes.isEnabled.newValue === false) {
      hardStopAudio();
    }
  }
});


// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

// Полная остановка и очистка
function hardStopAudio() {
  if (audioObj) {
    audioObj.pause();
    audioObj.currentTime = 0;
    audioObj = null;
  }
  isCurrentTarget = false;
}

// Проверка канала
function isTargetChannel() {
  // Пробуем разные селекторы, так как верстка YouTube иногда меняется
  // #owner - десктоп, #upload-info - старый/альтернативный, ytd-channel-name - общий
  const selectors = [
    "#owner #channel-name a",
    "#upload-info #channel-name a",
    "ytd-video-owner-renderer #channel-name a"
  ];

  for (let sel of selectors) {
    const link = document.querySelector(sel);
    if (link && link.href) {
      if (link.href.toLowerCase().includes(TARGET_CHANNEL_HANDLE.toLowerCase())) {
        return true;
      }
    }
  }
  return false;
}

// Запуск проигрывания
function startIntro() {
  if (audioObj) return; // Уже создан
  if (!isCurrentTarget) return; // Не тот канал - предохранитель

  chrome.storage.local.get({ isEnabled: true, volume: 50 }, (settings) => {
    if (!settings.isEnabled || !isCurrentTarget) return;

    audioObj = new Audio(soundUrl);
    audioObj.volume = settings.volume / 100;

    // Таймер остановки (8 сек)
    audioObj.ontimeupdate = () => {
      if (audioObj && audioObj.currentTime >= (AUDIO_DURATION_MS / 1000)) {
        hardStopAudio();
      }
    };

    audioObj.onended = () => hardStopAudio();

    audioObj.play().then(() => {
      console.log("Ostrov: Intro started 🎵");
    }).catch(e => {
      console.log("Ostrov: Autoplay blocked", e);
      hardStopAudio();
    });
  });
}


// --- ОСНОВНАЯ ЛОГИКА ---

function handleVideoNavigation() {
  // 1. Сразу при навигации всё сбрасываем
  hardStopAudio();
  if (checkInterval) clearInterval(checkInterval);

  const videoElement = document.querySelector("video.html5-main-video");
  if (!videoElement) return;

  // 2. Запускаем проверку канала. Делаем несколько попыток,
  // так как YouTube обновляет имя канала с задержкой после смены URL.
  let attempts = 0;
  
  checkInterval = setInterval(() => {
    attempts++;
    
    // Ищем элемент канала
    const channelNameElement = document.querySelector("#owner #channel-name a, #upload-info #channel-name a");
    
    // Если элемента нет, ждем дальше (макс 20 попыток = 10 секунд)
    if (!channelNameElement && attempts < 20) return;
    
    // Если попытки вышли
    if (attempts >= 20) {
      clearInterval(checkInterval);
      return;
    }

    // Элемент есть. Проверяем, наш ли это канал.
    if (isTargetChannel()) {
      console.log("Ostrov: Нарезка Solek обнаружена!");
      isCurrentTarget = true;
      clearInterval(checkInterval); // Перестаем искать
      
      // Логика запуска (если видео только началось)
      if (!videoElement.paused && videoElement.currentTime < 5) {
        startIntro();
      }
      
      // ВАЖНО: Вешаем слушатели на видео только один раз.
      // Но так как videoElement на YouTube живет долго, мы используем флаг isCurrentTarget внутри,
      // чтобы не играть звук на чужих каналах, даже если слушатель сработал.
      attachVideoListeners(videoElement);

    } else {
      // Канал найден, но он чужой.
      // Важный момент: если мы нашли имя канала и оно НЕ Solek, 
      // мы точно знаем, что это не наш клиент. Останавливаем таймер.
      console.log("Ostrov: Другой канал, спим.");
      isCurrentTarget = false;
      clearInterval(checkInterval);
    }
  }, 500); // Проверяем каждые полсекунды
}

// Функция привязки событий к плееру
function attachVideoListeners(video) {
  // Чтобы не навешивать кучу одинаковых слушателей, можно использовать свойство (грязный хак, но рабочий)
  // или просто полагаться на флаг isCurrentTarget.
  
  // Удалим старые (если вдруг остались, хотя это сложно без именованных функций)
  // Проще всего: внутри событий проверять isCurrentTarget.
  
  video.onplay = () => {
    if (isCurrentTarget) {
      // Если видео сняли с паузы и интро не доиграло
      if (audioObj) audioObj.play();
      // Или если это самое начало
      else if (video.currentTime < 2) startIntro();
    }
  };

  video.onpause = () => {
    if (audioObj) audioObj.pause();
  };

  video.onseeking = () => {
    // При перемотке всегда убиваем интро
    hardStopAudio();
  };
}


// --- ИНИЦИАЛИЗАЦИЯ ---

// Специальное событие YouTube для навигации (SPA)
document.addEventListener("yt-navigate-finish", handleVideoNavigation);

// На случай первой жесткой загрузки страницы (F5)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handleVideoNavigation);
} else {
    handleVideoNavigation();
}