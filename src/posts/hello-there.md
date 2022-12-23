---
title: "Automatic heading links in mdsvex"
date: "2021-10-26"
updated: "2021-11-01"
categories:
  - "sveltekit"
  - "markdown"
coverImage: "https://picsum.photos/400/200"
coverWidth: 16
coverHeight: 9
excerpt: Check out how heading links work with this starter in this post.
---

Here are some headings:

## Here's an h2

Lorem ipsum dolor sit amet

### This is an h3

Lorem ipsum dolor sit amet

#### As you've probably guessed, this is an h4

```js
import init from "$lib/locales/i18n";

export const prerender = true;
export async function load() {
  await init();
}
```

Lorem ipsum dolor sit amet

##### This, of course, is an h5

Lorem ipsum dolor sit amet

$$nPr = \frac{n!}{(n-r)!}$$

###### We're deep in h6 territory now

Lorem ipsum dolor sit amet

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
