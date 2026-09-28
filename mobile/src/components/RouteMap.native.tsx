import MapView, { Marker, Polyline } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { Image, StyleSheet, Text, View } from "react-native";
import { useEffect, useRef } from "react";
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

const MAP_COLORS = ["#123a63", "#e5ae2d", "#3d6836", "#9f1239"];
const UZHHOROD_BUS_MARKER = require("../../assets/transport/uzhhorod-elektron-marker.png");

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
  const mapRef = useRef<MapView>(null);
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
      scrollEnabled
      zoomEnabled
      rotateEnabled={false}
      pitchEnabled={false}
      onMarkerPress={(event) => {
        const stop = visibleStops.find((candidate) => candidate.id === event.nativeEvent.id);
        if (stop) {
          onStopPress?.(stop);
        }
      }}
    >
      {activeVariants.map((variant, index) => (
        variant.shape.length >= 2 ? <Polyline
          key={variant.id}
          coordinates={variant.shape}
          strokeColor={MAP_COLORS[index % MAP_COLORS.length]}
          strokeWidth={preview ? 4 : 5}
        /> : null
      ))}
      {!preview && visibleStops.filter((stop) => Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude)).map((stop, index, stopsOnMap) => (
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
            index === 0 && styles.stopMarkerStart,
            index === stopsOnMap.length - 1 && styles.stopMarkerEnd,
            stop.id === selectedStopId && styles.stopMarkerSelected,
          ]} />
        </Marker>
      ))}
      {!preview && vehicles.map((vehicle) => (
        <Marker
          key={vehicle.id}
          identifier={vehicle.id}
          coordinate={{ latitude: vehicle.latitude, longitude: vehicle.longitude }}
          title={`Автобус ${vehicle.routeNumber}`}
          description={vehicle.speedKph === null ? "Онлайн GPS" : `${vehicle.speedKph} км/год`}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges
          zIndex={20}
        >
          <View collapsable={false} style={styles.vehicleMarker}>
            {typeof vehicle.headingDegrees === "number" ? <View style={[
              styles.vehicleHeading,
              { transform: [{ rotate: `${vehicle.headingDegrees}deg` }] },
            ]}>
              <Ionicons name="arrow-up" size={15} color="#123a63" />
            </View> : null}
            <Image source={UZHHOROD_BUS_MARKER} style={styles.vehicleImage} />
            <View style={styles.vehicleRouteBadge}>
              <Text style={styles.vehicleMarkerText}>{vehicle.routeNumber}</Text>
            </View>
          </View>
        </Marker>
      ))}
    </MapView>
  );

  // The full-screen map must receive native MapKit gestures directly. Only the
  // small route preview is made non-interactive so its parent card stays tappable.
  return preview ? <View pointerEvents="none" style={styles.map}>{mapView}</View> : mapView;
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  stopMarker: { backgroundColor: "#ffffff", borderColor: "#123a63", borderRadius: 9, borderWidth: 3, height: 18, width: 18 },
  stopMarkerStart: { borderColor: "#3d6836" },
  stopMarkerEnd: { backgroundColor: "#e5ae2d", borderColor: "#ffffff" },
  stopMarkerSelected: { backgroundColor: "#e5ae2d", borderColor: "#123a63", borderRadius: 12, height: 24, width: 24 },
  vehicleMarker: { alignItems: "center", height: 54, justifyContent: "center", width: 54 },
  vehicleImage: { height: 54, resizeMode: "contain", width: 54 },
  vehicleHeading: { alignItems: "center", backgroundColor: "#ffffff", borderColor: "#d8e0eb", borderRadius: 12, borderWidth: 1, height: 24, justifyContent: "center", position: "absolute", top: -13, width: 24, zIndex: 1 },
  vehicleRouteBadge: { alignItems: "center", backgroundColor: "#123a63", borderColor: "#ffffff", borderRadius: 10, borderWidth: 1.5, justifyContent: "center", minHeight: 20, minWidth: 25, paddingHorizontal: 5, position: "absolute", right: -3, top: -2 },
  vehicleMarkerText: { color: "#ffffff", fontSize: 11, fontWeight: "800" },
});
