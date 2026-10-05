import MapView, { Marker, UrlTile } from "react-native-maps";
import { StyleSheet } from "react-native";

export type OfficialMapPoint = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

type Props = {
  tileTemplate?: string;
  points?: OfficialMapPoint[];
  pinColor?: string;
};

const UZHHOROD_REGION = {
  latitude: 48.6208,
  longitude: 22.2879,
  latitudeDelta: 0.09,
  longitudeDelta: 0.09,
};

export function OfficialLayerMap({ tileTemplate, points = [], pinColor = "#c2410c" }: Props) {
  return <MapView initialRegion={UZHHOROD_REGION} style={styles.map} rotateEnabled={false} pitchEnabled={false}>
    {tileTemplate ? <UrlTile maximumZ={19} minimumZ={10} tileSize={256} urlTemplate={tileTemplate} zIndex={10} /> : null}
    {points.map((point) => <Marker
      key={point.id}
      coordinate={{ latitude: point.latitude, longitude: point.longitude }}
      title={point.name}
      description={point.address}
      pinColor={pinColor}
      tracksViewChanges={false}
      zIndex={20}
    />)}
  </MapView>;
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});
