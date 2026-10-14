# CLT REFRESH – web s časovou osou a odškrtáváním

Web ukazuje harmonogram 2.–5. 11. 2026 a seznamy: stav úkolů, nákup, přístroje, otevřené body.
Data bere živě z Google tabulky. Odškrtnutí na webu se zapíše zpátky do tabulky.

## Jak to funguje

| Kdo | Co dostane | Co může |
|---|---|---|
| Ty a správci | Přístup k Google tabulce | Měnit všechno v tabulce |
| Člen týmu | Osobní odkaz `…/#k=KÓD` | Odškrtávat stav na webu. Zůstane přihlášený. |
| Divák | Adresu webu bez kódu | Jen se dívat |

- Web smí měnit **jen sloupce stavu**: Úkoly → Stav, Nákup → Koupeno, Přístroje → Zkontrolováno / Naloženo / Na místě / Vráceno, Otevřené body → Stav.
- Každá změna z webu se zapíše do listu **Log**: čas, kdo, co, nová hodnota.
- Bez signálu web ukáže poslední stažený stav. Odškrtávat jde jen se signálem.

## První nastavení (celkem asi 40 minut)

### 1. Google tabulka (5 min)
1. Nahraj `CLT_REFRESH_harmonogram.xlsx` na Google Disk.
2. Otevři ho a dej **Soubor → Uložit jako tabulku Google**.
3. Dál pracuj jen v té Google tabulce. Sdílej ji jen se správci.

### 2. Apps Script (10 min)
1. V tabulce **Rozšíření → Apps Script**.
2. Smaž obsah `Code.gs` a vlož obsah souboru `apps-script/Code.gs`. Ulož (Ctrl+S).
3. **Nasadit → Nové nasazení**. Typ: **Webová aplikace**.
4. Spustit jako: **Já**. Kdo má přístup: **Kdokoli**. **Nasadit**.
5. Google se zeptá na oprávnění. Povol je. Varování „aplikace není ověřená“ → Rozšířené → Přejít na projekt.
6. Zkopíruj **URL webové aplikace** (končí `/exec`).

### 3. GitHub (10 min)
1. github.com → **New repository** → název např. `clt-refresh` → **Public** → Create.
2. **uploading an existing file** → přetáhni `index.html`, `config.js`, `sw.js`, `README.md` a složku `apps-script`. **Commit changes**.
3. Otevři `config.js` → tužka (Edit) → mezi uvozovky u `api:` vlož URL z kroku 2.6 → **Commit changes**.
4. **Settings → Pages → Build and deployment → Source: Deploy from a branch → main / (root) → Save**.
5. Za 1–2 minuty běží web na `https://<tvoje-jméno>.github.io/clt-refresh/`.

### 4. Osobní odkazy (10 min)
1. V Google tabulce obnov stránku (F5). Nahoře přibude menu **CLT REFRESH**.
2. **CLT REFRESH → Vytvořit přístupové kódy**. Vznikne list **Přístup**.
3. Do buňky **B1** listu Přístup vlož adresu webu z kroku 3.5.
4. Ve sloupci **E** jsou osobní odkazy. Pošli každému jen ten jeho (SMS, WhatsApp, e-mail).
5. Divácký odkaz = adresa webu bez `#k=…`.

### 5. Kontrola (5 min)
1. Otevři svůj osobní odkaz. Nahoře musí být „Odškrtáváš jako …“.
2. Odškrtni jednu věc. V tabulce se změní hodnota a v listu Log přibude řádek.
3. Vrať to zpátky.

## Běžný provoz

- **Změna dat:** uprav Google tabulku. Web to ukáže do minuty. GitHub se nemění.
- **Nový člověk:** přidej ho do tabulky Lidé na listu Přehled → menu **Vytvořit přístupové kódy** → pošli odkaz.
- **Ztracený nebo přeposlaný odkaz:** list Přístup → klikni do řádku → menu **Nový kód pro vybraný řádek** → pošli nový odkaz. Nebo dej Aktivní = `ne`.
- **Změna kódu skriptu:** Nasadit → Spravovat nasazení → tužka → Verze: Nová → Nasadit. URL zůstane stejná.

## Co nepřejmenovávat

- Listy: **Úkoly, Přehled, Nákup, Přístroje, Otevřené body, Přístup, Log**.
- Hlavičky sloupců v těchto listech (podle nich skript hledá data).
- Na listu Přehled buňku „Ve sloupci Kdo“ nad tabulkou Lidé.
- Nový úkol = nový řádek v listu Úkoly. ID musí být jedinečné.

## Veřejnost

- Web i jeho data vidí každý, kdo zná adresu. Vyhledávače ho neindexují.
- Na GitHubu je jen stránka. Ceny a inventární čísla přístrojů na web nejdou.
- Kódy jsou jen v Google tabulce.

## Soubory

| Soubor | Co dělá |
|---|---|
| `index.html` | Celý web. Obsahuje i záložní snímek dat pro první otevření bez signálu. |
| `config.js` | Adresa Apps Scriptu. Jediné, co na GitHubu vyplňuješ. |
| `sw.js` | Offline režim. |
| `apps-script/Code.gs` | Kód pro Google tabulku (čtení, zápis stavu, kódy, log). |
