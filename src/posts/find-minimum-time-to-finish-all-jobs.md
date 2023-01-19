---
title: Find Minimum Time to Finish All Jobs
excerpt: Given an array of jobs where each job has a start time, end time and a penalty if it is not finished on time, the problem is to find the minimum penalty that can be incurred by finishing the jobs in the order they are given
date: 2022-11-08
categories:
  - algorithm
  - greedy
  - depth-first-search
  - leetcode
---

## Problem

You are given an integer array $jobs$, where $jobs_i$ is the amount of time it takes to complete the $i^{th}$ job.

There are $k$ workers that you can assign jobs to. Each job should be assigned to exactly one worker. The working time of a worker is the sum of the time it takes to complete all jobs assigned to them. Your goal is to devise an optimal assignment such that the maximum working time of any worker is minimized.

Return the minimum possible maximum working time of any assignment.

### Example

```
Input: jobs = [3,2,3], k = 3
Output: 3
Explanation: By assigning each person one job, the maximum time is 3.
```

```
Input: jobs = [1,2,4,7,8], k = 2
Output: 11
Explanation: Assign the jobs the following way:
Worker 1: 1, 2, 8 (working time = 1 + 2 + 8 = 11)
Worker 2: 4, 7 (working time = 4 + 7 = 11)
The maximum working time is 11.
```

### Constraints

- $1 \leq k \leq jobs.length \leq 12$
- $1 \leq jobs_i \leq 10^7$

Submit your solution at [here](https://leetcode.com/problems/find-minimum-time-to-finish-all-jobs/)

## Solution

### Intuition

I did a trick with $k = n$ and $k = n-1$, then manage to pass some big test. But still, my main implementation got flaw and TLE.
My approach is traverse all possibility with DFS, cut off some branch that can not lead to better result. Not sure why it's TLE. Any guidance is much appreciated.

### Code

```cpp
class Solution {
public:
    int minimumTimeRequired(vector<int>& jobs, int k) {
        // AC but still bad implementation, TLE with this test
        // [10001,10002,10003,10004,10005,10006,10007,10008,10009,10010,10011,1000000]
        // 10
        int n = jobs.size();
        if(k == n) {
            return *max_element(jobs.begin(), jobs.end());
        }
        if(k == n-1) {
            sort(jobs.begin(), jobs.end());
            int min_pair = jobs[0] + jobs[1];
            int max_job = jobs[n-1];
            return max(min_pair, max_job);
        }
        typedef pair<int, vector<int>> state;
        vector<int> cost(n+1, 1e9);
        stack<state> q;
        vector<int> workers(k,0);
        q.emplace(0, workers);
        map<state, bool> vis;
        while(!q.empty()) {
            vector<int> w;
            int u;
            tie(u, w) = q.top();
            if(vis[q.top()]) {
                q.pop();
                continue;
            }
            vis[q.top()] = true;
            q.pop();
            int next = w[k-1];
            if(next >= cost[n]) {
                continue;
            }
            cost[u] = next;
            int v = u+1;
            if(v > n) {
                continue;
            }
            for(int i = w.size()-1;i>=0;i--) {
                vector<int> nextw = w;
                nextw[i] += jobs[v-1];
                sort(nextw.begin(), nextw.end());
                q.emplace(v, nextw);
            }
        }
        return cost[n];
    }
};
```
