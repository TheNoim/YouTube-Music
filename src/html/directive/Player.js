/**
 * Created by nilsbergmann on 05.02.17.
 */

an.directive('mdPlayer', () => {
    return {
        templateUrl: 'directive/Player.html',
        restrict: "E",
        scope: {
            videoId: "=videoId",
            playlistId: "&playlistId",
            onTrackEnd: "&onTrackEnd",
            socket: "=socket"
        },
        controller: ($scope, $element, $attrs, $rootScope) => {
            const percentage = require('percentage-calc');
            $scope.playlistId = $attrs.playlistId;
            $scope.$watch('playlistId', () => {
                log.info("Set current playlist to " + $scope.playlistId);
            });

            $rootScope.$on('UpdatePlayerData', (ev, Data) => {
                $scope.Data = Data;
                /*if (Data.buffered.length > 0){
                    const bufferedEnd = Data.buffered.end(Data.buffered.length - 1);
                    if (Data.duration > 0){
                        $scope.BufferPercent = ((bufferedEnd / Data.duration)*100);
                        console.log($scope.BufferPercent);
                    }
                }*/
                $scope.safeApply();
            });
            $scope.ProgressVideoBar = angular.element(document.getElementById("player_progress"));
            $scope.ProgressVideoBar.on($scope.ProgressVideoBar.hasOwnProperty('ontouchstart') ? 'touchstart' : 'mousedown', (event) => {
                //$scope.ProgressValue = event.layerX * (100 / scope.ProgressVideoBar.prop('clientWidth'));
                $rootScope.$emit('Set position', percentage.of(event.layerX * (100 / $scope.ProgressVideoBar.prop('clientWidth')), $scope.Data.duration));
                $scope.safeApply();
            });
            $scope.triggerPlayer = function () {
                $rootScope.$emit('Trigger player');
            };
        },
        link: (scope, elem, attrs) => {
            scope.safeApply = function(fn) {
                const phase = this.$root.$$phase;
                if(phase == '$apply' || phase == '$digest') {
                    if(fn && (typeof(fn) === 'function')) {
                        fn();
                    }
                } else {
                    this.$apply(fn);
                }
            };
            scope.socket = attrs.socket;
            scope.onTrackEnd = attrs.onTrackEnd;
            scope.playlistId = attrs.playlistId;
            scope.videoId = attrs.videoId;
            scope.element = elem;
            scope.ProgressValue = 0;
            scope.BufferValue = 0;
        }
    };
});