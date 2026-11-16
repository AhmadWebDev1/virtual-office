import VirtualOffice from "@/components/virtual-office";
import { INITIAL_AGENTS, INITIAL_ROOMS } from "@/data/agents";
import { getServerOfficeState } from "@/lib/server-office-storage";

export default function Home() {
  const savedState = getServerOfficeState(INITIAL_AGENTS, INITIAL_ROOMS);

  return (
    <VirtualOffice
      initialAgents={savedState?.agents ?? INITIAL_AGENTS}
      initialRooms={savedState?.rooms ?? INITIAL_ROOMS}
      initialTheme={savedState?.theme ?? "day"}
      initialSheetId={savedState?.sheetId ?? null}
    />
  );
}
