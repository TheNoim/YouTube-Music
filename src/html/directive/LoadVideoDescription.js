/**
 * Created by nilsbergmann on 05.02.17.
 */
/**
 * Created by nilsbergmann on 05.02.17.
 */


an.directive('videoDescription', () => {
    return {
        template: '{{description}}',
        restrict: "E",
        scope: {
            videoId: "=",
            kind: "="
        },
        controller: ($scope, $element, $attrs) => {
            $scope.$watch('kind', () => {
                $scope.refresh()
            });
            $scope.$watch('videoId', () => {
                $scope.refresh()
            });
            $scope.refresh = function () {
                console.log("Load " + $scope.videoId);
                if (!$scope.loading){
                    if ($scope.kind == "youtube#video") {
                        $scope.loading = true;
                        $scope.safeApply();
                        const request = require('request');
                        request(`https://www.googleapis.com/youtube/v3/videos?key=AIzaSyAmrU02S7vOBKU2Ep6lpaGP9SW7y3K3KKQ&part=snippet&id=${$scope.videoId}`, {json: true}, (error, response, body) => {
                            $scope.loading = false;
                            $scope.safeApply();
                            if (!error && response.statusCode == 200) {
                                $scope.description = body.items[0].snippet.description;
                            }
                        });
                    }
                }
            };
        },
        link: (scope, elem, attrs) => {
            scope.safeApply = function (fn) {
                const phase = this.$root.$$phase;
                if (phase == '$apply' || phase == '$digest') {
                    if (fn && (typeof(fn) === 'function')) {
                        fn();
                    }
                } else {
                    this.$apply(fn);
                }
            };
            scope.safeApply();
            setTimeout(function () {
                scope.videoId = attrs.videoId;
                scope.kind = attrs.kind;
            }, 1000);
        }
    };
});