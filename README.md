# Budget & Resursplanering

Webbapplikation för budgetering samt resurs- och kapacitetsplanering enligt [claude.md](claude.md).
Ren klientapplikation utan backend. All data sparas i webbläsarens `localStorage`.

## Kom igång

```bash
npm install
npm run dev           # utvecklingsserver på http://localhost:5173
npm test              # enhets- och komponenttester (Vitest)
npm run typecheck     # typkontroll (TypeScript, strikt läge)
npm run lint          # statisk kodanalys (ESLint)
npm run format        # formatera all kod (Prettier)
npm run format:check  # kontrollera formateringen utan att ändra
npm run build         # typkontroll + produktionsbygge till dist/
npm run preview       # servera produktionsbygget lokalt
```

`dist/` är helt statisk (relativa sökvägar) och kan läggas på valfri webbserver eller statisk hosting,
även i en undermapp.

## Teknik

| Del | Val | Varför |
| --- | --- | --- |
| UI | React 19 + TypeScript 6.0 | Reaktiva omräkningar vid varje tangenttryckning, typsäker domänmodell |
| Bygge | Vite | Snabb utveckling, statiskt bygge utan server |
| Tillstånd | Zustand + `persist` | Liten, enkel store som sparar automatiskt i localStorage |
| Test | Vitest + Testing Library | Domänlogik testas rent, UI-flöden testas som en användare |
| Formatering | Prettier | En enhetlig kodstil utan manuellt arbete |
| Kodanalys | ESLint + typescript-eslint + React-hooks | Fångar felaktig hook-användning och ohanterade `async`-anrop som typkontrollen missar |

TypeScript hålls på 6.0 eftersom TypeScript 7 (den nya kompilatorn skriven i Go) ännu saknar det
programmeringsgränssnitt som typescript-eslint behöver för att använda typinformation. Uppgradera när
typescript-eslint stödjer version 7.

## Struktur

```
src/
  domain/              Ren affärslogik utan React – varje fil har ett eget test (*.test.ts)
    types.ts             Datamodell: sektion, personal, produktägare, initiativ, estimat, utfall
    calc.ts              Timmar, kostnad och summor per initiativ, kapacitet, filtrering
    budget.ts            Budgetstatus: prognos (estimerad kostnad) och utfall mot budget
    comparison.ts        Estimat mot utfall: avvikelse per person, månad och initiativ
    operations.ts        Alla ändringar av data + valideringsregler (kastar DomainError)
    serialization.ts     Export/import och validering av sparad data, inkl. äldre format
    csv.ts               Analysexport för Excel
    sorting.ts           Sortering i svensk ordning (används av listor och tabeller)
    format.ts            Visning och tolkning av tal, timmar och belopp
    sample.ts            Exempeldata
  store/               Zustand-stores: data (sparas i localStorage) och vyinställningar
  components/          Återanvändbara komponenter: dialoger, timcell, nyckeltal, sorterbar rubrik
  views/
    labels.ts            Visningsnamn för sektion, produktägare och person
    useLoadSample.tsx    Laddning av exempeldata (arbetsläge och datafliken)
    work/                Arbetsläget: verktygsrad, nyckeltal, kapacitet, initiativ, tabeller per vy
    admin/               Adminläget: en fil per flik, plus gemensam sortering och raderingsdialog
  test/                UI-tester per område (arbetsläge, estimat/utfall, adminläge) och testdata
```

## Kodprinciper

- **Affärslogiken ligger i `domain/`** som rena funktioner utan React. Vyerna räknar inte själva
  utan anropar domänen, så att varje regel finns på ett ställe och kan testas utan gränssnitt.
- **Data ändras bara via `domain/operations.ts`.** Storen applicerar operationerna och sparar
  resultatet. Ogiltiga ändringar kastar `DomainError` med ett meddelande som kan visas för användaren.
- **Estimat och utfall** har samma struktur (`TimeMap`). Utfall kan vara `null` = inte rapporterat,
  vilket skiljer sig från rapporterade 0 h.
- **Sparad data valideras vid inläsning** (`parseAppData`). Äldre format migreras där, så resten av
  koden kan förutsätta den senaste datamodellen.
- **Kommentarer förklarar varför**, inte vad. Koden formateras med `npm run format`.
- **`npm run lint` ska vara rent.** Konfigurationen finns i `eslint.config.js`. Undantag från en regel
  motiveras med en kommentar där.

## Tolkningar av kravspecen

Beslut tagna tillsammans med beställaren där specen var tvetydig:

- **Timkostnad och arbetstid:** globala standardvärden per typ (Anställd/Konsult) som varje person ärver.
  En person kan få egna värden, och ett tomt fält betyder "använd standard". Ändras standardvärdet
  påverkas alla som ärver det, direkt.
- **Personal på initiativ:** minst en person krävs när ett initiativ *skapas*. Därefter får all
  personal tas bort (spec 5.3).
- **Timmar vid borttagning:** tas en person bort från ett initiativ eller raderas helt, raderas personens
  timmar efter en bekräftelsedialog som visar hur många timmar som försvinner.
- **Lagring:** data finns bara i den aktuella webbläsaren. Export/import av JSON finns under
  *Adminläge → Data* för backup och för att flytta data mellan datorer eller personer.
- **Export för Excel:** under *Adminläge → Data* finns även en CSV-export (en rad per initiativ, person
  och månad) anpassad för pivottabeller i svensk Excel. Se claude.md avsnitt 3.5.

Övriga val:

- **Överallokering** gäller när summan i *alla* initiativ (hos alla produktägare) en månad är
  *större än* personens normala arbetstid. Exakt 160 av 160 h är alltså OK. Personens namn och timsiffran
  visas i röd text i varje initiativtabell där personen finns, och i kapacitetsöversikten. Hovra över en cell för att se totalen.
- **År:** ett initiativ måste gälla minst ett år. Tas ett år bort raderas årets timmar, efter bekräftelse.
- **Produktägarväljaren** har även alternativet *Alla produktägare*.
- **Timmar** kan anges med decimaler, med komma eller punkt. Tom cell = 0. Enter/↓/↑ flyttar mellan rader.
- **Sektioner:** personal och produktägare tillhör exakt en sektion; initiativ ärver produktägarens
  sektion. Personal kan lånas ut till initiativ i andra sektioner, och överallokering räknas över alla
  sektioner. En sektion kan bara raderas när den är tom. Äldre data utan sektioner flyttas in i
  "Standardsektion".
- **Estimat och utfall:** arbetsläget har en vyväljare Estimat / Utfall / Jämförelse. En tom utfallscell
  betyder "ej rapporterat" (estimatet visas grått), vilket skiljer sig från rapporterade 0 h. Prognos =
  estimerad kostnad och påverkas aldrig av utfall. Avvikelse räknas bara på månader med utfall.
  Se claude.md 4.3–4.5.
- **Sortering i adminläget:** klick på en kolumnrubrik sorterar på den (stigande, sedan fallande). Tal
  sorteras numeriskt, text i svensk ordning, tomma värden sist. Vald sortering sparas per flik.
- **Kapacitetsöversikt** i arbetsläget visar varje berörd persons totala allokering per månad.
- **Budget** anges per initiativ som en totalbudget för initiativets alla år. Förbrukad andel räknas på
  planerad kostnad för alla år, även när arbetsläget visar ett enskilt år.
- **Flera flikar** hålls i synk: ändringar i en flik läses in i andra öppna flikar.
- **Trasig sparad data** (t.ex. manuellt ändrad) gör att appen startar tom i stället för att krascha.
  Originalet sparas då under nyckeln `ekonomi.data.backup`.
