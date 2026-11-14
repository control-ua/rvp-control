import { supabase } from "@/lib/supabase";
import { fetchApplications } from "@/lib/applicationsApi";
import type { WorkflowAct } from "./workflow";
async function fetchWorkflowActs() {
  const acts: WorkflowAct[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase
      .from("acts")
      .select("id,application_id,status,created_at")
      .order("created_at", { ascending: false })
      .order("id")
      .range(offset, offset + 499);
    if (error)
      throw new Error("Не вдалося оновити стан актів. Спробуйте ще раз.");
    acts.push(...(data as WorkflowAct[]));
    if (data.length < 500) return acts;
  }
}
export async function fetchOperations() {
  const [applications, acts] = await Promise.all([
    fetchApplications(),
    fetchWorkflowActs(),
  ]);
  return { applications, acts };
}
