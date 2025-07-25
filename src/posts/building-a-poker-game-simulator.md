---
title: Building a Fast Poker Game Simulator with Rust and WebAssembly
date: 2024-01-25
categories:
  - rust
  - webassembly
  - svelte
  - algorithms
excerpt: How I built a Texas Hold'em poker simulator that calculates winning odds using bit manipulation
---

Have you ever wondered what your exact odds are in a poker hand? Not estimates or approximations, but the precise probability calculated by evaluating every possible outcome? I built a poker game simulator that does exactly that, and in this post, I'll share the technical journey of creating a solver that can crunch through over a million game scenarios in seconds.

## The Challenge

Building a poker simulator sounds straightforward until you consider the combinatorial explosion. In Texas Hold'em:
- A deck has 52 cards
- Each player gets 2 hole cards
- 5 community cards are dealt
- With partial information, you need to evaluate all possible opponent hands and remaining community cards

Here's how the possibilities scale based on known information:

| Known Cards | Your Hand | Opponent's Hand | Community Cards | Remaining Cards | Possible Scenarios |
|-------------|-----------|-----------------|-----------------|-----------------|-------------------|
| Pre-flop | 2 cards | 0 cards | 0 cards | 50 cards | 1,070,190 |
| Pre-flop | 2 cards | 2 cards | 0 cards | 48 cards | 17,296 |
| Flop | 2 cards | 0 cards | 3 cards | 47 cards | 178,365 |
| Flop | 2 cards | 2 cards | 3 cards | 45 cards | 990 |
| Turn | 2 cards | 0 cards | 4 cards | 46 cards | 15,180 |
| Turn | 2 cards | 2 cards | 4 cards | 44 cards | 44 |
| River | 2 cards | 0 cards | 5 cards | 45 cards | 990 |
| River | 2 cards | 2 cards | 5 cards | 43 cards | 1 |

The worst case—when you only know your own 2 cards—requires evaluating over 1 million possible game states. The challenge was to build something that could handle this exhaustive computation while remaining responsive and user-friendly.

## Architecture Overview

The project consists of two main components:

1. **poker-solver**: A Rust library that handles all game logic and probability calculations
2. **poker-simulator**: A SvelteKit frontend that provides an intuitive interface

## Bit-mask Card Representation

I use 64-bit integer to represent a hand, actually we only need 52 bits:

```rust
pub struct Hand {
    pub mask: i64,
}

// Each card gets a unique bit position (0-51)
// Position = rank * 4 + suit
// Example: Ace of Spades = bit 48
```

Why is this brilliant? It transforms expensive operations into simple bitwise operations:
- Combining hands: `hand1.mask | hand2.mask`
- Checking overlap: `(hand1.mask & hand2.mask) != 0`
- Counting cards: `hand.mask.count_ones()`

This representation allows us to perform hand operations in O(1) time instead of iterating through card arrays.

## Pattern Matching for Hand Evaluation

Instead of checking each hand type with complex logic, I pre-computed all possible patterns:
For example I use these masks to quickly test if a hand containing a triple (222, 333, 444, ...)
```rust
// Pattern for three of a kind combinations
const SAME_RANK_3X: [i64; 4] = [
    0b1110, // ♠♣♦
    0b1101, // ♠♣♥
    0b1011, // ♠♦♥
    0b0111, // ♣♦♥
];
```

The evaluator checks these patterns in order of hand strength (straight flush → high card). When it finds a match, it uses bit manipulation to extract the exact cards forming that hand. This approach is not only fast but also cache-friendly, a 64bit integer is tiny we can fit so many of that in CPU cache.

## The Simulation Algorithm

The solver uses a breadth-first search approach to evaluate all possible game states:

```rust
pub fn compute(&mut self) -> GameResult {
    let mut queue = VecDeque::new();
    queue.push_back(initial_state);

    while let Some(state) = queue.pop_front() {
        if state.is_complete() {
            // Evaluate and update win/lose/tie counts
        } else {
            // Generate next possible states
            for card in available_cards {
                queue.push_back(state.add_card(card));
            }
        }
    }
}
```

On top of the BFS search, I use a hash map to avoid computing the same game over and over.

## WebAssembly Integration

Compiling to WASM was surprisingly straightforward with `wasm-bindgen`:

```rust
#[wasm_bindgen]
pub fn solve(hand_a: String, hand_b: String, community: String) -> GameResult {
    static GAME_INSTANCE: OnceLock<Mutex<Game>> = OnceLock::new();
    let game = GAME_INSTANCE.get_or_init(|| Mutex::new(Game::new()));
    // ... parse and compute
}
```

Heavy computations run in a Web Worker, keeping the UI responsive:

```javascript
// Main thread
const worker = new Worker('poker-solver.js');
worker.postMessage({ handA, handB, community });

// Worker thread
import init, { solve } from './poker_solver_bg.wasm';
self.onmessage = async (e) => {
    const result = solve(e.data.handA, e.data.handB, e.data.community);
    self.postMessage(result);
};
```

## Performance Results

The optimizations paid off dramatically:
- **Worst-case scenario** (1,070,190 possibilities): ~4 seconds native, ~16 seconds WASM
- **Typical late-game scenario**: 50-290ms
- **Memory usage**: Minimal due to bit-packed representation

## Future Improvements

While the current implementation is fast, there's room for enhancement:
- **Parallelization**: Use Rayon to evaluate hands across multiple cores
- **SIMD instructions**: Batch evaluate multiple hands simultaneously
- **Approximate mode**: Monte Carlo sampling for instant estimates
- **Other variants**: Extend to Omaha or Seven-Card Stud

## Try It Yourself

The entire project is open source:
- [poker-solver (Rust/WASM)](https://github.com/hucancode/poker-solver)
- [poker-simulator (Frontend)](https://github.com/hucancode/poker-simulator)
You can also try the [live demo](https://poker.lamsaoquenem.day/) to see it in action.

![](/blog/post/building-a-poker-game-simulator/web.png)

I hope my humble works inspires you to push the boundaries of what's possible in web applications. Modern web are not slow as they used to be :)
