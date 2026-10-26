import { createElement, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Map as MapLibre, Marker, Popup, NavigationControl, AttributionControl, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Text, useLanguage } from "../i18n/ui";
import { translate } from "../i18n/locale";
import { useAppTheme } from "../ui/theme";
import type { MiniSculpture } from "../api/cityServices";

type Props = {
  sculptures: MiniSculpture[];
};

export function MiniaturesMap({ sculptures }: Props) {
  const dark = useAppTheme();
  const [language] = useLanguage();
  const container = useRef<HTMLDivElement>(null);
  const latest = useRef({ sculptures, dark }); latest.current = { sculptures, dark };
  const update = useRef(() => {});
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    let map: MapLibre;
    const style = (isDark: boolean) => `https://tiles.openfreemap.org/styles/${isDark ? "dark" : "positron"}`;
    try {
      setWorkerUrl("/vendor/maplibre-gl-worker.mjs");
      map = new MapLibre({ container: container.current, style: style(latest.current.dark), center: [22.298, 48.6227],
        zoom: 13, attributionControl: false, canvasContextAttributes: { preserveDrawingBuffer: true } });
    } catch { setFailed(true); return; }
    let alive = true, signature = "", currentStyle = style(latest.current.dark);
    let markers: Marker[] = [];
    map.addControl(new NavigationControl({ showCompass: false }), "top-left");
    map.addControl(new AttributionControl({ compact: true }));
    map.scrollZoom.disable(); map.dragRotate.disable(); map.touchZoomRotate.disableRotation();
    update.current = () => {
      const props = latest.current;
      const nextStyle = style(props.dark);
      if (nextStyle !== currentStyle) { currentStyle = nextStyle; map.setStyle(nextStyle); }
      const key = JSON.stringify([props.sculptures, props.dark]);
      if (key !== signature) {
        signature = key; markers.forEach(marker => marker.remove());
        markers = props.sculptures.map(point => {
          const button = document.createElement("button"); button.type = "button";
          button.setAttribute("aria-label", point.title); button.title = point.title;
          Object.assign(button.style, { width: "44px", height: "44px", padding: "14px", background: "transparent", border: "0", cursor: "pointer" });
          const dot = document.createElement("span");
          Object.assign(dot.style, { display: "block", width: "14px", height: "14px", borderRadius: "50%", border: "2px solid #fff", background: "#126cc3", boxShadow: "0 1px 4px #0005" });
          button.append(dot);
          const label = document.createElement("div"); const title = document.createElement("strong"); const address = document.createElement("div");
          title.textContent = point.title; address.textContent = point.address;
          Object.assign(label.style, { font: "13px/19px system-ui", color: "#123a63", maxWidth: "240px" });
          label.append(title, address);
          return new Marker({ element: button, anchor: "center" }).setLngLat([point.longitude, point.latitude])
            .setPopup(new Popup({ closeButton: false, offset: 10 }).setDOMContent(label)).addTo(map);
        });
        if (props.sculptures.length) {
          const longs = props.sculptures.map(point => point.longitude), lats = props.sculptures.map(point => point.latitude);
          map.fitBounds([[Math.min(...longs), Math.min(...lats)], [Math.max(...longs), Math.max(...lats)]],
            { padding: 32, maxZoom: 16, duration: 0 });
        }
      }
      for (const [selector, text] of [[".maplibregl-ctrl-zoom-in", "Збільшити масштаб"], [".maplibregl-ctrl-zoom-out", "Зменшити масштаб"]]) {
        const control = container.current?.querySelector<HTMLButtonElement>(selector);
        if (control) { control.title = translate(text); control.setAttribute("aria-label", translate(text)); }
      }
    };
    map.on("error", () => { if (alive) setFailed(true); });
    map.on("idle", () => { if (alive && map.isStyleLoaded()) setFailed(false); });
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => map.resize()) : undefined;
    observer?.observe(container.current); update.current();
    return () => { alive = false; observer?.disconnect(); update.current = () => {}; markers.forEach(marker => marker.remove()); map.remove(); };
  }, []);
  useEffect(() => update.current(), [sculptures, dark, language]);
  return <View style={{ flex: 1 }}>
    {createElement("style", null, ".miniatures-map .maplibregl-ctrl-group button{width:44px;height:44px}.miniatures-map .maplibregl-ctrl-attrib{font-size:10px}")}
    {createElement("div", { ref: container, className: "miniatures-map", role: "region", "aria-label": translate("Мапа мініскульптур"), style: { width: "100%", height: "100%", touchAction: "none" } })}
    {failed && <View style={{ position: "absolute", bottom: 28, left: 8, right: 8, backgroundColor: "#fff", borderRadius: 8, padding: 10 }}><Text style={{ color: "#123a63", fontSize: 13, lineHeight: 18 }}>Мапа недоступна. Локації є у списку нижче.</Text></View>}
  </View>;
}
