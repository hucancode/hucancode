---
title: Verbal Arithmetic Puzzle
excerpt: This is a problem where each letter in a given puzzle represents a unique digit. The goal is to assign digits to the letters such that when the words are summed, they produce a correct numerical result, similar to a standard arithmetic equation. Additionally, no word can have leading zeros, and each letter must represent a different digit.
date: 2024-10-21
categories:
  - algorithm
  - combinatorics
  - back-tracking
  - dfs
  - leetcode
---

## Problem

Given an equation, represented by words on the left side and the result on the right side.

You need to check if the equation is solvable under the following rules:

- Each character is decoded as one digit (0 - 9).
- No two characters can map to the same digit.
- Each words[i] and result are decoded as one number without leading zeros.
- Sum of numbers on the left side (words) will equal to the number on the right side (result).

Return true if the equation is solvable, otherwise return false.

### Example

```
Input: words = ["SEND","MORE"], result = "MONEY"
Output: true
Explanation: Map 'S'-> 9, 'E'->5, 'N'->6, 'D'->7, 'M'->1, 'O'->0, 'R'->8, 'Y'->'2'
Such that: "SEND" + "MORE" = "MONEY" ,  9567 + 1085 = 10652
```
```
Input: words = ["SIX","SEVEN","SEVEN"], result = "TWENTY"
Output: true
Explanation: Map 'S'-> 6, 'I'->5, 'X'->0, 'E'->8, 'V'->7, 'N'->2, 'T'->1, 'W'->'3', 'Y'->4
Such that: "SIX" + "SEVEN" + "SEVEN" = "TWENTY" ,  650 + 68782 + 68782 = 138214
```
```
Input: words = ["LEET","CODE"], result = "POINT"
Output: false
Explanation: There is no possible mapping to satisfy the equation, so we return false.
Note that two different characters cannot map to the same digit.
```

### Constraints

- $2 \leq words.length \leq 5$
- $1 \leq words[i].length, result.length \leq 7$
- $words[i], result$ contain only uppercase English letters
- The number of different characters used in the expression is at most $10$

Submit your solution at [here](https://leetcode.com/problems/verbal-arithmetic-puzzle/)

## Solution

### Intuition
The goal is to have `sum(left) = right`, which is `sum(left) - right = 0`. Let's build a weight map $w$ to see how each individual letter contribute to the sum. For example:
```
["SEND", "MORE"] = "MONEY"
weights:
D = 1, E = 91, M = -9000, N = -90,
O = -900, R = 10, S = 1000, Y = -1,
```
The problem becomes, find a set of values $v$ to assign to each letter so that $\Sigma_0^n(v_i \times w_i) = 0$

### Approach 1 (Backtracking)
- By default this would TLE, so we need to add some early prunning
- Sort the weight, then travel from lowest weight to the highest and keep track of the $sum$, our goal is to find an answer that has $sum = 0$
  - If $sum > 0$, we stop because $sum$ will only increase onward
  - If $sum < 0$, and even if we assign largest $v$ available to largest $w$ and still $sum < 0$, we stop because there are no point trying

### Complexity
- Time complexity: $O(\frac{10!}{(10-n)!})$
- Space complexity: $O(n)$

### Code
C++ (1687ms)
```cpp
#define UNUSED(mask, pos) ((mask & (1<<pos)) == 0)
class Solution {
public:
    bool isSolvable(vector<string>& words, string result) {
        map<char, int> weights;
        set<char> leads;
        auto addWeight = [&](string str, int k) {
            if(str.size() > 1) {
                leads.insert(str[0]);
            }
            reverse(str.begin(), str.end());
            for(auto c: str) {
                weights[c] += k;
                k *= 10;
            }
        };
        for(auto w: words) {
            addWeight(w, 1);
        }
        addWeight(result, -1);
        vector<pair<int,char>> vars;
        for(auto kv: weights) {
            if(kv.second == 0) continue;
            vars.emplace_back(kv.second, kv.first);
        }
        int n = vars.size();
        if(n == 0) {
            return true;
        }
        sort(vars.begin(), vars.end());
        stack<tuple<int, int, bool>> q;
        int sum = 0;
        int mask = 0;
        auto noHope = [&](int sum, int mask, int i) {
            if(sum > 0 || i >= n-1) {
                return true;
            }
            for(int j = n-1;j>i;j--) {
                for(int d = 9;d>=0;d--) {
                    if(UNUSED(mask, d)) {
                        sum += d*vars[j].first;
                        mask |= 1<<d;
                    }
                }
            }
            return sum < 0;
        };
        for(int j = 0;j<10;j++) {
            q.emplace(0, j, true);
        }
        while(!q.empty()) {
            int i, digit, w;
            char c;
            bool forward;
            tie(i, digit, forward) = q.top();
            q.pop();
            tie(w, c) = vars[i];
            int maski = 1<<digit;
            if(!forward) {
                mask &= ~maski;
                sum -= w*digit;
                continue;
            }
            if(digit == 0 && leads.find(c) != leads.end()) {
                continue;
            }
            mask |= maski;
            sum += w*digit;
            if(i == n-1 && sum == 0) {
                return true;
            }
            q.emplace(i, digit, false);
            if(noHope(sum, mask, i)) {
                continue;
            }
            for(int d = 0;d<10;d++) {
                if(UNUSED(mask, d)) {
                    q.emplace(i+1, d, true);
                }
            }
        }
        return false;
    }
};
```

### Approach 2 (Left-Right Split, DFS), 50X Faster
- I found a new approach which 50x faster compared to the above
- Sort the weight, then travel from lowest weight to the highest and keep track of the $sum$, our goal is to find an answer that has $sum = 0$
- Divide the variables into 2 parts with length = $n/2$. the left and the right part. Because our weight is sorted, the following is true:
    - We handle separately the special case where $Left = Right = 0$
    - We have $Left + Right = 0$ and $Left < Right$, thus $Left < 0$
- We calculate all possible combination for $Left$ parts.
    - There are at most $10 \div 2 = 5$ variables on the left. So we choose 5 number from 0 to 9 ordered to assign to 5 variables
    - There are at most $10P5 = \frac{10!}{5!} = 30240$ way to assign 5 variables. Some of them will end up making $Left > 0$. We ignore those cases

- With all the possiblity of the $Left$ calculated. We traverse all the possibility of the $Right$. Find the maching value on the $Left$ to see if they sum to $0$

### Complexity
- Time complexity: $O(\frac{10!}{(10-n \div 2)!})$
- Space complexity: $O(n)$

### Code
Rust (30ms)

```rust
impl Solution {
    pub fn is_solvable(words: Vec<String>, result: String) -> bool {
        use std::collections::{HashMap, HashSet};
        let mut weight = HashMap::new();
        let mut leads = HashSet::new();
        let mut update_weight = |w: String, mut k: i32| {
            for c in w.chars().rev() {
                weight.entry(c)
                    .and_modify(|w| *w += k)
                    .or_insert(k);
                k *= 10;
            }
            if w.len() > 1 {
                for c in w.chars().take(1) {
                    leads.insert(c);
                }
            }
        };
        for w in words {
            update_weight(w, 1);
        }
        update_weight(result, -1);
        let mut weight: Vec<(i32, bool)> = weight.into_iter()
            .map(|(k,v)| (v, leads.contains(&k)))
            .collect();
        weight.sort();
        println!("weight = {weight:?}");
        let n = weight.len();
        let m = n/2;
        let mut sum: HashMap<i32, HashSet<i32>> = HashMap::new();
        let mut used_digit = vec![false;10];
        let mut slot = 0;
        let mut q: Vec<(i32, bool)> = Vec::new();
        for i in 0..=9 {
            q.push((i, false));
        }
        let mut mask = 0;
        let mut value = 0;
        while let Some((d, revert)) = q.pop() {
            if revert {
                used_digit[d as usize] = false;
                slot -= 1;
                //println!("revert {d} at slot {slot}, value before revert = {value}");
                let (w, _) = weight[slot];
                mask ^= 1<<d;
                value -= w*d;
                continue;
            }
            //println!("use {d} at slot {slot}, value before use = {value}");
            let (w, is_lead) = weight[slot];
            used_digit[d as usize] = true;
            mask |= 1<<d;
            value += w*d;
            slot += 1;
            q.push((d, true));
            if is_lead && d == 0 {
                continue;
            }
            if value > 0 {
                continue;
            }
            if slot >= m {
                sum.entry(value)
                    .and_modify(|set| { set.insert(mask); })
                    .or_insert(HashSet::from([mask]));
                continue;
            }
            for i in (0..=9).filter(|&i| !used_digit[i as usize]) {
                q.push((i, false));
            }
        }
        if n == 1 {
            return sum.contains_key(&0);
        }
        for i in (0..=9).rev() {
            q.push((i, false));
        }
        used_digit = vec![false;10];
        slot = m;
        mask = 0;
        value = 0;
        while let Some((d, revert)) = q.pop() {
            if revert {
                used_digit[d as usize] = false;
                slot -= 1;
                let (w, _) = weight[slot];
                mask ^= 1<<d;
                value -= w*d;
                continue;
            }
            //println!("use {d} at slot {slot}, value before use = {value}");
            let (w, is_lead) = weight[slot];
            used_digit[d as usize] = true;
            mask |= 1<<d;
            value += w*d;
            slot += 1;
            q.push((d, true));
            if is_lead && d == 0 {
                continue;
            }
            if slot >= n {
                if value >= 0 && sum.get(&-value)
                    .is_some_and(|set| set.iter().any(|m| m & mask == 0)) {
                    return true;
                }
                continue;
            }
            for i in (0..=9).filter(|&i| !used_digit[i as usize]) {
                q.push((i, false));
            }
        }
        return false;
    }
}
```
