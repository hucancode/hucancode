import defaultData from "$lib/components/leetcode-data.json";
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

export async function load({ fetch }) {
    const payload = {
        query: GQL_CONTEST_QUERY
    };
    const res = await fetch(LEETCODE_GQL_ENDPOINT, {
        mode: 'no-cors',
        method: "POST", 
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return defaultData;
    }
    try {
        const json = await res.json();
        const i = json.data.userContestRankingHistory.findIndex((e) => e.attended);
        json.data.userContestRankingHistory =
          json.data.userContestRankingHistory.slice(i);
        return json.data;
    } catch (e) {
        return defaultData;
    }
}
