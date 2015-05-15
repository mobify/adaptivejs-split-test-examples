#Tag Level Split

This is an example demonstrating how you would perform a split test on the tag level. The split is performed in the tag, and ultimately serves the bundle chosen by our split test.

## Custom Split Test Tag

You will need to generate this tag that points to the two different bundles. (More documentation to come)

## Implementation
	
1. **Implement analytics tracking for our split test**

	In both project's `global.js`, we need to send the analytic of the split result.
	
	```js
		define([
		    '$',
		    'fastclick',
		    'deckard'
		],
		function($, fastclick) {
		    var globalUI = function() {
		        fastclick.attach(document.body);

		        // Split Test analytic
		        Mobify.analytics.ua('mobifyTracker.set', 'dimension5', Mobify.SplitTest.getChoice('mobify'));
	        	Mobify.analytics.ua('mobifyTracker.send', 'event', 'Mobify', 'SplitTest', {'nonInteraction': 1});
		    };

		    return globalUI;
		});
	```
	`Mobify.SplitTest` have a static function call `getChoice`. This function will return the split choice
	when a namespace is given.

## Development tips

If you want to test a specific choice, you can set the cookie directly simply by deleting the `mobify-split` cookie, and creating a new cookie with a specific value via the console, like so:

```js
document.cookie = 'mobify-split=home3';
```