export type RootScreen = "home" | "services" | "feed" | "profile";
export type NavigationFrame = { key: string; kind: string };
export type NavigationState = {
  section: "hub" | "transport"; activeTab: RootScreen;
  profilePanel: string | null; profileReturn: string | null;
  serviceId?: string; articleId?: string; weatherOpen: boolean;
  paymentMethodsInCheckout: boolean;
  routeId?: string; stopId?: string; mapOpen: boolean; scheduleOpen: boolean;
  searchMode: "routes" | "stops"; showDataSources: boolean;
  loading: boolean; error: boolean;
  transportFromFavorites?: boolean;
};
const frame = (kind: string, id = kind): NavigationFrame => ({ kind, key: id });
export function navigationPath(s: NavigationState): NavigationFrame[] {
  const root = s.section === "transport" ? s.transportFromFavorites ? "profile" : "services" : s.activeTab;
  const path = [frame(root)];
  if (s.section === "transport") {
    if (s.transportFromFavorites) {
      path.push(frame("profile:favorites"));
      if (s.stopId) path.push(frame("stop", `stop:${s.stopId}`));
    } else {
      path.push(frame("transport"));
      if (s.searchMode === "stops") path.push(frame("transport-stops"));
    }
    if (s.routeId) {
      path.push(frame("route", `route:${s.routeId}`));
      if (s.mapOpen) path.push(frame("route-map", `route-map:${s.routeId}`));
      else if (s.scheduleOpen) path.push(frame("schedule", `schedule:${s.routeId}`));
    } else if (s.stopId && !s.transportFromFavorites) path.push(frame("stop", `stop:${s.stopId}`));
    else if (s.showDataSources) path.push(frame("data-sources"));
    if (s.loading) path.push(frame("loading"));
    else if (s.error) path.push(frame("error"));
    return path;
  }
  if (s.articleId) path.push(frame("article", `article:${s.articleId}`));
  else if (s.weatherOpen) path.push(frame("weather"));
  else if (s.serviceId) {
    path.push(frame("service", `service:${s.serviceId}`));
    if (s.serviceId === "transport-payment" && s.paymentMethodsInCheckout) path.push(frame("checkout-card"));
  } else if (root === "profile" && s.profilePanel) {
    if (s.profileReturn && s.profilePanel !== s.profileReturn) path.push(frame(`profile:${s.profileReturn}`));
    path.push(frame(`profile:${s.profilePanel}`));
  }
  return path;
}
