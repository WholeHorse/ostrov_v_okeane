// --- НАСТРОЙКИ ---
const TARGET_CHANNEL_HANDLE = "@solekxnarezka";
const AUDIO_DURATION_MS = 8000; // 8 секунд

// --- ПЕРЕМЕННЫЕ СОСТОЯНИЯ ---
let audioObj = null;
let stopTimeout = null;
let currentVideoId = "";

// Функция для получения полного пути к файлу внутри расширения
const soundUrl = chrome.runtime.getURL("okeane_ane_ane.mp3");

// Функция проверки канала
function isTargetChannel() {
  // Ищем элемент с ссылкой на канал под видео
  const channelLink = document.querySelector("#upload-info #channel-name a");
  
  if (channelLink) {
    const href = channelLink.getAttribute("href"); // обычно /@ChannelName
    const text = channelLink.innerText;
    
    // Проверяем либо ссылку, либо текст (приводим к нижнему регистру для надежности)
    if (href && href.toLowerCase().includes(TARGET_CHANNEL_HANDLE.toLowerCase())) {
      return true;
    }
    // Иногда YouTube показывает просто имя без @ в тексте, но ссылка надежнее
  }
  return false;
}

// Функция остановки звука
function stopAudio() {
  if (audioObj) {
    audioObj.pause();
    audioObj.currentTime = 0; // Сброс в начало
    audioObj = null;
  }
  if (stopTimeout) {
    clearTimeout(stopTimeout);
    stopTimeout = null;
  }
}

// Функция запуска звука
function playIntro() {
  // Если уже играет - не запускаем заново
  if (audioObj) return;

  audioObj = new Audio(soundUrl);
  audioObj.volume = 0.5; // Громкость 50%
  
  audioObj.play().then(() => {
    console.log("Intro started!");
    // Таймер на 8 секунд для остановки
    stopTimeout = setTimeout(() => {
      stopAudio();
      console.log("Intro finished naturally.");
    }, AUDIO_DURATION_MS);
  }).catch(e => console.error("Ошибка воспроизведения аудио:", e));
}

// Главная функция настройки видеоплеера
function setupVideoListener() {
  // Проверяем, изменилось ли видео (YouTube SPA навигация)
  const urlParams = new URLSearchParams(window.location.search);
  const newVideoId = urlParams.get("v");

  if (!newVideoId) return; // Мы не на странице видео

  const videoElement = document.querySelector("video.html5-main-video");
  
  if (!videoElement) return;

  // Если это то же самое видео и мы уже настроили слушатели - выходим,
  // НО нам нужно проверять канал каждый раз, так как элементы подгружаются асинхронно.
  
  // Логика:
  // 1. Ждем, пока прогрузится инфо о канале.
  // 2. Если канал наш -> вешаем слушатели на видео.
  
  const checkChannelInterval = setInterval(() => {
    // Проверяем наличие элемента канала
    if (document.querySelector("#upload-info #channel-name a")) {
      clearInterval(checkChannelInterval);
      
      if (isTargetChannel()) {
        console.log("Целевой канал обнаружен. Активация интро.");
        
        // Удаляем старые слушатели (через клонирование элемента - грязный хак, 
        // но самый простой способ сбросить слушатели в расширениях, если не сохранять ссылки)
        // Но лучше просто добавить проверку флагов, чтобы не ломать плеер YouTube.
        
        // Добавляем слушатель "play"
        videoElement.addEventListener("play", () => {
             // Запускаем только если текущее время видео близко к началу (например, < 2 сек)
             // Если нужно, чтобы играло ВСЕГДА при нажатии play, убери условие currentTime
             if (videoElement.currentTime < 2) {
                 playIntro();
             }
        });

        // Добавляем слушатель "seeking" (перемотка) -> останавливаем звук
        videoElement.addEventListener("seeking", () => {
          console.log("Перемотка обнаружена. Остановка интро.");
          stopAudio();
        });
        
        // Если видео уже играет при загрузке страницы (autoplay)
        if (!videoElement.paused && videoElement.currentTime < 2) {
             playIntro();
        }

      } else {
        console.log("Это не тот канал.");
        stopAudio(); // На всякий случай
      }
    }
  }, 500); // Проверяем каждые полсекунды, пока не загрузится DOM
}

// --- НАБЛЮДАТЕЛЬ (OBSERVER) ---
// Так как YouTube не перезагружает страницу, нам нужен Observer, 
// чтобы следить за изменениями URL или тела страницы.

let lastUrl = location.href; 
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    stopAudio(); // Остановить звук от предыдущего видео
    setupVideoListener(); // Перенастроить на новое видео
  }
}).observe(document, {subtree: true, childList: true});

// Первый запуск при загрузке страницы
setupVideoListener();