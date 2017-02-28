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
        controller: ($scope, $element, $attrs, $rootScope, $mdDialog) => {
            const percentage = require('percentage-calc');
            $scope.playlistId = $attrs.playlistId;
            $scope.$watch('playlistId', () => {
                log.info("Set current playlist to " + $scope.playlistId);
            });
            $scope.$watch('volume', () => {
                $rootScope.$emit('set volume', $scope.volume);
            });

            $scope.ContentStyle = "height: 100%";
            $rootScope.$on('ApplyColors', (ev, PlayerToolbar, PlayerButtonColors, ContentStyle) => {
                $scope.PlayerButtonColors = PlayerButtonColors;
                $scope.PlayerToolbar = PlayerToolbar;
                $scope.ContentStyle = ContentStyle;
                $scope.safeApply();
            });
            $rootScope.$on('UpdatePlayerData', (ev, Data) => {
                $scope.Data = Data;
                $scope.volume = Data.volume;
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

            $scope.triggerMute = function () {
                $rootScope.$emit('Trigger mute');
            };

            $scope.back = function () {
                $rootScope.$emit('Last song in pl');
            };

            $scope.skip = function () {
                $rootScope.$emit('Skip current song');
            };

            $scope.GoToInPl = function () {
                $mdDialog.show({
                    fullscreen: true,
                    scope: $scope,
                    preserveScope: true,
                    controller: function ($scope, $mdDialog, $rootScope) {
                        $scope.cancel = function () {
                            $mdDialog.hide();
                        };
                        $scope.play = function (index) {
                            $rootScope.$emit('Play', $scope.Data.CurrentPL.items[index].snippet.resourceId.videoId, $scope.Data.CurrentPL.items[index].snippet.position);
                            $mdDialog.hide();
                        };
                    },
                    templateUrl: 'dialogs/GoToDialog.html'
                });
            };

            $rootScope.$on('!block buttons because loading', () => {
                $scope.loadingPL = false;
                $scope.safeApply();
            });
            $rootScope.$on('block buttons because loading', () => {
                $scope.loadingPL = true;
                $scope.safeApply();
            });
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