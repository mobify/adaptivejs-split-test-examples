#Split Test Examples

Split testing is a scenario where we want to find out if a certain variation of a page will perform better than another variation.

In this repository, we have provided examples of how to do different levels of split test that we may need on adaptive projects.

Below are the different level of splits we can have with example links:

- **Tag level split**: This is when we want to test the difference between different built or mobile verse desktop situations. This does requires a special tag to make this possible.
- **Router level split**: This is when we want to test the difference between different template built where the selectors between the variations are very different
- **[Dust Template level split](template-split/README.md)**: This is when we want to test the difference between different template built where the selectors between the variations are very similar, however the dust presentation is very different
- **UI Script level split**: This is when we want to test the difference between variations where transformation is not possible in the adaptation stage (ie. ajax'ed or script built html)