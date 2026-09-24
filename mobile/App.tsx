import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import {
  PublicSans_400Regular,
  PublicSans_500Medium,
  PublicSans_600SemiBold,
  PublicSans_700Bold,
  useFonts,
} from "@expo-google-fonts/public-sans";
import { useEffect, useState } from "react";
import MapView, { Marker, Polyline, type Region } from "react-native-maps";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  getRoute,
  getRoutes,
  getDepartures,
  getRouteMap,
  getLatestTransportImport,
  getStopRoutes,
  getStops,
  type TransportDeparture,
  type TransportImportStatus,
  type TransportRouteMap,
  type TransportRoute,
  type TransportRouteDetails,
  type TransportStop,
} from "./src/api/transport";
import {
  getAccessibleBuildings,
  getLatestOpenDataDatasets,
  type AccessibleBuilding,
  type AccessibleBuildingList,
  type OpenDataDatasetList,
} from "./src/api/cityServices";

type ScheduleView = {
  route: TransportRouteDetails;
  stop: TransportStop;
  departures: TransportDeparture[];
  date: string;
};

type MapScreen = {
  route: TransportRouteDetails;
  map: TransportRouteMap;
};

type StopScreen = {
  stop: TransportStop;
  routes: TransportRoute[];
};

type CityService = {
  id: "announcements" | "accessibility" | "parking" | "silence";
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  sourceLabel: string;
  sourceUrl?: string;
  notice?: string;
};

type RootTab = "services" | "transport" | "notifications" | "profile";

const CITY_SERVICES: CityService[] = [
  {
    id: "announcements",
    icon: "megaphone-outline",
    title: "Події й оголошення",
    description: "Новини, анонси та офіційні повідомлення міської ради.",
    sourceLabel: "Відкрити офіційний сайт міської ради",
    sourceUrl: "https://rada-uzhgorod.gov.ua/",
    notice: "Стрічку не копіюємо в застосунок, щоб не показувати застарілі або неперевірені повідомлення.",
  },
  {
    id: "accessibility",
    icon: "accessibility-outline",
    title: "Доступне місто",
    description: "Реєстр будівель, щодо яких місто проводило моніторинг доступності.",
    sourceLabel: "Відкрити набір відкритих даних",
    sourceUrl: "https://data.rada-uzhgorod.gov.ua/dataset/96934681-c934-4ae3-a099-448d850620d5",
    notice: "Дані публікує міська рада за ліцензією CC BY 4.0. Наявність у реєстрі не гарантує конкретний рівень доступності, тому перед поїздкою звіряйте інформацію на порталі.",
  },
  {
    id: "parking",
    icon: "car-outline",
    title: "Паркування",
    description: "Правила паркування, інформація від інспекторів і пошук постанови.",
    sourceLabel: "Перейти до офіційного сервісу",
    sourceUrl: "https://pdr.rada-uzhgorod.gov.ua/",
    notice: "Оплату, штрафи та дані банківських карток застосунок не обробляє — це лише перехід до офіційного сервісу.",
  },
  {
    id: "silence",
    icon: "time-outline",
    title: "Хвилина мовчання",
    description: "Щодня о 09:00 вшановуємо полеглих захисників і захисниць України.",
    sourceLabel: "Пам’ятати разом",
    notice: "Це тихе нагадування на екрані. Воно не надсилає push-сповіщень і не є екстреним повідомленням.",
  },
];

const PARKING_PORTAL_URL = "https://pdr.rada-uzhgorod.gov.ua/";
const PARKING_EVACUATION_URL = "https://pdr.rada-uzhgorod.gov.ua/evacuation/";
const PARKING_INSPECTOR_URL = "https://pdr.rada-uzhgorod.gov.ua/inspector/";
const PARKING_DATASET_URL = "https://data.rada-uzhgorod.gov.ua/dataset/69463bbd-3985-45cf-8966-a35d709176a3";

const COLORS = {
  navy: "#123a63",
  navyDark: "#002446",
  mist: "#f8f9ff",
  blueSurface: "#eef4ff",
  blueSoft: "#e4efff",
  ink: "#0f1d2a",
  muted: "#64748b",
  border: "#e2e8f0",
  gold: "#e5ae2d",
  green: "#3d6836",
};

const FONTS = {
  regular: "PublicSans_400Regular",
  medium: "PublicSans_500Medium",
  semibold: "PublicSans_600SemiBold",
  bold: "PublicSans_700Bold",
};

function CivicHeader() {
  return (
    <View style={styles.civicHeader}>
      <View style={styles.brandGroup}>
        <View style={styles.brandMark}>
          <Ionicons name="business-outline" size={19} color={COLORS.navy} />
        </View>
        <View>
          <View style={styles.brandTitleRow}>
            <Text style={styles.brandTitle}>Ужгород</Text>
            <Text style={styles.brandCountry}>UA</Text>
          </View>
          <Text style={styles.brandSubtitle}>Офіційні сервіси</Text>
        </View>
      </View>
      <View style={styles.headerProfileIcon}>
        <Ionicons name="person-outline" size={18} color="#ffffff" />
      </View>
    </View>
  );
}

function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.backLink} onPress={onPress}>
      <Ionicons name="chevron-back" size={18} color={COLORS.navyDark} />
      <Text style={styles.backLinkText}>{label}</Text>
    </Pressable>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    PublicSans_400Regular,
    PublicSans_500Medium,
    PublicSans_600SemiBold,
    PublicSans_700Bold,
  });
  const [section, setSection] = useState<"hub" | "transport">("hub");
  const [activeTab, setActiveTab] = useState<RootTab>("services");
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

  function openTransportHub() {
    setSelectedService(null);
    setActiveTab("transport");
    setSection("transport");
    setLoading(true);
  }

  function navigateToTab(tab: RootTab) {
    if (tab === "transport") {
      openTransportHub();
      return;
    }
    setSelectedService(null);
    setSection("hub");
    setActiveTab(tab);
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
        setRoutes(foundRoutes);
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
      setSelectedStop({ stop, routes: await getStopRoutes(stop.id) });
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

  async function openMap(route: TransportRouteDetails) {
    setLoading(true);
    setError(null);
    try {
      const map = routeMapPreview?.routeId === route.id ? routeMapPreview : await getRouteMap(route.id);
      setMapScreen({ route, map });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Невідома помилка");
    } finally {
      setLoading(false);
    }
  }

  if (section === "hub") {
    if (selectedService) {
      if (selectedService.id === "accessibility") {
        return <AccessibilityBuildingsScreen onBack={() => setSelectedService(null)} />;
      }
      if (selectedService.id === "parking") {
        return <ParkingScreen onBack={() => setSelectedService(null)} />;
      }
      return <CityServiceDetails service={selectedService} onBack={() => setSelectedService(null)} />;
    }
    if (activeTab === "notifications") {
      return <NewsScreen onChangeTab={navigateToTab} />;
    }
    if (activeTab === "profile") {
      return <ProfileScreen onChangeTab={navigateToTab} />;
    }
    return <CityServicesHub onOpenTransport={openTransportHub} onOpenService={setSelectedService} onChangeTab={navigateToTab} />;
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
      onBack={() => {
        setSchedule(null);
        setMapScreen(null);
        setRouteMapPreview(null);
        setSelectedRoute(null);
      }}
      onSelectStop={(stop) => void openSchedule(selectedRoute, stop)}
      onOpenMap={() => void openMap(selectedRoute)}
    />;
  }

  if (selectedStop) {
    return <StopDetails
      stopScreen={selectedStop}
      onBack={() => setSelectedStop(null)}
      onOpenRoute={(route) => void openRoute(route)}
    />;
  }

  if (showDataSources) {
    return <DataSourcesScreen onBack={() => setShowDataSources(false)} />;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <CivicHeader />
      <BackLink label="До сервісів" onPress={() => navigateToTab("services")} />
      <View style={styles.transportPageTitleRow}>
        <View>
          <Text style={styles.transportPageTitle}>Громадський транспорт</Text>
          <Text style={styles.transportPageDescription}>Офіційні маршрути та плановий графік руху містом.</Text>
        </View>
        <View style={styles.transportPlanMark}>
          <View style={styles.eyebrowDot} />
          <Text style={styles.transportPlanMarkText}>Планові дані</Text>
        </View>
      </View>
      <View style={styles.transportSourceLine}>
        <Ionicons name="information-circle-outline" size={16} color={COLORS.green} />
        <Text style={styles.transportSourceText}>Розклад і схеми з офіційного GTFS. Живі GPS-позиції недоступні.</Text>
      </View>
      <Pressable style={styles.dataSourcesInlineLink} onPress={() => setShowDataSources(true)}>
        <Text style={styles.dataSourcesInlineLinkText}>Переглянути джерела даних</Text>
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
          style={[styles.searchMode, searchMode === "routes" && styles.searchModeActive]}
          onPress={() => setSearchMode("routes")}
        >
          <Text style={[styles.searchModeText, searchMode === "routes" && styles.searchModeTextActive]}>Маршрути</Text>
        </Pressable>
        <Pressable
          style={[styles.searchMode, searchMode === "stops" && styles.searchModeActive]}
          onPress={() => setSearchMode("stops")}
        >
          <Text style={[styles.searchModeText, searchMode === "stops" && styles.searchModeTextActive]}>Зупинки</Text>
        </Pressable>
      </View>
      {searchMode === "routes" ? (
        <FlatList
          data={routes}
          keyExtractor={(route) => route.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable style={styles.routeCard} onPress={() => void openRoute(item)}>
              <View style={styles.routeBadge}>
                <Text style={styles.routeBadgeText}>{item.routeNumber}</Text>
              </View>
              <Text style={styles.routeName}>{item.name}</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Маршрутів поки немає.</Text>}
        />
      ) : (
        <FlatList
          data={stops}
          keyExtractor={(stop) => stop.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable style={styles.stopCard} onPress={() => void openStop(item)}>
              <View style={styles.stopCardText}>
                <Text style={styles.stopCardName}>{item.name}</Text>
                <Text style={styles.stopCardAction}>Переглянути маршрути</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Зупинок не знайдено.</Text>}
        />
      )}
      <BottomNavigation activeTab="transport" onChangeTab={navigateToTab} />
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
        <CivicHeader />
        <View style={styles.pageIntro}>
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowDot} />
            <Text style={styles.eyebrow}>Офіційні дані міської ради</Text>
          </View>
          <Text style={styles.pageTitle}>Міські сервіси</Text>
          <Text style={styles.pageDescription}>Зручний доступ до щоденних міських розкладів, реєстрів та офіційних довідок громади.</Text>
        </View>

        <Pressable style={styles.transportHero} onPress={onOpenTransport}>
          <View style={styles.transportHeroTop}>
            <View style={styles.transportHeroIcon}>
              <Ionicons name="bus-outline" size={22} color={COLORS.gold} />
            </View>
            <View style={styles.transportHeroBadge}>
              <Text style={styles.transportHeroBadgeText}>ПЛАНОВИЙ РОЗКЛАД</Text>
            </View>
          </View>
          <Text style={styles.transportHeroTitle}>Громадський транспорт</Text>
          <Text style={styles.transportHeroText}>Маршрути комунальних автобусів, зупинки та плановий графік руху містом.</Text>
          <View style={styles.transportHeroButton}>
            <Text style={styles.transportHeroButtonText}>Переглянути розклад</Text>
            <Ionicons name="arrow-forward" size={19} color={COLORS.navyDark} />
          </View>
        </Pressable>

        <View style={styles.riverNote}>
          <View style={styles.riverNoteIcon}>
            <Ionicons name="water-outline" size={21} color={COLORS.navy} />
          </View>
          <View style={styles.riverNoteText}>
            <Text style={styles.riverNoteEyebrow}>Міський простір</Text>
            <Text style={styles.riverNoteTitle}>Набережна Незалежності</Text>
            <Text style={styles.riverNoteDescription}>Планові графіки та відкриті реєстри</Text>
          </View>
        </View>

        <View style={styles.sectionHeadingRow}>
          <Text style={styles.sectionLabel}>Муніципальні розділи</Text>
          <View style={styles.officialMark}>
            <Ionicons name="checkmark-circle-outline" size={14} color={COLORS.green} />
            <Text style={styles.officialMarkText}>Офіційні джерела</Text>
          </View>
        </View>
        {CITY_SERVICES.map((service) => (
          <Pressable key={service.id} style={styles.serviceRow} onPress={() => onOpenService(service)}>
            <View style={styles.serviceRowIcon}>
              <Ionicons name={service.icon} size={22} color={COLORS.navy} />
            </View>
            <View style={styles.serviceRowText}>
              <Text style={styles.serviceRowTitle}>{service.title}</Text>
              <Text numberOfLines={2} style={styles.serviceRowDescription}>{service.description}</Text>
            </View>
            {service.id === "announcements" || service.id === "silence" ? <View style={styles.serviceGoldDot} /> : null}
            <Ionicons name="chevron-forward" size={19} color={COLORS.muted} />
          </Pressable>
        ))}

        <Pressable style={styles.openDataRow} onPress={() => onChangeTab("notifications")}>
          <View style={styles.serviceRowIcon}>
            <Ionicons name="open-outline" size={21} color={COLORS.navy} />
          </View>
          <View style={styles.serviceRowText}>
            <Text style={styles.serviceRowTitle}>Портал відкритих даних</Text>
            <Text style={styles.serviceRowDescription}>Офіційні публічні набори міської ради</Text>
          </View>
          <Ionicons name="open-outline" size={19} color={COLORS.muted} />
        </Pressable>

        <View style={styles.hubFooter}>
          <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.muted} />
          <Text style={styles.hubFootnote}>Посилання ведуть лише на офіційні міські сервіси й відкриті дані. Без платежів та екстрених сповіщень.</Text>
        </View>
      </ScrollView>
      <BottomNavigation activeTab="services" onChangeTab={onChangeTab} />
    </SafeAreaView>
  );
}

function HomeScreen({
  onOpenTransport,
  onOpenService,
  onChangeTab,
}: {
  onOpenTransport: () => void;
  onOpenService: (id: CityService["id"]) => void;
  onChangeTab: (tab: RootTab) => void;
}) {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.homeContent}>
        <Text style={styles.cityKicker}>УЖГОРОД</Text>
        <Text style={styles.homeTitle}>Цифрові сервіси</Text>
        <Text style={styles.homeIntro}>Зручні міські справи, офіційні дані та перевірені переходи в одному місці.</Text>
        <View style={styles.statusBanner}>
          <Text style={styles.statusDot}>●</Text>
          <Text style={styles.statusText}>Лише офіційні сервіси та відкриті дані</Text>
        </View>
        <Pressable style={styles.homeTransportCard} onPress={onOpenTransport}>
          <Text style={styles.homeTransportKicker}>ГРОМАДСЬКИЙ ТРАНСПОРТ</Text>
          <Text style={styles.homeTransportTitle}>Маршрути й плановий розклад</Text>
          <Text style={styles.homeTransportText}>Шукайте маршрут або зупинку, дивіться схему та заплановані відправлення.</Text>
          <Text style={styles.homeTransportAction}>Відкрити транспорт →</Text>
        </Pressable>
        <Text style={styles.sectionLabel}>Сервіси поруч</Text>
        <View style={styles.homeFeatureGrid}>
          <Pressable style={styles.homeFeatureCard} onPress={() => onOpenService("accessibility")}>
            <Text style={styles.homeFeatureIcon}>◌</Text>
            <Text style={styles.homeFeatureTitle}>Доступне місто</Text>
            <Text style={styles.homeFeatureText}>Реєстр перевірених будівель</Text>
            <Text style={styles.homeFeatureAction}>Переглянути →</Text>
          </Pressable>
          <Pressable style={styles.homeFeatureCard} onPress={() => onOpenService("silence")}>
            <Text style={styles.homeFeatureIcon}>◐</Text>
            <Text style={styles.homeFeatureTitle}>Хвилина мовчання</Text>
            <Text style={styles.homeFeatureText}>Щодня о 09:00</Text>
            <Text style={styles.homeFeatureAction}>Пам’ятати разом →</Text>
          </Pressable>
        </View>
        <Text style={styles.sectionLabel}>Швидкий доступ</Text>
        <Pressable style={styles.homeRow} onPress={() => onChangeTab("services")}>
          <Text style={styles.homeRowIcon}>▦</Text>
          <View style={styles.homeRowText}><Text style={styles.homeRowTitle}>Міські сервіси</Text><Text style={styles.homeRowDescription}>Доступність, паркування, хвилина мовчання</Text></View>
          <Text style={styles.homeChevron}>›</Text>
        </Pressable>
        <Pressable style={styles.homeRow} onPress={() => onChangeTab("notifications")}>
          <Text style={styles.homeRowIcon}>▤</Text>
          <View style={styles.homeRowText}><Text style={styles.homeRowTitle}>Новини та оголошення</Text><Text style={styles.homeRowDescription}>Офіційна стрічка міської ради</Text></View>
          <Text style={styles.homeChevron}>›</Text>
        </Pressable>
      </ScrollView>
      <BottomNavigation activeTab="services" onChangeTab={onChangeTab} />
    </SafeAreaView>
  );
}

function NewsScreen({ onChangeTab }: { onChangeTab: (tab: RootTab) => void }) {
  const [data, setData] = useState<OpenDataDatasetList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadLatestDatasets();
  }, []);

  async function loadLatestDatasets() {
    setLoading(true);
    setError(null);
    try {
      setData(await getLatestOpenDataDatasets());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Невідома помилка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.simpleTabContent}>
        <CivicHeader />
        <View style={styles.pageIntro}>
          <View style={styles.eyebrowRow}>
            <View style={[styles.eyebrowDot, styles.eyebrowDotGreen]} />
            <Text style={styles.eyebrow}>Офіційний вісник</Text>
          </View>
          <Text style={styles.pageTitle}>Події та оголошення</Text>
          <Text style={styles.pageDescription}>Планові повідомлення міських служб і нові набори офіційних відкритих даних.</Text>
        </View>
        <Pressable style={styles.officialNewsButton} onPress={() => void openOfficialLink("https://rada-uzhgorod.gov.ua/")}>
          <Ionicons name="megaphone-outline" size={20} color="#ffffff" />
          <Text style={styles.officialNewsButtonText}>Відкрити офіційну стрічку</Text>
          <Ionicons name="open-outline" size={18} color="#ffffff" />
        </Pressable>
        <View style={styles.sectionHeadingRow}>
          <Text style={styles.sectionLabel}>Оновлення відкритих даних</Text>
          <Ionicons name="document-text-outline" size={17} color={COLORS.navy} />
        </View>
        <Text style={styles.newsSectionIntro}>Назви та дати оновлення надходять із міського порталу. Повний опис і файли залишаються в першоджерелі.</Text>
        {loading && <ActivityIndicator style={styles.inlineLoader} color="#123a63" />}
        {error && (
          <View style={styles.inlineError}>
            <Text style={styles.inlineErrorText}>{error}</Text>
            <Pressable onPress={() => void loadLatestDatasets()}>
              <Text style={styles.inlineRetry}>Спробувати ще раз</Text>
            </Pressable>
          </View>
        )}
        {data?.stale && <Text style={styles.staleData}>Показуємо збережену версію даних — перевіряємо оновлення.</Text>}
        {data?.datasets.map((dataset) => (
          <Pressable key={dataset.sourceUrl} style={styles.newsDatasetCard} onPress={() => void openOfficialLink(dataset.sourceUrl)}>
            <Text style={styles.newsDatasetTitle}>{dataset.title}</Text>
            <Text numberOfLines={3} style={styles.newsDatasetDescription}>{dataset.description}</Text>
            <View style={styles.newsDatasetFooter}>
              <Text style={styles.newsDatasetMeta}>{dataset.updatedAt ? `Оновлено ${formatUpdatedAt(dataset.updatedAt)}` : "Дата оновлення не вказана"}</Text>
              <Ionicons name="open-outline" size={18} color={COLORS.navy} />
            </View>
          </Pressable>
        ))}
        {!loading && !error && data?.datasets.length === 0 && <Text style={styles.empty}>Оновлень поки немає.</Text>}
        <View style={styles.sourceTransparencyCard}>
          <Ionicons name="information-circle-outline" size={20} color={COLORS.navy} />
          <Text style={styles.sourceTransparencyText}>Не дублюємо повні тексти новин, щоб користувач завжди бачив оригінальну публікацію та актуальний контекст.</Text>
        </View>
      </ScrollView>
      <BottomNavigation activeTab="notifications" onChangeTab={onChangeTab} />
    </SafeAreaView>
  );
}

function ProfileScreen({ onChangeTab }: { onChangeTab: (tab: RootTab) => void }) {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.simpleTabContent}>
        <CivicHeader />
        <View style={styles.profileIntroCard}>
          <View style={styles.profileIntroIcon}>
            <Ionicons name="person-outline" size={28} color={COLORS.navy} />
          </View>
          <View style={styles.profileIntroText}>
            <Text style={styles.pageTitle}>Ваш цифровий простір</Text>
            <Text style={styles.profileIntroDescription}>Базові міські сервіси доступні без реєстрації та без персонального профілю.</Text>
          </View>
        </View>

        <Text style={styles.profileSectionTitle}>Доступність і дані</Text>
        <View style={styles.profileGroup}>
          <ProfileRow icon="language-outline" title="Мова застосунку" value="Українська" />
          <ProfileRow icon="accessibility-outline" title="Доступність" value="Налаштування екрана" />
          <ProfileRow icon="shield-checkmark-outline" title="Приватність і дані" value="Без реєстрації" />
        </View>

        <Text style={styles.profileSectionTitle}>Міська інформація та підтримка</Text>
        <View style={styles.profileGroup}>
          <ProfileRow icon="open-outline" title="Офіційний сайт міської ради" onPress={() => void openOfficialLink("https://rada-uzhgorod.gov.ua/")} />
          <ProfileRow icon="open-outline" title="Портал відкритих даних" onPress={() => void openOfficialLink("https://data.rada-uzhgorod.gov.ua/")} />
          <ProfileRow icon="information-circle-outline" title="Про застосунок" value="Версія 1.0" />
        </View>

        <View style={styles.profilePrivacyNote}>
          <Ionicons name="lock-closed-outline" size={20} color={COLORS.navy} />
          <Text style={styles.profilePrivacyText}>Застосунок не збирає номер авто, платіжні дані чи персональну інформацію для базових сервісів.</Text>
        </View>
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
    <Pressable disabled={!onPress} style={styles.profileRow} onPress={onPress}>
      <View style={styles.profileRowIcon}>
        <Ionicons name={icon} size={20} color={COLORS.navy} />
      </View>
      <View style={styles.profileRowText}>
        <Text style={styles.profileRowTitle}>{title}</Text>
        {value ? <Text style={styles.profileRowValue}>{value}</Text> : null}
      </View>
      <Ionicons name={onPress ? "open-outline" : "chevron-forward"} size={18} color={COLORS.muted} />
    </Pressable>
  );
}

function BottomNavigation({ activeTab, onChangeTab }: { activeTab: RootTab; onChangeTab: (tab: RootTab) => void }) {
  const items: Array<{ id: RootTab; icon: keyof typeof Ionicons.glyphMap; label: string }> = [
    { id: "services", icon: "grid-outline", label: "Сервіси" },
    { id: "transport", icon: "bus-outline", label: "Транспорт" },
    { id: "notifications", icon: "notifications-outline", label: "Повідомлення" },
    { id: "profile", icon: "person-outline", label: "Профіль" },
  ];
  return <View style={styles.bottomNavigation}>{items.map((item) => (
    <Pressable key={item.id} style={styles.tabButton} onPress={() => onChangeTab(item.id)}>
      <Ionicons name={item.icon} size={21} color={activeTab === item.id ? "#123a63" : "#64748b"} />
      <Text style={[styles.tabLabel, activeTab === item.id && styles.tabActive]}>{item.label}</Text>
    </Pressable>
  ))}</View>;
}

function AccessibilityBuildingsScreen({ onBack }: { onBack: () => void }) {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<AccessibleBuildingList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    <SafeAreaView style={styles.screen}>
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
      <Text style={styles.accessibilityBuildingName}>{building.name}</Text>
      <Text style={styles.accessibilityAddress}>{building.address}</Text>
      {monitoredAt && <Text style={styles.accessibilityDate}>Моніторинг: {monitoredAt}</Text>}
    </View>
  );
}

function ParkingScreen({ onBack }: { onBack: () => void }) {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <CivicHeader />
      <BackLink label="До міських сервісів" onPress={onBack} />
      <ScrollView contentContainerStyle={styles.parkingContent}>
        <View style={styles.detailIntro}>
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowDot} />
            <Text style={styles.eyebrow}>Офіційні міські сервіси</Text>
          </View>
          <Text style={styles.detailTitle}>Паркування в місті</Text>
          <Text style={styles.detailDescription}>Довідка для водіїв і посилання лише на офіційні сервіси міської ради.</Text>
        </View>

        <Pressable style={styles.parkingActionCard} onPress={() => void openOfficialLink(PARKING_PORTAL_URL)}>
          <View style={styles.parkingActionHeading}>
            <View style={styles.parkingActionIcon}><Ionicons name="document-text-outline" size={20} color={COLORS.navy} /></View>
            <Text style={styles.parkingActionTitle}>Пошук постанови</Text>
            <Ionicons name="open-outline" size={18} color={COLORS.muted} />
          </View>
          <Text style={styles.parkingActionText}>Перевірити деталі постанови та фото можна лише в офіційному сервісі міської ради.</Text>
          <Text style={styles.parkingActionLink}>Перейти до сервісу</Text>
        </Pressable>

        <Pressable style={styles.parkingActionCard} onPress={() => void openOfficialLink(PARKING_EVACUATION_URL)}>
          <View style={styles.parkingActionHeading}>
            <View style={styles.parkingActionIcon}><Ionicons name="car-outline" size={20} color={COLORS.navy} /></View>
            <Text style={styles.parkingActionTitle}>Авто евакуювали?</Text>
            <Ionicons name="open-outline" size={18} color={COLORS.muted} />
          </View>
          <Text style={styles.parkingActionText}>Офіційний порядок дій, інформація про зберігання та контакти.</Text>
          <Text style={styles.parkingActionLink}>Відкрити інструкцію</Text>
        </Pressable>

        <Pressable style={styles.parkingActionCard} onPress={() => void openOfficialLink(PARKING_INSPECTOR_URL)}>
          <View style={styles.parkingActionHeading}>
            <View style={styles.parkingActionIcon}><Ionicons name="call-outline" size={20} color={COLORS.navy} /></View>
            <Text style={styles.parkingActionTitle}>Контакти інспекторів</Text>
            <Ionicons name="open-outline" size={18} color={COLORS.muted} />
          </View>
          <Text style={styles.parkingActionText}>Повноваження, контакти та офіційні роз’яснення від міста.</Text>
          <Text style={styles.parkingActionLink}>Відкрити контакти</Text>
        </Pressable>

        <View style={styles.parkingUnavailable}>
          <Text style={styles.parkingUnavailableTitle}>Майданчики та тарифи</Text>
          <Text style={styles.parkingUnavailableText}>Поки не показуємо: міський набір даних про майданчики паркування проходить модерацію. Так ми не введемо водіїв в оману неактуальними адресами чи тарифами.</Text>
          <Pressable onPress={() => void openOfficialLink(PARKING_DATASET_URL)}>
            <Text style={styles.parkingUnavailableLink}>Перевірити стан набору</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function CityServiceDetails({ service, onBack }: { service: CityService; onBack: () => void }) {
  const isSilence = service.id === "silence";
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <CivicHeader />
      <BackLink label="До міських сервісів" onPress={onBack} />
      <ScrollView contentContainerStyle={styles.serviceDetailsContent}>
        <View style={styles.serviceDetailsIcon}>
          <Ionicons name={service.icon} size={31} color={COLORS.navy} />
        </View>
        <Text style={styles.serviceDetailsTitle}>{service.title}</Text>
        <Text style={styles.serviceDetailsDescription}>{service.description}</Text>
        {isSilence && <SilencePanel />}
        <View style={styles.serviceNotice}>
          <Text style={styles.serviceNoticeTitle}>{isSilence ? "Як це працює" : "Важливо"}</Text>
          <Text style={styles.serviceNoticeText}>{service.notice}</Text>
        </View>
        {service.sourceUrl && (
          <Pressable style={styles.externalButton} onPress={() => void openOfficialLink(service.sourceUrl!)}>
            <Text style={styles.externalButtonText}>{service.sourceLabel} ↗</Text>
          </Pressable>
        )}
        {!isSilence && <Text style={styles.externalHint}>Відкриється браузер. Вміст і подальші дії надає відповідний офіційний сайт.</Text>}
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
  return (
    <SafeAreaView style={styles.screen}>
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
          <Text style={styles.sourceText}>Поки не показуються: опублікований міський GPS-ресурс тимчасово має обмежений доступ.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StopDetails({
  stopScreen,
  onBack,
  onOpenRoute,
}: {
  stopScreen: StopScreen;
  onBack: () => void;
  onOpenRoute: (route: TransportRoute) => void;
}) {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <CivicHeader />
      <BackLink label="До зупинок" onPress={onBack} />
      <Text style={styles.stopDetailsTitle}>{stopScreen.stop.name}</Text>
      <Text style={styles.stopDetailsSubtitle}>Маршрути, що проходять через цю зупинку</Text>
      <FlatList
        data={stopScreen.routes}
        keyExtractor={(route) => route.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable style={styles.routeCard} onPress={() => onOpenRoute(item)}>
            <View style={styles.routeBadge}>
              <Text style={styles.routeBadgeText}>{item.routeNumber}</Text>
            </View>
            <Text style={styles.routeName}>{item.name}</Text>
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
  onBack,
  onSelectStop,
  onOpenMap,
}: {
  route: TransportRouteDetails;
  map: TransportRouteMap | null;
  onBack: () => void;
  onSelectStop: (stop: TransportStop) => void;
  onOpenMap: () => void;
}) {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <CivicHeader />
      <BackLink label="Усі маршрути" onPress={onBack} />
      <View style={styles.routeHeader}>
        <View style={styles.routeBadge}>
          <Text style={styles.routeBadgeText}>{route.routeNumber}</Text>
        </View>
        <Text style={styles.routeName}>{route.name}</Text>
      </View>
      {map && (
        <Pressable style={styles.routeMapPreview} onPress={onOpenMap}>
          <MapView pointerEvents="none" style={styles.routeMapPreviewMap} initialRegion={getInitialRegion(map)}>
            {map.variants.map((variant, index) => (
              <Polyline
                key={variant.id}
                coordinates={variant.shape}
                strokeColor={MAP_COLORS[index % MAP_COLORS.length]}
                strokeWidth={4}
              />
            ))}
          </MapView>
          <View style={styles.routeMapPreviewLabel}>
            <Text style={styles.routeMapPreviewLabelText}>Схема маршруту · розгорнути</Text>
          </View>
        </Pressable>
      )}
      <Pressable style={styles.mapButton} onPress={onOpenMap}>
        <Text style={styles.mapButtonText}>{map ? "Відкрити карту маршруту" : "Показати маршрут на карті"}</Text>
      </Pressable>
      <Text style={styles.hint}>Натисніть зупинку, щоб переглянути плановий розклад на сьогодні.</Text>
      <ScrollView contentContainerStyle={styles.detailsList}>
        {route.variants.map((variant) => (
          <View key={variant.id} style={styles.variant}>
            <Text style={styles.variantTitle}>{variant.name || "Напрямок руху"}</Text>
            {variant.stops.map((stop, index) => (
              <Pressable key={stop.id} style={styles.stopRow} onPress={() => onSelectStop(stop)}>
                <Text style={styles.stopNumber}>{index + 1}</Text>
                <Text style={styles.stopName}>{stop.name}</Text>
                <Text style={styles.stopSchedule}>Розклад</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function RouteMapScreen({ mapScreen, onBack }: { mapScreen: MapScreen; onBack: () => void }) {
  const region = getInitialRegion(mapScreen.map);
  return (
    <SafeAreaView style={styles.mapScreen}>
      <StatusBar style="dark" />
      <View style={styles.mapHeader}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>← До маршруту {mapScreen.route.routeNumber}</Text>
        </Pressable>
        <Text style={styles.mapTitle}>{mapScreen.route.name}</Text>
        <Text style={styles.mapHint}>Лінії — напрямки руху, точки — зупинки</Text>
      </View>
      <MapView style={styles.map} initialRegion={region}>
        {mapScreen.map.variants.map((variant, index) => (
          <Polyline
            key={variant.id}
            coordinates={variant.shape}
            strokeColor={MAP_COLORS[index % MAP_COLORS.length]}
            strokeWidth={5}
          />
        ))}
        {mapScreen.map.stops.map((stop) => (
          <Marker
            key={stop.id}
            coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
            title={stop.name}
            description="Зупинка громадського транспорту"
            pinColor="#123a63"
          />
        ))}
      </MapView>
    </SafeAreaView>
  );
}

const MAP_COLORS = ["#123a63", "#e5ae2d", "#3d6836", "#9f1239"];

function getInitialRegion(map: TransportRouteMap): Region {
  const points = [...map.stops, ...map.variants.flatMap((variant) => variant.shape)];
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

function ScheduleDetails({
  schedule,
  onBack,
  onChangeDate,
}: {
  schedule: ScheduleView;
  onBack: () => void;
  onChangeDate: (date: string) => void;
}) {
  const readableDate = new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long" })
    .format(new Date(`${schedule.date}T12:00:00`));
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <CivicHeader />
      <BackLink label={`До зупинок маршруту ${schedule.route.routeNumber}`} onPress={onBack} />
      <Text style={styles.scheduleTitle}>{schedule.stop.name}</Text>
      <View style={styles.dateControls}>
        <Pressable style={styles.dateButton} onPress={() => onChangeDate(addDays(schedule.date, -1))}>
          <Text style={styles.dateButtonText}>←</Text>
        </Pressable>
        <View>
          <Text style={styles.scheduleSubtitle}>Планові відправлення на</Text>
          <Text style={styles.selectedDate}>{readableDate}</Text>
        </View>
        <Pressable style={styles.dateButton} onPress={() => onChangeDate(addDays(schedule.date, 1))}>
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

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("uk-UA", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.mist, paddingHorizontal: 16 },
  centered: { alignItems: "center", justifyContent: "center" },
  civicHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 64, paddingTop: 6 },
  brandGroup: { alignItems: "center", flexDirection: "row", gap: 9 },
  brandMark: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 10, height: 38, justifyContent: "center", width: 38 },
  brandTitleRow: { alignItems: "center", flexDirection: "row", gap: 6 },
  brandTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 17, lineHeight: 20 },
  brandCountry: { backgroundColor: "#dfe9f8", borderRadius: 6, color: COLORS.muted, fontFamily: FONTS.semibold, fontSize: 10, overflow: "hidden", paddingHorizontal: 5, paddingVertical: 2 },
  brandSubtitle: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 10, marginTop: 1 },
  headerProfileIcon: { alignItems: "center", backgroundColor: COLORS.navyDark, borderRadius: 18, height: 34, justifyContent: "center", width: 34 },
  backLink: { alignItems: "center", flexDirection: "row", gap: 2, marginTop: 5, minHeight: 32 },
  backLinkText: { color: COLORS.navyDark, fontFamily: FONTS.medium, fontSize: 13 },
  pageIntro: { marginTop: 15 },
  eyebrowRow: { alignItems: "center", flexDirection: "row", gap: 6 },
  eyebrowDot: { backgroundColor: COLORS.gold, borderRadius: 4, height: 7, width: 7 },
  eyebrowDotGreen: { backgroundColor: COLORS.green },
  eyebrow: { color: COLORS.muted, fontFamily: FONTS.semibold, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase" },
  pageTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 26, letterSpacing: -0.4, lineHeight: 32, marginTop: 7 },
  pageDescription: { color: "#43474e", fontFamily: FONTS.regular, fontSize: 14, lineHeight: 21, marginTop: 6 },
  transportHero: { backgroundColor: COLORS.navy, borderRadius: 16, marginTop: 20, overflow: "hidden", padding: 17 },
  transportHeroTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  transportHeroIcon: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 9, height: 40, justifyContent: "center", width: 40 },
  transportHeroBadge: { backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(229,174,45,0.35)", borderRadius: 5, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  transportHeroBadgeText: { color: "#f7be3d", fontFamily: FONTS.semibold, fontSize: 10, letterSpacing: 0.6 },
  transportHeroTitle: { color: "#ffffff", fontFamily: FONTS.bold, fontSize: 20, lineHeight: 25, marginTop: 17 },
  transportHeroText: { color: "#d3e4ff", fontFamily: FONTS.regular, fontSize: 13, lineHeight: 19, marginTop: 6 },
  transportHeroButton: { alignItems: "center", backgroundColor: "#ffffff", borderRadius: 9, flexDirection: "row", justifyContent: "space-between", marginTop: 18, minHeight: 48, paddingHorizontal: 14 },
  transportHeroButtonText: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 14 },
  riverNote: { alignItems: "center", backgroundColor: "#e7eeff", borderRadius: 14, flexDirection: "row", gap: 11, marginTop: 14, padding: 12 },
  riverNoteIcon: { alignItems: "center", backgroundColor: "#d3e4ff", borderRadius: 9, height: 42, justifyContent: "center", width: 42 },
  riverNoteText: { flex: 1 },
  riverNoteEyebrow: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 10 },
  riverNoteTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 14, marginTop: 2 },
  riverNoteDescription: { color: "#43474e", fontFamily: FONTS.regular, fontSize: 12, marginTop: 3 },
  sectionHeadingRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 24 },
  officialMark: { alignItems: "center", flexDirection: "row", gap: 4 },
  officialMarkText: { color: COLORS.green, fontFamily: FONTS.medium, fontSize: 11 },
  serviceRow: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 12, marginTop: 9, minHeight: 82, padding: 12 },
  serviceRowIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 9, height: 40, justifyContent: "center", width: 40 },
  serviceRowText: { flex: 1 },
  serviceRowTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontSize: 15, lineHeight: 20 },
  serviceRowDescription: { color: "#596574", fontFamily: FONTS.regular, fontSize: 12, lineHeight: 17, marginTop: 3 },
  serviceGoldDot: { backgroundColor: COLORS.gold, borderRadius: 4, height: 7, width: 7 },
  openDataRow: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 12, marginTop: 9, minHeight: 82, padding: 12 },
  hubFooter: { alignItems: "center", gap: 7, marginHorizontal: 14, marginTop: 27, paddingBottom: 20 },
  profileIntroCard: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 16, borderWidth: 1, flexDirection: "row", gap: 14, marginTop: 18, padding: 16 },
  profileIntroIcon: { alignItems: "center", backgroundColor: "#e4efff", borderRadius: 28, height: 56, justifyContent: "center", width: 56 },
  profileIntroText: { flex: 1 },
  profileIntroDescription: { color: "#596574", fontFamily: FONTS.regular, fontSize: 13, lineHeight: 18, marginTop: 4 },
  profileSectionTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 16, marginTop: 26 },
  profileGroup: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, marginTop: 10, overflow: "hidden" },
  profileRow: { alignItems: "center", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", gap: 11, minHeight: 67, paddingHorizontal: 13 },
  profileRowIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 9, height: 36, justifyContent: "center", width: 36 },
  profileRowText: { flex: 1 },
  profileRowTitle: { color: COLORS.ink, fontFamily: FONTS.medium, fontSize: 14, lineHeight: 19 },
  profileRowValue: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 12, marginTop: 2 },
  profilePrivacyNote: { alignItems: "flex-start", backgroundColor: COLORS.blueSurface, borderRadius: 13, flexDirection: "row", gap: 10, marginTop: 24, padding: 14 },
  profilePrivacyText: { color: "#3f5269", flex: 1, fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18 },
  officialNewsButton: { alignItems: "center", backgroundColor: COLORS.navy, borderRadius: 10, flexDirection: "row", gap: 9, justifyContent: "center", marginTop: 18, minHeight: 50 },
  officialNewsButtonText: { color: "#ffffff", fontFamily: FONTS.semibold, fontSize: 14 },
  newsDatasetFooter: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 9 },
  sourceTransparencyCard: { alignItems: "flex-start", backgroundColor: COLORS.blueSurface, borderRadius: 13, flexDirection: "row", gap: 10, marginTop: 20, padding: 14 },
  sourceTransparencyText: { color: "#3f5269", flex: 1, fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18 },
  transportPageTitleRow: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  transportPageTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 22, lineHeight: 28 },
  transportPageDescription: { color: "#596574", fontFamily: FONTS.regular, fontSize: 12, lineHeight: 17, marginTop: 3, maxWidth: 235 },
  transportPlanMark: { alignItems: "center", backgroundColor: "#e8f7e4", borderRadius: 12, flexDirection: "row", gap: 5, marginTop: 3, paddingHorizontal: 8, paddingVertical: 5 },
  transportPlanMarkText: { color: COLORS.green, fontFamily: FONTS.medium, fontSize: 10 },
  transportSourceLine: { alignItems: "flex-start", backgroundColor: "#ffffff", borderColor: COLORS.border, borderLeftColor: COLORS.gold, borderLeftWidth: 3, borderRadius: 10, flexDirection: "row", gap: 8, marginTop: 15, padding: 11 },
  transportSourceText: { color: "#485768", flex: 1, fontFamily: FONTS.regular, fontSize: 12, lineHeight: 17 },
  dataSourcesInlineLink: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 2, marginTop: 8 },
  dataSourcesInlineLinkText: { color: COLORS.navy, fontFamily: FONTS.medium, fontSize: 12 },
  searchBox: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, marginTop: 14, minHeight: 48, paddingHorizontal: 12 },
  title: { color: "#071d31", fontSize: 28, fontWeight: "700", marginTop: 20 },
  hubContent: { flexGrow: 1, paddingBottom: 22 },
  homeContent: { flexGrow: 1, paddingBottom: 28 },
  simpleTabContent: { flexGrow: 1, paddingBottom: 28, paddingTop: 0 },
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
  serviceDetailsContent: { alignItems: "stretch", paddingBottom: 32, paddingTop: 16 },
  serviceDetailsIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 16, height: 58, justifyContent: "center", width: 58 },
  serviceDetailsIconText: { color: COLORS.navy, fontFamily: FONTS.bold, fontSize: 30 },
  detailTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 25, letterSpacing: -0.3, lineHeight: 31, marginTop: 7 },
  detailDescription: { color: "#596574", fontFamily: FONTS.regular, fontSize: 14, lineHeight: 21, marginTop: 6 },
  serviceDetailsTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 25, letterSpacing: -0.3, marginTop: 15 },
  serviceDetailsDescription: { color: "#596574", fontFamily: FONTS.regular, fontSize: 14, lineHeight: 21, marginTop: 6 },
  serviceNotice: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderLeftColor: COLORS.gold, borderLeftWidth: 3, borderRadius: 14, borderWidth: 1, marginTop: 20, padding: 14 },
  serviceNoticeTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 15 },
  serviceNoticeText: { color: "#596574", fontFamily: FONTS.regular, fontSize: 13, lineHeight: 19, marginTop: 6 },
  newsSectionIntro: { color: "#596574", fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, marginTop: 9 },
  newsDatasetCard: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, marginTop: 10, padding: 14 },
  newsDatasetTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontSize: 15, lineHeight: 20 },
  newsDatasetDescription: { color: "#596574", fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, marginTop: 5 },
  newsDatasetMeta: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 11 },
  newsDatasetAction: { color: "#123a63", fontSize: 14, fontWeight: "700", marginTop: 10 },
  externalButton: { alignItems: "center", backgroundColor: COLORS.navy, borderRadius: 10, marginTop: 16, minHeight: 50, padding: 15 },
  externalButtonText: { color: "#ffffff", fontFamily: FONTS.semibold, fontSize: 14 },
  externalHint: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, marginTop: 12, textAlign: "center" },
  silencePanel: { alignItems: "center", backgroundColor: COLORS.navyDark, borderRadius: 16, marginTop: 20, padding: 22 },
  silenceTime: { color: "#ffffff", fontFamily: FONTS.bold, fontSize: 40 },
  silenceTitle: { color: "#eef4ff", fontFamily: FONTS.semibold, fontSize: 14, marginTop: 8, textAlign: "center" },
  silenceCountdown: { color: "#d3e4ff", fontFamily: FONTS.regular, fontSize: 12, marginTop: 8, textAlign: "center" },
  accessibilityTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 25, marginTop: 18 },
  accessibilityIntro: { color: "#596574", fontFamily: FONTS.regular, fontSize: 14, lineHeight: 21, marginTop: 6 },
  inlineLoader: { marginTop: 12 },
  inlineError: { backgroundColor: "#fff5f4", borderColor: "#f4ceca", borderRadius: 12, borderWidth: 1, marginTop: 12, padding: 14 },
  inlineErrorText: { color: "#991b1b", fontFamily: FONTS.regular, fontSize: 13 },
  inlineRetry: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 13, marginTop: 8 },
  accessibilityList: { gap: 12, paddingBottom: 30, paddingTop: 16 },
  accessibilityCount: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 12, marginBottom: 2 },
  staleData: { color: "#795000", fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, marginBottom: 4 },
  accessibilityCard: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, padding: 14 },
  accessibilityBuildingName: { color: COLORS.ink, fontFamily: FONTS.semibold, fontSize: 15 },
  accessibilityAddress: { color: "#596574", fontFamily: FONTS.regular, fontSize: 13, lineHeight: 19, marginTop: 6 },
  accessibilityDate: { color: COLORS.navy, fontFamily: FONTS.medium, fontSize: 12, marginTop: 9 },
  accessibilityFooter: { marginTop: 8 },
  accessibilityNote: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, textAlign: "center" },
  sourceButton: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 10, flexDirection: "row", gap: 7, justifyContent: "center", marginTop: 14, minHeight: 46 },
  sourceButtonText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 13 },
  parkingContent: { gap: 10, paddingBottom: 32 },
  parkingActionCard: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, marginTop: 1, padding: 14 },
  parkingActionHeading: { alignItems: "center", flexDirection: "row", gap: 10 },
  parkingActionIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 9, height: 37, justifyContent: "center", width: 37 },
  parkingActionTitle: { color: COLORS.ink, flex: 1, fontFamily: FONTS.semibold, fontSize: 15 },
  parkingActionText: { color: "#596574", fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, marginTop: 10 },
  parkingActionLink: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 12, marginTop: 10 },
  parkingUnavailable: { backgroundColor: "#fff8e9", borderColor: "#f2dcaa", borderRadius: 14, borderWidth: 1, marginTop: 7, padding: 14 },
  parkingUnavailableTitle: { color: "#624600", fontFamily: FONTS.semibold, fontSize: 14 },
  parkingUnavailableText: { color: "#735817", fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, marginTop: 7 },
  parkingUnavailableLink: { color: "#624600", fontFamily: FONTS.semibold, fontSize: 12, marginTop: 10 },
  subtitle: { color: "#43474e", fontSize: 16, marginTop: 4 },
  dataUpdated: { color: "#5b6e80", fontSize: 13, marginTop: 6 },
  dataSourcesLink: { color: "#123a63", fontSize: 13, fontWeight: "700", marginTop: 8 },
  searchInput: { color: COLORS.ink, flex: 1, fontFamily: FONTS.regular, fontSize: 13, paddingVertical: 10 },
  searchModes: { flexDirection: "row", gap: 8, marginTop: 11 },
  searchMode: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 9, borderWidth: 1, flex: 1, minHeight: 39, justifyContent: "center" },
  searchModeActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  searchModeText: { color: "#596574", fontFamily: FONTS.medium, fontSize: 12 },
  searchModeTextActive: { color: "#ffffff", fontFamily: FONTS.semibold },
  list: { gap: 9, paddingVertical: 16 },
  routeCard: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 13, borderWidth: 1, flexDirection: "row", gap: 12, minHeight: 68, padding: 12 },
  routeBadge: { alignItems: "center", backgroundColor: COLORS.navy, borderRadius: 8, justifyContent: "center", minWidth: 47, paddingHorizontal: 7, paddingVertical: 8 },
  routeBadgeText: { color: "#ffffff", fontFamily: FONTS.semibold, fontSize: 15 },
  routeName: { color: COLORS.ink, flex: 1, fontFamily: FONTS.medium, fontSize: 14, lineHeight: 19 },
  stopCard: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 13, borderWidth: 1, flexDirection: "row", gap: 10, minHeight: 68, padding: 13 },
  stopCardText: { flex: 1 },
  stopCardName: { color: COLORS.ink, fontFamily: FONTS.medium, fontSize: 14, lineHeight: 19 },
  stopCardAction: { color: COLORS.navy, fontFamily: FONTS.medium, fontSize: 11, marginTop: 4 },
  empty: { color: COLORS.muted, fontFamily: FONTS.regular, textAlign: "center" },
  back: { color: "#123a63", fontSize: 16, fontWeight: "600", marginTop: 20 },
  stopDetailsTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 23, lineHeight: 29, marginTop: 16 },
  stopDetailsSubtitle: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 13, marginTop: 4 },
  routeHeader: { alignItems: "center", flexDirection: "row", gap: 12, marginVertical: 16 },
  routeMapPreview: { borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, height: 190, marginBottom: 12, overflow: "hidden" },
  routeMapPreviewMap: { flex: 1 },
  routeMapPreviewLabel: { backgroundColor: "rgba(0,36,70,0.88)", bottom: 10, borderRadius: 8, left: 10, paddingHorizontal: 10, paddingVertical: 7, position: "absolute" },
  routeMapPreviewLabelText: { color: "#ffffff", fontFamily: FONTS.medium, fontSize: 11 },
  transportDataNotice: { backgroundColor: "#eef4ff", borderRadius: 14, marginTop: 14, padding: 13 },
  transportDataNoticeTitle: { color: "#123a63", fontSize: 14, fontWeight: "700" },
  transportDataNoticeText: { color: "#43474e", fontSize: 13, lineHeight: 18, marginTop: 5 },
  hint: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 12, lineHeight: 17, marginBottom: 8 },
  mapButton: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 10, marginBottom: 12, minHeight: 47, padding: 13 },
  mapButtonText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 13 },
  detailsList: { gap: 14, paddingBottom: 32 },
  variant: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, overflow: "hidden", padding: 14 },
  variantTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontSize: 15, marginBottom: 11 },
  stopRow: { alignItems: "center", flexDirection: "row", gap: 12, minHeight: 44 },
  stopNumber: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 13, width: 22 },
  stopName: { color: "#4b5968", flex: 1, fontFamily: FONTS.regular, fontSize: 13 },
  stopSchedule: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 11 },
  scheduleTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 23, marginTop: 16 },
  scheduleSubtitle: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 13, marginTop: 4 },
  dateControls: { alignItems: "center", flexDirection: "row", gap: 14, marginTop: 8 },
  dateButton: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 20, height: 40, justifyContent: "center", width: 40 },
  dateButtonText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 20 },
  selectedDate: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 15, marginTop: 2 },
  sourcesTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 25, marginTop: 18 },
  sourcesList: { gap: 10, paddingVertical: 16 },
  sourceCard: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, padding: 14 },
  sourceCardTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontSize: 15 },
  sourceText: { color: "#596574", fontFamily: FONTS.regular, fontSize: 13, lineHeight: 19, marginTop: 6 },
  sourceUrl: { color: COLORS.navy, fontFamily: FONTS.medium, fontSize: 11, marginTop: 9 },
  departure: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 14, padding: 14 },
  departureTime: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 19 },
  departureDestination: { color: "#4b5968", flex: 1, fontFamily: FONTS.regular, fontSize: 13 },
  mapScreen: { flex: 1, backgroundColor: "#f8f9ff" },
  mapHeader: { backgroundColor: "#f8f9ff", paddingHorizontal: 20, paddingVertical: 14 },
  mapTitle: { color: "#071d31", fontSize: 18, fontWeight: "700", marginTop: 14 },
  mapHint: { color: "#43474e", fontSize: 13, marginTop: 4 },
  map: { flex: 1 },
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
