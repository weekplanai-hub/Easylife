import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const schemaPath = path.join(rootDir, 'schema', 'schema.json');
const outputPath = path.join(rootDir, 'docs', 'database.md');

const loadSchema = async () => {
  const raw = await readFile(schemaPath, 'utf8');
  const schema = JSON.parse(raw);
  if (!schema || typeof schema !== 'object') {
    throw new Error('Schema file must export an object.');
  }
  if (!Array.isArray(schema.tables)) {
    throw new Error('Schema must include a "tables" array.');
  }
  return schema;
};

const formatDefault = (value) => {
  if (value === undefined || value === null || value === '') {
    return '—';
  }
  return `\`${value}\``;
};

const formatNullable = (nullable) => (nullable === false ? 'Nei' : 'Ja');

const renderColumnTable = (table) => {
  const header = ['| Kolonne', 'Type', 'Nullbar', 'Standard', 'Beskrivelse |'].join(' | ');
  const separator = ['| ---', '---', '---', '---', '--- |'].join(' | ');
  const rows = table.columns.map((column) => {
    const description = column.description ? column.description.replace(/\n/g, '<br>') : '—';
    return ['| ' + column.name, `\`${column.type}\``, formatNullable(column.nullable), formatDefault(column.default), `${description} |`].join(' | ');
  });
  return [header, separator, ...rows].join('\n');
};

const renderPrimaryKey = (table) => {
  if (!Array.isArray(table.primaryKey) || table.primaryKey.length === 0) {
    return '—';
  }
  return table.primaryKey.map((column) => `\`${column}\``).join(', ');
};

const renderForeignKeys = (table) => {
  if (!Array.isArray(table.foreignKeys) || table.foreignKeys.length === 0) {
    return 'Ingen';
  }
  const rows = table.foreignKeys.map((fk) => {
    const cols = fk.columns.map((col) => `\`${col}\``).join(', ');
    const refTable = `${fk.references.schema ? `${fk.references.schema}.` : ''}${fk.references.table}`;
    const refCols = fk.references.columns.map((col) => `\`${col}\``).join(', ');
    const actions = [];
    if (fk.onDelete) {
      actions.push(`ON DELETE ${fk.onDelete.toUpperCase()}`);
    }
    if (fk.onUpdate) {
      actions.push(`ON UPDATE ${fk.onUpdate.toUpperCase()}`);
    }
    const suffix = actions.length > 0 ? ` (${actions.join(', ')})` : '';
    return `- \`${cols}\` → \`${refTable}.${refCols}\`${suffix}`;
  });
  return rows.join('\n');
};

const buildDoc = (schema) => {
  const lines = [
    '# Databasedokumentasjon',
    '',
    '## Prosjektinformasjon',
    '- **Plattform:** Supabase',
    '- **Prosjekt-URL:** `https://wapprjfgxsrplaotzyim.supabase.co`',
    '- **Anon public API-nøkkel:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhcHByamZneHNycGxhb3R6eWltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0NDUyNzMsImV4cCI6MjA3NjAyMTI3M30.0fV73VsqSziJJY1hUAnV_UgQVHMRGMdIFVbHEwtY-I8`',
    '',
    '> 🔐 **Merk:** API-nøkkelen over er den offentlige "anon"-nøkkelen som kan brukes i klientkode. Administrator-nøkkel **skal ikke** sjekkes inn i repoet.',
    '',
    '## Tilkobling fra klient',
    'Tilkoblingen initialiseres i `supabase-client.js`. Filen bruker CDN-versjonen av `@supabase/supabase-js@2` og eksponerer en delt klient i `window.supabaseClient` som kan importeres eller brukes direkte i andre skript.',
    '',
    '```js',
    "import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';",
    '',
    "const supabaseUrl = 'https://wapprjfgxsrplaotzyim.supabase.co';",
    "const supabaseKey = '...';",
    'export const supabaseClient = createClient(supabaseUrl, supabaseKey);',
    'window.supabaseClient = supabaseClient;',
    '```',
    '',
    '### Brukseksempel',
    '```js',
    "const { data, error } = await window.supabaseClient.from('dine_tabeller').select('*');",
    '```',
    '',
    'Alle HTML-sider laster `supabase-client.js` slik at klienten er tilgjengelig når vi begynner å koble visningene til databasen.',
    '',
    '## Datamodell',
  ];

  if (schema.tables.length === 0) {
    lines.push('Det er foreløpig ingen tabeller definert i databasen. Oppdater `schema/schema.json` for å legge til tabeller.');
  } else {
    for (const table of schema.tables) {
      lines.push('', `### ${table.name}`);
      if (table.description) {
        lines.push('', table.description);
      }
      lines.push('', '**Kolonner**', '', renderColumnTable(table), '', `- **Primærnøkkel:** ${renderPrimaryKey(table)}`);
      const foreignKeyDetails = renderForeignKeys(table);
      if (foreignKeyDetails === 'Ingen') {
        lines.push('- **Fremmednøkler:** Ingen');
      } else {
        lines.push('- **Fremmednøkler:**', foreignKeyDetails);
      }
      if (Array.isArray(table.indexes) && table.indexes.length > 0) {
        lines.push('- **Indekser:**');
        for (const index of table.indexes) {
          const indexName = index.name ? `\`${index.name}\`` : 'Automatisk navn';
          const unique = index.unique ? ' (unik)' : '';
          const columns = index.columns.map((col) => `\`${col}\``).join(', ');
          lines.push(`  - ${indexName}${unique}: ${columns}`);
        }
      }
    }
  }

  lines.push('', '## Sjekkliste ved endringer', '1. Oppdater tabelloversikten ovenfor.', '2. Dokumenter eventuelle triggere, policies eller funksjoner som påvirker datatilgang.', '3. Sørg for at alle klienter som bruker databasen er oppdatert til å reflektere nye felter.', '', '## Videre arbeid', '- Sett opp miljøvariabler for API-nøkkelen når prosjektet får en bygg-/deploy-pipeline.', '- Opprett tabeller i Supabase og dokumenter dem i seksjonen over.');

  return lines.join('\n') + '\n';
};

const main = async () => {
  const schema = await loadSchema();
  const doc = buildDoc(schema);
  await writeFile(outputPath, doc);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
