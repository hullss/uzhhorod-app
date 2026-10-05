import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import {
  PublicSans_400Regular,
  PublicSans_500Medium,
  PublicSans_600SemiBold,
  PublicSans_700Bold,
  useFonts,
} from "@expo-google-fonts/public-sans";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RouteMap, type MapRegion } from "./src/components/RouteMap";
import { OfficialLayerMap } from "./src/components/OfficialLayerMap";
import { MiniaturesMap } from "./src/components/MiniaturesMap";
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  FlatList,
  Image,
  Linking,
  PanResponder,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
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
  getOfficialNewsArticle,
  getSafetyMapPoints,
  getEditorialEvents,
  getEditorialDefenderFunds,
  getWeather,
  type AccessibleBuilding,
  type AccessibleBuildingList,
  type AirAlertStatus,
  type AirAlertEvent,
  type CurrencyRates,
  type OfficialNewsList,
  type OfficialNewsArticle,
  type OfficialNewsItem,
  type SafetyMapPoint,
  type MiniSculpture,
  type MiniSculptureList,
  type Weather,
} from "./src/api/cityServices";
import { changeAccountPassword, deleteAccount, loginAccount, logoutAccount, refreshAccountSession, registerAccount, updateAccountFavorites, type AccountSession } from "./src/api/account";
import { clearSecureSession, persistSecureSession, restoreSecureSession } from "./src/storage/secureSession";

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
  category: "mobility" | "civic" | "safety" | "places";
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  sourceLabel: string;
  sourceUrl?: string;
  notice?: string;
};

type DefenderFund = {
  id: string;
  title: string;
  description: string;
  donationUrl: string;
  verifiedAt: string;
  verificationSource: string;
};

type DemoPaymentCard = {
  last4: string;
  label: string;
};

type CityEvent = {
  id: string;
  title: string;
  dateLabel: string;
  day: number;
  time?: string;
  venue: string;
  category: string;
  sourceUrl: string;
};

const SERVICE_CATEGORIES: Array<{ id: CityService["category"]; title: string }> = [
  { id: "mobility", title: "Пересування" },
  { id: "civic", title: "Справи з містом" },
  { id: "safety", title: "Безпека та доступність" },
  { id: "places", title: "Місця й прогулянки" },
];

type RootTab = "home" | "feed" | "services" | "profile";

const CITY_SERVICES: CityService[] = [
  {
    id: "events",
    category: "places",
    icon: "calendar-outline",
    title: "Події в місті",
    description: "Концерти, вистави, фестивалі та зустрічі в Ужгороді.",
    sourceLabel: "Відкрити афішу",
    notice: "Добираємо події з вказаною датою, місцем і посиланням на джерело. Перед відвідуванням перевіряйте зміни у організатора.",
  },
  {
    id: "transport-payment",
    category: "mobility",
    icon: "card-outline",
    title: "Оплата проїзду",
    description: "Попередній перегляд купівлі квитка до інтеграції з оператором.",
    sourceLabel: "Відкрити оплату проїзду",
    notice: "Оплата ще не приймає картки, не створює квиток і не списує кошти. Реальна оплата можлива лише після інтеграції з офіційним оператором.",
  },
  {
    id: "donations",
    category: "safety",
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
    description: "Особистий кабінет, електронні послуги та запис на прийом.",
    sourceLabel: "Відкрити кабінет ЦНАП",
    sourceUrl: "https://my.cnap.rada-uzhgorod.gov.ua/",
    notice: "Авторизація та подання заяв відбуваються тільки в офіційному кабінеті ЦНАП. Застосунок не зберігає персональні дані чи BankID.",
  },
  {
    id: "polls",
    category: "civic",
    icon: "checkbox-outline",
    title: "Опитування",
    description: "Міські опитування та можливість поділитися думкою.",
    sourceLabel: "Незабаром",
    notice: "Це буде власний модуль застосунку з відкритими правилами та перевіркою активних опитувань. Не створюємо фіктивних голосувань до запуску серверної частини.",
  },
  {
    id: "accessibility",
    category: "safety",
    icon: "accessibility-outline",
    title: "Доступне місто",
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
    description: "Правила паркування, інформація від інспекторів і пошук постанови.",
    sourceLabel: "Перейти до офіційного сервісу",
    sourceUrl: "https://pdr.rada-uzhgorod.gov.ua/",
    notice: "Оплату, штрафи та дані банківських карток застосунок не обробляє — це лише перехід до офіційного сервісу.",
  },
  {
    id: "power-outages",
    category: "safety",
    icon: "flash-outline",
    title: "Світло за адресою",
    description: "Перевірка аварійних, планових і графікових відключень від Закарпаттяобленерго.",
    sourceLabel: "Перевірити адресу в Закарпаттяобленерго",
    sourceUrl: "https://zakarpat.energy/customers/break-in-electricity-supply/realtime-outage/",
    notice: "Офіційний сервіс показує причину вимкнення, час початку та орієнтовне відновлення за введеною адресою. Публічного API для показу цих даних у застосунку оператор поки не надає.",
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
    category: "places",
    icon: "trash-outline",
    title: "Сортування та відходи",
    description: "Контейнерні майданчики, небезпечні відходи й точки прийому сировини.",
    sourceLabel: "Відкрити офіційний набір",
    sourceUrl: "https://data.rada-uzhgorod.gov.ua/dataset/d6aaf49f-765b-49e8-b891-d03d3d44f1ae",
    notice: "У міста є набір із контейнерними майданчиками та точками прийому відходів. Додамо його на мапу після перевірки доступності й формату координат у ресурсі.",
  },
  {
    id: "playgrounds",
    category: "places",
    icon: "football-outline",
    title: "Майданчики",
    description: "Дитячі, спортивні та інші місця для активного відпочинку.",
    sourceLabel: "Відкрити офіційний набір",
    sourceUrl: "https://data.rada-uzhgorod.gov.ua/dataset/106577c3-0816-4a67-9483-ef2f227576d0",
    notice: "Набір міста містить адреси, координати й опис обладнання. Його CSV зараз на модерації, тому карту додамо після відкриття доступу до актуальних точок.",
  },
  {
    id: "miniatures",
    category: "places",
    icon: "walk-outline",
    title: "Мініскульптури Ужгорода",
    description: "Прогулянковий маршрут і мапа маленьких символів міста.",
    sourceLabel: "Відкрити мапу",
    notice: "Власний каталог уже має першу добірку локацій і буде доповнюватися. Ми не використовуємо чужі фотографії чи скопійовані описи.",
  },
];

// This list intentionally starts empty. Add a collection only after its direct donation link,
// official confirmation and the date of verification have been checked by the editorial team.
const DEFENDER_FUNDS: DefenderFund[] = [];

const FEATURED_DEFENDER_DONATION = {
  title: "Рух підтримки закарпатських військових",
  donationUrl: "https://send.monobank.ua/jar/6Uz6GSyc7k",
  note: "Це постійна Банка Руху підтримки закарпатських військових. Актуальна потреба та звітність змінюються безпосередньо на сторінці mono.",
};

const EVENT_TICKETS = {
  philharmonic80: "https://concert.ua/uk/booking/filarmoniyi-80-velikii-yuvileinii-koncert",
  klavdia: "https://uzhgorod.internet-bilet.ua/uk/klavdia-petrivna",
  zukhvala: "https://uzhgorod.kontramarka.ua/uk/0410-solnij-stendap-nasti-zuhvaloi-neobovazkova-ganba-v-uzgorodi-124592.html",
  zimmer: "https://concert.ua/uk/booking/muzika-cimmera-uzhhorod",
  ponomariov: "https://widget.kontramarka.ua/uk/widget509site1008/widget/event/100181160?siteEventId=263659&siteShowId=114286",
  mamyneNamysto: "https://widget.kontramarka.ua/uk/widget585site1008/widget/event/100186558?siteEventId=285574&siteShowId=122994",
  skay: "https://widget.kontramarka.ua/uk/widget512site1008/widget/event/100182928?siteEventId=269456&siteShowId=116732",
  misto: "https://widget.kontramarka.ua/uk/widget597site11540/widget/event/186851",
  homin: "https://widget.kontramarka.ua/uk/widget626site14789/widget/event/100187644?siteEventId=290282&siteShowId=107212",
  einaudi: "https://widget.kontramarka.ua/uk/widget626site14789/widget/event/100186444?siteEventId=284723&siteShowId=109722",
  baidak: "https://widget.kontramarka.ua/uk/widget557site14840/widget/event/189195?siteEventId=287685&siteShowId=123843",
  improv: "https://widget.kontramarka.ua/uk/widget557site14874/widget/event/185300?siteEventId=284363&siteShowId=122525",
  queen: "https://widget.kontramarka.ua/uk/widget626site11540/widget/event/187005?siteEventId=285873&siteShowId=123085",
};
const CITY_EVENTS: CityEvent[] = [
  { id: "philharmonic-80", title: "Філармонії — 80", dateLabel: "1 жовтня", day: 1, venue: "Закарпатська обласна філармонія", category: "Концерт", sourceUrl: EVENT_TICKETS.philharmonic80 },
  { id: "klavdia", title: "KLAVDIA PETRIVNA SHOW", dateLabel: "3 жовтня", day: 3, time: "18:00", venue: "Закарпатський драмтеатр", category: "Концерт", sourceUrl: EVENT_TICKETS.klavdia },
  { id: "zukhvala", title: "Стендап Насті Зухвалої", dateLabel: "4 жовтня", day: 4, time: "18:00", venue: "Belfast 2.0, вул. Волошина, 26", category: "Стендап", sourceUrl: EVENT_TICKETS.zukhvala },
  { id: "zimmer", title: "Музика Ганса Циммера при свічках", dateLabel: "5 жовтня", day: 5, time: "19:00", venue: "Закарпатська обласна філармонія", category: "Концерт", sourceUrl: EVENT_TICKETS.zimmer },
  { id: "ponomariov", title: "Олександр Пономарьов. Сольний концерт", dateLabel: "5 жовтня", day: 5, venue: "Закарпатський драмтеатр", category: "Концерт", sourceUrl: EVENT_TICKETS.ponomariov },
  { id: "mamyne-namysto", title: "Мюзикл «Мамине намисто»", dateLabel: "10 жовтня", day: 10, venue: "Закарпатська обласна філармонія", category: "Театр", sourceUrl: EVENT_TICKETS.mamyneNamysto },
  { id: "skay", title: "СКАЙ. 25 років на сцені", dateLabel: "12 жовтня", day: 12, venue: "Закарпатський драмтеатр", category: "Концерт", sourceUrl: EVENT_TICKETS.skay },
  { id: "misto", title: "Пластична вистава «Місто»", dateLabel: "17 жовтня", day: 17, time: "19:00", venue: "Закарпатський драмтеатр", category: "Театр", sourceUrl: EVENT_TICKETS.misto },
  { id: "homin", title: "Хор «Гомін» в Ужгороді", dateLabel: "18 жовтня", day: 18, venue: "Закарпатський драмтеатр", category: "Концерт", sourceUrl: EVENT_TICKETS.homin },
  { id: "einaudi", title: "Людовіко Ейнауді та Ян Тірсен при свічках", dateLabel: "22 жовтня", day: 22, venue: "Закарпатська обласна філармонія", category: "Концерт", sourceUrl: EVENT_TICKETS.einaudi },
  { id: "baidak", title: "Василь Байдак в Ужгороді", dateLabel: "24 жовтня", day: 24, venue: "Закарпатська обласна філармонія", category: "Стендап", sourceUrl: EVENT_TICKETS.baidak },
  { id: "improv", title: "Імпровізація з глядачами", dateLabel: "29 жовтня", day: 29, venue: "Закарпатський драмтеатр", category: "Шоу", sourceUrl: EVENT_TICKETS.improv },
  { id: "queen", title: "Queen при свічках", dateLabel: "29 жовтня", day: 29, venue: "Закарпатська обласна філармонія", category: "Концерт", sourceUrl: EVENT_TICKETS.queen },
];

const CNAP_SERVICE_OPTIONS = [
  "Реєстрація місця проживання",
  "Витяг з реєстру територіальної громади",
  "Соціальні послуги",
  "Консультація щодо документів",
];

const PARKING_PORTAL_URL = "https://pdr.rada-uzhgorod.gov.ua/";
const PARKING_EVACUATION_URL = "https://pdr.rada-uzhgorod.gov.ua/evacuation/";
const PARKING_INSPECTOR_URL = "https://pdr.rada-uzhgorod.gov.ua/inspector/";
const PARKING_DATASET_URL = "https://data.rada-uzhgorod.gov.ua/dataset/69463bbd-3985-45cf-8966-a35d709176a3";
const UZHHOROD_DIGITAL_LOGO = require("./assets/brand/uzhhorod-digital-logo.png");

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
  mist: "#f8f9ff",
  blueSurface: "#eef4ff",
  blueSoft: "#e4efff",
  ink: "#0f1d2a",
  muted: "#5b6b7c",
  tertiary: "#66758a",
  border: "#e2e8f0",
  separator: "#d5dee9",
  controlBorder: "#73879d",
  gold: "#e5ae2d",
  green: "#3d6836",
  danger: "#a31d1d",
};

const DARK_COLORS: AppPalette = {
  navy: "#8fc8ff",
  navyDark: "#e7f2ff",
  mist: "#071b2f",
  blueSurface: "#102e4b",
  blueSoft: "#173a59",
  ink: "#f3f7fc",
  muted: "#a9bed3",
  tertiary: "#91a9bf",
  border: "#234561",
  separator: "#234561",
  controlBorder: "#7399b9",
  gold: "#f4c65b",
  green: "#9dd38f",
  danger: "#ffb4ad",
};

let COLORS: AppPalette = LIGHT_COLORS;

const FONTS = {
  regular: "PublicSans_400Regular",
  medium: "PublicSans_500Medium",
  semibold: "PublicSans_600SemiBold",
  bold: "PublicSans_700Bold",
};

function StatusBar(_props: { style?: "dark" | "light" }) {
  return <ExpoStatusBar style={useColorScheme() === "dark" ? "light" : "dark"} />;
}

function CivicHeader(_props: {
  onOpenNotifications?: () => void;
  onOpenProfile?: () => void;
} = {}) {
  return (
    <View style={styles.civicHeader}>
      <View style={styles.brandGroup}>
        <BrandMark />
        <View>
          <View style={styles.brandTitleRow}>
            <Text style={styles.brandTitle}>Ужгород Цифровий</Text>
          </View>
          <Text style={styles.brandSubtitle}>офіційні міські сервіси</Text>
        </View>
      </View>
    </View>
  );
}

function BrandMark({ size = 34 }: { size?: number }) {
  return <Image
    accessibilityLabel="Логотип Ужгород Цифровий"
    source={UZHHOROD_DIGITAL_LOGO}
    style={[styles.brandMark, { borderRadius: Math.round(size * 0.22), height: size, width: size }]}
  />;
}

function BrandIntro({ opacity, scale }: { opacity: Animated.Value; scale: Animated.Value }) {
  return <SafeAreaView style={styles.brandIntroScreen}>
    <Animated.View style={[styles.brandIntroContent, { opacity, transform: [{ scale }] }]}>
      <BrandMark size={88} />
      <Text style={styles.brandIntroTitle}>Ужгород Цифровий</Text>
      <Text style={styles.brandIntroSubtitle}>Офіційні міські сервіси</Text>
    </Animated.View>
    <View style={styles.brandIntroFooter}>
      <ActivityIndicator size="small" color={COLORS.navy} />
      <Text style={styles.brandIntroFooterText}>Завантажуємо місто</Text>
    </View>
  </SafeAreaView>;
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
  return useMemo(() => PanResponder.create({
    // Do not capture the touch on start: that used to interrupt normal vertical scrolling
    // near the left edge. Take control only after a clear, deliberate horizontal gesture.
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gesture) => (
      gesture.x0 <= 28
      && gesture.dx > 14
      && gesture.dx > Math.abs(gesture.dy) * 1.4
    ),
    onPanResponderTerminationRequest: () => true,
    onPanResponderRelease: (_, gesture) => {
      const shouldGoBack = gesture.dx >= 96 || (gesture.dx >= 48 && gesture.vx >= 0.65);
      if (shouldGoBack && Math.abs(gesture.dy) < 72) {
        onBack();
      }
    },
  }).panHandlers, [onBack]);
}

export default function App() {
  const systemColorScheme = useColorScheme();
  const isDarkTheme = systemColorScheme === "dark";
  COLORS = isDarkTheme ? DARK_COLORS : LIGHT_COLORS;
  styles = buildStyles(isDarkTheme);
  const [fontsLoaded] = useFonts({
    PublicSans_400Regular,
    PublicSans_500Medium,
    PublicSans_600SemiBold,
    PublicSans_700Bold,
  });
  const [introVisible, setIntroVisible] = useState(true);
  const introOpacity = useRef(new Animated.Value(0)).current;
  const introScale = useRef(new Animated.Value(0.94)).current;
  const [section, setSection] = useState<"hub" | "transport">("hub");
  const [activeTab, setActiveTab] = useState<RootTab>("home");
  const [profilePanel, setProfilePanel] = useState<"notifications" | "language" | "account" | "payment-methods" | "legal" | null>(null);
  const [account, setAccount] = useState<AccountSession | null>(null);
  const [favoriteRouteIds, setFavoriteRouteIds] = useState<string[]>([]);
  const [favoriteStopIds, setFavoriteStopIds] = useState<string[]>([]);
  const [language, setLanguage] = useState<"uk" | "en">("uk");
  const [demoPaymentCard, setDemoPaymentCard] = useState<DemoPaymentCard | null>(null);
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
  const [error, setError] = useState<string | null>(null);

  const goBack = useCallback(() => {
    if (section === "transport") {
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
        return true;
      }
      if (selectedStop) {
        setSelectedStop(null);
        return true;
      }
      if (showDataSources) {
        setShowDataSources(false);
        return true;
      }
      setSection("hub");
      setActiveTab("services");
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
      setSelectedService(null);
      return true;
    }
    if (profilePanel) {
      setProfilePanel(null);
      return true;
    }
    if (activeTab !== "home") {
      setActiveTab("home");
      return true;
    }
    return false;
  }, [activeTab, mapScreen, profilePanel, schedule, section, selectedNewsArticle, selectedRoute, selectedService, selectedStop, showDataSources, weatherOpen]);

  const transportSwipeBack = useSwipeBack(goBack);

  useEffect(() => {
    if (!fontsLoaded) {
      return;
    }
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
  }, [fontsLoaded, introOpacity, introScale]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", goBack);
    return () => subscription.remove();
  }, [goBack]);

  useEffect(() => {
    let active = true;
    void restoreSecureSession().then(async (storedSession) => {
      if (!storedSession) return;
      try {
        const session = await refreshAccountSession(storedSession.accessToken);
        if (active) await handleAuthenticated(session);
      } catch {
        await clearSecureSession().catch(() => undefined);
      }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (section !== "transport") {
      return;
    }
    const timer = setTimeout(() => {
      void loadList(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, searchMode, section]);

  if (!fontsLoaded) {
    return null;
  }

  if (introVisible) {
    return <BrandIntro opacity={introOpacity} scale={introScale} />;
  }

  function openTransportHub() {
    setSelectedService(null);
    setActiveTab("services");
    setSection("transport");
    setLoading(true);
  }

  function navigateToTab(tab: RootTab) {
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
    setAccount(session);
    setFavoriteRouteIds(session.favorites?.routeIds ?? []);
    setFavoriteStopIds(session.favorites?.stopIds ?? []);
    try {
      await persistSecureSession(session);
    } catch {
      Alert.alert("Сесію не збережено", "Після перезапуску потрібно буде увійти ще раз.");
    }
  }

  async function handleLogout() {
    if (!account) return;
    try {
      await logoutAccount(account.accessToken);
    } catch (requestError) {
      Alert.alert("Не вдалося вийти", requestError instanceof Error ? requestError.message : "Спробуйте ще раз.");
      return;
    }
    await clearSecureSession().catch(() => undefined);
    setAccount(null); setFavoriteRouteIds([]); setFavoriteStopIds([]); setDemoPaymentCard(null);
    setProfilePanel(null);
  }

  async function handleDeleteAccount() {
    if (!account) return;
    try {
      await deleteAccount(account.accessToken);
    } catch (requestError) {
      Alert.alert("Не вдалося видалити", requestError instanceof Error ? requestError.message : "Спробуйте ще раз.");
      return;
    }
    await clearSecureSession().catch(() => undefined);
    setAccount(null); setFavoriteRouteIds([]); setFavoriteStopIds([]); setDemoPaymentCard(null);
    setProfilePanel(null);
    Alert.alert("Акаунт видалено", "Дані акаунта, налаштування та обране видалено.");
  }

  async function toggleFavorite(kind: "route" | "stop", id: string) {
    if (!account) {
      Alert.alert("Збереження в обраному", "Створіть акаунт або увійдіть, щоб зберегти маршрути та зупинки.", [
        { text: "Не зараз", style: "cancel" },
        { text: "До акаунта", onPress: () => { setSection("hub"); setActiveTab("profile"); setProfilePanel("account"); } },
      ]);
      return;
    }

    const previousRoutes = favoriteRouteIds;
    const previousStops = favoriteStopIds;
    const update = (items: string[]) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id];
    const nextRoutes = kind === "route" ? update(favoriteRouteIds) : favoriteRouteIds;
    const nextStops = kind === "stop" ? update(favoriteStopIds) : favoriteStopIds;
    setFavoriteRouteIds(nextRoutes);
    setFavoriteStopIds(nextStops);
    try {
      const favorites = await updateAccountFavorites(account.accessToken, nextRoutes, nextStops);
      setFavoriteRouteIds(favorites.routeIds);
      setFavoriteStopIds(favorites.stopIds);
      const updatedSession = { ...account, favorites };
      setAccount(updatedSession);
      void persistSecureSession(updatedSession);
    } catch (requestError) {
      setFavoriteRouteIds(previousRoutes);
      setFavoriteStopIds(previousStops);
      Alert.alert("Не вдалося зберегти", requestError instanceof Error ? requestError.message : "Спробуйте ще раз.");
    }
  }

  function openCityService(id: CityService["id"]) {
    const service = CITY_SERVICES.find((item) => item.id === id);
    if (service) {
      setSelectedService(service);
    }
  }

  async function loadList(searchQuery = query) {
    setError(null);
    try {
      const importRequest = getLatestTransportImport();
      if (searchMode === "routes") {
        const [latestImport, foundRoutes] = await Promise.all([importRequest, getRoutes(searchQuery)]);
        setImportStatus(latestImport);
        setRoutes(sortRoutesByNumber(foundRoutes));
      } else {
        const [latestImport, foundStops] = await Promise.all([importRequest, getStops(searchQuery)]);
        setImportStatus(latestImport);
        setStops(foundStops);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Невідома помилка");
    } finally {
      setLoading(false);
    }
  }

  async function openRoute(route: TransportRoute) {
    setLoading(true);
    setError(null);
    setSchedule(null);
    setMapScreen(null);
    setRouteMapPreview(null);
    setSelectedStop(null);
    try {
      const routeDetails = await getRoute(route.id);
      setSelectedRoute(routeDetails);
      try {
        setRouteMapPreview(await getRouteMap(route.id));
      } catch {
        setRouteMapPreview(null);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Невідома помилка");
    } finally {
      setLoading(false);
    }
  }

  async function openStop(stop: TransportStop) {
    setLoading(true);
    setError(null);
    setSelectedRoute(null);
    try {
      setSelectedStop({ stop, routes: sortRoutesByNumber(await getStopRoutes(stop.id)) });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Невідома помилка");
    } finally {
      setLoading(false);
    }
  }

  async function openSchedule(route: TransportRouteDetails, stop: TransportStop, date = localDate()) {
    setLoading(true);
    setError(null);
    try {
      setSchedule({ route, stop, date, departures: await getDepartures(route.id, stop.id, date) });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Невідома помилка");
    } finally {
      setLoading(false);
    }
  }

  async function openMap(route: TransportRouteDetails, activeVariantId?: string) {
    setLoading(true);
    setError(null);
    try {
      const map = routeMapPreview?.routeId === route.id ? routeMapPreview : await getRouteMap(route.id);
      setMapScreen({ route, map, activeVariantId });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Невідома помилка");
    } finally {
      setLoading(false);
    }
  }

  if (section === "hub") {
    if (selectedNewsArticle) {
      return <NewsArticleScreen
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
        return <CityEventsScreen onBack={() => setSelectedService(null)} />;
      }
      if (selectedService.id === "donations") {
        return <DefendersSupportScreen onBack={() => setSelectedService(null)} />;
      }
      if (selectedService.id === "cnap") {
        return <CnapAppointmentDemoScreen onBack={() => setSelectedService(null)} />;
      }
      if (selectedService.id === "transport-payment") {
        return <TransportPaymentDemoScreen
          card={demoPaymentCard}
          onBack={() => setSelectedService(null)}
          onManagePaymentMethods={() => { setSelectedService(null); setActiveTab("profile"); setProfilePanel("payment-methods"); }}
        />;
      }
      if (selectedService.id === "accessibility") {
        return <AccessibilityBuildingsScreen onBack={() => setSelectedService(null)} />;
      }
      if (selectedService.id === "shelters") {
        return <SafetyMapScreen kind="shelters" onBack={() => setSelectedService(null)} />;
      }
      if (selectedService.id === "resilience") {
        return <SafetyMapScreen kind="resilience" onBack={() => setSelectedService(null)} />;
      }
      if (selectedService.id === "parking") {
        return <ParkingScreen onBack={() => setSelectedService(null)} />;
      }
      if (selectedService.id === "polls") {
        return <PollsScreen onBack={() => setSelectedService(null)} />;
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
      if (profilePanel === "notifications") {
        return <NotificationSettingsScreen onBack={() => setProfilePanel(null)} />;
      }
      if (profilePanel === "language") {
        return <LanguageSettingsScreen language={language} onChangeLanguage={setLanguage} onBack={() => setProfilePanel(null)} />;
      }
      if (profilePanel === "account") {
        return <AccountScreen account={account} onAuthenticated={handleAuthenticated} onLogout={() => void handleLogout()} onDeleteAccount={() => void handleDeleteAccount()} onBack={() => setProfilePanel(null)} />;
      }
      if (profilePanel === "legal") {
        return <LegalScreen onBack={() => setProfilePanel(null)} />;
      }
      if (profilePanel === "payment-methods") {
        return <PaymentMethodsScreen
          accountEmail={account?.preferences.email}
          card={demoPaymentCard}
          onBack={() => setProfilePanel(null)}
          onSaveCard={setDemoPaymentCard}
          onRemoveCard={() => setDemoPaymentCard(null)}
        />;
      }
      return <ProfileScreen
        accountEmail={account?.preferences.email}
        favoriteSummary={account ? `${favoriteRouteIds.length} маршрутів · ${favoriteStopIds.length} зупинок` : undefined}
        language={language}
        isDarkTheme={isDarkTheme}
          paymentCard={demoPaymentCard}
        onOpenLanguage={() => setProfilePanel("language")}
        onOpenNotifications={() => setProfilePanel("notifications")}
        onOpenAccount={() => setProfilePanel("account")}
          onOpenPaymentMethods={() => setProfilePanel("payment-methods")}
        onOpenLegal={() => setProfilePanel("legal")}
        onChangeTab={navigateToTab}
      />;
    }
    if (activeTab === "services") {
      return <CityServicesHub
      onOpenTransport={openTransportHub}
      onOpenService={setSelectedService}
      onChangeTab={navigateToTab}
      />;
    }
    return <HomeScreen
      onOpenTransport={openTransportHub}
      onOpenWeather={() => setWeatherOpen(true)}
      onOpenService={openCityService}
      onOpenArticle={(item) => openNewsArticle(item, "home")}
      onChangeTab={navigateToTab}
    />;
  }

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return <ErrorScreen message={error} onRetry={loadList} />;
  }

  if (selectedRoute) {
    if (mapScreen) {
      return <RouteMapScreen mapScreen={mapScreen} onBack={() => setMapScreen(null)} />;
    }
    if (schedule) {
      return <ScheduleDetails
        schedule={schedule}
        onBack={() => setSchedule(null)}
        onChangeDate={(date) => void openSchedule(schedule.route, schedule.stop, date)}
      />;
    }
    return <RouteDetails
      route={selectedRoute}
      map={routeMapPreview}
      favoriteStopIds={favoriteStopIds}
      onBack={() => {
        setSchedule(null);
        setMapScreen(null);
        setRouteMapPreview(null);
        setSelectedRoute(null);
      }}
      onSelectStop={(stop) => void openSchedule(selectedRoute, stop)}
      onOpenMap={(variantId) => void openMap(selectedRoute, variantId)}
      onToggleFavoriteStop={(stopId) => void toggleFavorite("stop", stopId)}
    />;
  }

  if (selectedStop) {
    return <StopDetails
      stopScreen={selectedStop}
      isFavorite={favoriteStopIds.includes(selectedStop.stop.id)}
      onBack={() => setSelectedStop(null)}
      onOpenRoute={(route) => void openRoute(route)}
      onToggleFavorite={() => void toggleFavorite("stop", selectedStop.stop.id)}
    />;
  }

  if (showDataSources) {
    return <DataSourcesScreen onBack={() => setShowDataSources(false)} />;
  }

  const orderedRoutes = [...routes].sort((left, right) => Number(favoriteRouteIds.includes(right.id)) - Number(favoriteRouteIds.includes(left.id)));

  return (
    <SafeAreaView {...transportSwipeBack} style={styles.transportScreen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.transportScrollContent} keyboardShouldPersistTaps="handled">
      <View style={styles.transportContent}>
        <CivicHeader onOpenNotifications={() => navigateToTab("feed")} onOpenProfile={() => navigateToTab("profile")} />
        <BackLink label="До сервісів" onPress={() => navigateToTab("services")} />
        <View style={styles.transportPageTitleRow}>
          <View style={styles.transportPageTitleCopy}>
            <Text style={styles.transportPageTitle}>Громадський транспорт</Text>
            <Text style={styles.transportPageDescription}>Маршрути, зупинки й плановий розклад.</Text>
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
            onPress={() => setSearchMode("routes")}
          >
            <Text style={[styles.searchModeText, searchMode === "routes" && styles.searchModeTextActive]}>Маршрути</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Показати зупинки"
            accessibilityRole="radio"
            accessibilityState={{ selected: searchMode === "stops" }}
            style={[styles.searchMode, searchMode === "stops" && styles.searchModeActive]}
            onPress={() => setSearchMode("stops")}
          >
            <Text style={[styles.searchModeText, searchMode === "stops" && styles.searchModeTextActive]}>Зупинки</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.list}>
        <Text style={styles.transportListHeading}>{query ? "Результати пошуку" : searchMode === "routes" ? "Усі маршрути" : "Усі зупинки"}</Text>
        {!query && searchMode === "routes" && favoriteRouteIds.length > 0 ? <Text style={styles.transportSavedHint}>Обрані маршрути показано першими</Text> : null}
        {searchMode === "routes" ? orderedRoutes.map((item) => (
          <Pressable key={item.id} accessibilityLabel={`Маршрут ${item.routeNumber}: ${item.name}`} accessibilityRole="button" style={styles.routeCard} onPress={() => void openRoute(item)}>
            <View style={styles.routeBadge}><Text style={styles.routeBadgeText}>{item.routeNumber}</Text></View>
            <View style={styles.routeCardCopy}><Text numberOfLines={2} style={styles.routeName}>{item.name}</Text><Text style={styles.routeCardMeta}>Схема зупинок і плановий розклад</Text></View>
            <FavoriteButton selected={favoriteRouteIds.includes(item.id)} onPress={() => void toggleFavorite("route", item.id)} />
            <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
          </Pressable>
        )) : stops.map((item) => (
          <Pressable key={item.id} accessibilityLabel={`Зупинка: ${stopDisplayName(item.name)}`} accessibilityRole="button" style={styles.stopCard} onPress={() => void openStop(item)}>
            <View style={styles.stopCardText}><Text numberOfLines={2} style={styles.stopCardName}>{stopDisplayName(item.name)}</Text>{stopDisplayCode(item.name) ? <Text style={styles.stopCardAction}>Зупинка №{stopDisplayCode(item.name)}</Text> : null}</View>
            <FavoriteButton selected={favoriteStopIds.includes(item.id)} onPress={() => void toggleFavorite("stop", item.id)} />
            <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
          </Pressable>
        ))}
        {searchMode === "routes" && routes.length === 0 && <TransportEmptyState hasQuery={Boolean(query)} onReset={() => setQuery("")} onShowStops={() => setSearchMode("stops")} />}
        {searchMode === "stops" && stops.length === 0 && <TransportEmptyState hasQuery={Boolean(query)} onReset={() => setQuery("")} onShowStops={() => setSearchMode("routes")} />}
      </View>
      </ScrollView>
      <BottomNavigation activeTab="services" onChangeTab={navigateToTab} />
    </SafeAreaView>
  );
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
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.hubContent}>
        <CivicHeader onOpenNotifications={() => onChangeTab("feed")} onOpenProfile={() => onChangeTab("profile")} />
        <View style={styles.pageIntro}>
          <Text style={styles.pageTitle}>Сервіси</Text>
        </View>

        {SERVICE_CATEGORIES.map((category, index) => {
          const services = CITY_SERVICES.filter((service) => service.category === category.id);
          return (
            <View key={category.id} style={index === 0 ? styles.serviceCategoryFirst : styles.serviceCategory}>
              <View style={styles.serviceGroupHeading}>
                <Text style={styles.serviceGroupTitle}>{category.title}</Text>
              </View>
              <View style={styles.serviceGrid}>
                {category.id === "mobility" ? <ServiceGridCard icon="bus-outline" title="Громадський транспорт" onPress={onOpenTransport} /> : null}
                {services.map((service) => <ServiceGridCard key={service.id} icon={service.icon} title={service.title} onPress={() => onOpenService(service)} />)}
              </View>
            </View>
          );
        })}
      </ScrollView>
      <BottomNavigation activeTab="services" onChangeTab={onChangeTab} />
    </SafeAreaView>
  );
}

function ServiceGridCard({ icon, title, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; onPress: () => void }) {
  return <Pressable accessibilityLabel={`Відкрити сервіс: ${title}`} accessibilityRole="button" style={styles.serviceGridCard} onPress={onPress}>
    <View style={styles.serviceGridIcon}><Ionicons name={icon} size={23} color={COLORS.navy} /></View>
    <View style={styles.serviceGridFooter}>
      <Text numberOfLines={2} style={styles.serviceGridTitle}>{title}</Text>
      <Ionicons name="arrow-forward" size={16} color={COLORS.navy} />
    </View>
  </Pressable>;
}

function HomeScreen({
  onOpenTransport,
  onOpenWeather,
  onOpenService,
  onOpenArticle,
  onChangeTab,
}: {
  onOpenTransport: () => void;
  onOpenWeather: () => void;
  onOpenService: (id: CityService["id"]) => void;
  onOpenArticle: (item: OfficialNewsItem) => void;
  onChangeTab: (tab: RootTab) => void;
}) {
  const [newsRefreshSignal, setNewsRefreshSignal] = useState(0);
  const [refreshingNews, setRefreshingNews] = useState(false);
  const finishNewsRefresh = useCallback(() => setRefreshingNews(false), []);

  function refreshNews() {
    setRefreshingNews(true);
    setNewsRefreshSignal((value) => value + 1);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.dashboardContent}
        refreshControl={<RefreshControl refreshing={refreshingNews} onRefresh={refreshNews} tintColor={COLORS.navy} />}
      >
        <CivicHeader onOpenNotifications={() => onChangeTab("feed")} onOpenProfile={() => onChangeTab("profile")} />
        <View style={styles.dashboardTop}>
          <View>
            <Text style={styles.dashboardDay}>{formatDashboardDay()}, {formatDashboardDate()}</Text>
          </View>
          <View style={styles.dashboardCityChip}>
            <Ionicons name="location-outline" size={16} color={COLORS.navyDark} />
            <Text style={styles.dashboardCityText}>Ужгород</Text>
          </View>
        </View>

        <WeatherPreview onPress={onOpenWeather} />

        <DefendersSupportBanner onPress={() => void openOfficialLink(FEATURED_DEFENDER_DONATION.donationUrl)} />

        <View style={styles.dashboardSectionRow}>
          <Text style={styles.dashboardSectionTitle}>Важливе</Text>
          <Pressable onPress={() => onChangeTab("feed")}><Text style={styles.dashboardAllLink}>Усі</Text></Pressable>
        </View>
        <OfficialNewsPreview
          refreshSignal={newsRefreshSignal}
          onLoadEnd={finishNewsRefresh}
          onOpenFeed={() => onChangeTab("feed")}
          onOpenArticle={onOpenArticle}
        />

        <CurrencyWidget />

        <View style={styles.dashboardSectionRow}>
          <Text style={styles.dashboardSectionTitle}>Популярні сервіси</Text>
          <Pressable onPress={() => onChangeTab("services")}><Text style={styles.dashboardAllLink}>Усі</Text></Pressable>
        </View>
        <View style={styles.dashboardServicesGrid}>
          <DashboardServiceCard icon="bus-outline" title="Рух транспорту" onPress={onOpenTransport} />
          <DashboardServiceCard icon="card-outline" title="Оплата проїзду" onPress={() => onOpenService("transport-payment")} />
          <DashboardServiceCard icon="car-outline" title="Паркування" onPress={() => onOpenService("parking")} />
          <DashboardServiceCard icon="accessibility-outline" title="Доступне місто" onPress={() => onOpenService("accessibility")} />
          <DashboardServiceCard icon="document-text-outline" title="Запис до ЦНАП" onPress={() => onOpenService("cnap")} />
        </View>
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
      if (editorial.items.length > 0) setFunds(editorial.items);
    }).catch(() => {
      // The permanent mono jar and a safe empty list remain visible until the API is deployed.
    });
  }, []);

  return (
    <SafeAreaView {...swipeBack} style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.defendersContent}>
        <CivicHeader />
        <BackLink label="До головної" onPress={onBack} />
        <View style={styles.defendersIntro}>
          <Text style={styles.defendersIntroTitle}>Підтримка захисників</Text>
          <Text style={styles.defendersIntroText}>Лише прямі, перевірені посилання на збори для підрозділів, пов’язаних із Закарпаттям.</Text>
        </View>

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

function DashboardServiceCard({ icon, title, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; onPress: () => void }) {
  return <Pressable style={styles.dashboardServiceCard} onPress={onPress}>
    <View style={styles.dashboardServiceIcon}><Ionicons name={icon} size={24} color={COLORS.navy} /></View>
    <Text style={styles.dashboardServiceTitle}>{title}</Text>
  </Pressable>;
}

function OfficialNewsPreview({ refreshSignal, onLoadEnd, onOpenFeed, onOpenArticle }: { refreshSignal: number; onLoadEnd: () => void; onOpenFeed: () => void; onOpenArticle: (item: OfficialNewsItem) => void }) {
  const [data, setData] = useState<OfficialNewsList | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void getOfficialNews(refreshSignal > 0).then(setData).catch(() => setData(null)).finally(() => {
      setLoading(false);
      onLoadEnd();
    });
  }, [onLoadEnd, refreshSignal]);

  if (loading) {
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
    {data.items.slice(0, 3).map((item) => <Pressable key={item.sourceUrl} style={styles.homeNewsItem} onPress={() => onOpenArticle(item)}>
      <View style={styles.homeNewsCopy}>
        <Text numberOfLines={2} style={styles.homeNewsTitle}>{item.title}</Text>
        {item.publishedLabel ? <Text style={styles.homeNewsMeta}>{item.publishedLabel}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
    </Pressable>)}
    <Pressable style={styles.homeNewsAllButton} onPress={onOpenFeed}>
      <Text style={styles.homeNewsAllText}>Вся стрічка новин</Text>
      <Ionicons name="arrow-forward" size={16} color={COLORS.navy} />
    </Pressable>
  </View>;
}

function CurrencyWidget() {
  const [data, setData] = useState<CurrencyRates | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getCurrencyRates().then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

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
          <Text style={styles.currencyMeta}>продаж</Text>
        </View>)}
      </View> : <Text style={styles.currencyUnavailable}>{loading ? "Завантажуємо курси…" : "Курси зараз недоступні"}</Text>}
      {data?.stale ? <Text style={styles.currencyStale}>Показано останнє доступне оновлення</Text> : null}
    </View>
  );
}

function WeatherPreview({ onPress }: { onPress: () => void }) {
  const [data, setData] = useState<Weather | null>(null);
  const [alert, setAlert] = useState<AirAlertStatus | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  useEffect(() => {
    void getWeather().then(setData).catch(() => setData(null)).finally(() => setWeatherLoading(false));
    void getAirAlertStatus().then(setAlert).catch(() => setAlert(null));
    const timer = setInterval(() => void getAirAlertStatus().then(setAlert).catch(() => setAlert(null)), 60_000);
    return () => clearInterval(timer);
  }, []);

  const airQuality = data?.current.airQuality;
  const alertIsActive = alert?.state === "ACTIVE";
  return <Pressable style={styles.weatherFeatureCard} onPress={onPress}>
    <View style={styles.weatherFeatureInfo}>
      <View style={styles.weatherFeatureMain}>
        <Text style={styles.weatherFeatureLabel}>Погода зараз</Text>
        <View style={styles.weatherFeatureTemperatureRow}>
          <Text style={styles.weatherFeatureTemperature}>{data ? `${Math.round(data.current.temperatureC)}°` : "—"}</Text>
          {data ? <Image source={{ uri: data.current.iconUrl }} style={styles.weatherFeatureIcon} /> : <Ionicons name="partly-sunny-outline" size={31} color={COLORS.navy} />}
        </View>
        <Text style={styles.weatherFeatureCondition}>{data ? data.current.condition : weatherLoading ? "Оновлюємо дані" : "Погода недоступна"}</Text>
      </View>
      <View style={styles.weatherFeatureAir}>
        <Ionicons name="leaf-outline" size={18} color={COLORS.green} />
        <Text style={styles.weatherFeatureAirLabel}>Якість повітря</Text>
        <Text style={styles.weatherFeatureAirValue}>{airQuality ? airQualityLabel(airQuality.index) : weatherLoading ? "Оновлюємо" : "Немає даних"}</Text>
        <Text style={styles.weatherFeatureAirMeta}>{airQuality ? `PM2.5 ${Math.round(airQuality.pm25)}` : ""}</Text>
      </View>
    </View>
    <View style={[styles.weatherFeatureAlert, alertIsActive ? styles.weatherFeatureAlertActive : alert?.state === "CLEAR" ? styles.weatherFeatureAlertClear : styles.weatherFeatureAlertUnknown]}>
        <Ionicons name={alertIsActive ? "warning-outline" : alert?.state === "CLEAR" ? "shield-checkmark-outline" : "help-circle-outline"} size={20} color={alertIsActive ? COLORS.danger : alert?.state === "CLEAR" ? COLORS.green : COLORS.muted} />
      <Text style={[styles.weatherFeatureAlertText, alertIsActive && styles.weatherFeatureAlertTextActive]}>{alertIsActive ? "Тривога" : alert?.state === "CLEAR" ? "Тривоги\nнемає" : "Статус\nневідомий"}</Text>
    </View>
  </Pressable>;
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
    <CivicHeader />
    <BackLink label="На головну" onPress={onBack} />
    <ScrollView contentContainerStyle={styles.weatherContent}>
      <View style={styles.detailIntro}>
        <Text style={styles.detailTitle}>Погода в Ужгороді</Text>
        <Text style={styles.detailDescription}>Актуальні умови та погодинний прогноз.</Text>
      </View>
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
  const [data, setData] = useState<OfficialNewsList | null>(null);
  const [alertEvents, setAlertEvents] = useState<AirAlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadNews();
    void loadAlertEvents();
    const timer = setInterval(() => void loadAlertEvents(), 30_000);
    return () => clearInterval(timer);
  }, []);

  async function loadNews() {
    setLoading(true);
    setError(null);
    try {
      setData(await getOfficialNews());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Невідома помилка");
    } finally {
      setLoading(false);
    }
  }

  async function loadAlertEvents() {
    try {
      setAlertEvents((await getAirAlertEvents()).events);
    } catch {
      setAlertEvents([]);
    }
  }

  const feedGroups = groupFeedEntriesByDay(data?.items.slice(0, 10) ?? [], alertEvents);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.simpleTabContent}>
        <CivicHeader onOpenProfile={() => onChangeTab("profile")} />
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
            <Pressable onPress={() => void loadNews()}>
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
        {data && data.items.length > 10 ? <Pressable style={styles.newsMoreLink} onPress={() => void openOfficialLink("https://rada-uzhgorod.gov.ua/")}>
          <Text style={styles.newsMoreLinkText}>Усі новини на сайті міськради</Text>
          <Ionicons name="open-outline" size={16} color={COLORS.navy} />
        </Pressable> : null}
      </ScrollView>
      <BottomNavigation activeTab="feed" onChangeTab={onChangeTab} />
    </SafeAreaView>
  );
}

function NewsArticleScreen({ item, backLabel, onBack }: { item: OfficialNewsItem; backLabel: string; onBack: () => void }) {
  const [article, setArticle] = useState<OfficialNewsArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const swipeBack = useSwipeBack(onBack);

  useEffect(() => {
    void loadArticle();
  }, [item.sourceUrl]);

  async function loadArticle() {
    setLoading(true);
    setError(null);
    try {
      setArticle(await getOfficialNewsArticle(item));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не вдалося завантажити короткий перегляд новини.");
    } finally {
      setLoading(false);
    }
  }

  const title = article?.title || item.title;
  return <SafeAreaView {...swipeBack} style={styles.screen}>
    <StatusBar style="dark" />
    <ScrollView contentContainerStyle={styles.newsReaderContent}>
      <CivicHeader />
      <BackLink label={backLabel} onPress={onBack} />
      <Text style={styles.newsReaderTitle}>{title}</Text>
      <Text style={styles.newsReaderDate}>Ужгородська міська рада{article?.publishedLabel || item.publishedLabel ? ` · ${article?.publishedLabel ?? item.publishedLabel}` : ""}</Text>
      {loading ? <ActivityIndicator style={styles.inlineLoader} color={COLORS.navy} /> : null}
      {error ? <View style={styles.inlineError}>
        <Text style={styles.inlineErrorText}>{error}</Text>
        <Pressable onPress={() => void loadArticle()}><Text style={styles.inlineRetry}>Спробувати ще раз</Text></Pressable>
      </View> : null}
      {article?.preview ? <Text style={styles.newsReaderPreviewText}>{article.preview}</Text> : null}
      {!loading && !error && !article?.preview ? <Text style={styles.newsReaderAttributionText}>Повний текст цієї публікації доступний на сайті міської ради.</Text> : null}
      <Pressable style={styles.newsReaderOriginalButton} onPress={() => void openOfficialLink(item.sourceUrl)}>
        <Text style={styles.newsReaderOriginalButtonText}>Повний матеріал на сайті міськради</Text>
        <Ionicons name="open-outline" size={17} color="#ffffff" />
      </Pressable>
    </ScrollView>
  </SafeAreaView>;
}

function ProfileScreen({
  accountEmail,
  favoriteSummary,
  language,
  isDarkTheme,
  paymentCard,
  onOpenLanguage,
  onOpenNotifications,
  onOpenAccount,
  onOpenPaymentMethods,
  onOpenLegal,
  onChangeTab,
}: {
  accountEmail?: string;
  favoriteSummary?: string;
  language: "uk" | "en";
  isDarkTheme: boolean;
  paymentCard: DemoPaymentCard | null;
  onOpenLanguage: () => void;
  onOpenNotifications: () => void;
  onOpenAccount: () => void;
  onOpenPaymentMethods: () => void;
  onOpenLegal: () => void;
  onChangeTab: (tab: RootTab) => void;
}) {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.simpleTabContent}>
        <CivicHeader onOpenNotifications={() => onChangeTab("feed")} />
        <View style={styles.pageIntro}>
          <Text style={styles.pageTitle}>Налаштування</Text>
        </View>

        <Text style={styles.profileSectionTitle}>Застосунок</Text>
        <View style={styles.profileGroup}>
          <ProfileRow icon="person-outline" title={accountEmail ? "Ваш акаунт" : "Створити акаунт"} value={accountEmail ? favoriteSummary : "Для збереження вибору"} onPress={onOpenAccount} />
          <ProfileRow
            icon="notifications-outline"
            title="Сповіщення"
            value="Керування категоріями"
            onPress={onOpenNotifications}
          />
          <ProfileRow
            icon="card-outline"
            title="Способи оплати"
            value={paymentCard ? `Картка •••• ${paymentCard.last4}` : "Apple Pay, Google Pay або картка"}
            onPress={onOpenPaymentMethods}
          />
          <ProfileRow icon="language-outline" title="Мова / Language" value={language === "uk" ? "Українська" : "English · частково"} onPress={onOpenLanguage} />
          <ProfileRow icon={isDarkTheme ? "moon-outline" : "sunny-outline"} title="Тема" value={`За системою · ${isDarkTheme ? "темна" : "світла"}`} />
        </View>

        <Text style={styles.profileSectionTitle}>Підтримка й інформація</Text>
        <View style={styles.profileGroup}>
          <ProfileRow icon="open-outline" title="Офіційний сайт міської ради" onPress={() => void openOfficialLink("https://rada-uzhgorod.gov.ua/")} />
          <ProfileRow
            icon="information-circle-outline"
            title="Про застосунок"
            value="Версія 1.0"
            onPress={() => Alert.alert("Ужгород Цифровий", "Міський застосунок із перевіреними сервісами, розкладами та довідками. Дані показуємо лише з офіційних або вказаних джерел.")}
          />
          <ProfileRow icon="shield-checkmark-outline" title="Правила та приватність" value="Дані, джерела й права користувача" onPress={onOpenLegal} />
        </View>

        <Text style={styles.profileFooter}>Базові сервіси доступні без акаунта.</Text>
      </ScrollView>
      <BottomNavigation activeTab="profile" onChangeTab={onChangeTab} />
    </SafeAreaView>
  );
}

function ProfileRow({
  icon,
  title,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  value?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable accessibilityLabel={value ? `${title}. ${value}` : title} accessibilityRole={onPress ? "button" : undefined} disabled={!onPress} style={styles.profileRow} onPress={onPress}>
      <View style={styles.profileRowIcon}>
        <Ionicons name={icon} size={20} color={COLORS.navy} />
      </View>
      <View style={styles.profileRowText}>
        <Text style={styles.profileRowTitle}>{title}</Text>
        {value ? <Text style={styles.profileRowValue}>{value}</Text> : null}
      </View>
      {onPress ? <Ionicons name={icon === "open-outline" ? "open-outline" : "chevron-forward"} size={18} color={COLORS.muted} /> : null}
    </Pressable>
  );
}

function PaymentMethodsScreen({
  accountEmail,
  card,
  onBack,
  onSaveCard,
  onRemoveCard,
}: {
  accountEmail?: string;
  card: DemoPaymentCard | null;
  onBack: () => void;
  onSaveCard: (card: DemoPaymentCard) => void;
  onRemoveCard: () => void;
}) {
  const [last4, setLast4] = useState(card?.last4 ?? "");
  const [label, setLabel] = useState(card?.label ?? "Особиста картка");
  const swipeBack = useSwipeBack(onBack);
  const save = () => {
    if (last4.length !== 4) {
      Alert.alert("Вкажіть 4 цифри", "У поточній версії достатньо лише останніх чотирьох цифр картки.");
      return;
    }
    onSaveCard({ last4, label: label.trim() || "Банківська картка" });
  };

  return <SafeAreaView {...swipeBack} style={styles.screen}>
    <StatusBar style="dark" />
    <ScrollView contentContainerStyle={styles.paymentContent} keyboardShouldPersistTaps="handled">
      <CivicHeader />
      <BackLink label="До налаштувань" onPress={onBack} />
      <Text style={styles.settingsPageTitle}>Способи оплати</Text>
      <Text style={styles.settingsPageDescription}>Оберіть спосіб, який буде доступний під час оплати проїзду.</Text>

      <View style={styles.paymentSafetyNote}>
        <Ionicons name="shield-checkmark-outline" size={19} color={COLORS.navy} />
        <Text style={styles.paymentSafetyText}>Поки доступний лише попередній перегляд: зберігаємо останні 4 цифри картки в цьому сеансі. Номер, термін дії та код безпеки не вводяться.</Text>
      </View>

      <Text style={styles.paymentSectionTitle}>Гаманець телефону</Text>
      <View style={styles.paymentMethod}>
        <View style={styles.paymentMethodIcon}><Ionicons name="phone-portrait-outline" size={20} color={COLORS.navy} /></View>
        <View style={styles.paymentMethodCopy}><Text style={styles.paymentMethodTitle}>Apple Pay або Google Pay</Text><Text style={styles.paymentMethodText}>Буде доступно на пристроях, де гаманець налаштований.</Text></View>
        <Ionicons name="checkmark-circle" size={20} color={COLORS.green} />
      </View>

      <Text style={styles.paymentSectionTitle}>Банківська картка</Text>
      {card ? <View style={styles.savedPaymentCard}>
        <View style={styles.savedPaymentCardTop}>
          <View style={styles.savedPaymentCardIcon}><Ionicons name="card-outline" size={23} color="#ffffff" /></View>
          <View style={styles.paymentMethodCopy}><Text style={styles.savedPaymentCardLabel}>{card.label}</Text><Text style={styles.savedPaymentCardNumber}>•••• {card.last4}</Text></View>
          <Ionicons name="checkmark-circle" size={21} color="#dff1da" />
        </View>
        <Pressable accessibilityLabel="Видалити картку" accessibilityRole="button" style={styles.removePaymentCardButton} onPress={() => { onRemoveCard(); setLast4(""); }}>
          <Ionicons name="trash-outline" size={17} color={COLORS.navy} />
          <Text style={styles.removePaymentCardText}>Видалити картку</Text>
        </Pressable>
      </View> : <View style={styles.paymentCardFields}>
        <Text style={styles.paymentFieldLabel}>Назва картки</Text>
        <TextInput accessibilityLabel="Назва картки" onChangeText={setLabel} placeholder="Наприклад, Основна" placeholderTextColor={COLORS.muted} value={label} style={styles.paymentCardInput} />
        <Text style={[styles.paymentFieldLabel, styles.paymentLast4Label]}>Останні 4 цифри картки</Text>
        <TextInput accessibilityLabel="Останні чотири цифри картки" keyboardType="number-pad" maxLength={4} onChangeText={(value) => setLast4(value.replace(/\D/g, "").slice(0, 4))} placeholder="4242" placeholderTextColor={COLORS.muted} value={last4} style={styles.paymentCardInput} />
        <Pressable accessibilityLabel="Додати картку" accessibilityRole="button" style={styles.paymentSubmitButton} onPress={save}>
          <Ionicons name="add-circle-outline" size={19} color="#ffffff" />
          <Text style={styles.paymentSubmitText}>Додати картку</Text>
        </Pressable>
      </View>}
      <Text style={styles.paymentMethodsFootnote}>{accountEmail ? `Коли підключимо платіжного провайдера, token картки можна буде безпечно прив’язати до ${accountEmail}.` : "У реальній версії для збереженої картки знадобиться акаунт і захищений платіжний провайдер."}</Text>
    </ScrollView>
  </SafeAreaView>;
}

function AccountScreen({ account, onAuthenticated, onLogout, onDeleteAccount, onBack }: {
  account: AccountSession | null;
  onAuthenticated: (account: AccountSession) => void | Promise<void>;
  onLogout: () => void;
  onDeleteAccount: () => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const swipeBack = useSwipeBack(onBack);

  async function submit() {
    if (!/^\S+@\S+\.\S+$/.test(email.trim()) || password.length < 10) {
      setError("Вкажіть коректну пошту та пароль від 10 символів.");
      return;
    }
    if (mode === "register" && password !== passwordRepeat) {
      setError("Паролі не збігаються. Повторіть пароль ще раз.");
      return;
    }
    setSubmitting(true); setError(null);
    try {
      await onAuthenticated(await (mode === "register" ? registerAccount(email, password) : loginAccount(email, password)));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не вдалося виконати дію.");
    } finally { setSubmitting(false); }
  }

  async function updatePassword() {
    if (!account || currentPassword.length < 10 || newPassword.length < 10) {
      setError("Вкажіть поточний та новий пароль щонайменше з 10 символів.");
      return;
    }
    setSubmitting(true); setError(null);
    try {
      await onAuthenticated(await changeAccountPassword(account.accessToken, currentPassword, newPassword));
      setCurrentPassword(""); setNewPassword(""); setShowPasswordForm(false);
      Alert.alert("Пароль змінено", "Сесію оновлено для захисту акаунта.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не вдалося змінити пароль.");
    } finally { setSubmitting(false); }
  }

  function confirmDelete() {
    Alert.alert("Видалити акаунт?", "Цю дію не можна скасувати: буде видалено налаштування й обране.", [
      { text: "Скасувати", style: "cancel" },
      { text: "Видалити", style: "destructive", onPress: onDeleteAccount },
    ]);
  }

  return <SafeAreaView {...swipeBack} style={styles.screen}>
    <StatusBar style="dark" />
    <ScrollView contentContainerStyle={styles.settingsContent} keyboardShouldPersistTaps="handled">
      <CivicHeader />
      <BackLink label="До налаштувань" onPress={onBack} />
      <View style={styles.accountIntro}>
        <Text style={styles.pageTitle}>{account ? "Акаунт підключено" : "Акаунт"}</Text>
        {account ? <Text style={styles.accountIntroText}>{account.preferences.email}</Text> : null}
      </View>
      {!account && <View style={styles.accountForm}>
        <View style={styles.accountModeRow}>
          <Pressable style={[styles.accountMode, mode === "register" && styles.accountModeActive]} onPress={() => { setMode("register"); setError(null); }}><Text style={[styles.accountModeText, mode === "register" && styles.accountModeTextActive]}>Реєстрація</Text></Pressable>
          <Pressable style={[styles.accountMode, mode === "login" && styles.accountModeActive]} onPress={() => { setMode("login"); setError(null); }}><Text style={[styles.accountModeText, mode === "login" && styles.accountModeTextActive]}>Увійти</Text></Pressable>
        </View>
        <Text style={styles.paymentFieldLabel}>Електронна пошта</Text>
        <TextInput autoCapitalize="none" keyboardType="email-address" onChangeText={setEmail} placeholder="name@example.com" placeholderTextColor={COLORS.muted} value={email} style={styles.paymentCardInput} />
        <Text style={[styles.paymentFieldLabel, styles.accountPasswordLabel]}>Пароль</Text>
        <TextInput onChangeText={setPassword} placeholder="Щонайменше 10 символів" placeholderTextColor={COLORS.muted} secureTextEntry value={password} style={styles.paymentCardInput} />
        {mode === "register" ? <>
          <Text style={[styles.paymentFieldLabel, styles.accountPasswordLabel]}>Повторіть пароль</Text>
          <TextInput accessibilityLabel="Повторіть пароль" onChangeText={setPasswordRepeat} placeholder="Введіть пароль ще раз" placeholderTextColor={COLORS.muted} secureTextEntry value={passwordRepeat} style={styles.paymentCardInput} />
        </> : null}
        {error ? <Text style={styles.accountError}>{error}</Text> : null}
        <Pressable disabled={submitting} style={styles.paymentSubmitButton} onPress={() => void submit()}>
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
        <Pressable accessibilityRole="button" style={styles.accountActionButton} onPress={onLogout}><Ionicons name="log-out-outline" size={19} color={COLORS.navy} /><Text style={styles.accountActionText}>Вийти з усіх пристроїв</Text></Pressable>
        <Pressable accessibilityRole="button" style={styles.accountDeleteButton} onPress={confirmDelete}><Ionicons name="trash-outline" size={19} color={COLORS.danger} /><Text style={styles.accountDeleteText}>Видалити акаунт і дані</Text></Pressable>
      </View>}
    </ScrollView>
  </SafeAreaView>;
}

function LegalScreen({ onBack }: { onBack: () => void }) {
  const swipeBack = useSwipeBack(onBack);
  return <SafeAreaView {...swipeBack} style={styles.screen}>
    <StatusBar style="dark" />
    <ScrollView contentContainerStyle={styles.settingsContent}>
      <CivicHeader />
      <BackLink label="До налаштувань" onPress={onBack} />
      <Text style={styles.settingsPageTitle}>Правила та приватність</Text>
      <Text style={styles.settingsPageDescription}>Коротка версія документів, які мають бути опубліковані за постійним посиланням до запуску в магазинах.</Text>

      <View style={styles.legalCard}>
        <View style={styles.legalCardHeading}><Ionicons name="shield-checkmark-outline" size={20} color={COLORS.navy} /><Text style={styles.legalCardTitle}>Приватність</Text></View>
        <Text style={styles.legalCardText}>Без акаунта застосунок не збирає персональні дані. Для акаунта зберігаємо пошту, хеш пароля, технічний хеш сесії, налаштування та обране. Номер картки й CVV застосунок не отримує.</Text>
        <Text style={styles.legalCardText}>Видалити акаунт і пов’язані з ним дані можна в розділі «Акаунт».</Text>
      </View>

      <View style={styles.legalCard}>
        <View style={styles.legalCardHeading}><Ionicons name="document-text-outline" size={20} color={COLORS.navy} /><Text style={styles.legalCardTitle}>Правила користування</Text></View>
        <Text style={styles.legalCardText}>Інформація про транспорт, безпеку, події та сервіси має довідковий характер. Перед дією у критичній ситуації перевіряйте офіційне джерело; застосунок не замінює екстрені служби.</Text>
      </View>

      <View style={styles.legalCard}>
        <View style={styles.legalCardHeading}><Ionicons name="server-outline" size={20} color={COLORS.navy} /><Text style={styles.legalCardTitle}>Джерела та обмеження</Text></View>
        <Text style={styles.legalCardText}>Кожен сервіс показує джерело там, де воно доступне. Дані сторонніх карт і розкладів можуть оновлюватися із затримкою; до офіційної інтеграції вони не є гарантією актуальності.</Text>
      </View>

      <Text style={styles.settingsFootnote}>Повні тексти: PRIVACY_POLICY_UK.md, TERMS_OF_USE_UK.md та DATA_SOURCES_AND_LIMITATIONS_UK.md у репозиторії. Перед публікацією додайте назву видавця, контактну адресу та HTTPS-посилання на ці документи.</Text>
    </ScrollView>
  </SafeAreaView>;
}

function LanguageSettingsScreen({
  language,
  onChangeLanguage,
  onBack,
}: {
  language: "uk" | "en";
  onChangeLanguage: (language: "uk" | "en") => void;
  onBack: () => void;
}) {
  const swipeBack = useSwipeBack(onBack);
  return <SafeAreaView {...swipeBack} style={styles.screen}>
    <StatusBar style="dark" />
    <ScrollView contentContainerStyle={styles.settingsContent}>
      <CivicHeader />
      <BackLink label="До налаштувань" onPress={onBack} />
      <Text style={styles.settingsPageTitle}>Мова / Language</Text>
      <Text style={styles.settingsPageDescription}>Українська доступна повністю. Англійська — лише приклад перемикача.</Text>
      <View style={styles.settingsCard}>
        <SettingsChoice icon="text-outline" title="Українська" subtitle="Основна мова інтерфейсу" selected={language === "uk"} onPress={() => onChangeLanguage("uk")} />
        <SettingsChoice icon="globe-outline" title="English" subtitle="Переклад поступово додається" selected={language === "en"} onPress={() => onChangeLanguage("en")} />
      </View>
      <Text style={styles.settingsFootnote}>Повний англійський інтерфейс з’явиться після перекладу всіх екранів.</Text>
    </ScrollView>
  </SafeAreaView>;
}

function NotificationSettingsScreen({ onBack }: { onBack: () => void }) {
  const [enabled, setEnabled] = useState({ alert: true, news: true, transport: false, silence: false });
  const swipeBack = useSwipeBack(onBack);
  return <SafeAreaView {...swipeBack} style={styles.screen}>
    <StatusBar style="dark" />
    <ScrollView contentContainerStyle={styles.settingsContent}>
      <CivicHeader />
      <BackLink label="До налаштувань" onPress={onBack} />
      <Text style={styles.settingsPageTitle}>Сповіщення</Text>
      <Text style={styles.settingsPageDescription}>Оберіть категорії повідомлень.</Text>
      <View style={styles.settingsSafetyNote}>
        <Ionicons name="information-circle-outline" size={18} color={COLORS.navy} />
        <Text style={styles.settingsSafetyText}>Основа для push уже є на сервері. Системний дозвіл і реальна доставка увімкнуться після підключення Apple/Firebase та тесту на фізичних пристроях.</Text>
      </View>
      <View style={styles.settingsCard}>
        <NotificationChoice icon="warning-outline" title="Повітряна тривога та відбій" subtitle="Лише після підтвердження від офіційного джерела" enabled={enabled.alert} onPress={() => setEnabled((value) => ({ ...value, alert: !value.alert }))} />
        <NotificationChoice icon="megaphone-outline" title="Важливі новини міста" subtitle="Оголошення міськради та критичні зміни" enabled={enabled.news} onPress={() => setEnabled((value) => ({ ...value, news: !value.news }))} />
        <NotificationChoice icon="bus-outline" title="Зміни у транспорті" subtitle="Скасування, перекриття, важливі зміни маршрутів" enabled={enabled.transport} onPress={() => setEnabled((value) => ({ ...value, transport: !value.transport }))} />
        <NotificationChoice icon="time-outline" title="Хвилина мовчання" subtitle="Делікатне нагадування о 09:00" enabled={enabled.silence} onPress={() => setEnabled((value) => ({ ...value, silence: !value.silence }))} />
      </View>
      <Text style={styles.settingsFootnote}>Для запуску сповіщень потрібні системний дозвіл і підтверджені джерела даних.</Text>
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
  return <Pressable accessibilityLabel={`${title}. ${subtitle}`} accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[styles.settingsChoice, selected && styles.settingsChoiceActive]}>
    <View style={styles.settingsChoiceIcon}><Ionicons name={icon} size={20} color={COLORS.navy} /></View>
    <View style={styles.settingsChoiceCopy}><Text style={styles.settingsChoiceTitle}>{title}</Text><Text style={styles.settingsChoiceText}>{subtitle}</Text></View>
    <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={21} color={selected ? COLORS.navy : COLORS.muted} />
  </Pressable>;
}

function NotificationChoice({ icon, title, subtitle, enabled, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  enabled: boolean;
  onPress: () => void;
}) {
  return <Pressable accessibilityLabel={`${title}. ${subtitle}`} accessibilityRole="switch" accessibilityState={{ checked: enabled }} onPress={onPress} style={styles.settingsChoice}>
    <View style={styles.settingsChoiceIcon}><Ionicons name={icon} size={20} color={COLORS.navy} /></View>
    <View style={styles.settingsChoiceCopy}><Text style={styles.settingsChoiceTitle}>{title}</Text><Text style={styles.settingsChoiceText}>{subtitle}</Text></View>
    <View style={[styles.settingsSwitch, enabled && styles.settingsSwitchOn]}><View style={[styles.settingsSwitchKnob, enabled && styles.settingsSwitchKnobOn]} /></View>
  </Pressable>;
}

function MiniaturesScreen({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<MiniSculptureList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const swipeBack = useSwipeBack(onBack);

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
      <CivicHeader />
      <BackLink label="До міських сервісів" onPress={onBack} />
      <View style={styles.detailIntro}>
        <View style={styles.eyebrowRow}>
          <View style={[styles.eyebrowDot, styles.eyebrowDotGreen]} />
          <Text style={styles.eyebrow}>Власний каталог міста</Text>
        </View>
        <Text style={styles.detailTitle}>Мініскульптури Ужгорода</Text>
        <Text style={styles.detailDescription}>Знайдіть маленькі символи міста на одній мапі та відкрийте точну локацію для прогулянки.</Text>
      </View>
      {loading && <ActivityIndicator style={styles.inlineLoader} color={COLORS.navy} />}
      {error && (
        <View style={styles.inlineError}>
          <Text style={styles.inlineErrorText}>{error}</Text>
          <Pressable onPress={() => void loadCatalog()}><Text style={styles.inlineRetry}>Спробувати ще раз</Text></Pressable>
        </View>
      )}
      {data && !error && (
        <FlatList
          data={data.sculptures}
          keyExtractor={(sculpture) => sculpture.id}
          contentContainerStyle={styles.miniaturesList}
          ListHeaderComponent={
            <>
              <View style={styles.miniaturesMapCard}>
                <MiniaturesMap sculptures={data.sculptures} />
              </View>
              <View style={styles.miniaturesCountRow}>
                <View style={styles.miniaturesCountPill}><Ionicons name="walk-outline" size={15} color={COLORS.navy} /><Text style={styles.miniaturesCountText}>{data.sculptures.length} локація</Text></View>
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
          ListFooterComponent={<Text style={styles.miniaturesFooter}>Додаємо нові точки поступово — тільки з координатами, які можна перевірити.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

function MiniatureCard({ sculpture, index }: { sculpture: MiniSculpture; index: number }) {
  const installedAt = new Intl.DateTimeFormat("uk-UA", { year: "numeric" }).format(new Date(`${sculpture.installedAt}T12:00:00`));
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${sculpture.latitude},${sculpture.longitude}`;
  return (
    <View style={styles.miniatureCard}>
      <View style={styles.miniatureCardTop}>
        <View style={styles.miniatureNumber}><Text style={styles.miniatureNumberText}>{index}</Text></View>
        <View style={styles.miniatureCardCopy}>
          <Text style={styles.miniatureTitle}>{sculpture.title}</Text>
          <Text style={styles.miniatureAddress}>{sculpture.address}</Text>
        </View>
      </View>
      <Text style={styles.miniatureSummary}>{sculpture.summary}</Text>
      <View style={styles.miniatureMeta}><Text style={styles.miniatureMetaText}>{sculpture.author}</Text><Text style={styles.miniatureMetaText}>· {installedAt}</Text></View>
      <Pressable style={styles.miniatureMapAction} onPress={() => void openOfficialLink(mapsUrl)}>
        <Ionicons name="navigate-outline" size={16} color={COLORS.navy} />
        <Text style={styles.miniatureMapActionText}>Відкрити координати</Text>
        <Ionicons name="open-outline" size={15} color={COLORS.navy} />
      </Pressable>
    </View>
  );
}

function BottomNavigation({ activeTab, onChangeTab }: { activeTab: RootTab | null; onChangeTab: (tab: RootTab) => void }) {
  const items: Array<{ id: RootTab; icon: keyof typeof Ionicons.glyphMap; label: string }> = [
    { id: "home", icon: "home-outline", label: "Головна" },
    { id: "services", icon: "grid-outline", label: "Сервіси" },
    { id: "feed", icon: "notifications-outline", label: "Стрічка" },
    { id: "profile", icon: "person-outline", label: "Профіль" },
  ];
  return <View style={styles.bottomNavigation}>{items.map((item) => (
    <Pressable key={item.id} style={styles.tabButton} onPress={() => onChangeTab(item.id)}>
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

  useEffect(() => {
    const timer = setTimeout(() => void loadBuildings(query), 250);
    return () => clearTimeout(timer);
  }, [query]);

  async function loadBuildings(searchQuery = query) {
    setLoading(true);
    setError(null);
    try {
      setData(await getAccessibleBuildings(searchQuery));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Невідома помилка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView {...swipeBack} style={styles.screen}>
      <StatusBar style="dark" />
      <CivicHeader />
      <BackLink label="До міських сервісів" onPress={onBack} />
      <View style={styles.detailIntro}>
        <View style={styles.eyebrowRow}>
          <View style={[styles.eyebrowDot, styles.eyebrowDotGreen]} />
          <Text style={styles.eyebrow}>Офіційний реєстр доступності</Text>
        </View>
        <Text style={styles.detailTitle}>Доступне місто</Text>
        <Text style={styles.detailDescription}>Будівлі, щодо яких міська рада проводила перевірку або моніторинг доступності.</Text>
      </View>
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
    ? new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long", year: "numeric" })
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

function CnapAppointmentDemoScreen({ onBack }: { onBack: () => void }) {
  const [service, setService] = useState(CNAP_SERVICE_OPTIONS[0]);
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [details, setDetails] = useState("");
  const swipeBack = useSwipeBack(onBack);

  function submitDemo() {
    if (!details.trim()) {
      Alert.alert("Додайте опис", "Коротко опишіть запит, щоб переглянути чернетку звернення.");
      return;
    }
    Alert.alert(
      "Звернення не надіслано",
      "Форма поки не передає дані до ЦНАП і не зберігає введену інформацію. Після погодження API тут з’явиться безпечне подання звернення та статус опрацювання.",
    );
  }

  return (
    <SafeAreaView {...swipeBack} style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.cnapContent} keyboardShouldPersistTaps="handled">
        <CivicHeader />
        <BackLink label="До міських сервісів" onPress={onBack} />
        <Text style={styles.settingsPageTitle}>Запис до ЦНАП</Text>
        <Text style={styles.settingsPageDescription}>Чернетка звернення без надсилання даних.</Text>

        <View style={styles.cnapSafetyNote}>
          <Ionicons name="information-circle-outline" size={20} color={COLORS.navy} />
          <Text style={styles.cnapSafetyNoteText}>Форма поки не надсилається. Не вводьте справжні персональні дані.</Text>
        </View>

        <View style={styles.cnapFormCard}>
          <Text style={styles.cnapFormTitle}>Дані звернення</Text>
          <Text style={styles.cnapFieldLabel}>Послуга *</Text>
          <Pressable accessibilityLabel={`Обрати послугу ЦНАП. Зараз: ${service}`} accessibilityRole="button" style={styles.cnapSelect} onPress={() => setServicePickerOpen((open) => !open)}>
            <Text style={styles.cnapSelectText}>{service}</Text>
            <Ionicons name={servicePickerOpen ? "chevron-up" : "chevron-down"} size={18} color={COLORS.navy} />
          </Pressable>
          {servicePickerOpen ? <View style={styles.cnapOptions}>
            {CNAP_SERVICE_OPTIONS.map((option) => <Pressable
              key={option}
              accessibilityLabel={`Обрати послугу: ${option}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: option === service }}
              onPress={() => { setService(option); setServicePickerOpen(false); }}
              style={[styles.cnapOption, option === service && styles.cnapOptionActive]}
            >
              <Text style={[styles.cnapOptionText, option === service && styles.cnapOptionTextActive]}>{option}</Text>
              {option === service ? <Ionicons name="checkmark" size={17} color="#ffffff" /> : null}
            </Pressable>)}
          </View> : null}

          <Text style={styles.cnapFieldLabel}>Ім’я · необов’язково</Text>
          <TextInput accessibilityLabel="Ім’я, необов’язково" value={name} onChangeText={setName} placeholder="Ім’я" placeholderTextColor={COLORS.muted} style={styles.cnapInput} />
          <Text style={styles.cnapFieldLabel}>Контакт · необов’язково</Text>
          <TextInput accessibilityLabel="Контакт, необов’язково" value={contact} onChangeText={setContact} placeholder="Електронна пошта або телефон" placeholderTextColor={COLORS.muted} style={styles.cnapInput} />
          <Text style={styles.cnapFieldLabel}>Коротко опишіть запит *</Text>
          <TextInput accessibilityLabel="Короткий опис запиту, обов’язково" value={details} onChangeText={setDetails} multiline numberOfLines={4} placeholder="Що саме потрібно уточнити?" placeholderTextColor={COLORS.muted} style={[styles.cnapInput, styles.cnapTextarea]} textAlignVertical="top" />
          <Pressable accessibilityLabel="Переглянути чернетку звернення" accessibilityRole="button" style={styles.cnapSubmitButton} onPress={submitDemo}>
            <Ionicons name="send-outline" size={18} color="#ffffff" />
            <Text style={styles.cnapSubmitText}>Переглянути чернетку</Text>
          </Pressable>
          <Text style={styles.cnapFormFootnote}>Жодні дані з цієї форми не надходять до ЦНАП.</Text>
        </View>

        <Pressable accessibilityLabel="Відкрити офіційний кабінет ЦНАП" accessibilityRole="link" style={styles.cnapOfficialLink} onPress={() => void openOfficialLink("https://my.cnap.rada-uzhgorod.gov.ua/")}>
          <Ionicons name="open-outline" size={18} color={COLORS.navy} />
          <View style={styles.cnapOfficialLinkCopy}>
            <Text style={styles.cnapOfficialLinkTitle}>Потрібна послуга вже зараз?</Text>
            <Text style={styles.cnapOfficialLinkText}>Відкрити офіційний кабінет ЦНАП</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function TransportPaymentDemoScreen({ card, onBack, onManagePaymentMethods }: { card: DemoPaymentCard | null; onBack: () => void; onManagePaymentMethods: () => void }) {
  const [method, setMethod] = useState<"card" | "wallet">(card ? "card" : "wallet");
  const [boardingMethod, setBoardingMethod] = useState<"qr" | "number">("qr");
  const [busReference, setBusReference] = useState("");
  const [ticketCreated, setTicketCreated] = useState(false);
  const swipeBack = useSwipeBack(onBack);
  const busReferenceLabel = busReference.trim();
  const canContinue = (method === "wallet" || Boolean(card)) && busReferenceLabel.length > 0;

  if (ticketCreated) {
    return <SafeAreaView {...swipeBack} style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.paymentContent}>
        <CivicHeader />
        <BackLink label="До міських сервісів" onPress={onBack} />
        <View style={styles.paymentSuccessHero}>
          <Text style={styles.paymentSuccessTitle}>Зразок квитка</Text>
          <Text style={styles.paymentSuccessText}>Кошти не списано. QR-код не дійсний для проїзду.</Text>
        </View>
        <View style={styles.demoTicket}>
          <View style={styles.demoTicketTop}>
            <View><Text style={styles.demoTicketLabel}>ЗРАЗОК КВИТКА</Text><Text style={styles.demoTicketTitle}>Разова поїздка · {busReferenceLabel}</Text></View>
            <Ionicons name="bus-outline" size={27} color={COLORS.navy} />
          </View>
          <View style={styles.demoQr}><View style={styles.demoQrInner}><Ionicons name="qr-code-outline" size={66} color={COLORS.navyDark} /></View></View>
          <View style={styles.demoTicketMeta}><Text style={styles.demoTicketMetaText}>{boardingMethod === "qr" ? "QR у салоні" : "Бортовий номер"}</Text><Text style={styles.demoTicketMetaText}>0,00 ₴</Text></View>
        </View>
        <Pressable style={styles.paymentSecondaryButton} onPress={() => setTicketCreated(false)}>
          <Ionicons name="refresh-outline" size={18} color={COLORS.navy} />
          <Text style={styles.paymentSecondaryButtonText}>Повернутися до оплати</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>;
  }

  return <SafeAreaView {...swipeBack} style={styles.screen}>
    <StatusBar style="dark" />
    <ScrollView contentContainerStyle={styles.paymentContent}>
      <CivicHeader />
      <BackLink label="До міських сервісів" onPress={onBack} />
      <Text style={styles.settingsPageTitle}>Оплата проїзду</Text>
      <Text style={styles.settingsPageDescription}>Оберіть автобус, а потім спосіб оплати.</Text>
      <View style={styles.paymentSafetyNote}>
        <Ionicons name="lock-closed-outline" size={19} color={COLORS.navy} />
        <Text style={styles.paymentSafetyText}>Оплата ще не підключена: гроші не списуються, квиток не дійсний. Не вводьте дані справжньої картки.</Text>
      </View>
      <View style={styles.paymentCard}>
        <Text style={styles.paymentSectionTitle}>Оберіть автобус</Text>
        <Pressable accessibilityLabel="Сканувати QR-код у салоні" accessibilityRole="radio" accessibilityState={{ selected: boardingMethod === "qr" }} onPress={() => setBoardingMethod("qr")} style={[styles.paymentMethod, boardingMethod === "qr" && styles.paymentMethodActive]}>
          <View style={styles.paymentMethodIcon}><Ionicons name="qr-code-outline" size={20} color={COLORS.navy} /></View>
          <View style={styles.paymentMethodCopy}><Text style={styles.paymentMethodTitle}>Сканувати QR у салоні</Text><Text style={styles.paymentMethodText}>Код прив'яже квиток до автобуса</Text></View>
          <Ionicons name={boardingMethod === "qr" ? "radio-button-on" : "radio-button-off"} size={20} color={boardingMethod === "qr" ? COLORS.navy : COLORS.muted} />
        </Pressable>
        <Pressable accessibilityLabel="Ввести бортовий номер автобуса" accessibilityRole="radio" accessibilityState={{ selected: boardingMethod === "number" }} onPress={() => setBoardingMethod("number")} style={[styles.paymentMethod, boardingMethod === "number" && styles.paymentMethodActive]}>
          <View style={styles.paymentMethodIcon}><Ionicons name="bus-outline" size={20} color={COLORS.navy} /></View>
          <View style={styles.paymentMethodCopy}><Text style={styles.paymentMethodTitle}>Ввести бортовий номер</Text><Text style={styles.paymentMethodText}>Наприклад, АО… — якщо QR неможливо зчитати</Text></View>
          <Ionicons name={boardingMethod === "number" ? "radio-button-on" : "radio-button-off"} size={20} color={boardingMethod === "number" ? COLORS.navy : COLORS.muted} />
        </Pressable>
        <View style={styles.paymentReferenceBlock}>
          <Text style={styles.paymentFieldLabel}>{boardingMethod === "qr" ? "Код із QR" : "Бортовий номер"}</Text>
          <TextInput
            accessibilityLabel={boardingMethod === "qr" ? "Код із QR" : "Бортовий номер автобуса"}
            autoCapitalize="characters"
            onChangeText={(value) => setBusReference(value.toUpperCase())}
            placeholder={boardingMethod === "qr" ? "Наприклад, UZH-AO123" : "Наприклад, АО123"}
            placeholderTextColor={COLORS.muted}
            value={busReference}
            style={styles.paymentCardInput}
          />
          {boardingMethod === "qr" ? <Text style={styles.paymentReferenceHint}>Камеру підключимо разом з оператором оплати. У демо можна ввести код, надрукований поруч із QR.</Text> : null}
        </View>
        <Text style={styles.paymentSectionTitle}>Ваш квиток</Text>
        <View style={styles.paymentTicketChoice}>
          <View style={styles.paymentTicketIcon}><Ionicons name="bus-outline" size={22} color={COLORS.navy} /></View>
          <View style={styles.paymentTicketCopy}><Text style={styles.paymentTicketTitle}>Разова поїздка</Text><Text style={styles.paymentTicketText}>{busReferenceLabel ? `Бортовий №: ${busReferenceLabel}` : "Вкажіть автобус вище"}</Text></View>
          <Text style={styles.paymentTicketPrice}>0,00 ₴</Text>
        </View>
        <Text style={styles.paymentSectionTitle}>Спосіб оплати</Text>
        <Pressable accessibilityLabel="Гаманець телефону: Apple Pay або Google Pay" accessibilityRole="radio" accessibilityState={{ selected: method === "wallet" }} onPress={() => setMethod("wallet")} style={[styles.paymentMethod, method === "wallet" && styles.paymentMethodActive]}>
          <View style={styles.paymentMethodIcon}><Ionicons name="phone-portrait-outline" size={20} color={COLORS.navy} /></View>
          <View style={styles.paymentMethodCopy}><Text style={styles.paymentMethodTitle}>Гаманець телефону</Text><Text style={styles.paymentMethodText}>Apple Pay або Google Pay</Text></View>
          <Ionicons name={method === "wallet" ? "radio-button-on" : "radio-button-off"} size={20} color={method === "wallet" ? COLORS.navy : COLORS.muted} />
        </Pressable>
        <Pressable accessibilityLabel={card ? `Картка, останні цифри ${card.last4}` : "Банківська картка. Додайте картку у профілі"} accessibilityRole="radio" accessibilityState={{ selected: method === "card" }} onPress={() => setMethod("card")} style={[styles.paymentMethod, method === "card" && styles.paymentMethodActive]}>
          <View style={styles.paymentMethodIcon}><Ionicons name="card-outline" size={20} color={COLORS.navy} /></View>
          <View style={styles.paymentMethodCopy}><Text style={styles.paymentMethodTitle}>{card ? `Картка •••• ${card.last4}` : "Банківська картка"}</Text><Text style={styles.paymentMethodText}>{card ? `${card.label} · додано у профілі` : "Додайте картку у профілі"}</Text></View>
          <Ionicons name={method === "card" ? "radio-button-on" : "radio-button-off"} size={20} color={method === "card" ? COLORS.navy : COLORS.muted} />
        </Pressable>
        {method === "card" && !card ? <Pressable style={styles.paymentAddCardRow} onPress={onManagePaymentMethods}>
          <Ionicons name="add-circle-outline" size={19} color={COLORS.navy} />
          <Text style={styles.paymentAddCardText}>Додати картку в профілі</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
        </Pressable> : null}
        <Pressable disabled={!canContinue} style={[styles.paymentSubmitButton, !canContinue && styles.paymentSubmitButtonDisabled]} onPress={() => canContinue ? setTicketCreated(true) : method === "card" && !card ? onManagePaymentMethods() : undefined}>
          <Ionicons name="ticket-outline" size={19} color="#ffffff" />
          <Text style={styles.paymentSubmitText}>{canContinue ? "Показати зразок квитка" : method === "card" && !card ? "Додати картку в профілі" : "Вкажіть автобус"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

function CityEventsScreen({ onBack }: { onBack: () => void }) {
  const swipeBack = useSwipeBack(onBack);
  const [events, setEvents] = useState<CityEvent[]>(CITY_EVENTS);

  useEffect(() => {
    void getEditorialEvents().then((editorial) => {
      if (editorial.items.length > 0) setEvents(editorial.items as CityEvent[]);
    }).catch(() => {
      // Keep the curated fallback visible if the editorial API is not deployed yet.
    });
  }, []);

  const eventsByDay = events.reduce<Map<number, CityEvent[]>>((groups, event) => {
    groups.set(event.day, [...(groups.get(event.day) ?? []), event]);
    return groups;
  }, new Map());

  return <SafeAreaView {...swipeBack} style={styles.screen}>
    <StatusBar style="dark" />
    <ScrollView contentContainerStyle={styles.eventsContent}>
      <CivicHeader />
      <BackLink label="До міських сервісів" onPress={onBack} />
      <Text style={styles.settingsPageTitle}>Події в місті</Text>
      <Text style={styles.settingsPageDescription}>Афіша Ужгорода на жовтень: концерти, театр, фестивалі й зустрічі.</Text>
      <View style={styles.eventsSourceNote}>
        <Ionicons name="information-circle-outline" size={19} color={COLORS.navy} />
        <Text style={styles.eventsSourceText}>Кожна подія відкриває сторінку продажу квитків або сторінку організатора з повними деталями.</Text>
      </View>
      {[...eventsByDay.entries()].map(([day, events]) => <View key={day} style={styles.eventsDayGroup}>
        <Text style={styles.eventsDayHeading}>{events[0].dateLabel}</Text>
        <View style={styles.eventsList}>
          {events.map((event) => <Pressable
            key={event.id}
            accessibilityLabel={`${event.title}. ${event.dateLabel}${event.time ? `, ${event.time}` : ""}. ${event.venue}. Відкрити джерело`}
            accessibilityRole="link"
            style={styles.eventRow}
            onPress={() => void openOfficialLink(event.sourceUrl)}
          >
            <View style={styles.eventDateBadge}><Text style={styles.eventDateBadgeDay}>{event.day}</Text><Text style={styles.eventDateBadgeMonth}>ЖОВ</Text></View>
            <View style={styles.eventCopy}>
              <View style={styles.eventTopLine}><Text numberOfLines={2} style={styles.eventTitle}>{event.title}</Text><Text style={styles.eventCategory}>{event.category}</Text></View>
              <Text numberOfLines={2} style={styles.eventMeta}>{event.time ? `${event.time} · ` : ""}{event.venue}</Text>
            </View>
            <Ionicons name="open-outline" size={17} color={COLORS.muted} />
          </Pressable>)}
        </View>
      </View>)}
    </ScrollView>
  </SafeAreaView>;
}

function ParkingScreen({ onBack }: { onBack: () => void }) {
  const swipeBack = useSwipeBack(onBack);
  return (
    <SafeAreaView {...swipeBack} style={styles.screen}>
      <StatusBar style="dark" />
      <CivicHeader />
      <BackLink label="До міських сервісів" onPress={onBack} />
      <ScrollView contentContainerStyle={styles.parkingContent}>
        <Text style={styles.settingsPageTitle}>Паркування</Text>
        <Text style={styles.settingsPageDescription}>Офіційні сервіси для водіїв — без зайвих карток і неперевірених даних.</Text>

        <View style={styles.parkingActionList}>
          <Pressable accessibilityLabel="Пошук постанови. Відкрити офіційний сервіс" accessibilityRole="link" style={styles.parkingActionRow} onPress={() => void openOfficialLink(PARKING_PORTAL_URL)}>
            <View style={styles.parkingActionIcon}><Ionicons name="document-text-outline" size={20} color={COLORS.navy} /></View>
            <View style={styles.parkingActionCopy}><Text style={styles.parkingActionTitle}>Пошук постанови</Text><Text numberOfLines={2} style={styles.parkingActionText}>Деталі постанови та фото в офіційному сервісі міської ради.</Text></View>
            <Ionicons name="open-outline" size={18} color={COLORS.muted} />
          </Pressable>
          <Pressable accessibilityLabel="Авто евакуювали? Відкрити офіційну інструкцію" accessibilityRole="link" style={styles.parkingActionRow} onPress={() => void openOfficialLink(PARKING_EVACUATION_URL)}>
            <View style={styles.parkingActionIcon}><Ionicons name="car-outline" size={20} color={COLORS.navy} /></View>
            <View style={styles.parkingActionCopy}><Text style={styles.parkingActionTitle}>Авто евакуювали?</Text><Text numberOfLines={2} style={styles.parkingActionText}>Порядок дій, зберігання та контакти.</Text></View>
            <Ionicons name="open-outline" size={18} color={COLORS.muted} />
          </Pressable>
          <Pressable accessibilityLabel="Контакти інспекторів. Відкрити офіційні контакти" accessibilityRole="link" style={styles.parkingActionRow} onPress={() => void openOfficialLink(PARKING_INSPECTOR_URL)}>
            <View style={styles.parkingActionIcon}><Ionicons name="call-outline" size={20} color={COLORS.navy} /></View>
            <View style={styles.parkingActionCopy}><Text style={styles.parkingActionTitle}>Контакти інспекторів</Text><Text numberOfLines={2} style={styles.parkingActionText}>Повноваження, контакти й роз’яснення міста.</Text></View>
            <Ionicons name="open-outline" size={18} color={COLORS.muted} />
          </Pressable>
        </View>

        <View style={styles.parkingInfoNote}>
          <Ionicons name="information-circle-outline" size={20} color={COLORS.navy} />
          <View style={styles.parkingInfoCopy}>
            <Text style={styles.parkingUnavailableTitle}>Майданчики та тарифи ще не опубліковані</Text>
            <Text style={styles.parkingUnavailableText}>Додамо їх після відкритої публікації, щоб не показувати застарілі адреси чи суми.</Text>
            <Pressable accessibilityLabel="Перевірити стан набору даних про паркування" accessibilityRole="link" hitSlop={6} onPress={() => void openOfficialLink(PARKING_DATASET_URL)}>
              <Text style={styles.parkingUnavailableLink}>Перевірити стан набору</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PollsScreen({ onBack }: { onBack: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const options = ["Транспорт і зупинки", "Парки та прогулянки", "Сортування відходів", "Доступність міста"];
  const swipeBack = useSwipeBack(onBack);
  return <SafeAreaView {...swipeBack} style={styles.screen}>
    <StatusBar style="dark" />
    <ScrollView contentContainerStyle={styles.settingsContent}>
      <CivicHeader />
      <BackLink label="До міських сервісів" onPress={onBack} />
      <Text style={styles.settingsPageTitle}>Опитування</Text>
      <Text style={styles.pollQuestion}>Що покращити в місті наступним?</Text>
      <Text style={styles.settingsPageDescription}>Оберіть один варіант, а потім підтвердьте свій вибір.</Text>
      <View style={styles.settingsCard}>
        {options.map((option) => <Pressable key={option} accessibilityLabel={`Варіант: ${option}`} accessibilityRole="radio" accessibilityState={{ selected: selected === option }} onPress={() => { setSelected(option); setSubmitted(false); }} style={[styles.pollOption, selected === option && styles.settingsChoiceActive]}>
          <View style={styles.settingsChoiceCopy}><Text style={styles.settingsChoiceTitle}>{option}</Text></View>
          <Ionicons name={selected === option ? "radio-button-on" : "radio-button-off"} size={21} color={selected === option ? COLORS.navy : COLORS.muted} />
        </Pressable>)}
      </View>
      <Pressable accessibilityLabel={submitted ? "Вибір підтверджено" : "Проголосувати"} accessibilityRole="button" accessibilityState={{ disabled: !selected || submitted }} disabled={!selected || submitted} style={[styles.paymentSubmitButton, (!selected || submitted) && styles.paymentSubmitButtonDisabled]} onPress={() => setSubmitted(true)}>
        <Ionicons name={submitted ? "checkmark-circle-outline" : "checkmark-outline"} size={19} color="#ffffff" />
        <Text style={styles.paymentSubmitText}>{submitted ? "Вибір підтверджено" : "Проголосувати"}</Text>
      </Pressable>
      {selected ? <View style={styles.pollResult}><Ionicons name={submitted ? "checkmark-circle-outline" : "information-circle-outline"} size={20} color={COLORS.navy} /><Text style={styles.pollResultText}>{submitted ? `Ваш вибір «${selected}» підтверджено на цьому пристрої.` : `Ви обрали: «${selected}». Натисніть «Проголосувати», щоб підтвердити вибір.`}</Text></View> : null}
    </ScrollView>
  </SafeAreaView>;
}

function SafetyMapScreen({ kind, onBack }: { kind: "shelters" | "resilience"; onBack: () => void }) {
  const [points, setPoints] = useState<SafetyMapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const swipeBack = useSwipeBack(onBack);
  const isShelters = kind === "shelters";
  const title = isShelters ? "Укриття" : "Пункти незламності";
  const sourceLabel = isShelters ? "Джерело: Геопортал Ужгородської міської ради" : "Адреси з останнього оприлюдненого переліку";
  const sourceUrl = isShelters
    ? "https://geo.rada-uzhgorod.gov.ua/map/shelter#/16:22.290283,48.608131:0.00:0.00?baseLayer=osmb&layers=3317996270789854695"
    : "https://nezlamnist.gov.ua/";

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    getSafetyMapPoints(kind)
      .then((response) => {
        if (mounted) setPoints(response.points);
      })
      .catch((requestError) => {
        if (mounted) setError(requestError instanceof Error ? requestError.message : "Не вдалося завантажити позначки.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [kind]);

  return <SafeAreaView {...swipeBack} style={styles.cityMapScreen}>
    <StatusBar style="dark" />
    <View style={styles.cityMapHeader}>
      <CivicHeader />
      <BackLink label="До міських сервісів" onPress={onBack} />
      <Text style={styles.cityMapTitle}>{title}</Text>
      <Text style={styles.cityMapHint}>{loading ? "Завантажуємо позначки…" : error ? "Позначки тимчасово недоступні" : `${points.length} позначок на мапі`}</Text>
    </View>
    <View style={styles.cityMapCanvas}>
      <OfficialLayerMap
        tileTemplate={isShelters ? "https://geo.rada-uzhgorod.gov.ua/map/rtile/3317996270789854695/ua/{z}/{x}/{y}.png" : undefined}
        points={points}
        pinColor={isShelters ? "#c2410c" : "#1d4ed8"}
      />
    </View>
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
      <CivicHeader />
      <BackLink label="До міських сервісів" onPress={onBack} />
      <ScrollView contentContainerStyle={styles.serviceDetailsContent}>
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
      <CivicHeader />
      <BackLink label="До міських сервісів" onPress={onBack} />
      <ScrollView contentContainerStyle={styles.silenceContent}>
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
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Kyiv",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
  }).formatToParts(date);
  return {
    hours: Number(parts.find((part) => part.type === "hour")?.value ?? 0),
    minutes: Number(parts.find((part) => part.type === "minute")?.value ?? 0),
  };
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
      <CivicHeader />
      <BackLink label="До транспорту" onPress={onBack} />
      <View style={styles.detailIntro}>
        <View style={styles.eyebrowRow}><View style={[styles.eyebrowDot, styles.eyebrowDotGreen]} /><Text style={styles.eyebrow}>Прозорість даних</Text></View>
        <Text style={styles.detailTitle}>Джерела даних</Text>
        <Text style={styles.detailDescription}>Звідки застосунок бере маршрути, зупинки та плановий розклад.</Text>
      </View>
      <ScrollView contentContainerStyle={styles.sourcesList}>
        <View style={styles.sourceCard}>
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
          <Text style={styles.sourceCardTitle}>Живі GPS-позиції</Text>
          <Text style={styles.sourceText}>Показуємо на карті маршруту з публічного DozoR. Дані можуть надходити із короткою затримкою.</Text>
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
      <CivicHeader />
      <BackLink label="До зупинок" onPress={onBack} />
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
        <CivicHeader />
        <BackLink label="Усі маршрути" onPress={onBack} />
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
          <Pressable accessibilityLabel="Відкрити карту маршруту" accessibilityRole="button" style={styles.routeMapPreview} onPress={() => onOpenMap(direction?.id)}>
            <RouteMap
              activeVariantId={direction?.id}
              map={map}
              region={getInitialRegion(map, direction?.stops, direction?.id)}
              stops={direction?.stops}
              preview
            />
            <View style={styles.routeMapPreviewLabel}>
              <Text style={styles.routeMapPreviewLabelText}>Карта маршруту · розгорнути</Text>
            </View>
          </Pressable>
        )}
        {!map && <Pressable accessibilityLabel="Показати маршрут на карті" accessibilityRole="button" style={styles.mapButton} onPress={() => onOpenMap(direction?.id)}>
          <Ionicons name="map-outline" size={18} color={COLORS.navy} />
          <Text style={styles.mapButtonText}>{map ? "Відкрити карту маршруту" : "Показати маршрут на карті"}</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.navy} />
        </Pressable>}
        <View style={styles.stopsIntro}>
          <View>
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
              <Pressable key={stop.id} style={styles.stopRow} onPress={() => onSelectStop(stop)}>
                <View style={styles.stopSequence}>
                  <View style={[styles.stopDot, index === 0 && styles.stopDotStart, index === direction.stops.length - 1 && styles.stopDotEnd]} />
                  {index < direction.stops.length - 1 && <View style={styles.stopLine} />}
                </View>
                <Text style={styles.stopName}>{stopDisplayName(stop.name)}</Text>
                <FavoriteButton selected={favoriteStopIds.includes(stop.id)} onPress={() => onToggleFavoriteStop(stop.id)} />
                <View style={styles.stopScheduleLink}>
                  <Text style={styles.stopSchedule}>Розклад</Text>
                  <Ionicons name="chevron-forward" size={14} color={COLORS.navy} />
                </View>
              </Pressable>
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
  const direction = variants[directionIndex] ?? variants[0];
  const destination = direction?.stops[direction.stops.length - 1]?.name;
  const region = getInitialRegion(mapScreen.map, direction?.stops, direction?.id);

  useEffect(() => {
    setDirectionIndex(defaultDirectionIndex);
    setSelectedStop(null);
    setDepartures(null);
    setDepartureError(null);
  }, [defaultDirectionIndex, mapScreen.route.id]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const loadVehiclePositions = async () => {
      try {
        const positions = await getVehiclePositions(mapScreen.route.routeNumber);
        if (active) {
          setVehiclePositions(positions);
        }
      } catch {
        if (active) {
          setVehiclePositions({ available: false, stale: false, fetchedAt: new Date().toISOString(), vehicles: [] });
        }
      }
    };
    void loadVehiclePositions();
    const timer = setInterval(() => void loadVehiclePositions(), 20_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [mapScreen.route.routeNumber]);

  function changeDirection() {
    if (variants.length < 2) {
      return;
    }
    setDirectionIndex((index) => (index + 1) % variants.length);
    setSelectedStop(null);
    setDepartures(null);
    setDepartureError(null);
  }

  async function selectStop(stop: TransportStop) {
    setSelectedStop(stop);
    setDepartures(null);
    setDepartureError(null);
    try {
      const allDepartures = await getDepartures(mapScreen.route.id, stop.id, localDate());
      setDepartures(direction ? allDepartures.filter((departure) => departure.routeVariantId === direction.id) : allDepartures);
    } catch (requestError) {
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
        <Text style={styles.mapHint}>Натисніть зупинку, щоб побачити розклад.</Text>
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
          vehicles={vehiclePositions?.vehicles}
          onStopPress={(stop) => void selectStop(stop)}
        />
        {vehiclePositions ? <View pointerEvents="none" style={styles.mapGpsStatus}>
          <View style={[styles.mapGpsDot, vehiclePositions.available ? (vehiclePositions.stale ? styles.mapGpsDotStale : styles.mapGpsDotLive) : styles.mapGpsDotOffline]} />
          <Text style={styles.mapGpsStatusText}>
            {vehiclePositions.available
              ? (vehiclePositions.stale
                ? "GPS: дані застаріли"
                : vehiclePositions.vehicles.length > 0
                  ? `GPS · ${vehiclePositions.vehicles.length} ${pluralizeBus(vehiclePositions.vehicles.length)}`
                  : "GPS · автобусів немає")
              : "GPS недоступний"}
          </Text>
        </View> : null}
        {selectedStop ? <View style={[styles.mapStopCard, vehiclePositions && styles.mapStopCardWithGps]}>
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
              {nextDepartures.map((departure) => {
                const minutesUntil = minutesUntilDeparture(departure, now);
                return <View key={`${departure.routeVariantId}-${departure.departureTimeSeconds}`} style={styles.mapStopTimePill}>
                  <Text style={styles.mapStopScheduleTime}>{departure.departureTime}</Text>
                  <Text style={styles.mapStopMinutesText}>{minutesUntil === 0 ? "зараз" : `через ${minutesUntil} хв`}</Text>
                </View>;
              })}
            </View>
          </View> : null}
          {departures !== null && nextDepartures.length === 0 && !departureError ? <Text style={styles.mapStopEmpty}>Сьогодні в цьому напрямку планових рейсів більше немає.</Text> : null}
          {departureError ? <Text style={styles.mapStopError}>Плановий час зараз недоступний. Спробуйте ще раз.</Text> : null}
          <Text style={styles.mapStopFootnote}>
            Час із затвердженого розкладу{vehiclePositions?.available ? "; живі автобуси позначено на карті." : "."}
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
  const readableDate = new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long" })
    .format(new Date(`${schedule.date}T12:00:00`));
  return (
    <SafeAreaView {...swipeBack} style={styles.transportDetailScreen}>
      <StatusBar style="dark" />
      <CivicHeader />
      <BackLink label={`До зупинок маршруту ${schedule.route.routeNumber}`} onPress={onBack} />
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
      <ScrollView contentContainerStyle={styles.detailsList}>
        {schedule.departures.map((departure, index) => (
          <View key={`${departure.routeVariantId}-${departure.departureTimeSeconds}-${index}`} style={styles.departure}>
            <Text style={styles.departureTime}>{departure.departureTime}</Text>
            <Text style={styles.departureDestination}>{departure.destination || "Напрямок маршруту"}</Text>
          </View>
        ))}
        {schedule.departures.length === 0 && (
          <Text style={styles.empty}>На цю дату планових рейсів немає або розклад ще не імпортовано.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function localDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function addDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + amount);
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}

function findUpcomingDepartures(departures: TransportDeparture[], now: Date) {
  const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  return departures.filter((departure) => departure.departureTimeSeconds >= currentSeconds).slice(0, 3);
}

function minutesUntilDeparture(departure: TransportDeparture, now: Date) {
  const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  return Math.max(0, Math.ceil((departure.departureTimeSeconds - currentSeconds) / 60));
}

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("uk-UA", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatDateOnly(value: string) {
  return new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
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
  const date = new Date(Number(match[3]), month, Number(match[2]));
  return date.getMonth() === month && date.getDate() === Number(match[2]) ? date : null;
}

function feedDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function groupFeedEntriesByDay(items: OfficialNewsItem[], events: AirAlertEvent[]): Array<[string, FeedEntry[]]> {
  const groups = new Map<string, FeedEntry[]>();
  const add = (day: string, entry: FeedEntry) => groups.set(day, [...(groups.get(day) ?? []), entry]);
  const labelFor = (date: Date) => new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long", year: "numeric" }).format(date);

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
  return new Intl.DateTimeFormat("uk-UA", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
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

function formatDashboardDate() {
  return new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long" }).format(new Date());
}

function formatDashboardDay() {
  const day = new Intl.DateTimeFormat("uk-UA", { weekday: "long" }).format(new Date());
  return day.charAt(0).toUpperCase() + day.slice(1);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("uk-UA", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value);
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
  return new Intl.DateTimeFormat("uk-UA", { weekday: "short", day: "numeric" }).format(new Date(`${date}T12:00:00`));
}

function formatWeatherHour(value: string) {
  return new Intl.DateTimeFormat("uk-UA", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Kyiv" }).format(new Date(value));
}

function sortRoutesByNumber(routes: TransportRoute[]) {
  const collator = new Intl.Collator("uk-UA", { numeric: true, sensitivity: "base" });
  return [...routes].sort((left, right) => collator.compare(left.routeNumber, right.routeNumber));
}

function LoadingScreen() {
  return (
    <SafeAreaView style={[styles.screen, styles.centered]}>
      <View style={styles.loadingIcon}><Ionicons name="bus-outline" size={28} color={COLORS.navy} /></View>
      <ActivityIndicator size="small" color={COLORS.navy} style={styles.loadingSpinner} />
      <Text style={styles.loadingTitle}>Завантажуємо транспорт</Text>
      <Text style={styles.loadingText}>Отримуємо офіційні маршрути та зупинки.</Text>
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

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <SafeAreaView style={[styles.screen, styles.centered]}>
      <View style={styles.errorIcon}><Ionicons name="cloud-offline-outline" size={30} color={COLORS.navy} /></View>
      <Text style={styles.errorTitle}>Дані зараз недоступні</Text>
      <Text style={styles.errorText}>{message}</Text>
      <Text style={styles.errorHint}>Перевірте з’єднання та спробуйте ще раз. Застосунок не підміняє дані застарілою інформацією.</Text>
      <Pressable style={styles.retryButton} onPress={() => void onRetry()}>
        <Ionicons name="refresh-outline" size={18} color="#ffffff" />
        <Text style={styles.retryText}>Спробувати ще раз</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const STYLE_DEFINITIONS = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f6f7fb", paddingHorizontal: 16 },
  transportScreen: { flex: 1, backgroundColor: "#f6f7fb" },
  transportContent: { paddingHorizontal: 20 },
  transportScrollContent: { flexGrow: 1, paddingBottom: 22 },
  centered: { alignItems: "center", justifyContent: "center" },
  civicHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 58, paddingTop: 4 },
  brandGroup: { alignItems: "center", flexDirection: "row", gap: 8 },
  brandMark: { backgroundColor: COLORS.navy, height: 34, width: 34 },
  brandIntroScreen: { alignItems: "center", backgroundColor: "#f6f7fb", flex: 1, justifyContent: "center", paddingHorizontal: 20 },
  brandIntroContent: { alignItems: "center", marginTop: -38 },
  brandIntroTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 27, letterSpacing: -0.5, marginTop: 19 },
  brandIntroSubtitle: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 13, marginTop: 6 },
  brandIntroFooter: { alignItems: "center", bottom: 42, flexDirection: "row", gap: 8, position: "absolute" },
  brandIntroFooterText: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 12 },
  brandTitleRow: { alignItems: "center", flexDirection: "row", gap: 6 },
  brandTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 16, lineHeight: 20 },
  brandSubtitle: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 10, marginTop: 1 },
  headerDate: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 12 },
  backLink: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 2, marginTop: 5, minHeight: 44, paddingRight: 10 },
  backLinkText: { color: COLORS.navyDark, fontFamily: FONTS.medium, fontSize: 13 },
  pageIntro: { marginTop: 15 },
  eyebrowRow: { alignItems: "center", flexDirection: "row", gap: 6 },
  eyebrowDot: { backgroundColor: COLORS.gold, borderRadius: 4, height: 7, width: 7 },
  eyebrowDotGreen: { backgroundColor: COLORS.green },
  eyebrow: { color: COLORS.muted, fontFamily: FONTS.semibold, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase" },
  pageTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 26, letterSpacing: -0.4, lineHeight: 32, marginTop: 7 },
  pageDescription: { color: "#43474e", fontFamily: FONTS.regular, fontSize: 14, lineHeight: 21, marginTop: 6 },
  transportHero: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 15, borderWidth: 1, marginTop: 18, overflow: "hidden", padding: 15 },
  transportHeroTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  transportHeroIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 10, height: 40, justifyContent: "center", width: 40 },
  transportHeroBadge: { backgroundColor: COLORS.blueSurface, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5 },
  transportHeroBadgeText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 10, letterSpacing: 0.5 },
  transportHeroTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 19, lineHeight: 24, marginTop: 14 },
  transportHeroText: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 13, lineHeight: 19, marginTop: 4 },
  transportHeroButton: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 6, marginTop: 14 },
  transportHeroButtonText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 13 },
  riverNote: { alignItems: "center", backgroundColor: "#e7eeff", borderRadius: 14, flexDirection: "row", gap: 11, marginTop: 14, padding: 12 },
  riverNoteIcon: { alignItems: "center", backgroundColor: "#d3e4ff", borderRadius: 9, height: 42, justifyContent: "center", width: 42 },
  riverNoteText: { flex: 1 },
  riverNoteEyebrow: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 10 },
  riverNoteTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 14, marginTop: 2 },
  riverNoteDescription: { color: "#43474e", fontFamily: FONTS.regular, fontSize: 12, marginTop: 3 },
  sectionHeadingRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 24 },
  serviceCategoryFirst: { marginTop: 25 },
  serviceCategory: { marginTop: 28 },
  serviceGroupHeading: { marginBottom: 10 },
  serviceGroupTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 17 },
  serviceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between" },
  serviceGridCard: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, justifyContent: "space-between", minHeight: 90, padding: 11, width: "48.4%" },
  serviceGridIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 9, height: 34, justifyContent: "center", width: 34 },
  serviceGridFooter: { alignItems: "flex-end", flexDirection: "row", gap: 4, justifyContent: "space-between", marginTop: 7 },
  serviceGridTitle: { color: COLORS.ink, flex: 1, fontFamily: FONTS.semibold, fontSize: 13, lineHeight: 18 },
  officialMark: { alignItems: "center", flexDirection: "row", gap: 4 },
  officialMarkText: { color: COLORS.green, fontFamily: FONTS.medium, fontSize: 11 },
  serviceRow: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 13, borderWidth: 1, flexDirection: "row", gap: 11, marginTop: 8, minHeight: 74, padding: 12 },
  serviceRowIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 10, height: 40, justifyContent: "center", width: 40 },
  serviceRowText: { flex: 1 },
  serviceRowTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontSize: 15, lineHeight: 20 },
  serviceRowDescription: { color: "#596574", fontFamily: FONTS.regular, fontSize: 12, lineHeight: 17, marginTop: 3 },
  serviceGoldDot: { backgroundColor: COLORS.gold, borderRadius: 4, height: 7, width: 7 },
  servicesCount: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 12 },
  openDataRow: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 12, marginTop: 9, minHeight: 82, padding: 12 },
  hubFooter: { alignItems: "center", gap: 7, marginHorizontal: 14, marginTop: 27, paddingBottom: 20 },
  profileAppCard: { alignItems: "center", backgroundColor: COLORS.navy, borderRadius: 17, flexDirection: "row", gap: 12, marginTop: 18, overflow: "hidden", padding: 15 },
  profileAppMark: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 14, height: 58, justifyContent: "center", width: 58 },
  profileAppCopy: { flex: 1 },
  profileAppTitle: { color: "#ffffff", fontFamily: FONTS.semibold, fontSize: 16 },
  profileAppText: { color: "#d3e4ff", fontFamily: FONTS.regular, fontSize: 12, lineHeight: 17, marginTop: 4 },
  profileVersionPill: { alignSelf: "flex-start", backgroundColor: COLORS.blueSurface, borderRadius: 6, marginTop: 8, paddingHorizontal: 6, paddingVertical: 3 },
  profileVersionText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 10 },
  profileSectionTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 16, marginTop: 20 },
  profileGroup: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, marginTop: 10, overflow: "hidden" },
  profileRow: { alignItems: "center", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", gap: 11, minHeight: 67, paddingHorizontal: 13 },
  profileRowIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 9, height: 36, justifyContent: "center", width: 36 },
  profileRowText: { flex: 1 },
  profileRowTitle: { color: COLORS.ink, fontFamily: FONTS.medium, fontSize: 14, lineHeight: 19 },
  profileRowValue: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 12, marginTop: 2 },
  profilePrivacyNote: { alignItems: "flex-start", backgroundColor: COLORS.blueSurface, borderRadius: 13, flexDirection: "row", gap: 10, marginTop: 24, padding: 14 },
  profilePrivacyText: { color: "#3f5269", flex: 1, fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18 },
  profileNoticeCard: { alignItems: "flex-start", backgroundColor: "#ffffff", borderColor: COLORS.border, borderLeftColor: COLORS.gold, borderLeftWidth: 3, borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 10, marginTop: 10, padding: 14 },
  profileNoticeCopy: { flex: 1 },
  profileNoticeTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 14 },
  profileNoticeText: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, marginTop: 4 },
  profileFooter: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 12, marginTop: 22, textAlign: "center" },
  settingsContent: { flexGrow: 1, paddingBottom: 32, paddingHorizontal: 20 },
  accountIntro: { marginTop: 13 },
  accountIntroText: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 13, marginTop: 4 },
  accountForm: { marginTop: 22 },
  accountActionButton: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 11, borderWidth: 1, flexDirection: "row", gap: 9, marginTop: 10, minHeight: 50, paddingHorizontal: 14 },
  accountActionText: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 13 },
  accountDeleteButton: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderColor: COLORS.border, borderRadius: 11, borderWidth: 1, flexDirection: "row", gap: 9, marginTop: 10, minHeight: 50, paddingHorizontal: 14 },
  accountDeleteText: { color: COLORS.danger, fontFamily: FONTS.semibold, fontSize: 13 },
  accountFootnote: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 11, lineHeight: 16, marginTop: 13, textAlign: "center" },
  settingsPageTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 25, lineHeight: 31, marginTop: 18 },
  settingsPageDescription: { color: "#485768", fontFamily: FONTS.regular, fontSize: 13, lineHeight: 19, marginTop: 5 },
  legalCard: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, marginTop: 14, padding: 14 },
  legalCardHeading: { alignItems: "center", flexDirection: "row", gap: 8 },
  legalCardTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 15 },
  legalCardText: { color: COLORS.ink, fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, marginTop: 10 },
  pollQuestion: { color: COLORS.ink, fontFamily: FONTS.semibold, fontSize: 18, lineHeight: 25, marginTop: 18 },
  pollOption: { alignItems: "center", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", gap: 11, minHeight: 66, paddingHorizontal: 15 },
  settingsHero: { backgroundColor: COLORS.navy, borderRadius: 18, marginTop: 15, padding: 18 },
  settingsHeroIcon: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, height: 48, justifyContent: "center", width: 48 },
  settingsHeroKicker: { color: "#f4c65b", fontFamily: FONTS.semibold, fontSize: 10, letterSpacing: 0.7, marginTop: 16 },
  settingsHeroTitle: { color: "#ffffff", fontFamily: FONTS.bold, fontSize: 24, marginTop: 5 },
  settingsHeroText: { color: "#d3e4ff", fontFamily: FONTS.regular, fontSize: 13, lineHeight: 20, marginTop: 7 },
  settingsCard: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 16, borderWidth: 1, marginTop: 13, overflow: "hidden" },
  settingsChoice: { alignItems: "center", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", gap: 11, minHeight: 74, paddingHorizontal: 13 },
  settingsChoiceActive: { backgroundColor: COLORS.blueSurface },
  settingsChoiceIcon: { alignItems: "center", borderRadius: 10, height: 32, justifyContent: "center", width: 32 },
  settingsChoiceCopy: { flex: 1 },
  settingsChoiceTitle: { color: COLORS.ink, fontFamily: FONTS.medium, fontSize: 14, lineHeight: 19 },
  settingsChoiceText: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 11, lineHeight: 16, marginTop: 3 },
  settingsInfoNote: { alignItems: "flex-start", backgroundColor: COLORS.blueSurface, borderRadius: 13, flexDirection: "row", gap: 9, marginTop: 13, padding: 13 },
  settingsInfoText: { color: "#40546b", flex: 1, fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18 },
  settingsSafetyNote: { alignItems: "flex-start", backgroundColor: COLORS.blueSurface, borderRadius: 10, flexDirection: "row", gap: 9, marginTop: 14, padding: 11 },
  settingsSafetyText: { color: COLORS.navyDark, flex: 1, fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18 },
  settingsSwitch: { backgroundColor: COLORS.blueSoft, borderColor: COLORS.controlBorder, borderRadius: 15, borderWidth: 1, height: 28, padding: 2, width: 48 },
  settingsSwitchOn: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  settingsSwitchKnob: { backgroundColor: "#ffffff", borderRadius: 11, height: 22, width: 22 },
  settingsSwitchKnobOn: { alignSelf: "flex-end" },
  settingsFootnote: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, marginHorizontal: 4, marginTop: 16 },
  cnapContent: { flexGrow: 1, paddingBottom: 32, paddingHorizontal: 20 },
  cnapHero: { backgroundColor: COLORS.navy, borderRadius: 18, marginTop: 15, padding: 18 },
  cnapHeroTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  cnapHeroIcon: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, height: 48, justifyContent: "center", width: 48 },
  cnapDemoBadge: { backgroundColor: "rgba(247,190,61,0.15)", borderColor: "rgba(247,190,61,0.38)", borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5 },
  cnapDemoBadgeText: { color: "#f7be3d", fontFamily: FONTS.semibold, fontSize: 9, letterSpacing: 0.6 },
  cnapHeroTitle: { color: "#ffffff", fontFamily: FONTS.bold, fontSize: 24, marginTop: 17 },
  cnapHeroText: { color: "#d3e4ff", fontFamily: FONTS.regular, fontSize: 13, lineHeight: 20, marginTop: 7 },
  cnapSafetyNote: { alignItems: "flex-start", backgroundColor: COLORS.blueSurface, borderRadius: 13, flexDirection: "row", gap: 9, marginTop: 12, padding: 12 },
  cnapSafetyNoteText: { color: COLORS.navyDark, flex: 1, fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18 },
  cnapFormCard: { marginTop: 18 },
  cnapFormTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 17, marginBottom: 4 },
  cnapFieldLabel: { color: COLORS.navyDark, fontFamily: FONTS.medium, fontSize: 12, marginTop: 16 },
  cnapSelect: { alignItems: "center", backgroundColor: "#f8faff", borderColor: COLORS.controlBorder, borderRadius: 10, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", marginTop: 6, minHeight: 52, paddingHorizontal: 16 },
  cnapSelectText: { color: COLORS.ink, flex: 1, fontFamily: FONTS.regular, fontSize: 13, paddingRight: 8 },
  cnapOptions: { borderColor: COLORS.border, borderRadius: 10, borderWidth: 1, marginTop: 6, overflow: "hidden" },
  cnapOption: { alignItems: "center", backgroundColor: "#ffffff", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 45, paddingHorizontal: 12 },
  cnapOptionActive: { backgroundColor: COLORS.navy },
  cnapOptionText: { color: COLORS.ink, flex: 1, fontFamily: FONTS.regular, fontSize: 12, paddingRight: 8 },
  cnapOptionTextActive: { color: "#ffffff", fontFamily: FONTS.medium },
  cnapInput: { backgroundColor: "#f8faff", borderColor: COLORS.controlBorder, borderRadius: 10, borderWidth: 1, color: COLORS.ink, fontFamily: FONTS.regular, fontSize: 13, marginTop: 6, minHeight: 52, paddingHorizontal: 16, paddingVertical: 11 },
  cnapTextarea: { minHeight: 96, paddingTop: 11 },
  cnapSubmitButton: { alignItems: "center", backgroundColor: COLORS.navy, borderRadius: 11, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 18, minHeight: 49, paddingHorizontal: 14 },
  cnapSubmitText: { color: "#ffffff", fontFamily: FONTS.semibold, fontSize: 13 },
  cnapFormFootnote: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 11, lineHeight: 16, marginTop: 11 },
  cnapOfficialLink: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 10, marginTop: 13, padding: 13 },
  cnapOfficialLinkCopy: { flex: 1 },
  cnapOfficialLinkTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontSize: 13 },
  cnapOfficialLinkText: { color: COLORS.navy, fontFamily: FONTS.regular, fontSize: 12, marginTop: 3 },
  newsSourceLine: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 7, marginTop: 16, paddingVertical: 5 },
  newsSourceLineText: { color: COLORS.navy, fontFamily: FONTS.medium, fontSize: 12 },
  feedAlertCard: { alignItems: "flex-start", borderRadius: 14, flexDirection: "row", gap: 10, marginTop: 12, padding: 13 },
  feedAlertCardClear: { backgroundColor: "#eef8eb", borderColor: "#d7ead0", borderWidth: 1 },
  feedAlertCardActive: { backgroundColor: "#fff4f3", borderColor: "#f0b5b0", borderWidth: 1 },
  feedAlertIcon: { alignItems: "center", borderRadius: 10, height: 40, justifyContent: "center", width: 40 },
  feedAlertIconClear: { backgroundColor: "#dff1da" },
  feedAlertIconActive: { backgroundColor: "#ffe3e0" },
  feedAlertCopy: { flex: 1 },
  feedAlertKicker: { color: COLORS.green, fontFamily: FONTS.semibold, fontSize: 9, letterSpacing: 0.45 },
  feedAlertKickerActive: { color: "#a31d1d" },
  feedAlertTitle: { color: "#245b31", fontFamily: FONTS.semibold, fontSize: 14, marginTop: 3 },
  feedAlertTitleActive: { color: "#8e1b1b" },
  feedAlertText: { color: "#3f6649", fontFamily: FONTS.regular, fontSize: 12, lineHeight: 17, marginTop: 3 },
  feedAlertTextActive: { color: "#a54943" },
  feedAlertTime: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 10, marginTop: 5 },
  feedAlertStale: { color: "#795000", fontFamily: FONTS.regular, fontSize: 10, lineHeight: 15, marginTop: 5 },
  alertEventCard: { alignItems: "center", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", gap: 9, minHeight: 66, paddingVertical: 11 },
  alertEventCardActive: {},
  alertEventCardClear: {},
  alertEventIcon: { alignItems: "center", height: 28, justifyContent: "center", width: 28 },
  alertEventCopy: { flex: 1 },
  alertEventTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontSize: 13 },
  alertEventText: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 11, lineHeight: 16, marginTop: 2 },
  alertEventTime: { color: COLORS.muted, fontFamily: FONTS.semibold, fontSize: 11 },
  newsListHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
  newsListHeadingTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 19 },
  newsListHeadingMeta: { color: COLORS.green, fontFamily: FONTS.medium, fontSize: 11 },
  newsDayGroup: { marginTop: 14 },
  newsDayHeading: { color: COLORS.muted, fontFamily: FONTS.semibold, fontSize: 12, marginBottom: 1, textTransform: "uppercase" },
  newsArticleCard: { alignItems: "center", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", gap: 10, minHeight: 76, paddingVertical: 12 },
  newsArticleCopy: { flex: 1 },
  newsArticleTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  newsArticleIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 8, height: 32, justifyContent: "center", width: 32 },
  newsArticleDate: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 11, marginTop: 5 },
  newsArticleTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontSize: 15, lineHeight: 20 },
  newsArticleAction: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 6, marginTop: 12 },
  newsArticleActionText: { color: COLORS.navy, fontFamily: FONTS.medium, fontSize: 12 },
  newsMoreLink: { alignItems: "center", alignSelf: "center", flexDirection: "row", gap: 6, marginTop: 18, paddingVertical: 7 },
  newsMoreLinkText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 13 },
  newsReaderContent: { flexGrow: 1, paddingBottom: 32, paddingHorizontal: 20 },
  newsReaderKicker: { alignItems: "center", alignSelf: "flex-start", backgroundColor: COLORS.blueSurface, borderRadius: 8, flexDirection: "row", gap: 6, marginTop: 16, paddingHorizontal: 8, paddingVertical: 6 },
  newsReaderKickerText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 9, letterSpacing: 0.45 },
  newsReaderTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 25, lineHeight: 33, marginTop: 20 },
  newsReaderDate: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 12, marginTop: 7 },
  newsReaderPreview: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 15, borderWidth: 1, marginTop: 19, padding: 15 },
  newsReaderPreviewLabel: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 10, letterSpacing: 0.65 },
  newsReaderPreviewText: { color: COLORS.ink, fontFamily: FONTS.regular, fontSize: 15, lineHeight: 24, marginTop: 22 },
  newsReaderAttribution: { alignItems: "flex-start", backgroundColor: COLORS.blueSurface, borderRadius: 13, flexDirection: "row", gap: 9, marginTop: 13, padding: 13 },
  newsReaderAttributionText: { color: COLORS.muted, flex: 1, fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, marginTop: 18 },
  newsReaderOriginalButton: { alignItems: "center", backgroundColor: COLORS.navy, borderRadius: 11, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 14, minHeight: 49, paddingHorizontal: 14 },
  newsReaderOriginalButtonText: { color: "#ffffff", fontFamily: FONTS.semibold, fontSize: 13 },
  transportPageTitleRow: { alignItems: "flex-start", flexDirection: "row", gap: 10, justifyContent: "space-between", marginTop: 4 },
  transportPageTitleCopy: { flex: 1 },
  transportPageTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 22, lineHeight: 28 },
  transportPageDescription: { color: "#596574", fontFamily: FONTS.regular, fontSize: 12, lineHeight: 17, marginTop: 3, maxWidth: 235 },
  transportPlanMark: { alignItems: "center", flexDirection: "row", gap: 4, marginTop: 4 },
  transportPlanMarkAvailable: {},
  transportPlanMarkText: { color: "#795000", fontFamily: FONTS.medium, fontSize: 10 },
  transportPlanMarkTextAvailable: { color: COLORS.green },
  transportSourceLine: { alignItems: "flex-start", backgroundColor: "#ffffff", borderColor: COLORS.border, borderLeftColor: COLORS.gold, borderLeftWidth: 3, borderRadius: 10, flexDirection: "row", gap: 8, marginTop: 15, padding: 11 },
  transportSourceCopy: { flex: 1 },
  transportSourceTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 12 },
  transportSourceText: { color: "#485768", fontFamily: FONTS.regular, fontSize: 12, lineHeight: 17, marginTop: 3 },
  transportUpdatedAt: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 11, marginTop: 6 },
  dataSourcesInlineLink: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 2, marginTop: 8 },
  dataSourcesInlineLinkText: { color: COLORS.navy, fontFamily: FONTS.medium, fontSize: 12 },
  transportDataMeta: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 5, marginTop: 9 },
  transportDataMetaText: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 11 },
  searchBox: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.controlBorder, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, marginTop: 14, minHeight: 48, paddingHorizontal: 12 },
  title: { color: "#071d31", fontSize: 28, fontWeight: "700", marginTop: 20 },
  hubContent: { flexGrow: 1, paddingBottom: 28, paddingHorizontal: 20 },
  homeContent: { flexGrow: 1, paddingBottom: 28 },
  dashboardContent: { flexGrow: 1, paddingBottom: 32, paddingHorizontal: 20 },
  dashboardTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 18 },
  dashboardDate: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 12 },
  dashboardDay: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 25, letterSpacing: -0.5, lineHeight: 31 },
  dashboardCityChip: { alignItems: "center", backgroundColor: "transparent", flexDirection: "row", gap: 4, paddingHorizontal: 2, paddingVertical: 7 },
  dashboardCityText: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 13 },
  dashboardStatusGrid: { flexDirection: "row", gap: 10, marginTop: 17 },
  dashboardStatusCard: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 15, borderWidth: 1, flex: 1, minHeight: 118, padding: 14 },
  dashboardTransportCard: { backgroundColor: COLORS.blueSurface, borderColor: "#d3e4ff" },
  dashboardStatusTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 14, marginTop: 14 },
  dashboardStatusText: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 11, lineHeight: 16, marginTop: 4 },
  weatherPreviewIcon: { height: 34, marginLeft: -6, marginTop: -5, width: 34 },
  cityWeatherIcon: { height: 30, width: 30 },
  weatherPreviewTemperature: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 27, marginTop: 2 },
  weatherFeatureCard: { alignItems: "stretch", backgroundColor: "#eaf2ff", borderColor: "#d4e3f7", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 8, marginTop: 15, minHeight: 100, overflow: "hidden", padding: 9 },
  weatherFeatureInfo: { flex: 1, flexDirection: "row", minWidth: 0 },
  weatherFeatureMain: { flex: 1, justifyContent: "center" },
  weatherFeatureLabel: { color: "#526d89", fontFamily: FONTS.medium, fontSize: 11 },
  weatherFeatureTemperatureRow: { alignItems: "center", flexDirection: "row", gap: 4, marginTop: -2 },
  weatherFeatureTemperature: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 35, letterSpacing: -1.5, lineHeight: 40 },
  weatherFeatureIcon: { height: 42, width: 42 },
  weatherFeatureCondition: { color: COLORS.navy, fontFamily: FONTS.medium, fontSize: 12, marginTop: -3 },
  weatherFeatureAir: { alignItems: "flex-start", borderLeftColor: "#c5d7ec", borderLeftWidth: 1, justifyContent: "center", marginLeft: 4, paddingLeft: 8, width: 88 },
  weatherFeatureAirLabel: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 11, marginTop: 3 },
  weatherFeatureAirValue: { color: COLORS.ink, fontFamily: FONTS.semibold, fontSize: 14, marginTop: 2 },
  weatherFeatureAirMeta: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 11, marginTop: 2 },
  weatherFeatureAlert: { alignItems: "center", borderRadius: 9, gap: 5, justifyContent: "center", minHeight: 80, paddingHorizontal: 6, width: 80 },
  weatherFeatureAlertClear: { backgroundColor: "#dff1da" },
  weatherFeatureAlertUnknown: { backgroundColor: COLORS.blueSurface },
  weatherFeatureAlertActive: { backgroundColor: "#ffe3e0" },
  weatherFeatureAlertText: { color: "#245b31", fontFamily: FONTS.medium, fontSize: 11, lineHeight: 14, textAlign: "center" },
  weatherFeatureAlertTextActive: { color: "#8e1b1b" },
  weatherFeatureChevron: { position: "absolute", right: 5, top: 5 },
  airAlertBanner: { alignItems: "center", borderRadius: 12, flexDirection: "row", gap: 8, marginTop: 9, minHeight: 46, paddingHorizontal: 10, paddingVertical: 7 },
  airAlertBannerClear: { backgroundColor: "#eef8eb" },
  airAlertBannerActive: { backgroundColor: "#fff4f3", borderColor: "#f0b5b0", borderWidth: 1 },
  airAlertIcon: { alignItems: "center", borderRadius: 8, height: 30, justifyContent: "center", width: 30 },
  airAlertIconClear: { backgroundColor: "#dff1da" },
  airAlertIconActive: { backgroundColor: "#ffe3e0" },
  airAlertCopy: { flex: 1 },
  airAlertTitle: { color: COLORS.green, fontFamily: FONTS.semibold, fontSize: 12 },
  airAlertTitleActive: { color: "#8e1b1b" },
  airAlertTextClear: { color: "#3f6649", fontFamily: FONTS.regular, fontSize: 10, marginTop: 1 },
  airAlertTextActive: { color: "#a54943" },
  defendersBanner: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 10, marginTop: 10, minHeight: 56, paddingHorizontal: 12, paddingVertical: 9 },
  defendersBannerGlow: {},
  defendersBannerIcon: { alignItems: "center", backgroundColor: "#fff3ce", borderRadius: 8, height: 32, justifyContent: "center", width: 32 },
  defendersBannerCopy: { flex: 1 },
  defendersBannerKicker: { color: "#f7be3d", fontFamily: FONTS.semibold, fontSize: 9, letterSpacing: 0.7 },
  defendersBannerTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 14, lineHeight: 19 },
  defendersBannerText: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 11, lineHeight: 15, marginTop: 2 },
  defendersBannerAction: {},
  defendersContent: { flexGrow: 1, paddingBottom: 32, paddingHorizontal: 20 },
  defendersHero: { backgroundColor: "#173f37", borderRadius: 19, marginTop: 15, overflow: "hidden", padding: 19 },
  defendersHeroMark: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.09)", borderColor: "rgba(247,190,61,0.35)", borderRadius: 15, borderWidth: 1, height: 52, justifyContent: "center", width: 52 },
  defendersHeroKicker: { color: "#f7be3d", fontFamily: FONTS.semibold, fontSize: 10, letterSpacing: 0.9, marginTop: 18 },
  defendersHeroTitle: { color: "#ffffff", fontFamily: FONTS.bold, fontSize: 25, lineHeight: 31, marginTop: 5 },
  defendersHeroText: { color: "#d9ece6", fontFamily: FONTS.regular, fontSize: 13, lineHeight: 20, marginTop: 8 },
  defendersIntro: { marginTop: 18 },
  defendersIntroTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 25, lineHeight: 31 },
  defendersIntroText: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 13, lineHeight: 19, marginTop: 6 },
  featuredDonationCard: { backgroundColor: "#123a63", borderColor: "#285375", borderRadius: 15, borderWidth: 1, marginTop: 13, padding: 14 },
  featuredDonationTop: { alignItems: "center", flexDirection: "row", gap: 10 },
  featuredDonationIcon: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 10, height: 40, justifyContent: "center", width: 40 },
  featuredDonationCopy: { flex: 1 },
  featuredDonationLabel: { color: "#f7be3d", fontFamily: FONTS.semibold, fontSize: 9, letterSpacing: 0.7 },
  featuredDonationTitle: { color: "#ffffff", fontFamily: FONTS.semibold, fontSize: 16, marginTop: 3 },
  featuredDonationText: { color: "#d3e4ff", fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, marginTop: 12 },
  featuredDonationButton: { alignItems: "center", backgroundColor: "#f7be3d", borderRadius: 10, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 13, minHeight: 44, paddingHorizontal: 13 },
  featuredDonationButtonText: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 13 },
  defendersTrustCard: { alignItems: "flex-start", backgroundColor: "#eef8eb", borderColor: "#d7ead0", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 10, marginTop: 13, padding: 13 },
  defendersTrustIcon: { alignItems: "center", backgroundColor: "#dff1da", borderRadius: 10, height: 39, justifyContent: "center", width: 39 },
  defendersTrustCopy: { flex: 1 },
  defendersTrustTitle: { color: "#245b31", fontFamily: FONTS.semibold, fontSize: 14 },
  defendersTrustText: { color: "#3f6649", fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, marginTop: 3 },
  defendersFundList: { gap: 10, marginTop: 22 },
  defendersListTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 19, marginBottom: 1 },
  defendersFundCard: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 15, borderWidth: 1, padding: 14 },
  defendersFundTop: { alignItems: "center", flexDirection: "row", gap: 10 },
  defendersFundIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 10, height: 41, justifyContent: "center", width: 41 },
  defendersFundCopy: { flex: 1 },
  defendersFundTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontSize: 15 },
  defendersFundVerified: { color: COLORS.green, fontFamily: FONTS.medium, fontSize: 11, marginTop: 3 },
  defendersFundDescription: { color: "#526170", fontFamily: FONTS.regular, fontSize: 13, lineHeight: 19, marginTop: 12 },
  defendersFundSource: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 11, lineHeight: 16, marginTop: 8 },
  defendersDonateButton: { alignItems: "center", backgroundColor: "#173f37", borderRadius: 10, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 13, minHeight: 46, paddingHorizontal: 13 },
  defendersDonateButtonText: { color: "#ffffff", fontFamily: FONTS.semibold, fontSize: 13 },
  defendersEmptyCard: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 15, borderStyle: "dashed", borderWidth: 1, marginTop: 22, padding: 20 },
  defendersEmptyIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 14, height: 48, justifyContent: "center", width: 48 },
  defendersEmptyTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 16, marginTop: 12 },
  defendersEmptyText: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, marginTop: 6, textAlign: "center" },
  defendersFootnote: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 11, lineHeight: 16, marginTop: 20, textAlign: "center" },
  currencyWidget: { borderBottomColor: COLORS.border, borderBottomWidth: 1, borderTopColor: COLORS.border, borderTopWidth: 1, marginTop: 22, paddingVertical: 12 },
  currencyWidgetHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  currencyWidgetTitleRow: { alignItems: "center", flexDirection: "row", gap: 7 },
  currencyWidgetTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 14 },
  currencyWidgetSource: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 11 },
  currencyRatesRow: { flexDirection: "row", gap: 9, marginTop: 13 },
  currencyRate: { borderLeftColor: COLORS.border, borderLeftWidth: 1, flex: 1, paddingHorizontal: 9, paddingVertical: 4 },
  currencyCode: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 11 },
  currencyValue: { color: COLORS.ink, fontFamily: FONTS.semibold, fontSize: 14, marginTop: 3 },
  currencyMeta: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 10, marginTop: 1 },
  currencyUnavailable: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 12, marginTop: 13 },
  currencyStale: { color: "#795000", fontFamily: FONTS.regular, fontSize: 10, marginTop: 8 },
  currencyExpand: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 4, marginTop: 10, minHeight: 30 },
  currencyExpandText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 12 },
  weatherContent: { paddingBottom: 32, paddingHorizontal: 20 },
  weatherHero: { backgroundColor: COLORS.navy, borderRadius: 16, marginTop: 16, padding: 16 },
  weatherHeroTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  weatherHeroTemperature: { color: "#ffffff", fontFamily: FONTS.bold, fontSize: 52, letterSpacing: -2 },
  weatherHeroCondition: { color: "#d3e4ff", fontFamily: FONTS.regular, fontSize: 14, marginTop: 2 },
  weatherHeroIcon: { height: 78, width: 78 },
  weatherMetrics: { borderTopColor: "rgba(255,255,255,0.18)", borderTopWidth: 1, flexDirection: "row", gap: 8, marginTop: 16, paddingTop: 13 },
  weatherMetric: { flex: 1 },
  weatherMetricLabel: { color: "#d3e4ff", fontFamily: FONTS.regular, fontSize: 10, marginTop: 5 },
  weatherMetricValue: { color: "#ffffff", fontFamily: FONTS.semibold, fontSize: 12, marginTop: 2 },
  weatherAirQualityCard: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, flexDirection: "row", marginTop: 12, padding: 13 },
  weatherAirQualityIcon: { alignItems: "center", backgroundColor: "#eef7eb", borderRadius: 10, height: 40, justifyContent: "center", width: 40 },
  weatherAirQualityCopy: { flex: 1, marginLeft: 10 },
  weatherAirQualityLabel: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 11 },
  weatherAirQualityValue: { color: COLORS.ink, fontFamily: FONTS.semibold, fontSize: 14, marginTop: 3 },
  weatherAirQualityMeta: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 10, lineHeight: 15, textAlign: "right" },
  weatherDayTabs: { gap: 5, paddingTop: 18 },
  weatherDayTab: { backgroundColor: COLORS.blueSurface, borderRadius: 9, minWidth: 96, paddingHorizontal: 11, paddingVertical: 8 },
  weatherDayTabActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  weatherDayTabText: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 12 },
  weatherDayTabTextActive: { color: "#ffffff" },
  weatherDayTabTemperature: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 11, marginTop: 4 },
  weatherDaySummary: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", marginTop: 14, padding: 14 },
  weatherDaySummaryTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontSize: 14 },
  weatherDaySummaryText: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 12, marginTop: 4 },
  weatherSunTimes: { gap: 4 },
  weatherSunTime: { color: COLORS.navy, fontFamily: FONTS.medium, fontSize: 12 },
  weatherSectionTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 16, marginTop: 22 },
  weatherHours: { borderBottomColor: COLORS.border, borderBottomWidth: 1, borderTopColor: COLORS.border, borderTopWidth: 1, gap: 0, marginTop: 10, paddingVertical: 10 },
  weatherHourCard: { alignItems: "center", minWidth: 64, paddingHorizontal: 6, paddingVertical: 4 },
  weatherHourTime: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 10 },
  weatherHourIcon: { height: 32, marginVertical: 4, width: 32 },
  weatherHourTemperature: { color: COLORS.ink, fontFamily: FONTS.semibold, fontSize: 14 },
  weatherHourRain: { color: COLORS.navy, fontFamily: FONTS.regular, fontSize: 10, marginTop: 3 },
  weatherSource: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 12, lineHeight: 17, marginTop: 22, textAlign: "center" },
  weatherStale: { color: "#795000", fontFamily: FONTS.regular, fontSize: 11, marginTop: 5, textAlign: "center" },
  dashboardSectionRow: { alignItems: "center", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", marginTop: 27, paddingBottom: 9 },
  dashboardSectionTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 17 },
  dashboardAllLink: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 13 },
  dashboardFeedCard: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 13, borderWidth: 1, flexDirection: "row", gap: 11, marginTop: 9, padding: 13 },
  dashboardFeedIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 10, height: 42, justifyContent: "center", width: 42 },
  dashboardFeedCopy: { flex: 1 },
  dashboardFeedTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontSize: 14 },
  dashboardFeedText: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 11, lineHeight: 16, marginTop: 3 },
  homeNewsList: { marginTop: 4 },
  homeNewsItem: { alignItems: "center", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", gap: 8, paddingVertical: 12 },
  homeNewsIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 8, height: 32, justifyContent: "center", width: 32 },
  homeNewsCopy: { flex: 1 },
  homeNewsTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontSize: 14, lineHeight: 19 },
  homeNewsMeta: { color: COLORS.tertiary, fontFamily: FONTS.regular, fontSize: 12, marginTop: 3 },
  homeNewsAllButton: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 7, paddingTop: 12 },
  homeNewsAllText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 13 },
  dashboardServicesRow: { gap: 10, paddingTop: 10, paddingRight: 4 },
  dashboardServicesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 10 },
  dashboardServiceCard: { alignItems: "center", borderColor: COLORS.border, borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 8, minHeight: 60, paddingHorizontal: 10, paddingVertical: 9, width: "48.7%" },
  dashboardServiceIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 7, height: 33, justifyContent: "center", width: 33 },
  dashboardServiceTitle: { color: COLORS.ink, flex: 1, fontFamily: FONTS.medium, fontSize: 11, lineHeight: 15 },
  simpleTabContent: { flexGrow: 1, paddingBottom: 28, paddingHorizontal: 20, paddingTop: 0 },
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
  bottomNavigation: { backgroundColor: "rgba(255,255,255,0.97)", borderTopColor: COLORS.border, borderTopWidth: 1, flexDirection: "row", marginHorizontal: -16, paddingHorizontal: 6, paddingVertical: 9 },
  tabButton: { alignItems: "center", flex: 1, minHeight: 44 },
  tabIcon: { color: COLORS.muted, fontSize: 21, lineHeight: 23 },
  tabLabel: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 10, marginTop: 4 },
  tabActive: { color: COLORS.navy, fontFamily: FONTS.semibold },
  hubSubtitle: { color: "#123a63", fontSize: 18, fontWeight: "700", marginTop: 8 },
  hubIntro: { color: "#43474e", fontSize: 16, lineHeight: 23, marginTop: 8 },
  sectionLabel: { color: "#4b5563", fontFamily: FONTS.semibold, fontSize: 11, letterSpacing: 0.7, marginTop: 0, textTransform: "uppercase" },
  serviceCard: { alignItems: "flex-start", backgroundColor: "#ffffff", borderColor: "#e2e8f0", borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 14, marginTop: 12, padding: 16 },
  transportServiceCard: { backgroundColor: "#eef4ff", borderColor: "#d3e4ff", marginTop: 24 },
  serviceIcon: { alignItems: "center", backgroundColor: "#eef4ff", borderRadius: 14, height: 48, justifyContent: "center", width: 48 },
  serviceIconText: { color: "#123a63", fontSize: 24, fontWeight: "700" },
  serviceTextBlock: { flex: 1 },
  serviceTitle: { color: "#071d31", fontSize: 17, fontWeight: "700" },
  serviceDescription: { color: "#43474e", fontSize: 14, lineHeight: 20, marginTop: 4 },
  serviceAction: { color: "#123a63", fontSize: 14, fontWeight: "700", marginTop: 10 },
  hubFootnote: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 11, lineHeight: 17, textAlign: "center" },
  detailIntro: { marginTop: 13 },
  serviceDetailsContent: { alignItems: "stretch", paddingBottom: 32, paddingHorizontal: 20, paddingTop: 16 },
  serviceDetailsIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 16, height: 58, justifyContent: "center", width: 58 },
  serviceDetailsIconText: { color: COLORS.navy, fontFamily: FONTS.bold, fontSize: 30 },
  detailTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 25, letterSpacing: -0.3, lineHeight: 31, marginTop: 7 },
  detailDescription: { color: "#596574", fontFamily: FONTS.regular, fontSize: 14, lineHeight: 21, marginTop: 6 },
  serviceDetailsTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 25, letterSpacing: -0.3, marginTop: 15 },
  serviceDetailsDescription: { color: "#596574", fontFamily: FONTS.regular, fontSize: 14, lineHeight: 21, marginTop: 6 },
  serviceNotice: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderLeftColor: COLORS.gold, borderLeftWidth: 3, borderRadius: 14, borderWidth: 1, marginTop: 20, padding: 14 },
  serviceNoticeTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 15 },
  serviceNoticeText: { color: "#596574", fontFamily: FONTS.regular, fontSize: 13, lineHeight: 19, marginTop: 6 },
  serviceComingSoon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 12, flexDirection: "row", gap: 9, marginTop: 16, padding: 13 },
  serviceComingSoonText: { color: "#3f5269", flex: 1, fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18 },
  externalButton: { alignItems: "center", backgroundColor: COLORS.navy, borderRadius: 10, marginTop: 16, minHeight: 50, padding: 15 },
  externalButtonText: { color: "#ffffff", fontFamily: FONTS.semibold, fontSize: 14 },
  externalHint: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, marginTop: 12, textAlign: "center" },
  silencePanel: { alignItems: "center", backgroundColor: COLORS.navyDark, borderRadius: 16, marginTop: 20, padding: 22 },
  silenceTime: { color: "#ffffff", fontFamily: FONTS.bold, fontSize: 40 },
  silenceTitle: { color: "#eef4ff", fontFamily: FONTS.semibold, fontSize: 14, marginTop: 8, textAlign: "center" },
  silenceCountdown: { color: "#d3e4ff", fontFamily: FONTS.regular, fontSize: 12, marginTop: 8, textAlign: "center" },
  silenceContent: { paddingBottom: 32, paddingHorizontal: 20 },
  silenceHero: { alignItems: "center", backgroundColor: COLORS.navyDark, borderRadius: 18, marginTop: 20, overflow: "hidden", padding: 24 },
  silenceHeroIcon: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 28, height: 56, justifyContent: "center", width: 56 },
  silenceHeroKicker: { color: "#d3e4ff", fontFamily: FONTS.semibold, fontSize: 11, letterSpacing: 1, marginTop: 14 },
  silenceHeroTime: { color: "#ffffff", fontFamily: FONTS.bold, fontSize: 45, letterSpacing: -1, marginTop: 4 },
  silenceHeroText: { color: "#d3e4ff", fontFamily: FONTS.regular, fontSize: 13, marginTop: 4, textAlign: "center" },
  remembranceCard: { alignItems: "flex-start", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 11, marginTop: 14, padding: 14 },
  remembranceIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 10, height: 42, justifyContent: "center", width: 42 },
  remembranceCopy: { flex: 1 },
  remembranceTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontSize: 14 },
  remembranceText: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, marginTop: 4 },
  accessibilityTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 25, marginTop: 18 },
  accessibilityIntro: { color: "#596574", fontFamily: FONTS.regular, fontSize: 14, lineHeight: 21, marginTop: 6 },
  inlineLoader: { marginTop: 12 },
  inlineError: { backgroundColor: "#fff5f4", borderColor: "#f4ceca", borderRadius: 12, borderWidth: 1, marginTop: 12, padding: 14 },
  inlineErrorText: { color: "#991b1b", fontFamily: FONTS.regular, fontSize: 13 },
  inlineRetry: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 13, marginTop: 8 },
  accessibilityList: { gap: 12, paddingBottom: 30, paddingHorizontal: 20, paddingTop: 16 },
  accessibilityCount: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 12, marginBottom: 2 },
  staleData: { color: "#795000", fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, marginBottom: 4 },
  accessibilityCard: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, padding: 14 },
  accessibilityBuildingName: { color: COLORS.ink, fontFamily: FONTS.semibold, fontSize: 15 },
  accessibilityAddress: { color: "#596574", fontFamily: FONTS.regular, fontSize: 13, lineHeight: 19, marginTop: 6 },
  accessibilityDate: { color: COLORS.navy, fontFamily: FONTS.medium, fontSize: 12, marginTop: 9 },
  accessibilityFooter: { marginTop: 8 },
  accessibilityNote: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, textAlign: "center" },
  miniaturesList: { gap: 10, paddingBottom: 32, paddingHorizontal: 20, paddingTop: 16 },
  miniaturesMapCard: { borderColor: COLORS.border, borderRadius: 15, borderWidth: 1, height: 220, overflow: "hidden" },
  miniaturesCountRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  miniaturesCountPill: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 14, flexDirection: "row", gap: 5, paddingHorizontal: 10, paddingVertical: 6 },
  miniaturesCountText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 11 },
  miniaturesSourceDate: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 10 },
  miniaturesNotice: { alignItems: "flex-start", backgroundColor: COLORS.blueSurface, borderRadius: 13, flexDirection: "row", gap: 9, marginTop: 12, padding: 12 },
  miniaturesNoticeText: { color: "#3f5269", flex: 1, fontFamily: FONTS.regular, fontSize: 11, lineHeight: 16 },
  miniaturesListTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 16, marginTop: 9 },
  miniatureCard: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, padding: 14 },
  miniatureCardTop: { alignItems: "center", flexDirection: "row", gap: 10 },
  miniatureNumber: { alignItems: "center", backgroundColor: COLORS.navy, borderRadius: 11, height: 35, justifyContent: "center", width: 35 },
  miniatureNumberText: { color: "#ffffff", fontFamily: FONTS.semibold, fontSize: 13 },
  miniatureCardCopy: { flex: 1 },
  miniatureTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontSize: 15 },
  miniatureAddress: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 11, lineHeight: 16, marginTop: 3 },
  miniatureSummary: { color: "#596574", fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, marginTop: 11 },
  miniatureMeta: { flexDirection: "row", flexWrap: "wrap", marginTop: 9 },
  miniatureMetaText: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 10 },
  miniatureMapAction: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 5, marginTop: 12 },
  miniatureMapActionText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 12 },
  miniaturesFooter: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 11, lineHeight: 17, marginHorizontal: 14, marginTop: 10, textAlign: "center" },
  sourceButton: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 10, flexDirection: "row", gap: 7, justifyContent: "center", marginTop: 14, minHeight: 46 },
  sourceButtonText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 13 },
  paymentContent: { flexGrow: 1, paddingBottom: 32, paddingHorizontal: 20 },
  paymentHero: { backgroundColor: COLORS.navy, borderRadius: 18, marginTop: 15, padding: 18 },
  paymentHeroTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  paymentHeroIcon: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, height: 48, justifyContent: "center", width: 48 },
  paymentHeroTitle: { color: "#ffffff", fontFamily: FONTS.bold, fontSize: 24, marginTop: 17 },
  paymentHeroText: { color: "#d3e4ff", fontFamily: FONTS.regular, fontSize: 13, lineHeight: 20, marginTop: 7 },
  paymentSafetyNote: { alignItems: "flex-start", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 13, borderWidth: 1, flexDirection: "row", gap: 9, marginTop: 12, padding: 12 },
  paymentSafetyText: { color: COLORS.navyDark, flex: 1, fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18 },
  paymentCard: { marginTop: 20 },
  paymentSectionTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 15, marginBottom: 9 },
  paymentTicketChoice: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 11, borderWidth: 1, flexDirection: "row", gap: 10, marginBottom: 22, padding: 12 },
  paymentReferenceBlock: { marginBottom: 22, marginTop: 14 },
  paymentReferenceHint: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 11, lineHeight: 16, marginTop: 7 },
  paymentTicketIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 10, height: 42, justifyContent: "center", width: 42 },
  paymentTicketCopy: { flex: 1 },
  paymentTicketTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontSize: 14 },
  paymentTicketText: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 11, marginTop: 3 },
  paymentTicketPrice: { color: COLORS.navy, fontFamily: FONTS.bold, fontSize: 15 },
  paymentMethod: { alignItems: "center", borderColor: COLORS.controlBorder, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 10, marginTop: 8, minHeight: 62, padding: 11 },
  paymentMethodActive: { backgroundColor: "#f3f8ff", borderColor: COLORS.controlBorder },
  paymentMethodIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 9, height: 38, justifyContent: "center", width: 38 },
  paymentMethodCopy: { flex: 1 },
  paymentMethodTitle: { color: COLORS.ink, fontFamily: FONTS.medium, fontSize: 13 },
  paymentMethodText: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 11, marginTop: 3 },
  paymentCardFields: { marginTop: 14 },
  paymentCardFieldsRow: { flexDirection: "row", gap: 9, marginTop: 10 },
  paymentCardFieldHalf: { flex: 1 },
  paymentFieldLabel: { color: COLORS.navyDark, fontFamily: FONTS.medium, fontSize: 12, marginBottom: 6 },
  paymentLast4Label: { marginTop: 14 },
  paymentCardInput: { backgroundColor: "#ffffff", borderColor: COLORS.controlBorder, borderRadius: 9, borderWidth: 1, color: COLORS.ink, fontFamily: FONTS.medium, fontSize: 14, minHeight: 48, paddingHorizontal: 11 },
  accountModeRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  accountMode: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 9, flex: 1, paddingVertical: 10 },
  accountModeActive: { backgroundColor: COLORS.navy },
  accountModeText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 12 },
  accountModeTextActive: { color: "#ffffff" },
  accountPasswordLabel: { marginTop: 12 },
  accountError: { color: "#a31d1d", fontFamily: FONTS.regular, fontSize: 12, lineHeight: 17, marginTop: 10 },
  accountSubmitDisabled: { opacity: 0.55 },
  pollResult: { alignItems: "flex-start", backgroundColor: COLORS.blueSurface, borderRadius: 10, flexDirection: "row", gap: 9, marginTop: 13, padding: 12 },
  pollResultText: { color: COLORS.navyDark, flex: 1, fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18 },
  paymentAddCardRow: { alignItems: "center", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", gap: 8, marginTop: 10, minHeight: 48, paddingHorizontal: 3 },
  paymentAddCardText: { color: COLORS.navy, flex: 1, fontFamily: FONTS.semibold, fontSize: 13 },
  paymentSubmitButton: { alignItems: "center", backgroundColor: COLORS.navy, borderRadius: 11, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 20, minHeight: 50, paddingHorizontal: 14 },
  paymentSubmitButtonDisabled: { backgroundColor: "#90a0b2" },
  paymentSubmitText: { color: "#ffffff", fontFamily: FONTS.semibold, fontSize: 13 },
  savedPaymentCard: { backgroundColor: COLORS.navy, borderRadius: 15, marginTop: 2, overflow: "hidden", padding: 15 },
  savedPaymentCardTop: { alignItems: "center", flexDirection: "row", gap: 11 },
  savedPaymentCardIcon: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 10, height: 42, justifyContent: "center", width: 42 },
  savedPaymentCardLabel: { color: "#d7e9fb", fontFamily: FONTS.medium, fontSize: 12 },
  savedPaymentCardNumber: { color: "#ffffff", fontFamily: FONTS.semibold, fontSize: 17, letterSpacing: 0.7, marginTop: 4 },
  removePaymentCardButton: { alignItems: "center", backgroundColor: "#ffffff", borderRadius: 9, flexDirection: "row", gap: 7, justifyContent: "center", marginTop: 15, minHeight: 42 },
  removePaymentCardText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 12 },
  paymentMethodsFootnote: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 11, lineHeight: 17, marginTop: 18, textAlign: "center" },
  paymentFootnote: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 11, lineHeight: 16, marginTop: 11, textAlign: "center" },
  paymentSuccessHero: { marginTop: 18 },
  paymentSuccessIcon: { alignItems: "center", backgroundColor: COLORS.green, borderRadius: 28, height: 56, justifyContent: "center", width: 56 },
  paymentSuccessKicker: { color: "#b9e7b2", fontFamily: FONTS.semibold, fontSize: 10, letterSpacing: 0.8, marginTop: 12 },
  paymentSuccessTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 24 },
  paymentSuccessText: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 13, lineHeight: 19, marginTop: 6 },
  demoTicket: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 17, borderStyle: "dashed", borderWidth: 1, marginTop: 14, overflow: "hidden", padding: 16 },
  demoTicketTop: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  demoTicketLabel: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 10, letterSpacing: 0.7 },
  demoTicketTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 20, marginTop: 4 },
  demoQr: { alignItems: "center", borderBottomColor: COLORS.border, borderBottomWidth: 1, borderTopColor: COLORS.border, borderTopWidth: 1, marginTop: 15, paddingVertical: 16 },
  demoQrInner: { alignItems: "center", backgroundColor: "#f4f7fb", borderRadius: 8, height: 96, justifyContent: "center", width: 96 },
  demoTicketMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 13 },
  demoTicketMetaText: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 11 },
  paymentNextCard: { backgroundColor: COLORS.blueSurface, borderRadius: 14, marginTop: 13, padding: 14 },
  paymentNextTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 14 },
  paymentNextText: { color: "#40546b", fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, marginTop: 5 },
  paymentSecondaryButton: { alignItems: "center", alignSelf: "center", flexDirection: "row", gap: 7, marginTop: 18, padding: 8 },
  paymentSecondaryButtonText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 13 },
  eventsContent: { flexGrow: 1, paddingBottom: 32, paddingHorizontal: 20 },
  eventsSourceNote: { alignItems: "flex-start", backgroundColor: COLORS.blueSurface, borderRadius: 12, flexDirection: "row", gap: 9, marginTop: 14, padding: 12 },
  eventsSourceText: { color: COLORS.navyDark, flex: 1, fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18 },
  eventsDayGroup: { marginTop: 19 },
  eventsDayHeading: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 15, marginBottom: 7 },
  eventsList: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  eventRow: { alignItems: "center", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", gap: 10, minHeight: 76, paddingHorizontal: 12, paddingVertical: 10 },
  eventDateBadge: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 9, height: 42, justifyContent: "center", width: 42 },
  eventDateBadgeDay: { color: COLORS.navy, fontFamily: FONTS.bold, fontSize: 16, lineHeight: 17 },
  eventDateBadgeMonth: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 8, letterSpacing: 0.4, marginTop: 1 },
  eventCopy: { flex: 1 },
  eventTopLine: { alignItems: "flex-start", flexDirection: "row", gap: 7 },
  eventTitle: { color: COLORS.ink, flex: 1, fontFamily: FONTS.semibold, fontSize: 13, lineHeight: 18 },
  eventCategory: { color: COLORS.navy, fontFamily: FONTS.medium, fontSize: 10, maxWidth: 64, textAlign: "right" },
  eventMeta: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 11, lineHeight: 16, marginTop: 3 },
  parkingContent: { paddingBottom: 32, paddingHorizontal: 20 },
  parkingHero: { backgroundColor: COLORS.navy, borderRadius: 16, marginTop: 18, padding: 17 },
  parkingHeroTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  parkingHeroIcon: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 10, height: 42, justifyContent: "center", width: 42 },
  parkingHeroBadge: { backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(247,190,61,0.35)", borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5 },
  parkingHeroBadgeText: { color: "#f7be3d", fontFamily: FONTS.semibold, fontSize: 9, letterSpacing: 0.5 },
  parkingHeroTitle: { color: "#ffffff", fontFamily: FONTS.bold, fontSize: 20, marginTop: 15 },
  parkingHeroText: { color: "#d3e4ff", fontFamily: FONTS.regular, fontSize: 13, lineHeight: 19, marginTop: 6 },
  parkingSectionHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  parkingActionList: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, marginTop: 16, overflow: "hidden" },
  parkingActionRow: { alignItems: "center", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", gap: 11, minHeight: 76, paddingHorizontal: 12, paddingVertical: 10 },
  parkingActionCard: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, marginTop: 1, padding: 14 },
  parkingActionHeading: { alignItems: "center", flexDirection: "row", gap: 10 },
  parkingActionIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 9, height: 37, justifyContent: "center", width: 37 },
  parkingActionCopy: { flex: 1 },
  parkingActionTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontSize: 14, lineHeight: 19 },
  parkingActionText: { color: "#596574", fontFamily: FONTS.regular, fontSize: 12, lineHeight: 17, marginTop: 2 },
  parkingActionLink: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 12, marginTop: 10 },
  parkingInfoNote: { alignItems: "flex-start", backgroundColor: "#fff8e9", borderColor: "#f2dcaa", borderRadius: 13, borderWidth: 1, flexDirection: "row", gap: 9, marginTop: 14, padding: 12 },
  parkingInfoCopy: { flex: 1 },
  parkingUnavailable: { backgroundColor: "#fff8e9", borderColor: "#f2dcaa", borderRadius: 14, borderWidth: 1, marginTop: 7, padding: 14 },
  parkingUnavailableTitle: { color: "#624600", fontFamily: FONTS.semibold, fontSize: 14 },
  parkingUnavailableText: { color: "#735817", fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, marginTop: 7 },
  parkingUnavailableLink: { color: "#624600", fontFamily: FONTS.semibold, fontSize: 12, marginTop: 10 },
  subtitle: { color: "#43474e", fontSize: 16, marginTop: 4 },
  dataUpdated: { color: "#5b6e80", fontSize: 13, marginTop: 6 },
  dataSourcesLink: { color: "#123a63", fontSize: 13, fontWeight: "700", marginTop: 8 },
  searchInput: { color: COLORS.ink, flex: 1, fontFamily: FONTS.regular, fontSize: 13, paddingVertical: 10 },
  searchModes: { flexDirection: "row", gap: 8, marginTop: 11 },
  searchMode: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.controlBorder, borderRadius: 9, borderWidth: 1, flex: 1, minHeight: 44, justifyContent: "center" },
  searchModeActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  searchModeText: { color: "#596574", fontFamily: FONTS.medium, fontSize: 12 },
  searchModeTextActive: { color: "#ffffff", fontFamily: FONTS.semibold },
  list: { paddingBottom: 22, paddingHorizontal: 20, paddingTop: 16 },
  transportListHeading: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 15, marginBottom: 9 },
  transportSavedHint: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 11, marginTop: -4 },
  routeCard: { alignItems: "center", backgroundColor: "#ffffff", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", gap: 11, minHeight: 64, paddingHorizontal: 11, paddingVertical: 8 },
  routeBadge: { alignItems: "center", backgroundColor: COLORS.navy, borderRadius: 8, justifyContent: "center", minWidth: 47, paddingHorizontal: 7, paddingVertical: 8 },
  routeBadgeText: { color: "#ffffff", fontFamily: FONTS.semibold, fontSize: 15 },
  routeCardCopy: { flex: 1 },
  routeName: { color: COLORS.ink, flex: 1, fontFamily: FONTS.medium, fontSize: 14, lineHeight: 19 },
  routeCardMeta: { color: COLORS.tertiary, fontFamily: FONTS.regular, fontSize: 12, marginTop: 3 },
  favoriteButton: { alignItems: "center", borderRadius: 22, height: 44, justifyContent: "center", width: 44 },
  stopCard: { alignItems: "center", backgroundColor: "#ffffff", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", gap: 10, minHeight: 64, paddingHorizontal: 11, paddingVertical: 8 },
  stopCardText: { flex: 1 },
  stopCardName: { color: COLORS.ink, fontFamily: FONTS.medium, fontSize: 14, lineHeight: 19 },
  stopCardAction: { color: COLORS.tertiary, fontFamily: FONTS.medium, fontSize: 12, marginTop: 3 },
  empty: { color: COLORS.muted, fontFamily: FONTS.regular, textAlign: "center" },
  transportEmptyState: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, marginTop: 6, padding: 22 },
  transportEmptyIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 24, height: 48, justifyContent: "center", width: 48 },
  transportEmptyTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 15, marginTop: 12, textAlign: "center" },
  transportEmptyText: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, marginTop: 6, textAlign: "center" },
  transportEmptyActions: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 16 },
  transportEmptyPrimaryAction: { backgroundColor: COLORS.navy, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  transportEmptyPrimaryActionText: { color: "#ffffff", fontFamily: FONTS.semibold, fontSize: 12 },
  transportEmptySecondaryAction: { backgroundColor: COLORS.blueSurface, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  transportEmptySecondaryActionText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 12 },
  back: { color: "#123a63", fontSize: 16, fontWeight: "600", marginTop: 20 },
  stopDetailsHeading: { alignItems: "flex-start", flexDirection: "row", gap: 8, justifyContent: "space-between", marginTop: 16 },
  stopDetailsTitle: { color: COLORS.navyDark, flex: 1, fontFamily: FONTS.bold, fontSize: 23, lineHeight: 29 },
  stopDetailsSubtitle: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 13, marginTop: 4 },
  stopDetailsCode: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 12, marginTop: 4 },
  routeHeader: { alignItems: "center", flexDirection: "row", gap: 12, marginVertical: 16 },
  routeDetailHero: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, marginBottom: 12, marginTop: 10, padding: 14 },
  routeDetailTopLine: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  routeDetailRouteIdentity: { alignItems: "center", flexDirection: "row", gap: 8 },
  routeDetailRouteLabel: { color: "#c9d8ee", fontFamily: FONTS.semibold, fontSize: 9, letterSpacing: 0.8 },
  routeDetailRouteBadge: { alignItems: "center", backgroundColor: "#ffffff", borderRadius: 10, height: 42, justifyContent: "center", minWidth: 46, paddingHorizontal: 8 },
  routeDetailRouteNumber: { color: COLORS.navy, fontFamily: FONTS.bold, fontSize: 22, lineHeight: 26 },
  routeDetailPlanMark: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 8, flexDirection: "row", gap: 5, paddingHorizontal: 8, paddingVertical: 6 },
  routeDetailPlanMarkText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 9, letterSpacing: 0.5 },
  routeDetailTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 19, lineHeight: 25, marginTop: 10 },
  routeDetailTermini: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, marginTop: 5 },
  routeDetailSource: { alignItems: "center", flexDirection: "row", gap: 6, marginTop: 14 },
  routeDetailSourceText: { color: "#d3e4ff", fontFamily: FONTS.regular, fontSize: 11, flex: 1, lineHeight: 16 },
  routeMapPreview: { borderColor: COLORS.border, borderRadius: 13, borderWidth: 1, height: 170, marginBottom: 10, overflow: "hidden" },
  routeMapPreviewMap: { flex: 1 },
  routeMapPreviewLabel: { backgroundColor: "rgba(255,255,255,0.96)", borderColor: "#d4e0ec", borderRadius: 8, borderWidth: 1, bottom: 10, left: 10, paddingHorizontal: 10, paddingVertical: 7, position: "absolute" },
  routeMapPreviewLabelText: { color: "#123a63", fontFamily: FONTS.medium, fontSize: 11 },
  transportDataNotice: { backgroundColor: "#eef4ff", borderRadius: 14, marginTop: 14, padding: 13 },
  transportDataNoticeTitle: { color: "#123a63", fontSize: 14, fontWeight: "700" },
  transportDataNoticeText: { color: "#43474e", fontSize: 13, lineHeight: 18, marginTop: 5 },
  hint: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 12, lineHeight: 17, marginBottom: 8 },
  mapButton: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 10, flexDirection: "row", gap: 8, justifyContent: "center", marginBottom: 14, minHeight: 47, padding: 13 },
  mapButtonText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 13 },
  stopsIntro: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  stopsHeading: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 16 },
  stopsCountPill: { alignItems: "center", backgroundColor: "#e7eeff", borderRadius: 14, height: 28, justifyContent: "center", minWidth: 28, paddingHorizontal: 8 },
  stopsCountText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 12 },
  transportDetailScreen: { flex: 1, backgroundColor: "#f6f7fb", paddingHorizontal: 20 },
  stopDetailsList: { paddingBottom: 22, paddingTop: 16 },
  detailsList: { paddingBottom: 32 },
  routeDetailsContent: { paddingBottom: 34, paddingHorizontal: 20 },
  directionSwitch: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 13, flexDirection: "row", gap: 12, marginBottom: 10, padding: 11 },
  directionCopy: { flex: 1 },
  directionLabel: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 10, letterSpacing: 0.3, textTransform: "uppercase" },
  directionTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 14, marginTop: 3 },
  directionSwitchButton: { alignItems: "center", backgroundColor: "#ffffff", borderRadius: 10, flexDirection: "row", gap: 5, minHeight: 44, paddingHorizontal: 10 },
  directionButtonText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 12 },
  variant: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, overflow: "hidden", padding: 14 },
  variantHeading: { alignItems: "center", flexDirection: "row", gap: 7, marginBottom: 11 },
  variantTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontSize: 15 },
  stopRow: { alignItems: "center", flexDirection: "row", gap: 10, minHeight: 47 },
  stopSequence: { alignItems: "center", alignSelf: "stretch", justifyContent: "center", width: 17 },
  stopDot: { backgroundColor: "#a6c9fa", borderRadius: 4, height: 8, width: 8, zIndex: 1 },
  stopDotStart: { backgroundColor: COLORS.green, height: 10, width: 10 },
  stopDotEnd: { backgroundColor: COLORS.gold, height: 10, width: 10 },
  stopLine: { backgroundColor: "#d3e4ff", bottom: -2, position: "absolute", top: 26, width: 2 },
  stopName: { color: COLORS.ink, flex: 1, fontFamily: FONTS.regular, fontSize: 13 },
  stopScheduleLink: { alignItems: "center", flexDirection: "row", gap: 1 },
  stopSchedule: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 11 },
  scheduleTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 23, marginTop: 16 },
  scheduleSubtitle: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 13, marginTop: 4 },
  dateControls: { alignItems: "center", flexDirection: "row", gap: 10, marginTop: 8 },
  dateButton: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 20, height: 40, justifyContent: "center", width: 40 },
  dateButtonText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 20 },
  selectedDate: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 15, marginTop: 2 },
  sourcesTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 25, marginTop: 18 },
  sourcesList: { gap: 10, paddingBottom: 32, paddingHorizontal: 20, paddingTop: 16 },
  sourceCard: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, padding: 14 },
  sourceCardTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontSize: 15 },
  sourceText: { color: "#596574", fontFamily: FONTS.regular, fontSize: 13, lineHeight: 19, marginTop: 6 },
  sourceUrl: { color: COLORS.navy, fontFamily: FONTS.medium, fontSize: 11, marginTop: 9 },
  departure: { alignItems: "center", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", gap: 14, minHeight: 60, paddingHorizontal: 4, paddingVertical: 10 },
  departureTime: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 19 },
  departureDestination: { color: COLORS.ink, flex: 1, fontFamily: FONTS.regular, fontSize: 13 },
  mapScreen: { flex: 1, backgroundColor: "#f8f9ff" },
  cityMapScreen: { flex: 1, backgroundColor: "#f6f7fb" },
  cityMapHeader: { paddingHorizontal: 20 },
  cityMapTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 24, marginTop: 9 },
  cityMapHint: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 12, marginBottom: 12, marginTop: 3 },
  cityMapCanvas: { flex: 1 },
  cityMapSource: { alignItems: "center", backgroundColor: "#ffffff", borderTopColor: COLORS.border, borderTopWidth: 1, flexDirection: "row", gap: 8, minHeight: 54, paddingHorizontal: 20 },
  cityMapSourceText: { color: COLORS.navy, flex: 1, fontFamily: FONTS.medium, fontSize: 11 },
  mapHeader: { backgroundColor: "#f8f9ff", paddingHorizontal: 20, paddingVertical: 9 },
  mapTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 17, lineHeight: 23, marginTop: 9 },
  mapHint: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 12, marginTop: 3 },
  mapDirectionSwitch: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 12, flexDirection: "row", gap: 10, marginBottom: 10, marginHorizontal: 20, padding: 10 },
  mapDirectionCopy: { flex: 1 },
  mapDirectionLabel: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 10, letterSpacing: 0.3, textTransform: "uppercase" },
  mapDirectionTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 14, marginTop: 2 },
  mapDirectionButton: { alignItems: "center", backgroundColor: "#ffffff", borderRadius: 9, flexDirection: "row", gap: 5, minHeight: 44, paddingHorizontal: 10 },
  mapCanvas: { flex: 1, position: "relative" },
  mapGpsStatus: { alignItems: "center", alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 14, flexDirection: "row", gap: 6, left: 12, paddingHorizontal: 9, paddingVertical: 6, position: "absolute", top: 12 },
  mapGpsDot: { borderRadius: 4, height: 8, width: 8 },
  mapGpsDotLive: { backgroundColor: "#2e673d" },
  mapGpsDotStale: { backgroundColor: "#b7791f" },
  mapGpsDotOffline: { backgroundColor: "#718096" },
  mapGpsStatusText: { color: COLORS.navy, fontFamily: FONTS.medium, fontSize: 11, lineHeight: 15 },
  mapStopCard: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 15, borderWidth: 1, left: 16, padding: 13, position: "absolute", right: 16, shadowColor: "#071d31", shadowOffset: { height: 5, width: 0 }, shadowOpacity: 0.14, shadowRadius: 13, top: 14 },
  mapStopCardWithGps: { top: 60 },
  mapStopCardTop: { alignItems: "center", flexDirection: "row", gap: 10 },
  mapStopIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 9, height: 37, justifyContent: "center", width: 37 },
  mapStopCopy: { flex: 1 },
  mapStopName: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 14, lineHeight: 19 },
  mapStopDirection: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 11, marginTop: 2 },
  mapStopScheduleLoading: { alignItems: "center", flexDirection: "row", gap: 7, marginTop: 13 },
  mapStopScheduleText: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 12 },
  mapStopSchedule: { borderTopColor: COLORS.border, borderTopWidth: 1, marginTop: 12, paddingTop: 10 },
  mapStopScheduleLabel: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 11 },
  mapStopTimes: { flexDirection: "row", gap: 7, marginTop: 7 },
  mapStopTimePill: { backgroundColor: "#eff5ff", borderRadius: 10, flex: 1, paddingHorizontal: 8, paddingVertical: 7 },
  mapStopScheduleTime: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 17 },
  mapStopMinutesText: { color: "#2e673d", fontFamily: FONTS.semibold, fontSize: 10, marginTop: 2 },
  mapStopEmpty: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 12, lineHeight: 17, marginTop: 12 },
  mapStopError: { color: "#9a3412", fontFamily: FONTS.regular, fontSize: 12, lineHeight: 17, marginTop: 12 },
  mapStopFootnote: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 10, marginTop: 9 },
  loadingIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 24, height: 56, justifyContent: "center", width: 56 },
  loadingSpinner: { marginTop: 17 },
  loadingTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 18, marginTop: 11 },
  loadingText: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 13, marginTop: 5, textAlign: "center" },
  errorIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 24, height: 56, justifyContent: "center", width: 56 },
  errorTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 19, marginTop: 15 },
  errorText: { color: "#596574", fontFamily: FONTS.regular, fontSize: 13, lineHeight: 19, marginTop: 8, textAlign: "center" },
  errorHint: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, marginTop: 12, maxWidth: 310, textAlign: "center" },
  retryButton: { alignItems: "center", backgroundColor: COLORS.navy, borderRadius: 10, flexDirection: "row", gap: 8, marginTop: 20, minHeight: 48, paddingHorizontal: 18 },
  retryText: { color: "#ffffff", fontFamily: FONTS.semibold, fontSize: 14 },
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
