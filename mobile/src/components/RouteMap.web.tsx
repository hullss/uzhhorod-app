import { createElement, useEffect, useMemo, useRef } from "react";
import { Asset } from "expo-asset";
import { getLanguage, translate } from "../i18n/locale";
import { StyleSheet, View } from "react-native";
import { useAppTheme } from "../ui/theme";
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
  const dark = useAppTheme(); const language = getLanguage();
  const frame = useRef<HTMLIFrameElement>(null);
  const visibleStops = stops ?? map.stops;
  const activeVariants = activeVariantId
    ? map.variants.filter((variant) => variant.id === activeVariantId)
    : map.variants;

  useEffect(() => {
    function handleMessage(event: MessageEvent<WebMapMessage>) {
      if (event.source !== frame.current?.contentWindow || event.data?.source !== "uzhhorod-route-map" || !event.data.stopId) {
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

  const latest = useRef({ selectedStopId, vehicles, stops: visibleStops, shapes: activeVariants.map(v => v.shape) });
  latest.current = { selectedStopId, vehicles: preview ? [] : vehicles, stops: visibleStops, shapes: activeVariants.map(v => v.shape) };
  const update = () => frame.current?.contentWindow?.postMessage({ type: "uzhhorod-route-data", ...latest.current }, "*");
  useEffect(update, [selectedStopId, vehicles, visibleStops, map]);
  const document = useMemo(() => createMapDocument({
    region,
    selectedStopId,
    shapes: activeVariants.map((variant) => variant.shape),
    stops: visibleStops,
    vehicles: preview ? [] : vehicles,
    busMarkerUri: Asset.fromModule(UZHHOROD_BUS_MARKER).uri,
    dark,
  // Reload only for an actual route/direction/theme change. GPS and clock ticks use messages.
  }), [map.routeId, activeVariantId, preview, dark, language]);

  return (
    <View style={styles.map}>
      {createElement("iframe", {
        ref: frame,
        title: translate(preview ? "Схема маршруту" : "Інтерактивна карта маршруту"),
        srcDoc: document,
        sandbox: "allow-scripts",
        onLoad: update,
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
  dark,
}: {
  region: MapRegion;
  selectedStopId?: string;
  shapes: Array<Array<{ latitude: number; longitude: number }>>;
  stops: TransportStop[];
  vehicles: TransportVehiclePosition[];
  busMarkerUri: string;
  dark: boolean;
}) {
  const safeJson = JSON.stringify({ region, selectedStopId, shapes, stops, vehicles, busMarkerUri, busLabel: translate("Автобус"), clusterLabel: translate("автобуси поруч · натисніть, щоб наблизити") }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="${getLanguage()}">
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
      let data = ${safeJson};
      const map = L.map('map', { zoomControl: true, attributionControl: true }).setView([data.region.latitude, data.region.longitude], 13);
      const base = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
      let tileErrors = 0;
      base.on('tileerror', () => { if (++tileErrors < 3) return; if (map.hasLayer(base)) map.removeLayer(base); if (document.getElementById('tile-warning')) return; const warning = document.createElement('div'); warning.id = 'tile-warning'; warning.textContent = ${JSON.stringify(translate("Основа мапи недоступна. Позначки й список залишаються доступними."))}; warning.style.cssText = 'position:absolute;bottom:20px;left:12px;right:12px;z-index:800;background:white;color:#13213c;padding:10px;border-radius:8px;font:13px/18px system-ui;pointer-events:none'; document.body.appendChild(warning); });
      const bounds = [];
      const routeLines = []; let shapeKey = ''; let initialBounds = true;
      const drawShapes = () => {
      const key = JSON.stringify(data.shapes); if(key === shapeKey) return; shapeKey = key;
      routeLines.forEach(line=>line.remove()); routeLines.length=0;
      data.shapes.forEach((shape) => {
        const points = shape.filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude)).map((point) => [point.latitude, point.longitude]);
        if (points.length > 1) {
          routeLines.push(L.polyline(points, { color: '${dark ? "#071b2f" : "#ffffff"}', weight: 8, opacity: 0.96 }).addTo(map));
          routeLines.push(L.polyline(points, { color: '${dark ? "#38bdf8" : "#123a63"}', weight: 5, opacity: 0.98 }).addTo(map));
          if (initialBounds) bounds.push(...points);
        }
      }); }; drawShapes();
      const stopMarkers = []; let stopKey = '';
      const drawStops = () => {
      const key = JSON.stringify([data.stops,data.selectedStopId]); if(key===stopKey) return; stopKey=key;
      stopMarkers.forEach(marker=>marker.remove()); stopMarkers.length=0;
      data.stops.filter((stop) => Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude)).forEach((stop) => {
        const selected = stop.id === data.selectedStopId;
        const marker = L.circleMarker([stop.latitude, stop.longitude], { color: '#123a63', fillColor: selected ? '#e5ae2d' : '#ffffff', fillOpacity: 1, radius: selected ? 8 : 6, weight: selected ? 3 : 2 }).addTo(map);
        const stopLabel = document.createElement('span'); stopLabel.textContent = stop.name;
        marker.bindTooltip(stopLabel, { direction: 'top', offset: [0, -7] });
        stopMarkers.push(marker);
        marker.on('click', () => window.parent.postMessage({ source: 'uzhhorod-route-map', stopId: stop.id }, '*'));
        if (initialBounds) bounds.push([stop.latitude, stop.longitude]);
      }); }; drawStops();
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
            .bindTooltip((()=>{const label=document.createElement('span');label.textContent=cluster.vehicles.length > 1 ? cluster.vehicles.length + ' ' + data.clusterLabel : data.busLabel + ' ' + vehicle.routeNumber;return label;})()).addTo(map);
          marker.on('click', () => {
            if (cluster.vehicles.length > 1) map.setView([vehicle.latitude, vehicle.longitude], Math.min(map.getZoom() + 2, 18));
            else { selectedBusId = vehicle.id; renderBuses(); }
          });
          busMarkers.push(marker);
        });
      };
      if (bounds.length > 1) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 });
      initialBounds = false; bounds.length = 0;
      renderBuses();
      map.on('zoomend moveend', renderBuses);
      window.addEventListener('message', event => {
        const next=event.data;
        if(event.source!==parent || next?.type!=='uzhhorod-route-data' || !Array.isArray(next.vehicles) || !Array.isArray(next.stops) || !Array.isArray(next.shapes)) return;
        data={...data,vehicles:next.vehicles,stops:next.stops,shapes:next.shapes,selectedStopId:next.selectedStopId};
        drawShapes(); drawStops(); renderBuses();
        // Deliberately no fitBounds/setView on updates: the user owns the viewport.
      });
    </script>
  </body>
</html>`;
}

const iframeStyle = { border: 0, height: "100%", width: "100%" };

const styles = StyleSheet.create({
  map: { backgroundColor: "#e9eef5", flex: 1, minHeight: 190, overflow: "hidden" },
});
