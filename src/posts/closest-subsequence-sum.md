---
title: Closest Subsequence Sum
excerpt: Given a list of integers and a target number, the problem is to find the closest subsequence of that list that add up to the target number, return the sum of that subsequence
date: 2023-01-13
categories:
  - algorithm
  - bitmask
  - binary-search
  - leetcode
---

## Problem

You are given an integer array $nums$ and an integer $goal$.

You want to choose a subsequence of $nums$ such that the sum of its elements is the closest possible to $goal$. That is, if the sum of the subsequence's elements is $sum$, then you want to minimize the absolute difference $abs(sum - goal)$.

Return the minimum possible value of $abs(sum - goal)$.

Note that a subsequence of an array is an array formed by removing some elements (possibly all or none) of the original array.

### Example

```
Input: nums = [5,-7,3,5], goal = 6
Output: 0
Explanation: Choose the whole array as a subsequence, with a sum of 6.
This is equal to the goal, so the absolute difference is 0.
```

```
Input: nums = [7,-9,15,-2], goal = -5
Output: 1
Explanation: Choose the subsequence [7,-9,-2], with a sum of -4.
The absolute difference is abs(-4 - (-5)) = abs(1) = 1, which is the minimum.
```

```
Input: nums = [1,2,3], goal = -7
Output: 7
```

### Constraints

- $1 \leq nums.length \leq 40$
- $-10^7 \leq nums_i \leq 10^7$
- $-10^9 \leq goal \leq 10^9$

Submit your solution at [here](https://leetcode.com/problems/closest-subsequence-sum/)

## Solution

### Full search brute force (TLE)

First idea come to my mind is Brute Force because $n \leq 40$ is pretty small, I can even get away with $O(n^4)$. So I made an array of set $f$ to maintain all possible $sum$. $f_i$ holds all $sum$ candidates until $nums_i$.
Here is the code for your reference

```cpp
class Solution {
public:
    int minAbsDifference(vector<int>& nums, int goal) {
        sort(nums.begin(), nums.end());
        int n = nums.size();
        vector<set<int>> f(n+1);
        f[0].insert(0);
        int ret = abs(goal);
        for(int i = 1;i<=n;i++) {
            for(auto x: f[i-1]) {
                int score;
                f[i].insert(x);
                score = abs(nums[i-1] - goal);
                if(score < ret || nums[i-1] < goal) {
                    ret = min(ret, score);
                    f[i].insert(nums[i-1]);
                }
                auto sum = x + nums[i-1];
                score = abs(sum - goal);
                if(score < ret || sum < goal) {
                    ret = min(ret, score);
                    f[i].insert(sum);
                }
            }
        }
        return ret;
    }
};
```

Sadly this gives TLE, I can optimize it further by using only 1 sets instead of $n$ sets but I don't think it would AC.

### Intuition

So I changed my approach, notice that $n = 40$ so $O(2^n) = T(2^{40})$ would very likely to TLE, but how about $T(2^{20})$? Seems sensible. The idea is simple:

- Split $nums$ into 2 array, let's call them $left$ and $right$
- Calculate all possible $sum$ for each sub array. Sort them.
- For each $a \in left$, find $b \in right$ so that $a+b$ is closest to $goal$. This could be done in $O(m \times log(m))$ with $m$ being the candidates array length $2^n$
- Altogether we have an $O(2^n \times n)$ solution. It gives AC but I was afraid it is still slow I made a small optimization to reduce search range while traversing $right$ array.

### Complexity

- Time complexity: $O(2^n \times n)$
- Space complexity: $O(2^n)$

## Code

```cpp
class Solution {
public:
    void buildPermutation(vector<int>& nums, vector<int>& a, int i, int n) {
        int k = n-i;
        int size = (1<<k);
        a.resize(size,0);
        for(int j = 0;j<size;j++) {
            for(int b = 0;b<k;b++) {
                if((1<<b)&j) {
                    continue;
                }
                int next = (1<<b)|j;
                a[next] += nums[i+b];
            }
        }
        sort(a.begin(), a.end());
    }
    int minAbsDifference(vector<int>& nums, int goal) {
        int n = nums.size();
        int m = n/2;
        vector<int> left, right;
        buildPermutation(nums, left, 0, m);
        buildPermutation(nums, right, m, n);
        int ret = 2e9+1;
        int j = right.size();
        for(auto a: left) {
            int target = goal - a;
            j = distance(right.begin(), lower_bound(right.begin(), right.begin()+j, target));
            if(j < right.size()) {
                int b = right[j];
                ret = min(ret, abs(a + b - goal));
            }
            if(j != 0) {
                int b = right[j-1];
                ret = min(ret, abs(a + b - goal));
            }
            if(ret == 0) {
                break;
            }
        }
        return ret;
    }
};
```
