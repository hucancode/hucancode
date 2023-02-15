---
title: Ten days of statistics (3) - Probability
excerpt: Let's learn basic statistics in 10 days
date: 2023-02-15
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

## Events

_Consider 2 events $A$ and $B$, in a sample space $S$_

A **compound event** $A \cup B$ is an event where either $A$ or $B$ occurs.

$A$ and $B$ is **mutually exclusive** events if they have no events in common. Formally $A \cap B = \varnothing$

An event is said to be **exhaustive** when it equals to $S$. $A$ and $B$ is collectively exhaustive
when their union covers the sample space. Formally $A \cup B = S$ and $P(A \cup B) = 1$

If the outcome of event $A$ has no impact on event $B$, they are considered to be independent.
When $A$ and $B$ are independent, $P(A \cup B) = P(A) \times P(B)$
