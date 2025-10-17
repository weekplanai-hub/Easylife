import { createPromptValues, parseOverviewResponse, RAPID_PLAN_SYSTEM_PROMPT } from '../rapidPlanPrompts.js';

const PROMPT_FILES = {
  expert: '../prompt_expert1.txt',
  context: 'prompt_singlemeal_context.txt',
  output: 'prompt_singlemeal_output.txt'
};

const promptCache = new Map();
let loadPromise = null;

function fillTemplate(template, values) {
  if (!template) return '';
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = values[key];
    if (value === undefined || value === null) return '';
    return String(value);
  });
}

async function fetchPrompt(filename) {
  const url = new URL(`./${filename}`, import.meta.url);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Kunne ikke laste promptfilen ${filename} (${res.status})`);
  }
  return res.text();
}

export async function loadMealAdjustmentPrompts() {
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

function resolveMealLabel(mealCode) {
  const map = { B: 'Frokost', L: 'Lunsj', D: 'Middag', S: 'Kveldsmat' };
  const code = (mealCode || '').toUpperCase();
  return map[code] || 'Middag';
}

export async function buildMealReplacementPrompt(settings = {}, context = {}) {
  await loadMealAdjustmentPrompts();
  const values = {
    ...createPromptValues(settings),
    dayCode: context.dayCode || 1000,
    dayName: context.dayName || `Dag ${context.dayCode || ''}`,
    mealCode: (context.mealCode || '').toUpperCase() || 'D',
    mealLabel: context.mealLabel || resolveMealLabel(context.mealCode),
    previousName: context.previousName || 'ingen spesifisert',
    previousInfo1: context.previousInfo1 || '',
    previousInfo2: context.previousInfo2 || ''
  };

  if (!['B', 'L', 'D', 'S'].includes(values.mealCode)) {
    values.mealCode = 'D';
  }
  if (!values.mealLabel) {
    values.mealLabel = resolveMealLabel(values.mealCode);
  }

  const parts = [
    promptCache.get('expert'),
    fillTemplate(promptCache.get('context'), values),
    fillTemplate(promptCache.get('output'), values)
  ].filter(Boolean);

  return {
    prompt: parts.join('\n\n'),
    systemPrompt: RAPID_PLAN_SYSTEM_PROMPT,
    meta: {
      phase: 'adjustment',
      dayCode: values.dayCode,
      mealCode: values.mealCode
    }
  };
}

export { parseOverviewResponse as parseAdjustmentResponse };
