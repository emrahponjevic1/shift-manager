# Šeherezada Shift Pro — Moderna Web Aplikacija sa SQLite Bazom

Kompletno redizajnirana, full-stack web aplikacija za planiranje i vođenje smjena i rasporeda radnika. Više ne ovisi o Google Sites-u ili localStorage-u, već koristi trajnu relacijsku **SQLite bazu podataka** (`shiftmanager.db`) i moderan, responzivan korisnički interfejs.

---

## 🌐 Lokalni Pristup

Aplikacija je aktivna i dostupna na:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🚀 Ključne Karakteristike & Redizajn

1. **Prava SQLite Baza Podataka (`shiftmanager.db`)**:
   - Podaci više nisu hardkodirani u skripti niti vezani za pretraživač.
   - Svi radnici, lokali, sedmice, smjene i bolovanja trajno se spremaju u bazu u realnom vremenu preko REST API-ja (`/api/...`).
   - Podržan kompletan izvoz i uvoz baze u JSON formatu (`/api/backup/export` i `/api/backup/import`).

2. **Interaktivni Satni Planer (Timeline)**:
   - Vizuelni satni prikaz (06:00 - 03:00) za svaki dan u sedmici.
   - Povlačenje i podešavanje dužine smjena mišem (drag & resize).
   - Indikator pokrivenosti po satima s automatskim upozorenjem ako je broj radnika manji od propisanog minimuma (`minWorkers`).
   - Brzo dodjeljivanje radnika u smjenu jednim klikom iz bočnog panela.

3. **Tjedna Mreža (Weekly Grid)**:
   - Matrični tabelarni prikaz lokala po danima sa značkama smjena.
   - Klik na ćeliju za brzo dodavanje radnika.
   - Prikaz odsutnih radnika i bolovanja na dnu tabele.

4. **Upravljanje Radnicima (Staff Directory)**:
   - Dodavanje, uređivanje i brisanje radnika.
   - Postavljanje ugovorene norme (npr. 8h, 10h), primarnog lokala i uloge.
   - Automatski izračun ukupno zakazanih sati u sedmici s indikatorom norme / prekovremenih sati.

5. **Upravljanje Lokalima (Locations)**:
   - Definisanje radnog vremena (otvaranje i zatvaranje).
   - Pravilo minimalnog broja radnika po satu.
   - Prilagođene teme boja (Plava, Zelena, Ljubičasta, Zlatna, Koraljna).

6. **Evidencija Odsustva & Krizni Menadžment (Bolovanja)**:
   - Jednostavna prijava slobodnih dana ili bolovanja s rasponom datuma.
   - Automatsko arhiviranje smjena radnika koji ode na bolovanje i mogućnost vraćanja jednim klikom ("Prekini bolovanje").

7. **Štampanje, PDF Izvoz & WhatsApp Dijeljenje**:
   - Optimizovani bijeli list za printanje (A4 landscape) ili spremanje u PDF (`window.print()`).
   - Dugme **"Kopiraj za WhatsApp"** koje automatski formatira čitav raspored sa emoji simbolima i vremenima, spremno za slanje u radničku WhatsApp/Viber grupu.

---

## 🛠️ Pokretanje Aplikacije

- **Pokretanje servera (produkcija):**
  ```bash
  npm start
  ```
  Otvori pretraživač na `http://localhost:3000`.

- **Razvojni način rada (Vite + nodemon/hot reload):**
  ```bash
  npm run dev
  ```

