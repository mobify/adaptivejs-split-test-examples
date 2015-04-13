define(['$'], function($) {
    return {
        context: {
            title: function() {
                var $title = $('title');
                return $title.length > 0 ? $title.text() : 'no title found';
            }
        }
    };
});
