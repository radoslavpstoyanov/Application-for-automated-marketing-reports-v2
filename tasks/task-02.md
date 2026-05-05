# Task 02: Core Data Model Implementation

## Цел
Дефиниране и имплементиране на основния модел на данните (схема на базата данни) за приложението според изискванията за MVP.

## Контекст
След като имаме базова автентикация (Task 01), приложението се нуждае от структура, в която да съхранява проектите, OAuth връзките, конфигурациите на източниците, бележките и отчетите. Тази схема е фундаментът за цялата следваща бизнес логика.

## Връзка с продукта
Моделът на данните директно поддържа ключовите функционалности от PRD: управление на проекти, съхранение на интеграции, динамични секции (управлявани през източниците) и ръчни коментари.

## Какво влиза в задачата
Създаване на таблици/колекции със следните полета и релации:
- **User**: `id`, `full_name`, `email`, `password_hash` (или auth provider), `created_at`, `updated_at`.
- **OAuthConnection**: `id`, `user_id`, `provider` ("google" или "meta"), `access_token`, `refresh_token`, `token_expires_at`, `connection_status`, `created_at`, `updated_at`.
- **Project**: `id`, `user_id`, `project_name`, `selected_theme`, `report_language`, `reporting_period_start`, `reporting_period_end`, `comparison_period_start`, `comparison_period_end`, `created_at`, `updated_at`, `pdf_title`, `client_logo_url`.
- **ProjectSource**: `id`, `project_id`, `source_type` ("gsc", "ga4", "google_ads", "meta_ads"), `oauth_connection_id`, `external_account_id`, `external_account_name`, `is_enabled`, `created_at`, `updated_at`. (Замества ProjectModule - активиран източник означава активирана секция в отчета).
- **ProjectNote**: `id`, `project_id`, `note_type` ("seo", "traffic", "google_ads", "meta_ads", "final"), `note_text`, `created_at`, `updated_at`.
- **GeneratedReport**: `id`, `project_id`, `generated_by_user_id`, `file_name`, `file_url`/`file_path`, `generated_at`.

Дефиниране на логическите връзки:
- Потребителят вижда само своите проекти и интеграции.
- Един проект принадлежи на един потребител; потребител може да има много проекти.
- Настройката на връзките (напр. Foreign Keys) между същностите.

## Какво не влиза в задачата
- Изграждане на потребителски интерфейс (UI) за управление на тези данни.
- Създаване на API endpoints за пълни CRUD операции (ще бъдат в следващи задачи).
- Реална интеграция с Google или Meta APIs.
- Екипни роли, споделени проекти или сложен workspace модел (не са част от MVP).

## Очакван резултат
Работеща схема на базата данни (миграции или ORM модели), която е приложена в средата за разработка и е готова за използване от бекенда.

## Критерии за приемане
- Всички посочени същности (entities) и полета са налични в базата данни.
- Връзките (foreign keys) правилно обвързват данните (напр. ProjectSource принадлежи на Project, Project принадлежи на User).
- Изтриване на проект премахва свързаните с него ProjectSource, ProjectNote и GeneratedReport записи (cascade delete или логика на ниво код), без да трие потребителя или OAuth връзките му.
- Могат да се създават тестови записи (seeds) без грешки в релациите.

## Рискове или неясноти
- Съобразяване на дължината на полетата за OAuth тоукъните (могат да бъдат много дълги).
- Съхранение на датите (timezone handling) за отчетните периоди.
