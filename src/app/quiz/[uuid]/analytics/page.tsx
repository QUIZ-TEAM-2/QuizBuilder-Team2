import QuizAnalyticsClient from "./quiz-analytics-client";
import { DashboardThemeScope } from "@/components/theme/DashboardTheme";

export default async function QuizAnalyticsPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = await params;
  return (
    <DashboardThemeScope>
      <QuizAnalyticsClient quizUuid={uuid} />
    </DashboardThemeScope>
  );
}
