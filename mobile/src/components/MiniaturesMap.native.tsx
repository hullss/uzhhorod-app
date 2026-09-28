import MapView, { Marker } from "react-native-maps";
import { StyleSheet } from "react-native";
import type { MiniSculpture } from "../api/cityServices";

type Props = {
  sculptures: MiniSculpture[];
};

export function MiniaturesMap({ sculptures }: Props) {
  return (
    <MapView
      style={styles.map}
      initialRegion={{ latitude: 48.6227, longitude: 22.298, latitudeDelta: 0.025, longitudeDelta: 0.03 }}
    >
      {sculptures.map((sculpture) => (
        <Marker
          key={sculpture.id}
          coordinate={{ latitude: sculpture.latitude, longitude: sculpture.longitude }}
          title={sculpture.title}
          description={sculpture.address}
          pinColor="#123a63"
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({ map: { flex: 1 } });
