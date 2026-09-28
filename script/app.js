const API_KEY = '1b8ede4c61109a6d1d3c96d36a9e6e56';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';
const ICON_URL = (icon) => `https://openweathermap.org/img/wn/${icon}@2x.png`;

const STORAGE_KEYS = {
  history: 'langit_history',
  unit: 'langit_unit',
};

const dom = {
  unitToggle: document.querySelector('#unitToggle'),
  searchForm: document.querySelector('#searchForm'),
  cityInput: document.querySelector('#cityInput'),
  historyRow: document.querySelector('#historyRow'),
  loadingState: document.querySelector('#loadingState'),
  errorState: document.querySelector('#errorState'),
  errorMessage: document.querySelector('#errorMessage'),
  emptyState: document.querySelector('#emptyState'),
  weatherResult: document.querySelector('#weatherResult'),
  cityName: document.querySelector('#cityName'),
  weatherDate: document.querySelector('#weatherDate'),
  weatherIcon: document.querySelector('#weatherIcon'),
  temperature: document.querySelector('#temperature'),
  description: document.querySelector('#description'),
  feelsLike: document.querySelector('#feelsLike'),
  humidity: document.querySelector('#humidity'),
  wind: document.querySelector('#wind'),
  forecastSection: document.querySelector('#forecastSection'),
  forecastRow: document.querySelector('#forecastRow'),
};

const state = {
  unit: localStorage.getItem(STORAGE_KEYS.unit) || 'C',
  current: null,
  forecastDays: [],
};

const readHistory = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.history);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
};

const writeHistory = (list) => {
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(list));
};

const pushHistory = (city) => {
  const normalized = city.trim();
  const existing = readHistory().filter(
    (item) => item.toLowerCase() !== normalized.toLowerCase()
  );
  const updated = [normalized, ...existing].slice(0, 6);
  writeHistory(updated);
  renderHistory();
};

const removeHistoryItem = (city) => {
  const updated = readHistory().filter((item) => item !== city);
  writeHistory(updated);
  renderHistory();
};

const renderHistory = () => {
  const items = readHistory();
  dom.historyRow.innerHTML = '';
  items.forEach((city) => {
    const chip = document.createElement('span');
    chip.className = 'history-chip';

    const label = document.createElement('button');
    label.type = 'button';
    label.textContent = city;
    label.addEventListener('click', () => {
      dom.cityInput.value = city;
      loadCity(city);
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Hapus ${city} dari riwayat`);
    remove.addEventListener('click', (event) => {
      event.stopPropagation();
      removeHistoryItem(city);
    });

    chip.append(label, remove);
    dom.historyRow.append(chip);
  });
};

const celsiusToFahrenheit = (celsius) => celsius * (9 / 5) + 32;

const formatTemp = (celsius) => {
  const value =
    state.unit === 'C' ? celsius : celsiusToFahrenheit(celsius);
  return `${Math.round(value)}°${state.unit}`;
};

const setUnit = (unit) => {
  state.unit = unit;
  localStorage.setItem(STORAGE_KEYS.unit, unit);
  dom.unitToggle.querySelectorAll('.unit-option').forEach((el) => {
    el.classList.toggle('active', el.dataset.unit === unit);
  });
  if (state.current) renderWeather(state.current);
  if (state.forecastDays.length) renderForecast(state.forecastDays);
};

const showState = (name) => {
  const panels = {
    loading: dom.loadingState,
    error: dom.errorState,
    empty: dom.emptyState,
    result: dom.weatherResult,
  };
  Object.values(panels).forEach((panel) => panel.classList.add('hidden'));
  dom.forecastSection.classList.add('hidden');
  if (panels[name]) panels[name].classList.remove('hidden');
};

const showError = (message) => {
  dom.errorMessage.textContent = message;
  showState('error');
};

async function fetchCurrentWeather(city) {
  const url = `${BASE_URL}/weather?q=${encodeURIComponent(
    city
  )}&appid=${API_KEY}&units=metric&lang=id`;
  const res = await fetch(url);

  if (res.status === 404) {
    throw new Error(`Kota "${city}" tidak ditemukan.`);
  }
  if (res.status === 401) {
    throw new Error('API key tidak valid. Periksa kembali di pengaturan.');
  }
  if (!res.ok) {
    throw new Error(`Server error (${res.status}). Coba lagi nanti.`);
  }

  return res.json();
}

async function fetchForecast(city) {
  const url = `${BASE_URL}/forecast?q=${encodeURIComponent(
    city
  )}&appid=${API_KEY}&units=metric&lang=id`;
  const res = await fetch(url);

  if (!res.ok) {
    return [];
  }

  const { list } = await res.json();
  return groupForecastByDay(list);
}

function groupForecastByDay(list) {
  const grouped = list.reduce((acc, entry) => {
    const dateKey = entry.dt_txt.split(' ')[0];
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(entry);
    return acc;
  }, {});

  const days = Object.entries(grouped).map(([dateKey, entries]) => {
    const representative = entries.reduce((closest, entry) => {
      const hour = Number(entry.dt_txt.split(' ')[1].slice(0, 2));
      const closestHour = Number(
        closest.dt_txt.split(' ')[1].slice(0, 2)
      );
      return Math.abs(hour - 12) < Math.abs(closestHour - 12)
        ? entry
        : closest;
    });

    const temps = entries.map((entry) => entry.main.temp);
    const min = Math.min(...temps);
    const max = Math.max(...temps);

    return {
      date: dateKey,
      icon: representative.weather[0].icon,
      description: representative.weather[0].description,
      min,
      max,
    };
  });

  const today = new Date().toISOString().split('T')[0];
  return days.filter((day) => day.date !== today).slice(0, 5);
}

const weekdayLabel = (dateString) => {
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString('id-ID', { weekday: 'short' });
};

const renderWeather = (data) => {
  const {
    name,
    main: { temp, feels_like, humidity },
    weather,
    wind,
  } = data;
  const [firstWeather] = weather;

  dom.cityName.textContent = `${name}, ${data.sys?.country ?? ''}`;
  dom.weatherDate.textContent = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  dom.weatherIcon.src = ICON_URL(firstWeather.icon);
  dom.weatherIcon.alt = firstWeather.description;
  dom.temperature.textContent = formatTemp(temp);
  dom.description.textContent = firstWeather.description;
  dom.feelsLike.textContent = formatTemp(feels_like);
  dom.humidity.textContent = `${humidity}%`;
  dom.wind.textContent = `${wind.speed} m/s`;

  showState('result');
};

const renderForecast = (days) => {
  if (!days.length) {
    dom.forecastSection.classList.add('hidden');
    return;
  }

  dom.forecastRow.innerHTML = '';
  days.forEach((day) => {
    const card = document.createElement('div');
    card.className = 'forecast-day';
    card.innerHTML = `
      <span class="day-label">${weekdayLabel(day.date)}</span>
      <img src="${ICON_URL(day.icon)}" alt="${day.description}">
      <span class="day-temp">${formatTemp(day.max)} <span class="min">${formatTemp(
      day.min
    )}</span></span>
    `;
    dom.forecastRow.append(card);
  });

  dom.forecastSection.classList.remove('hidden');
};

async function loadCity(cityInput) {
  const city = cityInput.trim();
  if (!city) {
    showError('Nama kota tidak boleh kosong.');
    return;
  }

  showState('loading');

  try {
    const data = await fetchCurrentWeather(city);
    state.current = data;
    renderWeather(data);
    pushHistory(data.name);

    const forecastDays = await fetchForecast(city);
    state.forecastDays = forecastDays;
    renderForecast(forecastDays);
  } catch (err) {
    if (err instanceof TypeError) {
      showError('Gagal terhubung. Periksa koneksi internet kamu.');
    } else {
      showError(err.message);
    }
  }
}

dom.searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  loadCity(dom.cityInput.value);
});

dom.unitToggle.addEventListener('click', () => {
  setUnit(state.unit === 'C' ? 'F' : 'C');
});

const init = () => {
  setUnit(state.unit);
  renderHistory();
  showState('empty');
};

init();
