export const revalidate = 86400; // 1 day
import React from "react";
import LineChart from "widgets/line-chart";
import SectionTitle from "widgets/section-title";
import SkillWidget from "widgets/skill-widget";

const GQL_CONTEST_QUERY = `
{
  userContestRanking(username: "hucancode") {
    rating
    globalRanking
    topPercentage
  }
  userContestRankingHistory(username: "hucancode") {
    attended
    rating
	contest {
      startTime
    }
  }
}
`;
const LEETCODE_GQL_ENDPOINT = "https://leetcode.com/graphql";

export async function loadContestStats() {
  const query = GQL_CONTEST_QUERY;
  const res = await fetch(LEETCODE_GQL_ENDPOINT, {
    method: "POST",
    headers: { "Content-type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    return null;
  }
  const json = await res.json();
  const i = json.data.userContestRankingHistory.findIndex((e) => e.attended);
  json.data.userContestRankingHistory =
    json.data.userContestRankingHistory.slice(i);
  return json.data;
}

function Container(props) {
  return (
    <section
      className="flex w-full
    max-w-screen-lg flex-col items-center
    overflow-hidden py-10 px-4
    text-center
    md:px-10"
      id={props.id}
    >
      <div className="mb-6 h-1 w-full max-w-sm bg-gray-900/10 dark:bg-white/10" />
      <SectionTitle text="home.stats.title" />
      {props.children}
    </section>
  );
}
export default async function LeetcodeSection() {
  const data = await loadContestStats();
  return (
    <Container>
      <div className="flex aspect-square w-full flex-col items-center md:aspect-[4/3] lg:aspect-[30/9] lg:flex-row lg:items-start">
        <div className="flex h-full w-full flex-col rounded-md md:w-2/3 lg:w-1/2">
          <SkillWidget />
        </div>
        <div className="h-full w-full p-5 md:w-2/3 lg:w-1/2">
          <LineChart data={data.userContestRankingHistory} />
        </div>
      </div>
    </Container>
  );
}
