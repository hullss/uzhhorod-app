import { createElement, useEffect, useMemo, useRef } from "react";
import { getLanguage, translate } from "../i18n/locale";
import { StyleSheet, View } from "react-native";
import { useAppTheme } from "../ui/theme";
import type { OfficialMapPoint } from "./OfficialLayerMap.native";
type Props = { tileTemplate?: string; points?: OfficialMapPoint[]; pinColor?: string; onPointPress?: (point: OfficialMapPoint) => void };
const json = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");
export function OfficialLayerMap({ tileTemplate, points = [], pinColor = "#c2410c", onPointPress }: Props) {
  const dark = useAppTheme(); const language = getLanguage();
  const frame = useRef<HTMLIFrameElement>(null); const latest = useRef(points); latest.current = points;
  const update = () => frame.current?.contentWindow?.postMessage({ type: "city-map-data", points: latest.current, pinColor }, "*");
  useEffect(update, [points, pinColor]);
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.data?.type !== "city-map-point") return;
      const point = latest.current.find(item => item.id === event.data.id); if (point) onPointPress?.(point);
    };
    window.addEventListener("message", listener); return () => window.removeEventListener("message", listener);
  }, [onPointPress]);
  const document = useMemo(() => `<!doctype html><html lang="${language}"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" /><style>html,body,#map{height:100%;margin:0;background:${dark ? "#071b2f" : "#f6f7fb"}}.leaflet-control-attribution{font-size:9px}.point-label{font:600 13px system-ui;color:#13213c}.point-address{font:12px system-ui;color:#55657a;margin-top:3px}</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
    const map=L.map('map',{zoomControl:true}).setView([48.6208,22.2879],13);
    const base=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
    ${tileTemplate ? `L.tileLayer(${json(tileTemplate)},{minZoom:10,maxZoom:19,opacity:1}).addTo(map);` : ""}
    let tileErrors=0;base.on('tileerror',()=>{if(++tileErrors<3)return;if(map.hasLayer(base))map.removeLayer(base);if(document.getElementById('tile-warning'))return;const notice=document.createElement('div');notice.id='tile-warning';notice.textContent=${json(translate("Основа мапи недоступна. Позначки й список залишаються доступними."))};notice.style.cssText='position:absolute;bottom:20px;left:12px;right:12px;z-index:800;background:#fff;color:#13213c;padding:10px;border-radius:8px;font:13px/18px system-ui;pointer-events:none';document.body.appendChild(notice);});
    let markers=[];let signature='';
    function draw(points,pinColor){const key=JSON.stringify([points,pinColor]);if(key===signature)return;signature=key;markers.forEach(marker=>map.removeLayer(marker));markers=[];points.forEach(point=>{const marker=L.circleMarker([point.latitude,point.longitude],{radius:8,color:'#fff',weight:3,fillColor:pinColor,fillOpacity:1}).addTo(map);const popup=document.createElement('div');const title=document.createElement('div');title.className='point-label';title.textContent=point.name;const address=document.createElement('div');address.className='point-address';address.textContent=point.address;popup.append(title,address);marker.bindPopup(popup);marker.on('click',()=>parent.postMessage({type:'city-map-point',id:point.id},'*'));markers.push(marker);});}
    draw(${json(points)},${json(pinColor)});
    window.addEventListener('message',event=>{if(event.source!==parent||event.data?.type!=='city-map-data'||!Array.isArray(event.data.points))return;draw(event.data.points,event.data.pinColor);});
  </script></body></html>`, [tileTemplate, dark, language]);
  return <View style={styles.map}>{createElement("iframe", { ref: frame, title: translate("Міська мапа"), srcDoc: document, sandbox: "allow-scripts", onLoad: update, style: { border: 0, height: "100%", width: "100%" } })}</View>;
}
const styles = StyleSheet.create({ map: { flex: 1, minHeight: 220 } });
