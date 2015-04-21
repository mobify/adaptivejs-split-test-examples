#Router Level Split

This is an example demonstrating how you would perform a split test on the router level in Adaptive.js. The split is performed in the router, and ultimately serves the view chosen by our split test.

## Implementation

1. **Install the `split-test` library**

	Install `split-test` using bower:

	```cli
	bower install split-test --save
	```

	Path out the `split-test` library in the adaptation [config](adaptation/config.js#L12):

	```cli
	'split-test': '../bower_components/split-test/src/js/split-test'
	```

	Because we'll be split testing against different templates, we'll want to require them all into the view 		via the view's `define` call. This will allow us to be able to call them later using the `require` 		function.

	**Hint:**
	Adaptive.js uses r.js to compile all our files into a single file. This single file uses 				[Almond](https://github.com/jrburke/almond) to provide AMD loading on an optimized file. Due to 		this, we need to ensure our templates are all pre-loaded, as we won't be able to load templates 		dynamically.

1. **Implement the split**

	Require in the view variations.

	```js
	define([
	    '$',
	    'adaptivejs/router',
	    'split-test',

	    // View variations
	    'views/home1',
	    'views/home2',
	    'views/home3'
	],
	function($, Router, SplitTest) {
	...
	});
	```

1. **Define the split condition**

	The first parameter we pass to `SplitTest.init` is an object containing the split configuration. This 			configuration is made up of key/value pairs, where the key is a string representing the name of the 	split, and the value is a decimal number between 0 and 1.0. As such, **the total of all the values must add up 	to 1.0, which would represent 100%**. 
	
	Calling the `SplitTest.init` function will automatically calculate a random choice and store that value in 	a cookie. Subsequent calls to init will not generate a new choice if a cookie is determined to exist.
	
	**Hint**
	You can utilize the keys of the object to store a value for later use. So, in our case because we are 			choosing between a number of view names, we can store the view name as the key. This will 		save us time and simplify our code when we're retrieving our view later. We'll demonstrate that 		below.

	```js
	define([
	    '$',
	    'adaptivejs/router',
	    'split-test',

	    // View variations
	    'views/home1',
	    'views/home2',
	    'views/home3'
	],
	function($, Router, SplitTest) {
	    var router = new Router();

	    var splitTest = SplitTest.init({
	        'home1': 0.2,               // 20% of traffic sees home1 variation
	        'home2': 0.6,               // 60% of traffic sees home2 variation
	        'home3': 0.2                // 20% of traffic sees home3 variation
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
	    'adaptivejs/router',
	    'split-test',

	    // View variations
	    'views/home1',
	    'views/home2',
	    'views/home3'
	],
	function($, Router, SplitTest) {
	    var router = new Router();
	    
	    var splitTest = SplitTest.init({
	        'home1': 0.2,               // 20% of traffic sees home1 variation
	        'home2': 0.6,               // 60% of traffic sees home2 variation
	        'home3': 0.2                // 20% of traffic sees home3 variation
	    }, {
	        namespace: 'mobify',        // make sure we don't have cookie name conflict
	        lifetime: 15 * 24 * 3600    // cookie will expire in 15 days represented in seconds
	    });
	
	    var choice = splitTest.getChoice();
	    
	    ...
	});
	```

1. **Utilize the split choice to get our view**

	Since we used the view names we want to choose between as the keys of our choices, calling 				`splitTest.getChoice` conveniently returns a view name. We can then use that to load which 			view we want.

	```js
	define([
	    '$',
	    'adaptivejs/router',
	    'split-test',

	    // View variations
	    'views/home1',
	    'views/home2',
	    'views/home3'
	],
	function($, Router, SplitTest) {
	    var router = new Router();
	    
	    var splitTest = SplitTest.init({
	        'home1': 0.2,               // 20% of traffic sees home1 variation
	        'home2': 0.6,               // 60% of traffic sees home2 variation
	        'home3': 0.2                // 20% of traffic sees home3 variation
	    }, {
	        namespace: 'mobify',        // make sure we don't have cookie name conflict
	        lifetime: 15 * 24 * 3600    // cookie will expire in 15 days represented in seconds
	    });
	
	    var choice = splitTest.getChoice();

	    router
	        .add(Router.selectorMatch('body'), require('views/' + choice));

	    return router;
		});
	```
	
1. **Implement analytics tracking for our split test**

	Add an overridable block in [base.js](adaptation/templates/base.dust). This block should be placed within the `<body>`. This will allow templates that inherit from base.dust to override this block *if* they need to track the split test. In our case, this would most likely be the three variations of home: home1.dust, home2.dust, and home3.dust.
	
	```
	        {+uiScripts}{/uiScripts}
	    {/scripts}
	    {+splitAnalytics}{/splitAnalytics}
	</body>
	```

1. **Identify the view variations for analytics tracking**

	We add the variation as a property on our context. This allows us to use it later in the UI when sending 	calls to our analytics.

	```js
	define([
	    '$',
	    'views/base',
	    'dust!templates/home1'
	],
	function($, BaseView, Home1) {

	    return {
	        template: Home1,
	        extend: BaseView,
	        context: {
	            templateName: 'home1',
	            variation: 'variation 1',		// key for split test analytics tracking
	            firstp: function() {
	                return $('p').first().text() || 'Could not find the first paragraph text in your page';
	            }
	        }
	    };
	});
	```


1. **Create a split test analytics partial**

	Create a [partial](adaptation/templates/partials/_splitAnalytics.dust) that makes the analytics calls.

	```html
	<script>
	    (function($) {
	        Mobify.analytics.ua('mobifyTracker.set', 'dimension5', '{variation}');
	        Mobify.analytics.ua('mobifyTracker.send', 'event', 'Mobify', 'SplitTest', {'nonInteraction': 1});
	    })(Mobify);
	</script>
	```

	Add the partial to the three template variations, which will ensure these templates are the only ones 			tracking the variations.
	
	```
	{<splitAnalytics}
	    {>"templates/partials/_splitAnalytics"/}
	{/splitAnalytics}
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

```cli
git clone https://github.com/<organization>/adaptivejs-split-test-examples.git
```

Change folder to `router-split` and install the node modules and the bower components

```cli
npm install
bower install
```

## Running locally

To preview the example, run the following command in the terminal

```grunt preview```
