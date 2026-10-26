import { getLocale, translate } from "./src/i18n/locale";
import { PowerOutagesScreen } from "./src/components/PowerOutagesScreen";
import { newsDateLabel } from "./src/news/article";
import { Alert, Pressable, Text, TextInput, useLanguage } from "./src/i18n/ui";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { Asset } from "expo-asset";
import { Ionicons } from "@expo/vector-icons";
import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenSafeArea as SafeAreaView, useAnimatedBack, useScreenActive } from "./src/ui/Screen";
import { ScreenStack } from "./src/ui/ScreenStack";
import { navigationPath, type NavigationFrame } from "./src/ui/navigation";
import { AppThemeContext } from "./src/ui/theme";
import { AddressesScreen } from "./src/components/AddressesScreen";
import { ProfileOverviewScreen } from "./src/components/ProfileOverviewScreen";
import { FavoritesScreen } from "./src/components/FavoritesScreen";
import { PersonalDetailsScreen, ProfileSettingsScreen, SegmentedChoice } from "./src/components/ProfileSettingsScreen";
import { HomeServicesSettingsScreen, type HomeServiceOption } from "./src/components/HomeServicesSettingsScreen";
import { HOME_SERVICE_IDS, persistHomeServices, restoreHomeServices, type HomeServiceId } from "./src/storage/homeServices";
import { TransportStopsScreen } from "./src/components/TransportStopsScreen";
import { TransportCacheNotice } from "./src/components/TransportCacheNotice";
import { StorageRecoveryNotice } from "./src/components/StorageRecoveryNotice";
import { DemoCardScreen } from "./src/components/DemoCardScreen";
import { WasteScreen } from "./src/components/WasteScreen";
import { ParkingDemoScreen } from "./src/components/ParkingDemoScreen";
import { RouteMap, type MapRegion } from "./src/components/RouteMap";
import { OfficialLayerMap } from "./src/components/OfficialLayerMap";
import { MiniaturesMap } from "./src/components/MiniaturesMap";
import { searchMiniatures } from "./src/miniatures/catalog";
import { DemoTransportPaymentScreen } from "./src/components/DemoTransportPaymentScreen";
import { CnapAppointmentsScreen } from "./src/components/CnapAppointmentsScreen";
import { PollsScreen } from "./src/components/PollsScreen";
import { CityEventsScreen } from "./src/components/CityEventsScreen";
import { NewsArticleScreen } from "./src/components/NewsArticleScreen";
import { civicStyles, PrimaryButton, ServiceHeader, ServiceSheet, useHardwareBack } from "./src/components/CivicServiceUI";
import type { DemoTicket } from "./src/payments/demoTransport";
import { appendDemoTicket, persistDemoTickets, restoreDemoTickets } from "./src/storage/demoTickets";
import { persistDemoCard, restoreDemoCard, type DemoPaymentCard } from "./src/storage/demoPaymentCard";
import {
  ActivityIndicator, AppState, Animated, BackHandler, FlatList, Image, Linking,
  RefreshControl, ScrollView, StyleSheet,
  useColorScheme, useWindowDimensions, View,
} from "react-native";
import {
  getRoute,
  getRoutes,
  getDepartures,
  getRouteMap,
  getVehiclePositions,
  getLatestTransportImport,
  getStopRoutes,
  getStops,
  type TransportDeparture,
  type TransportImportStatus,
  type TransportRouteMap,
  type TransportRoute,
  type TransportRouteDetails,
  type TransportStop,
  type TransportVehiclePositions,
} from "./src/api/transport";
import {
  getAccessibleBuildings,
  getAirAlertStatus,
  getAirAlertEvents,
  getCurrencyRates,
  getMiniSculptures,
  getOfficialNews,
  getSafetyMapPoints,
  getEditorialDefenderFunds,
  getWeather,
  type AccessibleBuilding,
  type AccessibleBuildingList,
  type AirAlertStatus,
  type AirAlertEvent,
  type CurrencyRates,
  type OfficialNewsList,
  type OfficialNewsItem,
  type SafetyMapPoint,
  type MiniSculpture,
  type MiniSculptureList,
  type Weather,
} from "./src/api/cityServices";
import { changeAccountPassword, deleteAccount, loginAccount, logoutAccount, recoverAccountSession, registerAccount, updateAccountFavorites, updateAccountPreferences, type AccountSession } from "./src/api/account";
import { clearSecureSession, persistSecureSession, restoreSecureSession } from "./src/storage/secureSession";
import { DEFAULT_NOTIFICATIONS, persistPreferences, restorePreferences, type NotificationPreferences, type ThemeMode } from "./src/storage/preferences";
import { LatestRequest } from "./src/utils/latestRequest";
import { isFreshSnapshot } from "./src/utils/freshness";
import { transportLiveState } from "./src/utils/transportLive";
import { CITY_TIME_ZONE, cityClock, cityDate, citySeconds } from "./src/utils/cityTime";
import { visibleScheduleDepartures } from "./src/utils/transportSchedule";
import { PAGE_LAYOUT } from "./src/ui/layout";
import { APP_FONTS } from "./src/ui/fonts";
import { COLOR_TOKENS } from "./src/ui/themeTokens";

type ScheduleView = {
  route: TransportRouteDetails;
  stop: TransportStop;
  departures: TransportDeparture[];
  date: string;
};

type MapScreen = {
  route: TransportRouteDetails;
  map: TransportRouteMap;
  activeVariantId?: string;
};

type StopScreen = {
  stop: TransportStop;
  routes: TransportRoute[];
};

type CityService = {
  id: "cnap" | "transport-payment" | "polls" | "accessibility" | "parking" | "power-outages" | "shelters" | "resilience" | "waste" | "playgrounds" | "miniatures" | "donations" | "events";
  category: "mobility" | "civic" | "safety" | "daily" | "leisure" | "community";
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  sourceLabel: string;
  sourceUrl?: string;
  notice?: string;
  testScenario?: boolean;
};

type DefenderFund = {
  id: string;
  title: string;
  description: string;
  donationUrl: string;
  verifiedAt: string;
  verificationSource: string;
};



const SERVICE_CATEGORIES: Array<{ id: CityService["category"]; title: string }> = [
  { id: "mobility", title: "Транспорт і паркування" },
  { id: "daily", title: "Дім і комунальні послуги" },
  { id: "civic", title: "Документи та ЦНАП" },
  { id: "safety", title: "Безпека й доступність" },
  { id: "leisure", title: "Події та дозвілля" },
  { id: "community", title: "Участь і допомога" },
];

type RootTab = "home" | "feed" | "services" | "profile";

const CITY_SERVICES: CityService[] = [
  {
    id: "events",
    category: "leisure",
    icon: "calendar-outline",
    title: "Події міста",
    description: "Виставки, зустрічі, спорт, концерти та сімейні події.",
    sourceLabel: "Відкрити події міста",
    notice: "Добираємо події з вказаною датою, місцем і посиланням на джерело. Перед відвідуванням перевіряйте зміни у організатора.",
  },
  {
    id: "transport-payment",
    category: "mobility",
    icon: "card-outline",
    title: "Оплата проїзду",
    testScenario: true,
    description: "QR у салоні або державний номер автобуса — і оплата поїздки.",
    sourceLabel: "Відкрити оплату проїзду",
    notice: "Тестова оплата без списання коштів. Демонстраційні квитки не дійсні для проїзду.",
  },
  {
    id: "donations",
    category: "community",
    icon: "heart-outline",
    title: "Підтримати військо",
    description: "Добірка офіційних зборів на потреби закарпатських підрозділів.",
    sourceLabel: "Відкрити добірку",
    notice: "Додаємо лише збори з підтвердженим офіційним посиланням, метою та датою перевірки. Платежі проходять напряму на стороні отримувача.",
  },
  {
    id: "cnap",
    category: "civic",
    icon: "document-text-outline",
    title: "Запис до ЦНАП",
    testScenario: true,
    description: "Покроковий приклад запису та офіційний кабінет ЦНАП.",
    sourceLabel: "Відкрити кабінет ЦНАП",
    sourceUrl: "https://my.cnap.rada-uzhgorod.gov.ua/",
    notice: "Приклад запису зберігається на пристрої, але не бронює реальну чергу. Справжні послуги доступні в офіційному кабінеті ЦНАП.",
  },
  {
    id: "polls",
    category: "community",
    icon: "checkbox-outline",
    title: "Опитування",
    testScenario: true,
    description: "Міські опитування та можливість поділитися думкою.",
    sourceLabel: "Незабаром",
    notice: "Демонстраційний вибір зберігається лише на пристрої. Офіційне голосування й загальні результати потребують серверної інтеграції.",
  },
  {
    id: "accessibility",
    category: "safety",
    icon: "accessibility-outline",
    title: "Безбар’єрність",
    description: "Реєстр будівель, щодо яких місто проводило моніторинг доступності.",
    sourceLabel: "Відкрити набір відкритих даних",
    sourceUrl: "https://data.rada-uzhgorod.gov.ua/dataset/96934681-c934-4ae3-a099-448d850620d5",
    notice: "Дані публікує міська рада за ліцензією CC BY 4.0. Наявність у реєстрі не гарантує конкретний рівень доступності, тому перед поїздкою звіряйте інформацію на порталі.",
  },
  {
    id: "parking",
    category: "mobility",
    icon: "car-outline",
    title: "Паркування",
    testScenario: true,
    description: "Майданчик, авто, тривалість та тестова сесія паркування.",
    sourceLabel: "Перейти до офіційного сервісу",
    sourceUrl: "https://pdr.rada-uzhgorod.gov.ua/",
    notice: "Тестова сесія зберігається на пристрої, не списує коштів і не підтверджує право на паркування.",
  },
  {
    id: "power-outages",
    category: "daily",
    icon: "flash-outline",
    title: "Світло за адресою",
    description: "Перевірка аварійних, планових і графікових відключень від Закарпаттяобленерго.",
    sourceLabel: "Перевірити адресу в Закарпаттяобленерго",
    sourceUrl: "https://zakarpat.energy/customers/break-in-electricity-supply/realtime-outage/",
    notice: "Адресний пошук за даними публічного сервісу Закарпаттяобленерго. Час відновлення орієнтовний; відсутність запису не гарантує наявності світла.",
  },
  {
    id: "shelters",
    category: "safety",
    icon: "shield-outline",
    title: "Укриття",
    description: "Мапа захисних споруд та важлива інформація про них.",
    sourceLabel: "Відкрити мапу укриттів",
    sourceUrl: "https://geo.rada-uzhgorod.gov.ua/map/shelter#/16:22.290283,48.608131:0.00:0.00?baseLayer=osmb&layers=3317996270789854695",
    notice: "Користуємося інтерактивною мапою міського геопорталу — вона є джерелом актуальних позначок і деталей укриттів.",
  },
  {
    id: "resilience",
    category: "safety",
    icon: "flashlight-outline",
    title: "Пункти незламності",
    description: "Мапа пунктів допомоги під час тривалих відключень.",
    sourceLabel: "Відкрити державну мапу",
    sourceUrl: "https://nezlamnist.gov.ua/",
    notice: "Адреси, графік і доступні послуги змінюються, тому відкриваємо актуальну державну мапу, а не дублюємо список у застосунку.",
  },
  {
    id: "waste",
    category: "daily",
    icon: "trash-outline",
    title: "Сортування та відходи",
    description: "Контейнерні майданчики, небезпечні відходи й точки прийому сировини.",
    sourceLabel: "Відкрити офіційний набір",
    sourceUrl: "https://data.rada-uzhgorod.gov.ua/dataset/d6aaf49f-765b-49e8-b891-d03d3d44f1ae",
    notice: "У міста є набір із контейнерними майданчиками та точками прийому відходів. Додамо його на мапу після перевірки доступності й формату координат у ресурсі.",
  },
  {
    id: "playgrounds",
    category: "leisure",
    icon: "football-outline",
    title: "Майданчики",
    description: "Дитячі, спортивні та інші місця для активного відпочинку.",
    sourceLabel: "Відкрити офіційний набір",
    sourceUrl: "https://data.rada-uzhgorod.gov.ua/dataset/106577c3-0816-4a67-9483-ef2f227576d0",
    notice: "Набір міста містить адреси, координати й опис обладнання. Його CSV зараз на модерації, тому карту додамо після відкриття доступу до актуальних точок.",
  },
  {
    id: "miniatures",
    category: "leisure",
    icon: "walk-outline",
    title: "Мініскульптури Ужгорода",
    description: "Прогулянковий маршрут і мапа маленьких символів міста.",
    sourceLabel: "Відкрити мапу",
    notice: "Власний каталог уже має першу добірку локацій і буде доповнюватися. Ми не використовуємо чужі фотографії чи скопійовані описи.",
  },
];

const HOME_SERVICE_OPTIONS: HomeServiceOption[] = HOME_SERVICE_IDS.map(id => {
  if (id === "transport") return { id, title: "Громадський транспорт", icon: "bus-outline" };
  const service = CITY_SERVICES.find(item => item.id === id)!;
  return { id, title: service.title, icon: service.icon, testScenario: service.testScenario };
});

// This list intentionally starts empty. Add a collection only after its direct donation link,
// official confirmation and the date of verification have been checked by the editorial team.
const DEFENDER_FUNDS: DefenderFund[] = [];

const FEATURED_DEFENDER_DONATION = {
  title: "Рух підтримки закарпатських військових",
  donationUrl: "https://send.monobank.ua/jar/6Uz6GSyc7k",
  note: "Це постійна Банка Руху підтримки закарпатських військових. Актуальна потреба та звітність змінюються безпосередньо на сторінці mono.",
};


const PARKING_PORTAL_URL = "https://pdr.rada-uzhgorod.gov.ua/";
const PARKING_EVACUATION_URL = "https://pdr.rada-uzhgorod.gov.ua/evacuation/";
const PARKING_INSPECTOR_URL = "https://pdr.rada-uzhgorod.gov.ua/inspector/";
const PARKING_DATASET_URL = "https://data.rada-uzhgorod.gov.ua/dataset/69463bbd-3985-45cf-8966-a35d709176a3";
const UZHHOROD_DIGITAL_LOGO = require("./assets/brand/uzhhorod-digital-mark.png");

type AppPalette = {
  navy: string;
  navyDark: string;
  mist: string;
  blueSurface: string;
  blueSoft: string;
  ink: string;
  muted: string;
  tertiary: string;
  border: string;
  separator: string;
  controlBorder: string;
  gold: string;
  green: string;
  danger: string;
};

const LIGHT_COLORS: AppPalette = {
  navy: "#123a63",
  navyDark: "#002446",
  mist: COLOR_TOKENS.light.bg,
  blueSurface: COLOR_TOKENS.light.soft,
  blueSoft: "#e4efff",
  ink: COLOR_TOKENS.light.ink,
  muted: COLOR_TOKENS.light.muted,
  tertiary: COLOR_TOKENS.light.tertiary,
  border: COLOR_TOKENS.light.border,
  separator: "#d5dee9",
  controlBorder: "#73879d",
  gold: "#e5ae2d",
  green: "#3d6836",
  danger: "#a31d1d",
};

const DARK_COLORS: AppPalette = {
  navy: "#8fc8ff",
  navyDark: "#e7f2ff",
  mist: COLOR_TOKENS.dark.bg,
  blueSurface: COLOR_TOKENS.dark.surface,
  blueSoft: COLOR_TOKENS.dark.soft,
  ink: COLOR_TOKENS.dark.ink,
  muted: COLOR_TOKENS.dark.muted,
  tertiary: COLOR_TOKENS.dark.tertiary,
  border: COLOR_TOKENS.dark.border,
  separator: "#234561",
  controlBorder: "#7399b9",
  gold: "#f4c65b",
  green: "#9dd38f",
  danger: "#ffb4ad",
};

let COLORS: AppPalette = LIGHT_COLORS;

const FONTS = APP_FONTS;
const ProfileIdentity = createContext<{ dark: boolean }>({ dark: false });

function StatusBar(_props: { style?: "dark" | "light" }) {
  return <ExpoStatusBar style={useContext(ProfileIdentity).dark ? "light" : "dark"} />;
}

function CivicHeader() {
  return (
    <View style={styles.civicHeader}>
      <View style={styles.brandGroup}>
        <BrandMark />
        <View style={styles.brandCopy}>
          <View style={styles.brandTitleRow}>
            <Text style={styles.brandTitle}>Ужгород Цифровий</Text>
          </View>
          <Text style={styles.brandSubtitle}>міські сервіси в одному застосунку</Text>
        </View>
      </View>
    </View>
  );
}

function BrandMark({ size = 34 }: { size?: number }) {
  return <Image
    accessibilityLabel={translate("Логотип Ужгород Цифровий")}
    source={UZHHOROD_DIGITAL_LOGO}
    fadeDuration={0}
    style={[styles.brandMark, { borderRadius: Math.round(size * 0.22), height: size, width: size }]}
  />;
}

function BrandIntro({ opacity, scale }: { opacity: Animated.Value; scale: Animated.Value }) {
  return <SafeAreaView style={styles.brandIntroScreen}>
    <View style={styles.brandIntroBody}>
      <Animated.View style={[styles.brandIntroContent, { opacity, transform: [{ scale }] }]}>
        <BrandMark size={88} />
        <Text style={styles.brandIntroTitle}>Ужгород Цифровий</Text>
        <Text style={styles.brandIntroSubtitle}>Міські сервіси в одному застосунку</Text>
      </Animated.View>
      <View style={styles.brandIntroFooter}>
        <ActivityIndicator size="small" color={COLORS.navy} />
        <Text style={styles.brandIntroFooterText}>Завантажуємо місто</Text>
      </View>
    </View>
  </SafeAreaView>;
}

function InnerHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const dark = useContext(AppThemeContext) ?? false;
  return <View style={{ marginHorizontal: -PAGE_LAYOUT.gutter }}><ServiceHeader dark={dark} title={title} onBack={onBack} /></View>;
}

function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityLabel={`Назад: ${label}`} accessibilityRole="button" hitSlop={6} style={styles.backLink} onPress={onPress}>
      <Ionicons name="chevron-back" size={18} color={COLORS.navyDark} />
      <Text style={styles.backLinkText}>{label}</Text>
    </Pressable>
  );
}

function useSwipeBack(onBack: () => void) {
  return useAnimatedBack(onBack);
}

export default function App() {
  return <SafeAreaProvider><AppContent /></SafeAreaProvider>;
}
function AppContent() {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [displayName, setDisplayName] = useState("");
  const isDarkTheme = themeMode === "dark" || (themeMode === "system" && systemColorScheme === "dark");
  COLORS = isDarkTheme ? DARK_COLORS : LIGHT_COLORS;
  styles = useMemo(() => buildStyles(isDarkTheme), [isDarkTheme]);
  const [introVisible, setIntroVisible] = useState(true);
  // Warm the bundled asset once. Tab changes keep the same local image source.
  useEffect(() => { void Asset.loadAsync(UZHHOROD_DIGITAL_LOGO).catch(() => undefined); }, []);
  const introOpacity = useRef(new Animated.Value(0)).current;
  const introScale = useRef(new Animated.Value(0.94)).current;
  const [section, setSection] = useState<"hub" | "transport">("hub");
  const [activeTab, setActiveTab] = useState<RootTab>("home");
  const [profilePanel, setProfilePanel] = useState<"notifications" | "language" | "account" | "payment-methods" | "legal" | "address" | "settings" | "personal" | "favorites" | "home-services" | null>(null);
  const [profileReturn, setProfileReturn] = useState<"settings" | "favorites" | null>(null);
  const [transportFromFavorites, setTransportFromFavorites] = useState(false);
  const closeProfilePanel = () => { setProfilePanel(profileReturn); setProfileReturn(null); };
  const [account, setAccount] = useState<AccountSession | null>(null);
  const accountRevision = useRef(0);
  const accountMutationLocked = useRef(false);
  const preferencesRevision = useRef(0);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [homeServiceIds, setHomeServiceIds] = useState<HomeServiceId[] | null>(null);
  const [homeServicesError, setHomeServicesError] = useState(false);
  const [homeServicesRetry, setHomeServicesRetry] = useState(0);
  const [storageRetry, setStorageRetry] = useState(0);
  const [storageErrors, setStorageErrors] = useState({ preferences: false, card: false, tickets: false });
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATIONS);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const listRequest = useRef(new LatestRequest()).current;
  const detailRequest = useRef(new LatestRequest()).current;
  const retryTransport = useRef<() => void>(() => undefined);
  const [favoriteRouteIds, setFavoriteRouteIds] = useState<string[]>([]);
  const [favoriteStopIds, setFavoriteStopIds] = useState<string[]>([]);
  // Keep the saved preference in React state as well: a catalogue Fast Refresh
  // must not reset the locale store and then overwrite the user's saved English.
  const [language, setSavedLanguage] = useState<"uk" | "en">("uk");
  const [runtimeLanguage, activateLanguage] = useLanguage();
  const setLanguage = useCallback((next: "uk" | "en") => {
    setSavedLanguage(next);
    activateLanguage(next);
  }, [activateLanguage]);
  useEffect(() => { activateLanguage(language); }, [language, runtimeLanguage, activateLanguage]);
  const [demoPaymentCard, updateDemoPaymentCard] = useState<DemoPaymentCard | null>(null);
  const demoCardRevision = useRef(0);
  const setDemoPaymentCard = async (card: DemoPaymentCard | null) => {
    demoCardRevision.current++;
    await persistDemoCard(card);
    updateDemoPaymentCard(card);
    setStorageErrors(previous => ({ ...previous, card: false }));
  };
  const [demoTickets, setDemoTickets] = useState<DemoTicket[]>([]);
  const [demoTicketsReady, setDemoTicketsReady] = useState(false);
  const [paymentInitialView, setPaymentInitialView] = useState<"choose" | "history">("choose");
  const [paymentMethodsInCheckout, setPaymentMethodsInCheckout] = useState(false);
  const [weatherOpen, setWeatherOpen] = useState(false);
  const [selectedNewsArticle, setSelectedNewsArticle] = useState<{ item: OfficialNewsItem; returnTab: RootTab } | null>(null);
  const [selectedService, setSelectedService] = useState<CityService | null>(null);
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [stops, setStops] = useState<TransportStop[]>([]);
  const [importStatus, setImportStatus] = useState<TransportImportStatus | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<TransportRouteDetails | null>(null);
  const [selectedStop, setSelectedStop] = useState<StopScreen | null>(null);
  const [schedule, setSchedule] = useState<ScheduleView | null>(null);
  const [mapScreen, setMapScreen] = useState<MapScreen | null>(null);
  const [routeMapPreview, setRouteMapPreview] = useState<TransportRouteMap | null>(null);
  const [searchMode, setSearchMode] = useState<"routes" | "stops">("routes");
  const [showDataSources, setShowDataSources] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goBack = useCallback(() => {
    if (section === "transport") {
      listRequest.invalidate();
      setListLoading(false);
      detailRequest.invalidate();
      setLoading(false);
      setError(null);
      if (loading || error) {
        if (transportFromFavorites && !selectedRoute && !selectedStop) { setSection("hub"); return true; }
        // A failed schedule/map request must return to the previous detail, not discard it.
        if (!selectedRoute && !selectedStop && !routes.length && !stops.length) {
          setSection("hub"); setActiveTab("services");
        }
        return true;
      }
      if (mapScreen) {
        setMapScreen(null);
        return true;
      }
      if (schedule) {
        setSchedule(null);
        return true;
      }
      if (selectedRoute) {
        setSchedule(null);
        setMapScreen(null);
        setRouteMapPreview(null);
        setSelectedRoute(null);
        if (transportFromFavorites && !selectedStop) setSection("hub");
        return true;
      }
      if (selectedStop) {
        setSelectedStop(null);
        if (transportFromFavorites) setSection("hub");
        return true;
      }
      if (showDataSources) {
        setShowDataSources(false);
        return true;
      }
      setSection("hub");
      setActiveTab(transportFromFavorites ? "profile" : "services");
      return true;
    }
    if (weatherOpen) {
      setWeatherOpen(false);
      return true;
    }
    if (selectedNewsArticle) {
      setActiveTab(selectedNewsArticle.returnTab);
      setSelectedNewsArticle(null);
      return true;
    }
    if (selectedService) {
      if (selectedService.id === "transport-payment" && paymentMethodsInCheckout) {
        setPaymentMethodsInCheckout(false);
        return true;
      }
      setSelectedService(null);
      return true;
    }
    if (profilePanel) {
      setProfilePanel(profileReturn); setProfileReturn(null);
      return true;
    }
    if (activeTab !== "home") {
      setActiveTab("home");
      return true;
    }
    return false;
  }, [activeTab, error, loading, mapScreen, paymentMethodsInCheckout, profilePanel, profileReturn, routes.length, schedule, section, selectedNewsArticle, selectedRoute, selectedService, selectedStop, showDataSources, stops.length, weatherOpen, transportFromFavorites]);

  const transportSwipeBack = useSwipeBack(goBack);

  useEffect(() => {
    let active = true;
    setHomeServicesError(false);
    void restoreHomeServices().then(ids => { if (active) setHomeServiceIds(ids); })
      .catch(() => { if (active) setHomeServicesError(true); });
    return () => { active = false; };
  }, [homeServicesRetry]);

  async function saveHomeServices(ids: HomeServiceId[]) {
    await persistHomeServices(ids);
    setHomeServiceIds(ids);
  }

  function openHomeServicesSettings() {
    setSection("hub"); setActiveTab("profile"); setProfileReturn("settings"); setProfilePanel("home-services");
  }

  useEffect(() => {
    let active = true;
    if (preferencesReady && !storageErrors.preferences) return;
    setPreferencesReady(false);
    void restorePreferences().then((saved) => {
      if (active && saved) {
        if (preferencesRevision.current === 0) {
          setLanguage(saved.language);
          setNotificationPreferences(saved.notifications);
        }
        setThemeMode(saved.theme ?? "system");
        setDisplayName(saved.displayName ?? "");
      }
      if (active) { setPreferencesReady(true); setStorageErrors(previous => ({ ...previous, preferences: false })); }
    }).catch(() => { if (active) setStorageErrors(previous => ({ ...previous, preferences: true })); });
    return () => { active = false; };
  }, [storageRetry]);

  useEffect(() => {
    if (!preferencesReady) return;
    void persistPreferences({ language, notifications: notificationPreferences, theme: themeMode, displayName }).catch(() => {
      Alert.alert("Налаштування не збережено", "Після перезапуску вони можуть повернутися до попередніх значень.");
    });
  }, [language, notificationPreferences, themeMode, displayName, preferencesReady]);

  useEffect(() => {
    let active = true;
    const revision = demoCardRevision.current;
    void restoreDemoCard().then(card => {
      if (active && demoCardRevision.current === revision) updateDemoPaymentCard(card);
      if (active) setStorageErrors(previous => ({ ...previous, card: false }));
    }).catch(() => {
      // Do not erase an unreadable saved card merely because restoration failed.
      // An explicit add/remove action can replace this record after a successful write.
      if (active) setStorageErrors(previous => ({ ...previous, card: true }));
    });
    return () => { active = false; };
  }, [storageRetry]);
  useEffect(() => {
    let active = true;
    setDemoTicketsReady(false);
    void restoreDemoTickets().then((tickets) => {
      if (active) { setDemoTickets(tickets); setDemoTicketsReady(true); setStorageErrors(previous => ({ ...previous, tickets: false })); }
    }).catch(() => { if (active) setStorageErrors(previous => ({ ...previous, tickets: true })); });
    return () => { active = false; };
  }, [storageRetry]);

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.parallel([
        Animated.timing(introOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.spring(introScale, { toValue: 1, friction: 8, tension: 60, useNativeDriver: true }),
      ]),
      Animated.delay(620),
      Animated.timing(introOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]);
    animation.start(({ finished }) => {
      if (finished) {
        setIntroVisible(false);
      }
    });
    return () => animation.stop();
  }, [introOpacity, introScale]);

  useEffect(() => {
    // These service flows handle their own steps and sheets; do not skip them on Android back.
    if (["cnap", "polls", "events", "transport-payment", "parking", "waste", "power-outages"].includes(selectedService?.id ?? "")) return;
    if (section === "hub" && profilePanel && ["address", "personal", "settings", "language", "payment-methods", "favorites", "home-services"].includes(profilePanel)) return;
    if (section === "transport" && searchMode === "stops" && !selectedRoute && !selectedStop && !loading && !error && !showDataSources) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", goBack);
    return () => subscription.remove();
  }, [goBack, selectedService?.id, profilePanel, section, searchMode, selectedRoute, selectedStop, loading, error, showDataSources]);

  useEffect(() => {
    let active = true;
    const revision = accountRevision.current;
    void restoreSecureSession().then(async (storedSession) => {
      if (!storedSession || !active || revision !== accountRevision.current) return;
      // Show the saved account immediately; unavailable Wi-Fi must not log the user out.
      setAccount(storedSession);
      setFavoriteRouteIds(storedSession.favorites.routeIds);
      setFavoriteStopIds(storedSession.favorites.stopIds);
      const session = await recoverAccountSession(storedSession);
      if (!active || revision !== accountRevision.current) return;
      if (session) await handleAuthenticated(session);
      else {
        accountRevision.current++;
        setAccount(null); setFavoriteRouteIds([]); setFavoriteStopIds([]);
        await clearSecureSession().catch(() => undefined);
      }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (section !== "transport" || transportFromFavorites) {
      return;
    }
    const timer = setTimeout(() => {
      void loadList(query);
    }, query.trim() ? 250 : 0);
    return () => { clearTimeout(timer); listRequest.invalidate(); };
  }, [query, searchMode, section, transportFromFavorites]);

  if (introVisible) {
    return <BrandIntro opacity={introOpacity} scale={introScale} />;
  }

  function openTransportHub() {
    setTransportFromFavorites(false);
    listRequest.invalidate(); detailRequest.invalidate();
    setSelectedRoute(null); setSelectedStop(null); setSchedule(null); setMapScreen(null); setRouteMapPreview(null);
    setError(null);
    setSelectedService(null);
    setPaymentMethodsInCheckout(false);
    setActiveTab("services");
    setSection("transport");
    setLoading(false); setListLoading(true);
    void getStops().then(setStops).catch(() => undefined);
  }

  function navigateToTab(tab: RootTab) {
    setTransportFromFavorites(false);
    setProfilePanel(null); setProfileReturn(null);
    listRequest.invalidate(); detailRequest.invalidate();
    setLoading(false); setError(null);
    setPaymentInitialView("choose");
    setPaymentMethodsInCheckout(false);
    setSelectedNewsArticle(null);
    setSelectedService(null);
    setWeatherOpen(false);
    setSection("hub");
    setActiveTab(tab);
  }

  function openNewsArticle(item: OfficialNewsItem, returnTab: RootTab) {
    setSelectedNewsArticle({ item, returnTab });
  }

  async function handleAuthenticated(session: AccountSession) {
    accountRevision.current++;
    preferencesRevision.current++;
    setAccount(session);
    setLanguage(session.preferences.language === "en" ? "en" : "uk");
    const { alert, news, transport, silence } = session.preferences;
    setNotificationPreferences({ alert, news, transport, silence });
    setFavoriteRouteIds(session.favorites?.routeIds ?? []);
    setFavoriteStopIds(session.favorites?.stopIds ?? []);
    try {
      await persistSecureSession(session);
    } catch {
      Alert.alert("Сесію не збережено", "Після перезапуску потрібно буде увійти ще раз.");
    }
  }

  async function handleLogout() {
    if (!account || accountMutationLocked.current) return;
    accountMutationLocked.current = true;
    accountRevision.current++;
    try {
      await logoutAccount(account.accessToken);
      await clearSecureSession().catch(() => undefined);
      setAccount(null); setFavoriteRouteIds([]); setFavoriteStopIds([]);
      await setDemoPaymentCard(null).catch(() => Alert.alert("Картку не видалено. Спробуйте ще раз."));
      setProfilePanel(null); setProfileReturn(null);
    } catch (requestError) {
      Alert.alert("Не вдалося вийти", requestError instanceof Error ? requestError.message : "Спробуйте ще раз.");
      return;
    } finally {
      accountMutationLocked.current = false;
    }
  }

  async function handleDeleteAccount() {
    if (!account || accountMutationLocked.current) return;
    accountMutationLocked.current = true;
    accountRevision.current++;
    try {
      await deleteAccount(account.accessToken);
      await clearSecureSession().catch(() => undefined);
      setAccount(null); setFavoriteRouteIds([]); setFavoriteStopIds([]);
      await setDemoPaymentCard(null).catch(() => Alert.alert("Картку не видалено. Спробуйте ще раз."));
      setProfilePanel(null); setProfileReturn(null);
      Alert.alert("Акаунт видалено", "Дані акаунта, налаштування та обране видалено.");
    } catch (requestError) {
      Alert.alert("Не вдалося видалити", requestError instanceof Error ? requestError.message : "Спробуйте ще раз.");
      return;
    } finally {
      accountMutationLocked.current = false;
    }
  }

  async function toggleFavorite(kind: "route" | "stop", id: string) {
    if (!account) {
      Alert.alert("Збереження в обраному", "Створіть акаунт або увійдіть, щоб зберегти маршрути та зупинки.", [
        { text: "Не зараз", style: "cancel" },
        { text: "До акаунта", onPress: () => { setSection("hub"); setActiveTab("profile"); setProfilePanel("account"); } },
      ]);
      return;
    }

    if (accountMutationLocked.current) return;
    accountMutationLocked.current = true;
    const revision = ++accountRevision.current;

    const previousRoutes = favoriteRouteIds;
    const previousStops = favoriteStopIds;
    const update = (items: string[]) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id];
    const nextRoutes = kind === "route" ? update(favoriteRouteIds) : favoriteRouteIds;
    const nextStops = kind === "stop" ? update(favoriteStopIds) : favoriteStopIds;
    setFavoriteRouteIds(nextRoutes);
    setFavoriteStopIds(nextStops);
    try {
      const favorites = await updateAccountFavorites(account.accessToken, nextRoutes, nextStops);
      if (revision !== accountRevision.current) return;
      setFavoriteRouteIds(favorites.routeIds);
      setFavoriteStopIds(favorites.stopIds);
      const updatedSession = { ...account, favorites };
      setAccount(updatedSession);
      await persistSecureSession(updatedSession).catch(() => {
        Alert.alert("Обране збережено в акаунті", "Не вдалося оновити локальну копію. Перевірте обране після наступного входу.");
      });
    } catch (requestError) {
      if (revision !== accountRevision.current) return;
      setFavoriteRouteIds(previousRoutes);
      setFavoriteStopIds(previousStops);
      Alert.alert("Не вдалося зберегти", requestError instanceof Error ? requestError.message : "Спробуйте ще раз.");
    } finally {
      accountMutationLocked.current = false;
    }
  }

  async function changePreferences(nextLanguage: "uk" | "en", notifications: NotificationPreferences) {
    if (!preferencesReady) { Alert.alert("Не вдалося прочитати збережені дані.", "Повторити відновлення"); return; }
    if (accountMutationLocked.current) return;
    preferencesRevision.current++;
    if (!account) { setLanguage(nextLanguage); setNotificationPreferences(notifications); return; }
    accountMutationLocked.current = true;
    const revision = ++accountRevision.current;
    setSavingPreferences(true);
    try {
      const preferences = await updateAccountPreferences(account.accessToken, { ...account.preferences, language: nextLanguage, ...notifications });
      if (revision !== accountRevision.current) return;
      const session = { ...account, preferences };
      setAccount(session); setLanguage(nextLanguage); setNotificationPreferences(notifications);
      await persistSecureSession(session).catch(() => {
        Alert.alert("Налаштування збережено в акаунті", "Не вдалося оновити локальну копію сесії.");
      });
    } catch (requestError) {
      Alert.alert("Не вдалося зберегти налаштування", requestError instanceof Error ? requestError.message : "Спробуйте ще раз.");
    } finally { accountMutationLocked.current = false; setSavingPreferences(false); }
  }

  function openCityService(id: CityService["id"], paymentView: "choose" | "history" = "choose") {
    const service = CITY_SERVICES.find((item) => item.id === id);
    if (service) {
      setPaymentMethodsInCheckout(false);
      if (id === "transport-payment") setPaymentInitialView(paymentView);
      setSelectedService(service);
    }
  }

  async function loadList(searchQuery = query) {
    const revision = listRequest.begin();
    retryTransport.current = () => void loadList(searchQuery);
    setError(null);
    setListLoading(true);
    try {
      void getLatestTransportImport().then(latest => { if (listRequest.isCurrent(revision)) setImportStatus(latest); }).catch(() => undefined);
      if (searchMode === "routes") {
        const foundRoutes = await getRoutes(searchQuery);
        if (!listRequest.isCurrent(revision)) return;
        setRoutes(sortRoutesByNumber(foundRoutes));
      } else {
        const foundStops = await getStops(searchQuery);
        if (!listRequest.isCurrent(revision)) return;
        setStops(foundStops);
      }
    } catch (requestError) {
      if (!listRequest.isCurrent(revision)) return;
      setError(requestError instanceof Error ? requestError.message : "Невідома помилка");
    } finally {
      if (listRequest.isCurrent(revision)) { setLoading(false); setListLoading(false); }
    }
  }

  async function openRoute(route: TransportRoute) {
    listRequest.invalidate();
    setListLoading(false);
    const revision = detailRequest.begin();
    retryTransport.current = () => void openRoute(route);
    setLoading(true);
    setError(null);
    setSchedule(null);
    setMapScreen(null);
    setRouteMapPreview(null);
    if (!transportFromFavorites) setSelectedStop(null);
    try {
      const routeDetails = await getRoute(route.id);
      if (!detailRequest.isCurrent(revision)) return;
      setSelectedRoute(routeDetails);
      setLoading(false);
      try {
        const preview = await getRouteMap(route.id);
        if (detailRequest.isCurrent(revision)) setRouteMapPreview(preview);
      } catch {
        if (detailRequest.isCurrent(revision)) setRouteMapPreview(null);
      }
    } catch (requestError) {
      if (!detailRequest.isCurrent(revision)) return;
      setError(requestError instanceof Error ? requestError.message : "Невідома помилка");
    } finally {
      if (detailRequest.isCurrent(revision)) setLoading(false);
    }
  }

  async function openStop(stop: TransportStop) {
    listRequest.invalidate();
    setListLoading(false);
    const revision = detailRequest.begin();
    retryTransport.current = () => void openStop(stop);
    setLoading(true);
    setError(null);
    setSelectedRoute(null);
    try {
      const stopRoutes = await getStopRoutes(stop.id);
      if (detailRequest.isCurrent(revision)) setSelectedStop({ stop, routes: sortRoutesByNumber(stopRoutes) });
    } catch (requestError) {
      if (!detailRequest.isCurrent(revision)) return;
      setError(requestError instanceof Error ? requestError.message : "Невідома помилка");
    } finally {
      if (detailRequest.isCurrent(revision)) setLoading(false);
    }
  }

  async function openSchedule(route: TransportRouteDetails, stop: TransportStop, date = localDate()) {
    listRequest.invalidate();
    setListLoading(false);
    const revision = detailRequest.begin();
    retryTransport.current = () => void openSchedule(route, stop, date);
    setLoading(true);
    setError(null);
    try {
      const departures = await getDepartures(route.id, stop.id, date);
      if (detailRequest.isCurrent(revision)) setSchedule({ route, stop, date, departures });
    } catch (requestError) {
      if (!detailRequest.isCurrent(revision)) return;
      setError(requestError instanceof Error ? requestError.message : "Невідома помилка");
    } finally {
      if (detailRequest.isCurrent(revision)) setLoading(false);
    }
  }

  async function openMap(route: TransportRouteDetails, activeVariantId?: string) {
    listRequest.invalidate();
    setListLoading(false);
    const revision = detailRequest.begin();
    retryTransport.current = () => void openMap(route, activeVariantId);
    setLoading(true);
    setError(null);
    try {
      const map = routeMapPreview?.routeId === route.id ? routeMapPreview : await getRouteMap(route.id);
      if (detailRequest.isCurrent(revision)) setMapScreen({ route, map, activeVariantId });
    } catch (requestError) {
      if (!detailRequest.isCurrent(revision)) return;
      setError(requestError instanceof Error ? requestError.message : "Невідома помилка");
    } finally {
      if (detailRequest.isCurrent(revision)) setLoading(false);
    }
  }

  const screenState = { section, activeTab, profilePanel, selectedNewsArticle, weatherOpen, selectedService,
    loading, error, selectedRoute, selectedStop, mapScreen, schedule, showDataSources, searchMode };
  const frames = navigationPath({ section, activeTab, profilePanel, profileReturn,
    transportFromFavorites,
    serviceId: selectedService?.id, articleId: selectedNewsArticle?.item.sourceUrl, weatherOpen, paymentMethodsInCheckout,
    routeId: selectedRoute?.id, stopId: selectedStop?.stop.id, mapOpen: Boolean(mapScreen), scheduleOpen: Boolean(schedule),
    searchMode, showDataSources, loading, error: Boolean(error) });
  function renderScreen(frame: NavigationFrame) {
  const kind = frame.kind;
  const section = ["transport", "transport-stops", "route", "route-map", "schedule", "stop", "data-sources", "loading", "error"].includes(kind) ? "transport" : "hub";
  const activeTab = ["home", "services", "feed", "profile"].includes(kind) ? kind as RootTab : screenState.activeTab;
  const profilePanel = kind.startsWith("profile:") ? kind.slice(8) as typeof screenState.profilePanel : null;
  const selectedNewsArticle = kind === "article" ? screenState.selectedNewsArticle : null;
  const weatherOpen = kind === "weather";
  const selectedService = kind === "service" ? screenState.selectedService : null;
  const loading = kind === "loading"; const error = kind === "error" ? screenState.error : null;
  const selectedRoute = ["route", "route-map", "schedule"].includes(kind) ? screenState.selectedRoute : null;
  const selectedStop = kind === "stop" ? screenState.selectedStop : null;
  const mapScreen = kind === "route-map" ? screenState.mapScreen : null;
  const schedule = kind === "schedule" ? screenState.schedule : null;
  const showDataSources = kind === "data-sources";
  const searchMode = kind === "transport-stops" ? "stops" : "routes";
  if (section === "hub") {
    if (kind === "home") return <HomeScreen visible={homeVisible} homeServiceIds={homeServiceIds} homeServicesError={homeServicesError} onRetryHomeServices={() => setHomeServicesRetry(value => value + 1)} onConfigureServices={openHomeServicesSettings} onOpenTransport={openTransportHub} onOpenWeather={() => setWeatherOpen(true)} onOpenService={openCityService} onOpenArticle={item => openNewsArticle(item, "home")} onChangeTab={navigateToTab} />;
    if (kind === "checkout-card") return <PaymentMethodsScreen
      accountEmail={account?.preferences.email} card={demoPaymentCard}
      storageNotice={storageErrors.card ? <StorageRecoveryNotice dark={isDarkTheme} onRetry={() => setStorageRetry(value => value + 1)} /> : null}
      isDarkTheme={isDarkTheme} backLabel="До оплати" onBack={() => setPaymentMethodsInCheckout(false)}
      onSaveCard={async card => { await setDemoPaymentCard(card); setPaymentMethodsInCheckout(false); }}
      onRemoveCard={() => setDemoPaymentCard(null)} />;
    if (selectedNewsArticle) {
      return <NewsArticleScreen
        dark={isDarkTheme}
        onOpenLink={openOfficialLink}
        item={selectedNewsArticle.item}
        backLabel={selectedNewsArticle.returnTab === "home" ? "До головної" : "До стрічки"}
        onBack={() => {
          setActiveTab(selectedNewsArticle.returnTab);
          setSelectedNewsArticle(null);
        }}
      />;
    }
    if (weatherOpen) {
      return <WeatherScreen onBack={() => setWeatherOpen(false)} />;
    }
    if (selectedService) {
      if (selectedService.id === "events") {
        return <CityEventsScreen dark={isDarkTheme} onBack={() => setSelectedService(null)} />;
      }
      if (selectedService.id === "donations") {
        return <DefendersSupportScreen onBack={() => setSelectedService(null)} />;
      }
      if (selectedService.id === "cnap") {
        return <CnapAppointmentsScreen isDarkTheme={isDarkTheme} onBack={() => setSelectedService(null)} />;
      }
      if (selectedService.id === "transport-payment") {
        return <DemoTransportPaymentScreen
              card={demoPaymentCard}
              tickets={demoTickets}
              initialView={paymentInitialView}
              backLabel={activeTab === "profile" ? "До профілю" : activeTab === "home" ? "До головної" : "До сервісів"}
              isDarkTheme={isDarkTheme}
              active={!paymentMethodsInCheckout}
              historyReady={demoTicketsReady}
              historyError={storageErrors.tickets}
              onRetryHistory={() => setStorageRetry(value => value + 1)}
              onTicketCreated={async ticket => { const saved = await appendDemoTicket(ticket); setDemoTickets(saved); }}
              onClearTickets={async () => { await persistDemoTickets([]); setDemoTickets([]); }}
              onBack={() => { setPaymentMethodsInCheckout(false); setSelectedService(null); }}
              onManagePaymentMethods={() => setPaymentMethodsInCheckout(true)}
            />;
      }
      if (selectedService.id === "accessibility") {
        return <AccessibilityBuildingsScreen onBack={() => setSelectedService(null)} />;
      }
      if (selectedService.id === "shelters") {
        return <SafetyMapScreen kind="shelters" onBack={() => setSelectedService(null)} />;
      }
      if (selectedService.id === "power-outages") {
        return <PowerOutagesScreen isDarkTheme={isDarkTheme} onBack={() => setSelectedService(null)} />;
      }
      if (selectedService.id === "resilience") {
        return <SafetyMapScreen kind="resilience" onBack={() => setSelectedService(null)} />;
      }
      if (selectedService.id === "parking") {
        return <ParkingDemoScreen dark={isDarkTheme} card={demoPaymentCard} onBack={() => setSelectedService(null)} />;
      }
      if (selectedService.id === "waste") return <WasteScreen dark={isDarkTheme} onBack={() => setSelectedService(null)} />;
      if (selectedService.id === "polls") {
        return <PollsScreen isDarkTheme={isDarkTheme} onBack={() => setSelectedService(null)} />;
      }
      if (selectedService.id === "miniatures") {
        return <MiniaturesScreen onBack={() => setSelectedService(null)} />;
      }
      return <CityServiceDetails service={selectedService} onBack={() => setSelectedService(null)} />;
    }
    if (activeTab === "feed") {
      return <NewsScreen onChangeTab={navigateToTab} onOpenArticle={(item) => openNewsArticle(item, "feed")} />;
    }
    if (activeTab === "profile") {
      if (profilePanel === "address") {
        return <AddressesScreen dark={isDarkTheme} onBack={() => setProfilePanel(null)} />;
      }
      if (profilePanel === "personal") {
        return <PersonalDetailsScreen dark={isDarkTheme} disabled={!preferencesReady} name={displayName} onSave={next => { preferencesRevision.current++; setDisplayName(next); }} onBack={() => setProfilePanel(null)} />;
      }
      if (profilePanel === "home-services") return <HomeServicesSettingsScreen dark={isDarkTheme} options={HOME_SERVICE_OPTIONS} selected={homeServiceIds} loadError={homeServicesError} onRetry={() => setHomeServicesRetry(value => value + 1)} onSave={saveHomeServices} onBack={closeProfilePanel} />;
      if (profilePanel === "settings" || profilePanel === "language") {
        return <ProfileSettingsScreen dark={isDarkTheme} controlsDisabled={!preferencesReady} onHomeServices={openHomeServicesSettings} language={language} theme={themeMode} storageNotice={Object.values(storageErrors).some(Boolean) ? <StorageRecoveryNotice dark={isDarkTheme} onRetry={() => setStorageRetry(value => value + 1)} /> : null} onLanguage={next => void changePreferences(next, notificationPreferences)} onTheme={next => { preferencesRevision.current++; setThemeMode(next); }} onNotifications={() => { setProfileReturn("settings"); setProfilePanel("notifications"); }} onLegal={() => { setProfileReturn("settings"); setProfilePanel("legal"); }} onAccount={() => { setProfileReturn("settings"); setProfilePanel("account"); }} onAbout={() => Alert.alert("Ужгород Цифровий", "Міський застосунок із перевіреними сервісами, розкладами та довідками. Дані показуємо лише з офіційних або вказаних джерел.")} onBack={closeProfilePanel} />;
      }
      if (profilePanel === "notifications") {
        return <NotificationSettingsScreen enabled={notificationPreferences} saving={savingPreferences} accountConnected={Boolean(account)} onChange={(next) => void changePreferences(language, next)} onBack={closeProfilePanel} />;
      }
      if (profilePanel === "account") {
        return <AccountScreen account={account} onAuthenticated={handleAuthenticated} onLogout={handleLogout} onDeleteAccount={handleDeleteAccount} onBack={closeProfilePanel} />;
      }
      if (profilePanel === "favorites") return <FavoritesScreen dark={isDarkTheme} signedIn={Boolean(account)} routeIds={favoriteRouteIds} stopIds={favoriteStopIds}
        onBack={() => setProfilePanel(null)} onSignIn={() => { setProfileReturn("favorites"); setProfilePanel("account"); }}
        onRoute={route => { setTransportFromFavorites(true); setActiveTab("profile"); setSection("transport"); void openRoute(route); }}
        onStop={stop => { setTransportFromFavorites(true); setActiveTab("profile"); setSection("transport"); void openStop(stop); }} />;
      if (profilePanel === "legal") {
        return <LegalScreen onBack={closeProfilePanel} />;
      }
      if (profilePanel === "payment-methods") {
        return <PaymentMethodsScreen
          accountEmail={account?.preferences.email}
          card={demoPaymentCard}
          storageNotice={storageErrors.card ? <StorageRecoveryNotice dark={isDarkTheme} onRetry={() => setStorageRetry(value => value + 1)} /> : null}
          isDarkTheme={isDarkTheme}
          onBack={() => setProfilePanel(null)}
          onSaveCard={setDemoPaymentCard}
          onRemoveCard={() => setDemoPaymentCard(null)}
        />;
      }
      return <ProfileOverviewScreen dark={isDarkTheme} name={displayName} email={account?.preferences.email} card={demoPaymentCard}
        ticketCount={demoTickets.length} favoriteCount={account ? favoriteRouteIds.length + favoriteStopIds.length : 0}
        onPersonal={() => setProfilePanel("personal")} onSettings={() => setProfilePanel("settings")} onAccount={() => setProfilePanel("account")}
        onAddresses={() => setProfilePanel("address")} onCards={() => setProfilePanel("payment-methods")}
        onTickets={() => openCityService("transport-payment", "history")} onAppointments={() => openCityService("cnap")}
        onPower={() => openCityService("power-outages")} onPolls={() => openCityService("polls")} onHomeServices={openHomeServicesSettings}
        onFavorites={() => setProfilePanel("favorites")} footer={<BottomNavigation activeTab="profile" onChangeTab={navigateToTab} />} />;
    }
    if (activeTab === "services") {
      return <CityServicesHub
      onOpenTransport={openTransportHub}
      onOpenService={setSelectedService}
      onChangeTab={navigateToTab}
      />;
    }
    return null;
  }

  if (loading) {
    return <LoadingScreen onBack={goBack} />;
  }

  if (error) {
    return <ErrorScreen message={error} onRetry={() => retryTransport.current()} onBack={goBack} />;
  }

  if (selectedRoute) {
    if (mapScreen) {
      return <RouteMapScreen mapScreen={mapScreen} onBack={goBack} />;
    }
    if (schedule) {
      return <ScheduleDetails
        schedule={schedule}
        onBack={goBack}
        onChangeDate={(date) => void openSchedule(schedule.route, schedule.stop, date)}
      />;
    }
    return <RouteDetails
      route={selectedRoute}
      map={routeMapPreview}
      favoriteStopIds={favoriteStopIds}
      onBack={goBack}
      onSelectStop={(stop) => void openSchedule(selectedRoute, stop)}
      onOpenMap={(variantId) => void openMap(selectedRoute, variantId)}
      onToggleFavoriteStop={(stopId) => void toggleFavorite("stop", stopId)}
    />;
  }

  if (selectedStop) {
    return <StopDetails
      stopScreen={selectedStop}
      isFavorite={favoriteStopIds.includes(selectedStop.stop.id)}
      onBack={goBack}
      onOpenRoute={(route) => void openRoute(route)}
      onToggleFavorite={() => void toggleFavorite("stop", selectedStop.stop.id)}
    />;
  }

  if (showDataSources) {
    return <DataSourcesScreen onBack={() => setShowDataSources(false)} />;
  }
  if (searchMode === "stops") return <TransportStopsScreen dark={isDarkTheme} stops={stops} loading={listLoading} onBack={() => { setQuery(""); setSearchMode("routes"); }} onOpenRoute={route => void openRoute(route)} />;

  const orderedRoutes = [...routes].sort((left, right) => Number(favoriteRouteIds.includes(right.id)) - Number(favoriteRouteIds.includes(left.id)));

  return (
    <SafeAreaView {...transportSwipeBack} bottomNavigation style={styles.transportScreen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.transportScrollContent} keyboardShouldPersistTaps="handled">
      <View style={styles.transportContent}>
        <InnerHeader title="Громадський транспорт" onBack={() => navigateToTab("services")} />
        <View style={styles.transportPageTitleRow}>
          <View style={styles.transportPageTitleCopy}>
            <Text style={styles.transportPageDescription}>Маршрути, зупинки та рух автобусів онлайн.</Text>
          </View>
          <View style={[styles.transportPlanMark, importStatus?.available && styles.transportPlanMarkAvailable]}>
            <Ionicons name={importStatus?.available ? "checkmark-circle" : "time-outline"} size={13} color={importStatus?.available ? COLORS.green : "#795000"} />
            <Text style={[styles.transportPlanMarkText, importStatus?.available && styles.transportPlanMarkTextAvailable]}>
              {importStatus?.available ? "Розклад діє" : "Планові дані"}
            </Text>
          </View>
        </View>
        <Pressable style={styles.transportDataMeta} onPress={() => setShowDataSources(true)}>
          <Ionicons name="information-circle-outline" size={15} color={COLORS.navy} />
          <Text style={styles.transportDataMetaText}>Джерело та оновлення розкладу{importStatus?.completedAt ? ` · ${formatUpdatedAt(importStatus.completedAt)}` : ""}</Text>
          <Ionicons name="chevron-forward" size={15} color={COLORS.navy} />
        </Pressable>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={20} color={COLORS.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={searchMode === "routes" ? "Знайти маршрут або зупинку" : "Назва зупинки"}
            placeholderTextColor={COLORS.muted}
            style={styles.searchInput}
          />
          <Ionicons name="options-outline" size={20} color={COLORS.navy} />
        </View>
        <View style={styles.searchModes}>
          <Pressable
            accessibilityLabel="Показати маршрути"
            accessibilityRole="radio"
            accessibilityState={{ selected: searchMode === "routes" }}
            style={[styles.searchMode, searchMode === "routes" && styles.searchModeActive]}
            onPress={() => setQuery("")}
          >
            <Text style={[styles.searchModeText, searchMode === "routes" && styles.searchModeTextActive]}>Маршрути</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Показати зупинки"
            accessibilityRole="radio"
            accessibilityState={{ selected: false }}
            style={styles.searchMode}
            onPress={() => { setQuery(""); setListLoading(true); setSearchMode("stops"); }}
          >
            <Text style={styles.searchModeText}>Зупинки</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.list}>
        {listLoading && <ActivityIndicator color={COLORS.navy} accessibilityLabel="Завантажуємо транспорт" />}
        <TransportCacheNotice value={routes} />
        <Text style={styles.transportListHeading}>{query ? "Результати пошуку" : searchMode === "routes" ? "Усі маршрути" : "Усі зупинки"}</Text>
        {!query && searchMode === "routes" && favoriteRouteIds.length > 0 ? <Text style={styles.transportSavedHint}>Обрані маршрути показано першими</Text> : null}
        {searchMode === "routes" ? orderedRoutes.map((item) => (
          <View key={item.id} style={styles.routeCard}>
            <Pressable accessibilityLabel={`Маршрут ${item.routeNumber}: ${item.name}`} accessibilityRole="button" style={styles.routeTapArea} onPress={() => void openRoute(item)}>
            <View style={styles.routeBadge}><Text style={styles.routeBadgeText}>{item.routeNumber}</Text></View>
            <View style={styles.routeCardCopy}><Text numberOfLines={2} style={styles.routeName}>{item.name}</Text><Text style={styles.routeCardMeta}>Схема зупинок і плановий розклад</Text></View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
            </Pressable>
            <FavoriteButton selected={favoriteRouteIds.includes(item.id)} onPress={() => void toggleFavorite("route", item.id)} />
          </View>
        )) : stops.map((item) => (
          <Pressable key={item.id} accessibilityLabel={`Зупинка: ${stopDisplayName(item.name)}`} accessibilityRole="button" style={styles.stopCard} onPress={() => void openStop(item)}>
            <View style={styles.stopCardText}><Text numberOfLines={2} style={styles.stopCardName}>{stopDisplayName(item.name)}</Text>{stopDisplayCode(item.name) ? <Text style={styles.stopCardAction}>Зупинка №{stopDisplayCode(item.name)}</Text> : null}</View>
            <FavoriteButton selected={favoriteStopIds.includes(item.id)} onPress={() => void toggleFavorite("stop", item.id)} />
            <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
          </Pressable>
        ))}
        {searchMode === "routes" && routes.length === 0 && !listLoading && <TransportEmptyState hasQuery={Boolean(query)} onReset={() => setQuery("")} onShowStops={() => { setQuery(""); setListLoading(true); setSearchMode("stops"); }} />}
      </View>
      </ScrollView>
      <BottomNavigation activeTab="services" onChangeTab={navigateToTab} />
    </SafeAreaView>
  );
  }
  const homeVisible = section === "hub" && activeTab === "home" && !selectedService && !selectedNewsArticle && !weatherOpen;
  return <AppThemeContext.Provider value={isDarkTheme}><ProfileIdentity.Provider value={{ dark: isDarkTheme }}><View style={{ flex: 1, backgroundColor: COLORS.mist }}>
    <ScreenStack frames={frames} render={renderScreen} backgroundColor={COLORS.mist} retainRoots />
  </View></ProfileIdentity.Provider></AppThemeContext.Provider>;
}

function CityServicesHub({
  onOpenTransport,
  onOpenService,
  onChangeTab,
}: {
  onOpenTransport: () => void;
  onOpenService: (service: CityService) => void;
  onChangeTab: (tab: RootTab) => void;
}) {
  return (
    <SafeAreaView bottomNavigation style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.hubContent}>
        <CivicHeader />
        <View style={styles.pageIntro}>
          <Text style={styles.pageTitle}>Сервіси</Text>
        </View>

        {SERVICE_CATEGORIES.map((category, index) => {
        // Preserve the map and editorial section, but do not advertise unverified operational points.
        const services = CITY_SERVICES.filter((service) => service.category === category.id && service.id !== "resilience" && service.id !== "playgrounds");
          return (
            <View key={category.id} style={index === 0 ? styles.serviceCategoryFirst : styles.serviceCategory}>
              <View style={styles.serviceGroupHeading}>
                <Text style={styles.serviceGroupTitle}>{category.title}</Text>
              </View>
              <View style={styles.serviceGrid}>
                {category.id === "mobility" ? <ServiceGridCard icon="bus-outline" title="Громадський транспорт" onPress={onOpenTransport} /> : null}
                {services.map((service) => <ServiceGridCard key={service.id} icon={service.icon} title={service.title} testScenario={service.testScenario} onPress={() => onOpenService(service)} />)}
              </View>
            </View>
          );
        })}
      </ScrollView>
      <BottomNavigation activeTab="services" onChangeTab={onChangeTab} />
    </SafeAreaView>
  );
}

function ServiceGridCard({ icon, title, testScenario = false, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; testScenario?: boolean; onPress: () => void }) {
  return <Pressable accessibilityLabel={`Відкрити сервіс: ${title}${testScenario ? ". Тестовий сценарій" : ""}`} accessibilityRole="button" style={styles.serviceGridCard} onPress={onPress}>
    <View style={styles.serviceGridIcon}><Ionicons name={icon} size={23} color={COLORS.navy} /></View>
    <View style={styles.serviceGridFooter}>
      <Text numberOfLines={2} style={styles.serviceGridTitle}>{title}</Text>
      <Ionicons name="arrow-forward" size={16} color={COLORS.navy} />
    </View>
    {testScenario && <Text style={styles.testScenarioLabel}>Тестовий сценарій</Text>}
  </Pressable>;
}

function HomeScreen({
  visible,
  homeServiceIds,
  homeServicesError,
  onRetryHomeServices,
  onConfigureServices,
  onOpenTransport,
  onOpenWeather,
  onOpenService,
  onOpenArticle,
  onChangeTab,
}: {
  visible: boolean;
  homeServiceIds: HomeServiceId[] | null;
  homeServicesError: boolean;
  onRetryHomeServices: () => void;
  onConfigureServices: () => void;
  onOpenTransport: () => void;
  onOpenWeather: () => void;
  onOpenService: (id: CityService["id"]) => void;
  onOpenArticle: (item: OfficialNewsItem) => void;
  onChangeTab: (tab: RootTab) => void;
}) {
  const [newsRefreshSignal, setNewsRefreshSignal] = useState(0);
  const [refreshingNews, setRefreshingNews] = useState(false);
  const [homeNow, setHomeNow] = useState(() => new Date());
  const lastHomeRefresh = useRef(Date.now());
  const pendingRefresh = useRef(new Set<string>());
  const finishRefresh = useCallback((key: string) => {
    pendingRefresh.current.delete(key);
    if (!pendingRefresh.current.size) setRefreshingNews(false);
  }, []);
  const finishNewsRefresh = useCallback(() => finishRefresh("news"), [finishRefresh]);
  const finishWeatherRefresh = useCallback(() => finishRefresh("weather"), [finishRefresh]);
  const finishCurrencyRefresh = useCallback(() => finishRefresh("currency"), [finishRefresh]);

  function refreshNews(silent = false) {
    if (pendingRefresh.current.size) return;
    lastHomeRefresh.current = Date.now();
    pendingRefresh.current = new Set(["news", "weather", "currency"]);
    if (!silent) setRefreshingNews(true);
    setNewsRefreshSignal((value) => value + 1);
  }

  useEffect(() => {
    if (!visible) return;
    const check = () => {
      if (AppState.currentState !== "active") return;
      setHomeNow(new Date());
      if (Date.now() - lastHomeRefresh.current >= 5 * 60_000) refreshNews(true);
    };
    check(); const timer = setInterval(check, 60_000);
    const listener = AppState.addEventListener("change", state => { if (state === "active") check(); });
    return () => { clearInterval(timer); listener.remove(); };
  }, [visible]);

  return (
    <SafeAreaView bottomNavigation style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.dashboardContent}
        refreshControl={<RefreshControl refreshing={refreshingNews} onRefresh={() => refreshNews()} tintColor={COLORS.navy} />}
      >
        <CivicHeader />
        <View style={styles.dashboardTop}>
          <View style={styles.dashboardDateCopy}>
            <Text style={styles.dashboardDay}>{formatDashboardDay(homeNow)}, {formatDashboardDate(homeNow)}</Text>
          </View>
          <View style={styles.dashboardCityChip}>
            <Ionicons name="location-outline" size={16} color={COLORS.navyDark} />
            <Text style={styles.dashboardCityText}>Ужгород</Text>
          </View>
        </View>

        <WeatherPreview visible={visible} refreshSignal={newsRefreshSignal} onLoadEnd={finishWeatherRefresh} onPress={onOpenWeather} onOpenShelters={() => onOpenService("shelters")} />
        <DefendersSupportBanner onPress={() => void openOfficialLink(FEATURED_DEFENDER_DONATION.donationUrl)} />

        <View style={styles.dashboardSectionRow}>
          <Text style={styles.dashboardSectionTitle}>Мої сервіси</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Налаштувати сервіси на головній" style={styles.smallAction} onPress={onConfigureServices}><Text style={styles.dashboardAllLink}>Налаштувати</Text></Pressable>
        </View>
        {homeServiceIds === null ? <View style={{ paddingVertical: 16, gap: 8 }}>
          <Text style={styles.dashboardInfoText}>{homeServicesError ? "Не вдалося прочитати вибір сервісів." : "Завантажуємо ваш вибір…"}</Text>
          {homeServicesError && <Pressable accessibilityRole="button" style={styles.smallAction} onPress={onRetryHomeServices}><Text style={styles.dashboardAllLink}>Повторити</Text></Pressable>}
        </View> : homeServiceIds.length === 0 ? <Text style={[styles.dashboardInfoText, { paddingVertical: 16 }]}>Оберіть сервіси через кнопку «Налаштувати».</Text> :
          <View style={styles.dashboardServicesGrid}>
            {homeServiceIds.map(id => {
              const option = HOME_SERVICE_OPTIONS.find(item => item.id === id)!;
              return <DashboardServiceCard key={id} icon={option.icon} title={option.title} testScenario={option.testScenario}
                onPress={id === "transport" ? onOpenTransport : () => onOpenService(id)} />;
            })}
          </View>}

        <CurrencyWidget refreshSignal={newsRefreshSignal} onLoadEnd={finishCurrencyRefresh} />

        <View style={styles.dashboardSectionRow}>
          <Text style={styles.dashboardSectionTitle}>Останні новини</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Усі новини" style={styles.smallAction} onPress={() => onChangeTab("feed")}><Text style={styles.dashboardAllLink}>Усі</Text></Pressable>
        </View>
        <OfficialNewsPreview
          refreshSignal={newsRefreshSignal}
          onLoadEnd={finishNewsRefresh}
          onOpenFeed={() => onChangeTab("feed")}
          onOpenArticle={onOpenArticle}
        />


      </ScrollView>
      <BottomNavigation activeTab="home" onChangeTab={onChangeTab} />
    </SafeAreaView>
  );
}

function DefendersSupportBanner({ onPress }: { onPress: () => void }) {
  return <Pressable
    accessibilityHint="Відкриває постійну Банку mono"
    accessibilityLabel="Підтримати захисників Закарпаття"
    onPress={onPress}
    style={styles.defendersBanner}
  >
    <View style={styles.defendersBannerIcon}><Ionicons name="heart" size={19} color={COLORS.gold} /></View>
    <View style={styles.defendersBannerCopy}>
      <Text style={styles.defendersBannerTitle}>Підтримати військо</Text>
      <Text style={styles.defendersBannerText}>Банка Руху підтримки закарпатських військових</Text>
    </View>
    <Ionicons name="open-outline" size={18} color={COLORS.navy} />
  </Pressable>;
}

function DefendersSupportScreen({ onBack }: { onBack: () => void }) {
  const swipeBack = useSwipeBack(onBack);
  const [funds, setFunds] = useState<DefenderFund[]>(DEFENDER_FUNDS);

  useEffect(() => {
    void getEditorialDefenderFunds().then((editorial) => {
      setFunds(editorial.items);
    }).catch(() => {
      // The permanent mono jar and a safe empty list remain visible until the API is deployed.
    });
  }, []);

  return (
    <SafeAreaView {...swipeBack} style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.defendersContent}>
        <InnerHeader title="Підтримка захисників" onBack={onBack} />

        <View style={styles.featuredDonationCard}>
          <View style={styles.featuredDonationTop}>
            <View style={styles.featuredDonationIcon}><Ionicons name="heart" size={20} color="#f7be3d" /></View>
            <View style={styles.featuredDonationCopy}>
              <Text style={styles.featuredDonationLabel}>ПОСТІЙНА БАНКА MONO</Text>
              <Text style={styles.featuredDonationTitle}>{FEATURED_DEFENDER_DONATION.title}</Text>
            </View>
          </View>
          <Text style={styles.featuredDonationText}>{FEATURED_DEFENDER_DONATION.note}</Text>
          <Pressable style={styles.featuredDonationButton} onPress={() => void openOfficialLink(FEATURED_DEFENDER_DONATION.donationUrl)}>
            <Ionicons name="heart-outline" size={18} color={COLORS.navyDark} />
            <Text style={styles.featuredDonationButtonText}>Відкрити Банку</Text>
            <Ionicons name="open-outline" size={16} color={COLORS.navyDark} />
          </Pressable>
        </View>

        {funds.length > 0 ? <View style={styles.defendersFundList}>
          <Text style={styles.defendersListTitle}>Перевірені збори</Text>
          {funds.map((fund) => <View key={fund.id} style={styles.defendersFundCard}>
            <View style={styles.defendersFundTop}>
              <View style={styles.defendersFundIcon}><Ionicons name="flag-outline" size={20} color={COLORS.navy} /></View>
              <View style={styles.defendersFundCopy}>
                <Text style={styles.defendersFundTitle}>{fund.title}</Text>
                <Text style={styles.defendersFundVerified}>Перевірено: {formatDateOnly(fund.verifiedAt)}</Text>
              </View>
            </View>
            <Text style={styles.defendersFundDescription}>{fund.description}</Text>
            <Text style={styles.defendersFundSource}>Підтвердження: {fund.verificationSource}</Text>
            <Pressable style={styles.defendersDonateButton} onPress={() => void openOfficialLink(fund.donationUrl)}>
              <Ionicons name="heart-outline" size={18} color="#ffffff" />
              <Text style={styles.defendersDonateButtonText}>Перейти до донату</Text>
              <Ionicons name="open-outline" size={16} color="#ffffff" />
            </Pressable>
          </View>)}
        </View> : <Text style={styles.defendersFootnote}>Нові збори додаватимемо після перевірки джерела, мети й актуальності посилання.</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

function DashboardServiceCard({ icon, title, testScenario = false, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; testScenario?: boolean; onPress: () => void }) {
  return <Pressable accessibilityLabel={`Відкрити сервіс: ${title}${testScenario ? ". Тестовий сценарій" : ""}`} accessibilityRole="button" style={[styles.serviceGridCard, styles.dashboardServiceCard]} onPress={onPress}>
    <View style={styles.dashboardServiceBody}>
      <View style={[styles.serviceGridIcon, styles.dashboardServiceIcon]}><Ionicons name={icon} size={20} color={COLORS.navy} /></View>
      <Text style={[styles.serviceGridTitle, styles.dashboardServiceTitle]}>{title}</Text>
    </View>
    {testScenario && <Text style={[styles.testScenarioLabel, styles.dashboardServiceTestLabel]}>Тестовий сценарій</Text>}
  </Pressable>;
}

function OfficialNewsPreview({ refreshSignal, onLoadEnd, onOpenFeed, onOpenArticle }: { refreshSignal: number; onLoadEnd: () => void; onOpenFeed: () => void; onOpenArticle: (item: OfficialNewsItem) => void }) {
  const [data, setData] = useState<OfficialNewsList | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void getOfficialNews(refreshSignal > 0).then((result) => { if (active) setData(result); }).catch(() => {
      if (active) setData((previous) => previous ? { ...previous, stale: true } : null);
    }).finally(() => {
      if (active) { setLoading(false); onLoadEnd(); }
    });
    return () => { active = false; };
  }, [onLoadEnd, refreshSignal]);

  if (loading && !data) {
    return <View style={styles.dashboardFeedCard}><ActivityIndicator color={COLORS.navy} /><Text style={styles.dashboardFeedText}>Завантажуємо офіційні новини…</Text></View>;
  }

  if (!data?.items.length) {
    return <Pressable style={styles.dashboardFeedCard} onPress={onOpenFeed}>
      <View style={styles.dashboardFeedIcon}><Ionicons name="megaphone-outline" size={22} color={COLORS.navy} /></View>
      <View style={styles.dashboardFeedCopy}>
        <Text style={styles.dashboardFeedTitle}>Новини міста</Text>
        <Text style={styles.dashboardFeedText}>Офіційна стрічка тимчасово недоступна.</Text>
      </View>
      <Ionicons name="chevron-forward" size={19} color={COLORS.muted} />
    </Pressable>;
  }

  return <View style={styles.homeNewsList}>
    {data.stale ? <Text style={styles.staleData}>Збережені новини · оновлено {formatUpdatedAt(data.fetchedAt)}</Text> : null}
    {data.items.slice(0, 3).map((item) => <Pressable key={item.sourceUrl} style={styles.homeNewsItem} onPress={() => onOpenArticle(item)}>
      <View style={styles.homeNewsCopy}>
        <Text numberOfLines={2} style={styles.homeNewsTitle}>{item.title}</Text>
        {item.publishedLabel ? <Text style={styles.homeNewsMeta}>{newsDateLabel(item.publishedLabel)}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
    </Pressable>)}
    <Pressable style={styles.homeNewsAllButton} onPress={onOpenFeed}>
      <Text style={styles.homeNewsAllText}>Вся стрічка новин</Text>
      <Ionicons name="arrow-forward" size={16} color={COLORS.navy} />
    </Pressable>
  </View>;
}

function CurrencyWidget({ refreshSignal, onLoadEnd }: { refreshSignal: number; onLoadEnd: () => void }) {
  const [data, setData] = useState<CurrencyRates | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void getCurrencyRates().then((result) => { if (active) setData(result); }).catch(() => {
      if (active) setData((previous) => previous ? { ...previous, stale: true } : null);
    }).finally(() => { if (active) { setLoading(false); onLoadEnd(); } });
    return () => { active = false; };
  }, [refreshSignal, onLoadEnd]);

  const rates = data?.rates ?? [];
  const mainRates = rates.slice(0, 4);
  return (
    <View style={styles.currencyWidget}>
      <View style={styles.currencyWidgetHeading}>
        <View style={styles.currencyWidgetTitleRow}>
          <Ionicons name="cash-outline" size={19} color={COLORS.navy} />
          <Text style={styles.currencyWidgetTitle}>Курс валют</Text>
        </View>
        <Text style={styles.currencyWidgetSource}>Monobank</Text>
      </View>
      {mainRates.length > 0 ? <View style={styles.currencyRatesRow}>
        {mainRates.map((rate) => <View key={rate.code} style={styles.currencyRate}>
          <Text style={styles.currencyCode}>{rate.code}</Text>
          <Text style={styles.currencyValue}>{formatCurrency(rate.sell)}</Text>
          <Text style={styles.currencyMeta}>{rate.reference ? "довідковий" : "продаж"}</Text>
        </View>)}
      </View> : <Text style={styles.currencyUnavailable}>{loading ? "Завантажуємо курси…" : "Курси зараз недоступні"}</Text>}
      {data?.stale ? <Text style={styles.currencyStale}>Збережений курс · {formatUpdatedAt(data.fetchedAt)}</Text> : null}
    </View>
  );
}

function WeatherPreview({ visible, refreshSignal, onLoadEnd, onPress, onOpenShelters }: { visible: boolean; refreshSignal: number; onLoadEnd: () => void; onPress: () => void; onOpenShelters: () => void }) {
  const dark = useContext(AppThemeContext) ?? false; const s = civicStyles(dark);
  const [alertOpen, setAlertOpen] = useState(false);
  const compact = useWindowDimensions().width < 360;
  const [data, setData] = useState<Weather | null>(null);
  const [alert, setAlert] = useState<AirAlertStatus | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!visible) return;
    let active = true;
    let checkingAlert = false;
    setWeatherLoading(true);
    async function loadAlert() {
      if (!active || checkingAlert || AppState.currentState !== "active") return;
      checkingAlert = true;
      try { const result = await getAirAlertStatus(); if (active) { setAlert(result); setNow(Date.now()); } }
      catch { if (active) setAlert(null); }
      finally { checkingAlert = false; }
    }
    const weatherRequest = getWeather().then((result) => { if (active) setData(result); }).catch(() => {
      if (active) setData((previous) => previous ? { ...previous, stale: true } : null);
    }).finally(() => { if (active) setWeatherLoading(false); });
    void Promise.all([weatherRequest, loadAlert()]).finally(() => { if (active) onLoadEnd(); });
    const timer = setInterval(() => { setNow(Date.now()); void loadAlert(); }, 30_000);
    const subscription = AppState.addEventListener("change", (state) => {
      setNow(Date.now());
      if (state === "active") void loadAlert();
      else setAlert(null);
    });
    return () => { active = false; clearInterval(timer); subscription.remove(); };
  }, [visible, refreshSignal, onLoadEnd]);

  const airQuality = data?.current.airQuality;
  const alertState = isFreshSnapshot(alert, now) ? alert?.state : "UNAVAILABLE";
  const alertIsActive = alertState === "ACTIVE";
  return <><View style={styles.weatherFeatureCard}>
    <Pressable accessibilityRole="button" accessibilityLabel="Погода та якість повітря" onPress={onPress} style={styles.weatherFeatureInfo}>
      <View style={styles.weatherFeatureMain}>
        <Text style={styles.weatherFeatureLabel}>Погода</Text>
        <View style={styles.weatherFeatureTemperatureRow}>
          <Text style={[styles.weatherFeatureTemperature, compact && styles.weatherFeatureTemperatureCompact]}>{data ? `${Math.round(data.current.temperatureC)}°` : "—"}</Text>
          {data ? <Image source={{ uri: data.current.iconUrl }} style={[styles.weatherFeatureIcon, compact && styles.weatherFeatureIconCompact]} /> : <Ionicons name="partly-sunny-outline" size={compact ? 26 : 31} color={COLORS.navy} />}
        </View>
        <Text style={styles.weatherFeatureCondition}>{data ? data.stale ? "Збережений прогноз" : data.current.condition : weatherLoading ? "Оновлюємо дані" : "Погода недоступна"}</Text>
      </View>
      <View style={styles.weatherFeatureAir}>
        <Ionicons name="leaf-outline" size={18} color={COLORS.green} />
        <Text style={styles.weatherFeatureAirLabel}>Якість повітря</Text>
        <Text style={styles.weatherFeatureAirValue}>{airQuality ? airQualityLabel(airQuality.index) : weatherLoading ? "Оновлюємо" : "Немає даних"}</Text>
        <Text style={styles.weatherFeatureAirMeta}>{airQuality ? `PM2.5 ${Math.round(airQuality.pm25)}` : ""}</Text>
      </View>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityHint="Статус тривоги та укриття" onPress={() => setAlertOpen(true)} accessibilityLabel={translate(alertIsActive ? "Повітряна тривога" : alertState === "CLEAR" ? "Повітряної тривоги немає" : "Актуальний статус тривоги недоступний. Перевірте офіційні повідомлення.")} style={[styles.weatherFeatureAlert, compact && styles.weatherFeatureAlertCompact, alertIsActive ? styles.weatherFeatureAlertActive : alertState === "CLEAR" ? styles.weatherFeatureAlertClear : styles.weatherFeatureAlertUnknown]}>
        <Ionicons name={alertIsActive ? "warning-outline" : alertState === "CLEAR" ? "shield-checkmark-outline" : "help-circle-outline"} size={20} color={alertIsActive ? COLORS.danger : alertState === "CLEAR" ? COLORS.green : styles.weatherFeatureAlertTextUnknown.color} />
      <Text style={[styles.weatherFeatureAlertText, alertIsActive ? styles.weatherFeatureAlertTextActive : alertState !== "CLEAR" && styles.weatherFeatureAlertTextUnknown]}>{alertIsActive ? "Тривога" : alertState === "CLEAR" ? "Тривоги\nнемає" : "Статус\nневідомий"}</Text>
    </Pressable>
  </View><ServiceSheet dark={dark} visible={alertOpen && visible} onClose={() => setAlertOpen(false)}><Text style={s.title}>{alertIsActive ? "Повітряна тривога" : alertState === "CLEAR" ? "Повітряної тривоги немає" : "Статус тривоги невідомий"}</Text><Text style={s.body}>{alertState === "UNAVAILABLE" ? "Актуальний статус тривоги недоступний. Перевірте офіційні повідомлення." : alert?.detail}</Text>{alertState !== "UNAVAILABLE" && alert && <Text style={s.muted}>Оновлено: {formatUpdatedAt(alert.fetchedAt)}</Text>}<PrimaryButton dark={dark} title="Відкрити укриття" onPress={() => { setAlertOpen(false); onOpenShelters(); }} /></ServiceSheet></>;
}

function WeatherScreen({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<Weather | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const swipeBack = useSwipeBack(onBack);

  useEffect(() => {
    void loadWeather();
  }, []);

  async function loadWeather() {
    setLoading(true);
    setError(null);
    try {
      setData(await getWeather());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Невідома помилка");
    } finally {
      setLoading(false);
    }
  }

  const day = data?.days[selectedDay];
  return <SafeAreaView {...swipeBack} style={styles.screen}>
    <StatusBar style="dark" />
    <ScrollView contentContainerStyle={styles.weatherContent}>
      <InnerHeader title="Погода в Ужгороді" onBack={onBack} />
      {loading ? <ActivityIndicator style={styles.inlineLoader} color={COLORS.navy} /> : null}
      {error ? <View style={styles.inlineError}>
        <Text style={styles.inlineErrorText}>{error}</Text>
        <Pressable onPress={() => void loadWeather()}><Text style={styles.inlineRetry}>Спробувати ще раз</Text></Pressable>
      </View> : null}
      {data ? <>
        <View style={styles.weatherHero}>
          <View style={styles.weatherHeroTop}>
            <View>
              <Text style={styles.weatherHeroTemperature}>{Math.round(data.current.temperatureC)}°</Text>
              <Text style={styles.weatherHeroCondition}>{data.current.condition}</Text>
            </View>
            <Image source={{ uri: data.current.iconUrl }} style={styles.weatherHeroIcon} />
          </View>
          <View style={styles.weatherMetrics}>
            <WeatherMetric icon="thermometer-outline" label="Відчувається" value={`${Math.round(data.current.feelsLikeC)}°`} />
            <WeatherMetric icon="water-outline" label="Вологість" value={`${data.current.humidity}%`} />
            <WeatherMetric icon="flag-outline" label="Вітер" value={`${Math.round(data.current.windKph)} км/год`} />
          </View>
        </View>
        {data.current.airQuality && <View style={styles.weatherAirQualityCard}>
          <View style={styles.weatherAirQualityIcon}><Ionicons name="leaf-outline" size={21} color={COLORS.green} /></View>
          <View style={styles.weatherAirQualityCopy}>
            <Text style={styles.weatherAirQualityLabel}>Якість повітря</Text>
            <Text style={styles.weatherAirQualityValue}>{airQualityLabel(data.current.airQuality.index)}</Text>
          </View>
          <Text style={styles.weatherAirQualityMeta}>PM2.5 {Math.round(data.current.airQuality.pm25)}{`\n`}PM10 {Math.round(data.current.airQuality.pm10)}</Text>
        </View>}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weatherDayTabs}>
          {data.days.map((item, index) => <Pressable key={item.date} onPress={() => setSelectedDay(index)} style={[styles.weatherDayTab, selectedDay === index && styles.weatherDayTabActive]}>
            <Text style={[styles.weatherDayTabText, selectedDay === index && styles.weatherDayTabTextActive]}>{formatWeatherDay(item.date, index)}</Text>
            <Text style={[styles.weatherDayTabTemperature, selectedDay === index && styles.weatherDayTabTextActive]}>{Math.round(item.minTemperatureC)}° · {Math.round(item.maxTemperatureC)}°</Text>
          </Pressable>)}
        </ScrollView>

        {day ? <>
          <View style={styles.weatherDaySummary}>
            <View><Text style={styles.weatherDaySummaryTitle}>{day.condition}</Text><Text style={styles.weatherDaySummaryText}>Опади: {day.chanceOfRain}%</Text></View>
            <View style={styles.weatherSunTimes}><Text style={styles.weatherSunTime}>↑ {day.sunrise}</Text><Text style={styles.weatherSunTime}>↓ {day.sunset}</Text></View>
          </View>
          <Text style={styles.weatherSectionTitle}>Погодинно</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weatherHours}>
            {day.hours.map((hour) => <View key={hour.time} style={styles.weatherHourCard}>
              <Text style={styles.weatherHourTime}>{formatWeatherHour(hour.time)}</Text>
              <Image source={{ uri: hour.iconUrl }} style={styles.weatherHourIcon} />
              <Text style={styles.weatherHourTemperature}>{Math.round(hour.temperatureC)}°</Text>
              <Text style={styles.weatherHourRain}>{hour.chanceOfRain}%</Text>
            </View>)}
          </ScrollView>
        </> : null}
        <Text style={styles.weatherSource}>Дані про погоду: WeatherAPI.com · оновлено {formatUpdatedAt(data.fetchedAt)}</Text>
        {data.stale ? <Text style={styles.weatherStale}>Показано останнє доступне оновлення.</Text> : null}
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}

function WeatherMetric({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return <View style={styles.weatherMetric}><Ionicons name={icon} size={16} color="#d3e4ff" /><Text style={styles.weatherMetricLabel}>{label}</Text><Text style={styles.weatherMetricValue}>{value}</Text></View>;
}

function NewsScreen({ onChangeTab, onOpenArticle }: { onChangeTab: (tab: RootTab) => void; onOpenArticle: (item: OfficialNewsItem) => void }) {
  const active = useScreenActive();
  const [data, setData] = useState<OfficialNewsList | null>(null);
  const [alertEvents, setAlertEvents] = useState<AirAlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);
  const newsRequest = useRef(new LatestRequest()).current;
  const eventsRequest = useRef(new LatestRequest()).current;

  useEffect(() => {
    if (!active) return;
    if (!data) void loadNews();
    void loadAlertEvents();
    const timer = setInterval(() => { if (AppState.currentState === "active") void loadAlertEvents(); }, 30_000);
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") void loadAlertEvents(); });
    return () => { clearInterval(timer); subscription.remove(); newsRequest.invalidate(); eventsRequest.invalidate(); };
  }, [active]);

  async function loadNews(forceRefresh = false) {
    const revision = newsRequest.begin();
    setLoading(true);
    setError(null);
    try {
      const news = await getOfficialNews(forceRefresh);
      if (newsRequest.isCurrent(revision)) setData(news);
    } catch (requestError) {
      if (!newsRequest.isCurrent(revision)) return;
      setData((previous) => previous ? { ...previous, stale: true } : null);
      setError(requestError instanceof Error ? requestError.message : "Невідома помилка");
    } finally {
      if (newsRequest.isCurrent(revision)) setLoading(false);
    }
  }

  async function loadAlertEvents() {
    const revision = eventsRequest.begin();
    try {
      const events = (await getAirAlertEvents()).events;
      if (eventsRequest.isCurrent(revision)) setAlertEvents(events);
    } catch {
      // Preserve already loaded historical events; they are not a current alert status.
    }
  }

  const feedGroups = groupFeedEntriesByDay(data?.items.slice(0, visibleCount) ?? [], alertEvents);

  return (
    <SafeAreaView bottomNavigation style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.simpleTabContent} refreshControl={<RefreshControl refreshing={loading && Boolean(data)} onRefresh={() => { void loadNews(true); void loadAlertEvents(); }} tintColor={COLORS.navy} />}>
        <CivicHeader />
        <View style={styles.pageIntro}>
          <Text style={styles.pageTitle}>Стрічка</Text>
        </View>
        <Pressable style={styles.newsSourceLine} onPress={() => void openOfficialLink("https://rada-uzhgorod.gov.ua/")}>
          <Ionicons name="megaphone-outline" size={18} color={COLORS.navy} />
          <Text style={styles.newsSourceLineText}>Новини: Ужгородська міська рада</Text>
          <Ionicons name="open-outline" size={16} color={COLORS.navy} />
        </Pressable>
        {loading && <ActivityIndicator style={styles.inlineLoader} color="#123a63" />}
        {error && (
          <View style={styles.inlineError}>
            <Text style={styles.inlineErrorText}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => void loadNews(true)}>
              <Text style={styles.inlineRetry}>Спробувати ще раз</Text>
            </Pressable>
          </View>
        )}
        {data?.stale && <Text style={styles.staleData}>Показуємо збережену версію стрічки — перевіряємо оновлення.</Text>}
        {feedGroups.map(([day, entries]) => <View key={day} style={styles.newsDayGroup}>
          {day !== "__undated__" ? <Text style={styles.newsDayHeading}>{entries[0].dayLabel}</Text> : null}
          {entries.map((entry) => entry.kind === "alert" ? <View key={entry.key} style={styles.alertEventCard}>
            <View style={styles.alertEventIcon}><Ionicons name={entry.event.state === "ACTIVE" ? "warning-outline" : "checkmark-circle-outline"} size={19} color={entry.event.state === "ACTIVE" ? COLORS.danger : COLORS.green} /></View>
            <View style={styles.alertEventCopy}><Text style={styles.alertEventTitle}>{entry.event.title}</Text><Text style={styles.alertEventText}>{entry.event.detail}</Text></View>
            <Text style={styles.alertEventTime}>{formatAlertEventTime(entry.event.occurredAt)}</Text>
          </View> : <Pressable key={entry.key} style={styles.newsArticleCard} onPress={() => onOpenArticle(entry.item)}>
            <View style={styles.newsArticleCopy}>
              <Text numberOfLines={3} style={styles.newsArticleTitle}>{entry.item.title}</Text>
              {day === "__undated__" ? <Text style={styles.newsArticleDate}>Новина міськради</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
          </Pressable>)}
        </View>)}
        {!loading && !error && feedGroups.length === 0 && <Text style={styles.empty}>Оновлень поки немає.</Text>}
        {data && data.items.length > visibleCount ? <Pressable accessibilityRole="button" style={styles.newsMoreLink} onPress={() => setVisibleCount((count) => count + 10)}>
          <Text style={styles.newsMoreLinkText}>Показати ще новини</Text>
          <Ionicons name="chevron-down" size={16} color={COLORS.navy} />
        </Pressable> : null}
      </ScrollView>
      <BottomNavigation activeTab="feed" onChangeTab={onChangeTab} />
    </SafeAreaView>
  );
}


function PaymentMethodsScreen({ card, isDarkTheme, onBack, onSaveCard, onRemoveCard, storageNotice }: {
  accountEmail?: string; card: DemoPaymentCard | null; isDarkTheme: boolean; backLabel?: string;
  onBack: () => void; onSaveCard: (card: DemoPaymentCard) => void | Promise<void>; onRemoveCard: () => void | Promise<void>; storageNotice?: ReactNode;
}) {
  return <DemoCardScreen dark={isDarkTheme} card={card} onBack={onBack} onSave={onSaveCard} onRemove={onRemoveCard} storageNotice={storageNotice} />;
}

function AccountScreen({ account, onAuthenticated, onLogout, onDeleteAccount, onBack }: {
  account: AccountSession | null;
  onAuthenticated: (account: AccountSession) => void | Promise<void>;
  onLogout: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  onBack: () => void;
}) {
  const dark = useContext(ProfileIdentity).dark;
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const actionLocked = useRef(false);
  const swipeBack = useSwipeBack(onBack);

  async function submit() {
    if (actionLocked.current) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim()) || password.length < 10) {
      setError("Вкажіть коректну пошту та пароль від 10 символів.");
      return;
    }
    if (mode === "register" && password !== passwordRepeat) {
      setError("Паролі не збігаються. Повторіть пароль ще раз.");
      return;
    }
    actionLocked.current = true;
    setSubmitting(true); setError(null);
    try {
      await onAuthenticated(await (mode === "register" ? registerAccount(email, password) : loginAccount(email, password)));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не вдалося виконати дію.");
    } finally { actionLocked.current = false; setSubmitting(false); }
  }

  async function updatePassword() {
    if (actionLocked.current) return;
    if (!account || currentPassword.length < 10 || newPassword.length < 10) {
      setError("Вкажіть поточний та новий пароль щонайменше з 10 символів.");
      return;
    }
    actionLocked.current = true;
    setSubmitting(true); setError(null);
    try {
      await onAuthenticated(await changeAccountPassword(account.accessToken, currentPassword, newPassword));
      setCurrentPassword(""); setNewPassword(""); setShowPasswordForm(false);
      Alert.alert("Пароль змінено", "Сесію оновлено для захисту акаунта.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не вдалося змінити пароль.");
    } finally { actionLocked.current = false; setSubmitting(false); }
  }

  async function runAccountAction(action: () => Promise<void>) {
    if (actionLocked.current) return;
    actionLocked.current = true; setSubmitting(true);
    try { await action(); }
    finally { actionLocked.current = false; setSubmitting(false); }
  }

  function confirmDelete() {
    Alert.alert("Видалити акаунт?", "Цю дію не можна скасувати: буде видалено налаштування й обране.", [
      { text: "Скасувати", style: "cancel" },
      { text: "Видалити", style: "destructive", onPress: () => void runAccountAction(onDeleteAccount) },
    ]);
  }

  return <SafeAreaView {...swipeBack} style={styles.screen}>
    <StatusBar style="dark" />
    <ServiceHeader dark={dark} title={account ? "Ваш акаунт" : "Акаунт"} onBack={onBack} />
    <ScrollView contentContainerStyle={styles.settingsContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
      <View style={styles.accountIntro}>
        <Text style={[styles.pageTitle, { fontSize: 24 }]}>{account ? "Акаунт підключено" : mode === "login" ? "З поверненням" : "Створити акаунт"}</Text>
        {account ? <Text style={styles.accountIntroText}>{account.preferences.email}</Text> : null}
      </View>
      {!account && <View style={styles.accountForm}>
        <View style={styles.accountModeRow}><View style={{ flex: 1 }}><SegmentedChoice dark={dark} value={mode} options={[{ value: "login", label: "Вхід" }, { value: "register", label: "Реєстрація" }]} onChange={next => { if (!submitting) { setMode(next); setError(null); } }} /></View></View>
        <Text style={styles.paymentFieldLabel}>Електронна пошта</Text>
        <TextInput accessibilityLabel="Електронна пошта" autoCapitalize="none" autoCorrect={false} autoComplete="email" keyboardType="email-address" editable={!submitting} onChangeText={(value) => { setEmail(value); setError(null); }} placeholder="name@example.com" placeholderTextColor={COLORS.muted} value={email} style={styles.paymentCardInput} />
        <Text style={[styles.paymentFieldLabel, styles.accountPasswordLabel]}>Пароль</Text>
        <TextInput accessibilityLabel="Пароль" autoCapitalize="none" autoCorrect={false} editable={!submitting} maxLength={128} onChangeText={(value) => { setPassword(value); setError(null); }} placeholder="Щонайменше 10 символів" placeholderTextColor={COLORS.muted} secureTextEntry value={password} style={styles.paymentCardInput} />
        {mode === "register" ? <>
          <Text style={[styles.paymentFieldLabel, styles.accountPasswordLabel]}>Повторіть пароль</Text>
          <TextInput accessibilityLabel="Повторіть пароль" autoCapitalize="none" autoCorrect={false} editable={!submitting} maxLength={128} onChangeText={(value) => { setPasswordRepeat(value); setError(null); }} placeholder="Введіть пароль ще раз" placeholderTextColor={COLORS.muted} secureTextEntry value={passwordRepeat} style={styles.paymentCardInput} />
        </> : null}
        {error ? <Text accessibilityRole="alert" style={styles.accountError}>{error}</Text> : null}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: submitting, busy: submitting }} disabled={submitting} style={styles.paymentSubmitButton} onPress={() => void submit()}>
          {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.paymentSubmitText}>{mode === "register" ? "Створити акаунт" : "Увійти"}</Text>}
        </Pressable>
      </View>}
      {!account && <Text style={styles.accountFootnote}>Пароль не зберігається у відкритому вигляді.</Text>}
      {account && <View style={styles.accountForm}>
        <Text style={styles.settingsPageDescription}>У цьому розділі можна керувати доступом до своїх збережених налаштувань і обраного.</Text>
        {showPasswordForm ? <>
          <Text style={styles.paymentFieldLabel}>Поточний пароль</Text>
          <TextInput accessibilityLabel="Поточний пароль" onChangeText={setCurrentPassword} placeholder="Ваш поточний пароль" placeholderTextColor={COLORS.muted} secureTextEntry value={currentPassword} style={styles.paymentCardInput} />
          <Text style={[styles.paymentFieldLabel, styles.accountPasswordLabel]}>Новий пароль</Text>
          <TextInput accessibilityLabel="Новий пароль" onChangeText={setNewPassword} placeholder="Щонайменше 10 символів" placeholderTextColor={COLORS.muted} secureTextEntry value={newPassword} style={styles.paymentCardInput} />
          {error ? <Text style={styles.accountError}>{error}</Text> : null}
          <Pressable disabled={submitting} style={styles.paymentSubmitButton} onPress={() => void updatePassword()}>
            {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.paymentSubmitText}>Змінити пароль</Text>}
          </Pressable>
        </> : <Pressable accessibilityRole="button" style={styles.accountActionButton} onPress={() => { setError(null); setShowPasswordForm(true); }}><Ionicons name="key-outline" size={19} color={COLORS.navy} /><Text style={styles.accountActionText}>Змінити пароль</Text></Pressable>}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: submitting }} disabled={submitting} style={styles.accountActionButton} onPress={() => void runAccountAction(onLogout)}><Ionicons name="log-out-outline" size={19} color={COLORS.navy} /><Text style={styles.accountActionText}>Вийти з усіх пристроїв</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: submitting }} disabled={submitting} style={styles.accountDeleteButton} onPress={confirmDelete}><Ionicons name="trash-outline" size={19} color={COLORS.danger} /><Text style={styles.accountDeleteText}>Видалити акаунт і дані</Text></Pressable>
        {submitting && !showPasswordForm ? <ActivityIndicator color={COLORS.navy} style={styles.inlineLoader} /> : null}
      </View>}
    </ScrollView>
  </SafeAreaView>;
}

function LegalScreen({ onBack }: { onBack: () => void }) {
  const swipeBack = useSwipeBack(onBack);
  return <SafeAreaView {...swipeBack} style={styles.screen}>
    <StatusBar style="dark" />
    <ScrollView contentContainerStyle={styles.settingsContent}>
      <InnerHeader title="Правила та приватність" onBack={onBack} />
      <Text style={styles.settingsPageDescription}>Як зберігаються ваші дані та що варто знати про сервіси.</Text>

      <View style={styles.legalCard}>
        <View style={styles.legalCardHeading}><Ionicons name="shield-checkmark-outline" size={20} color={COLORS.navy} /><Text style={styles.legalCardTitle}>Приватність</Text></View>
        <Text style={styles.legalCardText}>Акаунт зберігає пошту, захищений пароль, налаштування та обране. Тестові записи, голос, квитки та історія паркування залишаються на пристрої. Для макета картки можна вводити лише тестові реквізити; повний номер, строк дії та CVV не зберігаються.</Text>
        <Text style={styles.legalCardText}>Видалити акаунт і пов’язані з ним дані можна в розділі «Акаунт».</Text>
        <Text style={styles.legalCardText}>Збережені адреси та ім’я зберігаються лише на пристрої. Адреси можна змінити або видалити в розділі «Мої адреси». Під час перевірки світла місто, вулиця та будинок передаються нашому серверу; оператор отримує запит за містом і вулицею, без пошти, квартири чи особового рахунку.</Text>
      </View>

      <View style={styles.legalCard}>
        <View style={styles.legalCardHeading}><Ionicons name="document-text-outline" size={20} color={COLORS.navy} /><Text style={styles.legalCardTitle}>Правила користування</Text></View>
        <Text style={styles.legalCardText}>Інформація про транспорт, безпеку, події та сервіси має довідковий характер. Перед дією у критичній ситуації перевіряйте офіційне джерело; застосунок не замінює екстрені служби.</Text>
      </View>

      <View style={styles.legalCard}>
        <View style={styles.legalCardHeading}><Ionicons name="server-outline" size={20} color={COLORS.navy} /><Text style={styles.legalCardTitle}>Джерела та обмеження</Text></View>
        <Text style={styles.legalCardText}>Кожен сервіс показує джерело там, де воно доступне. Дані сторонніх карт і розкладів можуть оновлюватися із затримкою; до офіційної інтеграції вони не є гарантією актуальності.</Text>
      </View>

    </ScrollView>
  </SafeAreaView>;
}


function NotificationSettingsScreen({ enabled, saving, accountConnected, onChange, onBack }: {
  enabled: NotificationPreferences;
  saving: boolean;
  accountConnected: boolean;
  onChange: (preferences: NotificationPreferences) => void;
  onBack: () => void;
}) {
  const swipeBack = useSwipeBack(onBack);
  return <SafeAreaView {...swipeBack} style={styles.screen}>
    <StatusBar style="dark" />
    <ScrollView contentContainerStyle={styles.settingsContent}>
      <InnerHeader title="Сповіщення" onBack={onBack} />
      <Text style={styles.settingsPageDescription}>Оберіть категорії повідомлень.</Text>
      <View style={styles.settingsSafetyNote}>
        <Ionicons name="information-circle-outline" size={18} color={COLORS.navy} />
        <Text style={styles.settingsSafetyText}>Push-сповіщення ще не підключено. Зараз можна зберегти бажані категорії повідомлень.</Text>
      </View>
      <View style={styles.settingsCard}>
        <NotificationChoice disabled={saving} icon="warning-outline" title="Повітряна тривога та відбій" subtitle="Лише після підтвердження від офіційного джерела" enabled={enabled.alert} onPress={() => onChange({ ...enabled, alert: !enabled.alert })} />
        <NotificationChoice disabled={saving} icon="megaphone-outline" title="Важливі новини міста" subtitle="Оголошення міськради та критичні зміни" enabled={enabled.news} onPress={() => onChange({ ...enabled, news: !enabled.news })} />
        <NotificationChoice disabled={saving} icon="bus-outline" title="Зміни у транспорті" subtitle="Скасування, перекриття, важливі зміни маршрутів" enabled={enabled.transport} onPress={() => onChange({ ...enabled, transport: !enabled.transport })} />
        <NotificationChoice disabled={saving} icon="time-outline" title="Хвилина мовчання" subtitle="Делікатне нагадування о 09:00" enabled={enabled.silence} onPress={() => onChange({ ...enabled, silence: !enabled.silence })} />
      </View>
      {saving ? <ActivityIndicator color={COLORS.navy} style={styles.inlineLoader} /> : null}
      <Text style={styles.settingsFootnote}>{accountConnected ? "Налаштування синхронізуються з вашим акаунтом." : "Налаштування зберігаються на цьому пристрої."}</Text>
    </ScrollView>
  </SafeAreaView>;
}

function SettingsChoice({ icon, title, subtitle, selected, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
}) {
  return <Pressable accessibilityLabel={`${title}. ${subtitle}`} accessibilityRole="radio" accessibilityState={{ checked: selected }} aria-checked={selected} onPress={onPress} style={[styles.settingsChoice, selected && styles.settingsChoiceActive]}>
    <View style={styles.settingsChoiceIcon}><Ionicons name={icon} size={20} color={COLORS.navy} /></View>
    <View style={styles.settingsChoiceCopy}><Text style={styles.settingsChoiceTitle}>{title}</Text><Text style={styles.settingsChoiceText}>{subtitle}</Text></View>
    <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={21} color={selected ? COLORS.navy : COLORS.muted} />
  </Pressable>;
}

function NotificationChoice({ icon, title, subtitle, enabled, disabled = false, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  enabled: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return <Pressable accessibilityLabel={`${title}. ${subtitle}`} accessibilityRole="switch" accessibilityState={{ checked: enabled, disabled }} aria-checked={enabled} disabled={disabled} onPress={onPress} style={styles.settingsChoice}>
    <View style={styles.settingsChoiceIcon}><Ionicons name={icon} size={20} color={COLORS.navy} /></View>
    <View style={styles.settingsChoiceCopy}><Text style={styles.settingsChoiceTitle}>{title}</Text><Text style={styles.settingsChoiceText}>{subtitle}</Text></View>
    <View style={[styles.settingsSwitch, enabled && styles.settingsSwitchOn]}><View style={[styles.settingsSwitchKnob, enabled && styles.settingsSwitchKnobOn]} /></View>
  </Pressable>;
}

function MiniaturesScreen({ onBack }: { onBack: () => void }) {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<MiniSculptureList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const swipeBack = useSwipeBack(onBack);
  const visible = data ? searchMiniatures(data.sculptures, query) : [];

  useEffect(() => {
    void loadCatalog();
  }, []);

  async function loadCatalog() {
    setLoading(true);
    setError(null);
    try {
      setData(await getMiniSculptures());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Невідома помилка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView {...swipeBack} style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.pageHeader}>
      <InnerHeader title="Мініскульптури Ужгорода" onBack={onBack} />
      <View style={styles.searchBox}><Ionicons name="search-outline" size={18} color={COLORS.muted} /><TextInput value={query} onChangeText={setQuery} placeholder="Назва, адреса або скульптор" accessibilityLabel="Пошук мініскульптур" placeholderTextColor={COLORS.muted} style={styles.searchInput} />{query !== "" && <Pressable accessibilityRole="button" accessibilityLabel="Очистити пошук" style={styles.smallAction} onPress={() => setQuery("")}><Ionicons name="close" size={20} color={COLORS.navy} /></Pressable>}</View>
      {loading && <ActivityIndicator style={styles.inlineLoader} color={COLORS.navy} />}
      {error && (
        <View style={styles.inlineError}>
          <Text style={styles.inlineErrorText}>{error}</Text>
          <Pressable onPress={() => void loadCatalog()}><Text style={styles.inlineRetry}>Спробувати ще раз</Text></Pressable>
        </View>
      )}
      </View>
      {data && !error && (
        <FlatList
          data={visible}
          keyExtractor={(sculpture) => sculpture.id}
          contentContainerStyle={styles.miniaturesList}
          ListHeaderComponent={
            <>
              <View style={styles.miniaturesMapCard}>
                <MiniaturesMap sculptures={visible} />
              </View>
              <View style={styles.miniaturesCountRow}>
                <View style={styles.miniaturesCountPill}><Ionicons name="walk-outline" size={15} color={COLORS.navy} /><Text style={styles.miniaturesCountText}>{query.trim() ? `${visible.length} із ${data.sculptures.length}` : `Локацій: ${data.sculptures.length}`}</Text></View>
                <Text style={styles.miniaturesSourceDate}>Джерело перевірено: {formatDateOnly(data.sourceCheckedAt)}</Text>
              </View>
              <View style={styles.miniaturesNotice}>
                <Ionicons name="information-circle-outline" size={20} color={COLORS.navy} />
                <Text style={styles.miniaturesNoticeText}>{data.verificationNotice}</Text>
              </View>
              <Text style={styles.miniaturesListTitle}>У каталозі</Text>
            </>
          }
          renderItem={({ item, index }) => <MiniatureCard sculpture={item} index={index + 1} />}
          ListEmptyComponent={<Text style={styles.empty}>Мініскульптур не знайдено. Спробуйте іншу назву або адресу.</Text>}
          ListFooterComponent={<Text style={styles.miniaturesFooter}>Координати взято з туристичної мапи. Актуальне місце й доступність перевіряйте за джерелами.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

function MiniatureCard({ sculpture, index }: { sculpture: MiniSculpture; index: number }) {
  const installedYear = sculpture.installedYear ?? (sculpture.installedAt ? Number(sculpture.installedAt.slice(0, 4)) : null);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${sculpture.latitude},${sculpture.longitude}`;
  return (
    <View style={styles.miniatureCard}>
      <View style={styles.miniatureCardTop}>
        <View style={styles.miniatureNumber}><Text style={styles.miniatureNumberText}>{index}</Text></View>
        <View style={styles.miniatureCardCopy}>
          <Text translate={false} style={styles.miniatureTitle}>{sculpture.title}</Text>
          <Text translate={false} style={styles.miniatureAddress}>{sculpture.address}</Text>
        </View>
      </View>
      <Text translate={false} style={styles.miniatureSummary}>{sculpture.summary}</Text>
      <View style={styles.miniatureMeta}><Text translate={false} style={styles.miniatureMetaText}>{sculpture.author}</Text>{installedYear && <Text translate={false} style={styles.miniatureMetaText}>· {installedYear}</Text>}</View>
      <Pressable accessibilityRole="link" style={styles.miniatureMapAction} onPress={() => void openOfficialLink(mapsUrl)}>
        <Ionicons name="navigate-outline" size={16} color={COLORS.navy} />
        <Text style={styles.miniatureMapActionText}>Відкрити координати</Text>
        <Ionicons name="open-outline" size={15} color={COLORS.navy} />
      </Pressable>
      {(sculpture.sourceUrls ?? []).map((url, index) => <Pressable key={url} accessibilityRole="link" accessibilityLabel={`Джерело інформації: ${new URL(url).hostname}`} style={styles.miniatureMapAction} onPress={() => void openOfficialLink(url)}><Ionicons name="information-circle-outline" size={16} color={COLORS.navy} /><Text style={styles.miniatureMapActionText}>{index === 0 ? "Туристична мапа MUSE Travel" : new URL(url).hostname}</Text><Ionicons name="open-outline" size={15} color={COLORS.navy} /></Pressable>)}
    </View>
  );
}

function BottomNavigation({ activeTab, onChangeTab }: { activeTab: RootTab | null; onChangeTab: (tab: RootTab) => void }) {
  const insets = useSafeAreaInsets();
  const items: Array<{ id: RootTab; icon: keyof typeof Ionicons.glyphMap; label: string }> = [
    { id: "home", icon: "home-outline", label: "Головна" },
    { id: "services", icon: "grid-outline", label: "Сервіси" },
    { id: "feed", icon: "notifications-outline", label: "Стрічка" },
    { id: "profile", icon: "person-outline", label: "Профіль" },
  ];
  return <View style={[styles.bottomNavigation, { paddingBottom: Math.max(8, insets.bottom) }]}>{items.map((item) => (
    <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected: activeTab === item.id }} style={styles.tabButton} onPress={() => onChangeTab(item.id)}>
      <Ionicons name={item.icon} size={21} color={activeTab === item.id ? COLORS.navy : COLORS.muted} />
      <Text style={[styles.tabLabel, activeTab === item.id && styles.tabActive]}>{item.label}</Text>
    </Pressable>
  ))}</View>;
}

function AccessibilityBuildingsScreen({ onBack }: { onBack: () => void }) {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<AccessibleBuildingList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const swipeBack = useSwipeBack(onBack);
  const requests = useRef(new LatestRequest()).current;

  useEffect(() => {
    const timer = setTimeout(() => void loadBuildings(query), 250);
    return () => { clearTimeout(timer); requests.invalidate(); };
  }, [query]);

  async function loadBuildings(searchQuery = query) {
    const revision = requests.begin();
    setLoading(true);
    setError(null);
    try {
      const result = await getAccessibleBuildings(searchQuery);
      if (requests.isCurrent(revision)) setData(result);
    } catch (requestError) {
      if (!requests.isCurrent(revision)) return;
      setError(requestError instanceof Error ? requestError.message : "Невідома помилка");
    } finally {
      if (requests.isCurrent(revision)) setLoading(false);
    }
  }

  return (
    <SafeAreaView {...swipeBack} style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.pageHeader}>
      <InnerHeader title="Безбар’єрність" onBack={onBack} />
      <Text style={styles.cityMapHint}>Будівлі, щодо яких міська рада проводила перевірку або моніторинг доступності.</Text>
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={20} color={COLORS.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Назва будівлі або адреса"
          placeholderTextColor={COLORS.muted}
          style={styles.searchInput}
        />
      </View>
      {loading && <ActivityIndicator style={styles.inlineLoader} color="#123a63" />}
      {error && (
        <View style={styles.inlineError}>
          <Text style={styles.inlineErrorText}>{error}</Text>
          <Pressable onPress={() => void loadBuildings()}>
            <Text style={styles.inlineRetry}>Спробувати ще раз</Text>
          </Pressable>
        </View>
      )}
      </View>
      {data && !error && (
        <FlatList
          data={data.buildings}
          keyExtractor={(building) => building.id}
          contentContainerStyle={styles.accessibilityList}
          ListHeaderComponent={
            <>
              <Text style={styles.accessibilityCount}>Знайдено: {data.buildings.length}</Text>
              {data.stale && <Text style={styles.staleData}>Показано останні завантажені дані: джерело тимчасово недоступне.</Text>}
            </>
          }
          renderItem={({ item }) => <AccessibilityBuildingCard building={item} />}
          ListEmptyComponent={<Text style={styles.empty}>За цим запитом будівель не знайдено.</Text>}
          ListFooterComponent={
            <View style={styles.accessibilityFooter}>
              <Text style={styles.accessibilityNote}>Наявність у реєстрі не означає, що будівля має всі потрібні умови. Перед візитом перевірте їх на офіційному порталі.</Text>
              <Pressable style={styles.sourceButton} onPress={() => void openOfficialLink("https://data.rada-uzhgorod.gov.ua/dataset/96934681-c934-4ae3-a099-448d850620d5")}>
                <Text style={styles.sourceButtonText}>Відкрити джерело даних</Text>
                <Ionicons name="open-outline" size={17} color={COLORS.navy} />
              </Pressable>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function AccessibilityBuildingCard({ building }: { building: AccessibleBuilding }) {
  const monitoredAt = building.monitoredAt
    ? new Intl.DateTimeFormat(getLocale(), { day: "numeric", month: "long", year: "numeric" })
      .format(new Date(`${building.monitoredAt}T12:00:00`))
    : null;
  return (
    <View style={styles.accessibilityCard}>
      <Text style={styles.accessibilityBuildingName}>{displayValue(building.name, "Назва не вказана")}</Text>
      <Text style={styles.accessibilityAddress}>{displayValue(building.address, "Адреса уточнюється")}</Text>
      {monitoredAt && <Text style={styles.accessibilityDate}>Моніторинг: {monitoredAt}</Text>}
    </View>
  );
}






function SafetyMapScreen({ kind, onBack }: { kind: "shelters" | "resilience"; onBack: () => void }) {
  const [points, setPoints] = useState<SafetyMapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<SafetyMapPoint | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [dataStale, setDataStale] = useState(false);
  const [editorialSource, setEditorialSource] = useState(false);
  const [listOpen, setListOpen] = useState(false); const [addressQuery, setAddressQuery] = useState("");
  const loadedKind = useRef(kind);
  const swipeBack = useSwipeBack(onBack);
  const isShelters = kind === "shelters";
  const title = isShelters ? "Укриття" : "Пункти незламності";
  const sourceLabel = editorialSource ? "Редакторський перелік. Перевірити офіційне джерело" : isShelters ? "Джерело: Геопортал Ужгородської міської ради" : "Адреси з останнього оприлюдненого переліку";
  const sourceUrl = isShelters
    ? "https://geo.rada-uzhgorod.gov.ua/map/shelter#/16:22.290283,48.608131:0.00:0.00?baseLayer=osmb&layers=3317996270789854695"
    : "https://nezlamnist.gov.ua/";

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    if (loadedKind.current !== kind) {
      loadedKind.current = kind; setPoints([]); setSelectedPoint(null); setEditorialSource(false); setDataStale(false);
    }
    getSafetyMapPoints(kind)
      .then((response) => {
        if (mounted) { setPoints(response.points); setSelectedPoint(previous => previous ? response.points.find(point => point.id === previous.id) ?? null : null); setDataStale(response.stale); setEditorialSource(response.source === "editorial"); }
      })
      .catch((requestError) => {
        if (mounted) setError(requestError instanceof Error ? requestError.message : "Не вдалося завантажити позначки.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [kind, refreshSignal]);

  return <SafeAreaView {...swipeBack} style={styles.cityMapScreen}>
    <StatusBar style="dark" />
    <View style={styles.cityMapHeader}>
      <InnerHeader title={title} onBack={onBack} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: PAGE_LAYOUT.gutter }}>
        <Pressable accessibilityRole="button" accessibilityLabel={listOpen ? "Показати мапу" : "Список адрес"} style={[styles.smallAction, { flexDirection: "row", gap: 8 }]} onPress={() => setListOpen(value => !value)}><Ionicons name={listOpen ? "map-outline" : "list-outline"} size={20} color={COLORS.navy} /><Text style={styles.inlineRetry}>{listOpen ? "Показати мапу" : "Список адрес"}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Оновити позначки" accessibilityState={{ disabled: loading }} disabled={loading} style={styles.smallAction} onPress={() => setRefreshSignal(value => value + 1)}>{loading ? <ActivityIndicator color={COLORS.navy} /> : <Ionicons name="refresh" size={20} color={COLORS.navy} />}</Pressable>
      </View>
      {listOpen && <View style={styles.searchBox}><Ionicons name="search-outline" size={18} color={COLORS.muted} /><TextInput value={addressQuery} onChangeText={setAddressQuery} placeholder="Назва або адреса" accessibilityLabel="Пошук адрес укриттів" placeholderTextColor={COLORS.muted} style={styles.searchInput} /></View>}
      <Text style={styles.cityMapHint}>{loading ? "Завантажуємо позначки…" : error ? "Позначки тимчасово недоступні" : `${points.length} позначок на мапі`}</Text>
      {isShelters && <Text style={styles.cityMapHint}>Позначка не підтверджує, що вхід зараз відкритий. Перевірте доступність укриття заздалегідь.</Text>}
      {error ? <Pressable accessibilityRole="button" onPress={() => setRefreshSignal((value) => value + 1)}><Text style={styles.inlineRetry}>Спробувати ще раз</Text></Pressable> : null}
      {!loading && !error && points.length === 0 ? <Text style={styles.cityMapHint}>У цьому переліку поки немає точок. Перевірте офіційну карту.</Text> : null}
      {(dataStale || !!error) && points.length > 0 ? <Text style={styles.staleData}>Збережений перелік. Актуальність перевіряйте в офіційному джерелі.</Text> : null}
    </View>
    <View style={styles.cityMapCanvas}>
      {listOpen ? <FlatList data={points.filter(point => `${point.name} ${point.address}`.toLocaleLowerCase("uk").includes(addressQuery.trim().toLocaleLowerCase("uk")))} keyExtractor={point => point.id} contentContainerStyle={{ padding: PAGE_LAYOUT.gutter }} ListEmptyComponent={<Text style={styles.empty}>Адрес не знайдено. Спробуйте іншу назву.</Text>} renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`${item.name}. ${item.address}`} style={styles.profileRow} onPress={() => setSelectedPoint(item)}><View style={{ flex: 1 }}><Text translate={false} style={styles.profileRowTitle}>{item.name}</Text><Text translate={false} style={styles.profileRowValue}>{item.address || "Адресу не вказано в джерелі"}</Text></View><Ionicons name="chevron-forward" size={18} color={COLORS.navy} /></Pressable>} /> : <OfficialLayerMap
        tileTemplate={isShelters && !editorialSource ? "https://geo.rada-uzhgorod.gov.ua/map/rtile/3317996270789854695/ua/{z}/{x}/{y}.png" : undefined}
        points={points}
        onPointPress={setSelectedPoint}
        pinColor={isShelters ? "#c2410c" : "#1d4ed8"}
      />}
    </View>
    {selectedPoint ? <View style={styles.cityMapSelection}>
      <View style={styles.cityMapSelectionHeading}>
        <Text translate={false} style={styles.cityMapSelectionTitle}>{selectedPoint.name}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Закрити адресу" style={styles.smallAction} onPress={() => setSelectedPoint(null)}><Ionicons name="close" size={21} color={COLORS.navy} /></Pressable>
      </View>
      <ScrollView style={{ maxHeight: 160 }}>
        <Text translate={false} selectable style={styles.cityMapSelectionAddress}>{selectedPoint.address || "Адресу не вказано в джерелі"}</Text>
        {selectedPoint.description ? <Text translate={false} selectable style={styles.cityMapSelectionAddress}>{selectedPoint.description}</Text> : null}
        {selectedPoint.verifiedAt ? <Text style={styles.cityMapHint}>Перевірено: {new Date(`${selectedPoint.verifiedAt}T12:00:00Z`).toLocaleDateString(getLocale())}</Text> : null}
        {selectedPoint.sourceUrl ? <Pressable accessibilityRole="button" style={styles.cityMapDirections} onPress={() => void openOfficialLink(selectedPoint.sourceUrl!)}><Text style={styles.cityMapDirectionsText}>Джерело інформації ↗</Text></Pressable> : null}
      </ScrollView>
      <Pressable accessibilityRole="button" accessibilityHint="Відкриє зовнішню карту. Маршрут не гарантує безпечного проходу чи доступності входу." style={styles.cityMapDirections} onPress={() => void openOfficialLink(`https://www.google.com/maps/dir/?api=1&destination=${selectedPoint.latitude},${selectedPoint.longitude}&travelmode=walking`)}>
        <Ionicons name="navigate-outline" size={18} color={COLORS.navy} /><Text style={styles.cityMapDirectionsText}>Прокласти маршрут</Text><Ionicons name="open-outline" size={16} color={COLORS.navy} />
      </Pressable>
    </View> : null}
    <Pressable style={styles.cityMapSource} onPress={() => void openOfficialLink(sourceUrl)}>
      <Ionicons name="information-circle-outline" size={17} color={COLORS.navy} />
      <Text style={styles.cityMapSourceText}>{sourceLabel}{!isShelters ? ". Перед виходом перевірте, чи пункт розгорнули." : ""}</Text>
      <Ionicons name="open-outline" size={16} color={COLORS.navy} />
    </Pressable>
  </SafeAreaView>;
}

function CityServiceDetails({ service, onBack }: { service: CityService; onBack: () => void }) {
  const swipeBack = useSwipeBack(onBack);
  return (
    <SafeAreaView {...swipeBack} style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.serviceDetailsContent}>
        <CivicHeader />
        <BackLink label="До сервісів" onPress={onBack} />
        <View style={styles.serviceDetailsIcon}>
          <Ionicons name={service.icon} size={31} color={COLORS.navy} />
        </View>
        <Text style={styles.serviceDetailsTitle}>{service.title}</Text>
        <Text style={styles.serviceDetailsDescription}>{service.description}</Text>
        <View style={styles.serviceNotice}>
          <Text style={styles.serviceNoticeTitle}>Важливо</Text>
          <Text style={styles.serviceNoticeText}>{service.notice}</Text>
        </View>
        {service.sourceUrl && (
          <Pressable style={styles.externalButton} onPress={() => void openOfficialLink(service.sourceUrl!)}>
            <Text style={styles.externalButtonText}>{service.sourceLabel} ↗</Text>
          </Pressable>
        )}
        {!service.sourceUrl && <View style={styles.serviceComingSoon}>
          <Ionicons name="construct-outline" size={20} color={COLORS.navy} />
          <Text style={styles.serviceComingSoonText}>{service.sourceLabel}. Поки не підключатимемо неофіційні або вигадані дані.</Text>
        </View>}
        {service.sourceUrl && <Text style={styles.externalHint}>Відкриється браузер. Вміст і подальші дії надає відповідний офіційний сайт.</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

function SilenceScreen({ onBack }: { onBack: () => void }) {
  const swipeBack = useSwipeBack(onBack);
  return (
    <SafeAreaView {...swipeBack} style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.silenceContent}>
        <CivicHeader />
        <BackLink label="До сервісів" onPress={onBack} />
        <View style={styles.detailIntro}>
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowDot} />
            <Text style={styles.eyebrow}>Загальнонаціональна пам’ять</Text>
          </View>
          <Text style={styles.detailTitle}>Хвилина мовчання</Text>
          <Text style={styles.detailDescription}>Щоденне вшанування пам’яті загиблих захисників і захисниць України та цивільних громадян.</Text>
        </View>
        <View style={styles.silenceHero}>
          <View style={styles.silenceHeroIcon}><Ionicons name="sunny-outline" size={30} color="#f7be3d" /></View>
          <Text style={styles.silenceHeroKicker}>УЖГОРОД ПАМ’ЯТАЄ</Text>
          <Text style={styles.silenceHeroTime}>09:00</Text>
          <Text style={styles.silenceHeroText}>Щоденний загальноміський час пам’яті</Text>
        </View>
        <View style={styles.remembranceCard}>
          <View style={styles.remembranceIcon}><Ionicons name="time-outline" size={21} color={COLORS.navy} /></View>
          <View style={styles.remembranceCopy}>
            <Text style={styles.remembranceTitle}>Заплануйте хвилину тиші</Text>
            <Text style={styles.remembranceText}>Екран нагадує про час вшанування, але не надсилає push-сповіщень і не перериває роботу пристрою.</Text>
          </View>
        </View>
        <SilencePanel />
        <View style={styles.serviceNotice}>
          <Text style={styles.serviceNoticeTitle}>Пам’ятаємо разом</Text>
          <Text style={styles.serviceNoticeText}>Загальнонаціональну хвилину мовчання проводять щодня о 09:00 за київським часом.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SilencePanel() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const kyivTime = getKyivTime(now);
  const minutesUntilSilence = (9 * 60 - (kyivTime.hours * 60 + kyivTime.minutes) + 24 * 60) % (24 * 60);
  const hours = Math.floor(minutesUntilSilence / 60);
  const minutes = minutesUntilSilence % 60;
  const silenceIsInProgress = kyivTime.hours === 9 && kyivTime.minutes === 0;
  return (
    <View style={styles.silencePanel}>
      <Text style={styles.silenceTime}>09:00</Text>
      <Text style={styles.silenceTitle}>Загальнонаціональна хвилина мовчання</Text>
      <Text style={styles.silenceCountdown}>
        {silenceIsInProgress ? "Зараз триває хвилина мовчання" : `До наступної — ${hours} год ${minutes} хв за київським часом`}
      </Text>
    </View>
  );
}

function getKyivTime(date: Date) {
  return cityClock(date);
}

async function openOfficialLink(url: string) {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert("Не вдалося відкрити посилання", "Спробуйте ще раз або відкрийте офіційний сайт у браузері.");
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert("Не вдалося відкрити посилання", "Спробуйте ще раз або відкрийте офіційний сайт у браузері.");
  }
}

function DataSourcesScreen({ onBack }: { onBack: () => void }) {
  const swipeBack = useSwipeBack(onBack);
  return (
    <SafeAreaView {...swipeBack} style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.sourcesList}>
      <InnerHeader title="Джерела даних" onBack={onBack} />
        <View style={[styles.sourceCard, styles.sourcesFirstCard]}>
          <Text style={styles.sourceCardTitle}>Маршрути, зупинки й розклад</Text>
          <Text style={styles.sourceText}>Офіційні відкриті дані Ужгородської міської ради у форматі GTFS.</Text>
          <Text style={styles.sourceUrl}>track.ua-gis.com/gtfs/uzhhorod/static.zip</Text>
        </View>
        <View style={styles.sourceCard}>
          <Text style={styles.sourceCardTitle}>Ліцензія</Text>
          <Text style={styles.sourceText}>Дані використовуються з посиланням на джерело відповідно до Creative Commons Attribution 4.0.</Text>
          <Text style={styles.sourceUrl}>creativecommons.org/licenses/by/4.0</Text>
        </View>
        <View style={styles.sourceCard}>
          <Text style={styles.sourceCardTitle}>GPS-позиції з DozoR</Text>
          <Text style={styles.sourceText}>Показуємо координати, отримані від DozoR. Час отримання відповіді не є часом GPS-виміру; затримка джерела невідома. Час на зупинках — за розкладом.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TransportEmptyState({
  hasQuery,
  onReset,
  onShowStops,
}: {
  hasQuery: boolean;
  onReset: () => void;
  onShowStops: () => void;
}) {
  return (
    <View style={styles.transportEmptyState}>
      <View style={styles.transportEmptyIcon}>
        <Ionicons name={hasQuery ? "search-outline" : "cloud-download-outline"} size={25} color={COLORS.navy} />
      </View>
      <Text style={styles.transportEmptyTitle}>{hasQuery ? "За цим запитом нічого не знайдено" : "Дані ще не завантажені"}</Text>
      <Text style={styles.transportEmptyText}>
        {hasQuery
          ? "Перевірте написання назви або перегляньте інший тип пошуку."
          : "Офіційний перелік маршрутів і зупинок з’явиться після імпорту GTFS на сервері."}
      </Text>
      <View style={styles.transportEmptyActions}>
        {hasQuery && (
          <Pressable style={styles.transportEmptyPrimaryAction} onPress={onReset}>
            <Text style={styles.transportEmptyPrimaryActionText}>Скинути пошук</Text>
          </Pressable>
        )}
        <Pressable style={styles.transportEmptySecondaryAction} onPress={onShowStops}>
          <Text style={styles.transportEmptySecondaryActionText}>{hasQuery ? "Змінити пошук" : "Переглянути інший список"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function FavoriteButton({ selected, onPress }: { selected: boolean; onPress: () => void }) {
  return <Pressable
    accessibilityLabel={selected ? "Прибрати з обраного" : "Додати до обраного"}
    accessibilityRole="button"
    accessibilityState={{ selected }}
    onPress={(event) => { event.stopPropagation(); onPress(); }}
    style={styles.favoriteButton}
  >
    <Ionicons name={selected ? "star" : "star-outline"} size={20} color={selected ? COLORS.gold : COLORS.navy} />
  </Pressable>;
}

function StopDetails({
  stopScreen,
  isFavorite,
  onBack,
  onOpenRoute,
  onToggleFavorite,
}: {
  stopScreen: StopScreen;
  isFavorite: boolean;
  onBack: () => void;
  onOpenRoute: (route: TransportRoute) => void;
  onToggleFavorite: () => void;
}) {
  const swipeBack = useSwipeBack(onBack);
  return (
    <SafeAreaView {...swipeBack} style={styles.transportDetailScreen}>
      <StatusBar style="dark" />
      <View style={styles.insetContent}>
      <InnerHeader title="Зупинка" onBack={onBack} />
      <View style={styles.stopDetailsHeading}>
        <Text style={styles.stopDetailsTitle}>{stopDisplayName(stopScreen.stop.name)}</Text>
        <FavoriteButton selected={isFavorite} onPress={onToggleFavorite} />
      </View>
      {stopDisplayCode(stopScreen.stop.name) ? <Text style={styles.stopDetailsCode}>Зупинка №{stopDisplayCode(stopScreen.stop.name)}</Text> : null}
      <Text style={styles.stopDetailsSubtitle}>Маршрути, що проходять через цю зупинку</Text>
      <FlatList
        data={stopScreen.routes}
        keyExtractor={(route) => route.id}
        contentContainerStyle={styles.stopDetailsList}
        renderItem={({ item }) => (
          <Pressable accessibilityLabel={`Маршрут ${item.routeNumber}: ${item.name}`} accessibilityRole="button" style={styles.routeCard} onPress={() => onOpenRoute(item)}>
            <View style={styles.routeBadge}>
              <Text style={styles.routeBadgeText}>{item.routeNumber}</Text>
            </View>
            <Text numberOfLines={2} style={styles.routeName}>{item.name}</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Для цієї зупинки маршрутів поки немає.</Text>}
      />
      </View>
    </SafeAreaView>
  );
}

function RouteDetails({
  route,
  map,
  favoriteStopIds,
  onBack,
  onSelectStop,
  onOpenMap,
  onToggleFavoriteStop,
}: {
  route: TransportRouteDetails;
  map: TransportRouteMap | null;
  favoriteStopIds: string[];
  onBack: () => void;
  onSelectStop: (stop: TransportStop) => void;
  onOpenMap: (variantId?: string) => void;
  onToggleFavoriteStop: (stopId: string) => void;
}) {
  const termini = getRouteTermini(route);
  const variants = route.variants.filter((variant) => variant.stops.length > 0);
  const [directionIndex, setDirectionIndex] = useState(0);
  const direction = variants[directionIndex] ?? variants[0];
  const destination = direction?.stops[direction.stops.length - 1]?.name;
  const swipeBack = useSwipeBack(onBack);

  useEffect(() => {
    setDirectionIndex(0);
  }, [route.id]);

  return (
    <SafeAreaView {...swipeBack} style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.routeDetailsContent}>
        <InnerHeader title="Маршрут" onBack={onBack} />
        <TransportCacheNotice value={route} />
        <View style={styles.routeDetailHero}>
          <View style={styles.routeDetailTopLine}>
            <View style={styles.routeDetailRouteIdentity}>
              <Text style={styles.routeDetailRouteLabel}>№</Text>
              <View style={styles.routeDetailRouteBadge}>
                <Text style={styles.routeDetailRouteNumber}>{route.routeNumber}</Text>
              </View>
            </View>
            <View style={styles.routeDetailPlanMark}>
              <Ionicons name="calendar-outline" size={14} color={COLORS.gold} />
              <Text style={styles.routeDetailPlanMarkText}>ПЛАНОВИЙ РОЗКЛАД</Text>
            </View>
          </View>
          <Text style={styles.routeDetailTitle}>{route.name}</Text>
          {termini && <Text style={styles.routeDetailTermini}>{termini}</Text>}
        </View>
        {map && (
          <Pressable accessibilityLabel="Дивитися рух автобусів" accessibilityHint="GPS-позиції показуємо, коли вони доступні. Час на зупинках — за розкладом." accessibilityRole="button" style={styles.routeMapPreview} onPress={() => onOpenMap(direction?.id)}>
            <RouteMap
              activeVariantId={direction?.id}
              map={map}
              region={getInitialRegion(map, direction?.stops, direction?.id)}
              stops={direction?.stops}
              preview
            />
            <View style={styles.routeMapPreviewLabel}>
              <Text style={styles.routeMapPreviewLabelText}>Дивитися рух автобусів</Text>
            </View>
          </Pressable>
        )}
        {!map && <Pressable accessibilityLabel="Дивитися рух автобусів" accessibilityHint="GPS-позиції показуємо, коли вони доступні. Час на зупинках — за розкладом." accessibilityRole="button" style={styles.mapButton} onPress={() => onOpenMap(direction?.id)}>
          <Ionicons name="map-outline" size={18} color={COLORS.navy} />
          <Text style={styles.mapButtonText}>Дивитися рух автобусів</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.navy} />
        </Pressable>}
        <View style={styles.stopsIntro}>
          <View style={styles.stopsIntroCopy}>
            <Text style={styles.stopsHeading}>Зупинки на лінії</Text>
            <Text style={styles.hint}>Оберіть зупинку, щоб переглянути планові відправлення.</Text>
          </View>
          <View style={styles.stopsCountPill}>
            <Text style={styles.stopsCountText}>{direction?.stops.length ?? 0}</Text>
          </View>
        </View>
        {direction ? <>
          <View style={styles.directionSwitch}>
            <View style={styles.directionCopy}>
              <Text style={styles.directionLabel}>Кінцева зупинка</Text>
              <Text numberOfLines={1} style={styles.directionTitle}>{destination || direction.name || "Напрямок руху"}</Text>
            </View>
            {variants.length > 1 ? <Pressable
              accessibilityLabel="Змінити напрямок маршруту"
              style={styles.directionSwitchButton}
              onPress={() => setDirectionIndex((index) => (index + 1) % variants.length)}
            >
                  <Ionicons name="swap-horizontal-outline" size={21} color={COLORS.navy} />
              <Text style={styles.directionButtonText}>Змінити</Text>
            </Pressable> : null}
          </View>
          <View style={styles.variant}>
            {direction.stops.map((stop, index) => (
              <View key={`${direction.id}-${stop.id}-${index}`} style={[styles.stopRow, { paddingVertical: 4 }]}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Зупинка: ${stopDisplayName(stop.name)}`} style={styles.routeTapArea} onPress={() => onSelectStop(stop)}>
                <View style={styles.stopSequence}>
                  <View style={[styles.stopDot, index === 0 && styles.stopDotStart, index === direction.stops.length - 1 && styles.stopDotEnd]} />
                  {index < direction.stops.length - 1 && <View style={styles.stopLine} />}
                </View>
                <Text style={styles.stopName}>{stopDisplayName(stop.name)}</Text>
                <View style={styles.stopScheduleLink}>
                  <Text style={styles.stopSchedule}>Розклад</Text>
                  <Ionicons name="chevron-forward" size={14} color={COLORS.navy} />
                </View>
                </Pressable>
                <FavoriteButton selected={favoriteStopIds.includes(stop.id)} onPress={() => onToggleFavoriteStop(stop.id)} />
              </View>
            ))}
          </View>
        </> : <View style={styles.variant}><Text style={styles.hint}>Для цього маршруту поки немає списку зупинок.</Text></View>}
      </ScrollView>
    </SafeAreaView>
  );
}

function RouteMapScreen({ mapScreen, onBack }: { mapScreen: MapScreen; onBack: () => void }) {
  const variants = mapScreen.route.variants.filter((variant) => variant.stops.length > 0);
  const defaultDirectionIndex = Math.max(0, variants.findIndex((variant) => variant.id === mapScreen.activeVariantId));
  const [directionIndex, setDirectionIndex] = useState(defaultDirectionIndex);
  const [selectedStop, setSelectedStop] = useState<TransportStop | null>(null);
  const [departures, setDepartures] = useState<TransportDeparture[] | null>(null);
  const [departureError, setDepartureError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [vehiclePositions, setVehiclePositions] = useState<TransportVehiclePositions | null>(null);
  const [gpsStatusHeight, setGpsStatusHeight] = useState(32);
  const departureRequest = useRef(new LatestRequest()).current;
  const liveState = transportLiveState(vehiclePositions, now.getTime());
  const gpsFresh = liveState === "live" || liveState === "empty";
  const direction = variants[directionIndex] ?? variants[0];
  const destination = direction?.stops[direction.stops.length - 1]?.name;
  const region = getInitialRegion(mapScreen.map, direction?.stops, direction?.id);

  useEffect(() => {
    departureRequest.invalidate();
    setDirectionIndex(defaultDirectionIndex);
    setSelectedStop(null);
    setDepartures(null);
    setDepartureError(null);
  }, [defaultDirectionIndex, mapScreen.route.id]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    let loadingPositions = false;
    const loadVehiclePositions = async () => {
      if (!active || loadingPositions || AppState.currentState !== "active") return;
      loadingPositions = true;
      try {
        const positions = await getVehiclePositions(mapScreen.route.routeNumber);
        if (active) {
          setVehiclePositions(positions);
          setNow(new Date());
        }
      } catch {
        if (active) {
          setVehiclePositions({ available: false, stale: false, fetchedAt: new Date().toISOString(), vehicles: [] });
        }
      } finally { loadingPositions = false; }
    };
    void loadVehiclePositions();
    const timer = setInterval(() => void loadVehiclePositions(), 20_000);
    const subscription = AppState.addEventListener("change", (state) => {
      setNow(new Date());
      if (state === "active") void loadVehiclePositions();
    });
    return () => {
      active = false;
      departureRequest.invalidate();
      subscription.remove();
      clearInterval(timer);
    };
  }, [mapScreen.route.routeNumber]);

  function changeDirection() {
    if (variants.length < 2) {
      return;
    }
    departureRequest.invalidate();
    setDirectionIndex((index) => (index + 1) % variants.length);
    setSelectedStop(null);
    setDepartures(null);
    setDepartureError(null);
  }

  async function selectStop(stop: TransportStop) {
    const revision = departureRequest.begin();
    setSelectedStop(stop);
    setDepartures(null);
    setDepartureError(null);
    try {
      const allDepartures = await getDepartures(mapScreen.route.id, stop.id, localDate());
      if (!departureRequest.isCurrent(revision)) return;
      setDepartures(direction ? allDepartures.filter((departure) => departure.routeVariantId === direction.id) : allDepartures);
    } catch (requestError) {
      if (!departureRequest.isCurrent(revision)) return;
      setDepartureError(requestError instanceof Error ? requestError.message : "Не вдалося отримати плановий розклад.");
    }
  }

  const nextDepartures = departures ? findUpcomingDepartures(departures, now) : [];

  return (
    <SafeAreaView style={styles.mapScreen}>
      <StatusBar style="dark" />
      <View style={styles.mapHeader}>
        <BackLink label={`До маршруту ${mapScreen.route.routeNumber}`} onPress={onBack} />
        <Text style={styles.mapTitle}>{mapScreen.route.name}</Text>
        <Text style={styles.mapHint}>Рух автобусів онлайн · час на зупинках — за розкладом.</Text>
      </View>
      {direction ? <View style={styles.mapDirectionSwitch}>
        <View style={styles.mapDirectionCopy}>
          <Text style={styles.mapDirectionLabel}>Напрямок · кінцева</Text>
          <Text numberOfLines={1} style={styles.mapDirectionTitle}>{destination || direction.name || "Напрямок руху"}</Text>
        </View>
        {variants.length > 1 ? <Pressable
          accessibilityLabel="Змінити напрямок на карті"
          style={styles.mapDirectionButton}
          onPress={changeDirection}
        >
          <Ionicons name="swap-horizontal-outline" size={21} color={COLORS.navy} />
          <Text style={styles.directionButtonText}>Змінити</Text>
        </Pressable> : null}
      </View> : null}
      <View style={styles.mapCanvas}>
        <RouteMap
          activeVariantId={direction?.id}
          map={mapScreen.map}
          region={region}
          selectedStopId={selectedStop?.id}
          stops={direction?.stops}
          vehicles={gpsFresh ? vehiclePositions?.vehicles : []}
          onStopPress={(stop) => void selectStop(stop)}
        />
        <View pointerEvents="none" style={styles.mapGpsStatus} onLayout={event => setGpsStatusHeight(event.nativeEvent.layout.height)}>
          <View style={[styles.mapGpsDot, liveState === "live" ? styles.mapGpsDotLive : liveState === "stale" ? styles.mapGpsDotStale : styles.mapGpsDotOffline]} />
          <View style={{ flexShrink: 1, gap: 2 }}>
          <Text style={styles.mapGpsStatusText}>
            {liveState === "live" ? `Позиції з DozoR · ${vehiclePositions!.vehicles.length} ${pluralizeBus(vehiclePositions!.vehicles.length)}`
              : liveState === "empty" ? "Джерело не передало позицій автобусів"
              : liveState === "stale" ? "Не вдалося оновити позиції автобусів"
              : liveState === "loading" ? "Завантажуємо рух автобусів…"
              : "Позиції автобусів недоступні"}
          </Text>
          {(liveState === "live" || liveState === "empty") && <Text style={styles.mapGpsStatusText}>Отримано: {formatUpdatedAt(vehiclePositions!.fetchedAt)}</Text>}
          </View>
        </View>
        {selectedStop ? <View style={[styles.mapStopCard, { top: 12 + gpsStatusHeight + 10 }]}>
          <View style={styles.mapStopCardTop}>
            <View style={styles.mapStopIcon}><Ionicons name="bus-outline" size={18} color={COLORS.navy} /></View>
            <View style={styles.mapStopCopy}>
              <Text numberOfLines={2} style={styles.mapStopName}>{stopDisplayName(selectedStop.name)}</Text>
              <Text numberOfLines={1} style={styles.mapStopDirection}>До {destination || direction?.name || "кінцевої"}</Text>
            </View>
          </View>
          {departures === null && !departureError ? <View style={styles.mapStopScheduleLoading}>
            <ActivityIndicator size="small" color={COLORS.navy} />
            <Text style={styles.mapStopScheduleText}>Шукаємо плановий час…</Text>
          </View> : null}
          {nextDepartures.length > 0 ? <View style={styles.mapStopSchedule}>
            <Text style={styles.mapStopScheduleLabel}>Найближчі за розкладом</Text>
            <View style={styles.mapStopTimes}>
              {nextDepartures.map((departure, index) => {
                const minutesUntil = minutesUntilDeparture(departure, now);
                return <View key={`${departure.routeVariantId}-${departure.departureTimeSeconds}-${index}`} style={styles.mapStopTimePill}>
                  <Text style={styles.mapStopScheduleTime}>{departure.departureTime}</Text>
                  <Text style={styles.mapStopMinutesText}>{minutesUntil === 0 ? "зараз" : `через ${minutesUntil} хв`}</Text>
                </View>;
              })}
            </View>
          </View> : null}
          {departures !== null && nextDepartures.length === 0 && !departureError ? <Text style={styles.mapStopEmpty}>Сьогодні в цьому напрямку планових рейсів більше немає.</Text> : null}
          {departureError ? <Text style={styles.mapStopError}>Плановий час зараз недоступний. Спробуйте ще раз.</Text> : null}
          <Text style={styles.mapStopFootnote}>
            Час із затвердженого розкладу{liveState === "live" ? "; живі автобуси позначено на карті." : "."}
          </Text>
        </View> : null}
      </View>
    </SafeAreaView>
  );
}

function getInitialRegion(map: TransportRouteMap, stops = map.stops, activeVariantId?: string): MapRegion {
  const shapes = activeVariantId
    ? map.variants.filter((variant) => variant.id === activeVariantId).flatMap((variant) => variant.shape)
    : map.variants.flatMap((variant) => variant.shape);
  const points = [...stops, ...shapes];
  if (points.length === 0) {
    return { latitude: 48.6208, longitude: 22.2879, latitudeDelta: 0.08, longitudeDelta: 0.08 };
  }
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  return {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
    latitudeDelta: Math.max((maxLatitude - minLatitude) * 1.35, 0.02),
    longitudeDelta: Math.max((maxLongitude - minLongitude) * 1.35, 0.02),
  };
}

function pluralizeBus(count: number): string {
  const remainder = count % 10;
  const tens = count % 100;
  if (remainder === 1 && tens !== 11) {
    return "автобус";
  }
  if (remainder >= 2 && remainder <= 4 && (tens < 12 || tens > 14)) {
    return "автобуси";
  }
  return "автобусів";
}

function ScheduleDetails({
  schedule,
  onBack,
  onChangeDate,
}: {
  schedule: ScheduleView;
  onBack: () => void;
  onChangeDate: (date: string) => void;
}) {
  const swipeBack = useSwipeBack(onBack);
  const dark = useContext(AppThemeContext) ?? false;
  const active = useScreenActive();
  const [now, setNow] = useState(() => new Date());
  const [showAll, setShowAll] = useState(() => schedule.date !== cityDate());
  useEffect(() => { setShowAll(schedule.date !== cityDate()); }, [schedule.date]);
  useEffect(() => {
    if (!active) return;
    const update = () => setNow(new Date());
    update();
    const timer = setInterval(update, 30_000);
    const subscription = AppState.addEventListener("change", state => { if (state === "active") update(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [active]);
  const isToday = schedule.date === cityDate(now);
  const upcomingOnly = isToday && !showAll;
  const departures = visibleScheduleDepartures(schedule.departures, schedule.date, now, showAll);
  const readableDate = new Intl.DateTimeFormat(getLocale(), { day: "numeric", month: "long" })
    .format(new Date(`${schedule.date}T12:00:00`));
  return (
    <SafeAreaView {...swipeBack} style={styles.transportDetailScreen}>
      <StatusBar style="dark" />
      <View style={styles.insetContent}>
      <InnerHeader title="Розклад зупинки" onBack={onBack} />
      <Text style={styles.scheduleTitle}>{stopDisplayName(schedule.stop.name)}</Text>
      {stopDisplayCode(schedule.stop.name) ? <Text style={styles.stopDetailsCode}>Зупинка №{stopDisplayCode(schedule.stop.name)}</Text> : null}
      <View style={styles.dateControls}>
        <Pressable accessibilityLabel="Попередня дата" accessibilityRole="button" hitSlop={2} style={styles.dateButton} onPress={() => onChangeDate(addDays(schedule.date, -1))}>
          <Text style={styles.dateButtonText}>←</Text>
        </Pressable>
        <View>
          <Text style={styles.scheduleSubtitle}>Планові відправлення на</Text>
          <Text style={styles.selectedDate}>{readableDate}</Text>
        </View>
        <Pressable accessibilityLabel="Наступна дата" accessibilityRole="button" hitSlop={2} style={styles.dateButton} onPress={() => onChangeDate(addDays(schedule.date, 1))}>
          <Text style={styles.dateButtonText}>→</Text>
        </Pressable>
      </View>
      {isToday && <View style={{ marginTop: 12 }}><SegmentedChoice dark={dark} value={showAll ? "all" : "upcoming"} label="Показ розкладу"
        options={[{ value: "upcoming", label: "Найближчі" }, { value: "all", label: "Увесь день" }]} onChange={value => setShowAll(value === "all")} /></View>}
      <Text style={[styles.scheduleSubtitle, { marginVertical: 10 }]}>Плановий час, не прогноз прибуття.</Text>
      <ScrollView key={`${schedule.date}-${upcomingOnly}`} contentContainerStyle={styles.detailsList}>
        {departures.map((departure, index) => (
          <View key={`${departure.routeVariantId}-${departure.departureTimeSeconds}-${index}`} style={styles.departure}>
            <Text style={styles.departureTime}>{departure.departureTime}</Text>
            <Text style={styles.departureDestination}>{departure.destination || "Напрямок маршруту"}</Text>
          </View>
        ))}
        {schedule.departures.length === 0 && (
          <Text style={styles.empty}>На цю дату планових рейсів немає або розклад ще не імпортовано.</Text>
        )}
        {schedule.departures.length > 0 && departures.length === 0 && <View style={{ gap: 12, paddingVertical: 20 }}>
          <Text style={styles.scheduleSubtitle}>На сьогодні планові відправлення завершилися.</Text>
          <Pressable accessibilityRole="button" style={styles.mapButton} onPress={() => onChangeDate(addDays(schedule.date, 1))}><Text style={styles.mapButtonText}>Розклад на завтра</Text></Pressable>
          <Pressable accessibilityRole="button" style={styles.smallAction} onPress={() => setShowAll(true)}><Text style={styles.dashboardAllLink}>Показати весь день</Text></Pressable>
        </View>}
      </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function localDate() {
  return cityDate();
}

function addDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + amount);
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}

function findUpcomingDepartures(departures: TransportDeparture[], now: Date) {
  const currentSeconds = citySeconds(now);
  return departures.filter((departure) => departure.departureTimeSeconds >= currentSeconds).slice(0, 3);
}

function minutesUntilDeparture(departure: TransportDeparture, now: Date) {
  const currentSeconds = citySeconds(now);
  return Math.max(0, Math.ceil((departure.departureTimeSeconds - currentSeconds) / 60));
}

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat(getLocale(), { timeZone: CITY_TIME_ZONE, dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatDateOnly(value: string) {
  return new Intl.DateTimeFormat(getLocale(), { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

type FeedEntry = {
  key: string;
  dayLabel: string;
  timestamp: number;
} & ({ kind: "news"; item: OfficialNewsItem } | { kind: "alert"; event: AirAlertEvent });

const UKRAINIAN_MONTHS = ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"];

function parseNewsDate(label: string | null): Date | null {
  const match = label?.trim().toLowerCase().match(/^([а-яіїєґ]+)\s+(\d{1,2}),\s*(\d{4})$/u);
  if (!match) return null;
  const month = UKRAINIAN_MONTHS.indexOf(match[1]);
  if (month < 0) return null;
  const date = new Date(Date.UTC(Number(match[3]), month, Number(match[2]), 12));
  return date.getUTCMonth() === month && date.getUTCDate() === Number(match[2]) ? date : null;
}

function feedDayKey(date: Date): string {
  return cityDate(date);
}

function groupFeedEntriesByDay(items: OfficialNewsItem[], events: AirAlertEvent[]): Array<[string, FeedEntry[]]> {
  const groups = new Map<string, FeedEntry[]>();
  const add = (day: string, entry: FeedEntry) => groups.set(day, [...(groups.get(day) ?? []), entry]);
  const labelFor = (date: Date) => new Intl.DateTimeFormat(getLocale(), { timeZone: CITY_TIME_ZONE, day: "numeric", month: "long", year: "numeric" }).format(date);

  for (const item of items) {
    const date = parseNewsDate(item.publishedLabel);
    add(date ? feedDayKey(date) : "__undated__", {
      kind: "news", item, key: item.sourceUrl,
      dayLabel: date ? labelFor(date) : "",
      timestamp: date?.getTime() ?? 0,
    });
  }
  for (const event of events) {
    const date = new Date(event.occurredAt);
    if (!Number.isFinite(date.getTime())) continue;
    add(feedDayKey(date), {
      kind: "alert", event, key: `${event.state}-${event.occurredAt}`,
      dayLabel: labelFor(date), timestamp: date.getTime(),
    });
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left === "__undated__" ? 1 : right === "__undated__" ? -1 : right.localeCompare(left))
    .map(([day, entries]) => [day, entries.sort((left, right) => right.timestamp - left.timestamp)]);
}

function formatAlertEventTime(value: string) {
  return new Intl.DateTimeFormat(getLocale(), { timeZone: CITY_TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function displayValue(value: string | null | undefined, fallback: string) {
  const normalized = value?.replace(/\bnull\b/gi, "").replace(/\s+/g, " ").replace(/\s+,/g, ",").trim();
  return normalized && normalized.toLowerCase() !== "null" ? normalized : fallback;
}

function stopDisplayCode(name: string): string | null {
  return name.match(/\s*\((\d+)\)\s*$/)?.[1] ?? null;
}

function stopDisplayName(name: string): string {
  return name.replace(/\s*\(\d+\)\s*$/, "").trim();
}

function formatDashboardDate(now = new Date()) {
  return new Intl.DateTimeFormat(getLocale(), { timeZone: CITY_TIME_ZONE, day: "numeric", month: "long" }).format(now);
}

function formatDashboardDay(now = new Date()) {
  const day = new Intl.DateTimeFormat(getLocale(), { timeZone: CITY_TIME_ZONE, weekday: "long" }).format(now);
  return day.charAt(0).toUpperCase() + day.slice(1);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat(getLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value);
}

function airQualityLabel(index: number) {
  const labels: Record<number, string> = {
    1: "Добре",
    2: "Помірно",
    3: "Для чутливих груп",
    4: "Незадовільно",
    5: "Погано",
    6: "Небезпечно",
  };
  return labels[index] ?? "Немає оцінки";
}

function formatWeatherDay(date: string, index: number) {
  if (index === 0) {
    return "Сьогодні";
  }
  if (index === 1) {
    return "Завтра";
  }
  return new Intl.DateTimeFormat(getLocale(), { weekday: "short", day: "numeric" }).format(new Date(`${date}T12:00:00`));
}

function formatWeatherHour(value: string) {
  return new Intl.DateTimeFormat(getLocale(), { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Kyiv" }).format(new Date(value));
}

function sortRoutesByNumber(routes: TransportRoute[]) {
  const collator = new Intl.Collator(getLocale(), { numeric: true, sensitivity: "base" });
  return [...routes].sort((left, right) => collator.compare(left.routeNumber, right.routeNumber));
}

function LoadingScreen({ onBack }: { onBack: () => void }) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.pageHeader}><InnerHeader title="Громадський транспорт" onBack={onBack} /></View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.centered}>
      <View style={styles.loadingIcon}><Ionicons name="bus-outline" size={28} color={COLORS.navy} /></View>
      <ActivityIndicator size="small" color={COLORS.navy} style={styles.loadingSpinner} />
      <Text style={styles.loadingTitle}>Завантажуємо транспорт</Text>
      <Text style={styles.loadingText}>Отримуємо офіційні маршрути та зупинки.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function getRouteTermini(route: TransportRouteDetails) {
  const firstVariant = route.variants.find((variant) => variant.stops.length > 1);
  if (!firstVariant) {
    return null;
  }
  const first = firstVariant.stops[0]?.name;
  const last = firstVariant.stops[firstVariant.stops.length - 1]?.name;
  return first && last ? `${first}  ⇄  ${last}` : null;
}

function ErrorScreen({ message, onRetry, onBack }: { message: string; onRetry: () => void; onBack: () => void }) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.pageHeader}><InnerHeader title="Громадський транспорт" onBack={onBack} /></View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.centered}>
      <View style={styles.errorIcon}><Ionicons name="cloud-offline-outline" size={30} color={COLORS.navy} /></View>
      <Text style={styles.errorTitle}>Дані зараз недоступні</Text>
      <Text style={styles.errorText}>{message}</Text>
      <Text style={styles.errorHint}>Перевірте з’єднання та спробуйте ще раз. Застосунок не підміняє дані застарілою інформацією.</Text>
      <Pressable style={styles.retryButton} onPress={() => void onRetry()}>
        <Ionicons name="refresh-outline" size={18} color="#ffffff" />
        <Text style={styles.retryText}>Спробувати ще раз</Text>
      </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const STYLE_DEFINITIONS = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f6f7fb" },
  pageHeader: { paddingHorizontal: PAGE_LAYOUT.gutter, paddingTop: PAGE_LAYOUT.top },
  insetContent: { flex: 1, paddingHorizontal: PAGE_LAYOUT.gutter, paddingTop: PAGE_LAYOUT.top },
  transportScreen: { flex: 1, backgroundColor: "#f6f7fb" },
  transportContent: { paddingHorizontal: PAGE_LAYOUT.gutter },
  transportScrollContent: { flexGrow: 1, paddingTop: PAGE_LAYOUT.top, paddingBottom: PAGE_LAYOUT.bottom },
  centered: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: PAGE_LAYOUT.gutter, paddingVertical: PAGE_LAYOUT.section },
  civicHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 58, paddingTop: 4 },
  brandGroup: { alignItems: "center", flexDirection: "row", gap: 8, flex: 1, minWidth: 0 },
  brandCopy: { flex: 1, minWidth: 0 },
  brandMark: { backgroundColor: COLORS.navy, height: 34, width: 34 },
  brandIntroScreen: { backgroundColor: "#f6f7fb", flex: 1 },
  brandIntroBody: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  brandIntroContent: { alignItems: "center", width: "100%" },
  brandIntroTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontWeight: "700", fontSize: 27, letterSpacing: -0.5, marginTop: 19, textAlign: "center" },
  brandIntroSubtitle: { color: COLORS.muted, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 13, marginTop: 6, textAlign: "center" },
  brandIntroFooter: { alignItems: "center", justifyContent: "center", bottom: 24, left: 20, right: 20, flexDirection: "row", gap: 8, position: "absolute" },
  brandIntroFooterText: { color: COLORS.muted, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 12, textAlign: "center", flexShrink: 1 },
  brandTitleRow: { alignItems: "center", flexDirection: "row", gap: 6 },
  brandTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 16, lineHeight: 20 },
  brandSubtitle: { color: COLORS.muted, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 10, marginTop: 1 },
  headerDate: { color: COLORS.muted, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 12 },
  backLink: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 4, marginTop: PAGE_LAYOUT.fieldGap, minHeight: 44, maxWidth: "100%", paddingRight: PAGE_LAYOUT.fieldGap, paddingVertical: PAGE_LAYOUT.fieldGap },
  backLinkText: { color: COLORS.navyDark, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 13, flexShrink: 1 },
  pageIntro: { marginTop: PAGE_LAYOUT.section },
  eyebrowRow: { alignItems: "center", flexDirection: "row", gap: 6 },
  eyebrowDot: { backgroundColor: COLORS.gold, borderRadius: 4, height: 7, width: 7 },
  eyebrowDotGreen: { backgroundColor: COLORS.green },
  eyebrow: { color: COLORS.muted, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase" },
  pageTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontWeight: "700", fontSize: 26, letterSpacing: -0.4, lineHeight: 32 },
  pageDescription: { color: "#43474e", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 14, lineHeight: 21, marginTop: 6 },
  transportHero: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 15, borderWidth: 1, marginTop: 18, overflow: "hidden", padding: 15 },
  transportHeroTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  transportHeroIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 10, height: 40, justifyContent: "center", width: 40 },
  transportHeroBadge: { backgroundColor: COLORS.blueSurface, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5 },
  transportHeroBadgeText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 10, letterSpacing: 0.5 },
  transportHeroTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontWeight: "700", fontSize: 19, lineHeight: 24, marginTop: 14 },
  transportHeroText: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 13, lineHeight: 19, marginTop: 4 },
  transportHeroButton: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 6, marginTop: 14 },
  transportHeroButtonText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 13 },
  riverNote: { alignItems: "center", backgroundColor: "#e7eeff", borderRadius: 14, flexDirection: "row", gap: 11, marginTop: 14, padding: 12 },
  riverNoteIcon: { alignItems: "center", backgroundColor: "#d3e4ff", borderRadius: 9, height: 42, justifyContent: "center", width: 42 },
  riverNoteText: { flex: 1 },
  riverNoteEyebrow: { color: COLORS.muted, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 10 },
  riverNoteTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 14, marginTop: 2 },
  riverNoteDescription: { color: "#43474e", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, marginTop: 3 },
  sectionHeadingRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 24 },
  serviceCategoryFirst: { marginTop: PAGE_LAYOUT.section },
  serviceCategory: { marginTop: PAGE_LAYOUT.section },
  serviceGroupHeading: { marginBottom: 10 },
  serviceGroupTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 17 },
  serviceGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: PAGE_LAYOUT.gap, columnGap: "4%" },
  serviceGridCard: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, justifyContent: "space-between", minHeight: 90, padding: PAGE_LAYOUT.gap, width: "48%" },
  serviceGridIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 9, height: 34, justifyContent: "center", width: 34 },
  serviceGridFooter: { alignItems: "flex-end", flexDirection: "row", gap: 4, justifyContent: "space-between", marginTop: 7 },
  serviceGridTitle: { color: COLORS.ink, flex: 1, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 13, lineHeight: 18 },
  testScenarioLabel: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 17 },
  officialMark: { alignItems: "center", flexDirection: "row", gap: 4 },
  officialMarkText: { color: COLORS.green, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 11 },
  serviceRow: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 13, borderWidth: 1, flexDirection: "row", gap: 11, marginTop: 8, minHeight: 74, padding: 12 },
  serviceRowIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 10, height: 40, justifyContent: "center", width: 40 },
  serviceRowText: { flex: 1 },
  serviceRowTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 15, lineHeight: 20 },
  serviceRowDescription: { color: "#596574", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 17, marginTop: 3 },
  serviceGoldDot: { backgroundColor: COLORS.gold, borderRadius: 4, height: 7, width: 7 },
  servicesCount: { color: COLORS.muted, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 12 },
  openDataRow: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 12, marginTop: 9, minHeight: 82, padding: 12 },
  hubFooter: { alignItems: "center", gap: 7, marginHorizontal: 14, marginTop: 27, paddingBottom: 20 },
  profileAppCard: { alignItems: "center", backgroundColor: COLORS.navy, borderRadius: 17, flexDirection: "row", gap: 12, marginTop: 18, overflow: "hidden", padding: 15 },
  profileAppMark: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 14, height: 58, justifyContent: "center", width: 58 },
  profileAppCopy: { flex: 1 },
  profileAppTitle: { color: "#ffffff", fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 16 },
  profileAppText: { color: "#d3e4ff", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 17, marginTop: 4 },
  profileVersionPill: { alignSelf: "flex-start", backgroundColor: COLORS.blueSurface, borderRadius: 6, marginTop: 8, paddingHorizontal: 6, paddingVertical: 3 },
  profileVersionText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 10 },
  profileSectionTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 16, marginTop: PAGE_LAYOUT.section },
  profileGroup: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, marginTop: 10, overflow: "hidden" },
  profileRow: { alignItems: "center", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", gap: PAGE_LAYOUT.gap, minHeight: 67, paddingHorizontal: PAGE_LAYOUT.block, paddingVertical: PAGE_LAYOUT.gap },
  profileRowIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 9, height: 36, justifyContent: "center", width: 36 },
  profileRowText: { flex: 1 },
  profileRowTitle: { color: COLORS.ink, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 14, lineHeight: 19 },
  profileRowValue: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 18, marginTop: 2 },
  profilePrivacyNote: { alignItems: "flex-start", backgroundColor: COLORS.blueSurface, borderRadius: 13, flexDirection: "row", gap: 10, marginTop: 24, padding: 14 },
  profilePrivacyText: { color: "#3f5269", flex: 1, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 18 },
  profileNoticeCard: { alignItems: "flex-start", backgroundColor: "#ffffff", borderColor: COLORS.border, borderLeftColor: COLORS.gold, borderLeftWidth: 3, borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 10, marginTop: 10, padding: 14 },
  profileNoticeCopy: { flex: 1 },
  profileNoticeTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 14 },
  profileNoticeText: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 18, marginTop: 4 },
  profileFooter: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, marginTop: 22, textAlign: "center" },
  settingsContent: { flexGrow: 1, paddingBottom: PAGE_LAYOUT.bottom, paddingHorizontal: PAGE_LAYOUT.gutter, paddingTop: PAGE_LAYOUT.top },
  accountIntro: { marginTop: 13 },
  accountIntroText: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 13, marginTop: 4 },
  accountForm: { marginTop: PAGE_LAYOUT.section },
  accountActionButton: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 11, borderWidth: 1, flexDirection: "row", gap: 9, marginTop: PAGE_LAYOUT.gap, minHeight: 50, paddingHorizontal: PAGE_LAYOUT.block, paddingVertical: PAGE_LAYOUT.gap },
  accountActionText: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 13, flexShrink: 1 },
  accountDeleteButton: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderColor: COLORS.border, borderRadius: 11, borderWidth: 1, flexDirection: "row", gap: 9, marginTop: PAGE_LAYOUT.gap, minHeight: 50, paddingHorizontal: PAGE_LAYOUT.block, paddingVertical: PAGE_LAYOUT.gap },
  accountDeleteText: { color: COLORS.danger, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 13, flexShrink: 1 },
  accountFootnote: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 11, lineHeight: 16, marginTop: 13, textAlign: "center" },
  settingsPageTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontWeight: "700", fontSize: 25, lineHeight: 31, marginTop: PAGE_LAYOUT.block },
  settingsPageDescription: { color: "#485768", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 13, lineHeight: 19, marginTop: 5 },
  legalCard: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, marginTop: 14, padding: 14 },
  legalCardHeading: { alignItems: "center", flexDirection: "row", gap: 8 },
  legalCardTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 15 },
  legalCardText: { color: COLORS.ink, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 18, marginTop: 10 },
  pollQuestion: { color: COLORS.ink, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 18, lineHeight: 25, marginTop: 18 },
  pollOption: { alignItems: "center", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", gap: PAGE_LAYOUT.gap, minHeight: 66, paddingHorizontal: PAGE_LAYOUT.block, paddingVertical: PAGE_LAYOUT.gap },
  settingsHero: { backgroundColor: COLORS.navy, borderRadius: 18, marginTop: 15, padding: 18 },
  settingsHeroIcon: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, height: 48, justifyContent: "center", width: 48 },
  settingsHeroKicker: { color: "#f4c65b", fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 10, letterSpacing: 0.7, marginTop: 16 },
  settingsHeroTitle: { color: "#ffffff", fontFamily: FONTS.bold, fontWeight: "700", fontSize: 24, marginTop: 5 },
  settingsHeroText: { color: "#d3e4ff", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 13, lineHeight: 20, marginTop: 7 },
  settingsCard: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 16, borderWidth: 1, marginTop: 13, overflow: "hidden" },
  settingsChoice: { alignItems: "center", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", gap: PAGE_LAYOUT.gap, minHeight: 74, paddingHorizontal: PAGE_LAYOUT.block, paddingVertical: PAGE_LAYOUT.gap },
  settingsChoiceActive: { backgroundColor: COLORS.blueSurface },
  settingsChoiceIcon: { alignItems: "center", borderRadius: 10, height: 32, justifyContent: "center", width: 32 },
  settingsChoiceCopy: { flex: 1 },
  settingsChoiceTitle: { color: COLORS.ink, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 14, lineHeight: 19 },
  settingsChoiceText: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 11, lineHeight: 16, marginTop: 3 },
  settingsInfoNote: { alignItems: "flex-start", backgroundColor: COLORS.blueSurface, borderRadius: 13, flexDirection: "row", gap: 9, marginTop: 13, padding: 13 },
  settingsInfoText: { color: "#40546b", flex: 1, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 18 },
  settingsSafetyNote: { alignItems: "flex-start", backgroundColor: COLORS.blueSurface, borderRadius: 10, flexDirection: "row", gap: 9, marginTop: 14, padding: 11 },
  settingsSafetyText: { color: COLORS.navyDark, flex: 1, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 18 },
  settingsSwitch: { backgroundColor: COLORS.blueSoft, borderColor: COLORS.controlBorder, borderRadius: 15, borderWidth: 1, height: 28, padding: 2, width: 48 },
  settingsSwitchOn: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  settingsSwitchKnob: { backgroundColor: "#ffffff", borderRadius: 11, height: 22, width: 22 },
  settingsSwitchKnobOn: { alignSelf: "flex-end" },
  settingsFootnote: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 18, marginHorizontal: 4, marginTop: 16 },
  cnapContent: { flexGrow: 1, paddingBottom: PAGE_LAYOUT.bottom, paddingHorizontal: PAGE_LAYOUT.gutter, paddingTop: PAGE_LAYOUT.top },
  cnapHero: { backgroundColor: COLORS.navy, borderRadius: 18, marginTop: 15, padding: 18 },
  cnapHeroTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  cnapHeroIcon: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, height: 48, justifyContent: "center", width: 48 },
  cnapDemoBadge: { backgroundColor: "rgba(247,190,61,0.15)", borderColor: "rgba(247,190,61,0.38)", borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5 },
  cnapDemoBadgeText: { color: "#f7be3d", fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 9, letterSpacing: 0.6 },
  cnapHeroTitle: { color: "#ffffff", fontFamily: FONTS.bold, fontWeight: "700", fontSize: 24, marginTop: 17 },
  cnapHeroText: { color: "#d3e4ff", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 13, lineHeight: 20, marginTop: 7 },
  cnapSafetyNote: { alignItems: "flex-start", backgroundColor: COLORS.blueSurface, borderRadius: 13, flexDirection: "row", gap: 9, marginTop: 12, padding: 12 },
  cnapSafetyNoteText: { color: COLORS.navyDark, flex: 1, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 18 },
  cnapFormCard: { marginTop: PAGE_LAYOUT.section },
  cnapFormTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontWeight: "700", fontSize: 17, marginBottom: 4 },
  cnapFieldLabel: { color: COLORS.navyDark, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 12, marginTop: 16 },
  cnapSelect: { alignItems: "center", backgroundColor: "#f8faff", borderColor: COLORS.controlBorder, borderRadius: 10, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", marginTop: PAGE_LAYOUT.fieldGap, minHeight: 52, paddingHorizontal: PAGE_LAYOUT.block, paddingVertical: PAGE_LAYOUT.gap },
  cnapSelectText: { color: COLORS.ink, flex: 1, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 13, paddingRight: 8 },
  cnapOptions: { borderColor: COLORS.border, borderRadius: 10, borderWidth: 1, marginTop: 6, overflow: "hidden" },
  cnapOption: { alignItems: "center", backgroundColor: "#ffffff", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 48, paddingHorizontal: PAGE_LAYOUT.block, paddingVertical: PAGE_LAYOUT.gap },
  cnapOptionActive: { backgroundColor: COLORS.navy },
  cnapOptionText: { color: COLORS.ink, flex: 1, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, paddingRight: 8 },
  cnapOptionTextActive: { color: "#ffffff", fontFamily: FONTS.medium, fontWeight: "500" },
  cnapInput: { backgroundColor: "#f8faff", borderColor: COLORS.controlBorder, borderRadius: 10, borderWidth: 1, color: COLORS.ink, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 13, marginTop: 6, minHeight: 52, paddingHorizontal: 16, paddingVertical: 11 },
  cnapTextarea: { minHeight: 96, paddingTop: 11 },
  cnapSubmitButton: { alignItems: "center", backgroundColor: COLORS.navy, borderRadius: 11, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: PAGE_LAYOUT.section, minHeight: 50, paddingHorizontal: PAGE_LAYOUT.block, paddingVertical: PAGE_LAYOUT.gap },
  cnapSubmitText: { color: "#ffffff", fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 13, flexShrink: 1, textAlign: "center" },
  cnapFormFootnote: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 11, lineHeight: 16, marginTop: 11 },
  cnapOfficialLink: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 10, marginTop: 13, padding: 13 },
  cnapOfficialLinkCopy: { flex: 1 },
  cnapOfficialLinkTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 13 },
  cnapOfficialLinkText: { color: COLORS.navy, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, marginTop: 3 },
  newsSourceLine: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 7, marginTop: 16, paddingVertical: 5 },
  newsSourceLineText: { color: COLORS.navy, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 12 },
  feedAlertCard: { alignItems: "flex-start", borderRadius: 14, flexDirection: "row", gap: 10, marginTop: 12, padding: 13 },
  feedAlertCardClear: { backgroundColor: "#eef8eb", borderColor: "#d7ead0", borderWidth: 1 },
  feedAlertCardActive: { backgroundColor: "#fff4f3", borderColor: "#f0b5b0", borderWidth: 1 },
  feedAlertIcon: { alignItems: "center", borderRadius: 10, height: 40, justifyContent: "center", width: 40 },
  feedAlertIconClear: { backgroundColor: "#dff1da" },
  feedAlertIconActive: { backgroundColor: "#ffe3e0" },
  feedAlertCopy: { flex: 1 },
  feedAlertKicker: { color: COLORS.green, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 9, letterSpacing: 0.45 },
  feedAlertKickerActive: { color: "#a31d1d" },
  feedAlertTitle: { color: "#245b31", fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 14, marginTop: 3 },
  feedAlertTitleActive: { color: "#8e1b1b" },
  feedAlertText: { color: "#3f6649", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 17, marginTop: 3 },
  feedAlertTextActive: { color: "#a54943" },
  feedAlertTime: { color: COLORS.muted, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 10, marginTop: 5 },
  feedAlertStale: { color: "#795000", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 10, lineHeight: 15, marginTop: 5 },
  alertEventCard: { alignItems: "center", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", gap: 9, minHeight: 66, paddingVertical: 11 },
  alertEventCardActive: {},
  alertEventCardClear: {},
  alertEventIcon: { alignItems: "center", height: 28, justifyContent: "center", width: 28 },
  alertEventCopy: { flex: 1 },
  alertEventTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 13 },
  alertEventText: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 11, lineHeight: 16, marginTop: 2 },
  alertEventTime: { color: COLORS.muted, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 11 },
  newsListHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
  newsListHeadingTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontWeight: "700", fontSize: 19 },
  newsListHeadingMeta: { color: COLORS.green, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 11 },
  newsDayGroup: { marginTop: 14 },
  newsDayHeading: { color: COLORS.muted, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 12, marginBottom: 1, textTransform: "uppercase" },
  newsArticleCard: { alignItems: "center", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", gap: 10, minHeight: 76, paddingVertical: 12 },
  newsArticleCopy: { flex: 1 },
  newsArticleTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  newsArticleIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 8, height: 32, justifyContent: "center", width: 32 },
  newsArticleDate: { color: COLORS.muted, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 11, marginTop: 5 },
  newsArticleTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 15, lineHeight: 20 },
  newsArticleAction: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 6, marginTop: 12 },
  newsArticleActionText: { color: COLORS.navy, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 12 },
  newsMoreLink: { alignItems: "center", alignSelf: "center", flexDirection: "row", gap: 6, marginTop: 18, paddingVertical: 7 },
  newsMoreLinkText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 13 },
  transportPageTitleRow: { alignItems: "flex-start", flexDirection: "row", gap: 10, justifyContent: "space-between", marginTop: 4 },
  transportPageTitleCopy: { flex: 1 },
  transportPageTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontWeight: "700", fontSize: 22, lineHeight: 28 },
  transportPageDescription: { color: "#596574", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 17, marginTop: 3, maxWidth: 235 },
  transportPlanMark: { alignItems: "center", flexDirection: "row", gap: 4, marginTop: 4 },
  transportPlanMarkAvailable: {},
  transportPlanMarkText: { color: "#795000", fontFamily: FONTS.medium, fontWeight: "500", fontSize: 10 },
  transportPlanMarkTextAvailable: { color: COLORS.green },
  transportSourceLine: { alignItems: "flex-start", backgroundColor: "#ffffff", borderColor: COLORS.border, borderLeftColor: COLORS.gold, borderLeftWidth: 3, borderRadius: 10, flexDirection: "row", gap: 8, marginTop: 15, padding: 11 },
  transportSourceCopy: { flex: 1 },
  transportSourceTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 12 },
  transportSourceText: { color: "#485768", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 17, marginTop: 3 },
  transportUpdatedAt: { color: COLORS.muted, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 11, marginTop: 6 },
  dataSourcesInlineLink: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 2, marginTop: 8 },
  dataSourcesInlineLinkText: { color: COLORS.navy, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 12 },
  transportDataMeta: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 5, marginTop: 9 },
  transportDataMetaText: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 11 },
  searchBox: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.controlBorder, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, marginTop: 14, minHeight: 48, paddingHorizontal: 12 },
  title: { color: "#071d31", fontSize: 28, fontWeight: "700", marginTop: 20 },
  hubContent: { flexGrow: 1, paddingBottom: PAGE_LAYOUT.bottom, paddingHorizontal: PAGE_LAYOUT.gutter, paddingTop: PAGE_LAYOUT.top },
  homeContent: { flexGrow: 1, paddingBottom: 28 },
  dashboardContent: { flexGrow: 1, paddingBottom: PAGE_LAYOUT.bottom, paddingHorizontal: PAGE_LAYOUT.gutter, paddingTop: PAGE_LAYOUT.top },
  dashboardTop: { alignItems: "center", flexDirection: "row", gap: PAGE_LAYOUT.gap, justifyContent: "space-between", marginTop: PAGE_LAYOUT.block },
  dashboardDateCopy: { flex: 1, minWidth: 0 },
  dashboardDate: { color: COLORS.muted, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 12 },
  dashboardDay: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontWeight: "700", fontSize: 25, letterSpacing: -0.5, lineHeight: 31 },
  dashboardCityChip: { alignItems: "center", backgroundColor: "transparent", flexDirection: "row", gap: 4, paddingHorizontal: 2, paddingVertical: 7 },
  dashboardCityText: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 13 },
  dashboardStatusGrid: { flexDirection: "row", gap: 10, marginTop: 17 },
  dashboardStatusCard: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 15, borderWidth: 1, flex: 1, minHeight: 118, padding: 14 },
  dashboardTransportCard: { backgroundColor: COLORS.blueSurface, borderColor: "#d3e4ff" },
  dashboardStatusTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 14, marginTop: 14 },
  dashboardStatusText: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 11, lineHeight: 16, marginTop: 4 },
  weatherPreviewIcon: { height: 34, marginLeft: -6, marginTop: -5, width: 34 },
  cityWeatherIcon: { height: 30, width: 30 },
  weatherPreviewTemperature: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontWeight: "700", fontSize: 27, marginTop: 2 },
  weatherFeatureCard: { alignItems: "stretch", backgroundColor: "#eaf2ff", borderColor: "#d4e3f7", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 8, marginTop: 15, minHeight: 100, overflow: "hidden", padding: 9 },
  weatherFeatureInfo: { flex: 1, flexDirection: "row", minWidth: 0 },
  weatherFeatureMain: { width: 104, flexShrink: 1, justifyContent: "center", minWidth: 0 },
  weatherFeatureLabel: { color: "#526d89", fontFamily: FONTS.medium, fontWeight: "500", fontSize: 11 },
  weatherFeatureTemperatureRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 4 },
  weatherFeatureTemperature: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontWeight: "700", fontSize: 35, letterSpacing: -1.5, lineHeight: 40 },
  weatherFeatureTemperatureCompact: { fontSize: 27, lineHeight: 34 },
  weatherFeatureIcon: { height: 42, width: 42 },
  weatherFeatureIconCompact: { height: 26, width: 26 },
  weatherFeatureCondition: { color: COLORS.navy, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 12, marginTop: 4 },
  weatherFeatureAir: { alignItems: "flex-start", justifyContent: "center", marginLeft: 8, paddingLeft: 0, width: 88 },
  weatherFeatureAirLabel: { color: COLORS.muted, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 11, marginTop: 3 },
  weatherFeatureAirValue: { color: COLORS.ink, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 14, marginTop: 2 },
  weatherFeatureAirMeta: { color: COLORS.muted, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 11, marginTop: 2 },
  weatherFeatureAlert: { alignItems: "center", borderRadius: 9, gap: 5, justifyContent: "center", minHeight: 80, paddingHorizontal: 6, width: 80, marginLeft: 4 },
  weatherFeatureAlertCompact: { width: 64 },
  weatherFeatureAlertClear: { backgroundColor: "#dff1da" },
  weatherFeatureAlertUnknown: { backgroundColor: "#fff3ce" },
  weatherFeatureAlertActive: { backgroundColor: "#ffe3e0" },
  weatherFeatureAlertText: { color: "#245b31", fontFamily: FONTS.medium, fontWeight: "500", fontSize: 11, lineHeight: 14, textAlign: "center" },
  weatherFeatureAlertTextActive: { color: "#8e1b1b" },
  weatherFeatureAlertTextUnknown: { color: "#735817" },
  weatherFeatureChevron: { position: "absolute", right: 5, top: 5 },
  airAlertBanner: { alignItems: "center", borderRadius: 12, flexDirection: "row", gap: 8, marginTop: 9, minHeight: 46, paddingHorizontal: 10, paddingVertical: 7 },
  airAlertBannerClear: { backgroundColor: "#eef8eb" },
  airAlertBannerActive: { backgroundColor: "#fff4f3", borderColor: "#f0b5b0", borderWidth: 1 },
  airAlertIcon: { alignItems: "center", borderRadius: 8, height: 30, justifyContent: "center", width: 30 },
  airAlertIconClear: { backgroundColor: "#dff1da" },
  airAlertIconActive: { backgroundColor: "#ffe3e0" },
  airAlertCopy: { flex: 1 },
  airAlertTitle: { color: COLORS.green, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 12 },
  airAlertTitleActive: { color: "#8e1b1b" },
  airAlertTextClear: { color: "#3f6649", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 10, marginTop: 1 },
  airAlertTextActive: { color: "#a54943" },
  defendersBanner: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 10, marginTop: 10, minHeight: 56, paddingHorizontal: 12, paddingVertical: 9 },
  defendersBannerGlow: {},
  defendersBannerIcon: { alignItems: "center", backgroundColor: "#fff3ce", borderRadius: 8, height: 32, justifyContent: "center", width: 32 },
  defendersBannerCopy: { flex: 1 },
  defendersBannerKicker: { color: "#f7be3d", fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 9, letterSpacing: 0.7 },
  defendersBannerTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 14, lineHeight: 19 },
  defendersBannerText: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 11, lineHeight: 15, marginTop: 2 },
  defendersBannerAction: {},
  defendersContent: { flexGrow: 1, paddingBottom: PAGE_LAYOUT.bottom, paddingHorizontal: PAGE_LAYOUT.gutter, paddingTop: PAGE_LAYOUT.top },
  defendersHero: { backgroundColor: "#173f37", borderRadius: 19, marginTop: 15, overflow: "hidden", padding: 19 },
  defendersHeroMark: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.09)", borderColor: "rgba(247,190,61,0.35)", borderRadius: 15, borderWidth: 1, height: 52, justifyContent: "center", width: 52 },
  defendersHeroKicker: { color: "#f7be3d", fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 10, letterSpacing: 0.9, marginTop: 18 },
  defendersHeroTitle: { color: "#ffffff", fontFamily: FONTS.bold, fontWeight: "700", fontSize: 25, lineHeight: 31, marginTop: 5 },
  defendersHeroText: { color: "#d9ece6", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 13, lineHeight: 20, marginTop: 8 },
  defendersIntro: { marginTop: 18 },
  defendersIntroTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontWeight: "700", fontSize: 25, lineHeight: 31 },
  defendersIntroText: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 13, lineHeight: 19, marginTop: 6 },
  featuredDonationCard: { backgroundColor: "#123a63", borderColor: "#285375", borderRadius: 15, borderWidth: 1, marginTop: 13, padding: 14 },
  featuredDonationTop: { alignItems: "center", flexDirection: "row", gap: 10 },
  featuredDonationIcon: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 10, height: 40, justifyContent: "center", width: 40 },
  featuredDonationCopy: { flex: 1 },
  featuredDonationLabel: { color: "#f7be3d", fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 9, letterSpacing: 0.7 },
  featuredDonationTitle: { color: "#ffffff", fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 16, marginTop: 3 },
  featuredDonationText: { color: "#d3e4ff", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 18, marginTop: 12 },
  featuredDonationButton: { alignItems: "center", backgroundColor: "#f7be3d", borderRadius: 10, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 13, minHeight: 44, paddingHorizontal: 13 },
  featuredDonationButtonText: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 13 },
  defendersTrustCard: { alignItems: "flex-start", backgroundColor: "#eef8eb", borderColor: "#d7ead0", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 10, marginTop: 13, padding: 13 },
  defendersTrustIcon: { alignItems: "center", backgroundColor: "#dff1da", borderRadius: 10, height: 39, justifyContent: "center", width: 39 },
  defendersTrustCopy: { flex: 1 },
  defendersTrustTitle: { color: "#245b31", fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 14 },
  defendersTrustText: { color: "#3f6649", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 18, marginTop: 3 },
  defendersFundList: { gap: 10, marginTop: 22 },
  defendersListTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontWeight: "700", fontSize: 19, marginBottom: 1 },
  defendersFundCard: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 15, borderWidth: 1, padding: 14 },
  defendersFundTop: { alignItems: "center", flexDirection: "row", gap: 10 },
  defendersFundIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 10, height: 41, justifyContent: "center", width: 41 },
  defendersFundCopy: { flex: 1 },
  defendersFundTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 15 },
  defendersFundVerified: { color: COLORS.green, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 11, marginTop: 3 },
  defendersFundDescription: { color: "#526170", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 13, lineHeight: 19, marginTop: 12 },
  defendersFundSource: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 11, lineHeight: 16, marginTop: 8 },
  defendersDonateButton: { alignItems: "center", backgroundColor: "#173f37", borderRadius: 10, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 13, minHeight: 46, paddingHorizontal: 13 },
  defendersDonateButtonText: { color: "#ffffff", fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 13 },
  defendersEmptyCard: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 15, borderStyle: "dashed", borderWidth: 1, marginTop: 22, padding: 20 },
  defendersEmptyIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 14, height: 48, justifyContent: "center", width: 48 },
  defendersEmptyTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 16, marginTop: 12 },
  defendersEmptyText: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 18, marginTop: 6, textAlign: "center" },
  defendersFootnote: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 11, lineHeight: 16, marginTop: 20, textAlign: "center" },
  currencyWidget: { borderBottomColor: COLORS.border, borderBottomWidth: 1, borderTopColor: COLORS.border, borderTopWidth: 1, marginTop: 22, paddingVertical: 12 },
  currencyWidgetHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  currencyWidgetTitleRow: { alignItems: "center", flexDirection: "row", gap: 7 },
  currencyWidgetTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 14 },
  currencyWidgetSource: { color: COLORS.muted, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 11 },
  currencyRatesRow: { flexDirection: "row", gap: 9, marginTop: 13 },
  currencyRate: { borderLeftColor: COLORS.border, borderLeftWidth: 1, flex: 1, paddingHorizontal: 9, paddingVertical: 4 },
  currencyCode: { color: COLORS.navy, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 11 },
  currencyValue: { color: COLORS.ink, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 14, marginTop: 3 },
  currencyMeta: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 10, marginTop: 1 },
  currencyUnavailable: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, marginTop: 13 },
  currencyStale: { color: "#795000", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 10, marginTop: 8 },
  currencyExpand: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 4, marginTop: 10, minHeight: 30 },
  currencyExpandText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 12 },
  weatherContent: { paddingBottom: PAGE_LAYOUT.bottom, paddingHorizontal: PAGE_LAYOUT.gutter, paddingTop: PAGE_LAYOUT.top },
  weatherHero: { backgroundColor: COLORS.navy, borderRadius: 16, marginTop: 16, padding: 16 },
  weatherHeroTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  weatherHeroTemperature: { color: "#ffffff", fontFamily: FONTS.bold, fontWeight: "700", fontSize: 52, letterSpacing: -2 },
  weatherHeroCondition: { color: "#d3e4ff", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 14, marginTop: 2 },
  weatherHeroIcon: { height: 78, width: 78 },
  weatherMetrics: { borderTopColor: "rgba(255,255,255,0.18)", borderTopWidth: 1, flexDirection: "row", gap: 8, marginTop: 16, paddingTop: 13 },
  weatherMetric: { flex: 1 },
  weatherMetricLabel: { color: "#d3e4ff", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 10, marginTop: 5 },
  weatherMetricValue: { color: "#ffffff", fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 12, marginTop: 2 },
  weatherAirQualityCard: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, flexDirection: "row", marginTop: 12, padding: 13 },
  weatherAirQualityIcon: { alignItems: "center", backgroundColor: "#eef7eb", borderRadius: 10, height: 40, justifyContent: "center", width: 40 },
  weatherAirQualityCopy: { flex: 1, marginLeft: 10 },
  weatherAirQualityLabel: { color: COLORS.muted, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 11 },
  weatherAirQualityValue: { color: COLORS.ink, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 14, marginTop: 3 },
  weatherAirQualityMeta: { color: COLORS.muted, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 10, lineHeight: 15, textAlign: "right" },
  weatherDayTabs: { gap: 5, paddingTop: 18 },
  weatherDayTab: { backgroundColor: COLORS.blueSurface, borderRadius: 9, minWidth: 96, paddingHorizontal: 11, paddingVertical: 8 },
  weatherDayTabActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  weatherDayTabText: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 12 },
  weatherDayTabTextActive: { color: "#ffffff" },
  weatherDayTabTemperature: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 11, marginTop: 4 },
  weatherDaySummary: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", marginTop: 14, padding: 14 },
  weatherDaySummaryTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 14 },
  weatherDaySummaryText: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, marginTop: 4 },
  weatherSunTimes: { gap: 4 },
  weatherSunTime: { color: COLORS.navy, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 12 },
  weatherSectionTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 16, marginTop: 22 },
  weatherHours: { borderBottomColor: COLORS.border, borderBottomWidth: 1, borderTopColor: COLORS.border, borderTopWidth: 1, gap: 0, marginTop: 10, paddingVertical: 10 },
  weatherHourCard: { alignItems: "center", minWidth: 64, paddingHorizontal: 6, paddingVertical: 4 },
  weatherHourTime: { color: COLORS.muted, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 10 },
  weatherHourIcon: { height: 32, marginVertical: 4, width: 32 },
  weatherHourTemperature: { color: COLORS.ink, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 14 },
  weatherHourRain: { color: COLORS.navy, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 10, marginTop: 3 },
  weatherSource: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 17, marginTop: 22, textAlign: "center" },
  weatherStale: { color: "#795000", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 11, marginTop: 5, textAlign: "center" },
  dashboardSectionRow: { alignItems: "center", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", marginTop: 27, paddingBottom: 9 },
  dashboardSectionTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontWeight: "700", fontSize: 17 },
  dashboardAllLink: { color: COLORS.navy, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 13 },
  smallAction: { minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "center" },
  dashboardFeedCard: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 13, borderWidth: 1, flexDirection: "row", gap: 11, marginTop: 9, padding: 13 },
  dashboardFeedIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 10, height: 42, justifyContent: "center", width: 42 },
  dashboardFeedCopy: { flex: 1 },
  dashboardFeedTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 14 },
  dashboardFeedText: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 11, lineHeight: 16, marginTop: 3 },
  homeNewsList: { marginTop: 4 },
  homeNewsItem: { alignItems: "center", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", gap: 8, paddingVertical: 12 },
  homeNewsIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 8, height: 32, justifyContent: "center", width: 32 },
  homeNewsCopy: { flex: 1 },
  homeNewsTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 14, lineHeight: 19 },
  homeNewsMeta: { color: COLORS.tertiary, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, marginTop: 3 },
  homeNewsAllButton: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 7, paddingTop: 12 },
  homeNewsAllText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 13 },
  dashboardServicesRow: { gap: 10, paddingTop: 10, paddingRight: 4 },
  dashboardServicesGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: PAGE_LAYOUT.fieldGap, columnGap: "4%", paddingTop: PAGE_LAYOUT.fieldGap },
  dashboardServiceCard: { gap: 4, justifyContent: "center", minHeight: 76, padding: 10, width: "48%" },
  dashboardServiceBody: { alignItems: "center", flexDirection: "row", gap: 6, minHeight: 28 },
  dashboardInfoText: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 14, lineHeight: 20 },
  dashboardServiceIcon: { borderRadius: 7, height: 24, width: 24 },
  dashboardServiceTitle: { fontSize: 12, lineHeight: 16, minWidth: 0 },
  dashboardServiceTestLabel: { fontSize: 11, lineHeight: 14 },
  simpleTabContent: { flexGrow: 1, paddingBottom: PAGE_LAYOUT.bottom, paddingHorizontal: PAGE_LAYOUT.gutter, paddingTop: PAGE_LAYOUT.top },
  cityKicker: { color: "#43474e", fontSize: 12, fontWeight: "700", letterSpacing: 1.1, marginTop: 20 },
  homeTitle: { color: "#071d31", fontSize: 28, fontWeight: "700", marginTop: 6 },
  homeIntro: { color: "#43474e", fontSize: 16, lineHeight: 23, marginTop: 8 },
  statusBanner: { alignItems: "center", backgroundColor: "#eef4ff", borderRadius: 14, flexDirection: "row", gap: 8, marginTop: 20, padding: 13 },
  statusDot: { color: "#3d6836", fontSize: 15 },
  statusText: { color: "#071d31", fontSize: 14, fontWeight: "700" },
  homeTransportCard: { backgroundColor: "#123a63", borderRadius: 18, marginTop: 18, padding: 20 },
  homeTransportKicker: { color: "#f7be3d", fontSize: 12, fontWeight: "700", letterSpacing: 0.6 },
  homeTransportTitle: { color: "#ffffff", fontSize: 22, fontWeight: "700", marginTop: 13 },
  homeTransportText: { color: "#d3e4ff", fontSize: 15, lineHeight: 21, marginTop: 7 },
  homeTransportAction: { color: "#ffdea2", fontSize: 15, fontWeight: "700", marginTop: 18 },
  homeFeatureGrid: { flexDirection: "row", gap: 12, marginTop: 12 },
  homeFeatureCard: { backgroundColor: "#ffffff", borderColor: "#e2e8f0", borderRadius: 16, borderWidth: 1, flex: 1, minHeight: 176, padding: 14 },
  homeFeatureIcon: { color: "#3d6836", fontSize: 25, fontWeight: "700" },
  homeFeatureTitle: { color: "#071d31", fontSize: 15, fontWeight: "700", marginTop: 11 },
  homeFeatureText: { color: "#43474e", fontSize: 13, lineHeight: 18, marginTop: 5 },
  homeFeatureAction: { color: "#123a63", fontSize: 13, fontWeight: "700", marginTop: "auto" },
  homeRow: { alignItems: "center", backgroundColor: "#ffffff", borderColor: "#e2e8f0", borderRadius: 16, borderWidth: 1, flexDirection: "row", gap: 12, marginTop: 12, padding: 16 },
  homeRowIcon: { color: "#123a63", fontSize: 25, width: 30 },
  homeRowText: { flex: 1 },
  homeRowTitle: { color: "#071d31", fontSize: 16, fontWeight: "700" },
  homeRowDescription: { color: "#43474e", fontSize: 13, marginTop: 4 },
  homeChevron: { color: "#5b6e80", fontSize: 28 },
  bottomNavigation: { backgroundColor: "rgba(255,255,255,0.97)", borderTopColor: COLORS.border, borderTopWidth: 1, flexDirection: "row", paddingHorizontal: 8, paddingVertical: 8 },
  tabButton: { alignItems: "center", justifyContent: "center", flex: 1, minHeight: 48, paddingHorizontal: 4, paddingVertical: 4 },
  tabIcon: { color: COLORS.muted, fontSize: 21, lineHeight: 23 },
  tabLabel: { color: COLORS.muted, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 10, marginTop: 4 },
  tabActive: { color: COLORS.navy, fontFamily: FONTS.semibold, fontWeight: "600" },
  hubSubtitle: { color: "#123a63", fontSize: 18, fontWeight: "700", marginTop: 8 },
  hubIntro: { color: "#43474e", fontSize: 16, lineHeight: 23, marginTop: 8 },
  sectionLabel: { color: "#4b5563", fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 11, letterSpacing: 0.7, marginTop: 0, textTransform: "uppercase" },
  serviceCard: { alignItems: "flex-start", backgroundColor: "#ffffff", borderColor: "#e2e8f0", borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 14, marginTop: 12, padding: 16 },
  transportServiceCard: { backgroundColor: "#eef4ff", borderColor: "#d3e4ff", marginTop: 24 },
  serviceIcon: { alignItems: "center", backgroundColor: "#eef4ff", borderRadius: 14, height: 48, justifyContent: "center", width: 48 },
  serviceIconText: { color: "#123a63", fontSize: 24, fontWeight: "700" },
  serviceTextBlock: { flex: 1 },
  serviceTitle: { color: "#071d31", fontSize: 17, fontWeight: "700" },
  serviceDescription: { color: "#43474e", fontSize: 14, lineHeight: 20, marginTop: 4 },
  serviceAction: { color: "#123a63", fontSize: 14, fontWeight: "700", marginTop: 10 },
  hubFootnote: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 11, lineHeight: 17, textAlign: "center" },
  detailIntro: { marginTop: 13 },
  serviceDetailsContent: { alignItems: "stretch", paddingBottom: PAGE_LAYOUT.bottom, paddingHorizontal: PAGE_LAYOUT.gutter, paddingTop: PAGE_LAYOUT.top },
  serviceDetailsIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 16, height: 58, justifyContent: "center", width: 58, marginTop: PAGE_LAYOUT.block },
  serviceDetailsIconText: { color: COLORS.navy, fontFamily: FONTS.bold, fontWeight: "700", fontSize: 30 },
  detailTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontWeight: "700", fontSize: 25, letterSpacing: -0.3, lineHeight: 31, marginTop: 7 },
  detailDescription: { color: "#596574", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 14, lineHeight: 21, marginTop: 6 },
  serviceDetailsTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontWeight: "700", fontSize: 25, letterSpacing: -0.3, marginTop: 15 },
  serviceDetailsDescription: { color: "#596574", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 14, lineHeight: 21, marginTop: 6 },
  serviceNotice: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderLeftColor: COLORS.gold, borderLeftWidth: 3, borderRadius: 14, borderWidth: 1, marginTop: 20, padding: 14 },
  serviceNoticeTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 15 },
  serviceNoticeText: { color: "#596574", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 13, lineHeight: 19, marginTop: 6 },
  serviceComingSoon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 12, flexDirection: "row", gap: 9, marginTop: 16, padding: 13 },
  serviceComingSoonText: { color: "#3f5269", flex: 1, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 18 },
  externalButton: { alignItems: "center", backgroundColor: COLORS.navy, borderRadius: 10, marginTop: 16, minHeight: 50, padding: 15 },
  externalButtonText: { color: "#ffffff", fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 14 },
  externalHint: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 18, marginTop: 12, textAlign: "center" },
  silencePanel: { alignItems: "center", backgroundColor: COLORS.navyDark, borderRadius: 16, marginTop: 20, padding: 22 },
  silenceTime: { color: "#ffffff", fontFamily: FONTS.bold, fontWeight: "700", fontSize: 40 },
  silenceTitle: { color: "#eef4ff", fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 14, marginTop: 8, textAlign: "center" },
  silenceCountdown: { color: "#d3e4ff", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, marginTop: 8, textAlign: "center" },
  silenceContent: { paddingBottom: PAGE_LAYOUT.bottom, paddingHorizontal: PAGE_LAYOUT.gutter, paddingTop: PAGE_LAYOUT.top },
  silenceHero: { alignItems: "center", backgroundColor: COLORS.navyDark, borderRadius: 18, marginTop: 20, overflow: "hidden", padding: 24 },
  silenceHeroIcon: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 28, height: 56, justifyContent: "center", width: 56 },
  silenceHeroKicker: { color: "#d3e4ff", fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 11, letterSpacing: 1, marginTop: 14 },
  silenceHeroTime: { color: "#ffffff", fontFamily: FONTS.bold, fontWeight: "700", fontSize: 45, letterSpacing: -1, marginTop: 4 },
  silenceHeroText: { color: "#d3e4ff", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 13, marginTop: 4, textAlign: "center" },
  remembranceCard: { alignItems: "flex-start", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 11, marginTop: 14, padding: 14 },
  remembranceIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 10, height: 42, justifyContent: "center", width: 42 },
  remembranceCopy: { flex: 1 },
  remembranceTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 14 },
  remembranceText: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 18, marginTop: 4 },
  accessibilityTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontWeight: "700", fontSize: 25, marginTop: 18 },
  accessibilityIntro: { color: "#596574", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 14, lineHeight: 21, marginTop: 6 },
  inlineLoader: { marginTop: 12 },
  inlineError: { backgroundColor: "#fff5f4", borderColor: "#f4ceca", borderRadius: 12, borderWidth: 1, marginTop: 12, padding: 14 },
  inlineErrorText: { color: "#991b1b", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 13 },
  inlineRetry: { color: COLORS.navy, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 13, paddingVertical: 12, minHeight: 44 },
  accessibilityList: { gap: 12, paddingBottom: 30, paddingHorizontal: 20, paddingTop: 16 },
  accessibilityCount: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, marginBottom: 2 },
  staleData: { color: "#795000", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 18, marginBottom: 4 },
  accessibilityCard: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, padding: 14 },
  accessibilityBuildingName: { color: COLORS.ink, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 15 },
  accessibilityAddress: { color: "#596574", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 13, lineHeight: 19, marginTop: 6 },
  accessibilityDate: { color: COLORS.navy, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 12, marginTop: 9 },
  accessibilityFooter: { marginTop: 8 },
  accessibilityNote: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 18, textAlign: "center" },
  miniaturesList: { gap: 10, paddingBottom: 32, paddingHorizontal: 20, paddingTop: 16 },
  miniaturesMapCard: { borderColor: COLORS.border, borderRadius: 15, borderWidth: 1, height: 220, overflow: "hidden" },
  miniaturesCountRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  miniaturesCountPill: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 14, flexDirection: "row", gap: 5, paddingHorizontal: 10, paddingVertical: 6 },
  miniaturesCountText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 11 },
  miniaturesSourceDate: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 10 },
  miniaturesNotice: { alignItems: "flex-start", backgroundColor: COLORS.blueSurface, borderRadius: 13, flexDirection: "row", gap: 9, marginTop: 12, padding: 12 },
  miniaturesNoticeText: { color: "#3f5269", flex: 1, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 11, lineHeight: 16 },
  miniaturesListTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 16, marginTop: 9 },
  miniatureCard: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, padding: 14 },
  miniatureCardTop: { alignItems: "center", flexDirection: "row", gap: 10 },
  miniatureNumber: { alignItems: "center", backgroundColor: COLORS.navy, borderRadius: 11, height: 35, justifyContent: "center", width: 35 },
  miniatureNumberText: { color: "#ffffff", fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 13 },
  miniatureCardCopy: { flex: 1 },
  miniatureTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 15 },
  miniatureAddress: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 11, lineHeight: 16, marginTop: 3 },
  miniatureSummary: { color: "#596574", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 18, marginTop: 11 },
  miniatureMeta: { flexDirection: "row", flexWrap: "wrap", marginTop: 9 },
  miniatureMetaText: { color: COLORS.muted, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 10 },
  miniatureMapAction: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 5, minHeight: 44, paddingVertical: 6, marginTop: 2 },
  miniatureMapActionText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 12 },
  miniaturesFooter: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 11, lineHeight: 17, marginHorizontal: 14, marginTop: 10, textAlign: "center" },
  sourceButton: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 10, flexDirection: "row", gap: 7, justifyContent: "center", marginTop: 14, minHeight: 46 },
  sourceButtonText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 13 },
  paymentContent: { flexGrow: 1, paddingBottom: PAGE_LAYOUT.bottom, paddingHorizontal: PAGE_LAYOUT.gutter, paddingTop: PAGE_LAYOUT.top },
  paymentHero: { backgroundColor: COLORS.navy, borderRadius: 18, marginTop: 15, padding: 18 },
  paymentHeroTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  paymentHeroIcon: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, height: 48, justifyContent: "center", width: 48 },
  paymentHeroTitle: { color: "#ffffff", fontFamily: FONTS.bold, fontWeight: "700", fontSize: 24, marginTop: 17 },
  paymentHeroText: { color: "#d3e4ff", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 13, lineHeight: 20, marginTop: 7 },
  paymentSafetyNote: { alignItems: "flex-start", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 13, borderWidth: 1, flexDirection: "row", gap: 9, marginTop: 12, padding: 12 },
  paymentSafetyText: { color: COLORS.navyDark, flex: 1, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 18 },
  paymentCard: { marginTop: 20 },
  paymentSectionTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 15, marginBottom: 9 },
  paymentTicketChoice: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 11, borderWidth: 1, flexDirection: "row", gap: 10, marginBottom: 22, padding: 12 },
  paymentReferenceBlock: { marginBottom: 22, marginTop: 14 },
  paymentReferenceHint: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 11, lineHeight: 16, marginTop: 7 },
  paymentTicketIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 10, height: 42, justifyContent: "center", width: 42 },
  paymentTicketCopy: { flex: 1 },
  paymentTicketTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 14 },
  paymentTicketText: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 11, marginTop: 3 },
  paymentTicketPrice: { color: COLORS.navy, fontFamily: FONTS.bold, fontWeight: "700", fontSize: 15 },
  paymentMethod: { alignItems: "center", borderColor: COLORS.controlBorder, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 10, marginTop: 8, minHeight: 62, padding: 11 },
  paymentMethodActive: { backgroundColor: "#f3f8ff", borderColor: COLORS.controlBorder },
  paymentMethodIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 9, height: 38, justifyContent: "center", width: 38 },
  paymentMethodCopy: { flex: 1 },
  paymentMethodTitle: { color: COLORS.ink, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 13 },
  paymentMethodText: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 11, marginTop: 3 },
  paymentCardFields: { marginTop: 14 },
  paymentCardFieldsRow: { flexDirection: "row", gap: 9, marginTop: 10 },
  paymentCardFieldHalf: { flex: 1 },
  paymentFieldLabel: { color: COLORS.navyDark, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 12, marginBottom: 6 },
  paymentLast4Label: { marginTop: 14 },
  paymentCardInput: { backgroundColor: "#ffffff", borderColor: COLORS.controlBorder, borderRadius: 9, borderWidth: 1, color: COLORS.ink, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 14, minHeight: 52, paddingHorizontal: PAGE_LAYOUT.block, paddingVertical: PAGE_LAYOUT.gap },
  accountModeRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  accountMode: { alignItems: "center", justifyContent: "center", backgroundColor: COLORS.blueSurface, borderRadius: 9, flex: 1, minHeight: 48, paddingHorizontal: PAGE_LAYOUT.fieldGap, paddingVertical: PAGE_LAYOUT.gap },
  accountModeActive: { backgroundColor: "#123a63" },
  accountModeText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 12 },
  accountModeTextActive: { color: "#ffffff" },
  accountPasswordLabel: { marginTop: 12 },
  accountError: { color: "#a31d1d", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 17, marginTop: 10 },
  accountSubmitDisabled: { opacity: 0.55 },
  pollResult: { alignItems: "flex-start", backgroundColor: COLORS.blueSurface, borderRadius: 10, flexDirection: "row", gap: 9, marginTop: 13, padding: 12 },
  pollResultText: { color: COLORS.navyDark, flex: 1, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 18 },
  paymentAddCardRow: { alignItems: "center", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", gap: 8, marginTop: 10, minHeight: 48, paddingHorizontal: 3 },
  paymentAddCardText: { color: COLORS.navy, flex: 1, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 13 },
  paymentSubmitButton: { alignItems: "center", backgroundColor: COLORS.navy, borderRadius: 11, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: PAGE_LAYOUT.section, minHeight: 50, paddingHorizontal: PAGE_LAYOUT.block, paddingVertical: PAGE_LAYOUT.gap },
  paymentSubmitButtonDisabled: { backgroundColor: "#90a0b2" },
  paymentSubmitText: { color: "#ffffff", fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 13, flexShrink: 1, textAlign: "center" },
  savedPaymentCard: { backgroundColor: COLORS.navy, borderRadius: 15, marginTop: 2, overflow: "hidden", padding: 15 },
  savedPaymentCardTop: { alignItems: "center", flexDirection: "row", gap: 11 },
  savedPaymentCardIcon: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 10, height: 42, justifyContent: "center", width: 42 },
  savedPaymentCardLabel: { color: "#d7e9fb", fontFamily: FONTS.medium, fontWeight: "500", fontSize: 12 },
  savedPaymentCardNumber: { color: "#ffffff", fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 17, letterSpacing: 0.7, marginTop: 4 },
  removePaymentCardButton: { alignItems: "center", backgroundColor: "#ffffff", borderRadius: 9, flexDirection: "row", gap: 7, justifyContent: "center", marginTop: 15, minHeight: 44 },
  removePaymentCardText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 12 },
  paymentMethodsFootnote: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 11, lineHeight: 17, marginTop: 18, textAlign: "center" },
  paymentFootnote: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 11, lineHeight: 16, marginTop: 11, textAlign: "center" },
  paymentSuccessHero: { marginTop: 18 },
  paymentSuccessIcon: { alignItems: "center", backgroundColor: COLORS.green, borderRadius: 28, height: 56, justifyContent: "center", width: 56 },
  paymentSuccessKicker: { color: "#b9e7b2", fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 10, letterSpacing: 0.8, marginTop: 12 },
  paymentSuccessTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontWeight: "700", fontSize: 24 },
  paymentSuccessText: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 13, lineHeight: 19, marginTop: 6 },
  demoTicket: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 17, borderStyle: "dashed", borderWidth: 1, marginTop: 14, overflow: "hidden", padding: 16 },
  demoTicketTop: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  demoTicketLabel: { color: COLORS.navy, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 10, letterSpacing: 0.7 },
  demoTicketTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontWeight: "700", fontSize: 20, marginTop: 4 },
  demoQr: { alignItems: "center", borderBottomColor: COLORS.border, borderBottomWidth: 1, borderTopColor: COLORS.border, borderTopWidth: 1, marginTop: 15, paddingVertical: 16 },
  demoQrInner: { alignItems: "center", backgroundColor: "#f4f7fb", borderRadius: 8, height: 96, justifyContent: "center", width: 96 },
  demoTicketMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 13 },
  demoTicketMetaText: { color: COLORS.muted, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 11 },
  paymentNextCard: { backgroundColor: COLORS.blueSurface, borderRadius: 14, marginTop: 13, padding: 14 },
  paymentNextTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 14 },
  paymentNextText: { color: "#40546b", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 18, marginTop: 5 },
  paymentSecondaryButton: { alignItems: "center", alignSelf: "center", flexDirection: "row", gap: 7, marginTop: 18, padding: 8 },
  paymentSecondaryButtonText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 13 },
  eventsContent: { flexGrow: 1, paddingBottom: PAGE_LAYOUT.bottom, paddingHorizontal: PAGE_LAYOUT.gutter, paddingTop: PAGE_LAYOUT.top },
  eventsSourceNote: { alignItems: "flex-start", backgroundColor: COLORS.blueSurface, borderRadius: 12, flexDirection: "row", gap: 9, marginTop: 14, padding: 12 },
  eventsSourceText: { color: COLORS.navyDark, flex: 1, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 18 },
  eventsDayGroup: { marginTop: 19 },
  eventsDayHeading: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 15, marginBottom: 7 },
  eventsList: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  eventRow: { alignItems: "center", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", gap: 10, minHeight: 76, paddingHorizontal: 12, paddingVertical: 10 },
  eventDateBadge: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 9, height: 42, justifyContent: "center", width: 42 },
  eventDateBadgeDay: { color: COLORS.navy, fontFamily: FONTS.bold, fontWeight: "700", fontSize: 16, lineHeight: 17 },
  eventDateBadgeMonth: { color: COLORS.navy, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 8, letterSpacing: 0.4, marginTop: 1 },
  eventCopy: { flex: 1 },
  eventTopLine: { alignItems: "flex-start", flexDirection: "row", gap: 7 },
  eventTitle: { color: COLORS.ink, flex: 1, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 13, lineHeight: 18 },
  eventCategory: { color: COLORS.navy, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 10, maxWidth: 64, textAlign: "right" },
  eventMeta: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 11, lineHeight: 16, marginTop: 3 },
  parkingContent: { paddingBottom: PAGE_LAYOUT.bottom, paddingHorizontal: PAGE_LAYOUT.gutter, paddingTop: PAGE_LAYOUT.top },
  parkingHero: { backgroundColor: COLORS.navy, borderRadius: 16, marginTop: 18, padding: 17 },
  parkingHeroTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  parkingHeroIcon: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 10, height: 42, justifyContent: "center", width: 42 },
  parkingHeroBadge: { backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(247,190,61,0.35)", borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5 },
  parkingHeroBadgeText: { color: "#f7be3d", fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 9, letterSpacing: 0.5 },
  parkingHeroTitle: { color: "#ffffff", fontFamily: FONTS.bold, fontWeight: "700", fontSize: 20, marginTop: 15 },
  parkingHeroText: { color: "#d3e4ff", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 13, lineHeight: 19, marginTop: 6 },
  parkingSectionHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  parkingActionList: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, marginTop: 16, overflow: "hidden" },
  parkingActionRow: { alignItems: "center", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", gap: 11, minHeight: 76, paddingHorizontal: 12, paddingVertical: 10 },
  parkingActionCard: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, marginTop: 1, padding: 14 },
  parkingActionHeading: { alignItems: "center", flexDirection: "row", gap: 10 },
  parkingActionIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 9, height: 37, justifyContent: "center", width: 37 },
  parkingActionCopy: { flex: 1 },
  parkingActionTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 14, lineHeight: 19 },
  parkingActionText: { color: "#596574", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 17, marginTop: 2 },
  parkingActionLink: { color: COLORS.navy, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 12, marginTop: 10 },
  parkingInfoNote: { alignItems: "flex-start", backgroundColor: "#fff8e9", borderColor: "#f2dcaa", borderRadius: 13, borderWidth: 1, flexDirection: "row", gap: 9, marginTop: 14, padding: 12 },
  parkingInfoCopy: { flex: 1 },
  parkingUnavailable: { backgroundColor: "#fff8e9", borderColor: "#f2dcaa", borderRadius: 14, borderWidth: 1, marginTop: 7, padding: 14 },
  parkingUnavailableTitle: { color: "#624600", fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 14 },
  parkingUnavailableText: { color: "#735817", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 18, marginTop: 7 },
  parkingUnavailableLink: { color: "#624600", fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 12, marginTop: 10 },
  subtitle: { color: "#43474e", fontSize: 16, marginTop: 4 },
  dataUpdated: { color: "#5b6e80", fontSize: 13, marginTop: 6 },
  dataSourcesLink: { color: "#123a63", fontSize: 13, fontWeight: "700", marginTop: 8 },
  searchInput: { color: COLORS.ink, flex: 1, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 13, paddingVertical: 10 },
  searchModes: { flexDirection: "row", gap: 8, marginTop: 11 },
  searchMode: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.controlBorder, borderRadius: 9, borderWidth: 1, flex: 1, minHeight: 44, justifyContent: "center" },
  searchModeActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  searchModeText: { color: "#596574", fontFamily: FONTS.medium, fontWeight: "500", fontSize: 12 },
  searchModeTextActive: { color: "#ffffff", fontFamily: FONTS.semibold, fontWeight: "600" },
  list: { paddingBottom: 22, paddingHorizontal: 20, paddingTop: 16 },
  transportListHeading: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 15, marginBottom: 9 },
  transportSavedHint: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 11, marginTop: -4 },
  routeCard: { alignItems: "center", backgroundColor: "#ffffff", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", gap: 11, minHeight: 64, paddingHorizontal: 11, paddingVertical: 8 },
  routeTapArea: { flex: 1, minWidth: 0, minHeight: 48, flexDirection: "row", gap: 11, alignItems: "center" },
  routeBadge: { alignItems: "center", backgroundColor: "#123a63", borderRadius: 8, justifyContent: "center", minWidth: 47, paddingHorizontal: 7, paddingVertical: 8 },
  routeBadgeText: { color: "#ffffff", fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 15 },
  routeCardCopy: { flex: 1 },
  routeName: { color: COLORS.ink, flex: 1, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 14, lineHeight: 19 },
  routeCardMeta: { color: COLORS.tertiary, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, marginTop: 3 },
  favoriteButton: { alignItems: "center", borderRadius: 22, height: 44, justifyContent: "center", width: 44 },
  stopCard: { alignItems: "center", backgroundColor: "#ffffff", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", gap: 10, minHeight: 64, paddingHorizontal: 11, paddingVertical: 8 },
  stopCardText: { flex: 1 },
  stopCardName: { color: COLORS.ink, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 14, lineHeight: 19 },
  stopCardAction: { color: COLORS.tertiary, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 12, marginTop: 3 },
  empty: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", textAlign: "center" },
  transportEmptyState: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, marginTop: 6, padding: 22 },
  transportEmptyIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 24, height: 48, justifyContent: "center", width: 48 },
  transportEmptyTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 15, marginTop: 12, textAlign: "center" },
  transportEmptyText: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 18, marginTop: 6, textAlign: "center" },
  transportEmptyActions: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 16 },
  transportEmptyPrimaryAction: { backgroundColor: COLORS.navy, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  transportEmptyPrimaryActionText: { color: "#ffffff", fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 12 },
  transportEmptySecondaryAction: { backgroundColor: COLORS.blueSurface, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  transportEmptySecondaryActionText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 12 },
  back: { color: "#123a63", fontSize: 16, fontWeight: "600", marginTop: 20 },
  stopDetailsHeading: { alignItems: "flex-start", flexDirection: "row", gap: 8, justifyContent: "space-between", marginTop: 16 },
  stopDetailsTitle: { color: COLORS.navyDark, flex: 1, fontFamily: FONTS.bold, fontWeight: "700", fontSize: 23, lineHeight: 29 },
  stopDetailsSubtitle: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 13, marginTop: 4 },
  stopDetailsCode: { color: COLORS.muted, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 12, marginTop: 4 },
  routeHeader: { alignItems: "center", flexDirection: "row", gap: 12, marginVertical: 16 },
  routeDetailHero: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, marginBottom: 12, marginTop: 10, padding: 14 },
  routeDetailTopLine: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  routeDetailRouteIdentity: { alignItems: "center", flexDirection: "row", gap: 8 },
  routeDetailRouteLabel: { color: COLORS.muted, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 14 },
  routeDetailRouteBadge: { alignItems: "center", backgroundColor: "#123a63", borderRadius: 10, height: 44, justifyContent: "center", minWidth: 52, paddingHorizontal: 10 },
  routeDetailRouteNumber: { color: "#ffffff", fontFamily: FONTS.bold, fontWeight: "700", fontSize: 24, lineHeight: 30 },
  routeDetailPlanMark: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 8, flexDirection: "row", gap: 5, paddingHorizontal: 8, paddingVertical: 6 },
  routeDetailPlanMarkText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 9, letterSpacing: 0.5 },
  routeDetailTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontWeight: "700", fontSize: 19, lineHeight: 25, marginTop: 10 },
  routeDetailTermini: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 18, marginTop: 5 },
  routeDetailSource: { alignItems: "center", flexDirection: "row", gap: 6, marginTop: 14 },
  routeDetailSourceText: { color: "#d3e4ff", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 11, flex: 1, lineHeight: 16 },
  routeMapPreview: { borderColor: COLORS.border, borderRadius: 13, borderWidth: 1, height: 170, marginBottom: 10, overflow: "hidden" },
  routeMapPreviewMap: { flex: 1 },
  routeMapPreviewLabel: { backgroundColor: "rgba(255,255,255,0.96)", borderColor: "#d4e0ec", borderRadius: 8, borderWidth: 1, bottom: 10, left: 10, paddingHorizontal: 10, paddingVertical: 7, position: "absolute" },
  routeMapPreviewLabelText: { color: "#123a63", fontFamily: FONTS.medium, fontWeight: "500", fontSize: 11 },
  transportDataNotice: { backgroundColor: "#eef4ff", borderRadius: 14, marginTop: 14, padding: 13 },
  transportDataNoticeTitle: { color: "#123a63", fontSize: 14, fontWeight: "700" },
  transportDataNoticeText: { color: "#43474e", fontSize: 13, lineHeight: 18, marginTop: 5 },
  hint: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 17, marginBottom: 8 },
  mapButton: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 10, flexDirection: "row", gap: 8, justifyContent: "center", marginBottom: 14, minHeight: 47, padding: 13 },
  mapButtonText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 13 },
  stopsIntro: { alignItems: "center", flexDirection: "row", gap: PAGE_LAYOUT.gap, justifyContent: "space-between", marginTop: PAGE_LAYOUT.fieldGap, marginBottom: PAGE_LAYOUT.block },
  stopsIntroCopy: { flex: 1, minWidth: 0 },
  stopsHeading: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 16 },
  stopsCountPill: { alignItems: "center", backgroundColor: "#e7eeff", borderRadius: 14, height: 28, justifyContent: "center", minWidth: 28, paddingHorizontal: 8 },
  stopsCountText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 12 },
  transportDetailScreen: { flex: 1, backgroundColor: "#f6f7fb" },
  stopDetailsList: { paddingBottom: PAGE_LAYOUT.bottom, paddingTop: PAGE_LAYOUT.block },
  detailsList: { paddingBottom: 32 },
  routeDetailsContent: { paddingBottom: PAGE_LAYOUT.bottom, paddingHorizontal: PAGE_LAYOUT.gutter, paddingTop: PAGE_LAYOUT.top },
  directionSwitch: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 13, flexDirection: "row", gap: 12, marginBottom: 10, padding: 11 },
  directionCopy: { flex: 1 },
  directionLabel: { color: COLORS.muted, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 10, letterSpacing: 0.3, textTransform: "uppercase" },
  directionTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 14, marginTop: 3 },
  directionSwitchButton: { alignItems: "center", backgroundColor: "#ffffff", borderRadius: 10, flexDirection: "row", gap: 5, minHeight: 44, paddingHorizontal: 10 },
  directionButtonText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 12 },
  variant: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, overflow: "hidden", padding: 14 },
  variantHeading: { alignItems: "center", flexDirection: "row", gap: 7, marginBottom: 11 },
  variantTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 15 },
  stopRow: { alignItems: "center", flexDirection: "row", gap: PAGE_LAYOUT.gap, minHeight: 52, paddingVertical: PAGE_LAYOUT.fieldGap },
  stopSequence: { alignItems: "center", alignSelf: "stretch", justifyContent: "center", width: 17 },
  stopDot: { backgroundColor: "#a6c9fa", borderRadius: 4, height: 8, width: 8, zIndex: 1 },
  stopDotStart: { backgroundColor: COLORS.green, height: 10, width: 10 },
  stopDotEnd: { backgroundColor: COLORS.gold, height: 10, width: 10 },
  stopLine: { backgroundColor: "#d3e4ff", bottom: -2, position: "absolute", top: 26, width: 2 },
  stopName: { color: COLORS.ink, flex: 1, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 13 },
  stopScheduleLink: { alignItems: "center", flexDirection: "row", gap: 1 },
  stopSchedule: { color: COLORS.navy, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 11 },
  scheduleTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontWeight: "700", fontSize: 23, marginTop: 16 },
  scheduleSubtitle: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 13, marginTop: 4 },
  dateControls: { alignItems: "center", flexDirection: "row", gap: 10, marginTop: 8 },
  dateButton: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 22, height: 44, justifyContent: "center", width: 44 },
  dateButtonText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 20 },
  selectedDate: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 15, marginTop: 2 },
  sourcesTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontWeight: "700", fontSize: 25, marginTop: 18 },
  sourcesList: { paddingBottom: PAGE_LAYOUT.bottom, paddingHorizontal: PAGE_LAYOUT.gutter, paddingTop: PAGE_LAYOUT.top },
  sourcesFirstCard: { marginTop: PAGE_LAYOUT.block },
  sourceCard: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, padding: PAGE_LAYOUT.block, marginTop: PAGE_LAYOUT.gap },
  sourceCardTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 15 },
  sourceText: { color: "#596574", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 13, lineHeight: 19, marginTop: 6 },
  sourceUrl: { color: COLORS.navy, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 11, marginTop: 9 },
  departure: { alignItems: "center", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", gap: 14, minHeight: 60, paddingHorizontal: 4, paddingVertical: 10 },
  departureTime: { color: COLORS.navy, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 19 },
  departureDestination: { color: COLORS.ink, flex: 1, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 13 },
  mapScreen: { flex: 1, backgroundColor: "#f8f9ff" },
  cityMapScreen: { flex: 1, backgroundColor: "#f6f7fb" },
  cityMapHeader: { paddingHorizontal: PAGE_LAYOUT.gutter, paddingTop: PAGE_LAYOUT.top },
  cityMapTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontWeight: "700", fontSize: 24, marginTop: 9 },
  cityMapHint: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, marginBottom: 12, marginTop: 3 },
  cityMapCanvas: { flex: 1 },
  cityMapSelection: { backgroundColor: "#ffffff", paddingHorizontal: PAGE_LAYOUT.gutter, paddingTop: PAGE_LAYOUT.fieldGap, paddingBottom: PAGE_LAYOUT.gap, borderTopWidth: 1, borderTopColor: COLORS.border },
  cityMapSelectionHeading: { flexDirection: "row", alignItems: "center", gap: 8 },
  cityMapSelectionTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 15, flex: 1 },
  cityMapSelectionAddress: { color: COLORS.ink, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 14, lineHeight: 20 },
  cityMapDirections: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, marginTop: PAGE_LAYOUT.fieldGap, paddingVertical: PAGE_LAYOUT.fieldGap },
  cityMapDirectionsText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 13, flex: 1 },
  cityMapSource: { alignItems: "center", backgroundColor: "#ffffff", borderTopColor: COLORS.border, borderTopWidth: 1, flexDirection: "row", gap: 8, minHeight: 54, paddingHorizontal: PAGE_LAYOUT.gutter, paddingVertical: PAGE_LAYOUT.gap },
  cityMapSourceText: { color: COLORS.navy, flex: 1, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 11 },
  mapHeader: { backgroundColor: "#f8f9ff", paddingHorizontal: PAGE_LAYOUT.gutter, paddingTop: PAGE_LAYOUT.top, paddingBottom: PAGE_LAYOUT.gap },
  mapTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 17, lineHeight: 23, marginTop: 9 },
  mapHint: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, marginTop: 3 },
  mapDirectionSwitch: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 12, flexDirection: "row", gap: PAGE_LAYOUT.gap, marginBottom: PAGE_LAYOUT.gap, marginHorizontal: PAGE_LAYOUT.gutter, padding: PAGE_LAYOUT.gap },
  mapDirectionCopy: { flex: 1 },
  mapDirectionLabel: { color: COLORS.muted, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 10, letterSpacing: 0.3, textTransform: "uppercase" },
  mapDirectionTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 14, marginTop: 2 },
  mapDirectionButton: { alignItems: "center", backgroundColor: "#ffffff", borderRadius: 9, flexDirection: "row", gap: 5, minHeight: 44, paddingHorizontal: 10 },
  mapCanvas: { flex: 1, position: "relative" },
  mapGpsStatus: { alignItems: "center", alignSelf: "flex-start", backgroundColor: "#ffffff", borderRadius: 14, flexDirection: "row", gap: 6, left: 12, maxWidth: "92%", paddingHorizontal: 9, paddingVertical: 6, position: "absolute", top: 12 },
  mapGpsDot: { borderRadius: 4, height: 8, width: 8 },
  mapGpsDotLive: { backgroundColor: "#2e673d" },
  mapGpsDotStale: { backgroundColor: "#b7791f" },
  mapGpsDotOffline: { backgroundColor: "#718096" },
  mapGpsStatusText: { color: COLORS.navy, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 12, lineHeight: 18, flexShrink: 1 },
  mapStopCard: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 15, borderWidth: 1, left: 16, padding: 13, position: "absolute", right: 16, shadowColor: "#071d31", shadowOffset: { height: 5, width: 0 }, shadowOpacity: 0.14, shadowRadius: 13, top: 14 },
  mapStopCardWithGps: { top: 60 },
  mapStopCardTop: { alignItems: "center", flexDirection: "row", gap: 10 },
  mapStopIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 9, height: 37, justifyContent: "center", width: 37 },
  mapStopCopy: { flex: 1 },
  mapStopName: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 14, lineHeight: 19 },
  mapStopDirection: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 11, marginTop: 2 },
  mapStopScheduleLoading: { alignItems: "center", flexDirection: "row", gap: 7, marginTop: 13 },
  mapStopScheduleText: { color: COLORS.muted, fontFamily: FONTS.medium, fontWeight: "500", fontSize: 12 },
  mapStopSchedule: { borderTopColor: COLORS.border, borderTopWidth: 1, marginTop: 12, paddingTop: 10 },
  mapStopScheduleLabel: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 11 },
  mapStopTimes: { flexDirection: "row", gap: 7, marginTop: 7 },
  mapStopTimePill: { backgroundColor: "#eff5ff", borderRadius: 10, flex: 1, paddingHorizontal: 8, paddingVertical: 7 },
  mapStopScheduleTime: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontWeight: "700", fontSize: 17 },
  mapStopMinutesText: { color: "#2e673d", fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 10, marginTop: 2 },
  mapStopEmpty: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 17, marginTop: 12 },
  mapStopError: { color: "#9a3412", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 17, marginTop: 12 },
  mapStopFootnote: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 10, marginTop: 9 },
  loadingIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 24, height: 56, justifyContent: "center", width: 56 },
  loadingSpinner: { marginTop: 17 },
  loadingTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 18, marginTop: 11 },
  loadingText: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 13, marginTop: 5, textAlign: "center" },
  errorIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 24, height: 56, justifyContent: "center", width: 56 },
  errorTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 19, marginTop: 15 },
  errorText: { color: "#596574", fontFamily: FONTS.regular, fontWeight: "400", fontSize: 13, lineHeight: 19, marginTop: 8, textAlign: "center" },
  errorHint: { color: COLORS.muted, fontFamily: FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 18, marginTop: 12, maxWidth: 310, textAlign: "center" },
  retryButton: { alignItems: "center", backgroundColor: COLORS.navy, borderRadius: 10, flexDirection: "row", gap: 8, marginTop: 20, minHeight: 48, paddingHorizontal: 18 },
  retryText: { color: "#ffffff", fontFamily: FONTS.semibold, fontWeight: "600", fontSize: 14 },
});

function themedStyleValue(property: string, value: unknown, isDark: boolean): unknown {
  if (!isDark || typeof value !== "string") {
    return value;
  }

  const color = value.toLowerCase();
  if (property === "backgroundColor") {
    if (["#ffffff", "rgba(255,255,255,0.97)", "rgba(255,255,255,0.96)", "rgba(255,255,255,0.95)"].includes(color)) return "#102d49";
    if (["#f6f7fb", "#f8f9ff", "#f8faff", "#f4f7fb", "#eff5ff"].includes(color)) return "#071b2f";
    if (["#eef4ff", "#e4efff", "#eaf2ff", "#e7eeff", "#f3f8ff"].includes(color)) return "#153a59";
    if (["#f6f8fd", "rgba(255,255,255,0.78)"].includes(color)) return "#163653";
    if (["#fff8e9", "#fff4f3", "#fff5f4"].includes(color)) return "#332b22";
    if (color === "#fff3ce") return "#5b461d";
    if (["#eef8eb", "#e8f7e4"].includes(color)) return "#183a2b";
    if (color === "#dff1da") return "#234735";
    if (color === "#ffe3e0") return "#4b2525";
    if (color === "#123a63") return "#174b75";
    if (color === "#002446") return "#092b49";
  }

  if (property.includes("Color") || property === "color") {
    if (color === LIGHT_COLORS.controlBorder) return DARK_COLORS.controlBorder;
    if (["#e2e8f0", "#d5dee9", "#f2dcaa", "#f4ceca", "#d4e3f7", "#9ec2ef"].includes(color)) return "#234561";
    if (["#0f1d2a", "#071d31", "#002446", "#354657", "#40546b", "#3f5269"].includes(color)) return "#f3f7fc";
    if (["#64748b", "#5b6b7c", "#596574", "#485768", "#4b5968", "#526d89", "#94a3b8", "#43474e", "#5b6e80"].includes(color)) return "#a9bed3";
    if (["#66758a", "#64748b"].includes(color)) return "#91a9bf";
    if (color === "#123a63") return "#8fc8ff";
    if (["#2e673d", "#3d6836", "#3f6649", "#245b31"].includes(color)) return "#c0eab9";
    if (color === "#8a5b00") return "#f4d47a";
    if (["#624600", "#735817", "#795000"].includes(color)) return "#f4d47a";
    if (["#991b1b", "#a31d1d", "#8e1b1b", "#a54943", "#9a3412"].includes(color)) return "#ffb4ad";
  }

  return value;
}

function buildStyles(isDark: boolean) {
  const definitions = Object.fromEntries(Object.entries(STYLE_DEFINITIONS).map(([name, style]) => [
    name,
    Object.fromEntries(Object.entries(style).map(([property, value]) => [property,
      isDark && name === "settingsSwitchKnob" && property === "backgroundColor"
        ? "#ffffff"
        : themedStyleValue(property, value, isDark),
    ])),
  ]));
  return StyleSheet.create(definitions as never) as typeof STYLE_DEFINITIONS;
}

let styles: typeof STYLE_DEFINITIONS = buildStyles(false);
