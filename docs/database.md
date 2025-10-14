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

## Datamodell
Det er foreløpig ingen tabeller definert i databasen. Oppdater `schema/schema.json` for å legge til tabeller.

## Sjekkliste ved endringer
1. Oppdater tabelloversikten ovenfor.
2. Dokumenter eventuelle triggere, policies eller funksjoner som påvirker datatilgang.
3. Sørg for at alle klienter som bruker databasen er oppdatert til å reflektere nye felter.

## Videre arbeid
- Sett opp miljøvariabler for API-nøkkelen når prosjektet får en bygg-/deploy-pipeline.
- Opprett tabeller i Supabase og dokumenter dem i seksjonen over.
