---
title: Split Message Based on Limit
date: 2022-11-16
categories:
  - algorithm
  - greedy
  - implementation
  - leetcode
excerpt: A hard problem that is heavy on implementation
---

## Problem

You are given a string, $message$, and a positive integer, $limit$.

You must split message into one or more parts based on limit. Each resulting part should have the suffix `<a/b>`, where "b" is to be replaced with the total number of parts and "a" is to be replaced with the index of the part, starting from $1$ and going up to $b$. Additionally, the length of each resulting part (including its suffix) should be equal to $limit$, except for the last part whose length can be at most limit.

The resulting parts should be formed such that when their suffixes are removed and they are all concatenated in order, they should be equal to $message$. Also, the result should contain as few parts as possible.

Return the parts $message$ would be split into as an array of strings. If it is impossible to split message as required, return an empty array.

### Example

```
Input: message = "this is really a very awesome message", limit = 9
Output: ["thi<1/14>","s i<2/14>","s r<3/14>","eal<4/14>","ly <5/14>","a v<6/14>","ery<7/14>"," aw<8/14>","eso<9/14>","me<10/14>"," m<11/14>","es<12/14>","sa<13/14>","ge<14/14>"]
Explanation:
The first 9 parts take 3 characters each from the beginning of message.
The next 5 parts take 2 characters each to finish splitting message.
In this example, each part, including the last, has length 9.
It can be shown it is not possible to split message into less than 14 parts.
```

```
Input: message = "short message", limit = 15
Output: ["short mess<1/2>","age<2/2>"]
Explanation:
Under the given constraints, the string can be split into two parts:
- The first part comprises of the first 10 characters, and has a length 15.
- The next part comprises of the last 3 characters, and has a length 8.
```

### Constraints

- $1 \leq message.length \leq 104$
- $message$ consists only of lowercase English letters and ' '
- $1 \leq limit \leq 10^4$

Submit your solution at [here](https://leetcode.com/problems/split-message-based-on-limit/)

## Solution

### Intuition

Sadly no short/elegant solution. I divided this problem into 5 situations:

- result has $[1,9]$ parts
  - we need a filler length $5$ for every part
  - each part can have $limit - 5$ characters
- result has $[10,99]$ parts
  - need a filler length $6$ for each of first $9$ parts
    - those parts can have $limit - 6$ characters
  - need a filler length $7$ for the next $90$ parts
    - those parts can have $limit - 7$ characters
- result has $[100,999]$ parts
  - need a filler length $7$ for each of first $9$ parts
  - need a filler length $8$ for the next $90$ parts
  - need a filler length $9$ for the next $900$ parts
- result has $[1000,9999]$ parts
  - same logic as above
- result has $10000$ parts, that's impossible

### Code

```cpp
class Solution {
public:
    void addFiller(vector<string>& arr) {
        int m = arr.size();
        for(int i = 0;i<m;i++) {
            ostringstream ss;
            ss<<'<'<<i+1<<'/'<<m<<'>';
            arr[i] += ss.str();
        }
    }
    vector<string> splitMessage(string message, int limit) {
        // arr len contains 1 digit
        // -> must have filler <a/b> 5 char
        // arr len contains 2 digit
        // -> must have filler <a/bc> 6 char, <ab/cd> 7 char
        // arr len contains 3 digit
        // -> must have filler <a/bcd> 7 char, <ab/cde> 8 char, <abc/def> 9 char
        // can arr len be <= 9? 9*(limit - 5) >= n
        // can arr len be <= 99? (limit - 6)*9 + (limit - 7)*90 >= n
        // can arr len be <= 999? (limit - 7)*9 + (limit - 8)*90 + (limit - 9)*900 >= n
        // can arr len be <= 9999? (limit - 8)*9 + (limit - 9)*90 + (limit - 10)*900 + (limit - 11)*9000 >= n
        int n = message.size();
        int i = 0;
        vector<string> ret;
        int cap = 9*(limit - 5); // split into 9 parts, how many char can we handle?
        if(cap >= n) {
            while(i<n) {
                int len = limit - 5;
                ret.push_back(message.substr(i, len));
                i+= len;
            }
            addFiller(ret);
            return ret;
        }
        cap = (limit - 6)*9 + (limit - 7)*90;
        if(cap >= n) {
            while(i<n) {
                int flen = ret.size()<9?6:7;
                int len = limit - flen;
                ret.push_back(message.substr(i, len));
                i+= len;
            }
            addFiller(ret);
            return ret;
        }
        cap = (limit - 7)*9 + (limit - 8)*90 + (limit - 9)*900;
        if(cap >= n) {
            while(i<n) {
                int flen = 9;
                if(ret.size() < 9) {
                    flen = 7;
                } else if(ret.size() < 99) {
                    flen = 8;
                }
                int len = limit - flen;
                ret.push_back(message.substr(i, len));
                i+= len;
            }
            addFiller(ret);
            return ret;
        }
        cap = (limit - 8)*9 + (limit - 9)*90 + (limit - 10)*900 + (limit - 11)*9000;
        if(cap >= n) {
            while(i<n) {
                int flen = 11;
                if(ret.size() < 9) {
                    flen = 8;
                } else if(ret.size() < 99) {
                    flen = 9;
                } else if(ret.size() < 999) {
                    flen = 10;
                }
                int len = limit - flen;
                ret.push_back(message.substr(i, len));
                i+= len;
            }
            addFiller(ret);
            return ret;
        }
        return ret;
    }
};
```
