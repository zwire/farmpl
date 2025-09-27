import { PlannerShell } from "./components/layouts/PlannerShell";
import { RequestWizard } from "./components/request-wizard";
import { ResultDashboard } from "./components/result-dashboard";

export default function PlanningPage() {
  return (
    <PlannerShell>
      <RequestWizard />
      <ResultDashboard />
    </PlannerShell>
  );
}
