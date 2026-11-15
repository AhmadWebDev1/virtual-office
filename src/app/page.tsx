import VirtualOffice from "@/components/virtual-office";
import { INITIAL_AGENTS, INITIAL_ROOMS } from "@/data/agents";

export default function Home() {
  return <VirtualOffice initialAgents={INITIAL_AGENTS} initialRooms={INITIAL_ROOMS} />;
}
