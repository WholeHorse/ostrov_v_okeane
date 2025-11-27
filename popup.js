document.addEventListener('DOMContentLoaded', () => {
  // Загружаем только статус и громкость
  chrome.storage.local.get({
    isEnabled: true,
    volume: 50
  }, (items) => {
    document.getElementById('togglePlugin').checked = items.isEnabled;
    document.getElementById('volumeSlider').value = items.volume;
    document.getElementById('volValue').innerText = items.volume + '%';
  });
});

// Сохранение переключателя
document.getElementById('togglePlugin').addEventListener('change', (e) => {
  chrome.storage.local.set({ isEnabled: e.target.checked });
});

// Сохранение громкости
document.getElementById('volumeSlider').addEventListener('input', (e) => {
  const val = e.target.value;
  document.getElementById('volValue').innerText = val + '%';
  chrome.storage.local.set({ volume: parseInt(val) });
});