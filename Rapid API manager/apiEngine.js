// tools/apiEngine.js
// General-purpose API orchestration helpers for multi-run AI workflows.
// Provides provider configuration lookup, chat completion wrapper, sequential
// run controller with history awareness, and a lightweight localStorage logger.

export const API_SELECTION_REQUIRED = 'API_SELECTION_REQUIRED';

class ApiConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ApiConfigurationError';
    this.code = API_SELECTION_REQUIRED;
  }
}

const PROVIDER_CONFIG = {
  openrouter: {
    keyStorage: 'api-key-openrouter',
    modelStorage: 'api-current-model-openrouter',
    defaultSystemPrompt: 'You are a helpful assistant.'
  },
  openai: {
    keyStorage: 'api-key-openai',
    modelStorage: 'api-current-model-openai',
    defaultSystemPrompt: 'You are a helpful assistant.'
  },
  gemini: {
    keyStorage: 'api-key-gemini',
    modelStorage: 'api-current-model-gemini',
    defaultSystemPrompt: 'You are a helpful assistant.'
  },
  grok: {
    keyStorage: 'api-key-grok',
    modelStorage: 'api-current-model-grok',
    defaultSystemPrompt: 'You are a helpful assistant.'
  }
};

const PROVIDER_STORAGE_KEY = 'api-current-provider';

function getStoredProvider() {
  try {
    const stored = localStorage.getItem(PROVIDER_STORAGE_KEY);
    if (stored && PROVIDER_CONFIG[stored]) {
      return stored;
    }
  } catch (err) {
    console.warn('Unable to read provider selection:', err);
  }
  return 'openrouter';
}

function cleanModel(provider, model) {
  if (!model) return '';
  if (provider === 'gemini') {
    return model.replace(/^models\//, '');
  }
  return model;
}

function ensureMessages(messages, { prompt, systemPrompt }) {
  if (Array.isArray(messages) && messages.length) return messages;
  const final = [];
  if (systemPrompt) final.push({ role: 'system', content: systemPrompt });
  if (prompt) final.push({ role: 'user', content: prompt });
  return final;
}

export class ApiClient {
  constructor(options = {}) {
    this.provider = options.provider || getStoredProvider();
    this.temperature = typeof options.temperature === 'number' ? options.temperature : 1;
    this.providerConfig = PROVIDER_CONFIG[this.provider];
    if (!this.providerConfig) {
      throw new Error(`Unknown provider: ${this.provider}`);
    }
    this.apiKey = options.apiKey ?? this.readLocalStorage(this.providerConfig.keyStorage);
    this.model = cleanModel(
      this.provider,
      options.model ?? this.readLocalStorage(this.providerConfig.modelStorage)
    );
  }

  readLocalStorage(key) {
    if (!key) return '';
    try {
      return localStorage.getItem(key) || '';
    } catch (err) {
      console.warn('Unable to read localStorage for key', key, err);
      return '';
    }
  }

  ensureConfigured() {
    if (!this.apiKey || !this.model) {
      const providerLabel = this.provider.charAt(0).toUpperCase() + this.provider.slice(1);
      throw new ApiConfigurationError(
        `Manglende API-oppsett: Velg nøkkel og modell for ${providerLabel} i API Manager før du kjører.`
      );
    }
  }

  getConfiguration() {
    return {
      provider: this.provider,
      model: this.model,
      temperature: this.temperature
    };
  }

  async call(prompt, options = {}) {
    this.ensureConfigured();
    const systemPrompt = options.systemPrompt || this.providerConfig.defaultSystemPrompt;
    const messages = ensureMessages(options.messages, { prompt, systemPrompt });
    switch (this.provider) {
      case 'openrouter':
        return this.callOpenRouter(messages, options);
      case 'openai':
        return this.callOpenAI(messages, options);
      case 'gemini':
        return this.callGemini(messages, options);
      case 'grok':
        throw new Error('Grok support is not implemented yet.');
      default:
        throw new Error(`Unknown provider: ${this.provider}`);
    }
  }

  async callOpenRouter(messages, options) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Weekplan.ai'
      },
      body: JSON.stringify({
        model: this.model,
        temperature: typeof options.temperature === 'number' ? options.temperature : this.temperature,
        messages
      })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`OpenRouter ${res.status}: ${text}`);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty content from OpenRouter');
    return content.trim();
  }

  async callOpenAI(messages, options) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        temperature: typeof options.temperature === 'number' ? options.temperature : this.temperature,
        messages
      })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`OpenAI ${res.status}: ${text}`);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty content from OpenAI');
    return content.trim();
  }

  async callGemini(messages, options) {
    const modelId = this.model.startsWith('models/') ? this.model : `models/${this.model}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/${encodeURIComponent(modelId)}:generateContent`;
    const textPayload = messages
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n\n');
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: textPayload }
            ]
          }
        ],
        generationConfig: {
          temperature: typeof options.temperature === 'number' ? options.temperature : this.temperature
        }
      })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Gemini ${res.status}: ${text}`);
    }
    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const combined = parts.map(part => part?.text || '').join('').trim();
    if (!combined) throw new Error('Empty content from Gemini');
    return combined;
  }
}

export class HistoryTracker {
  constructor(initialEntries = []) {
    this._set = new Set();
    this.addMany(initialEntries);
  }

  add(entry) {
    if (!entry) return;
    const value = typeof entry === 'string' ? entry.trim() : '';
    if (value) this._set.add(value);
  }

  addMany(entries) {
    (entries || []).forEach(entry => this.add(entry));
  }

  list() {
    return Array.from(this._set);
  }

  snapshot() {
    return this.list();
  }

  clear() {
    this._set.clear();
  }
}

export class ApiRunLogger {
  constructor(storageKey = 'api-run-log') {
    this.storageKey = storageKey;
    this.maxEntries = 40;
  }

  load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn('Unable to parse API log:', err);
      return [];
    }
  }

  save(entries) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(entries));
    } catch (err) {
      console.warn('Unable to save API log:', err);
    }
  }

  log(entry) {
    const entries = this.load();
    entries.unshift({
      id: entry.id || `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: entry.timestamp || new Date().toISOString(),
      sequenceId: entry.sequenceId || 'default',
      stepId: entry.stepId || '',
      label: entry.label || '',
      provider: entry.provider || '',
      model: entry.model || '',
      status: entry.status || (entry.error ? 'error' : 'success'),
      prompt: entry.prompt || '',
      output: entry.output || '',
      error: entry.error || null,
      meta: entry.meta || {}
    });
    while (entries.length > this.maxEntries) entries.pop();
    this.save(entries);
  }

  clear() {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (err) {
      console.warn('Unable to clear API log:', err);
    }
  }
}

export class SequenceRunner {
  constructor(options) {
    this.steps = options.steps || [];
    this.client = options.client;
    this.buildPrompt = options.buildPrompt;
    this.handleOutput = options.handleOutput;
    this.history = options.history || new HistoryTracker();
    this.beforeStep = options.beforeStep;
    this.afterStep = options.afterStep;
    this.onError = options.onError;
    this.logger = options.logger;
    this.sequenceId = options.sequenceId || `seq-${Date.now()}`;
    this.stopOnError = options.stopOnError !== undefined ? options.stopOnError : true;
    this.fallbackCall = options.fallbackCall;
    this.summary = [];
  }

  async run() {
    const config = this.client?.getConfiguration ? this.client.getConfiguration() : {};
    for (let index = 0; index < this.steps.length; index++) {
      const step = this.steps[index];
      const summaryItem = {
        stepId: step?.id ?? `step-${index}`,
        label: step?.label || '',
        index,
        status: 'pending'
      };
      try {
        if (typeof this.beforeStep === 'function') {
          await this.beforeStep({ step, index, history: this.history.snapshot() });
        }

        if (typeof this.buildPrompt !== 'function') {
          throw new Error('SequenceRunner requires a buildPrompt function.');
        }

        const promptDetails = await this.buildPrompt({
          step,
          index,
          history: this.history.snapshot()
        });
        const prompt = promptDetails?.prompt || '';
        summaryItem.prompt = prompt;
        summaryItem.meta = promptDetails?.meta || {};

        let output;
        try {
          if (!this.client || typeof this.client.call !== 'function') {
            throw new Error('SequenceRunner requires a configured ApiClient.');
          }
          output = await this.client.call(prompt, {
            systemPrompt: promptDetails?.systemPrompt,
            messages: promptDetails?.messages,
            temperature: promptDetails?.temperature
          });
        } catch (err) {
          if (err?.code === API_SELECTION_REQUIRED) throw err;
          if (typeof this.fallbackCall === 'function') {
            output = await this.fallbackCall(prompt, step, err);
          } else {
            throw err;
          }
        }

        summaryItem.output = output;
        summaryItem.status = 'success';

        if (typeof this.handleOutput === 'function') {
          await this.handleOutput({
            step,
            index,
            prompt,
            output,
            history: this.history
          });
        }

        if (typeof this.afterStep === 'function') {
          await this.afterStep({
            step,
            index,
            prompt,
            output,
            history: this.history.snapshot()
          });
        }

        if (this.logger) {
          this.logger.log({
            sequenceId: this.sequenceId,
            stepId: summaryItem.stepId,
            label: summaryItem.label,
            provider: config.provider,
            model: config.model,
            status: 'success',
            prompt,
            output,
            meta: summaryItem.meta
          });
        }
      } catch (error) {
        summaryItem.status = 'error';
        summaryItem.error = error;
        if (typeof this.onError === 'function') {
          await this.onError({
            step,
            index,
            error,
            history: this.history.snapshot()
          });
        }
        if (this.logger) {
          this.logger.log({
            sequenceId: this.sequenceId,
            stepId: summaryItem.stepId,
            label: summaryItem.label,
            provider: config.provider,
            model: config.model,
            status: 'error',
            prompt: summaryItem.prompt || '',
            output: summaryItem.output || '',
            error: error?.message || String(error)
          });
        }
        if (this.stopOnError) {
          this.summary.push(summaryItem);
          throw error;
        }
      }
      this.summary.push(summaryItem);
    }
    return this.summary;
  }

  getHistory() {
    return this.history.snapshot();
  }

  getSummary() {
    return this.summary.slice();
  }
}

export function getCurrentProvider() {
  return getStoredProvider();
}

export function setCurrentProvider(provider) {
  if (!provider || !PROVIDER_CONFIG[provider]) return;
  try {
    localStorage.setItem(PROVIDER_STORAGE_KEY, provider);
  } catch (err) {
    console.warn('Unable to persist provider selection:', err);
  }
}

export function getProviderConfigMap() {
  return { ...PROVIDER_CONFIG };
}
