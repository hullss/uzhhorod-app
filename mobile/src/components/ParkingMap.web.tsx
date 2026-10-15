import { createElement, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Map as MapLibre, Marker, NavigationControl, AttributionControl, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection, LineString } from "geojson";
import { Text, useLanguage } from "../i18n/ui";
import { translate } from "../i18n/locale";
import type { ParkingMapProps } from "./ParkingMap.types";

const STYLE = (dark: boolean) => `https://tiles.openfreemap.org/styles/${dark ? "dark" : "positron"}`;
const SOURCE = "parking-sections";
type PriceMarker = { id: string; marker: Marker; button: HTMLButtonElement };

export function ParkingMap({ dark, zones, selectedId, onSelect, onInteractionChange }: ParkingMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const latest = useRef({ dark, zones, selectedId, onSelect, onInteractionChange }); latest.current = { dark, zones, selectedId, onSelect, onInteractionChange };
  const update = useRef<() => void>(() => {});
  const [failed, setFailed] = useState(false);
  const [language] = useLanguage();
  useEffect(() => {
    if (!container.current || !latest.current.zones.length) return;
    const initial = latest.current.zones.find(zone => zone.id === latest.current.selectedId) ?? latest.current.zones[0];
    let map: MapLibre;
    try {
      setWorkerUrl("/vendor/maplibre-gl-worker.mjs");
      map = new MapLibre({ container: container.current, style: STYLE(latest.current.dark), center: [initial.center.longitude, initial.center.latitude], zoom: 17, attributionControl: false, canvasContextAttributes: { preserveDrawingBuffer: true } });
    } catch { setFailed(true); return; }
    let markers: PriceMarker[] = [], signature = "", currentStyle = STYLE(latest.current.dark), currentId = latest.current.selectedId;
    let alive = true;
    map.addControl(new NavigationControl({ showCompass: false }), "top-left");
    map.addControl(new AttributionControl({ compact: false }));
    map.scrollZoom.disable(); map.dragRotate.disable(); map.touchZoomRotate.disableRotation();
    const drawLines = () => {
      if (!map.isStyleLoaded()) return;
      const data: FeatureCollection<LineString> = { type: "FeatureCollection", features: latest.current.zones.flatMap(zone => zone.sections.map(section => ({ type: "Feature", properties: { id: zone.id }, geometry: { type: "LineString", coordinates: section.map(point => [point.longitude, point.latitude]) } }))) };
      const source = map.getSource(SOURCE);
      if (source?.type === "geojson") (source as GeoJSONSource).setData(data);
      else if (!source) {
        map.addSource(SOURCE, { type: "geojson", data });
        map.addLayer({ id: "parking-halo", type: "line", source: SOURCE, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 12 } });
        map.addLayer({ id: "parking-lines", type: "line", source: SOURCE, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#5593c9", "line-width": 5 } });
      }
      map.setPaintProperty("parking-lines", "line-color", ["case", ["==", ["get", "id"], latest.current.selectedId], "#0c64c7", "#5593c9"]);
      map.setPaintProperty("parking-lines", "line-width", ["case", ["==", ["get", "id"], latest.current.selectedId], 8, 5]);
    };
    update.current = () => {
      const props = latest.current;
      const nextStyle = STYLE(props.dark);
      if (nextStyle !== currentStyle) { currentStyle = nextStyle; map.setStyle(nextStyle); }
      const key = JSON.stringify([props.zones, translate("25 грн за годину"), props.zones.map(zone => translate(zone.name))]);
      if (key !== signature) {
        signature = key; markers.forEach(({ marker }) => marker.remove());
        markers = props.zones.map(zone => {
          const button = document.createElement("button"); button.type = "button";
          button.textContent = "25 ₴"; button.setAttribute("aria-label", `${translate(zone.name)}, ${translate("25 грн за годину")}`);
          Object.assign(button.style, { minWidth: "68px", minHeight: "44px", padding: "0 12px", borderRadius: "24px", font: "700 15px system-ui", boxShadow: "0 2px 8px #0002", cursor: "pointer" });
          button.addEventListener("click", event => { event.stopPropagation(); latest.current.onSelect(zone.id); });
          return { id: zone.id, button, marker: new Marker({ element: button, anchor: "center" }).setLngLat([zone.center.longitude, zone.center.latitude]).addTo(map) };
        });
      }
      markers.forEach(({ id, button }) => {
        const selected = id === props.selectedId;
        button.setAttribute("aria-pressed", String(selected));
        Object.assign(button.style, { background: selected ? "#123a63" : "#ffffff", color: selected ? "#ffffff" : "#123a63", border: `2px solid ${selected ? "#ffffff" : "#123a63"}`, zIndex: selected ? "10" : "1" });
      });
      for (const [selector, label] of [[".maplibregl-ctrl-zoom-in", "Збільшити масштаб"], [".maplibregl-ctrl-zoom-out", "Зменшити масштаб"]]) {
        const button = container.current?.querySelector<HTMLButtonElement>(selector);
        if (button) { button.title = translate(label); button.setAttribute("aria-label", translate(label)); }
      }
      if (currentId !== props.selectedId) { currentId = props.selectedId; const zone = props.zones.find(zone => zone.id === currentId); if (zone) map.flyTo({ center: [zone.center.longitude, zone.center.latitude], zoom: 17, duration: 350 }); }
      drawLines();
    };
    map.on("style.load", () => { drawLines(); if (alive) setFailed(false); });
    map.on("idle", () => { if (!map.getSource(SOURCE)) drawLines(); });
    map.on("error", () => { if (alive) setFailed(true); });
    map.on("click", "parking-lines", event => { const id = event.features?.[0]?.properties?.id; if (latest.current.zones.some(zone => zone.id === id)) latest.current.onSelect(id); });
    const resize = () => map.resize();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : undefined;
    observer?.observe(container.current);
    const pointers = new Set<number>();
    const start = (event: PointerEvent) => { pointers.add(event.pointerId); latest.current.onInteractionChange?.(true); };
    const end = (event: PointerEvent) => { pointers.delete(event.pointerId); latest.current.onInteractionChange?.(pointers.size > 0); };
    const release = () => { pointers.clear(); latest.current.onInteractionChange?.(false); };
    const element = container.current;
    element.addEventListener("pointerdown", start, { capture: true });
    window.addEventListener("pointerup", end); window.addEventListener("pointercancel", end); window.addEventListener("blur", release);
    update.current();
    return () => { alive = false; element.removeEventListener("pointerdown", start, { capture: true }); window.removeEventListener("pointerup", end); window.removeEventListener("pointercancel", end); window.removeEventListener("blur", release); release(); observer?.disconnect(); update.current = () => {}; markers.forEach(({ marker }) => marker.remove()); map.remove(); };
  }, []);
  useEffect(() => update.current(), [dark, zones, selectedId, language]);
  return <View style={{ flex: 1 }}>
    {createElement("style", null, ".parking-map .maplibregl-ctrl-group button{width:44px;height:44px}.parking-map .maplibregl-ctrl-attrib{font-size:11px;line-height:16px}")}
    {createElement("div", { ref: container, className: "parking-map", role: "region", "aria-label": translate("Мапа паркування"), style: { width: "100%", height: "100%", touchAction: "none", overscrollBehavior: "contain" } })}
    {failed && <View style={{ position: "absolute", bottom: 28, left: 8, right: 8, backgroundColor: "#ffffff", borderRadius: 8, padding: 10 }}><Text style={{ color: "#123a63", fontSize: 13, lineHeight: 18 }}>Мапа недоступна. Виберіть майданчик зі списку нижче.</Text></View>}
  </View>;
}
