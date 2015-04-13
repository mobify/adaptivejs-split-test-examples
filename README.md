# A/B (Split) Test Examples

A/B testing (sometimes called split testing) is comparing two versions of a web page to see which one performs better. You compare two web pages by showing the two variants (let's call them A and B) to similar visitors at the same time. The one that gives a better conversion rate is then used in favor of the other.

It is possible to perform A/B testing at multiple points in Adaptive.js. We've compiled some examples here to help guide you through the different implementations.

## Types of A/B Tests

Below are the different level of splits we can have with example links:


| A/B Test Type | When to use | Split code location |
| :---- | :----------- | ------------- |
| **Tag level split** | When you want to serve different bundle paths | Tag |
| **Router level split** | When you want to serve different views | Router |
| **[Template level split](template-split/README.md)** | When you want to serve different templates | View |
| **UI Script level split** | When you want to serve different variations of feature that are added to the page dynamically (i.e. via AJAX) | UI script |
