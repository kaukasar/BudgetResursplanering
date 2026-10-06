# Arbetsinstruktioner

Kravspecifikationen för appen finns i `claude.md` i projektets rot. Den här filen innehåller
instruktioner för hur arbetet ska utföras.

- **Håll kravspecen aktuell:** När en kodändring ändrar kravbilden (funktioner, regler, beteende
  eller gränssnitt) ska `claude.md` uppdateras i samma arbete. Ändringar som inte påverkar kraven,
  t.ex. refaktorering eller verktyg, kräver ingen uppdatering.
- **Fråga vid oklarheter:** Om ett krav är otydligt, tvetydigt eller ofullständigt ska användaren
  tillfrågas innan det implementeras, i stället för att ett eget antagande görs.

## Kodprinciper (clean code)

Koden ska vara lätt att underhålla. Följ principerna nedan vid all utveckling, både i ny kod och i
kod som ändras. Ser du kod i närheten som bryter mot dem, rätta den när det är rimligt i samma arbete.

- **Tydlig namngivning:** Variabler, funktioner, komponenter och typer har beskrivande namn som säger
  exakt vad de gör eller innehåller (`storedEstimateAndActual`, inte `getData`). Undvik förkortningar
  och enbokstavsnamn, även i korta lambdor (`(initiative) => …`, inte `(i) => …`). Ett namn som
  inte längre stämmer byts, i stället för att förklaras med en kommentar.
- **Tydligt ansvar (Single Responsibility):** Varje funktion, komponent och modul har ett avgränsat
  ansvar. Affärsregler och beräkningar ligger som rena funktioner i `src/domain/`. Alla ändringar av
  data går via `domain/operations.ts`. Storen applicerar bara operationerna. Vyerna visar data och
  tar emot inmatning, men räknar inte själva. Växer en komponent med flera ansvar, bryt ut delarna
  (som `YearsField` och `InitiativePeopleField` ur `InitiativeForm`).
- **Enkelhet (KISS):** Välj den rakaste lösningen som uppfyller kravet. Undvik "smarta" men
  svårlästa genvägar, onödiga abstraktioner och generalisering för behov som ännu inte finns.
- **Självdokumenterande logik:** Strukturen och namnen ska göra koden begriplig utan kommentarer om
  *hur* den fungerar. Kommentarer förklarar *varför*: en affärsregel, ett oortodoxt tekniskt beslut
  eller en fallgrop. Kommentarer som inte längre stämmer rättas eller tas bort i samma ändring.
- **Hög testbarhet:** Logik skrivs som små, rena funktioner med få beroenden, så att den kan testas
  utan gränssnitt. Ny eller ändrad logik får tester: domänlogik i `src/domain/*.test.ts` och
  användarflöden i `src/test/*.test.tsx`. En rättad bugg får ett test som hade fångat den.
- **Konsekvent formatering:** Prettier (`.prettierrc.json`) och ESLint (`eslint.config.js`) är
  standarden. Följ den omgivande kodens stil, t.ex. svenska texter och kommentarer och engelska
  namn i koden.
- **Låg koppling och hög sammanhållning:** Moduler beror på så lite som möjligt av varandra.
  Domänen beror aldrig på vyer eller stores. Kod som hör till samma område samlas på ett ställe,
  t.ex. filtrering i `domain/filter.ts` och visningstexter i `domain/format.ts` och `views/labels.ts`.
  Samma regel ska inte finnas i flera kopior. Finns en hjälpfunktion redan, återanvänd den.

**Innan ett arbete är klart:** kör `npm run check` (typkontroll, lint, formatering och tester). Allt
ska vara grönt. Formatera med `npm run format` vid behov.
