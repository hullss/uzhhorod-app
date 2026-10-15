export const ECO_SOURCE = "https://ave.ua/tov-ave-uzhgorod/ekologicni-ostrivci";
export const ECO_MAP_SOURCE = "https://ave.ua/map";
export type EcoIsland = { id: string; address: string; reuse: boolean; latitude?: number; longitude?: number };
// Addresses from AVE's article, coordinates only where published in AVE's own map.
// The article says 8 but lists 9 addresses; do not invent positions for the other six.
export const ECO_ISLANDS: EcoIsland[] = [
  { id: "ave-mitskevycha-9", address: "вул. Міцкевича, 9", reuse: false, latitude: 48.60690449144547, longitude: 22.271424125457095 },
  { id: "ave-hrushevskoho-62", address: "вул. Грушевського, 62", reuse: false, latitude: 48.60559849754377, longitude: 22.281382325729574 },
  { id: "ave-hodynky-8", address: "вул. Годинки, 8", reuse: true, latitude: 48.611381577792535, longitude: 22.27030132996779 },
  { id: "ave-secheni-33", address: "вул. Сечені, 33", reuse: true },
  { id: "ave-svobody-51", address: "просп. Свободи, 51 (ЗОШ №6)", reuse: true },
  { id: "ave-universytetska-12", address: "вул. Університетська, 12 (АВЕ Еколенд)", reuse: true },
  { id: "ave-tlekhassa-85", address: "вул. Бориса Тлехаса, 85", reuse: true },
  { id: "ave-franka", address: "вул. Івана Франка (стадіон «Авангард»)", reuse: true },
  { id: "ave-fedyntsia-23", address: "вул. О. Фединця, 23", reuse: false },
];
