import axios from "axios";
import { json } from "@sveltejs/kit";
import defaultData from "$lib/components/leetcode-data.json";
const LEETCODE_GQL_ENDPOINT = "https://leetcode.com/graphql";
const LEETCODE_PAYLOAD = {
  query: `query userContestRankingInfo($username: String!) {
  userContestRanking(username: $username) {
    rating
    topPercentage
  }
  userContestRankingHistory(username: $username) {
    attended
    rating
    contest {
      startTime
    }
  }
}`,
  variables: { username: "hucancode" },
};

async function requestAxios() {
  const options = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Accept-Encoding": "gzip,deflate,compress",
    },
    proxy: {
      protocol: "https",
      host: "leetcode.com",
    },
    data: JSON.stringify(LEETCODE_PAYLOAD),
  };
  return await axios(LEETCODE_GQL_ENDPOINT, options);
}

export async function GET() {
  try {
    const res = await requestAxios();
    const data = res.data.data;
    data.userContestRankingHistory = data.userContestRankingHistory.filter(
      (e) => e.attended
    );
    return json(data);
  } catch (e) {
    console.error(e);
    return json(defaultData);
  }
}
