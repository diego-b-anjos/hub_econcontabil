import { useEffect, useState } from "react";
import { Cloud, CloudRain, Sun, CloudSun, Zap, Wind } from "lucide-react";

type WeatherIcon = "sun" | "partly" | "fog" | "rain" | "storm";

interface WeatherData {
  temperature: number;
  icon: WeatherIcon;
}

function getWeatherIcon(code: number): WeatherIcon {
  if (code === 0) return "sun";
  if (code <= 3) return "partly";
  if (code <= 48) return "fog";
  if (code <= 82) return "rain";
  return "storm";
}

const ICON_COMPONENTS: Record<WeatherIcon, React.ReactNode> = {
  sun:    <Sun className="h-4 w-4 text-amber-400" />,
  partly: <CloudSun className="h-4 w-4 text-amber-400" />,
  fog:    <Wind className="h-4 w-4 text-slate-400" />,
  rain:   <CloudRain className="h-4 w-4 text-blue-400" />,
  storm:  <Zap className="h-4 w-4 text-yellow-400" />,
};

export function DateWeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [date, setDate] = useState("");

  useEffect(() => {
    const now = new Date();
    const formatted = now.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    // Capitalize first letter
    setDate(formatted.charAt(0).toUpperCase() + formatted.slice(1));

    // Fetch weather — São Paulo coordinates
    fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=-23.5505&longitude=-46.6333&current_weather=true&timezone=America%2FSao_Paulo"
    )
      .then((r) => r.json())
      .then((data) => {
        const cw = data?.current_weather;
        if (cw) {
          setWeather({
            temperature: Math.round(cw.temperature),
            icon: getWeatherIcon(cw.weathercode),
          });
        }
      })
      .catch(() => {
        /* silent — just show date */
      });
  }, []);

  return (
    <div className="flex flex-col items-end gap-0.5 text-right select-none">
      <span className="text-sm font-medium text-foreground/90 leading-tight">{date}</span>
      {weather && (
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {ICON_COMPONENTS[weather.icon]}
          <span>{weather.temperature}°C · São Paulo / SP</span>
        </span>
      )}
    </div>
  );
}
