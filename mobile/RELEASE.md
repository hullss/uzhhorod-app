# Підготовка release-збірки

Цей файл готує профілі EAS для внутрішнього APK (`preview`) та production Android App Bundle (`production`). Підписаний AAB / IPA не можна чесно зібрати без облікових даних видавця та ключів підпису.

## Один раз перед першою збіркою

1. Встановіть Node.js LTS і увійдіть у власний Expo/EAS акаунт: `npx eas-cli@latest login`.
2. У папці `mobile` виконайте `npx expo install expo-secure-store`. Це обов'язково: модуль зберігає токен акаунта у Keychain на iOS та Android Keystore. Не замінюйте його на AsyncStorage або localStorage.
3. Вкажіть у `app.json` належні видавцеві унікальні ідентифікатори `ios.bundleIdentifier` та `android.package`. Не використовуйте назву міської ради, якщо вона письмово не погоджена.
4. Опублікуйте `LEGAL/PRIVACY_POLICY_UK.md` і `LEGAL/TERMS_OF_USE_UK.md` за постійними HTTPS URL, заповнивши назву видавця, контакт для приватності й дату. Ці URL потрібні для App Store та Google Play.
5. Розгорніть API тільки за HTTPS, задайте production `EXPO_PUBLIC_API_URL` та перевірте резервне копіювання PostgreSQL.

## Локальна перевірка

```powershell
cd mobile
npm install
npm run typecheck
npm run check:contrast
npx expo-doctor
```

## Збірки

```powershell
# Внутрішній Android APK для тестування
npx eas-cli@latest build --profile preview --platform android

# Android App Bundle для Google Play
npx eas-cli@latest build --profile production --platform android

# Production IPA для TestFlight / App Store
npx eas-cli@latest build --profile production --platform ios
```

## Перед завантаженням у магазини

- Протестуйте реальний телефон у світлій і темній темах, із великим шрифтом, VoiceOver/TalkBack та без мережі.
- Заповніть Apple App Privacy і Google Play Data Safety відповідно до фактичних даних, які збирає реліз.
- Перевірте видалення акаунта у застосунку та опублікуйте зовнішній шлях видалення, якщо магазин його вимагатиме.
- Для автоматичного відновлення пароля й верифікації пошти підключіть поштовий провайдер, домен відправника та HTTPS reset-сторінку. Не вмикайте фіктивне «відновлення», яке не надсилає листа.
