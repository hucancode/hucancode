---
title: Subarray Sums Divisible by K
excerpt: Given an array of integers and an integer k, the problem is to find the total number of continuous subarrays whose sum is divisible by k
date: 2023-01-19
categories:
  - algorithm
  - prefix-sum
  - number-theory
  - leetcode
---

## Problem

Given an integer array $nums$ and an integer $k$, return the number of non-empty subarrays that have a sum divisible by $k$.

_A subarray is a contiguous part of an array._

### Example

```
Input: nums = [4,5,0,-2,-3,1], k = 5
Output: 7
Explanation: There are 7 subarrays with a sum divisible by k = 5:
[4, 5, 0, -2, -3, 1], [5], [5, 0], [5, 0, -2, -3], [0], [0, -2, -3], [-2, -3]
```

```
Input: nums = [5], k = 9
Output: 0
```

### Constraints

- $1 \leq nums.length \leq 3 \times 10^4$
- $-10^4 \leq nums_i \leq 10^4$
- $2 \leq k \leq 10^4$

Submit your solution at [here](https://leetcode.com/problems/subarray-sums-divisible-by-k/)

## Solution

### Naive brute force (AC, almost TLE)

- First idea come to my mind is that I could traverse all subarray and count, the complexity is $O(n^3)$
- I can make it $O(n^2)$ by using a prefix sum (after $O(n)$ preparation, sum calculation become $O(1)$)
- I realize that if sum of $nums_{i,j}$ divisable by $k$, and $nums_{j+1,x}$ next to it is also divisable by $k$, then $nums_{i,x}$ is also divisable by $k$, I can cut off some calculation if the array happen to have consecutive segments like that

#### Complexity

Leetcode's time limit is pretty generous so my naive solution luckily AC

- Time complexity: $O(n^2)$
- Space complexity: $O(n)$
- Running time: $2900ms$

```cpp
class Solution {
public:
    int subarraysDivByK(vector<int>& nums, int k) {
        int n = nums.size();
        vector<int> prefix(n+1, 0);
        for(int i = 1;i<=n;i++) {
            prefix[i] = prefix[i-1]+nums[i-1];
        }
        vector<bool> vis(n, false);
        int ret = 0;
        for(int i = 0;i<=n;i++) {
            if(vis[i]) {
                continue;
            }
            int segment = 0;
            int mid = i;
            for(int j = i+1;j<=n;j++) {
                int sum = prefix[j] - prefix[mid];
                if(sum%k == 0) {
                    segment++;
                    mid = j;
                    vis[j] = true;
                }
            }
            ret += (segment+1)*segment/2;
            vis[i] = true;
        }
        return ret;
    }
};
```

### Intuition

Turned out the intended solution is so simple and elegant. You traverse the prefix sum array. Maintain array $count$, with $count_r$ counts the number of times remainder $r$ appears until this point.

- At $nums_i$, your $sum\mod k = r$, you should look backward and see how many way to deduce $r$ from the $sum$ to make it divisable
- Thus, with $nums_i$ added to the array and $sum \mod k = r$, it would makes $count_r$ more subarrays

### Complexity

- Time complexity: $O(n)$
- Space complexity: $O(n)$
- Running time: $49ms$

## Code

```cpp
class Solution {
public:
    int subarraysDivByK(vector<int>& nums, int k) {
        int n = nums.size();
        vector<int> prefix(n+1, 0);
        for(int i = 1;i<=n;i++) {
            prefix[i] = prefix[i-1]+nums[i-1];
        }
        int ret = 0;
        vector<int> remainderCount(k, 0);
        for(int i = 1;i<=n;i++) {
            int remainder = (k + (prefix[i] % k)) % k;// double mod to avoid negative remainder
            ret += remainderCount[remainder];
            remainderCount[remainder]++;
        }
        ret += remainderCount[0];
        return ret;
    }
};
```
