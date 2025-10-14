# Databasedokumentasjon

## Prosjektinformasjon
- **Plattform:** Supabase
- **Prosjekt-URL:** `https://wapprjfgxsrplaotzyim.supabase.co`
- **Anon public API-nøkkel:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhcHByamZneHNycGxhb3R6eWltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0NDUyNzMsImV4cCI6MjA3NjAyMTI3M30.0fV73VsqSziJJY1hUAnV_UgQVHMRGMdIFVbHEwtY-I8`

> 🔐 **Merk:** API-nøkkelen over er den offentlige "anon"-nøkkelen som kan brukes i klientkode. Administrator-nøkkel **skal ikke** sjekkes inn i repoet.

## Tilkobling fra klient
Tilkoblingen initialiseres i `supabase-client.js`. Filen bruker CDN-versjonen av `@supabase/supabase-js@2` og eksponerer en delt klient i `window.supabaseClient` som kan importeres eller brukes direkte i andre skript.

```js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = 'https://wapprjfgxsrplaotzyim.supabase.co';
const supabaseKey = '...';
export const supabaseClient = createClient(supabaseUrl, supabaseKey);
window.supabaseClient = supabaseClient;
```

### Brukseksempel
```js
const { data, error } = await window.supabaseClient.from('dine_tabeller').select('*');
```

Alle HTML-sider laster `supabase-client.js` slik at klienten er tilgjengelig når vi begynner å koble visningene til databasen.

## Autentisering
- **Metode:** E-post og passord via Supabase Auth
- **Flyt:** Brukere logger inn fra `login.html`. Etter vellykket innlogging omdirigeres de automatisk til `index.html`.
- **Ny konto:** `login.html` lar nye brukere opprette en konto med e-post og passord. Dersom prosjektet krever e-postbekreftelse, vises en melding om å verifisere e-posten før innlogging.
- **Session-håndtering:** Hvis en aktiv sesjon finnes når `login.html` åpnes, sendes brukeren videre til `index.html` uten å måtte logge inn på nytt.

## Brukersesjon og tilgang
- Alle hovedsidene (`index.html`, `mal.html`, `mal-detalj.html`, `todo.html` og `rutiner.html`) laster `supabase-client.js` og verifiserer en aktiv Supabase Auth-sesjon ved lasting.
- Dersom ingen gyldig sesjon finnes, blir brukeren automatisk omdirigert til `login.html`.
- Innloggede brukere får en «Logg ut»-knapp øverst som kaller `supabase.auth.signOut()` og sender brukeren tilbake til innloggingssiden.

## Datamodell

### goals

Lagrer mål knyttet til en innlogget bruker, inkludert motivasjon, status og metadata for visning i appen.

**Kolonner**

| Kolonne | Type | Nullbar | Standard | Beskrivelse |
| --- | --- | --- | --- | --- |
| id | `uuid` | Nei | `gen_random_uuid()` | Primærnøkkel som identifiserer målet. |
| user_id | `uuid` | Nei | — | Referanse til Supabase-brukeren som eier målet. |
| title | `text` | Nei | — | Kort tittel som beskriver målet. |
| why | `text` | Nei | — | Brukerens begrunnelse for hvorfor målet er viktig. |
| deadline | `date` | Ja | — | Valgfri sluttdato for målet. |
| image | `text` | Ja | — | Data-URL eller ekstern lenke til forsidebildet for målet. |
| status | `text` | Nei | `'0%'` | Prosentvis progresjon lagret som tekst (for eksempel '25%'). |
| category | `text` | Ja | — | Valgfri kategori som målet tilhører. |
| important | `text` | Ja | — | Fritekstfelt som beskriver hvorfor målet er viktigst akkurat nå. |
| created_at | `timestamp with time zone` | Nei | `now()` | Tidspunkt da målet ble opprettet. |

- **Primærnøkkel:** `id`
- **Fremmednøkler:**
- `user_id` → `auth.users`.`id` (ON DELETE CASCADE)
- **Indekser:**
  - `goals_user_id_created_at_idx`: `user_id`, `created_at`

## Sjekkliste ved endringer
1. Oppdater tabelloversikten ovenfor.
2. Dokumenter eventuelle triggere, policies eller funksjoner som påvirker datatilgang.
3. Sørg for at alle klienter som bruker databasen er oppdatert til å reflektere nye felter.

## Videre arbeid
- Sett opp miljøvariabler for API-nøkkelen når prosjektet får en bygg-/deploy-pipeline.
- Opprett tabeller i Supabase og dokumenter dem i seksjonen over.
