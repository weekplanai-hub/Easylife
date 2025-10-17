const PROMPT_FILES = {
  expert1: 'prompts/prompt_expert1.txt',
  overall1: 'prompts/prompt_overall_intention1.txt',
  preferences1: 'prompts/prompt_preferences1.txt',
  output1: 'prompts/prompt_outputformat1.txt',
  overall2: 'prompts/prompt_overall_intention2.txt',
  preferences2: 'prompts/prompt_preferences2.txt',
  output2: 'prompts/prompt_outputformat2.txt'
};

const promptCache = new Map();
let loadPromise = null;

export const GOAL_SYSTEM_PROMPT = 'Du er en ekspert i målplanlegging, prosjektledelse og vaneoppfølging. Du skriver alltid på norsk, bruker et motiverende men tydelig språk og følger alle formatkrav nøyaktig.';

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

function fillTemplate(template, values) {
  if (!template) return '';
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = values[key];
    if (value === undefined || value === null) return '';
    return String(value);
  });
}

function formatIsoDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const trimmed = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    return '';
  }
  return date.toISOString().slice(0, 10);
}

function formatLongDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).trim();
  }
  return new Intl.DateTimeFormat('nb-NO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function listToSummary(items, { emptyLabel = 'ingen', mapper } = {}) {
  if (!Array.isArray(items) || !items.length) {
    return emptyLabel;
  }
  const mapped = mapper ? items.map(mapper) : items;
  const cleaned = mapped
    .map((item) => (item === undefined || item === null ? '' : String(item)))
    .map((item) => item.trim())
    .filter(Boolean);
  if (!cleaned.length) {
    return emptyLabel;
  }
  if (cleaned.length <= 6) {
    return cleaned.join(', ');
  }
  const first = cleaned.slice(0, 5).join(', ');
  return `${first} … (${cleaned.length} stk)`;
}

function createPromptValues(goal = {}, { preferencesText = '', milestone = null } = {}) {
  const milestones = Array.isArray(goal.milestones) ? goal.milestones : [];
  const milestoneSummary = listToSummary(milestones, {
    emptyLabel: 'ingen registrerte',
    mapper: (item) => {
      const title = (item?.title || '').trim();
      const detail = (item?.detail || '').trim();
      if (title && detail) {
        return `${title} (${detail})`;
      }
      return title || detail || '';
    }
  });

  const activeMilestone = milestone ? { ...milestone } : null;
  const todoSummary = activeMilestone
    ? listToSummary(activeMilestone.todos, {
        emptyLabel: 'ingen to-dos registrert',
        mapper: (item) => {
          const title = (item?.title || '').trim();
          const detail = (item?.detail || '').trim();
          if (title && detail) {
            return `${title} (${detail})`;
          }
          return title || detail || '';
        }
      })
    : 'ikke relevant';

  const preferences = (preferencesText && preferencesText.trim()) || 'Ingen spesielle preferanser oppgitt.';

  return {
    goalTitle: (goal?.title || '').trim() || 'Uten tittel',
    goalWhy: (goal?.why || '').trim() || 'Ikke beskrevet.',
    goalCategory: (goal?.category || '').trim() || 'Ikke angitt',
    goalImportance: (goal?.important || '').trim() || 'Ikke angitt',
    goalDeadlineIso: formatIsoDate(goal?.deadline),
    goalDeadlineLong: formatLongDate(goal?.deadline) || 'Ingen fastsatt dato',
    existingMilestones: milestoneSummary,
    preferencesText: preferences,
    milestoneTitle: activeMilestone ? (activeMilestone.title || '').trim() : '',
    milestoneDetail: activeMilestone ? (activeMilestone.detail || '').trim() : '',
    milestoneDeadlineIso: activeMilestone ? formatIsoDate(activeMilestone.deadline) : '',
    milestoneDeadlineLong: activeMilestone ? formatLongDate(activeMilestone.deadline) : '',
    existingTodos: todoSummary
  };
}

function cleanJsonText(text) {
  if (!text) return '';
  return text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
}

function toMilestone(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const title = (item.title || '').toString().trim();
  if (!title) {
    return null;
  }
  return {
    title,
    detail: item.detail ? String(item.detail).trim() : '',
    deadline: formatIsoDate(item.deadline || item.targetDate || item.due) || ''
  };
}

function toTodo(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const title = (item.title || '').toString().trim();
  if (!title) {
    return null;
  }
  return {
    title,
    detail: item.detail ? String(item.detail).trim() : ''
  };
}

export async function loadGoalPlanningPrompts() {
  await ensurePromptsLoaded();
}

export async function buildMilestonePrompt(goal = {}, { preferencesText = '' } = {}) {
  await ensurePromptsLoaded();
  const values = createPromptValues(goal, { preferencesText });
  const promptParts = [
    promptCache.get('expert1'),
    promptCache.get('overall1'),
    fillTemplate(promptCache.get('preferences1'), values),
    promptCache.get('output1')
  ].filter(Boolean);

  return {
    prompt: promptParts.join('\n\n'),
    systemPrompt: GOAL_SYSTEM_PROMPT,
    meta: {
      phase: 'milestones',
      goalTitle: values.goalTitle
    }
  };
}

export async function buildTodoPrompt(goal = {}, milestone = {}, { preferencesText = '' } = {}) {
  await ensurePromptsLoaded();
  const values = createPromptValues(goal, { preferencesText, milestone });
  const milestoneContext = [
    `Milepæl: ${values.milestoneTitle || 'Uten tittel'}`,
    values.milestoneDetail ? `Beskrivelse: ${values.milestoneDetail}` : null,
    values.milestoneDeadlineIso ? `Ønsket milepældato: ${values.milestoneDeadlineIso}` : null,
    `Eksisterende to-dos: ${values.existingTodos}`
  ]
    .filter(Boolean)
    .join('\n');

  const promptParts = [
    promptCache.get('expert1'),
    milestoneContext,
    promptCache.get('overall2'),
    fillTemplate(promptCache.get('preferences2'), values),
    promptCache.get('output2')
  ].filter(Boolean);

  return {
    prompt: promptParts.join('\n\n'),
    systemPrompt: GOAL_SYSTEM_PROMPT,
    meta: {
      phase: 'todos',
      milestoneTitle: values.milestoneTitle
    }
  };
}

export function parseMilestoneResponse(text) {
  const cleaned = cleanJsonText(text);
  if (!cleaned) {
    return [];
  }
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (error) {
    throw new Error('Kunne ikke tolke AI-responsen for milepæler som gyldig JSON.');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('AI-responsen for milepæler må være en liste.');
  }
  return parsed
    .map(toMilestone)
    .filter((item) => item !== null);
}

export function parseTodoResponse(text) {
  const cleaned = cleanJsonText(text);
  if (!cleaned) {
    return [];
  }
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (error) {
    throw new Error('Kunne ikke tolke AI-responsen for to-dos som gyldig JSON.');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('AI-responsen for to-dos må være en liste.');
  }
  return parsed
    .map(toTodo)
    .filter((item) => item !== null);
}
