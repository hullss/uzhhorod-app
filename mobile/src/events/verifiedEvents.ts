import saved from "./verified-events.json";
import { decodeEventCatalog } from "./catalog";

export const VERIFIED_EVENTS = decodeEventCatalog(saved).items;
