export const revalidate = 86400; // 1 day
import React from "react";
import LineChart from "widgets/line-chart";


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
`
const LEETCODE_GQL_ENDPOINT = "https://leetcode.com/graphql";

export async function loadContestStats() {
	const query = GQL_CONTEST_QUERY;
	const res = await fetch(LEETCODE_GQL_ENDPOINT, {
		method: 'POST',
		headers: { 'Content-type': 'application/json' },
		body: JSON.stringify({ query }),
	});
	if(!res.ok) {
		return null;
	}
	const json = await res.json();
	const i = json.data.userContestRankingHistory.findIndex(e => e.attended);
	json.data.userContestRankingHistory = json.data.userContestRankingHistory.slice(i);
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
	  <SectionTitle>// More about me //</SectionTitle>
      {props.children}
    </section>
  );
}

function SectionTitle(props) {
  return <h1 className="mb-5 text-2xl font-bold uppercase">{props.children}</h1>;
}

export default async function LeetcodeSection() {
	const data = await loadContestStats();
  return (
    <Container>
		<div className="flex flex-col md:flex-row items-center md:items-start w-full aspect-square md:aspect-[30/9]">
			<div className="w-full md:w-1/2 h-full p-5">
				<LineChart data={data.userContestRankingHistory} />
			</div>
			<div className="flex flex-col rounded-md w-full md:w-1/2 h-full bg-black/10 dark:bg-white/20">

			</div>
		</div>
    </Container>
  );
}
