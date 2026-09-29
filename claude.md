# Kravspecifikation för webbapplikation: Budget & Resursplanering

## 1. Översikt & Syfte

Systemet är en webbaserad applikation för budgetering, resurs- och kapacitetsplanering. Syftet är att ge en tydlig översikt över hur mycket tid och pengar som allokeras på olika initiativ uppdelat per sektion, produktägare, person och månad.

Tid hanteras på två sätt: **estimat** (planerad tid) och **utfall** (faktiskt nedlagd tid). Estimatet utgör **prognosen**; utfallet följs upp mot prognosen och visar avvikelser. Prognos och utfall är två oberoende mått – inmatat utfall påverkar aldrig prognosen.

All data grupperas i **sektioner**, som ligger högst upp i hierarkin:

```
Sektion
├── Personal (hemsektion; kan lånas ut till initiativ i andra sektioner)
└── Produktägare
    └── Initiativ (tillhör samma sektion som sin produktägare)
```

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
* Sektion (exakt 1 sektion, personens hemsektion). Personen kan ändå kopplas till initiativ i andra sektioner ("lånas ut").
* Timkostnad/Timpris (numeriskt värde i SEK/h)
* Normal arbetstid per månad (t.ex. 160 timmar/månad)



### 2.3 Produktägare

* **Egenskaper:**
* Namn (sträng)
* Sektion (exakt 1 sektion)



### 2.4 Initiativ

* **Egenskaper:**
* Namn (sträng)
* Tillhörig Produktägare (Exakt 1 produktägare)
* Sektion: väljs inte separat utan är alltid densamma som produktägarens sektion.
* Kopplad Personal (Minst 1 person). Personal från andra sektioner än initiativets får kopplas.
* År (Ett eller flera relevanta kalenderår)
* Budget (frivillig): totalbudget i SEK för initiativets alla år. Om budget anges måste den vara större än 0.
* Tajmaklass (frivillig): ett av värdena `IMM`, `Vidareutveckling` eller `Drift`, eller tomt. Standardvärdet är tomt.



### 2.5 Tidsregistrering – Estimat (Allokering)

* **Egenskaper:**
* Koppling till: Initiativ + Personal + År + Månad (Jan–Dec)
* Planerat antal timmar (numeriskt värde $\ge 0$)



### 2.6 Tidsregistrering – Utfall

* **Egenskaper:**
* Koppling till: Initiativ + Personal + År + Månad (Jan–Dec)
* Faktiskt nedlagt antal timmar (numeriskt värde $\ge 0$), **eller inget värde** (= utfall ej rapporterat). "Ej rapporterat" skiljer sig från rapporterade 0 timmar.
* Utfall kan endast rapporteras för personer som är kopplade till initiativet, och för initiativets år.
* Utfall kan rapporteras för alla månader (inga låsta eller stängda perioder).



---

## 3. Adminläge (Administrationsvy)

I adminläget ska administratörer kunna skapa, redigera och radera grundläggande entiteter och deras relationer.

**Sortering:** Listorna i adminläget kan sorteras genom att klicka på en kolumnrubrik. Ett klick på en ny kolumn sorterar stigande (▲) på den; ett nytt klick på samma kolumn växlar till fallande (▼). Sorterbara kolumner visar en diskret ↕ tills de väljs.

| Flik | Sorterbara kolumner |
|---|---|
| Sektioner | Namn |
| Personal | Namn, Sektion, Typ, Timkostnad, Arbetstid/mån, Initiativ |
| Produktägare | Namn, Sektion, Initiativ |
| Initiativ | Samtliga: Namn, Sektion, Produktägare, Tajmaklass, År, Personal, Estimat, Utfall, Budget |

* Text sorteras i svensk alfabetisk ordning (Å, Ä, Ö sist), skiljer inte på versaler och gemener och sorterar siffror i nummerordning ("Fas 2" före "Fas 10").
* Belopp och timmar (Timkostnad, Arbetstid/mån, Estimat, Utfall, Budget) sorteras numeriskt. Timkostnad och arbetstid avser det värde som gäller för personen (eget värde eller standardvärdet för typen).
* År sorteras på initiativets första år och därefter sista år.
* Kolumnerna Initiativ och Personal sorteras på den visade listan, där namnen står i alfabetisk ordning.
* Rader som saknar värde (t.ex. initiativ utan budget eller person utan initiativ) hamnar alltid sist, oavsett riktning.
* Rader med lika värden sorteras vidare på namn (stigande).
* Standard är Namn stigande. Vald kolumn och riktning gäller per flik och sparas mellan besök.

### 3.1 Hantering av Sektioner

* En sektion är det första en användare måste skapa. Personal och produktägare (och därmed initiativ) kan inte skapas förrän minst en sektion finns; gränssnittet hänvisar då till fliken Sektioner.
* Skapa sektion och byta namn på sektion.
* Radera sektion:
* **Regel:** En sektion får endast raderas om den inte har någon personal eller några produktägare (och därmed inga initiativ).
* Om sektionen har innehåll ska systemet hindra radering, lista berörd personal och berörda produktägare och kräva att dessa flyttas till en annan sektion (enskilt eller allt på en gång) eller raderas först. Initiativ följer med sin produktägare.

### 3.2 Hantering av Personal

* Skapa ny personal med namn, typ (`Anställd`/`Konsult`) och sektion.
* Redigera befintlig personal och deras egenskaper, inklusive byte av sektion.
* Radera personal.
* Det ska finnas en global inställning för samtlig personal som anger hur mycket en konsult respektive anställd kostar samt hur många timmar per månad de förväntas att arbeta. Inställningen är gemensam för alla sektioner.

### 3.3 Hantering av Produktägare

* Skapa och redigera produktägare, inklusive vilken sektion produktägaren tillhör.
* Byts produktägarens sektion flyttas produktägarens initiativ med till den nya sektionen.
* Radera produktägare:
* **Regel:** En produktägare får endast raderas om den inte har några kopplade initiativ.
* Om initiativ finns kopplade ska systemet hindra radering, lista alla berörda initiativ och kräva att dessa antingen raderas eller tilldelas en ny produktägare (i samma sektion) först.



### 3.4 Hantering av Initiativ

* Skapa nytt initiativ samt koppla det till **exakt en** produktägare. Initiativet tillhör produktägarens sektion.
* Redigera initiativets namn, byta produktägare samt lägga till/ta bort kopplad personal.
* Ett befintligt initiativ kan bara byta till en produktägare **i samma sektion**.
* Personal från andra sektioner kan kopplas och markeras då som inlånad.
* Ange, ändra eller ta bort initiativets budget (frivillig uppgift). Budgeten anges endast i adminläget.
* Välja initiativets **Tajmaklass** i en lista med värdena: tomt ("– (ingen)"), IMM, Vidareutveckling, Drift. Nya initiativ har tomt värde som standard och kan skapas med tomt värde. Värdet kan ändras och tas bort (sättas till tomt) i efterhand.
* Initiativlistan i adminläget har en kolumn Tajmaklass ("–" när värdet är tomt).
* Radera initiativ:
* Ett initiativ ska kunna raderas oavsett vilken information eller vilka timmar som finns kopplade till det.
* När personal eller år tas bort från ett initiativ, eller när personal eller initiativ raderas, raderas både estimat och utfall. Bekräftelsedialogen visar hur många timmar av vardera som försvinner.

### 3.5 Datahantering (fliken Data)

* **Export/import (JSON):** All data och alla inställningar kan exporteras till en JSON-fil och importeras igen (för backup och för att flytta data mellan webbläsare/personer). Import ersätter all befintlig data efter bekräftelse.
* **Export för Excel (CSV):** Platt analysfil avsedd för t.ex. pivottabeller i Excel.
* En rad per initiativ, person, år och månad. Alla kopplade personer och initiativets alla år tas med, även månader med 0 timmar.
* Kolumner: År, Månad (1–12), Månadsnamn, Sektion (initiativets), Produktägare, Initiativ, Person, Personens sektion (hemsektion), Typ, Estimat (h), Utfall (h), Avvikelse (h), Timkostnad (kr/h), Estimerad kostnad (kr), Utfallskostnad (kr), Normal arbetstid (h/mån), Totalt estimat alla initiativ (h), Överallokerad (estimat) (Ja/Nej).
* Utfall (h), Avvikelse (h) (= utfall − estimat) och Utfallskostnad (kr) lämnas tomma för månader utan rapporterat utfall.
* Anpassad för svensk Excel: semikolon som avgränsare, decimalkomma utan tusentalsavgränsare och UTF-8 med BOM, så att filen kan öppnas direkt med dubbelklick.



---

## 4. Arbetsläge (Arbetsvy & Budgetering)

Arbetsläget är huvudsidan där den faktiska planerade tiden matas in och analyseras.

### 4.1 Filter & Navigering

* **Årsväljare:** Möjlighet att välja kalenderår (t.ex. 2026, 2027) för att filtrera fram relevanta initiativ för det valda året.
* **Sektionsväljare:** Dropdown/väljare för att välja en sektion (eller alla sektioner). När en sektion är vald visas endast initiativ i sektionen, och produktägareväljaren visar endast sektionens produktägare.
* **Produktägareväljare:** Dropdown/väljare för att välja en produktägare. När en produktägare är vald visas samtliga initiativ som tillhör denna produktägare under det valda året.
* **Vyväljare:** `Estimat` | `Utfall` | `Jämförelse`. Vyn styr vad hela arbetsläget visar och vad som kan matas in: initiativtabeller, nyckeltal och kapacitetsöversikt. Varje vy har en egen accentfärg (tabellkant, etikett vid initiativnamnet och markerad cell), så att det alltid är tydligt om man matar in estimat eller utfall. Valet sparas mellan besök.

### 4.2 Initiativtabell (Vy per initiativ)

Varje initiativ visas i form av en separat tabell. Layouten nedan gäller vyn **Estimat**; vyerna Utfall och Jämförelse beskrivs i 4.3 och 4.4.

* **Tabellhuvud:**
* Initiativets namn samt vilken sektion och produktägare det tillhör, t.ex. "Sektion: Digitala kanaler · Produktägare: Maria Lind".
* Om initiativet har en tajmaklass visas den efter produktägaren: "· Tajmaklass: IMM". Är tajmaklassen tom visas ingenting – inte heller ordet "Tajmaklass". Gäller i alla vyer (Estimat, Utfall, Jämförelse).
* För initiativ som har en budget visas även **Budget totalt** (SEK) och **Prognos** (estimerad kostnad som andel av budgeten i procent, med en förloppsstapel). Andelen uppdateras direkt när estimat matas in. Om den estimerade kostnaden överstiger budgeten (>100 %) visas procentsatsen i röd text. För initiativ som gäller flera år anges att andelen avser alla år. Initiativ utan budget visar ingen budgetinformation.


* **Kolumner:**
1. **Personal:** Visar namnet på de personer som är kopplade till initiativet. Personal som lånats in från en annan sektion markeras med sin hemsektion.
2. **Månader (12 kolumner):** Januari till December.
3. **Totalt timmar per person:** Summan av alla inmatade timmar för personen under året i detta initiativ.
4. **Totalt kostnad per person:** $(\text{Totalt timmar}) \times (\text{Personens timkostnad})$.


* **Rader (Datafält):**
* Varje rad representerar en kopplad person.
* I månadskolumnerna kan användaren mata in/ändra planerat antal timmar för personen den månaden.


* **Summeringsrad (Längst ned i varje initiativtabell):**
* Summa timmar per månad för hela initiativet.
* **Totalsumma timmar:** Totala timmar för alla personer under hela året på initiativet.
* **Totalsumma kostnad:** Total finansiell kostnad för hela initiativet ($SEK$).

### 4.3 Vyn Utfall

* Samma tabellayout som estimatvyn, men månadscellerna gäller utfall och kolumnen "Totalt h" heter "Utfall h".
* En tom cell betyder "utfall ej rapporterat" och visar estimatet som grå ledtext. En inskriven 0 betyder rapporterade 0 timmar. Raderas värdet blir cellen åter "ej rapporterad".
* Knappen **Fyll från estimat** per person fyller i utfall = estimat för avslutade månader (t.o.m. föregående månad) som saknar utfall. Redan rapporterat utfall ändras inte. Knappen visas bara när det finns något att fylla.
* Tabellhuvudet visar utfall (h) och utfallskostnad för året. För initiativ med budget visas **Utfall** (utfallskostnad) och **Prognos** (estimerad kostnad) i procent av budgeten (alla år), med en stapel där utfallet är heldraget och prognosen ljusare bakom. Prognos över 100 % visas i röd text. **Prognosen ändras inte när utfall matas in, rättas eller tas bort** – endast utfallsprocenten gör det.
* **Färg på utfallet:** Utfallsprocenten och dess del av stapeln (indikatorn) färgas efter utfallets egen andel av budgeten: **grön** när utfallet är 100 % eller mindre, **röd** när det är 101 % eller mer. Gränsen avser den visade, till hela procent avrundade siffran (100,4 % visas som "100 %" och är grön; 100,6 % visas som "101 %" och är röd). Färgen påverkas inte av prognosen. Samma regel gäller budgetrutan i vyn Jämförelse.
* Överallokering (röd text) beräknas på utfall.

### 4.4 Vyn Jämförelse

* Skrivskyddad analysvy.
* Varje månadscell visar utfallet och under det avvikelsen mot estimatet med ▲ (mer tid än planerat) eller ▼ (mindre tid). Månader utan rapporterat utfall visas som "–". Avvikelser markeras med symboler och neutral färg (▲ orange, ▼ blå). Röd färg är reserverad för överallokering.
* Kolumnerna till höger: **Estimat h** (helår), **Utfall h** och **Avvikelse** (timmar och procent). Avvikelsen räknas endast på månader med rapporterat utfall.
* Ett klick på pilen vid en person fäller ut en extra rad med estimatet per månad.
* Tabellhuvudet visar för valt år, i ordning: **Avvikelse** (timmar), **Utfallskostnad** (initiativets totala kostnad för rapporterad tid, dvs. summan av alla personers rapporterade timmar × respektive persons timkostnad) och **Prognos** (estimerad kostnad). För initiativ med budget visas därefter budgetens utfall och prognos som i 4.3.
* Nyckeltal visar, i ordning: antal initiativ, totalt estimat (h) och totalt utfall (h) för året bredvid varandra, avvikelse, **Prognos kostnad** (estimerad kostnad) och till höger om den **Utfallskostnad** (faktisk total kostnad: rapporterade timmar × respektive persons timkostnad). Nyckeltalen avser de initiativ som visas, dvs. följer års-, sektions- och produktägarfiltret. Kapacitetsöversikten visar estimatet.

### 4.5 Nyckeltal och kapacitetsöversikt per vy

| Vy | Nyckeltal | Kapacitetsöversikt |
|---|---|---|
| Estimat | Initiativ, planerade timmar, planerad kostnad, överallokerade personmånader | Planerad tid |
| Utfall | Initiativ, utfall (h), utfallskostnad, överallokerade personmånader (utfall) | Rapporterat utfall |
| Jämförelse | Initiativ, estimat (h), utfall (h), avvikelse mot estimat (h och %), prognos kostnad (= estimerad kostnad), utfallskostnad (faktisk kostnad) | Estimat |



---

## 5. Affärslogik & Valideringsregler

1. **Ekonomiberäkning:**
* Kostnad per person & månad = $\text{Timmar} \times \text{Timkostnad}$.
* Totalkostnad för initiativ = Summan av alla personers kostnader för initiativet.
* **Prognos** = estimerad kostnad = summan av estimerade timmar × respektive persons timkostnad, dvs. den beror på vilken personal som arbetar med initiativet och hur många timmar de planeras lägga. Prognosen beror **enbart** på estimatet och påverkas aldrig av utfall.
* Prognos av budget (%) = (Estimerad kostnad för initiativets **alla år**) / Budget × 100.
* Utfall av budget (%) = (Utfallskostnad för initiativets **alla år**) / Budget × 100.
* Utfallskostnad = Utfall (timmar) × Timkostnad. Timkostnaden är alltid den aktuella; ändras den räknas även historiskt utfall om.
* **Avvikelse** = Utfall − Estimat, beräknat endast på månader med rapporterat utfall. Avvikelse i procent = Avvikelse / Estimat (för samma månader) × 100.


2. **Indikering vid Överallokering (Kapacitetskontroll):**
* Systemet ska beräkna en persons **totala allokering i alla initiativ sammanlagt** per månad, oavsett vilken sektion initiativen tillhör.
* Beräkningen görs på utfall i utfallsvyn och på estimat i övriga vyer.
* Om en persons totala arbetstid för en specifik månad överskrider personens inställda *normala arbetstid* (t.ex. >160 timmar), ska detta indikeras visuellt med **röd färg** i gränssnittet där personen förekommer.
* Markeringen görs med **röd text**: personens namn samt timsiffran för den överallokerade månaden visas i rött. Cellerna ska **inte** få röd bakgrundsfärg.


3. **Kopplingskrav:**
* Personal och produktägare måste alltid tillhöra exakt 1 sektion.
* Ett initiativ måste alltid ha exakt 1 produktägare, och tillhör alltid produktägarens sektion.
* Det ska gå att ta bort personal från ett initiativ i adminläget tills det inte finns någon personal kvar (eller tills initiativet tas bort).



---

## 6. Övrigt

* **Gränssnitt (UI):** Enkelt, funktionellt, reaktivt UI så att summo- och kostnadsberäkningar uppdateras direkt vid inmatning utan att sidan laddas om.
* **Tillstånd & Lagring:** Enkel och direkt lagring, någon form av localstorage. Applikationen kommer att hantera en liten datamängd och skall ej ha någon databas eller backend. Informationen som matas in i applikationen måste lagras persistent.
* **Bakåtkompatibilitet:** Data från tidigare versioner utan sektioner (sparad data eller importerad fil) flyttas automatiskt in i en sektion med namnet "Standardsektion", som sedan kan döpas om. Data utan utfall läses in med tomt utfall, och initiativ utan tajmaklass får tomt värde.
* **Säkerhet** Ingen inloggning eller autentisering. Alla som har länken ska kunna utnyttja alla features.
