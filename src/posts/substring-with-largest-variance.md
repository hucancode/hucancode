---
title: Substring With Largest Variance
date: 2022-11-22
categories:
  - algorithm
  - dynamic-programming
  - leetcode
excerpt: A hard problem that can be solved using dynamic programming
---

## Problem

The variance of a string is defined as the largest difference between the number of occurrences of any 2 characters present in the string. Note the two characters may or may not be the same.

Given a string $s$ consisting of lowercase English letters only, return the largest variance possible among all substrings of $s$.

_A substring is a contiguous sequence of characters within a string_

### Example

```
Input: s = "aababbb"
Output: 3
Explanation:
All possible variances along with their respective substrings are listed below:
- Variance 0 for substrings "a", "aa", "ab", "abab", "aababb", "ba", "b", "bb", and "bbb".
- Variance 1 for substrings "aab", "aba", "abb", "aabab", "ababb", "aababbb", and "bab".
- Variance 2 for substrings "aaba", "ababbb", "abbb", and "babb".
- Variance 3 for substring "babbb".
Since the largest possible variance is 3, we return it.
```

```
Input: s = "abcde"
Output: 0
Explanation:
No letter occurs more than once in s, so the variance of every substring is 0.
```

### Constraints

- $1 \leq s.length \leq 104$
- $s$ consists of lowercase English letters

Submit your solution at [here](https://leetcode.com/problems/substring-with-largest-variance/)

## Solution

### Intuition

- First consider problem with only 2 character type, say **a** and **b**
  - Let $f(i)$ be the optimal score of all substring end at $i$, with or without character **b** in it
  - Let $g(i)$ be the optimal score of all substring end at $i$, guaranteed having character **b** in it
  - The answer is $max(0, max(g[0,n]))$
- Then loop through all possible $(a,b)$ pairs, calculate and take the best pair

### Code

```cpp
class Solution {
public:
    int largestVariance(string& s, char a, char b) {
        // consider potential pair (a,b)
        // find optimal substring where count[a] - count[b] maximum
        int n = s.size();
        int ret = 0;
        vector<int> f(n, 0); // optimal score for substring with or without b in it
        vector<int> g(n, -1e9); // optimal score for substring with b in it
        if(s[0] == a) {
            f[0] = 1;
        } else if(s[0] == b) {
            g[0] = -1;
        }
        for(int i = 1;i<n;i++) {
            if(s[i] == a) {
                f[i] = max(f[i-1], g[i-1])+1;
                g[i] = g[i-1]+1;
            } else if(s[i] == b) {
                f[i] = max(0, f[i-1]-1);
                g[i] = max(f[i-1],g[i-1])-1;
            } else {
                f[i] = f[i-1];
                g[i] = g[i-1];
            }
            ret = max(ret, g[i]);
        }
        return ret;
        cout<<"g: ";
        for(auto x: g) {
            cout<<x<<" ";
        }
        cout<<endl;
        cout<<"largest variance, check "<<a<<"-"<<b<<" return "<<ret<<endl;
        return ret;
    }
    int largestVariance(string s) {
        set<char> pool;
        for(auto c: s) {
            pool.insert(c);
        }
        int n = s.size();
        int ret = 0;
        for(char a: pool) {
            for(char b: pool) {
                ret = max(ret, largestVariance(s, a, b));
            }
        }
        return ret;
    }
};
```
