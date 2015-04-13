#Dust Template Level Split

This folder contains the example code for the dust template level split for Adaptive.js project.

## Implementation Steps

1. Include `split-test` bower component in [bower.json](bower.json#L12)
2. Reference the `split-test` file in the adaptation [config.js](adaptation/config.js#L12)
3. Prepare the dust template variations: [home1](adaptation/templates/home1.dust), [home2](adaptation/templates/home2.dust), [home3](adaptation/templates/home3.dust)
4. Implement the split in [views/home.js](adaptation/views/home.js)

From [Line 7 to Line 9](adaptation/views/home.js#L7), we preload the dust template variations using `define`, so that `require` can find it later using the same file string on [Line 24](adaptation/views/home.js#L24)

[SplitTest.init](adaptation/views/home.js#L12) takes the following parameters:
```
SplitTest.init( splitRatios, options);
```

`splitRatios` should add up to 1.
```
// Example:
var splitTest = SplitTest.init({
    'home1': 0.8,	// 80% of traffic sees home1 variation
    'home2': 0.2 	// 20% of traffic sees home2 variation
}, {
    namespace: 'mobify',
    lifetime: 15 * 24 * 3600 // 15 days in seconds
});
```
`namespace` is to make sure we don't have cookie name conflict

## Installation

To install, first clone the repository:

```
git clone https://github.com/<organization>/adaptivejs-split-test-examples.git
```
Change folder to `template-split` and install the node modules and the bower components
```
npm install
bower install
```

## Running locally

To preview the example, run the following command in the terminal
```grunt preview```