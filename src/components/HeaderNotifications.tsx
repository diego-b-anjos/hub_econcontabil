import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function HeaderNotifications() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notificações"
          className="text-zinc-300 hover:text-white transition-colors"
        >
          <Bell className="w-5 h-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4" align="end">
        <div className="text-sm font-semibold mb-1">Notificações</div>
        <div className="text-xs text-muted-foreground">
          Sem notificações no momento.
        </div>
      </PopoverContent>
    </Popover>
  );
}
