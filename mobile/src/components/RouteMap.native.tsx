import MapView, { Marker, Polyline } from "react-native-maps";
import { Image, StyleSheet, Text, useColorScheme, useWindowDimensions, View } from "react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TransportRouteMap, TransportStop, TransportVehiclePosition } from "../api/transport";

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type Props = {
  map: TransportRouteMap;
  region: MapRegion;
  preview?: boolean;
  activeVariantId?: string;
  stops?: TransportStop[];
  selectedStopId?: string;
  vehicles?: TransportVehiclePosition[];
  onStopPress?: (stop: TransportStop) => void;
};

const LIGHT_MAP_COLORS = ["#123a63", "#17476d", "#285574", "#3c607d"];
const DARK_MAP_COLORS = ["#38bdf8", "#55c6f5", "#75d2f7", "#94ddf8"];
const UZHHOROD_BUS_MARKER = require("../../assets/transport/uzhhorod-elektron-marker.png");

type VehicleCluster = {
  id: string;
  latitude: number;
  longitude: number;
  vehicles: TransportVehiclePosition[];
};

function clusterVehicles(vehicles: TransportVehiclePosition[], region: MapRegion, width: number, height: number): VehicleCluster[] {
  const clusters: VehicleCluster[] = [];
  const latitudeThreshold = region.latitudeDelta * 44 / Math.max(height, 1);
  const longitudeThreshold = region.longitudeDelta * 44 / Math.max(width, 1);
  for (const vehicle of vehicles) {
    if (!Number.isFinite(vehicle.latitude) || !Number.isFinite(vehicle.longitude)) continue;
    const nearby = region.latitudeDelta > 0.035 ? clusters.find((cluster) =>
      Math.abs(cluster.latitude - vehicle.latitude) < latitudeThreshold
      && Math.abs(cluster.longitude - vehicle.longitude) < longitudeThreshold,
    ) : undefined;
    if (nearby) {
      const count = nearby.vehicles.length;
      nearby.latitude = (nearby.latitude * count + vehicle.latitude) / (count + 1);
      nearby.longitude = (nearby.longitude * count + vehicle.longitude) / (count + 1);
      nearby.vehicles.push(vehicle);
    } else {
      clusters.push({ id: vehicle.id, latitude: vehicle.latitude, longitude: vehicle.longitude, vehicles: [vehicle] });
    }
  }
  return clusters;
}

export function RouteMap({
  map,
  region,
  preview = false,
  activeVariantId,
  stops,
  selectedStopId,
  vehicles = [],
  onStopPress,
}: Props) {
  const isDarkTheme = useColorScheme() === "dark";
  const mapColors = isDarkTheme ? DARK_MAP_COLORS : LIGHT_MAP_COLORS;
  const mapRef = useRef<MapView>(null);
  const { width, height } = useWindowDimensions();
  const [mapRegion, setMapRegion] = useState(region);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const vehicleClusters = useMemo(() => clusterVehicles(vehicles, mapRegion, width, height), [vehicles, mapRegion, width, height]);
  const hasFittedLiveVehicles = useRef(false);
  const activeVariants = activeVariantId
    ? map.variants.filter((variant) => variant.id === activeVariantId)
    : map.variants;
  const visibleStops = stops ?? map.stops;
  const routePoints = [...visibleStops, ...activeVariants.flatMap((variant) => variant.shape), ...(!preview ? vehicles : [])]
    .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));

  function fitToRoute() {
    if (routePoints.length < 2) {
      return;
    }
    mapRef.current?.fitToCoordinates(routePoints, {
      animated: false,
      edgePadding: preview
        ? { top: 28, right: 28, bottom: 28, left: 28 }
        : { top: 62, right: 42, bottom: 62, left: 42 },
    });
  }

  // GPS positions arrive after the map itself is ready. Fit once so live buses do not end up
  // outside the initially visible fragment of the planned route; do not refit every 20 seconds.
  useEffect(() => {
    if (preview || vehicles.length === 0 || hasFittedLiveVehicles.current || routePoints.length < 2) {
      return;
    }
    mapRef.current?.fitToCoordinates(routePoints, {
      animated: true,
      edgePadding: { top: 88, right: 50, bottom: 110, left: 50 },
    });
    hasFittedLiveVehicles.current = true;
  }, [preview, routePoints, vehicles.length]);

  const mapView = (
    <MapView
      ref={mapRef}
      style={styles.map}
      initialRegion={region}
      onMapReady={fitToRoute}
      onRegionChangeComplete={setMapRegion}
      scrollEnabled
      zoomEnabled
      rotateEnabled={false}
      pitchEnabled={false}
      showsPointsOfInterests={false}
      onMarkerPress={(event) => {
        const stop = visibleStops.find((candidate) => candidate.id === event.nativeEvent.id);
        if (stop) {
          onStopPress?.(stop);
        }
      }}
    >
      {activeVariants.map((variant) => variant.shape.length >= 2 ? <Polyline
        key={`${variant.id}-halo`}
        coordinates={variant.shape}
        strokeColor={isDarkTheme ? "#071b2f" : "#ffffff"}
        strokeWidth={preview ? 7 : 8}
        zIndex={1}
      /> : null)}
      {activeVariants.map((variant, index) => variant.shape.length >= 2 ? <Polyline
        key={variant.id}
        coordinates={variant.shape}
        strokeColor={mapColors[index % mapColors.length]}
        strokeWidth={preview ? 4 : 5}
        zIndex={2}
      /> : null)}
      {!preview && visibleStops.filter((stop) => Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude)).map((stop) => (
        <Marker
          key={stop.id}
          identifier={stop.id}
          coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
          title={stop.name}
          description="Натисніть, щоб переглянути плановий час"
          anchor={{ x: 0.5, y: 0.5 }}
          onPress={() => onStopPress?.(stop)}
        >
          <View style={[
            styles.stopMarker,
            stop.id === selectedStopId && styles.stopMarkerSelected,
          ]} />
        </Marker>
      ))}
      {!preview && vehicleClusters.map((cluster) => {
        const vehicle = cluster.vehicles[0];
        const selected = selectedVehicleId === vehicle.id && cluster.vehicles.length === 1;
        const small = mapRegion.latitudeDelta > 0.035 && !selected;
        return (
        <Marker
          key={cluster.id}
          identifier={cluster.id}
          coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
          title={cluster.vehicles.length > 1 ? `${cluster.vehicles.length} автобуси поруч` : `Автобус ${vehicle.routeNumber}`}
          description={cluster.vehicles.length > 1 ? "Натисніть, щоб наблизити" : `Маршрут ${vehicle.routeNumber} · онлайн GPS`}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges
          zIndex={selected ? 25 : 20}
          onPress={() => {
            if (cluster.vehicles.length > 1) {
              mapRef.current?.animateToRegion({
                latitude: cluster.latitude, longitude: cluster.longitude,
                latitudeDelta: Math.max(mapRegion.latitudeDelta / 2, 0.012),
                longitudeDelta: Math.max(mapRegion.longitudeDelta / 2, 0.012),
              }, 250);
            } else {
              setSelectedVehicleId(vehicle.id);
            }
          }}
        >
          <View collapsable={false} style={[styles.vehicleMarker, small && styles.vehicleMarkerSmall]}>
            <Image source={UZHHOROD_BUS_MARKER} style={[styles.vehicleImage, small && styles.vehicleImageSmall]} />
            <View style={[styles.vehicleRouteBadge, small && styles.vehicleRouteBadgeSmall]}>
              <Text style={[styles.vehicleMarkerText, small && styles.vehicleMarkerTextSmall]}>{vehicle.routeNumber}</Text>
            </View>
            {vehicle.headingDegrees !== null ? <View style={[
              styles.vehicleDirectionBadge,
              small && styles.vehicleDirectionBadgeSmall,
              { transform: [{ rotate: `${vehicle.headingDegrees}deg` }] },
            ]}><Text style={[styles.vehicleDirectionText, small && styles.vehicleDirectionTextSmall]}>↑</Text></View> : null}
            {cluster.vehicles.length > 1 ? <View style={styles.vehicleClusterBadge}><Text style={styles.vehicleClusterText}>+{cluster.vehicles.length - 1}</Text></View> : null}
          </View>
        </Marker>
      );})}
    </MapView>
  );

  // The full-screen map must receive native MapKit gestures directly. Only the
  // small route preview is made non-interactive so its parent card stays tappable.
  return preview ? <View pointerEvents="none" style={styles.map}>{mapView}</View> : mapView;
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  stopMarker: { backgroundColor: "#ffffff", borderColor: "#123a63", borderRadius: 7, borderWidth: 2, height: 12, width: 12 },
  stopMarkerSelected: { backgroundColor: "#e5ae2d", borderColor: "#123a63", borderRadius: 9, height: 16, width: 16 },
  vehicleMarker: { alignItems: "center", height: 54, justifyContent: "center", width: 54 },
  vehicleMarkerSmall: { height: 40, width: 40 },
  vehicleImage: { height: 54, resizeMode: "contain", width: 54 },
  vehicleImageSmall: { height: 40, width: 40 },
  vehicleRouteBadge: { alignItems: "center", backgroundColor: "#123a63", borderColor: "#ffffff", borderRadius: 10, borderWidth: 1.5, justifyContent: "center", minHeight: 20, minWidth: 25, paddingHorizontal: 5, position: "absolute", right: -3, top: -2 },
  vehicleRouteBadgeSmall: { minHeight: 16, minWidth: 20, paddingHorizontal: 3, right: -5, top: -3 },
  vehicleMarkerText: { color: "#ffffff", fontSize: 11, fontWeight: "800" },
  vehicleMarkerTextSmall: { fontSize: 9 },
  vehicleDirectionBadge: { alignItems: "center", backgroundColor: "#ffffff", borderColor: "#123a63", borderRadius: 11, borderWidth: 1.5, height: 22, justifyContent: "center", left: -3, position: "absolute", top: -2, width: 22 },
  vehicleDirectionBadgeSmall: { height: 18, left: -4, top: -3, width: 18 },
  vehicleDirectionText: { color: "#123a63", fontSize: 15, fontWeight: "900", lineHeight: 18 },
  vehicleDirectionTextSmall: { fontSize: 12, lineHeight: 14 },
  vehicleClusterBadge: { alignItems: "center", backgroundColor: "#ffffff", borderColor: "#123a63", borderRadius: 10, borderWidth: 1.5, bottom: -2, justifyContent: "center", minHeight: 20, minWidth: 20, position: "absolute", left: -4 },
  vehicleClusterText: { color: "#123a63", fontSize: 9, fontWeight: "800" },
});
