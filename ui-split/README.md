#UI Script Level Split

This is an example demonstrating how you would perform a split test on the ui script level in Adaptive.js. The split is performed in the asset view scripts, and ultimately serves the variation chosen by our split test.

This type of split should only be used on dynamic contents that is not available during adaptation. For example, ajaxed content.

## Implementation

1. **Install the `split-test` library**

	Install `split-test` using bower:

	```cli
	bower install split-test --save
	```

	Path out the `split-test` library in the asset [config](assets/js/ui/config.js#L6):

	```cli
	'split-test': '../bower_components/split-test/src/js/split-test'
	```

1. **Define the split condition**

	The first parameter we pass to `SplitTest.init` is an object containing the split configuration. This 			configuration is made up of key/value pairs, where the key is a string representing the name of the 	split, and the value is a decimal number between 0 and 1.0. As such, **the total of all the values must add up 	to 1.0, which would represent 100%**. 
	
	Calling the `SplitTest.init` function will automatically calculate a random choice and store that value in 	a cookie. Subsequent calls to init will not generate a new choice if a cookie is determined to exist.
	
	**Hint**
	You can utilize the keys of the object to store a value for later use. So, in our case because we are 			choosing between a number of template names, we can store the template name as the key. This will 		save us time and simplify our code when we're retrieving our template later. We'll demonstrate that 		below.

	```js
	define([
	    '$',
	    'hijax',
	    'split-test'
	],
	function($, Hijax, SplitTest) {
	    var hijax = new Hijax();

		var splitTest = SplitTest.init({
	        'list': 0.4,               // 40% of traffic sees variation 1
	        'tile': 0.6,             // 60% of traffic sees variation 2
	    }, {
	        namespace: 'mobify',        // make sure we don't have cookie name conflict
	        lifetime: 15 * 24 * 3600    // cookie will expire in 15 days represented in seconds
	    });
	    ...
	});
	```

1. **Get the split choice**

	We get the split choice by invoking the `splitTest.getChoice` function. This retrieves the choice from the 	cookie and returns the chosen key.

	```js
	define([
	    '$',
	    'hijax',
	    'split-test'
	],
	function($, Hijax, SplitTest) {
	    var hijax = new Hijax();

		var splitTest = SplitTest.init({
	        'list': 0.4,               // 40% of traffic sees variation 1
	        'tile': 0.6,             // 60% of traffic sees variation 2
	    }, {
	        namespace: 'mobify',        // make sure we don't have cookie name conflict
	        lifetime: 15 * 24 * 3600    // cookie will expire in 15 days represented in seconds
	    });

	    var choice = splitTest.getChoice();

	    ...
	});
	```

1. **Set up analytic calls**

	```js
	define([
	    '$',
	    'hijax',
	    'split-test'
	],
	function($, Hijax, SplitTest) {
	    var hijax = new Hijax();

		var splitTest = SplitTest.init({
	        'list': 0.4,               // 40% of traffic sees variation 1
	        'tile': 0.6,             // 60% of traffic sees variation 2
	    }, {
	        namespace: 'mobify',        // make sure we don't have cookie name conflict
	        lifetime: 15 * 24 * 3600    // cookie will expire in 15 days represented in seconds
	    });

	    var choice = splitTest.getChoice();

	    // Send split test analytic choice
	    Mobify.analytics.ua('mobifyTracker.set', 'dimension5', choice);
	    Mobify.analytics.ua('mobifyTracker.send', 'event', 'Mobify', 'SplitTest', {'nonInteraction': 1});

	    ...
	});
	```
	
1. **Perform split related task**
	
	```js
	define([
	    '$',
	    'hijax',
	    'split-test'
	],
	function($, Hijax, SplitTest) {
	    var hijax = new Hijax();

		var splitTest = SplitTest.init({
	        'list': 0.4,               // 40% of traffic sees variation 1
	        'tile': 0.6,             // 60% of traffic sees variation 2
	    }, {
	        namespace: 'mobify',        // make sure we don't have cookie name conflict
	        lifetime: 15 * 24 * 3600    // cookie will expire in 15 days represented in seconds
	    });

	    var choice = splitTest.getChoice();

	    // Send split test analytic choice
	    Mobify.analytics.ua('mobifyTracker.set', 'dimension5', choice);
	    Mobify.analytics.ua('mobifyTracker.send', 'event', 'Mobify', 'SplitTest', {'nonInteraction': 1});

		var getProductTiles = function () {
	        hijax
	            .set(
	                'product-tiles',
	                function (url) {
	                    return /productTiles/.test(url);
	                },
	                {
	                    complete: function(data, xhr) {
	                    	// Do split related tasks
	                        $('.c-product-tiles').addClass('c--' + choice);
	                    }
	                }
	            );
		};

	    var homeUI = function() {
	        // Add any scripts you would like to run only on the home page here
	        getProductTiles();
	    };

    	return homeUI;
	});
	```

## Development tips

If you want to test a specific choice, you can simply hard code the split like so:

```js
var choice = 'home1'; // splitTest.getChoice();
```

You can also set the cookie directly simply by deleting the `mobify-split` cookie, and creating a new cookie with a specific value via the console, like so:

```js
document.cookie = 'mobify-split=home3';
```

## Running the example code

To install, first clone the repository:

```
git clone https://github.com/<organization>/adaptivejs-split-test-examples.git
```

Change folder to `ui-split` and install the node modules and the bower components

```
npm install
bower install
```

## Running locally

To preview the example, run the following command in the terminal

```grunt preview```
