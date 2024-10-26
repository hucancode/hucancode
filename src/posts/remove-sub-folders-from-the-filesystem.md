---
title: Remove Sub-Folders from the Filesystem
excerpt: This problem involves eliminating any path that exists as a sub-folder within another path. In this post, I'll walk through my approach to solve this problem using a Trie
date: 2024-10-26
categories:
  - algorithm
  - leetcode
  - trie
---

## Problem

### [Problem Link](https://leetcode.com/problems/remove-sub-folders-from-the-filesystem/)

**Description**:

Given a list of folders `folder`, return the folders after removing all sub-folders in those folders. You may return the answer in any order.

If a folder `/a` is in the folder list, then it will also be in the answer, but if a folder `/a/b` is in the folder list, it will not be in the answer because it is a sub-folder of `/a`.

### Example

```
Input: folder = ["/a","/a/b","/c/d","/c/d/e","/c/f"]
Output: ["/a","/c/d","/c/f"]
Explanation: Folders "/a/b" is a sub-folder of "/a" and "/c/d/e" is inside of "/c/d" in our filesystem.
```

```
Input: folder = ["/a","/a/b/c","/a/b/d"]
Output: ["/a"]
Explanation: Folders "/a/b/c" and "/a/b/d" are sub-folders of "/a" in our filesystem.
```

```
Input: folder = ["/a/b/c","/a/b/ca","/a/b/d"]
Output: ["/a/b/c","/a/b/ca","/a/b/d"]
```

### Constraints:

- $1 <= folder.length <= 4 * 10^4$
- $2 <= folder[i].length <= 100$
- `folder[i]` contains only lowercase letters and '/'
- `folder[i]` always starts with the character '/'
- Each folder name is unique

Submit your solution at [here](https://leetcode.com/problems/remove-sub-folders-from-the-filesystem/)

## Solution

### Approach

The key to this problem is finding a way to efficiently checking a new folder against a list of potential parent folders.
Trie is a good data structure doing that, so I will use Trie to solve this.
We will be doing 2 steps:

1. Sort the folder paths by length, since the sub-folder is always longer than its parent folders. We will not missing any sub-folder travel from folder with shorter path to longer path
2. Travel the folder list and check the current folder
   a. If it doesn't match any previous folder, it is a new folder. Insert it to the Trie
   b. Else, it is a sub-folder, ignore it

### Complexity

- Let $n$ is the folder list length, $m$ is the average path length
- Time complexity: $O(n \times m)$, at worse we will be travel every character in every paths
- Space complexity: $O(n \times m)$, we need spaces to store the clone of the folder paths

### Code

Rust

```rust
use std::collections::HashMap;

#[derive(Default)]
struct Trie {
    children: HashMap<String, Trie>,
    is_leaf: bool,
}

impl Trie {
    pub fn insert(&mut self, value: &str) -> bool {
        if self.is_leaf {
            return false;
        }
        if let Some((value, rest)) = value.split_once('/') {
            return self.children
                .entry(value.to_string())
                .or_default()
                .insert(rest);
        } else {
            self.children
                .entry(value.to_string())
                .or_default()
                .is_leaf = true;
            return true;
        }
    }
}

impl Solution {
    pub fn remove_subfolders(mut folder: Vec<String>) -> Vec<String> {
        folder.sort_by(|a,b| a.len().cmp(&b.len()));
        let mut ret = Vec::new();
        let mut root = Trie::default();
        for s in folder {
            if root.insert(&s) {
                ret.push(s);
            }
        }
        return ret;
    }
}
```

C++

```cpp
class Trie {
    bool is_leaf;
    map<string, Trie> children;
public:
    Trie() {
        is_leaf = false;
    }
    bool insert(string::iterator begin, string::iterator end) {
        if(is_leaf) {
            return false;
        }
        auto i = find(begin, end, '/');
        if(i == end) {
            children[string(begin, end)].is_leaf = true;
            return true;
        } else {
            return children[string(begin, i)].insert(i+1, end);
        }
    }
};
class Solution {
public:
    vector<string> removeSubfolders(vector<string>& folder) {
        sort(folder.begin(), folder.end(), [](string& a, string& b) {
            return a.size() < b.size();
        });
        vector<string> ret;
        Trie root;
        for(auto s: folder) {
            if(root.insert(s.begin(), s.end())) {
                ret.push_back(s);
            }
        }
        return ret;
    }
};
```
