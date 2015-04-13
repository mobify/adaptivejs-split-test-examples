#Dust Template Level Split

This folder contains the example code for the dust template level split for Adaptive.js project.

## Split Implementation Steps

1. Include `split-test` bower component in [bower.json - Line 12](bower.json#L12)
2. Reference the `split-test` file in the adaptation [config.js - Line 12](adaptation/config.js#L12)
3. Prepare the dust template variations: [home1](adaptation/templates/home1.dust#L11), [home2](adaptation/templates/home2.dust#L11), [home3](adaptation/templates/home3.dust#L11)
4. Implement the split in [views/home.js](adaptation/views/home.js)
5. Prepare the analytic override block [base.js - Line 23](adaptation/templates/base.dust#L23)
6. Implement the split test analytic piece in all dust template variations: [home1 - Line 3](adaptation/templates/home1.dust#L3), [home2 - Line 3](adaptation/templates/home2.dust#L3), [home3 - Line 3](adaptation/templates/home3.dust#L3)
7. Make sure the variation key is also in [views/home.js - Line 28](adaptation/views/home.js#L28)

## Implementation Notes

In [views/home.js](adaptation/views/home.js) from [Line 7 to Line 9](adaptation/views/home.js#L7), we preload the dust template variations using `define`, so that `require` can find it later using the same file string on [Line 24](adaptation/views/home.js#L24)

[SplitTest.init - Line 12](adaptation/views/home.js#L12) takes the following parameters:
```
SplitTest.init( splitRatios, options);
```

**`splitRatios`** should add up to 1. For example:
```
var splitTest = SplitTest.init({
    'home1': 0.8,				// 80% of traffic sees home1 variation
    'home2': 0.2 				// 20% of traffic sees home2 variation
}, {
    namespace: 'mobify',		// make sure we don't have cookie name conflict
    lifetime: 15 * 24 * 3600 	// cookie will expire in 15 days represented in seconds
});
```

**During develpment**, you can fix the template choices by the following methods:

Fixed the `choice` in [views/home.js](adaptation/views/home.js#L21)
```
var choice = 'home1'; // splitTest.getChoice();
```
**Or**

Changing the cookie setting by deleting the `mobify-split` cookie and set the desire variation by running the following command in the web console.
```
document.cookie = 'mobify-split=home3';
```


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