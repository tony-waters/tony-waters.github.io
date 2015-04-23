angular.module('pageModule', [])
        .directive('page', directive)
        .config(function ($interpolateProvider) {
            $interpolateProvider.startSymbol('[[[').endSymbol(']]]')
        })

function directive() {
    return {
        transclude: true,
        replace: true,
        templateUrl: '/angular/demo2/page.html',
        link: link,
        scope: {}
    }
}

function link(scope, iElement, attrs, ctrl, transcludeFn) {
    transcludeFn(scope.$parent.$new(), function (clone) {
        angular.forEach(clone, function (cloneEl) {
            if (cloneEl.nodeType === 1) {
                // get target id
                console.log(cloneEl.localName)
                var targetId = cloneEl.attributes["transclude-to"].value
                console.log(targetId)
                // find target element with that id
                var targetIdString = '[transclude-id="' + targetId + '"]'
                var target = iElement.find(targetIdString)
                // append element to target
                if (target.length) {
                    target.append(cloneEl)
                } else {
                    cloneEl.remove()
                    throw new Error('Target not found, specify correct transclude-to attribute')
                }
            } else {
                cloneEl.remove()
            }
        })
    })
}
