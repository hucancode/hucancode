---
title: Minimum Number of K Consecutive Bit Flips
date: 2022-12-14 17:50:00
categories:
  - algorithm
  - bitmask
  - leetcode
excerpt: Practice bitmask technique with me
---

## Problem

You are given a binary array nums and an integer k.

A k-bit flip is choosing a subarray of length k from nums and simultaneously changing every 0 in the subarray to 1, and every 1 in the subarray to 0.

Return the minimum number of k-bit flips required so that there is no 0 in the array. If it is not possible, return -1.

A subarray is a contiguous part of an array

### Example

```
Input: nums = [0,1,0], k = 1
Output: 2
Explanation: Flip nums[0], then flip nums[2].
```

```
Input: nums = [1,1,0], k = 2
Output: -1
Explanation: No matter how we flip subarrays of size 2, we cannot make the array become [1,1,1].
```

```
Input: nums = [0,0,0,1,0,1,1,0], k = 3
Output: 3
Explanation:
Flip nums[0],nums[1],nums[2]: nums becomes [1,1,1,1,0,1,1,0]
Flip nums[4],nums[5],nums[6]: nums becomes [1,1,1,1,1,0,0,0]
Flip nums[5],nums[6],nums[7]: nums becomes [1,1,1,1,1,1,1,1]
```

### Constraints

- $1 <= nums.length <= 10^5$
- $1 <= k <= nums.length$

## Solution

### Intuition

This solution relies on 2 important observations:

- The order of operation does not matter, e.g flip $[1,5] \rightarrow [3,10]$ is equivalent to $[3,10] \rightarrow [1,5]$
  - So, when we found a $0$ at $i$, we should flip the range $[i,i+k-1]$ because sooner or later we will have to do it anyway
- Given range $[0,i]$ that already in good state (i.e $A[0,i] = [1,1,1,1...1]$) we should not modify $[0,i]$
  - Because if we modify an item that already is $1$, we have to make another move to make it $0$, at best it would be a waste of time, at worst it would ruin the good result on the right

### Approach

- Move from left to right, as soon as we see a $0$, we flip
- To avoid looping to update the range $[i,i+k-1]$, we maintain a queue to track how many flip we have made that affect current element so far. If the flip count is even, the value stay the same, if odd the value has to be flipped

### Complexity

- Time complexity:
  $O(n)$ to travel through array once

- Space complexity:
  $O(n)$ to maintain a queue

### Code

```cpp
class Solution {
public:
    int minKBitFlips(vector<int>& nums, int k) {
        int n = nums.size();
        int flipCount = 0;
        queue<int> flipHistory;
        for(int i = 0;i<n;i++) {
            bool v = nums[i];
            if(!flipHistory.empty() && flipHistory.front() < i) {
                flipHistory.pop();
            }
            if(flipHistory.size()%2) {
                v = !v;
            }
            bool shouldFlip = v == 0;
            bool canFlip = i+k-1 < n;
            if(!shouldFlip) {
                continue;
            }
            if(!canFlip) {
                return -1;
            }
            flipCount++;
            flipHistory.push(i+k-1);
        }
        return flipCount;
    }
};
```
