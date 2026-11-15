import VirtualOffice from "@/components/virtual-office";
import { AGENTS } from "@/data/agents";

export default function Home() {
  return <VirtualOffice initialAgents={AGENTS} />;
}
