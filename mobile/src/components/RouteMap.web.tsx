import { createElement, useEffect, useMemo } from "react";
import { Image, StyleSheet, View } from "react-native";
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

const UZHHOROD_BUS_MARKER = require("../../assets/transport/uzhhorod-elektron-marker.png");

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
    vehicles: preview ? [] : vehicles,
    busMarkerUri: Image.resolveAssetSource(UZHHOROD_BUS_MARKER).uri,
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
  busMarkerUri,
}: {
  region: MapRegion;
  selectedStopId?: string;
  shapes: Array<Array<{ latitude: number; longitude: number }>>;
  stops: TransportStop[];
  vehicles: TransportVehiclePosition[];
  busMarkerUri: string;
}) {
  const safeJson = JSON.stringify({ region, selectedStopId, shapes, stops, vehicles, busMarkerUri }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="uk">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>html,body,#map{height:100%;margin:0}.leaflet-control-attribution{font-size:9px}.bus-marker{position:relative;width:54px;height:54px}.bus-marker img{width:100%;height:100%;object-fit:contain}.bus-route{position:absolute;right:-2px;top:-2px;min-width:19px;padding:2px 4px;background:#123a63;border:1px solid white;border-radius:9px;color:white;font:700 10px sans-serif;text-align:center}.bus-direction{position:absolute;left:-3px;top:-2px;width:22px;height:22px;background:white;border:1.5px solid #123a63;border-radius:50%;color:#123a63;font:900 15px/20px sans-serif;text-align:center;transform-origin:center}.bus-marker-small{width:40px;height:40px}.bus-marker-small .bus-route{font-size:9px;min-width:15px;padding:1px 3px}.bus-marker-small .bus-direction{left:-4px;top:-3px;width:18px;height:18px;font-size:12px;line-height:17px}.bus-count{position:absolute;left:-4px;bottom:-2px;min-width:17px;padding:2px;background:white;border:1px solid #123a63;border-radius:9px;color:#123a63;font:800 9px sans-serif;text-align:center}</style>
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
          L.polyline(points, { color: '#071b2f', weight: 8, opacity: 0.96 }).addTo(map);
          L.polyline(points, { color: '#123a63', weight: 5, opacity: 0.98 }).addTo(map);
          bounds.push(...points);
        }
      });
      data.stops.filter((stop) => Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude)).forEach((stop) => {
        const selected = stop.id === data.selectedStopId;
        const marker = L.circleMarker([stop.latitude, stop.longitude], { color: '#123a63', fillColor: selected ? '#e5ae2d' : '#ffffff', fillOpacity: 1, radius: selected ? 8 : 6, weight: selected ? 3 : 2 }).addTo(map);
        marker.bindTooltip(stop.name, { direction: 'top', offset: [0, -7] });
        marker.on('click', () => window.parent.postMessage({ source: 'uzhhorod-route-map', stopId: stop.id }, '*'));
        bounds.push([stop.latitude, stop.longitude]);
      });
      const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
      const busMarkers = [];
      let selectedBusId = null;
      const busIcon = (routeNumber, count, selected, headingDegrees) => {
        const small = map.getZoom() <= 13 && !selected;
        const size = small ? 40 : 54;
        const heading = Number.isFinite(headingDegrees) ? '<span class="bus-direction" style="transform:rotate(' + Number(headingDegrees) + 'deg)">↑</span>' : '';
        return L.divIcon({ className: '', html: '<div class="bus-marker' + (small ? ' bus-marker-small' : '') + '"><img src="' + escapeHtml(data.busMarkerUri) + '" alt=""/><span class="bus-route">' + escapeHtml(routeNumber) + '</span>' + heading + (count > 1 ? '<span class="bus-count">+' + (count - 1) + '</span>' : '') + '</div>', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
      };
      const renderBuses = () => {
        busMarkers.forEach((marker) => marker.remove());
        busMarkers.length = 0;
        const clusters = [];
        data.vehicles.filter((vehicle) => Number.isFinite(vehicle.latitude) && Number.isFinite(vehicle.longitude)).forEach((vehicle) => {
          const point = map.latLngToContainerPoint([vehicle.latitude, vehicle.longitude]);
          const nearby = map.getZoom() <= 13 ? clusters.find((cluster) => cluster.point.distanceTo(point) < 44) : null;
          if (nearby) nearby.vehicles.push(vehicle);
          else clusters.push({ point, vehicles: [vehicle] });
        });
        clusters.forEach((cluster) => {
          const vehicle = cluster.vehicles[0];
          const marker = L.marker([vehicle.latitude, vehicle.longitude], { icon: busIcon(vehicle.routeNumber, cluster.vehicles.length, selectedBusId === vehicle.id, vehicle.headingDegrees), zIndexOffset: selectedBusId === vehicle.id ? 1100 : 1000 })
            .bindTooltip(cluster.vehicles.length > 1 ? cluster.vehicles.length + ' автобуси поруч · натисніть, щоб наблизити' : 'Автобус ' + vehicle.routeNumber).addTo(map);
          marker.on('click', () => {
            if (cluster.vehicles.length > 1) map.setView([vehicle.latitude, vehicle.longitude], Math.min(map.getZoom() + 2, 18));
            else { selectedBusId = vehicle.id; renderBuses(); }
          });
          busMarkers.push(marker);
        });
      };
      if (bounds.length > 1) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 });
      renderBuses();
      map.on('zoomend moveend', renderBuses);
    </script>
  </body>
</html>`;
}

const iframeStyle = { border: 0, height: "100%", width: "100%" };

const styles = StyleSheet.create({
  map: { backgroundColor: "#e9eef5", flex: 1, minHeight: 190, overflow: "hidden" },
});
