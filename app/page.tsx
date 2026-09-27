import { getTodayTopic, formatDate, allTopics, tracks } from "@/lib/catalog";
import StudyClient from "@/components/StudyClient";

export default function Home() {
  const today = getTodayTopic();
  const dateLabel = formatDate();

  return (
    <StudyClient
      todayTopicId={today.topic.id}
      dayNumber={today.dayNumber}
      total={today.total}
      dateLabel={dateLabel}
      topics={allTopics}
      tracks={tracks}
    />
  );
}
