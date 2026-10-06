# Kravspecifikation för webbapplikation: Budget & Resursplanering

## 1. Översikt & Syfte

Systemet är en webbaserad applikation för budgetering, resurs- och kapacitetsplanering. Syftet är att ge en tydlig översikt över hur mycket tid och pengar som allokeras på olika initiativ uppdelat per sektion, produktägare, person och månad.

Tid hanteras på två sätt: **estimat** (planerad tid) och **utfall** (faktiskt nedlagd tid). Estimatet utgör **prognosen**; utfallet följs upp mot prognosen och visar avvikelser. Prognos och utfall är två oberoende mått – inmatat utfall påverkar aldrig prognosen.

All data grupperas i **sektioner**, som ligger högst upp i hierarkin:

```
Sektion
├── Personal (arbetar endast på initiativ i sin egen sektion)
└── Produktägare
    └── Initiativ (tillhör samma sektion som sin produktägare)
```

Utanför sektionerna finns **Extern personal** (2.7): en inbyggd post för tid från personal utanför de ordinarie teamen, som kan kopplas till alla initiativ.

Applikationen har två huvudsakliga lägen:

1. **Adminläge:** För hantering av stamdata (sektioner, personal, produktägare och initiativ) samt deras kopplingslogik.
2. **Arbetsläge:** För den löpande tidsallokeringen (estimat), rapportering av utfall, visning av budgetar och kapacitetsuppföljning per år, sektion och produktägare.

---

## 2. Entiteter & Datamodell

### 2.1 Sektion

* **Egenskaper:**
* Namn (sträng)
* En sektion kan ha en eller flera personal, en eller flera produktägare och (via sina produktägare) ett eller flera initiativ.



### 2.2 Personal

* **Egenskaper:**
* Namn (sträng)
* Typ: `Anställd` eller `Konsult`
* Sektion (exakt 1 sektion). Personen kan bara kopplas till initiativ i sin egen sektion. Tid från personal i andra delar av organisationen registreras som Extern personal (2.7).
* Status: aktiv eller raderad. Raderad personal finns kvar för den tid som redan registrerats (se 2.8), och bara så länge den tiden finns kvar.
* Timkostnad/Timpris (heltal i SEK/h)
* Normal arbetstid per månad (heltal, t.ex. 160 timmar/månad)



### 2.3 Produktägare

* **Egenskaper:**
* Namn (sträng)
* Sektion (exakt 1 sektion)



### 2.4 Initiativ

* **Egenskaper:**
* Namn (sträng)
* Tillhörig Produktägare (Exakt 1 produktägare)
* Sektion: väljs inte separat utan är alltid densamma som produktägarens sektion.
* Kopplad Personal (Minst 1 person), endast aktiv personal i initiativets sektion. Personal som senare byter sektion eller raderas finns kvar med låst tid (2.8).
* Extern personal (frivillig, se 2.7): kan kopplas till initiativet utöver den vanliga personalen. Extern personal räknas inte som en person i kravet på minst 1 kopplad person.
* År (Ett eller flera relevanta kalenderår)
* Budget i två delar, båda frivilliga och oberoende av varandra. Ett initiativ kan ha ingen, en eller båda. En angiven budget måste vara ett heltal större än 0, och båda avser initiativets alla år:
  * **Intern budget** (SEK): för tid från personal i initiativets sektion, även låst tid (2.8).
  * **Extern budget** (SEK): för tid från Extern personal (2.7).
* Tajmaklass (frivillig): ett av värdena `IMM`, `Vidareutveckling` eller `Drift`, eller tomt. Standardvärdet är tomt.



### 2.5 Tidsregistrering – Estimat (Allokering)

* **Egenskaper:**
* Koppling till: Initiativ + Personal + År + Månad (Jan–Dec)
* Planerat antal timmar (heltal $\ge 0$)



### 2.6 Tidsregistrering – Utfall

* **Egenskaper:**
* Koppling till: Initiativ + Personal + År + Månad (Jan–Dec)
* Faktiskt nedlagt antal timmar (heltal $\ge 0$), **eller inget värde** (= utfall ej rapporterat). "Ej rapporterat" skiljer sig från rapporterade 0 timmar.
* Utfall kan endast rapporteras för personer som är kopplade till initiativet, och för initiativets år.
* Utfall kan rapporteras för alla månader (inga låsta eller stängda perioder).



### 2.7 Extern personal

Ibland lägger personal utanför de ordinarie teamen och sektionerna tid på ett initiativ. Vem som har arbetat och vilken organisation de tillhör är ointressant; det som registreras är deras **samlade timmar per månad**.

* **Extern personal** är en inbyggd post i systemet. Den skapas inte, redigeras inte och kan inte raderas, och den visas inte i adminlägets flik Personal.
* Den kan kopplas till vilket initiativ som helst och har då, precis som övrig personal, både **estimat** och **utfall** per år och månad.
* **Timkostnad (schablon):** medelvärdet av standardtimkostnaden för anställd och konsult (3.2), avrundat till närmaste heltal. Med standardvärdena 625 och 1 130 kr/h blir det 878 kr/h. Värdet anges inte manuellt och följer automatiskt med när standardvärdena ändras.
* **Inget tak:** Extern personal har ingen normal arbetstid, eftersom det kan vara en eller flera personer, och kan därför aldrig bli överallokerad.
* **Ingen sektion:** Extern personal tillhör ingen sektion, och dess tid låses aldrig.



### 2.8 Låst tid

En persons tid på ett initiativ är **låst** när personen har bytt till en annan sektion än initiativets, eller när personen har raderats.

* Låst tid finns kvar och räknas med överallt: i summor, kostnader, prognos och utfall av den interna budgeten, nyckeltal och CSV-export.
* Låst tid kan inte ändras, och ny tid kan inte registreras – varken estimat eller utfall.
* Låsningen räknas fram och lagras inte: flyttar personen tillbaka till initiativets sektion kan tiden ändras igen.
* En koppling som blir låst utan att någon tid är registrerad tas bort automatiskt, eftersom det inte finns någon tid att bevara. Detsamma gäller en låst koppling vars tid försvinner, t.ex. när året med tiden tas bort från initiativet.
* Raderad personal som inte längre har någon låst tid tas bort helt, t.ex. när personen raderas utan registrerad tid eller när initiativen med tiden raderas. På så sätt kan all data alltid raderas manuellt: först personal och initiativ, därefter produktägare och till sist sektioner.
* Data från tidigare versioner, där personal kunde kopplas till initiativ i andra sektioner, får låst tid på dessa initiativ. Ingen tid raderas.



---

## 3. Adminläge (Administrationsvy)

I adminläget ska administratörer kunna skapa, redigera och radera grundläggande entiteter och deras relationer.

**Redigeringsspärr (skydd mot oavsiktliga ändringar):**

* Överst i adminläget finns en växel som slår på respektive av möjligheten att ändra data. Knappen består endast av en låsikon: låst (🔒) när redigering är avstängd och öppen (🔓) när den är påslagen.
* **Standard är avstängd.** Varje ny webbläsarflik startar med redigering avstängd.
* Slås redigering på gäller det så länge sessionen pågår, dvs. **per webbläsarflik**: valet överlever att sidan laddas om men inte att fliken stängs.
* När redigering är avstängd är allt som ändrar data låst: skapa, redigera och radera sektioner, personal, produktägare och initiativ (inklusive att flytta innehåll mellan sektioner) samt standardvärdena under Inställningar. Knapparna syns men är avstängda (utan förklarande ledtext), och fälten under Inställningar är skrivskyddade.
* Det som bara läser data är alltid öppet: listor, sortering, filter och export till Excel (CSV) under fliken Export.
* När redigering är påslagen markeras adminläget med en färgad list, så att det är tydligt att data kan ändras.
* Spärren gäller endast adminläget. Inmatning av estimat och utfall i arbetsläget påverkas inte.
* Spärren är ett skydd mot misstag, inte en behörighetskontroll (se 6, Säkerhet).

**Sortering:** Listorna i adminläget kan sorteras genom att klicka på en kolumnrubrik. Ett klick på en ny kolumn sorterar stigande (▲) på den; ett nytt klick på samma kolumn växlar till fallande (▼). Sorterbara kolumner visar en diskret ↕ tills de väljs.

| Flik | Sorterbara kolumner |
|---|---|
| Sektioner | Namn |
| Personal | Namn, Sektion, Typ, Timkostnad, Arbetstid/mån, Initiativ |
| Produktägare | Namn, Sektion, Initiativ |
| Initiativ | Samtliga: Namn, Sektion, Produktägare, Tajmaklass, År, Personal, Intern budget, Extern budget |

* Text sorteras i svensk alfabetisk ordning (Å, Ä, Ö sist), skiljer inte på versaler och gemener och sorterar siffror i nummerordning ("Fas 2" före "Fas 10").
* Belopp och timmar (Timkostnad, Arbetstid/mån, Intern budget, Extern budget) sorteras numeriskt. Timkostnad och arbetstid avser det värde som gäller för personen (eget värde eller standardvärdet för typen).
* År sorteras på initiativets första år och därefter sista år.
* Kolumnerna Initiativ och Personal sorteras på den visade listan, där namnen står i alfabetisk ordning.
* Rader som saknar värde (t.ex. initiativ utan budget eller person utan initiativ) hamnar alltid sist, oavsett riktning.
* Rader med lika värden sorteras vidare på namn (stigande).
* Standard är Namn stigande. Vald kolumn och riktning gäller per flik och sparas mellan besök.

### 3.1 Hantering av Sektioner

* En sektion är det första en användare måste skapa. Personal och produktägare (och därmed initiativ) kan inte skapas förrän minst en sektion finns; gränssnittet hänvisar då till fliken Sektioner.
* Skapa sektion och byta namn på sektion.
* Radera sektion:
* **Regel:** En sektion får endast raderas när den är tom: ingen personal (inte heller raderad personal med låst tid), inga produktägare och därmed inga initiativ. Att radera en sektion med tillhörande data är inte tillåtet.
* Om sektionen har innehåll hindrar systemet radering och kräver att allt innehåll först flyttas till en annan sektion med **Flytta allt**. Personal, produktägare och initiativ flyttas då tillsammans, så att personalen behåller sina initiativ och ingen tid låses. Dialogen visar vad sektionen innehåller, även raderad personal med låst tid (t.ex. "1 raderad person med låst tid"). Den låsta tiden försvinner när initiativen med tiden raderas, och då kan sektionen raderas.

### 3.2 Hantering av Personal

* Skapa ny personal med namn, typ (`Anställd`/`Konsult`) och sektion.
* Redigera befintlig personal och deras egenskaper, inklusive byte av sektion.
* **Byte av sektion:** innan bytet sparas visar en bekräftelsedialog de initiativ där personen blir låst ("Anna blir låst på Portal och App. Tiden finns kvar men kan inte ändras.") och de initiativ där personen kopplas bort eftersom ingen tid är registrerad. Därefter kan personen bara arbeta på initiativ i den nya sektionen.
* **Radera personal:** personen markeras som raderad och visas inte längre i fliken Personal eller i några val. Tiden som redan registrerats finns kvar men låses (2.8); bekräftelsedialogen visar den per initiativ. Saknar personen registrerad tid tas den bort helt. Namnet får användas av en ny person.
* Antalet personal (t.ex. i flikens rubrik) avser aktiv personal.
* Det ska finnas en global inställning för samtlig personal som anger hur mycket en konsult respektive anställd kostar samt hur många timmar per månad de förväntas att arbeta. Inställningen är gemensam för alla sektioner.
* **Förifyllda standardvärden:** Anställd 625 kr/h och Konsult 1 130 kr/h, båda med 160 timmar per månad. Värdena gäller tills de ändras under Inställningar, och för alla personer som saknar egen timkostnad eller arbetstid.
* Under Inställningar visas även **Extern personal** (2.7) med sin schablontimkostnad, "Inget tak" för arbetstiden och antalet initiativ den är kopplad till. Värdena är skrivskyddade och räknas fram automatiskt.

### 3.3 Hantering av Produktägare

* Skapa och redigera produktägare, inklusive vilken sektion produktägaren tillhör.
* **Byte av sektion:** initiativen stannar i sin sektion med sin personal. En produktägare med initiativ kan därför bara byta sektion efter att varje initiativ först fått en ny produktägare i den nuvarande sektionen. Redigeringsdialogen visar initiativen med ett val av ny produktägare för vart och ett, och Spara är avstängd tills alla har fått en ny produktägare.
* Radera produktägare:
* **Regel:** En produktägare får endast raderas när dess initiativ har fått en ny produktägare i samma sektion.
* Dialogen listar initiativen med ett val av ny produktägare för vart och ett; Radera är avstängd tills alla har fått en ny. Initiativ kan inte raderas från dialogen (det görs vid behov under fliken Initiativ).
* Finns ingen annan produktägare i sektionen hänvisar dialogen till att först skapa en ny produktägare i sektionen.



### 3.4 Hantering av Initiativ

* Skapa nytt initiativ samt koppla det till **exakt en** produktägare. Initiativet tillhör produktägarens sektion.
* Redigera initiativets namn, byta produktägare samt lägga till/ta bort kopplad personal.
* Ett befintligt initiativ kan bara byta till en produktägare **i samma sektion**.
* **Personal i formuläret:** personallistan visas först när en produktägare är vald. Den innehåller all aktiv personal i produktägarens sektion och endast den; personal från andra sektioner kan inte kopplas. Innan en produktägare är vald visas en uppmaning att välja produktägare.
* Byter ett nytt initiativ till en produktägare i en annan sektion avmarkeras vald personal från den tidigare sektionen.
* Personer med låst tid (bytt sektion eller raderade, 2.8) visas inte i listan, men finns kvar i initiativet med sin tid.
* **Extern personal** (2.7) kopplas med en egen kryssruta under personallistan, som också visas först när en produktägare är vald och visar schablontimkostnaden. Den räknas inte med i antalet valda personer. I initiativlistans kolumn Personal visas den som "Extern personal", och raderad personal som t.ex. "Anna Andersson (raderad)".
* Ange, ändra eller ta bort initiativets **intern budget** och **extern budget** i två separata fält (frivilliga uppgifter). Budgeten anges endast i adminläget.
* Välja initiativets **Tajmaklass** i en lista med värdena: tomt ("– (ingen)"), IMM, Vidareutveckling, Drift. Nya initiativ har tomt värde som standard och kan skapas med tomt värde. Värdet kan ändras och tas bort (sättas till tomt) i efterhand.
* Initiativlistan i adminläget har kolumnerna Namn, Sektion, Produktägare, Tajmaklass ("–" när värdet är tomt), År, Personal, Intern budget och Extern budget. Estimat och utfall visas inte i adminläget utan i arbetsläget.
* Radera initiativ:
* Ett initiativ ska kunna raderas oavsett vilken information eller vilka timmar som finns kopplade till det.
* När personal (inklusive Extern personal) eller år tas bort från ett initiativ, eller när initiativet raderas, raderas både estimat och utfall, även låst tid. Bekräftelsedialogen visar hur många timmar av vardera som försvinner. (När personal raderas raderas däremot ingen tid, se 3.2 och 2.8.)

### 3.5 Export (fliken Export)

Fliken Export innehåller endast export till Excel. Det går inte att exportera eller importera data som JSON, att ladda exempeldata eller att radera all data på en gång.

* **Export för Excel (CSV):** Platt analysfil avsedd för t.ex. pivottabeller i Excel.
* En rad per initiativ, person, år och månad. Alla kopplade personer och initiativets alla år tas med, även månader med 0 timmar.
* Kolumner: År, Månad (1–12), Månadsnamn, Sektion (initiativets), Produktägare, Initiativ, Person, Personens sektion (nuvarande sektion), Typ, Estimat (h), Utfall (h), Avvikelse (h), Timkostnad (kr/h), Estimerad kostnad (kr), Utfallskostnad (kr), Normal arbetstid (h/mån), Totalt estimat alla initiativ (h), Överallokerad (estimat) (Ja/Nej).
* Utfall (h), Avvikelse (h) (= utfall − estimat) och Utfallskostnad (kr) lämnas tomma för månader utan rapporterat utfall.
* Låst tid (2.8) exporteras som övrig tid. Raderad personal exporteras med "(raderad)" efter namnet, t.ex. "Anna Andersson (raderad)", så att den går att skilja från en ny person med samma namn.
* Extern personal (2.7) exporteras med Person "Extern personal" och Typ "Extern". Personens sektion, Normal arbetstid och Totalt estimat alla initiativ lämnas tomma, och Överallokerad är alltid "Nej".
* Alla tal i filen är heltal (se 5.4), utan tusentalsavgränsare.
* Anpassad för svensk Excel: semikolon som avgränsare och UTF-8 med BOM, så att filen kan öppnas direkt med dubbelklick.



---

## 4. Arbetsläge (Arbetsvy & Budgetering)

Arbetsläget är huvudsidan där den faktiska planerade tiden matas in och analyseras.

### 4.1 Filter & Navigering

* **Årsväljare:** Möjlighet att välja kalenderår (t.ex. 2026, 2027) för att filtrera fram relevanta initiativ för det valda året.
* **Sektionsväljare:** Dropdown/väljare för att välja en sektion (eller alla sektioner). När en sektion är vald visas endast initiativ i sektionen, och produktägareväljaren visar endast sektionens produktägare.
* **Produktägareväljare:** Dropdown/väljare för att välja en produktägare. När en produktägare är vald visas samtliga initiativ som tillhör denna produktägare under det valda året.
* **Tajmaklassväljare:** Dropdown/väljare till höger om produktägareväljaren för att visa initiativ med en viss tajmaklass. Valen är **Alla tajmaklasser** (standard), IMM, Vidareutveckling, Drift och **Ingen tajmaklass** (initiativ där tajmaklassen är tom). Filtret kombineras med år, sektion och produktägare, och valet sparas mellan besök. Visas inga initiativ anger meddelandet även tajmaklassen, t.ex. "Det finns inga initiativ med tajmaklass Drift för 2026."
* **Vyväljare:** `Estimat` | `Utfall` | `Jämförelse`. Vyn styr vad hela arbetsläget visar och vad som kan matas in: initiativtabeller, nyckeltal och kapacitetsöversikt. Varje vy har en egen accentfärg (tabellkant, etikett vid initiativnamnet och markerad cell), så att det alltid är tydligt om man matar in estimat eller utfall. Valet sparas mellan besök.

### 4.2 Initiativtabell (Vy per initiativ)

Varje initiativ visas i form av en separat tabell. Layouten nedan gäller vyn **Estimat**; vyerna Utfall och Jämförelse beskrivs i 4.3 och 4.4.

* **Tabellhuvud:**
* Initiativets namn samt vilken sektion och produktägare det tillhör, t.ex. "Sektion: Digitala kanaler · Produktägare: Maria Lind".
* Tabellhuvudet visar den estimerade kostnaden för året uppdelad i **Prognos intern** (personal i sektionen, även låst tid) och **Prognos extern** (Extern personal), t.ex. "Prognos intern 2026". Timmar och total kostnad visas inte i tabellhuvudet, så att samma information inte förekommer på två ställen; de syns i totalkolumnen och summeringsraden. **Prognos extern** visas bara när Extern personal är kopplad till initiativet.
* Om initiativet har en tajmaklass visas den efter produktägaren: "· Tajmaklass: IMM". Är tajmaklassen tom visas ingenting – inte heller ordet "Tajmaklass". Gäller i alla vyer (Estimat, Utfall, Jämförelse).
* För initiativ som har en budget visas varje del av budgeten som ett eget block, **Intern budget** och **Extern budget**, bredvid varandra (intern först). Varje block visar beloppet (SEK) och **Prognos**: den estimerade kostnaden för den delen som andel av den delens budget i procent, med en förloppsstapel.
  * Den interna budgeten jämförs med kostnaden för personal i sektionen (även låst tid), den externa med kostnaden för Extern personal.
  * Andelen uppdateras direkt när estimat matas in. Om den estimerade kostnaden överstiger budgeten (>100 %) visas procentsatsen i röd text, för respektive del.
  * För initiativ som gäller flera år anges att andelen avser alla år.
  * Saknas en del av budgeten visas inget block för den; initiativ utan budget visar ingen budgetinformation. Någon total budget (summan av delarna) visas inte.


* **Kolumner:**
1. **Personal:** Visar namnet på de personer som är kopplade till initiativet. Personal med låst tid (2.8) visas med orsaken efter namnet, "Anna Andersson (bytt sektion)" eller "Anna Andersson (raderad)", och raden är skrivskyddad i alla vyer. Är Extern personal (2.7) kopplad visas den som sista rad, märkt "Extern · schablon 878 kr/h", och matas in och summeras som övrig personal i alla vyer.
2. **Månader (12 kolumner):** Januari till December.
3. **Totalt timmar per person:** Summan av alla inmatade timmar för personen under året i detta initiativ, med enheten efter siffran (t.ex. "107 h"), på samma sätt som kostnaderna visas med "kr".
4. **Totalt kostnad per person:** $(\text{Totalt timmar}) \times (\text{Personens timkostnad})$.


* **Rader (Datafält):**
* Varje rad representerar en kopplad person.
* I månadskolumnerna kan användaren mata in/ändra planerat antal timmar för personen den månaden.


* **Summeringsrad (Längst ned i varje initiativtabell):**
* Summa timmar per månad för hela initiativet.
* **Totalsumma timmar:** Totala timmar för alla personer under hela året på initiativet (t.ex. "118 h").
* **Totalsumma kostnad:** Total finansiell kostnad för hela initiativet ($SEK$).

### 4.3 Vyn Utfall

* Samma tabellayout som estimatvyn, men månadscellerna gäller utfall och kolumnen "Totalt h" heter "Utfall h". Även där visas timmarna med "h" efter siffran.
* En tom cell betyder "utfall ej rapporterat" och visar estimatet som grå ledtext. En inskriven 0 betyder rapporterade 0 timmar. Raderas värdet blir cellen åter "ej rapporterad".
* Knappen **Fyll från estimat** per person fyller i utfall = estimat för avslutade månader (t.o.m. föregående månad) som saknar utfall. Redan rapporterat utfall ändras inte. Knappen visas bara när det finns något att fylla, och aldrig för låst tid.
* Tabellhuvudet visar utfallskostnaden för året uppdelad i **Utfall intern** (personal i sektionen, även låst tid) och **Utfall extern** (Extern personal), t.ex. "Utfall intern 2026". Timmar och total utfallskostnad visas inte i tabellhuvudet; de syns i totalkolumnen och summeringsraden. **Utfall extern** visas bara när Extern personal är kopplad till initiativet. För initiativ med budget visas, för varje del av budgeten (intern och extern), **Utfall** (utfallskostnad för den delen) och **Prognos** (estimerad kostnad för den delen) i procent av den delens budget (alla år), med en stapel där utfallet är heldraget och prognosen ljusare bakom. Prognos över 100 % visas i röd text. **Prognosen ändras inte när utfall matas in, rättas eller tas bort** – endast utfallsprocenten gör det.
* **Färg på utfallet:** Utfallsprocenten och dess del av stapeln (indikatorn) färgas, för varje del av budgeten, efter utfallets egen andel av den delens budget: **grön** när utfallet är 100 % eller mindre, **röd** när det är 101 % eller mer. Gränsen avser den visade, till hela procent avrundade siffran (100,4 % visas som "100 %" och är grön; 100,6 % visas som "101 %" och är röd). Färgen påverkas inte av prognosen. Samma regel gäller budgetrutan i vyn Jämförelse.
* Överallokering (röd text) beräknas på utfall.

### 4.4 Vyn Jämförelse

* Skrivskyddad analysvy.
* Varje månadscell visar utfallet och under det avvikelsen mot estimatet med ▲ (mer tid än planerat) eller ▼ (mindre tid). Månader utan rapporterat utfall visas som "–". Avvikelser markeras med symboler och neutral färg (▲ orange, ▼ blå). Röd färg är reserverad för överallokering.
* Kolumnerna till höger: **Estimat h** (helår), **Utfall h** och **Avvikelse h** (timmar och procent). Alla timmar visas med "h" efter siffran (t.ex. "200 h" och "−10 h"), på samma sätt som procentsatsen visas med "%" och som i estimat- och utfallsvyn. Avvikelsen räknas endast på månader med rapporterat utfall. Initiativets totala avvikelse syns i summeringsraden.
* Ett klick på pilen vid en person fäller ut en extra rad med estimatet per månad.
* Tabellhuvudet visar för valt år, i ordning: utfallskostnaden uppdelad i **Utfall intern** och **Utfall extern** (rapporterade timmar × respektive persons timkostnad) och den estimerade kostnaden uppdelad i **Prognos intern** och **Prognos extern**. Intern avser personal i sektionen, även låst tid, och extern avser Extern personal; de externa kostnaderna visas bara när Extern personal är kopplad till initiativet. Avvikelsen visas inte i tabellhuvudet, eftersom den syns i summeringsraden. För initiativ med budget visas därefter utfall och prognos för den interna och den externa budgeten som i 4.3.
* Nyckeltal visar, i ordning: antal initiativ, totalt estimat (h) och totalt utfall (h) för året bredvid varandra, **Prognos kostnad** (estimerad kostnad) och till höger om den **Utfallskostnad** (faktisk total kostnad: rapporterade timmar × respektive persons timkostnad), och sist **Intern budget** och **Extern budget** (se 4.5). Nyckeltalen avser de initiativ som visas, dvs. följer års-, sektions-, produktägar- och tajmaklassfiltret. Kapacitetsöversikten visar estimatet.

### 4.5 Nyckeltal och kapacitetsöversikt per vy

| Vy | Nyckeltal | Kapacitetsöversikt |
|---|---|---|
| Estimat | Initiativ, planerade timmar, planerad kostnad, överallokerade personmånader, intern budget, extern budget | Planerad tid |
| Utfall | Initiativ, utfall (h), utfallskostnad, överallokerade personmånader (utfall), intern budget, extern budget | Rapporterat utfall |
| Jämförelse | Initiativ, estimat (h), utfall (h), prognos kostnad (= estimerad kostnad), utfallskostnad (faktisk kostnad), intern budget, extern budget | Estimat |

* Nyckeltalen visar ingen sammanlagd avvikelse mot estimat. Avvikelsen visas per person, månad och initiativ i jämförelsevyns tabeller (4.4).
* **Intern budget** och **Extern budget** visas längst till höger i alla vyer, som två separata nyckeltal: summan av den interna respektive externa budgeten för de initiativ som visas (följer års-, sektions-, produktägar- och tajmaklassfiltret). Initiativ utan den delen av budgeten räknas inte med; ett tips anger hur många av de visade initiativen som har intern respektive extern budget. Saknar alla visade initiativ den delen visas "–".
* Budgeten avser initiativets alla år och räknas med i sin helhet, till skillnad från övriga nyckeltal som avser valt år. Gäller något av de visade initiativen med den delen av budgeten flera år får nyckeltalet tillägget "(alla år)", t.ex. **Intern budget (alla år)**.



---

## 5. Affärslogik & Valideringsregler

1. **Ekonomiberäkning:**
* Kostnad per person & månad = $\text{Timmar} \times \text{Timkostnad}$.
* Totalkostnad för initiativ = Summan av alla personers kostnader för initiativet.
* **Prognos** = estimerad kostnad = summan av estimerade timmar × respektive persons timkostnad, dvs. den beror på vilken personal som arbetar med initiativet och hur många timmar de planeras lägga. Prognosen beror **enbart** på estimatet och påverkas aldrig av utfall.
* Prognos och utfall av budget beräknas för varje del av budgeten:
  * Prognos av intern budget (%) = (Estimerad kostnad för personal i sektionen, även låst tid, för initiativets **alla år**) / Intern budget × 100.
  * Prognos av extern budget (%) = (Estimerad kostnad för Extern personal, initiativets **alla år**) / Extern budget × 100.
  * Utfall av intern respektive extern budget (%) beräknas på samma sätt med utfallskostnaden.
* Utfallskostnad = Utfall (timmar) × Timkostnad. Timkostnaden är alltid den aktuella; ändras den räknas även historiskt utfall om.
* Extern personals timkostnad = (standardtimkostnad anställd + standardtimkostnad konsult) / 2, avrundad till närmaste heltal (2.7). Extern personals timmar och kostnader räknas med i initiativets summor, i prognos och utfall av den externa budgeten och i nyckeltalen för timmar och kostnad.
* **Avvikelse** = Utfall − Estimat, beräknat endast på månader med rapporterat utfall. Avvikelse i procent = Avvikelse / Estimat (för samma månader) × 100.


2. **Indikering vid Överallokering (Kapacitetskontroll):**
* Systemet ska beräkna en persons **totala allokering i alla initiativ sammanlagt** per månad, oavsett vilken sektion initiativen tillhör.
* Extern personal (2.7) har inget tak och kan aldrig bli överallokerad. Den visas inte i kapacitetsöversikten och räknas inte i nyckeltalet för överallokerade personmånader.
* Raderad personal visas inte heller i kapacitetsöversikten och räknas inte som överallokerad. Personal som bytt sektion visas som vanligt, med all sin tid, även den låsta.
* Beräkningen görs på utfall i utfallsvyn och på estimat i övriga vyer.
* Om en persons totala arbetstid för en specifik månad överskrider personens inställda *normala arbetstid* (t.ex. >160 timmar), ska detta indikeras visuellt med **röd färg** i gränssnittet där personen förekommer.
* Markeringen görs med **röd text**: personens namn samt timsiffran för den överallokerade månaden visas i rött. Cellerna ska **inte** få röd bakgrundsfärg.


3. **Kopplingskrav:**
* Personal och produktägare måste alltid tillhöra exakt 1 sektion. Undantag: Extern personal (2.7) tillhör ingen sektion.
* Personal kan bara kopplas till initiativ i sin egen sektion. Raderad personal kan inte kopplas.
* Ett initiativ måste alltid ha exakt 1 produktägare, och tillhör alltid produktägarens sektion.
* Det ska gå att ta bort personal från ett initiativ i adminläget tills det inte finns någon personal kvar (eller tills initiativet tas bort).


4. **Endast heltal:**
* Systemet hanterar endast heltal. Alla tal som matas in – pengar (timkostnad, budget) såväl som tid (estimat, utfall, arbetstid) – är heltal som är 0 eller större (budget större än 0).
* Inmatning med decimaler (t.ex. "7,5") godtas inte: fältet markeras som ogiltigt och värdet sparas inte.
* Alla tal som presenteras visas som heltal. Ger en beräkning decimaler (t.ex. procent av budget, avvikelse i procent) avrundas resultatet till närmaste heltal när det visas; själva beräkningen görs med full precision. Samma gäller CSV-exporten.



---

## 6. Övrigt

* **Gränssnitt (UI):** Enkelt, funktionellt, reaktivt UI så att summo- och kostnadsberäkningar uppdateras direkt vid inmatning utan att sidan laddas om.
* **Tillstånd & Lagring:** Enkel och direkt lagring, någon form av localstorage. Applikationen kommer att hantera en liten datamängd och skall ej ha någon databas eller backend. Informationen som matas in i applikationen måste lagras persistent.
* **Bakåtkompatibilitet:** Sparad data från tidigare versioner utan sektioner flyttas automatiskt in i en sektion med namnet "Standardsektion", som sedan kan döpas om. Data utan utfall läses in med tomt utfall, och initiativ utan tajmaklass får tomt värde. Decimaltal i äldre data (timmar, timkostnad, arbetstid och budget) avrundas till närmaste heltal vid inläsning. En budget från tidigare versioner, som bara hade en budget, blir **intern budget**; den externa budgeten lämnas tom.
* **Säkerhet** Ingen inloggning eller autentisering. Alla som har länken ska kunna utnyttja alla features. Redigeringsspärren i adminläget (3) skyddar endast mot oavsiktliga ändringar; vem som helst kan slå på redigering.
