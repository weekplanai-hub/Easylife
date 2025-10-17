const PROMPT_FILES = {
  expert1: 'prompt_expert1.txt',
  overall1: 'prompt_overall_intention1.txt',
  preferences1: 'prompt_preferences1.txt',
  output1: 'prompt_outputformat1.txt',
  overall2: 'prompt_overall_intention2.txt',
  preferences2: 'prompt_preferences2.txt',
  output2: 'prompt_outputformat2.txt'
};

const promptCache = new Map();
let loadPromise = null;

const SYSTEM_PROMPT = 'Du er en ekspert innen kostholdsplanlegging og kokkekunst. Følg alle instruksjoner og formatkrav nøyaktig, og svar på norsk.';

async function fetchPrompt(filename) {
  const url = new URL(`./${filename}`, import.meta.url);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Kunne ikke laste promptfilen ${filename} (${res.status})`);
  }
  return res.text();
}

async function ensurePromptsLoaded() {
  if (!loadPromise) {
    loadPromise = Promise.all(
      Object.entries(PROMPT_FILES).map(async ([key, filename]) => {
        const text = await fetchPrompt(filename);
        promptCache.set(key, text.trim());
      })
    );
  }
  await loadPromise;
}

function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map(item => (item === undefined || item === null ? '' : String(item)))
      .map(item => item.trim())
      .filter(Boolean);
  }
  return String(value)
    .split(/[,;\n]+/)
    .map(part => part.trim())
    .filter(Boolean);
}

function formatList(value, fallback = 'ingen') {
  const arr = toArray(value);
  if (!arr.length) return fallback;
  return arr.join(', ');
}

function getUnitsLabel(units) {
  return units === 'imperial' ? 'US (cups, oz)' : 'Metrisk (g, ml)';
}

function toMinutesValue(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function formatMinutesLabel(value) {
  const minutes = toMinutesValue(value, null);
  if (!minutes) return '';
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    if (remaining === 0) {
      return `${hours} t`;
    }
    return `${hours} t ${remaining} min`;
  }
  return `${minutes} min`;
}

function formatTimeWindow(minValue, maxValue) {
  const minLabel = formatMinutesLabel(minValue);
  const maxLabel = formatMinutesLabel(maxValue);
  if (minLabel && maxLabel) {
    if (toMinutesValue(minValue) === toMinutesValue(maxValue)) {
      return `ca. ${minLabel}`;
    }
    return `${minLabel} – ${maxLabel}`;
  }
  if (minLabel) {
    return `fra ${minLabel}`;
  }
  if (maxLabel) {
    return `opptil ${maxLabel}`;
  }
  return 'ikke angitt';
}

function normalizeMealCodes(meals) {
  const arr = toArray(meals).map(code => code.toUpperCase()).filter(code => ['B', 'L', 'D', 'S'].includes(code));
  if (!arr.length) return ['D'];
  return Array.from(new Set(arr));
}

function createCommonValues(settings = {}) {
  const household = Number.parseInt(settings.household, 10) || 2;
  const unitsLabel = getUnitsLabel(settings.measurement);
  const availableMealCodes = normalizeMealCodes(settings.meals);
  const allergiesList = formatList(settings.allergies, 'ingen');
  const notesText = (settings.notes && String(settings.notes).trim()) || 'Ingen ekstra ønsker angitt.';
  const remindersText = (settings.reminders && String(settings.reminders).trim()) || 'Ingen spesielle hensyn registrert.';
  const timeMin = toMinutesValue(settings.prepTimeMin, 10);
  const timeMax = toMinutesValue(settings.prepTimeMax, timeMin);
  const timeRange = formatTimeWindow(timeMin, timeMax || timeMin);
  const householdLabel = `${household} ${household === 1 ? 'person' : 'personer'}`;

  return {
    household,
    householdLabel,
    timeRange,
    timeMin,
    timeMax: timeMax || timeMin,
    unitsLabel,
    mealCodes: availableMealCodes.join(', '),
    availableMealCodes,
    allergiesList,
    notesText,
    remindersText
  };
}

function fillTemplate(template, values) {
  if (!template) return '';
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = values[key];
    if (value === undefined || value === null) return '';
    return String(value);
  });
}

export async function loadRapidPlanPrompts() {
  await ensurePromptsLoaded();
}

export async function buildOverviewPrompt(settings = {}) {
  await ensurePromptsLoaded();
  const values = createCommonValues(settings);
  const preferencesBlock = fillTemplate(promptCache.get('preferences1'), values);
  const promptParts = [
    promptCache.get('expert1'),
    promptCache.get('overall1'),
    preferencesBlock,
    promptCache.get('output1')
  ].filter(Boolean);

  return {
    prompt: promptParts.join('\n\n'),
    systemPrompt: SYSTEM_PROMPT,
    meta: { phase: 'overview' }
  };
}

export async function buildDetailPrompt(settings = {}, item = {}, context = {}) {
  await ensurePromptsLoaded();
  const values = {
    ...createCommonValues(settings),
    dayCode: item.dayCode || context.dayCode || '',
    dayName: context.dayName || item.dayName || '',
    mealCode: (item.mealCode || '').toUpperCase(),
    mealLabel: context.mealLabel || item.mealLabel || '',
    menuName: item.name || item.menuName || '',
    info1: item.info1 || '',
    info2: item.info2 || ''
  };

  const [defaultMealCode] = values.availableMealCodes && values.availableMealCodes.length ? values.availableMealCodes : ['D'];

  if (!values.mealCode || !['B', 'L', 'D', 'S'].includes(values.mealCode)) {
    values.mealCode = defaultMealCode;
  }
  if (!values.mealLabel) {
    const map = { B: 'Frokost', L: 'Lunsj', D: 'Middag', S: 'Kveldsmat' };
    values.mealLabel = map[values.mealCode] || 'Middag';
  }

  const preferencesBlock = fillTemplate(promptCache.get('preferences2'), values);
  const promptParts = [
    promptCache.get('expert1'),
    promptCache.get('overall2'),
    preferencesBlock,
    promptCache.get('output2')
  ].filter(Boolean);

  return {
    prompt: promptParts.join('\n\n'),
    systemPrompt: SYSTEM_PROMPT,
    meta: {
      phase: 'detail',
      dayCode: values.dayCode,
      mealCode: values.mealCode,
      menuName: values.menuName
    }
  };
}

function extractDayCode(rawNumber, fallback) {
  if (typeof rawNumber === 'number' && rawNumber >= 1000 && rawNumber <= 1006) {
    return rawNumber;
  }
  if (typeof rawNumber === 'string') {
    const match = rawNumber.match(/(100[0-6])/);
    if (match) {
      return Number.parseInt(match[1], 10);
    }
  }
  if (typeof fallback === 'number') return fallback;
  return null;
}

function normalizeOverviewEntry(entry, index = 0) {
  if (!entry || typeof entry !== 'object') return null;
  const nummer = entry.nummer ?? entry.number ?? entry.id ?? '';
  const dayCode = extractDayCode(nummer, 1000 + index);
  if (!dayCode) return null;
  const rawMeal = (entry.m ?? entry.meal ?? entry.type ?? '').toString().trim().toUpperCase();
  const mealCode = ['B', 'L', 'D', 'S'].includes(rawMeal) ? rawMeal : 'D';
  const nameSource = entry.navn ?? entry.name ?? entry.title ?? '';
  const name = nameSource ? String(nameSource).trim() : `Middag ${dayCode}`;
  const info1 = entry.info1 ? String(entry.info1).trim() : '';
  const info2 = entry.info2 ? String(entry.info2).trim() : '';

  return {
    nummer: typeof nummer === 'string' ? nummer : `#${dayCode}`,
    dayCode,
    mealCode,
    name,
    info1,
    info2,
    raw: entry
  };
}

export function parseOverviewResponse(text) {
  if (!text) return [];
  let cleaned = String(text).trim();
  cleaned = cleaned.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }
  let data;
  try {
    data = JSON.parse(cleaned);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data
    .map((entry, index) => normalizeOverviewEntry(entry, index))
    .filter(Boolean);
}

export const RAPID_PLAN_SYSTEM_PROMPT = SYSTEM_PROMPT;

export function createPromptValues(settings = {}) {
  return createCommonValues(settings);
}
