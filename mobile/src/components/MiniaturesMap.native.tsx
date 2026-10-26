import MapView, { Marker } from "react-native-maps";
import { StyleSheet } from "react-native";
import { useEffect, useRef, useState } from "react";
import type { MiniSculpture } from "../api/cityServices";
import { useAppTheme } from "../ui/theme";

type Props = {
  sculptures: MiniSculpture[];
};

export function MiniaturesMap({ sculptures }: Props) {
  const dark = useAppTheme();
  const map = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (ready && sculptures.length) map.current?.fitToCoordinates(sculptures.map(({ latitude, longitude }) => ({ latitude, longitude })),
      { edgePadding: { top: 32, right: 32, bottom: 32, left: 32 }, animated: false });
  }, [ready, sculptures]);
  return (
    <MapView
      ref={map}
      onMapReady={() => setReady(true)}
      userInterfaceStyle={dark ? "dark" : "light"}
      style={styles.map}
      initialRegion={{ latitude: 48.6227, longitude: 22.298, latitudeDelta: 0.025, longitudeDelta: 0.03 }}
    >
      {sculptures.map((sculpture) => (
        <Marker
          key={sculpture.id}
          coordinate={{ latitude: sculpture.latitude, longitude: sculpture.longitude }}
          title={sculpture.title}
          description={sculpture.address}
          pinColor={dark ? "#8fc8ff" : "#123a63"}
          tracksViewChanges={false}
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({ map: { flex: 1 } });
