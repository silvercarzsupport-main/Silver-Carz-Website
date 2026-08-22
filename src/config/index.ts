export { appConfig, type AppConfig } from './app';
export {
  DEFAULT_FLEET_CITY,
  citiesMatch,
  normalizeCityName,
  uniqueCityOptions,
} from './fleet-cities';
export { filterIndianCities, INDIAN_CITIES, resolveIndianCity } from './indian-cities';
export {
  customerLegalNavItems,
  customerMainNavItems,
  customerQuickLinkItems,
  type CustomerNavItem,
} from './customer-navigation';
export {
  formatInvoiceNumber,
  invoiceConfig,
  resolveInvoicePrefix,
  resolveInvoiceYear,
  type InvoiceConfig,
} from './invoice';
export { mainNavItems, secondaryNavItems, type NavItem } from './navigation';
export { portalConfig, type PortalConfig } from './portal';
