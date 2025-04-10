---
title: Ten days of statistics (3) - Probability
excerpt: Let's learn basic statistics in 10 days
cover: /blog/post/statistics-10/5031659.jpg
date: 2023-02-11
categories:
  - combinatorics
  - statistics
  - math
---

## Probability

An experiment is any procedure that can be infinitely repeated and has a limitted set of possible
outcomes (sample space). We define an event to be a set of outcomes we interested in.
The probability of an event is:

$$
P = \frac{\text{Number of interested outcomes}}{\text{Total possible outcomes}}
$$

_From here we will consider 2 events $A$ and $B$, in a sample space $S$_

## Events

Let $P(A)$ denotes the probability of event $A$ occurs, $P(A^c)$ denotes the probability of event $A$ not occurs.

A **compound event** $A \cup B$ is an event where either $A$ or $B$ occurs.

$A$ and $B$ is **mutually exclusive** events if they have no events in common. Formally $A \cap B = \varnothing$

An event is said to be **exhaustive** when it equals to $S$. $A$ and $B$ is collectively exhaustive
when their union covers the sample space. Formally $A \cup B = S$ and $P(A \cup B) = 1$

If the outcome of event $A$ has no impact on event $B$, they are considered to be independent.
When $A$ and $B$ are independent, $P(A \cup B) = P(A) \times P(B)$

## Conditional probability

This is defined as the probability of an event occurring, assuming that one or more other events have already occurred.
Let $P(B|A)$ denotes the probability of $B$ given $A$ occurred.
If events $A$ and $B$ are independent. It's obvious that

$$
P(B|A) = P(B)
$$

If events $A$ and $B$ are not independent, then we must consider the probability that both events occur.

$$
P(B|A) = \frac{P(A \cap B)}{P(A)}
$$

## Bayes' theorem

Bayes' theorem is stated mathematically as the following equation

$$
P(A|B) = \frac{P(B|A) \times P(A)}{P(B)}
$$

Which also equals to

$$
\frac{P(B|A) \times P(A)}{P(B|A) \times P(A) + P(B|A^c) \times P(A^c)}
$$

Where $P(B) \neq 0$

Proof can be found here: https://en.wikipedia.org/wiki/Bayes%27_theorem

Next lesson: [Combinatorics](/blog/post/statistics-3-combinatorics)
