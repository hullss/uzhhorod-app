import { StyleSheet, Text, View } from "react-native";
import type { MiniSculpture } from "../api/cityServices";

type Props = {
  sculptures: MiniSculpture[];
};

const BOUNDS = { minLatitude: 48.617, maxLatitude: 48.638, minLongitude: 22.281, maxLongitude: 22.311 };

export function MiniaturesMap({ sculptures }: Props) {
  return (
    <View style={styles.map}>
      <View style={styles.river} />
      {sculptures.map((sculpture, index) => {
        const left = ((sculpture.longitude - BOUNDS.minLongitude) / (BOUNDS.maxLongitude - BOUNDS.minLongitude)) * 100;
        const top = (1 - (sculpture.latitude - BOUNDS.minLatitude) / (BOUNDS.maxLatitude - BOUNDS.minLatitude)) * 100;
        return <View key={sculpture.id} style={[styles.marker, { left: `${Math.max(4, Math.min(92, left))}%`, top: `${Math.max(7, Math.min(84, top))}%` }]}>
          <Text style={styles.markerText}>{index + 1}</Text>
        </View>;
      })}
      <View style={styles.label}><Text style={styles.labelTitle}>Схема локацій</Text><Text style={styles.labelText}>{sculptures.length} мініскульптура</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { backgroundColor: "#e9eef5", flex: 1, overflow: "hidden" },
  river: { backgroundColor: "#c8dff6", height: 17, left: "-10%", opacity: 0.9, position: "absolute", top: "47%", transform: [{ rotate: "-11deg" }], width: "120%" },
  marker: { alignItems: "center", backgroundColor: "#123a63", borderColor: "#ffffff", borderRadius: 13, borderWidth: 2, height: 26, justifyContent: "center", position: "absolute", width: 26 },
  markerText: { color: "#ffffff", fontFamily: "PublicSans_700Bold", fontSize: 10 },
  label: { backgroundColor: "rgba(0,36,70,0.88)", borderRadius: 8, bottom: 12, left: 12, paddingHorizontal: 10, paddingVertical: 7, position: "absolute" },
  labelTitle: { color: "#ffffff", fontFamily: "PublicSans_600SemiBold", fontSize: 11 },
  labelText: { color: "#d3e4ff", fontFamily: "PublicSans_400Regular", fontSize: 10, marginTop: 2 },
});
