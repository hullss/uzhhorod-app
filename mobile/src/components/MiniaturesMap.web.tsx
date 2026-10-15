import { OfficialLayerMap } from "./OfficialLayerMap";
import { useAppTheme } from "../ui/theme";
import type { MiniSculpture } from "../api/cityServices";

type Props = {
  sculptures: MiniSculpture[];
};

export function MiniaturesMap({ sculptures }: Props) {
  const dark = useAppTheme();
  return <OfficialLayerMap points={sculptures.map(s => ({ id: s.id, name: s.title, address: s.address, latitude: s.latitude, longitude: s.longitude }))} pinColor={dark ? "#8fc8ff" : "#123a63"} />;
}
