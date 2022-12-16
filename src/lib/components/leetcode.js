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

export async function loadContestStats(fetch) {
  const res = await fetch(LEETCODE_GQL_ENDPOINT, {
    method: "POST",
    headers: { "Content-type": "application/json" },
    body: JSON.stringify({ query: GQL_CONTEST_QUERY }),
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
