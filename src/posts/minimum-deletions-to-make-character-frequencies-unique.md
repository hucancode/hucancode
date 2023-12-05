---
title: Minimum Deletions to Make Character Frequencies Unique
excerpt: The task is to determine the minimum number of characters that need to be deleted from a given string to make it satisfies a condition. 
date: 2023-09-12
categories:
  - algorithm
  - greedy
  - leetcode
---

## Problem

A string $s$ is called good if there are no two different characters in $s$ that have the same frequency.

Given a string $s$, return the minimum number of characters you need to delete to make $s$ good.

The frequency of a character in a string is the number of times it appears in the string. For example, in the string `aab`, the frequency of `a` is 2, while the frequency of `b` is 1

### Example

```
Input: s = "aab"
Output: 0
Explanation: s is already good.
```

```
Input: s = "aaabbbcc"
Output: 2
Explanation: You can delete two 'b's resulting in the good string "aaabcc".
Another way it to delete one 'b' and one 'c' resulting in the good string "aaabbc".
```

```
Input: s = "ceabaacb"
Output: 2
Explanation: You can delete both 'c's resulting in the good string "eabaab".
Note that we only care about characters that are still in the string at the end (i.e. frequency of 0 is ignored).
```

### Constraints

- $1 \leq s.length \leq 10^5$
- $s$ contains only lowercase English letters

Submit your solution at [here](https://leetcode.com/problems/minimum-deletions-to-make-character-frequencies-unique/)

## Solution

### Approach

We use greedy approach here:

- We memorize frequency of each character
- Go from high frequency to low, while keeping track of the last frequency
- We use the last valid frequency to calculate deletion needed

### Complexity
- Time complexity: $O(n)$
- Space complexity: $O(1)$

### Code
Rust
```rust
use std::cmp::max;
use std::cmp::min;
impl Solution {
    pub fn min_deletions(s: String) -> i32 {
        let s = s.as_bytes();
        let n = 26;
        let mut freq = vec![0;n];
        for &c in s {
            let i = c as usize - 'a' as usize;
            freq[i] += 1;
        }
        freq.sort_by(|a,b|b.cmp(&a));
        let mut ret = 0;
        let mut top = i32::MAX;
        for x in freq {
            let target = max(0, top - 1);
            ret += max(0, x - target);
            top = min(x, target);
        }
        return ret;
    }
}
```
Kotlin
```kotlin
class Solution {
    fun minDeletions(s: String): Int {
        val freq = IntArray(26) {0}
        for(c in s) freq[c-'a']++
        freq.sortDescending()
        var cost = 0
        var top = Int.MAX_VALUE
        for(x in freq) {
            val target = Math.max(0, top - 1)
            cost += Math.max(0, x - target)
            top = Math.min(x, target)
        }
        return cost
    }
}
```
C++
```cpp
class Solution {
public:
    int minDeletions(string s) {
        int n = 26;
        vector<int> freq(n, 0);
        for(auto c: s) freq[c-'a']++;
        sort(freq.rbegin(), freq.rend());
        int top = INT_MAX;
        int ret = 0;
        for(auto x: freq) {
            int target = max(0, top -1);
            ret += max(0, x - target);
            top = min(x, target);
        }
        return ret;
    }
};
```