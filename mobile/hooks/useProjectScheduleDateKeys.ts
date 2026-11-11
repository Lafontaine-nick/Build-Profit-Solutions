import { useMemo } from "react";
import { useProjectData } from "@/contexts/ProjectDataContext";
import { useProjectList } from "@/contexts/ProjectListContext";
import { parseCalendarDate } from "@/utils/formatters";

function calendarDateKey(value: unknown): string | null {
  if (value == null || value === "") return null;
  const date = parseCalendarDate(value as string);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Job start and end as YYYY-MM-DD, using the same dates shown on the project schedule. */
export function useProjectScheduleDateKeys(): { start: string | null; end: string | null } {
  const { projectData } = useProjectData();
  const { getProjectById, projects } = useProjectList();

  return useMemo(() => {
    const projectId = String(projectData?.id ?? "").trim();
    const listed = projectId
      ? getProjectById(projectId) ?? projects.find((project) => String(project?.id ?? "").trim() === projectId)
      : undefined;
    const estimate =
      (listed as { estimateData?: Record<string, unknown> } | undefined)?.estimateData ||
      (projectData as { estimateData?: Record<string, unknown> } | undefined)?.estimateData ||
      {};
    return {
      start: calendarDateKey(
        estimate.projectStartDate ||
          estimate.startDate ||
          listed?.startDate ||
          projectData?.startISO
      ),
      end: calendarDateKey(
        estimate.projectEndDate ||
          estimate.endDate ||
          listed?.endDate ||
          projectData?.endISO
      ),
    };
  }, [projectData, getProjectById, projects]);
}
