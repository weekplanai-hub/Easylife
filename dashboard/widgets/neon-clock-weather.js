const WEATHER_CODES = {
  0: ['☀️', 'Klarvær'],
  1: ['🌤', 'For det meste klart'],
  2: ['⛅️', 'Delvis skyet'],
  3: ['☁️', 'Overskyet'],
  45: ['🌫', 'Tåke'],
  48: ['🌫', 'Is-tåke'],
  51: ['🌧', 'Yr'],
  53: ['🌧', 'Yr'],
  55: ['🌧', 'Yr'],
  61: ['🌦', 'Regn'],
  63: ['🌧', 'Regn'],
  65: ['🌧', 'Kraftig regn'],
  66: ['🌧', 'Frysende regn'],
  67: ['🌧', 'Frysende regn'],
  71: ['🌨', 'Snø'],
  73: ['🌨', 'Snø'],
  75: ['❄️', 'Kraftig snø'],
  77: ['❄️', 'Snøkorn'],
  80: ['🌦', 'Byger'],
  81: ['🌦', 'Byger'],
  82: ['🌧', 'Kraftige byger'],
  95: ['⛈', 'Tordenbyger'],
  96: ['⛈', 'Torden m. sludd'],
  99: ['⛈', 'Torden m. hagl'],
};

const FALLBACK_WEATHER = {
  icon: '⛅️',
  temp: '18°',
  meta: 'Delvis skyet • Føles som 17°',
  place: 'Oslo (demo)',
  wind: 'Vind: 3 m/s',
  feels: 'Føles som: 17°',
  uv: 'UV: 2',
};

function pad(value) {
  return String(value).padStart(2, '0');
}

function greetByHour(hour) {
  if (hour < 5) return ['God natt 🌙', 'Ro ned kroppen'];
  if (hour < 11) return ['God morgen ☀️', 'Små steg → store resultater'];
  if (hour < 17) return ['God ettermiddag ✨', 'Hold flytsonen'];
  if (hour < 22) return ['God kveld 🌆', 'En ting som betyr noe'];
  return ['God natt 🌙', 'Takk for i dag – skriv 1 notat'];
}

function applyWeather(elements, data) {
  const current = data.current;
  const [icon, description] = WEATHER_CODES[current.weather_code] || ['🌡', 'Vær'];
  if (elements.icon) elements.icon.textContent = icon;
  if (elements.temp) elements.temp.textContent = `${Math.round(current.temperature_2m)}°`;
  if (elements.meta) {
    const feels = Math.round(current.apparent_temperature);
    elements.meta.textContent = `${description} • Føles som ${Number.isFinite(feels) ? feels : '–'}°`;
  }
  if (elements.wind) {
    const wind = Math.round(current.wind_speed_10m ?? Number.NaN);
    elements.wind.textContent = `Vind: ${Number.isFinite(wind) ? wind : '–'} m/s`;
  }
  if (elements.feels) {
    const feels = Math.round(current.apparent_temperature ?? Number.NaN);
    elements.feels.textContent = `Føles som: ${Number.isFinite(feels) ? feels : '–'}°`;
  }
  if (elements.uv) {
    const uv = current.uv_index;
    elements.uv.textContent = `UV: ${uv ?? '–'}`;
  }
}

function applyFallbackWeather(elements) {
  if (elements.icon) elements.icon.textContent = FALLBACK_WEATHER.icon;
  if (elements.temp) elements.temp.textContent = FALLBACK_WEATHER.temp;
  if (elements.meta) elements.meta.textContent = FALLBACK_WEATHER.meta;
  if (elements.place) elements.place.textContent = FALLBACK_WEATHER.place;
  if (elements.wind) elements.wind.textContent = FALLBACK_WEATHER.wind;
  if (elements.feels) elements.feels.textContent = FALLBACK_WEATHER.feels;
  if (elements.uv) elements.uv.textContent = FALLBACK_WEATHER.uv;
}

function getCoordinates() {
  if (!('geolocation' in navigator)) {
    return Promise.reject(new Error('Geolocation not supported'));
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Geolocation timeout'));
    }, 10000);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeoutId);
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  });
}

async function reverseGeocode({ lat, lon }) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
    );

    if (!response.ok) throw new Error('Reverse geocode failed');
    const json = await response.json();
    const address = json.address || {};
    return (
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      (json.display_name ? json.display_name.split(',')[0] : null) ||
      'Din posisjon'
    );
  } catch (error) {
    console.warn('Kunne ikke hente stedsnavn', error);
    return 'Din posisjon';
  }
}

async function fetchWeather(elements) {
  try {
    const coords = await getCoordinates();
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat.toFixed(
      3
    )}&longitude=${coords.lon.toFixed(
      3
    )}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,uv_index&timezone=auto`;
    const response = await fetch(weatherUrl);
    if (!response.ok) throw new Error('Weather request failed');

    const data = await response.json();
    if (!data?.current) throw new Error('Weather payload mangler current');

    applyWeather(elements, data);
    if (elements.place) {
      elements.place.textContent = await reverseGeocode(coords);
    }
  } catch (error) {
    console.warn('Kunne ikke hente værdata', error);
    applyFallbackWeather(elements);
  }
}

export function initNeonClockWidget(root = document) {
  const widget = root.querySelector('[data-neon-widget]');
  if (!widget) return;

  const ring = widget.querySelector('[data-ring]');
  const secondHand = widget.querySelector('[data-second-hand]');
  const hhmm = widget.querySelector('[data-hhmm]');
  const sec = widget.querySelector('[data-sec]');
  const greeting = widget.querySelector('[data-greeting]');
  const message = widget.querySelector('[data-message]');
  const date = widget.querySelector('[data-date]');
  const weatherElements = {
    icon: widget.querySelector('[data-weather-icon]'),
    temp: widget.querySelector('[data-weather-temp]'),
    meta: widget.querySelector('[data-weather-meta]'),
    place: widget.querySelector('[data-weather-place]'),
    wind: widget.querySelector('[data-weather-wind]'),
    feels: widget.querySelector('[data-weather-feels]'),
    uv: widget.querySelector('[data-weather-uv]'),
  };

  let lastMinute = -1;
  let lastHour = -1;

  function render() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const fractionalSeconds = seconds + now.getMilliseconds() / 1000;
    const rotation = (fractionalSeconds / 60) * 360;

    if (ring) {
      ring.style.setProperty('--progress', `${rotation}deg`);
      ring.style.setProperty('--second-rotation', `${rotation}deg`);
    }
    if (secondHand) {
      secondHand.style.setProperty('--second-rotation', `${rotation}deg`);
    }
    if (hhmm) hhmm.textContent = `${pad(hours)}:${pad(minutes)}`;
    if (sec) sec.textContent = `${pad(seconds)} sek`;

    if (minutes !== lastMinute && date) {
      lastMinute = minutes;
      date.textContent = new Intl.DateTimeFormat('no-NO', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(now);
    }

    if (hours !== lastHour) {
      lastHour = hours;
      const [greet, msg] = greetByHour(hours);
      if (greeting) greeting.textContent = greet;
      if (message) message.textContent = msg;
    }

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
  fetchWeather(weatherElements);
}
