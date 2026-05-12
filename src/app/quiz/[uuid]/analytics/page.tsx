import QuizAnalyticsClient from "./quiz-analytics-client";

export default async function QuizAnalyticsPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = await params;
  return <QuizAnalyticsClient quizUuid={uuid} />;
}
