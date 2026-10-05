import { createElement, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import type { OfficialMapPoint } from "./OfficialLayerMap.native";

type Props = {
  tileTemplate?: string;
  points?: OfficialMapPoint[];
  pinColor?: string;
};

export function OfficialLayerMap({ tileTemplate, points = [], pinColor = "#c2410c" }: Props) {
  const document = useMemo(() => `<!doctype html><html lang="uk"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" /><style>html,body,#map{height:100%;margin:0}.leaflet-control-attribution{font-size:9px}.point-label{font:600 13px system-ui;color:#13213c}.point-address{font:12px system-ui;color:#55657a;margin-top:3px}</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>const map=L.map('map',{zoomControl:true}).setView([48.6208,22.2879],13);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);${tileTemplate ? `L.tileLayer(${JSON.stringify(tileTemplate)},{minZoom:10,maxZoom:19,opacity:1}).addTo(map);` : ""}const points=${JSON.stringify(points).replace(/</g, "\\u003c")};points.forEach(point=>{const marker=L.circleMarker([point.latitude,point.longitude],{radius:8,color:'#fff',weight:3,fillColor:${JSON.stringify(pinColor)},fillOpacity:1}).addTo(map);const popup=document.createElement('div');const title=document.createElement('div');title.className='point-label';title.textContent=point.name;const address=document.createElement('div');address.className='point-address';address.textContent=point.address;popup.append(title,address);marker.bindPopup(popup);});</script></body></html>`, [pinColor, points, tileTemplate]);
  return <View style={styles.map}>{createElement("iframe", { title: "Міська мапа", srcDoc: document, style: iframeStyle })}</View>;
}

const iframeStyle = { border: 0, height: "100%", width: "100%" };
const styles = StyleSheet.create({ map: { flex: 1, minHeight: 220 } });
