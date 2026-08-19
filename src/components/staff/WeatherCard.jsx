import StaffWeatherCard from '@/components/weather/StaffWeatherCard';

/**
 * WeatherCard — thin re-export of the redesigned StaffWeatherCard.
 * Kept at this path so existing imports (ShiftWizard) automatically get
 * the new polished design with severity indicator and safety notes.
 */
export default function WeatherCard({ lat, lng, locationName, isDrillingJob }) {
  return <StaffWeatherCard lat={lat} lng={lng} locationName={locationName} isDrillingJob={isDrillingJob} />;
}