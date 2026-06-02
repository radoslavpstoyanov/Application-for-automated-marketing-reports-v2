# Render Deployment Plan

Този документ описва стъпките за пускане на приложението в Render.

## 1. Какво пускаме първо

Първият production вариант може да бъде пуснат без напълно готов Google Ads достъп.

Включено:

- Регистрация и вход.
- Управление на проекти.
- Google Analytics 4.
- Google Search Console.
- Meta Ads, ако Meta app достъпът е настроен.
- Preview на отчет.
- Download PDF.
- Report history с повторно сваляне на PDF.

Отложено:

- Google Ads live интеграция, докато няма валиден Developer Token и реален Ads достъп.
- Object storage за много големи PDF файлове. Първият deploy пази PDF файловете в базата като MVP storage слой.

## 2. Подготви production база

Текущо локално проектът използва SQLite. За Render production трябва PostgreSQL.

В Render:

1. Отвори Render dashboard.
2. Избери `New`.
3. Избери `PostgreSQL`.
4. Създай база, например:

```text
marketing-reports-db
```

5. След създаване копирай `External Database URL` или `Internal Database URL`.

External Database URL - postgresql://marketing_reports_db_user:KrQrMh14RiOGr5Nux9Sl5RJwFrTGvza8@dpg-d8fftf58nd3s73fp957g-a.oregon-postgres.render.com/marketing_reports_db

За Render web service обикновено използвай `Internal Database URL`, ако web service-ът е в същия Render account/region.

Тази стойност ще бъде `DATABASE_URL`.

## 3. Prisma промяна за PostgreSQL

Преди production deploy трябва Prisma datasource в `prd/prisma/schema.prisma` да се смени от:

```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}
```

към:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

След това трябва да се създаде production migration за PostgreSQL.

Локална проверка:

```powershell
cd C:\Users\rstoy\Application-for-automated-marketing-reports-v2\prd
npx prisma generate
npx prisma validate
npm run build
```

## 4. Създай Render Web Service

В Render:

1. Избери `New`.
2. Избери `Web Service`.
3. Свържи GitHub repo-то.
4. Настройки:

```text
Root Directory: prd
Environment: Node
```

Build command:

```bash
npm install && npx prisma generate && npx prisma migrate deploy && npm run build
```

Start command:

```bash
npm run start
```

## 5. Environment variables в Render

В Render Web Service отвори `Environment` и добави:

```env
NEXTAUTH_URL=https://your-render-domain.onrender.com
NEXTAUTH_SECRET=replace-with-long-random-secret
TOKEN_ENCRYPTION_KEY=replace-with-another-long-random-secret

DATABASE_URL=postgresql-render-url
```

Google:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Meta:

```env
META_APP_ID=
META_APP_SECRET=
```

Google Ads може временно да остане празно:

```env
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_LOGIN_CUSTOMER_ID=
GOOGLE_ADS_API_VERSION=v22
```

Важно:

- `NEXTAUTH_SECRET` трябва да е дълга случайна стойност.
- `TOKEN_ENCRYPTION_KEY` трябва да е дълга случайна стойност и да не се сменя след production старт.
- Ако `TOKEN_ENCRYPTION_KEY` се смени, старите OAuth tokens може да не могат да се декриптират.

## 6. Google OAuth настройки

След като Render даде production domain, например:

```text
https://marketing-reports.onrender.com
```

в Google Cloud Console добави authorized redirect URI:

```text
https://marketing-reports.onrender.com/api/oauth/google/callback
```

Провери дали са активирани нужните APIs:

- Google Analytics Admin API.
- Google Analytics Data API.
- Google Search Console API.
- Google Ads API, когато стигнем до Ads.

За първия deploy Google Ads може да остане непроверен.

## 7. Meta OAuth настройки

В Meta Developers app settings добави Valid OAuth Redirect URI:

```text
https://marketing-reports.onrender.com/api/oauth/meta/callback
```

Провери дали app-ът има нужните permissions:

```text
ads_read
ads_management
business_management
```

Важно:

- Ако Meta app-ът е в development mode, само admins/developers/testers могат да се логват.
- За външни production потребители може да трябва App Review/Advanced Access.

## 8. Първи deploy

В Render натисни `Deploy`.

Гледай build logs.

Очаква се да минат:

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
```

Ако build падне:

1. Провери `DATABASE_URL`.
2. Провери Prisma provider дали е `postgresql`.
3. Провери дали migrations са налични.
4. Провери дали всички env variables са добавени.

## 9. Smoke test след deploy

След успешен deploy отвори production URL.

Провери:

1. Register new user.
2. Login.
3. Dashboard се отваря.
4. Create project.
5. Save project.
6. Open project.
7. Избери тема.
8. Избери reporting period.
9. Включи или изключи comparison checkbox.
10. Добави notes.
11. Generate preview.
12. Download PDF.
13. Провери дали `История на отчети` записва нов ред.
14. Натисни `Свали отново` от history и провери дали PDF файлът се сваля.

## 10. Google интеграция test

В production:

1. Отвори `/integrations`.
2. Натисни `СВЪРЖИ GOOGLE`.
3. Разреши достъп.
4. След callback трябва да видиш:

- GA4 properties.
- Search Console sites.

Ако Google Ads още не е настроен, може да има warning за Ads. Това е приемливо за първия deploy.

## 11. Meta интеграция test

В production:

1. Отвори `/integrations`.
2. Натисни `СВЪРЖИ META`.
3. Разреши достъп.
4. След callback трябва да видиш Meta ad accounts.

Ако не виждаш акаунти:

- Провери дали Meta user-ът е admin/developer/tester в app-а.
- Провери дали user-ът има достъп до ad account.
- Провери дали redirect URI е точен.
- Провери дали app permissions са налични.

## 12. Google Ads по-късно

За Google Ads ще трябват:

```env
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_LOGIN_CUSTOMER_ID=
GOOGLE_ADS_API_VERSION=v22
```

Стъпки:

1. Взима се Developer Token от Google Ads Manager Account.
2. Уточнява се дали клиентските accounts са под MCC/Manager account.
3. Ако има MCC, `GOOGLE_ADS_LOGIN_CUSTOMER_ID` е manager customer ID без тирета.
4. Google акаунтът се reconnect-ва от `/integrations`, защото трябва `adwords` scope.
5. В `/integrations` трябва да се покажат Google Ads accounts.
6. В project settings Google Ads account трябва да се избира от dropdown.

## 13. Report History Storage

Първият production вариант използва database-backed storage:

- PDF файлът се записва в `GeneratedReport.fileUrl` като PDF data URL.
- Клиентът не получава raw PDF data URL.
- Повторното сваляне минава през защитен endpoint:

```text
/api/projects/[id]/reports/[reportId]/download
```

Този endpoint проверява дали текущият user притежава проекта и отчета.

Това е достатъчно за MVP и Render без persistent disk.

За по-големи production обеми може по-късно да се мине към S3/R2/Render disk storage.

## 14. Какво остава след първото пускане

След първия production deploy остават:

1. Google Ads live validation.
2. Object storage за report history, ако PDF файловете станат големи или много на брой.
3. Смяна на `<img>` към `next/image`, ако искаме да махнем lint warning-ите.
4. Production Meta App Review, ако приложението ще се ползва от външни клиенти.
