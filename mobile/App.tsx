import { StatusBar } from "expo-status-bar";
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
  getCurrencyRates,
  getMiniSculptures,
  getOfficialNews,
  getWeather,
  type AccessibleBuilding,
  type AccessibleBuildingList,
  type AirAlertStatus,
  type CurrencyRates,
  type OfficialNewsList,
  type MiniSculpture,
  type MiniSculptureList,
  type Weather,
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
  activeVariantId?: string;
};

type StopScreen = {
  stop: TransportStop;
  routes: TransportRoute[];
};

type CityService = {
  id: "cnap" | "polls" | "accessibility" | "parking" | "shelters" | "resilience" | "waste" | "playgrounds" | "miniatures";
  category: "mobility" | "civic" | "safety" | "places";
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  sourceLabel: string;
  sourceUrl?: string;
  notice?: string;
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
    id: "shelters",
    category: "safety",
    icon: "shield-outline",
    title: "Укриття",
    description: "Мапа захисних споруд та важлива інформація про них.",
    sourceLabel: "Відкрити офіційний набір",
    sourceUrl: "https://data.rada-uzhgorod.gov.ua/dataset/14d3e436-281b-49c2-b178-c9a9c6b28a2e",
    notice: "Офіційний файл з укриттями зараз перебуває на модерації. Додамо точки на мапу лише коли місто відкриє актуальні координати.",
  },
  {
    id: "resilience",
    category: "safety",
    icon: "flashlight-outline",
    title: "Пункти незламності",
    description: "Мапа пунктів допомоги під час тривалих відключень.",
    sourceLabel: "Незабаром",
    notice: "Перш ніж показувати мапу, отримаємо підтверджений перелік, графік роботи та контакти кожного пункту. Застарілі адреси в такому сервісі неприпустимі.",
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
            <Text style={styles.brandTitle}>Ужгород Поруч</Text>
          </View>
          <Text style={styles.brandSubtitle}>офіційні міські сервіси</Text>
        </View>
      </View>
      <Text style={styles.headerDate}>{formatDashboardDate()}</Text>
    </View>
  );
}

function BrandMark({ size = 34 }: { size?: number }) {
  return <View style={[styles.brandMark, { borderRadius: Math.round(size * 0.29), height: size, width: size }]}>
    <Text style={[styles.brandMarkText, { fontSize: Math.round(size * 0.5) }]}>У</Text>
    <View style={[styles.brandMarkAccent, { borderRadius: Math.round(size * 0.1), height: Math.max(5, Math.round(size * 0.18)), width: Math.max(5, Math.round(size * 0.18)) }]} />
  </View>;
}

function BrandIntro({ opacity, scale }: { opacity: Animated.Value; scale: Animated.Value }) {
  return <SafeAreaView style={styles.brandIntroScreen}>
    <Animated.View style={[styles.brandIntroContent, { opacity, transform: [{ scale }] }]}>
      <BrandMark size={88} />
      <Text style={styles.brandIntroTitle}>Ужгород Поруч</Text>
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
    <Pressable style={styles.backLink} onPress={onPress}>
      <Ionicons name="chevron-back" size={18} color={COLORS.navyDark} />
      <Text style={styles.backLinkText}>{label}</Text>
    </Pressable>
  );
}

function useSwipeBack(onBack: () => void) {
  return useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: (event) => event.nativeEvent.locationX <= 24,
    onMoveShouldSetPanResponder: (_, gesture) => gesture.x0 <= 24 && gesture.dx > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx >= 84 && Math.abs(gesture.dy) < 80) {
        onBack();
      }
    },
  }).panHandlers, [onBack]);
}

export default function App() {
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
  const [weatherOpen, setWeatherOpen] = useState(false);
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
    if (selectedService) {
      setSelectedService(null);
      return true;
    }
    if (activeTab !== "home") {
      setActiveTab("home");
      return true;
    }
    return false;
  }, [activeTab, mapScreen, schedule, section, selectedRoute, selectedService, selectedStop, showDataSources, weatherOpen]);

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
    setSelectedService(null);
    setWeatherOpen(false);
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
    if (weatherOpen) {
      return <WeatherScreen onBack={() => setWeatherOpen(false)} />;
    }
    if (selectedService) {
      if (selectedService.id === "accessibility") {
        return <AccessibilityBuildingsScreen onBack={() => setSelectedService(null)} />;
      }
      if (selectedService.id === "parking") {
        return <ParkingScreen onBack={() => setSelectedService(null)} />;
      }
      if (selectedService.id === "miniatures") {
        return <MiniaturesScreen onBack={() => setSelectedService(null)} />;
      }
      return <CityServiceDetails service={selectedService} onBack={() => setSelectedService(null)} />;
    }
    if (activeTab === "feed") {
      return <NewsScreen onChangeTab={navigateToTab} />;
    }
    if (activeTab === "profile") {
      return <ProfileScreen onChangeTab={navigateToTab} />;
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
      onBack={() => {
        setSchedule(null);
        setMapScreen(null);
        setRouteMapPreview(null);
        setSelectedRoute(null);
      }}
      onSelectStop={(stop) => void openSchedule(selectedRoute, stop)}
      onOpenMap={(variantId) => void openMap(selectedRoute, variantId)}
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
    <SafeAreaView {...transportSwipeBack} style={styles.transportScreen}>
      <StatusBar style="dark" />
      <View style={styles.transportContent}>
        <CivicHeader onOpenNotifications={() => navigateToTab("feed")} onOpenProfile={() => navigateToTab("profile")} />
        <BackLink label="До сервісів" onPress={() => navigateToTab("services")} />
        <View style={styles.transportPageTitleRow}>
          <View style={styles.transportPageTitleCopy}>
            <Text style={styles.transportPageTitle}>Громадський транспорт</Text>
            <Text style={styles.transportPageDescription}>Офіційний перелік маршрутів, схем та затверджених графіків руху.</Text>
          </View>
          <View style={[styles.transportPlanMark, importStatus?.available && styles.transportPlanMarkAvailable]}>
            <Ionicons name={importStatus?.available ? "checkmark-circle" : "time-outline"} size={13} color={importStatus?.available ? COLORS.green : "#795000"} />
            <Text style={[styles.transportPlanMarkText, importStatus?.available && styles.transportPlanMarkTextAvailable]}>
              {importStatus?.available ? "Розклад діє" : "Планові дані"}
            </Text>
          </View>
        </View>
        <View style={styles.transportSourceLine}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.green} />
          <View style={styles.transportSourceCopy}>
            <Text style={styles.transportSourceTitle}>Затверджені планові дані</Text>
            <Text style={styles.transportSourceText}>Маршрути, зупинки й планові розклади надходять з офіційного GTFS. Живі GPS-позиції показуємо на карті маршруту, коли вони доступні.</Text>
            {importStatus?.completedAt ? <Text style={styles.transportUpdatedAt}>Оновлено: {formatUpdatedAt(importStatus.completedAt)}</Text> : null}
          </View>
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
              <View style={styles.routeCardCopy}>
                <Text style={styles.routeName}>{item.name}</Text>
                <Text style={styles.routeCardMeta}>Схема зупинок і плановий розклад</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
            </Pressable>
          )}
          ListHeaderComponent={<Text style={styles.transportListHeading}>{query ? "Результати пошуку" : "Усі маршрути"}</Text>}
          ListEmptyComponent={<TransportEmptyState hasQuery={Boolean(query)} onReset={() => setQuery("")} onShowStops={() => setSearchMode("stops")} />}
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
          ListHeaderComponent={<Text style={styles.transportListHeading}>{query ? "Результати пошуку" : "Усі зупинки"}</Text>}
          ListEmptyComponent={<TransportEmptyState hasQuery={Boolean(query)} onReset={() => setQuery("")} onShowStops={() => setSearchMode("routes")} />}
        />
      )}
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
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowDot} />
          <Text style={styles.eyebrow}>Усе для міста</Text>
          </View>
          <Text style={styles.pageTitle}>Сервіси</Text>
          <Text style={styles.pageDescription}>Обирайте за тим, що потрібно зробити просто зараз.</Text>
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
  return <Pressable style={styles.serviceGridCard} onPress={onPress}>
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
  onChangeTab,
}: {
  onOpenTransport: () => void;
  onOpenWeather: () => void;
  onOpenService: (id: CityService["id"]) => void;
  onChangeTab: (tab: RootTab) => void;
}) {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.dashboardContent}>
        <CivicHeader onOpenNotifications={() => onChangeTab("feed")} onOpenProfile={() => onChangeTab("profile")} />
        <View style={styles.dashboardTop}>
          <View>
            <Text style={styles.dashboardDate}>{formatDashboardDate()}</Text>
            <Text style={styles.dashboardDay}>{formatDashboardDay()}</Text>
          </View>
          <View style={styles.dashboardCityChip}>
            <Ionicons name="location-outline" size={16} color={COLORS.navyDark} />
            <Text style={styles.dashboardCityText}>Ужгород</Text>
          </View>
        </View>

        <WeatherPreview onPress={onOpenWeather} />

        <AirAlertBanner />

        <CurrencyWidget />

        <View style={styles.dashboardSectionRow}>
          <Text style={styles.dashboardSectionTitle}>Важливе</Text>
          <Pressable onPress={() => onChangeTab("feed")}><Text style={styles.dashboardAllLink}>Усі</Text></Pressable>
        </View>
        <OfficialNewsPreview onOpenFeed={() => onChangeTab("feed")} />

        <View style={styles.dashboardSectionRow}>
          <Text style={styles.dashboardSectionTitle}>Популярні сервіси</Text>
          <Pressable onPress={() => onChangeTab("services")}><Text style={styles.dashboardAllLink}>Усі</Text></Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dashboardServicesRow}>
          <DashboardServiceCard icon="bus-outline" title="Рух транспорту" onPress={onOpenTransport} />
          <DashboardServiceCard icon="car-outline" title="Паркування" onPress={() => onOpenService("parking")} />
          <DashboardServiceCard icon="accessibility-outline" title="Доступне місто" onPress={() => onOpenService("accessibility")} />
          <DashboardServiceCard icon="document-text-outline" title="Запис до ЦНАП" onPress={() => onOpenService("cnap")} />
        </ScrollView>
      </ScrollView>
      <BottomNavigation activeTab="home" onChangeTab={onChangeTab} />
    </SafeAreaView>
  );
}

function DashboardServiceCard({ icon, title, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; onPress: () => void }) {
  return <Pressable style={styles.dashboardServiceCard} onPress={onPress}>
    <View style={styles.dashboardServiceIcon}><Ionicons name={icon} size={24} color={COLORS.navy} /></View>
    <Text style={styles.dashboardServiceTitle}>{title}</Text>
  </Pressable>;
}

function OfficialNewsPreview({ onOpenFeed }: { onOpenFeed: () => void }) {
  const [data, setData] = useState<OfficialNewsList | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getOfficialNews().then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

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
    {data.items.slice(0, 3).map((item) => <Pressable key={item.sourceUrl} style={styles.homeNewsItem} onPress={() => void openOfficialLink(item.sourceUrl)}>
      <View style={styles.homeNewsIcon}><Ionicons name="megaphone-outline" size={18} color={COLORS.navy} /></View>
      <View style={styles.homeNewsCopy}>
        <Text numberOfLines={2} style={styles.homeNewsTitle}>{item.title}</Text>
        <Text style={styles.homeNewsMeta}>{item.publishedLabel ?? "Офіційна публікація"}</Text>
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

  useEffect(() => {
    void getCurrencyRates().then(setData).catch(() => setData(null));
  }, []);

  const mainRates = data?.rates ?? [];
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
      </View> : <Text style={styles.currencyUnavailable}>Курси тимчасово завантажуються</Text>}
      {data?.stale ? <Text style={styles.currencyStale}>Показано останнє доступне оновлення</Text> : null}
    </View>
  );
}

function WeatherPreview({ onPress }: { onPress: () => void }) {
  const [data, setData] = useState<Weather | null>(null);

  useEffect(() => {
    void getWeather().then(setData).catch(() => setData(null));
  }, []);

  const airQuality = data?.current.airQuality;
  return <Pressable style={styles.weatherFeatureCard} onPress={onPress}>
    <View style={styles.weatherFeatureMain}>
      <View>
        <Text style={styles.weatherFeatureLabel}>Погода зараз</Text>
        <View style={styles.weatherFeatureTemperatureRow}>
          <Text style={styles.weatherFeatureTemperature}>{data ? `${Math.round(data.current.temperatureC)}°` : "—"}</Text>
          {data ? <Image source={{ uri: data.current.iconUrl }} style={styles.weatherFeatureIcon} /> : <Ionicons name="partly-sunny-outline" size={38} color={COLORS.navy} />}
        </View>
        <Text style={styles.weatherFeatureCondition}>{data ? data.current.condition : "Оновлюємо дані"}</Text>
      </View>
    </View>
    <View style={styles.weatherFeatureAir}>
      <Ionicons name="leaf-outline" size={21} color={COLORS.green} />
      <Text style={styles.weatherFeatureAirLabel}>Якість повітря</Text>
      <Text style={styles.weatherFeatureAirValue}>{airQuality ? airQualityLabel(airQuality.index) : "Оновлюємо"}</Text>
      <Text style={styles.weatherFeatureAirMeta}>{airQuality ? `PM2.5 ${Math.round(airQuality.pm25)}` : ""}</Text>
    </View>
    <Ionicons name="chevron-forward" size={17} color={COLORS.muted} style={styles.weatherFeatureChevron} />
  </Pressable>;
}

function AirAlertBanner() {
  const [data, setData] = useState<AirAlertStatus | null>(null);

  useEffect(() => {
    void loadStatus();
    const timer = setInterval(() => void loadStatus(), 60_000);
    return () => clearInterval(timer);
  }, []);

  async function loadStatus() {
    try {
      setData(await getAirAlertStatus());
    } catch {
      setData(null);
    }
  }

  if (!data || data.state === "UNAVAILABLE") {
    return null;
  }

  const state = data.state;
  const icon = state === "ACTIVE" ? "warning-outline" : "shield-checkmark-outline";
  return (
    <Pressable style={[styles.airAlertBanner, state === "ACTIVE" ? styles.airAlertBannerActive : styles.airAlertBannerClear]} onPress={() => void openOfficialLink("https://www.ukrainealarm.com/")}>
      <View style={[styles.airAlertIcon, state === "ACTIVE" ? styles.airAlertIconActive : styles.airAlertIconClear]}><Ionicons name={icon} size={19} color={state === "ACTIVE" ? "#a31d1d" : COLORS.green} /></View>
      <View style={styles.airAlertCopy}>
        <Text style={[styles.airAlertTitle, state === "ACTIVE" && styles.airAlertTitleActive]}>{data.title}</Text>
        {state === "ACTIVE" ? <Text style={styles.airAlertTextActive}>{data.detail}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={17} color={state === "ACTIVE" ? "#a31d1d" : COLORS.green} />
    </Pressable>
  );
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

function NewsScreen({ onChangeTab }: { onChangeTab: (tab: RootTab) => void }) {
  const [data, setData] = useState<OfficialNewsList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadNews();
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

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.simpleTabContent}>
        <CivicHeader onOpenProfile={() => onChangeTab("profile")} />
        <View style={styles.pageIntro}>
          <View style={styles.eyebrowRow}>
            <View style={[styles.eyebrowDot, styles.eyebrowDotGreen]} />
          <Text style={styles.eyebrow}>Офіційний вісник</Text>
        </View>
          <Text style={styles.pageTitle}>Стрічка</Text>
        </View>
        <Pressable style={styles.newsSourceLine} onPress={() => void openOfficialLink("https://rada-uzhgorod.gov.ua/")}>
          <Ionicons name="megaphone-outline" size={18} color={COLORS.navy} />
          <Text style={styles.newsSourceLineText}>Джерело: Ужгородська міська рада</Text>
          <Ionicons name="open-outline" size={16} color={COLORS.navy} />
        </Pressable>
        <View style={styles.newsListHeading}>
          <Text style={styles.newsListHeadingTitle}>Останні новини</Text>
          <Text style={styles.newsListHeadingMeta}>Офіційно</Text>
        </View>
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
        {data?.items.slice(0, 10).map((item) => (
          <Pressable key={item.sourceUrl} style={styles.newsArticleCard} onPress={() => void openOfficialLink(item.sourceUrl)}>
            <View style={styles.newsArticleTop}>
              <View style={styles.newsArticleIcon}><Ionicons name="megaphone-outline" size={17} color={COLORS.navy} /></View>
              <Text style={styles.newsArticleDate}>{item.publishedLabel ?? "Дата не вказана"}</Text>
            </View>
            <Text numberOfLines={2} style={styles.newsArticleTitle}>{item.title}</Text>
            <View style={styles.newsArticleAction}>
              <Text style={styles.newsArticleActionText}>Відкрити на сайті</Text>
              <Ionicons name="arrow-forward" size={16} color={COLORS.navy} />
            </View>
          </Pressable>
        ))}
        {!loading && !error && data?.items.length === 0 && <Text style={styles.empty}>Новин поки немає.</Text>}
        {data && data.items.length > 10 ? <Pressable style={styles.newsMoreLink} onPress={() => void openOfficialLink("https://rada-uzhgorod.gov.ua/")}>
          <Text style={styles.newsMoreLinkText}>Усі новини на сайті міськради</Text>
          <Ionicons name="open-outline" size={16} color={COLORS.navy} />
        </Pressable> : null}
      </ScrollView>
      <BottomNavigation activeTab="feed" onChangeTab={onChangeTab} />
    </SafeAreaView>
  );
}

function ProfileScreen({ onChangeTab }: { onChangeTab: (tab: RootTab) => void }) {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.simpleTabContent}>
        <CivicHeader onOpenNotifications={() => onChangeTab("feed")} />
        <View style={styles.pageIntro}>
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowDot} />
            <Text style={styles.eyebrow}>Ваш простір</Text>
          </View>
          <Text style={styles.pageTitle}>Налаштування</Text>
          <Text style={styles.pageDescription}>Керуйте тим, як застосунок виглядає та повідомляє важливе.</Text>
        </View>
        <View style={styles.profileAppCard}>
          <View style={styles.profileAppMark}><BrandMark size={44} /></View>
          <View style={styles.profileAppCopy}>
            <Text style={styles.profileAppTitle}>Ужгород Поруч</Text>
            <Text style={styles.profileAppText}>Працює без акаунта. Особисті дані не збираємо.</Text>
          </View>
          <View style={styles.profileVersionPill}><Text style={styles.profileVersionText}>v1.0</Text></View>
        </View>

        <Text style={styles.profileSectionTitle}>Налаштування застосунку</Text>
        <View style={styles.profileGroup}>
          <ProfileRow
            icon="notifications-outline"
            title="Сповіщення"
            value="Ще не підключені"
            onPress={() => Alert.alert("Сповіщення ще не підключені", "Підключимо їх лише через підтверджений офіційний канал. Зокрема, тоді зможемо коректно нагадувати про хвилину мовчання.")}
          />
          <ProfileRow icon="language-outline" title="Мова" value="Українська" />
        </View>

        <Text style={styles.profileSectionTitle}>Доступність</Text>
        <View style={styles.profileGroup}>
          <ProfileRow
            icon="text-outline"
            title="Розмір тексту"
            value="Налаштування пристрою"
            onPress={() => void Linking.openSettings()}
          />
          <ProfileRow
            icon="contrast-outline"
            title="Високий контраст"
            value="Налаштування пристрою"
            onPress={() => void Linking.openSettings()}
          />
        </View>

        <Text style={styles.profileSectionTitle}>Підтримка й інформація</Text>
        <View style={styles.profileGroup}>
          <ProfileRow icon="open-outline" title="Офіційний сайт міської ради" onPress={() => void openOfficialLink("https://rada-uzhgorod.gov.ua/")} />
          <ProfileRow
            icon="information-circle-outline"
            title="Про застосунок"
            value="Версія 1.0"
            onPress={() => Alert.alert("Ужгород Поруч", "Міський застосунок із перевіреними сервісами, розкладами та довідками. Дані показуємо лише з офіційних або вказаних джерел.")}
          />
        </View>

        <View style={styles.profilePrivacyNote}>
          <Ionicons name="lock-closed-outline" size={20} color={COLORS.navy} />
          <Text style={styles.profilePrivacyText}>Базові сервіси не потребують номера авто, платіжних чи інших персональних даних.</Text>
        </View>
        <Text style={styles.profileFooter}>Ужгород Поруч · міський застосунок</Text>
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
      <Text style={styles.accessibilityBuildingName}>{building.name}</Text>
      <Text style={styles.accessibilityAddress}>{building.address}</Text>
      {monitoredAt && <Text style={styles.accessibilityDate}>Моніторинг: {monitoredAt}</Text>}
    </View>
  );
}

function ParkingScreen({ onBack }: { onBack: () => void }) {
  const swipeBack = useSwipeBack(onBack);
  return (
    <SafeAreaView {...swipeBack} style={styles.screen}>
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
          <Text style={styles.detailDescription}>Муніципальна довідка, правила стоянки та перевірені переходи до сервісів для водіїв.</Text>
        </View>

        <View style={styles.parkingHero}>
          <View style={styles.parkingHeroTop}>
            <View style={styles.parkingHeroIcon}><Ionicons name="car-outline" size={24} color="#f7be3d" /></View>
            <View style={styles.parkingHeroBadge}><Text style={styles.parkingHeroBadgeText}>ОФІЦІЙНИЙ ДОВІДНИК</Text></View>
          </View>
          <Text style={styles.parkingHeroTitle}>Міський реєстр паркування</Text>
          <Text style={styles.parkingHeroText}>Адреси майданчиків, операторів і тарифи з’являться тут після публікації міського набору даних.</Text>
        </View>
        <View style={styles.parkingSectionHeading}>
          <Text style={styles.sectionLabel}>Дії для водіїв</Text>
          <View style={styles.officialMark}><Ionicons name="shield-checkmark-outline" size={14} color={COLORS.green} /><Text style={styles.officialMarkText}>Офіційні сервіси</Text></View>
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
          <Text style={styles.parkingUnavailableTitle}>Майданчики та тарифи готуються до публікації</Text>
          <Text style={styles.parkingUnavailableText}>Офіційний набір містить майданчики та операторів, але його файл зараз на модерації. Додамо перелік і тарифи після відкритої публікації, щоб не показувати застарілі адреси чи суми.</Text>
          <Pressable onPress={() => void openOfficialLink(PARKING_DATASET_URL)}>
            <Text style={styles.parkingUnavailableLink}>Перевірити стан набору</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
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

function StopDetails({
  stopScreen,
  onBack,
  onOpenRoute,
}: {
  stopScreen: StopScreen;
  onBack: () => void;
  onOpenRoute: (route: TransportRoute) => void;
}) {
  const swipeBack = useSwipeBack(onBack);
  return (
    <SafeAreaView {...swipeBack} style={styles.screen}>
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
  onOpenMap: (variantId?: string) => void;
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
              <Text style={styles.routeDetailRouteLabel}>МАРШРУТ</Text>
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
          <View style={styles.routeDetailSource}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#d3e4ff" />
            <Text style={styles.routeDetailSourceText}>Маршрут і зупинки з офіційного набору GTFS</Text>
          </View>
        </View>
        {map && (
          <Pressable style={styles.routeMapPreview} onPress={() => onOpenMap(direction?.id)}>
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
        <Pressable style={styles.mapButton} onPress={() => onOpenMap(direction?.id)}>
          <Ionicons name="map-outline" size={18} color={COLORS.navy} />
          <Text style={styles.mapButtonText}>{map ? "Відкрити карту маршруту" : "Показати маршрут на карті"}</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.navy} />
        </Pressable>
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
            </Pressable> : null}
          </View>
          <View style={styles.variant}>
            {direction.stops.map((stop, index) => (
              <Pressable key={stop.id} style={styles.stopRow} onPress={() => onSelectStop(stop)}>
                <View style={styles.stopSequence}>
                  <View style={[styles.stopDot, index === 0 && styles.stopDotStart, index === direction.stops.length - 1 && styles.stopDotEnd]} />
                  {index < direction.stops.length - 1 && <View style={styles.stopLine} />}
                </View>
                <Text style={styles.stopName}>{stop.name}</Text>
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
        <Pressable onPress={onBack}>
          <Text style={styles.back}>← До маршруту {mapScreen.route.routeNumber}</Text>
        </Pressable>
        <Text style={styles.mapTitle}>{mapScreen.route.name}</Text>
        <Text style={styles.mapHint}>Оберіть зупинку, щоб побачити її плановий час.</Text>
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
        {vehiclePositions ? <View style={styles.mapGpsStatus}>
          <View style={[styles.mapGpsDot, vehiclePositions.available ? (vehiclePositions.stale ? styles.mapGpsDotStale : styles.mapGpsDotLive) : styles.mapGpsDotOffline]} />
          <Text style={styles.mapGpsStatusText}>
            {vehiclePositions.available
              ? (vehiclePositions.stale
                ? "GPS тимчасово без оновлення"
                : `Онлайн GPS · ${vehiclePositions.vehicles.length} ${pluralizeBus(vehiclePositions.vehicles.length)}`)
              : "Онлайн GPS зараз недоступний"}
          </Text>
        </View> : null}
        {selectedStop ? <View style={[styles.mapStopCard, vehiclePositions && styles.mapStopCardWithGps]}>
          <View style={styles.mapStopCardTop}>
            <View style={styles.mapStopIcon}><Ionicons name="bus-outline" size={18} color={COLORS.navy} /></View>
            <View style={styles.mapStopCopy}>
              <Text numberOfLines={2} style={styles.mapStopName}>{selectedStop.name}</Text>
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
    <SafeAreaView {...swipeBack} style={styles.screen}>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f6f7fb", paddingHorizontal: 16 },
  transportScreen: { flex: 1, backgroundColor: "#f6f7fb" },
  transportContent: { paddingHorizontal: 20 },
  centered: { alignItems: "center", justifyContent: "center" },
  civicHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 58, paddingTop: 4 },
  brandGroup: { alignItems: "center", flexDirection: "row", gap: 8 },
  brandMark: { alignItems: "center", backgroundColor: COLORS.navy, borderRadius: 10, height: 34, justifyContent: "center", width: 34 },
  brandMarkText: { color: "#ffffff", fontFamily: FONTS.bold, fontSize: 16 },
  brandMarkAccent: { backgroundColor: COLORS.gold, bottom: 5, position: "absolute", right: 5 },
  brandIntroScreen: { alignItems: "center", backgroundColor: "#f6f7fb", flex: 1, justifyContent: "center", paddingHorizontal: 20 },
  brandIntroContent: { alignItems: "center", marginTop: -38 },
  brandIntroTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 27, letterSpacing: -0.5, marginTop: 19 },
  brandIntroSubtitle: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 13, marginTop: 6 },
  brandIntroFooter: { alignItems: "center", bottom: 42, flexDirection: "row", gap: 8, position: "absolute" },
  brandIntroFooterText: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 12 },
  brandTitleRow: { alignItems: "center", flexDirection: "row", gap: 6 },
  brandTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 17, lineHeight: 20 },
  brandSubtitle: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 10, marginTop: 1 },
  headerDate: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 12 },
  backLink: { alignItems: "center", flexDirection: "row", gap: 2, marginTop: 5, minHeight: 32 },
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
  serviceGridCard: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 15, borderWidth: 1, justifyContent: "space-between", minHeight: 122, padding: 13, width: "48.4%" },
  serviceGridIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 10, height: 42, justifyContent: "center", width: 42 },
  serviceGridFooter: { alignItems: "flex-end", flexDirection: "row", gap: 4, justifyContent: "space-between", marginTop: 14 },
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
  profileSectionTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 16, marginTop: 26 },
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
  profileFooter: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 11, marginTop: 22, textAlign: "center" },
  newsSourceLine: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 7, marginTop: 16, paddingVertical: 5 },
  newsSourceLineText: { color: COLORS.navy, fontFamily: FONTS.medium, fontSize: 12 },
  newsListHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
  newsListHeadingTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 19 },
  newsListHeadingMeta: { color: COLORS.green, fontFamily: FONTS.medium, fontSize: 11 },
  newsArticleCard: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 15, borderWidth: 1, marginTop: 10, padding: 14 },
  newsArticleTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  newsArticleIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 8, height: 32, justifyContent: "center", width: 32 },
  newsArticleDate: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 11 },
  newsArticleTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontSize: 15, lineHeight: 21, marginTop: 12 },
  newsArticleAction: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 6, marginTop: 12 },
  newsArticleActionText: { color: COLORS.navy, fontFamily: FONTS.medium, fontSize: 12 },
  newsMoreLink: { alignItems: "center", alignSelf: "center", flexDirection: "row", gap: 6, marginTop: 18, paddingVertical: 7 },
  newsMoreLinkText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 13 },
  transportPageTitleRow: { alignItems: "flex-start", flexDirection: "row", gap: 10, justifyContent: "space-between", marginTop: 4 },
  transportPageTitleCopy: { flex: 1 },
  transportPageTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 22, lineHeight: 28 },
  transportPageDescription: { color: "#596574", fontFamily: FONTS.regular, fontSize: 12, lineHeight: 17, marginTop: 3, maxWidth: 235 },
  transportPlanMark: { alignItems: "center", backgroundColor: "#fff8e9", borderRadius: 12, flexDirection: "row", gap: 5, marginTop: 3, paddingHorizontal: 8, paddingVertical: 5 },
  transportPlanMarkAvailable: { backgroundColor: "#e8f7e4" },
  transportPlanMarkText: { color: "#795000", fontFamily: FONTS.medium, fontSize: 10 },
  transportPlanMarkTextAvailable: { color: COLORS.green },
  transportSourceLine: { alignItems: "flex-start", backgroundColor: "#ffffff", borderColor: COLORS.border, borderLeftColor: COLORS.gold, borderLeftWidth: 3, borderRadius: 10, flexDirection: "row", gap: 8, marginTop: 15, padding: 11 },
  transportSourceCopy: { flex: 1 },
  transportSourceTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 12 },
  transportSourceText: { color: "#485768", fontFamily: FONTS.regular, fontSize: 12, lineHeight: 17, marginTop: 3 },
  transportUpdatedAt: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 11, marginTop: 6 },
  dataSourcesInlineLink: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 2, marginTop: 8 },
  dataSourcesInlineLinkText: { color: COLORS.navy, fontFamily: FONTS.medium, fontSize: 12 },
  searchBox: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, marginTop: 14, minHeight: 48, paddingHorizontal: 12 },
  title: { color: "#071d31", fontSize: 28, fontWeight: "700", marginTop: 20 },
  hubContent: { flexGrow: 1, paddingBottom: 28, paddingHorizontal: 20 },
  homeContent: { flexGrow: 1, paddingBottom: 28 },
  dashboardContent: { flexGrow: 1, paddingBottom: 28, paddingHorizontal: 20 },
  dashboardTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 18 },
  dashboardDate: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 12 },
  dashboardDay: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 25, marginTop: 3 },
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
  weatherFeatureCard: { alignItems: "stretch", backgroundColor: "#eaf2ff", borderColor: "#d4e3f7", borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 12, marginTop: 17, minHeight: 128, overflow: "hidden", padding: 14 },
  weatherFeatureMain: { flex: 1, justifyContent: "space-between" },
  weatherFeatureLabel: { color: "#526d89", fontFamily: FONTS.medium, fontSize: 11 },
  weatherFeatureTemperatureRow: { alignItems: "center", flexDirection: "row", gap: 4, marginTop: -2 },
  weatherFeatureTemperature: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 45, letterSpacing: -2, lineHeight: 53 },
  weatherFeatureIcon: { height: 55, width: 55 },
  weatherFeatureCondition: { color: COLORS.navy, fontFamily: FONTS.medium, fontSize: 13, marginTop: -5 },
  weatherFeatureAir: { alignItems: "flex-start", backgroundColor: "rgba(255,255,255,0.78)", borderRadius: 13, justifyContent: "center", paddingHorizontal: 11, paddingVertical: 10, width: 118 },
  weatherFeatureAirLabel: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 10, marginTop: 7 },
  weatherFeatureAirValue: { color: COLORS.ink, fontFamily: FONTS.semibold, fontSize: 14, marginTop: 2 },
  weatherFeatureAirMeta: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 10, marginTop: 2 },
  weatherFeatureChevron: { position: "absolute", right: 8, top: 8 },
  airAlertBanner: { alignItems: "center", borderRadius: 12, flexDirection: "row", gap: 9, marginTop: 9, paddingHorizontal: 11, paddingVertical: 9 },
  airAlertBannerClear: { backgroundColor: "#eef8eb" },
  airAlertBannerActive: { backgroundColor: "#fff4f3", borderColor: "#f0b5b0", borderWidth: 1 },
  airAlertIcon: { alignItems: "center", borderRadius: 9, height: 34, justifyContent: "center", width: 34 },
  airAlertIconClear: { backgroundColor: "#dff1da" },
  airAlertIconActive: { backgroundColor: "#ffe3e0" },
  airAlertCopy: { flex: 1 },
  airAlertTitle: { color: COLORS.green, fontFamily: FONTS.semibold, fontSize: 12 },
  airAlertTitleActive: { color: "#8e1b1b" },
  airAlertTextActive: { color: "#a54943" },
  currencyWidget: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 15, borderWidth: 1, marginTop: 10, padding: 14 },
  currencyWidgetHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  currencyWidgetTitleRow: { alignItems: "center", flexDirection: "row", gap: 7 },
  currencyWidgetTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 14 },
  currencyWidgetSource: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 11 },
  currencyRatesRow: { flexDirection: "row", gap: 9, marginTop: 13 },
  currencyRate: { backgroundColor: "#f6f8fd", borderRadius: 10, flex: 1, paddingHorizontal: 9, paddingVertical: 8 },
  currencyCode: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 11 },
  currencyValue: { color: COLORS.ink, fontFamily: FONTS.semibold, fontSize: 14, marginTop: 3 },
  currencyMeta: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 10, marginTop: 1 },
  currencyUnavailable: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 12, marginTop: 13 },
  currencyStale: { color: "#795000", fontFamily: FONTS.regular, fontSize: 10, marginTop: 8 },
  weatherContent: { paddingBottom: 32, paddingHorizontal: 20 },
  weatherHero: { backgroundColor: COLORS.navy, borderRadius: 18, marginTop: 18, padding: 18 },
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
  weatherDayTabs: { gap: 8, paddingTop: 18 },
  weatherDayTab: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 10, borderWidth: 1, minWidth: 112, paddingHorizontal: 12, paddingVertical: 10 },
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
  weatherHours: { gap: 8, paddingTop: 10 },
  weatherHourCard: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 12, borderWidth: 1, minWidth: 70, paddingHorizontal: 9, paddingVertical: 10 },
  weatherHourTime: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 10 },
  weatherHourIcon: { height: 32, marginVertical: 4, width: 32 },
  weatherHourTemperature: { color: COLORS.ink, fontFamily: FONTS.semibold, fontSize: 14 },
  weatherHourRain: { color: COLORS.navy, fontFamily: FONTS.regular, fontSize: 10, marginTop: 3 },
  weatherSource: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 10, marginTop: 22, textAlign: "center" },
  weatherStale: { color: "#795000", fontFamily: FONTS.regular, fontSize: 11, marginTop: 5, textAlign: "center" },
  dashboardSectionRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 26 },
  dashboardSectionTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 18 },
  dashboardAllLink: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 13 },
  dashboardFeedCard: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 13, borderWidth: 1, flexDirection: "row", gap: 11, marginTop: 9, padding: 13 },
  dashboardFeedIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 10, height: 42, justifyContent: "center", width: 42 },
  dashboardFeedCopy: { flex: 1 },
  dashboardFeedTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontSize: 14 },
  dashboardFeedText: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 11, lineHeight: 16, marginTop: 3 },
  homeNewsList: { marginTop: 4 },
  homeNewsItem: { alignItems: "center", borderBottomColor: "#dce2ea", borderBottomWidth: 1, flexDirection: "row", gap: 10, paddingVertical: 13 },
  homeNewsIcon: { alignItems: "center", backgroundColor: "#ffffff", borderRadius: 9, height: 36, justifyContent: "center", width: 36 },
  homeNewsCopy: { flex: 1 },
  homeNewsTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontSize: 13, lineHeight: 18 },
  homeNewsMeta: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 11, marginTop: 3 },
  homeNewsAllButton: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 7, paddingTop: 12 },
  homeNewsAllText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 13 },
  dashboardServicesRow: { gap: 10, paddingTop: 10, paddingRight: 4 },
  dashboardServiceCard: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 13, borderWidth: 1, height: 112, justifyContent: "space-between", padding: 12, width: 116 },
  dashboardServiceIcon: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 9, height: 38, justifyContent: "center", width: 38 },
  dashboardServiceTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontSize: 12, lineHeight: 16 },
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
  parkingContent: { gap: 10, paddingBottom: 32, paddingHorizontal: 20 },
  parkingHero: { backgroundColor: COLORS.navy, borderRadius: 16, marginTop: 18, padding: 17 },
  parkingHeroTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  parkingHeroIcon: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 10, height: 42, justifyContent: "center", width: 42 },
  parkingHeroBadge: { backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(247,190,61,0.35)", borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5 },
  parkingHeroBadgeText: { color: "#f7be3d", fontFamily: FONTS.semibold, fontSize: 9, letterSpacing: 0.5 },
  parkingHeroTitle: { color: "#ffffff", fontFamily: FONTS.bold, fontSize: 20, marginTop: 15 },
  parkingHeroText: { color: "#d3e4ff", fontFamily: FONTS.regular, fontSize: 13, lineHeight: 19, marginTop: 6 },
  parkingSectionHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
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
  list: { gap: 9, paddingBottom: 22, paddingHorizontal: 20, paddingTop: 16 },
  transportListHeading: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 15, marginBottom: 2 },
  routeCard: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 13, borderWidth: 1, flexDirection: "row", gap: 12, minHeight: 68, padding: 12 },
  routeBadge: { alignItems: "center", backgroundColor: COLORS.navy, borderRadius: 8, justifyContent: "center", minWidth: 47, paddingHorizontal: 7, paddingVertical: 8 },
  routeBadgeText: { color: "#ffffff", fontFamily: FONTS.semibold, fontSize: 15 },
  routeCardCopy: { flex: 1 },
  routeName: { color: COLORS.ink, flex: 1, fontFamily: FONTS.medium, fontSize: 14, lineHeight: 19 },
  routeCardMeta: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 11, marginTop: 3 },
  stopCard: { alignItems: "center", backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 13, borderWidth: 1, flexDirection: "row", gap: 10, minHeight: 68, padding: 13 },
  stopCardText: { flex: 1 },
  stopCardName: { color: COLORS.ink, fontFamily: FONTS.medium, fontSize: 14, lineHeight: 19 },
  stopCardAction: { color: COLORS.navy, fontFamily: FONTS.medium, fontSize: 11, marginTop: 4 },
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
  stopDetailsTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 23, lineHeight: 29, marginTop: 16 },
  stopDetailsSubtitle: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 13, marginTop: 4 },
  routeHeader: { alignItems: "center", flexDirection: "row", gap: 12, marginVertical: 16 },
  routeDetailHero: { backgroundColor: COLORS.navy, borderRadius: 16, marginBottom: 14, marginTop: 10, padding: 16 },
  routeDetailTopLine: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  routeDetailRouteIdentity: { alignItems: "center", flexDirection: "row", gap: 8 },
  routeDetailRouteLabel: { color: "#c9d8ee", fontFamily: FONTS.semibold, fontSize: 9, letterSpacing: 0.8 },
  routeDetailRouteBadge: { alignItems: "center", backgroundColor: "#ffffff", borderRadius: 12, height: 50, justifyContent: "center", minWidth: 54, paddingHorizontal: 10 },
  routeDetailRouteNumber: { color: COLORS.navy, fontFamily: FONTS.bold, fontSize: 27, lineHeight: 31 },
  routeDetailPlanMark: { alignItems: "center", backgroundColor: "rgba(247,190,61,0.13)", borderColor: "rgba(247,190,61,0.38)", borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 8, paddingVertical: 6 },
  routeDetailPlanMarkText: { color: "#f7be3d", fontFamily: FONTS.semibold, fontSize: 9, letterSpacing: 0.5 },
  routeDetailTitle: { color: "#ffffff", fontFamily: FONTS.bold, fontSize: 20, lineHeight: 26, marginTop: 14 },
  routeDetailTermini: { color: "#d3e4ff", fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, marginTop: 5 },
  routeDetailSource: { alignItems: "center", flexDirection: "row", gap: 6, marginTop: 14 },
  routeDetailSourceText: { color: "#d3e4ff", fontFamily: FONTS.regular, fontSize: 11, flex: 1, lineHeight: 16 },
  routeMapPreview: { borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, height: 190, marginBottom: 12, overflow: "hidden" },
  routeMapPreviewMap: { flex: 1 },
  routeMapPreviewLabel: { backgroundColor: "rgba(0,36,70,0.88)", bottom: 10, borderRadius: 8, left: 10, paddingHorizontal: 10, paddingVertical: 7, position: "absolute" },
  routeMapPreviewLabelText: { color: "#ffffff", fontFamily: FONTS.medium, fontSize: 11 },
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
  detailsList: { gap: 14, paddingBottom: 32, paddingHorizontal: 20 },
  routeDetailsContent: { paddingBottom: 34, paddingHorizontal: 20 },
  directionSwitch: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 13, flexDirection: "row", gap: 12, marginBottom: 10, padding: 11 },
  directionCopy: { flex: 1 },
  directionLabel: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 10, letterSpacing: 0.3, textTransform: "uppercase" },
  directionTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 14, marginTop: 3 },
  directionSwitchButton: { alignItems: "center", backgroundColor: "#ffffff", borderRadius: 10, height: 39, justifyContent: "center", width: 39 },
  variant: { backgroundColor: "#ffffff", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, overflow: "hidden", padding: 14 },
  variantHeading: { alignItems: "center", flexDirection: "row", gap: 7, marginBottom: 11 },
  variantTitle: { color: COLORS.ink, fontFamily: FONTS.semibold, fontSize: 15 },
  stopRow: { alignItems: "center", flexDirection: "row", gap: 10, minHeight: 47 },
  stopSequence: { alignItems: "center", alignSelf: "stretch", justifyContent: "center", width: 17 },
  stopDot: { backgroundColor: "#a6c9fa", borderRadius: 4, height: 8, width: 8, zIndex: 1 },
  stopDotStart: { backgroundColor: COLORS.green, height: 10, width: 10 },
  stopDotEnd: { backgroundColor: COLORS.gold, height: 10, width: 10 },
  stopLine: { backgroundColor: "#d3e4ff", bottom: -2, position: "absolute", top: 26, width: 2 },
  stopName: { color: "#4b5968", flex: 1, fontFamily: FONTS.regular, fontSize: 13 },
  stopScheduleLink: { alignItems: "center", flexDirection: "row", gap: 1 },
  stopSchedule: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 11 },
  scheduleTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 23, marginTop: 16 },
  scheduleSubtitle: { color: COLORS.muted, fontFamily: FONTS.regular, fontSize: 13, marginTop: 4 },
  dateControls: { alignItems: "center", flexDirection: "row", gap: 14, marginTop: 8 },
  dateButton: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 20, height: 40, justifyContent: "center", width: 40 },
  dateButtonText: { color: COLORS.navy, fontFamily: FONTS.semibold, fontSize: 20 },
  selectedDate: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 15, marginTop: 2 },
  sourcesTitle: { color: COLORS.navyDark, fontFamily: FONTS.bold, fontSize: 25, marginTop: 18 },
  sourcesList: { gap: 10, paddingBottom: 32, paddingHorizontal: 20, paddingTop: 16 },
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
  mapDirectionSwitch: { alignItems: "center", backgroundColor: COLORS.blueSurface, borderRadius: 12, flexDirection: "row", gap: 10, marginBottom: 10, marginHorizontal: 20, padding: 10 },
  mapDirectionCopy: { flex: 1 },
  mapDirectionLabel: { color: COLORS.muted, fontFamily: FONTS.medium, fontSize: 10, letterSpacing: 0.3, textTransform: "uppercase" },
  mapDirectionTitle: { color: COLORS.navyDark, fontFamily: FONTS.semibold, fontSize: 14, marginTop: 2 },
  mapDirectionButton: { alignItems: "center", backgroundColor: "#ffffff", borderRadius: 9, height: 37, justifyContent: "center", width: 37 },
  mapCanvas: { flex: 1, position: "relative" },
  mapGpsStatus: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 16, flexDirection: "row", gap: 7, left: 16, paddingHorizontal: 11, paddingVertical: 8, position: "absolute", right: 16, top: 14 },
  mapGpsDot: { borderRadius: 4, height: 8, width: 8 },
  mapGpsDotLive: { backgroundColor: "#2e673d" },
  mapGpsDotStale: { backgroundColor: "#b7791f" },
  mapGpsDotOffline: { backgroundColor: "#718096" },
  mapGpsStatusText: { color: COLORS.navy, fontFamily: FONTS.medium, fontSize: 12 },
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
