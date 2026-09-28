import { createElement, useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
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

type WebMapMessage = {
  source?: string;
  stopId?: string;
};

export function RouteMap({ map, region, preview = false, activeVariantId, stops, selectedStopId, vehicles = [], onStopPress }: Props) {
  const visibleStops = stops ?? map.stops;
  const activeVariants = activeVariantId
    ? map.variants.filter((variant) => variant.id === activeVariantId)
    : map.variants;

  useEffect(() => {
    function handleMessage(event: MessageEvent<WebMapMessage>) {
      if (event.data?.source !== "uzhhorod-route-map" || !event.data.stopId) {
        return;
      }
      const stop = visibleStops.find((item) => item.id === event.data.stopId);
      if (stop) {
        onStopPress?.(stop);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onStopPress, visibleStops]);

  const document = useMemo(() => createMapDocument({
    region,
    selectedStopId,
    shapes: activeVariants.map((variant) => variant.shape),
    stops: visibleStops,
    vehicles,
  }), [activeVariants, region, selectedStopId, vehicles, visibleStops]);

  return (
    <View style={styles.map}>
      {createElement("iframe", {
        title: preview ? "Схема маршруту" : "Інтерактивна карта маршруту",
        srcDoc: document,
        style: { ...iframeStyle, pointerEvents: preview ? "none" : "auto" },
      })}
    </View>
  );
}

function createMapDocument({
  region,
  selectedStopId,
  shapes,
  stops,
  vehicles,
}: {
  region: MapRegion;
  selectedStopId?: string;
  shapes: Array<Array<{ latitude: number; longitude: number }>>;
  stops: TransportStop[];
  vehicles: TransportVehiclePosition[];
}) {
  const safeJson = JSON.stringify({ region, selectedStopId, shapes, stops, vehicles }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="uk">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>html,body,#map{height:100%;margin:0}.leaflet-control-attribution{font-size:9px}</style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      const data = ${safeJson};
      const map = L.map('map', { zoomControl: true, attributionControl: true }).setView([data.region.latitude, data.region.longitude], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
      const bounds = [];
      data.shapes.forEach((shape) => {
        const points = shape.filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude)).map((point) => [point.latitude, point.longitude]);
        if (points.length > 1) {
          L.polyline(points, { color: '#123a63', weight: 5, opacity: 0.9 }).addTo(map);
          bounds.push(...points);
        }
      });
      data.stops.filter((stop) => Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude)).forEach((stop) => {
        const selected = stop.id === data.selectedStopId;
        const marker = L.circleMarker([stop.latitude, stop.longitude], { color: selected ? '#ffffff' : '#123a63', fillColor: selected ? '#e5ae2d' : '#ffffff', fillOpacity: 1, radius: selected ? 9 : 7, weight: selected ? 4 : 3 }).addTo(map);
        marker.bindTooltip(stop.name, { direction: 'top', offset: [0, -7] });
        marker.on('click', () => window.parent.postMessage({ source: 'uzhhorod-route-map', stopId: stop.id }, '*'));
        bounds.push([stop.latitude, stop.longitude]);
      });
      data.vehicles.filter((vehicle) => Number.isFinite(vehicle.latitude) && Number.isFinite(vehicle.longitude)).forEach((vehicle) => {
        const icon = L.divIcon({ className: '', html: '<div style="background:#123a63;border:2px solid #fff;border-radius:14px;color:#fff;font:700 11px sans-serif;min-width:28px;padding:5px 4px;text-align:center">' + vehicle.routeNumber + '</div>', iconAnchor: [14, 14] });
        L.marker([vehicle.latitude, vehicle.longitude], { icon }).bindTooltip('Автобус ' + vehicle.routeNumber).addTo(map);
      });
      if (bounds.length > 1) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 });
    </script>
  </body>
</html>`;
}

const iframeStyle = { border: 0, height: "100%", width: "100%" };

const styles = StyleSheet.create({
  map: { backgroundColor: "#e9eef5", flex: 1, minHeight: 190, overflow: "hidden" },
});
