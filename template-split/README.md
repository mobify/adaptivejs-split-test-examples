#Dust Template Level Split

This folder contains the example code for the dust template level split for Adaptive.js project.

## Split Implementation Steps

Install `split-test` using bower

```
bower install split-test --save
```
Reference the `split-test` file in the adaptation [config.js](adaptation/config.js#L12)

```
'split-test': '../bower_components/split-test/src/js/split-test'
```

Prepare the dust template variations (For example: [home1](adaptation/templates/home1.dust#L4), [home2](adaptation/templates/home2.dust#L4), [home3](adaptation/templates/home3.dust#L4))

###Implement the split

Reference: [views/home.js](adaptation/views/home.js)

Require in the dust template variations.

```
    // Template variations
    'dust!templates/home1',
    'dust!templates/home2',
    'dust!templates/home3'
```
We preload the dust template variations using `define`, so that `require` can find it later using the same file string.

Define the split condition.

```
	var splitTest = SplitTest.init({
		 							// Split ratio
        'home1': 0.2,               // 20% of traffic sees home1 variation
        'home2': 0.6,               // 60% of traffic sees home2 variation
        'home3': 0.2                // 20% of traffic sees home3 variation
    }, {
        namespace: 'mobify',        // make sure we don't have cookie name conflict
        lifetime: 15 * 24 * 3600    // cookie will expire in 15 days represented in seconds
    });
```
The split ratio should always add up to 1.

Get the split choice by using the following method

```
var choice = splitTest.getChoice();
```
Since we define the split name exactly the same as the dust template name, we can do the following to obtain the dust template:

```
    return {
        template: require('dust!templates/' + choice),
```
Let's also return the `choice` in a selector key so that the analytic can use it as well.

```
	context: {
		templateName: 'home',
		variation: choice,
```

Prepare the split analytic overridable block in [base.js](adaptation/templates/base.dust). This block should be placed within the `<body>`.

```
        {+uiScripts}{/uiScripts}
    {/scripts}
    {+splitAnalytic}{/splitAnalytic}
</body>
```
Prepare the analytic partial: [_splitAnalytic.dust](adaptation/templates/partials/_splitAnalytic.dust)

```
<script>
    (function($) {
        Mobify.analytics.ua('mobifyTracker.set', 'dimension5', '{variation}');
        Mobify.analytics.ua('mobifyTracker.send', 'event', 'Mobify', 'SplitTest', {'nonInteraction': 1});
    })(Mobify);
</script>
```
Include the analytic partial dust only in the template variations (example: [home1](adaptation/templates/home1.dust), [home2](adaptation/templates/home2.dust), [home3](adaptation/templates/home3.dust))

```
{<splitAnalytic}
    {>"templates/partials/splitAnalytic"/}
{/splitAnalytic}
```

And you are done!

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