# Deferred Fixes And Technical Notes

Този файл събира установените проблеми и технически рискове, които да бъдат разгледани след довършването на Task 06.

## Стартиране на проекта локално

Приложението се намира в подпапката `prd`.

```powershell
cd C:\Users\rstoy\Application-for-automated-marketing-reports-v2\prd
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

След стартиране приложението е достъпно на:

```text
http://localhost:3000
```

Конфигурацията на средата е описана в `prd/.env.example`. За базова локална работа са нужни:

```env
NEXTAUTH_SECRET=<случайна-дълга-стойност>
NEXTAUTH_URL=http://localhost:3000
DATABASE_URL="file:./dev.db"
```

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `META_APP_ID` и `META_APP_SECRET` са нужни, когато се тества реалният OAuth flow.

В текущото работно копие `node_modules` и `prisma/dev.db` вече съществуват, така че обичайното стартиране е:

```powershell
cd C:\Users\rstoy\Application-for-automated-marketing-reports-v2\prd
npm run dev
```

## Task 06: Незавършени или проблемни части

### Изпълнени

1. Записът на нови data sources при mock/sandbox сценарий вече не нарушава foreign key constraints.

   `ProjectSource.oauthConnectionId` е nullable, `ProjectClient.tsx` подава `null`, когато няма активна OAuth връзка, а `PATCH /api/projects/[id]` нормализира legacy стойност `"sandbox"` към `null` преди запис.

2. Google Ads report интеграцията е имплементирана на code level.

   Добавени са Google Ads API env настройки, `adwords` OAuth scope, GAQL заявки към `googleAds:searchStream`, KPI изчисления, дневен spend trend и campaigns table в preview-то. За окончателно приемане е нужна live проверка с валиден `GOOGLE_ADS_DEVELOPER_TOKEN`, достъп до Google Ads customer и повторно свързан Google OAuth акаунт.

3. Primary Conversion вече е част от project source конфигурацията.

   `ProjectSource.primaryConversion` съществува в Prisma модела, управлява се в `ProjectClient` state, записва се през `PATCH /api/projects/[id]`, зарежда се обратно при отваряне на проекта и се подава към GA4, Google Ads и Meta Ads data заявките. При смяна на акаунт conversion стойността се изчиства, за да не остане избор от стар акаунт.

4. Preview вече работи като snapshot.

   При `Generate Preview` се създава `previewSnapshot`, който фиксира заглавие, тема, лого, периоди, sources и notes. Preview и PDF export рендерират от snapshot-а, а промени след това маркират preview-то като outdated и блокират download, докато не се генерира нов преглед.

5. PDF export вече е директно генериране на PDF, не browser print.

   `Download PDF` използва `html2canvas` + `jsPDF`, пази файл с име от PDF title, работи само с актуален preview snapshot и има допълнителни `break-inside/page-break-inside` правила за report секции, KPI grid-ове, панели, таблици, графики и съобщения.

6. Редът на report секциите е правилен.

   `REPORT_SECTION_DEFINITIONS` задава ред `GSC -> Google Ads -> Meta Ads -> GA4`; навигацията използва тази дефиниция, preview прилага CSS `order`, а PDF export сортира секциите по `data-pdf-order`.

7. Периодът не се показва като отделен елемент на корицата.

   Датите се рендерират само чрез `SectionPeriod` вътре във всяка report секция. Cover/header частта показва PDF title, logo placeholder/logo и brand label, без автоматично добавен reporting/comparison period.

8. Графиките вече следват избраната report тема.

   Chart компонентите получават `reportTheme.primary`, вместо фиксиран `REPORT_CHART_COLOR`. Lead Group използва зеления акцент, а Vectory използва синия акцент и в графиките.

9. Секции без данни вече не се показват като празни report секции.

   Preview/PDF рендерира source секция само когато тя зарежда, има API/config грешка за диагностика или има реални данни. Enabled source без върнати данни вече не добавя празна клиентска секция с `Няма налични данни...`.

10. Report history е имплементиран с database-backed PDF storage.

   При успешно client-side PDF download се създава `GeneratedReport` запис с име на файла, потребител, дата и PDF data URL. Project page зарежда последните отчети и показва панел `История на отчети`. Повторното сваляне минава през защитен endpoint, който проверява ownership.

### Критични

Няма останали критични Task 06 точки във fix списъка.

### Несъответствия със спецификацията

Няма останали code-level несъответствия със спецификацията във fix списъка. Остават live/manual проверки и отложената report history функционалност.

## Task 07: Google Ads live валидация

Google Ads вече има backend заявки и preview rendering, но не може да бъде приет като live-валидирана интеграция без реални Google Ads API credentials и акаунт с кампании.

Необходимо за live проверка:

1. Да се получи Google Ads API `Developer Token` от Google Ads Manager Account (MCC) с достъп до реални акаунти, ако ще се тестват production кампании.

2. В Google OAuth flow вече е добавен Ads scope:

```text
https://www.googleapis.com/auth/adwords
```

3. В `.env.local` да се добавят стойности, без да се записват в Git:

```env
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_LOGIN_CUSTOMER_ID=
GOOGLE_ADS_API_VERSION=v22
```

`GOOGLE_ADS_LOGIN_CUSTOMER_ID` е нужен, когато клиентският Ads акаунт се достъпва през manager акаунт.

4. Имплементирани са заявки към Google Ads API за:

- Spend, Clicks, Impressions, CPC, Conversions, CPA и ROAS.
- Дневен тренд за избрания период и периода за сравнение.
- Таблица с кампании, сортирана по разход.
- Прилагане на избраната `Primary Conversion`.

5. Да се валидира ръчно спрямо `verify/task-07-verify.md` с реален Google Ads акаунт.

## Task 08: Оставащи проверки и зависимости

Task 08 е имплементиран за секциите, които вече връщат данни, но не може да бъде приет напълно спрямо `verify/task-08-verify.md`, докато не бъдат проверени следните точки:

1. Последователността `GSC -> Google Ads -> Meta Ads -> GA4` е покрита на code level, но трябва да се види ръчно с реално активни секции.

2. Необходима е ръчна визуална проверка на preview-то и сваления PDF за:

- Показване на PDF Title и логото без дати в хедъра.
- Показване на периода под заглавието на всяка налична секция.
- Рендериране на `Обобщение` само при въведен текст и липса на празно `Заключение`.
- Смяна на цветовите акценти между темите.
- Максимално съвпадение между browser preview и генерирания PDF.

3. Да се провери оформлението с лога с различни пропорции, за да не се нарушава подравняването в хедъра.

4. Да се провери поведение при дълги коментари, включително дали page break-овете не разделят неподходящо заглавия, графики или таблици.

## Report History: Future Storage Improvements

Историята на отчети вече пази PDF файловете в базата като MVP storage слой. За по-големи production файлове може да се добави object storage:

1. Object storage за production.

2. Запис на реален external `fileUrl`/`filePath` в `GeneratedReport`.

3. Streaming download от storage вместо връщане на PDF от database text field.

4. Решение за retention/почистване на стари PDF файлове.

## Build И Tooling Блокери

1. `npm run build` вече минава успешно.

   Проверено след ревизията. Старият Next 15 route signature blocker вече не е активен.

2. `npm run lint` вече минава успешно.

   Остават само warning-и за два `<img>` елемента в `ProjectClient.tsx`; това не блокира build/lint, но може да се подобри с `next/image`.

3. Преминали проверки към момента:

```powershell
npm run build
npm run lint
npx tsc --noEmit
npx prisma validate
```

## По-широки рискове за Task 07-16

1. OAuth токените вече минават през encryption helper.

   `encryptSecret/decryptSecret` използват AES-256-GCM с `TOKEN_ENCRYPTION_KEY`, `NEXTAUTH_SECRET` или `AUTH_SECRET`. Legacy plain tokens се мигрират към encrypted формат при употреба.

2. OAuth `state` вече е подписан и има срок на валидност.

   `createOAuthState/parseOAuthState` използват HMAC signature и 15-минутен expiry.

3. Meta report data заявките вече подават токена през `Authorization: Bearer ...`.

   OAuth token exchange flow-ът към Meta все още използва query params, което е нормално за този endpoint, но live OAuth flow трябва да се провери ръчно.

4. За големи production обеми ще е нужен object storage вместо database-backed PDF storage.

## Текущо работно състояние

При създаването на този документ в working tree има неприключени промени, свързани с Task 06 и OAuth/API файлове. Те не са променяни като част от този запис:

- `prd/prisma/dev.db`
- `prd/src/app/(protected)/projects/[id]/page.tsx`
- `prd/src/app/(protected)/projects/[id]/ProjectClient.tsx` (нов файл)
- `prd/src/app/api/oauth/[provider]/connect/route.ts`
- `prd/src/app/api/oauth/[provider]/disconnect/route.ts`
- `prd/src/app/api/projects/[id]/route.ts`
- `prd/src/app/globals.css`
