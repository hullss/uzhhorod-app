import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import MapView, { Marker, Polyline, type Region } from "react-native-maps";
import {
  ActivityIndicator,
  FlatList,
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

export default function App() {
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [stops, setStops] = useState<TransportStop[]>([]);
  const [importStatus, setImportStatus] = useState<TransportImportStatus | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<TransportRouteDetails | null>(null);
  const [selectedStop, setSelectedStop] = useState<StopScreen | null>(null);
  const [schedule, setSchedule] = useState<ScheduleView | null>(null);
  const [mapScreen, setMapScreen] = useState<MapScreen | null>(null);
  const [searchMode, setSearchMode] = useState<"routes" | "stops">("routes");
  const [showDataSources, setShowDataSources] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadList(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, searchMode]);

  async function loadList(searchQuery = query) {
    setError(null);
    try {
      const latestImport = await getLatestTransportImport();
      setImportStatus(latestImport);
      if (searchMode === "routes") {
        setRoutes(await getRoutes(searchQuery));
      } else {
        setStops(await getStops(searchQuery));
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
    setSelectedStop(null);
    try {
      setSelectedRoute(await getRoute(route.id));
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
      setMapScreen({ route, map: await getRouteMap(route.id) });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Невідома помилка");
    } finally {
      setLoading(false);
    }
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
      onBack={() => {
        setSchedule(null);
        setMapScreen(null);
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
      <Text style={styles.title}>Ужгород Цифровий</Text>
      <Text style={styles.subtitle}>Громадський транспорт</Text>
      {importStatus?.available && importStatus.completedAt && (
        <Text style={styles.dataUpdated}>Дані оновлено: {formatUpdatedAt(importStatus.completedAt)}</Text>
      )}
      <Pressable onPress={() => setShowDataSources(true)}>
        <Text style={styles.dataSourcesLink}>Джерела даних і ліцензія</Text>
      </Pressable>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={searchMode === "routes" ? "Номер або назва маршруту" : "Назва зупинки"}
        placeholderTextColor="#64748b"
        style={styles.searchInput}
      />
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
              <Text style={styles.stopCardName}>{item.name}</Text>
              <Text style={styles.stopCardAction}>Маршрути →</Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Зупинок не знайдено.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

function DataSourcesScreen({ onBack }: { onBack: () => void }) {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <Pressable onPress={onBack}>
        <Text style={styles.back}>← До транспорту</Text>
      </Pressable>
      <Text style={styles.sourcesTitle}>Джерела даних</Text>
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
      <Pressable onPress={onBack}>
        <Text style={styles.back}>← До зупинок</Text>
      </Pressable>
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
  onBack,
  onSelectStop,
  onOpenMap,
}: {
  route: TransportRouteDetails;
  onBack: () => void;
  onSelectStop: (stop: TransportStop) => void;
  onOpenMap: () => void;
}) {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <Pressable onPress={onBack}>
        <Text style={styles.back}>← Усі маршрути</Text>
      </Pressable>
      <View style={styles.routeHeader}>
        <View style={styles.routeBadge}>
          <Text style={styles.routeBadgeText}>{route.routeNumber}</Text>
        </View>
        <Text style={styles.routeName}>{route.name}</Text>
      </View>
      <Pressable style={styles.mapButton} onPress={onOpenMap}>
        <Text style={styles.mapButtonText}>Показати маршрут на карті</Text>
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
            pinColor="#155e75"
          />
        ))}
      </MapView>
    </SafeAreaView>
  );
}

const MAP_COLORS = ["#155e75", "#b45309", "#7e22ce", "#be123c"];

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
      <Pressable onPress={onBack}>
        <Text style={styles.back}>← До зупинок маршруту {schedule.route.routeNumber}</Text>
      </Pressable>
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
      <ActivityIndicator size="large" color="#155e75" />
      <Text style={styles.loadingText}>Завантаження транспорту…</Text>
    </SafeAreaView>
  );
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <SafeAreaView style={[styles.screen, styles.centered]}>
      <Text style={styles.errorTitle}>Не вдалося отримати дані</Text>
      <Text style={styles.errorText}>{message}</Text>
      <Pressable style={styles.retryButton} onPress={() => void onRetry()}>
        <Text style={styles.retryText}>Спробувати ще раз</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc", paddingHorizontal: 20 },
  centered: { alignItems: "center", justifyContent: "center" },
  title: { color: "#0f172a", fontSize: 28, fontWeight: "700", marginTop: 20 },
  subtitle: { color: "#475569", fontSize: 16, marginTop: 4 },
  dataUpdated: { color: "#64748b", fontSize: 13, marginTop: 6 },
  dataSourcesLink: { color: "#155e75", fontSize: 13, fontWeight: "700", marginTop: 8 },
  searchInput: { backgroundColor: "#ffffff", borderColor: "#cbd5e1", borderRadius: 12, borderWidth: 1, color: "#0f172a", fontSize: 16, marginTop: 20, paddingHorizontal: 14, paddingVertical: 12 },
  searchModes: { flexDirection: "row", gap: 10, marginTop: 12 },
  searchMode: { alignItems: "center", borderColor: "#cbd5e1", borderRadius: 10, borderWidth: 1, flex: 1, paddingVertical: 10 },
  searchModeActive: { backgroundColor: "#155e75", borderColor: "#155e75" },
  searchModeText: { color: "#475569", fontWeight: "700" },
  searchModeTextActive: { color: "#ffffff" },
  list: { gap: 12, paddingVertical: 24 },
  routeCard: { alignItems: "center", backgroundColor: "#ffffff", borderRadius: 16, flexDirection: "row", gap: 14, padding: 16 },
  routeBadge: { alignItems: "center", backgroundColor: "#155e75", borderRadius: 10, justifyContent: "center", minWidth: 52, paddingHorizontal: 8, paddingVertical: 10 },
  routeBadgeText: { color: "#ffffff", fontSize: 18, fontWeight: "700" },
  routeName: { color: "#0f172a", flex: 1, fontSize: 16, fontWeight: "600" },
  stopCard: { backgroundColor: "#ffffff", borderRadius: 16, padding: 16 },
  stopCardName: { color: "#0f172a", fontSize: 16, fontWeight: "600" },
  stopCardAction: { color: "#155e75", fontSize: 14, fontWeight: "700", marginTop: 8 },
  empty: { color: "#475569", textAlign: "center" },
  back: { color: "#155e75", fontSize: 16, fontWeight: "600", marginTop: 20 },
  stopDetailsTitle: { color: "#0f172a", fontSize: 24, fontWeight: "700", marginTop: 24 },
  stopDetailsSubtitle: { color: "#475569", fontSize: 16, marginTop: 6 },
  routeHeader: { alignItems: "center", flexDirection: "row", gap: 14, marginVertical: 24 },
  hint: { color: "#475569", fontSize: 14, marginBottom: 8 },
  mapButton: { alignItems: "center", backgroundColor: "#e0f2fe", borderRadius: 12, marginBottom: 14, padding: 13 },
  mapButtonText: { color: "#155e75", fontSize: 16, fontWeight: "700" },
  detailsList: { gap: 20, paddingBottom: 32 },
  variant: { backgroundColor: "#ffffff", borderRadius: 16, overflow: "hidden", padding: 16 },
  variantTitle: { color: "#0f172a", fontSize: 18, fontWeight: "700", marginBottom: 12 },
  stopRow: { alignItems: "center", flexDirection: "row", gap: 12, minHeight: 44 },
  stopNumber: { color: "#155e75", fontWeight: "700", width: 22 },
  stopName: { color: "#334155", flex: 1, fontSize: 16 },
  stopSchedule: { color: "#155e75", fontSize: 13, fontWeight: "700" },
  scheduleTitle: { color: "#0f172a", fontSize: 24, fontWeight: "700", marginTop: 24 },
  scheduleSubtitle: { color: "#475569", fontSize: 16, marginTop: 6 },
  dateControls: { alignItems: "center", flexDirection: "row", gap: 14, marginTop: 8 },
  dateButton: { alignItems: "center", backgroundColor: "#e0f2fe", borderRadius: 20, height: 40, justifyContent: "center", width: 40 },
  dateButtonText: { color: "#155e75", fontSize: 22, fontWeight: "700" },
  selectedDate: { color: "#0f172a", fontSize: 17, fontWeight: "700", marginTop: 2 },
  sourcesTitle: { color: "#0f172a", fontSize: 26, fontWeight: "700", marginTop: 24 },
  sourcesList: { gap: 14, paddingVertical: 22 },
  sourceCard: { backgroundColor: "#ffffff", borderRadius: 16, padding: 16 },
  sourceCardTitle: { color: "#0f172a", fontSize: 17, fontWeight: "700" },
  sourceText: { color: "#475569", fontSize: 15, lineHeight: 21, marginTop: 8 },
  sourceUrl: { color: "#155e75", fontSize: 13, marginTop: 10 },
  departure: { alignItems: "center", backgroundColor: "#ffffff", borderRadius: 14, flexDirection: "row", gap: 16, padding: 16 },
  departureTime: { color: "#155e75", fontSize: 22, fontWeight: "700" },
  departureDestination: { color: "#334155", flex: 1, fontSize: 16 },
  mapScreen: { flex: 1, backgroundColor: "#f8fafc" },
  mapHeader: { backgroundColor: "#f8fafc", paddingHorizontal: 20, paddingVertical: 14 },
  mapTitle: { color: "#0f172a", fontSize: 18, fontWeight: "700", marginTop: 14 },
  mapHint: { color: "#475569", fontSize: 13, marginTop: 4 },
  map: { flex: 1 },
  loadingText: { color: "#475569", marginTop: 14 },
  errorTitle: { color: "#b91c1c", fontSize: 20, fontWeight: "700" },
  errorText: { color: "#475569", marginTop: 8, textAlign: "center" },
  retryButton: { backgroundColor: "#155e75", borderRadius: 10, marginTop: 20, paddingHorizontal: 18, paddingVertical: 12 },
  retryText: { color: "#ffffff", fontWeight: "700" },
});
