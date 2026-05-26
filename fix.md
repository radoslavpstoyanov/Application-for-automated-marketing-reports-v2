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

### Критични

1. Записът на нови data sources е невалиден при mock/sandbox сценарий.

   `ProjectClient.tsx` създава нови source записи с `oauthConnectionId: "sandbox"`, но `ProjectSource.oauthConnectionId` е задължителен foreign key към реален `OAuthConnection`. Save ще се провали при опит за запис на такъв източник.

2. Google Ads няма реална report интеграция.

   UI конфигурацията за `google_ads` е добавена, но preview-то още не извлича реални Ads KPI, трендове и кампании.

3. Primary Conversion не е част от данните.

   В UI има dropdown-и за GA4 и Meta Ads, но изборът не се държи в state, не се записва през API и няма поле в модела. Не може да се изпълни изискването за валидиране и персистиране на конверсия.

4. Preview не е snapshot.

   След `Generate Preview` отчетът продължава да рендерира от текущия edit state. Всяка последваща промяна по бележки, тема или заглавие изменя preview-то без повторно генериране.

5. PDF export е само browser print.

   `Download PDF` изпълнява `window.print()`. Липсват контролирано генериране на PDF, коректно име на файл, актуалност спрямо последното preview и стабилни page break правила.

### Несъответствия със спецификацията

1. Редът на report секциите е грешен.

   Текущо: `GSC -> GA4 -> Meta Ads`.

   Изисквано: `GSC -> Google Ads -> Meta Ads -> GA4`.

2. Периодът се показва в горната част/корицата на preview-то.

   Task 08 и Task 09 изискват датите да не се добавят автоматично на корицата.

3. Темите не следват брандовите материали.

   Текущият mapping използва син акцент за Lead Group и тюркоазен за Vectory. Брандовите assets и Task 12 задават зелена идентичност за Lead Group и синя за Vectory.

4. Отварянето на проект променя `updatedAt`.

   Project page обновява `updatedAt` при посещение, което прави Dashboard сортирането и надписа за последна промяна неточни. Полето трябва да се актуализира при реален Save/конфигурационна промяна.

## Task 07: Отложена Google Ads интеграция

Google Ads не може да бъде приет като завършен за Task 07, докато не се добави реалното извличане на данни. В момента секцията приема `Customer ID` и `Primary Conversion`, но при preview връща съобщение за липсваща Google Ads API конфигурация.

Необходимо за продължаване:

1. Да се получи Google Ads API `Developer Token` от Google Ads Manager Account (MCC) с достъп до реални акаунти, ако ще се тестват production кампании.

2. В Google OAuth flow да се добави Ads scope:

```text
https://www.googleapis.com/auth/adwords
```

3. В `.env.local` да се добавят стойности, без да се записват в Git:

```env
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_LOGIN_CUSTOMER_ID=
```

`GOOGLE_ADS_LOGIN_CUSTOMER_ID` е нужен, когато клиентският Ads акаунт се достъпва през manager акаунт.

4. Да се имплементират заявки към Google Ads API за:

- Spend, Clicks, Impressions, CPC, Conversions, CPA и ROAS.
- Дневен тренд за избрания период и периода за сравнение.
- Таблица с кампании, сортирана по разход.
- Прилагане на избраната `Primary Conversion`.

5. Да се валидира ръчно спрямо `verify/task-07-verify.md` с реален Google Ads акаунт.

## Task 08: Оставащи проверки и зависимости

Task 08 е имплементиран за секциите, които вече връщат данни, но не може да бъде приет напълно спрямо `verify/task-08-verify.md`, докато не бъдат проверени следните точки:

1. Последователността `GSC -> Google Ads -> Meta Ads -> GA4` не може да се потвърди с всички секции, докато Google Ads няма реална data интеграция от Task 07. Секция без данни правилно не трябва да попада в клиентския отчет.

2. Необходима е ръчна визуална проверка на preview-то и сваления PDF за:

- Показване на PDF Title и логото без дати в хедъра.
- Показване на периода под заглавието на всяка налична секция.
- Рендериране на `Обобщение` само при въведен текст и липса на празно `Заключение`.
- Смяна на цветовите акценти между темите.
- Максимално съвпадение между browser preview и генерирания PDF.

3. Да се провери оформлението с лога с различни пропорции, за да не се нарушава подравняването в хедъра.

4. Да се провери поведение при дълги коментари, включително дали page break-овете не разделят неподходящо заглавия, графики или таблици.

## Build И Tooling Блокери

1. `npm run build` пада заради Next 15 route signature:

   `prd/src/app/api/oauth/[provider]/test/route.ts` използва синхронен `params`, докато динамичните route handlers в тази версия очакват `Promise<{ provider: string }>`.

2. `npm run lint` пада преди проверка на кода:

   ESLint/Next конфигурацията подава вече невалидни опции (`useEslintrc`, `extensions` и др.). Необходимо е уеднаквяване на ESLint конфигурацията и използваната команда/версия.

3. Преминали проверки към момента:

```powershell
npx tsc --noEmit
npx prisma validate
```

## По-широки рискове за Task 07-16

1. OAuth токените се пазят в SQLite като plain text, без encryption-at-rest.

2. OAuth `state` се изгражда като base64 кодиран user id, без подпис или server-side nonce/валидация.

3. Meta access token се изпраща в query string към Graph API; по-добре е да се подава чрез authorization header, когато API поведението го позволява.

4. Нужен е общ модел/слой за report configuration и metrics преди реалната имплементация на preview, PDF и data fetching.

## Текущо работно състояние

При създаването на този документ в working tree има неприключени промени, свързани с Task 06 и OAuth/API файлове. Те не са променяни като част от този запис:

- `prd/prisma/dev.db`
- `prd/src/app/(protected)/projects/[id]/page.tsx`
- `prd/src/app/(protected)/projects/[id]/ProjectClient.tsx` (нов файл)
- `prd/src/app/api/oauth/[provider]/connect/route.ts`
- `prd/src/app/api/oauth/[provider]/disconnect/route.ts`
- `prd/src/app/api/projects/[id]/route.ts`
- `prd/src/app/globals.css`
