import { Fragment, useEffect, useRef } from "react";
import { View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { Text } from "../i18n/ui";
import { translate } from "../i18n/locale";
import type { ParkingMapProps } from "./ParkingMap.types";

export function ParkingMap({ dark, zones, selectedId, onSelect, onInteractionChange }: ParkingMapProps) {
  const map = useRef<MapView>(null);
  const previous = useRef(selectedId);
  const touching = useRef(false);
  const interaction = useRef(onInteractionChange); interaction.current = onInteractionChange;
  useEffect(() => () => interaction.current?.(false), []);
  useEffect(() => {
    if (previous.current === selectedId) return;
    previous.current = selectedId;
    const zone = zones.find(item => item.id === selectedId);
    if (zone) map.current?.animateToRegion({ ...zone.center, latitudeDelta: .0034, longitudeDelta: .0045 }, 300);
  }, [selectedId, zones]);
  return <MapView ref={map} style={{ flex: 1 }} userInterfaceStyle={dark ? "dark" : "light"}
    onTouchStart={() => { touching.current = true; interaction.current?.(true); }} onTouchMove={() => interaction.current?.(true)}
    onTouchEnd={event => { touching.current = (event.nativeEvent.touches?.length ?? 0) > 0; interaction.current?.(touching.current); }}
    onTouchCancel={() => { touching.current = false; interaction.current?.(false); }}
    onRegionChange={() => interaction.current?.(true)}
    onRegionChangeComplete={() => { if (!touching.current) interaction.current?.(false); }}
    initialRegion={{ ...(zones.find(zone => zone.id === selectedId) ?? zones[0]).center, latitudeDelta: .0034, longitudeDelta: .0045 }}
    onMapReady={() => map.current?.fitToCoordinates((zones.find(zone => zone.id === selectedId) ?? zones[0]).sections.flat(), { edgePadding: { top: 48, bottom: 38, left: 48, right: 48 }, animated: false })}
    rotateEnabled={false} pitchEnabled={false} toolbarEnabled={false}>
    {zones.map(zone => <Fragment key={zone.id}>
      {zone.sections.map((coordinates, index) => <Fragment key={`${zone.id}-${index}`}>
        <Polyline coordinates={coordinates} strokeColor="#ffffff" strokeWidth={selectedId === zone.id ? 13 : 10} zIndex={1} />
        <Polyline coordinates={coordinates} strokeColor={selectedId === zone.id ? "#0c64c7" : "#5593c9"} strokeWidth={selectedId === zone.id ? 8 : 5} zIndex={2} tappable onPress={() => onSelect(zone.id)} />
      </Fragment>)}
      <Marker coordinate={zone.center} onPress={() => onSelect(zone.id)} zIndex={selectedId === zone.id ? 10 : 5}
        accessibilityLabel={`${translate(zone.name)}, ${translate("25 грн за годину")}`}>
        <View style={{ minWidth: 66, minHeight: 44, paddingHorizontal: 12, justifyContent: "center", alignItems: "center", borderRadius: 22, borderWidth: 2, borderColor: selectedId === zone.id ? "#ffffff" : "#123a63", backgroundColor: selectedId === zone.id ? "#123a63" : "#ffffff" }}>
          <Text translate={false} style={{ fontSize: 15, fontWeight: "700", color: selectedId === zone.id ? "#ffffff" : "#123a63" }}>25 ₴</Text>
        </View>
      </Marker>
    </Fragment>)}
  </MapView>;
}
