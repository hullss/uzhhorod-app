import type { ParkingZone } from "../payments/parkingSession";
export type ParkingMapProps = {
  dark: boolean; zones: readonly ParkingZone[]; selectedId: string;
  onSelect: (id: string) => void;
  onInteractionChange?: (active: boolean) => void;
};
