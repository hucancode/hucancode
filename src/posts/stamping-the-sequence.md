---
title: Stamping The Sequence
date: 2022-12-24
categories:
  - algorithm
  - greedy
  - implementation
  - leetcode
excerpt: Practice greedy thinking and implementation with me
---

## Problem

You are given two strings $stamp$ and $target$. Initially, there is a string $s$ of length $target.length$ with all $s[i] = '?'$.

In one turn, you can place $stamp$ over $s$ and replace every letter in the $s$ with the corresponding letter from $stamp$.

For example, if $stamp = "abc"$ and $target = "abcba"$, then $s$ is $"?????"$ initially. In one turn you can:

- place stamp at index $0$ of $s$ to obtain $"abc??"$,
- place stamp at index $1$ of $s$ to obtain $"?abc?"$, or
- place stamp at index $2$ of $s$ to obtain $"??abc"$.

Note that $stamp$ must be fully contained in the boundaries of $s$ in order to stamp (i.e., you cannot place stamp at index $3$ of $s$).
We want to convert $s$ to $target$ using at most $10 * target.length$ turns.

Return an array of the index of the left-most letter being stamped at each turn. If we cannot obtain $target$ from $s$ within $10 * target.length$ turns, return an empty array.

### Example

```
Input: stamp = "abc", target = "ababc"
Output: [0,2]
Explanation: Initially s = "?????".
- Place stamp at index 0 to get "abc??".
- Place stamp at index 2 to get "ababc".
[1,0,2] would also be accepted as an answer, as well as some other answers.
```

```
Input: stamp = "abca", target = "aabcaca"
Output: [3,0,1]
Explanation: Initially s = "???????".
- Place stamp at index 3 to get "???abca".
- Place stamp at index 0 to get "abcabca".
- Place stamp at index 1 to get "aabcaca".
```

### Constraints

- $1 <= stamp.length <= target.length <= 1000$
- $stamp$ and $target$ consist of lowercase English letters

## Solution

### Intuition

We use greedy approach to do the stamping. We will do it in multiple rounds.

- At round 0, we find all "full match" candidates to stamp. It's seems the best we can do at this point
- At round 1, for every stamp $x$ we made in round 0, we go to the left and right, then greedily find the longest possible stamp right next to $x$, stamp them **under** the stamps made in round 0
- At round 2, for every stamp $y$ we made in round 1, we again go to the left and right, find the longest possible stamp to make, stamp them **under** the stamps made in previous rounds
- The loop ends when we run out of moves or when we can't find a stamp anymore
- **I can't prove that this method will yield minimum number of steps. And it seems that indeed it doesn't. If there is a test case where the optimal answer is exactly n\*10 this method would very likely fail. I tried and luckily it passed all the test cases**

### Approach

We maintain 2 queues `ql, qr` to keep track of which item need to check on the left and on the right.
Each time we do a stamp, we put them into queue, so we can revise them in the next round.
After finishing the loop. Reverse the result and we get the answer.

### Complexity

- Time complexity:
  Running time is $T((n-m+1)*m)$ where $n$ is target length and $m$ is stamp length, in worst case where $m = n/2$ we will have $O(n^2)$

- Space complexity:
  $O(n)$

### Code

```cpp
class Solution {
public:
    bool canStamp(string& target, string& paper, string& stamp, int k) {
        if(k < 0) {
            return false;
        }
        int i = 0;
        int m = stamp.size();
        bool matched = false;
        for(int i = 0;i<m;i++) {
            if(paper[i+k] != '?') {
                continue;
            }
            matched = true;
            if(target[i+k] != stamp[i]) {
                return false;
            }
        }
        return matched;
    }

    void stampUnder(string& paper, string& stamp, int k) {
        //cout<<"stamp at "<<k<<" paper = "<<paper<<endl;
        int i = 0;
        int m = stamp.size();
        for(int i = 0;i<m;i++) {
            if(paper[i+k] != '?') {
                continue;
            }
            paper[i+k] = stamp[i];
        }
    }
    vector<int> movesToStamp(string stamp, string target) {
        int m = stamp.size();
        int n = target.size();
        int move = 0;
        int moveMax = 10*n;
        string paper(n, '?');
        vector<int> ret;
        queue<int> ql;
        queue<int> qr;
        for(int i = 0;i<=n-m;i++) {
            if(!canStamp(target, paper, stamp, i)) {
                continue;
            }
            ql.push(i);
            qr.push(i);
            stampUnder(paper, stamp, i);
            ret.push_back(i);
            i += m-1;
            move++;
        }
        while(!(ql.empty() && qr.empty()) && move <= moveMax) {
            int x = ql.size();
            while(x--) {
                auto k = ql.front();
                ql.pop();
                int k0 = k - m + 1;
                for(int i = k0;i<k;i++) {
                    if(!canStamp(target, paper, stamp, i)) {
                        continue;
                    }
                    ql.push(i);
                    move++;
                    stampUnder(paper, stamp, i);
                    ret.push_back(i);
                    break;
                }
            }
            x = qr.size();
            while(x--) {
                auto k = qr.front();
                qr.pop();
                int kn = min(k + m - 1, n-m);
                for(int i = kn;i>k;i--) {
                    if(!canStamp(target, paper, stamp, i)) {
                        continue;
                    }
                    qr.push(i);
                    move++;
                    stampUnder(paper, stamp, i);
                    ret.push_back(i);
                    break;
                }
            }
        }
        if(move > moveMax) {
            ret.clear();
        } else {
            for(auto c: paper) {
                if(c == '?') {
                    ret.clear();
                    break;
                }
            }
        }
        reverse(ret.begin(), ret.end());
        return ret;
    }
};
```
