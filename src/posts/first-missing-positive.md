---
title: First Missing Positive
excerpt: The problem requires finding the smallest positive integer that doesn't appear in an unsorted array
date: 2023-04-29
categories:
  - algorithm
  - greedy
  - leetcode
---

## Problem

Given an unsorted integer array $nums$ of length $n$, return the smallest missing positive integer.

You must implement an algorithm that runs in $O(n)$ time and uses $O(1)$ auxiliary space.

### Example

```
Input: nums = [1,2,0]
Output: 3
Explanation: The numbers in the range [1,2] are all in the array.
```

```
Input: nums = [3,4,-1,1]
Output: 2
Explanation: 1 is in the array but 2 is missing.
```

```
Input: nums = [7,8,9,11,12]
Output: 1
Explanation: The smallest positive integer 1 is missing.
```

### Constraints

- $1 \leq n \leq 10^5$
- $2^{31} \leq nums_i \leq 2^{31} - 1$

Submit your solution at [here](https://leetcode.com/problems/first-missing-positive/)

## Solution

### Intuition

Sort and find missing element resulting in $O(n \times logn)$ time, $n = 10^5$ so that solution would AC if you insist on doing so 🙄. We can do better than that. We will traverse once and fill all number slots.
Then do a 2nd pass and check for the first unfilled slot.

### Approach

We define "useless" number as a number that is not contribute to our final sequence. Those number are

- Out of range $[1,n]$
- Or already exist before

For example:

```
[3,4,-1,1,0,99] // -1, 0, 99 are useless number
[7,8,9,11,12] // all numbers in the array are out of range [1~5] and are useless
```

In the first pass, we will have a running pivot $i$, and put all useful number in its position, all useless number behind $i$
For example, this is an array before/after first pass

```
// input array
[0,6,2,2,4,0,1,4,1,3]
// loop iteration
check 10
swap 10/3, nums = [0, 6, (3), 2, 4, 0, 1, 4, 1, (2)]
check 10
swap 10/2, nums = [0, (2), 3, 2, 4, 0, 1, 4, 1, (6)]
check 10
swap 10/6, nums = [0, 2, 3, 2, 4, (6), 1, 4, 1, (0)]
check 10 nothing happened
check 9
swap 9/1, nums = [(1), 2, 3, 2, 4, 6, 1, 4, (0), 0]
check 9 nothing happened
check 8
swap 8/4, nums = [1, 2, 3, (4), 4, 6, 1, (2), 0, 0]
check 8~1 nothing happened
```

In the final array, notice that first position has an odd item is $5$, so we return $5$

### Complexity

- Time complexity: $O(n)$
- Space complexity: $O(1)$

### Code

```rust
impl Solution {
    pub fn first_missing_positive(nums: Vec<i32>) -> i32 {
        let mut nums = nums;
        let mut i = nums.len();
        while i > 0 {
            let useless = nums[i-1] > i as i32 || nums[i-1] < 1;
            if useless {
                i -= 1;
                continue;
            }
            let j = nums[i-1] as usize;
            let useless = nums[i-1] == nums[j-1];
            if useless {
                i -= 1;
                continue;
            }
            nums.swap(i-1,j-1);
        }
        //println!("{:?}", nums);
        return nums.iter()
            .enumerate()
            .take_while(|&(i, &x)| i as i32 == x-1)
            .count() as i32 + 1;
    }
}
```
