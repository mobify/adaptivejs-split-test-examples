// Scripts required in via this file will be combined into ui.js
require(
    [
        'view-scripts/global',
        'view-scripts/home'

        // Add additional UI scripts here
    ],
    function(
        globalUI,

        home
    ) {
        globalUI();
    },
    null,
    // ForceSync makes sure all templates have loaded before page scripts are
    // invoked
    true
);
