---
title: Ten days of statistics (6) - Poisson & normal distribution
excerpt: Let's learn basic statistics in 10 days
cover: /blog/post/statistics-10/5024147.jpg
date: 2023-02-15
categories:
  - combinatorics
  - statistics
  - math
---

## Poisson Experiment

Poisson experiment is a statistical experiment that has the following properties:

- The outcome of each trial is either success or failure.
- The average number of successes $\lambda$ that occurs in a specified region is known.
- The probability that a success will occur is proportional to the size of the region.
- The probability that a success will occur in an extremely small region is virtually zero.

## Poisson distribution

A Poisson random variable is the number of successes that result from a Poisson experiment.
The probability distribution of a Poisson random variable is called a Poisson distribution:

$$
P(k, \lambda) = \frac{\lambda^ke^{-\lambda}}{k!}
$$

Where

- $k$ is the number of expected successes
- $\lambda$ is the average number of successes
- $e$ is Euler's number, $e = 2.71828$

### Example

Vova sells 2 cars per day on average. What is the probability of him selling 3 cars today?

$$
P(3,2) = \frac{2^3\times e^{-2}}{3!} = 0.180
$$

What is the probability of him selling at most 4 cars today?

$$
\sum_{k=0}^{4} \frac{2^k\times e^{-2}}{k!} = 0.94734825712
$$

## Normal distribution

The probability density of normal distribution is:

$$
N( \mu , \sigma) = \frac{1}{\sigma\sqrt{2\pi}} e^{-(x-\mu)^2/(2\sigma^2)}
$$

Where $\mu$ is the mean, $\sigma$ is the standard deviation

### Why is it called normal?

Because apparently it is the **most popular** distribution found in natural ([learn more](https://en.wikipedia.org/wiki/Normal_distribution#Naming))

## Cumulative probability

Let $\Phi(x)$ is the cumulative distribution function of $x$,
denotes the probability of all values less than or equal to $x$

$$
\begin{align*}
\Phi(x) &= \frac{1}{2}(1+ error(\frac{x-\mu}{\sigma\sqrt{2}})) \\
error(z) &= \frac{2}{\sqrt{\pi}} \int_{0}^{z} e^{-x^2} dx
\end{align*}
$$

## Practice

Hackerrank has some exercises for you to test your knowledge:

- https://www.hackerrank.com/challenges/s10-poisson-distribution-1/problem
- https://www.hackerrank.com/challenges/s10-poisson-distribution-2/problem
- https://www.hackerrank.com/challenges/s10-normal-distribution-1/problem
- https://www.hackerrank.com/challenges/s10-normal-distribution-2/problem
