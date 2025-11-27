// --- КОНСТАНТЫ ---
const TARGET_CHANNEL_HANDLE = "@solekxnarezka";
const SOUND_FILE = "okeane_ane_ane.mp3";
const AUDIO_DURATION_MS = 8000; // 8 секунд (лимит)

// --- ПЕРЕМЕННЫЕ СОСТОЯНИЯ ---
let audioObj = null;
let lastUrl = location.href;

// Путь к файлу
const soundUrl = chrome.runtime.getURL(SOUND_FILE);

// --- СЛУШАТЕЛЬ ИЗМЕНЕНИЙ НАСТРОЕК (В РЕАЛЬНОМ ВРЕМЕНИ) ---
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && audioObj) {
    // Если изменилась громкость — применяем сразу
    if (changes.volume) {
      const newVol = changes.volume.newValue;
      audioObj.volume = newVol / 100;
      console.log(`Громкость изменена на лету: ${newVol}%`);
    }
    
    // Если выключили плагин во время проигрывания — останавливаем
    if (changes.isEnabled && changes.isEnabled.newValue === false) {
      stopAudio();
    }
  }
});

// --- ФУНКЦИИ ---

function isTargetChannel() {
  const channelLink = document.querySelector("#upload-info #channel-name a");
  if (channelLink) {
    const href = channelLink.getAttribute("href");
    if (href && href.toLowerCase().includes(TARGET_CHANNEL_HANDLE.toLowerCase())) {
      return true;
    }
  }
  return false;
}

function stopAudio() {
  if (audioObj) {
    audioObj.pause();
    audioObj.currentTime = 0;
    // Удаляем объект, чтобы освободить память
    audioObj = null; 
    console.log("Audio stopped and cleared.");
  }
}

// Создание и запуск аудио
function startIntro() {
  // Если аудио уже есть (например, на паузе) — не создаем новое
  if (audioObj) return;

  chrome.storage.local.get({ isEnabled: true, volume: 50 }, (settings) => {
    if (!settings.isEnabled) return;

    audioObj = new Audio(soundUrl);
    audioObj.volume = settings.volume / 100;

    // ЛОГИКА ОГРАНИЧЕНИЯ ВРЕМЕНИ
    // Мы следим за временем самого аудио. Это позволяет работать паузе корректно.
    audioObj.ontimeupdate = () => {
      // Если проиграли больше 8 секунд
      if (audioObj.currentTime >= (AUDIO_DURATION_MS / 1000)) {
        stopAudio();
      }
    };

    // Если трек закончился сам
    audioObj.onended = () => {
      stopAudio();
    };

    audioObj.play().then(() => {
      console.log("Intro started.");
    }).catch(e => {
      console.error("Autoplay blocked or error:", e);
      stopAudio();
    });
  });
}

// --- ГЛАВНАЯ ЛОГИКА ---

function setupVideoListener() {
  const urlParams = new URLSearchParams(window.location.search);
  if (!urlParams.get("v")) return;

  const videoElement = document.querySelector("video.html5-main-video");
  if (!videoElement) return;

  // Ждем прогрузки информации о канале
  const checkChannelInterval = setInterval(() => {
    if (document.querySelector("#upload-info #channel-name a")) {
      clearInterval(checkChannelInterval);
      
      if (isTargetChannel()) {
        console.log("Целевой канал. Настройка синхронизации.");

        // 1. СОБЫТИЕ: PLAY (Нажатие плей или автостарт)
        videoElement.addEventListener("play", () => {
          // Ситуация А: Мы продолжаем просмотр после паузы, и интро еще не доиграло
          if (audioObj) {
             audioObj.play();
             console.log("Video resumed -> Intro resumed");
          } 
          // Ситуация Б: Это начало видео
          else if (videoElement.currentTime < 2) {
             startIntro();
          }
        });

        // 2. СОБЫТИЕ: PAUSE (Нажатие паузы)
        videoElement.addEventListener("pause", () => {
          if (audioObj) {
            audioObj.pause();
            console.log("Video paused -> Intro paused");
          }
        });

        // 3. СОБЫТИЕ: SEEKING (Перемотка)
        videoElement.addEventListener("seeking", () => {
          // При перемотке всегда выключаем интро, чтобы не бесило
          stopAudio();
          console.log("Seeking detected -> Intro killed");
        });
        
        // 4. ПРОВЕРКА ПРИ ЗАГРУЗКЕ
        // Если видео уже идет (автоплей сработал быстрее скрипта)
        if (!videoElement.paused && videoElement.currentTime < 2) {
           startIntro();
        }

      } else {
        // Если перешли на другой канал - стоп
        stopAudio();
      }
    }
  }, 500);
}

// Наблюдатель за сменой видео (YouTube SPA)
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    stopAudio(); // Убираем звук от старого видео
    setupVideoListener(); // Инициализируем для нового
  }
}).observe(document, {subtree: true, childList: true});

// Первый запуск
setupVideoListener();