# Ужгород Цифровий

## Локальний запуск бекенду

Потрібні Docker Desktop і Java 21. Maven окремо не потрібен: перший запуск `mvnw.cmd` завантажить Maven Wrapper.

```powershell
docker-compose up -d
cd backend
.\mvnw.cmd test
.\mvnw.cmd spring-boot:run
```

PostgreSQL буде доступний на `localhost:5432` з базою `uzhhorod_digital` та обліковими даними `postgres` / `postgres`. Це відповідає локальним значенням у `backend/src/main/resources/application.yml`.

## Перевірка транспорту

У другому PowerShell-вікні:

```powershell
Invoke-RestMethod -Method Post http://localhost:8080/api/transport/imports/gtfs
Invoke-RestMethod http://localhost:8080/api/transport/routes
```

Перший запит завантажує статичні GTFS-дані Ужгорода й записує маршрути, зупинки, розклад і геометрію маршрутів у PostgreSQL. Далі бекенд оновлює дані щодня о 03:00 за Ужгородським часом, якщо він у цей момент запущений.

Статус останнього успішного імпорту:

```powershell
Invoke-RestMethod http://localhost:8080/api/transport/imports/latest
```

Для локальної розробки ручний імпорт не потребує токена. У розгорнутому застосунку встановіть змінну середовища `TRANSPORT_IMPORT_TOKEN`; тоді для ручного імпорту передавайте цей самий токен у заголовку `X-Transport-Import-Token`.

## Джерела транспортних даних

Маршрути, зупинки, розклад і геометрія маршрутів завантажуються з GTFS-джерела Ужгорода. Дані у застосунку мають містити посилання на першоджерело та ліцензію CC BY 4.0.

GPS-позиції автобусів не використовуються: офіційний міський GPS-ресурс тимчасово має обмежений доступ. Коли місто опублікує стабільний доступ, цю функцію можна підключити окремо.

## Мобільний клієнт

Відкрийте новий PowerShell у корені проєкту й виконайте:

```powershell
cd mobile
Remove-Item node_modules -Recurse -Force -ErrorAction SilentlyContinue
npm install
npm start
```

Expo покаже QR-код. Відскануйте його через Expo Go на телефоні або натисніть `a` для Android-емулятора.

За замовчуванням клієнт звертається до `http://10.0.2.2:8080`, що працює для Android-емулятора. Для фізичного телефона створіть файл `mobile/.env` на основі `mobile/.env.example` і замініть адресу на локальну IPv4-адресу вашого комп'ютера, наприклад `http://192.168.1.25:8080`.
