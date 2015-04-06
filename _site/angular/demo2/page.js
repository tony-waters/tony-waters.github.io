angular.module('pageModule', [])

.directive("page", function() {
    return {
        transclude: true,
        replace: true,
        templateUrl: '/angular/demo2/page.html',
        link: function(scope, iElement, attributes, controller, transcludeFn) {
            console.log("iElement:", iElement);

            //
            // find the page elements in the template
            //
            var header = iElement.find('header');
            var sidebar = iElement.find('sidebar');
            var main = iElement.find('main');
            var footer = iElement.find('footer');
            
            var headerContent;
            var sidebarContent;
            var mainContent;
            var footerContent;
            
            //
            // locate transcluded source
            //
            transcludeFn(scope, function(clone) {
                angular.forEach(clone, function (cloneEl) {
                    var localName = cloneEl.localName;
                    if(localName !== null) {
                        var contents = angular.element(cloneEl).contents();
                        switch (localName) {
                            case 'header':
                                headerContent = contents;
                                break;
                            case 'sidebar': 
                                sidebarContent = contents;
                                break;
                            case 'main':
                                mainContent = contents;
                                break;
                            case 'footer':
                                footerContent = contents;
                                break;
                        }
                    }
                });
            });
            
            //
            // transclude source into template elements
            //
            header.replaceWith(headerContent);
            sidebar.replaceWith(sidebarContent);
            main.replaceWith(mainContent);
            footer.replaceWith(footerContent);
            
        }
    };
});
