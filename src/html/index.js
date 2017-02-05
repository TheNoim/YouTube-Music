/**
 * Created by nilsbergmann on 03.02.17.
 */
const SocketEvents = require('./HTMLSocketEvents');
const {ipcRenderer} = require('electron');
const app = require('electron').remote.app;
const {Socket} = require('electron-ipc-socket');
const log = require('../Logger')(true);
const YTLib = require('../YTLib');
const getYouTubeID = require('get-youtube-id');
const path = require('path');
const Query = require('./Query');
const percentage = require('percentage-calc');


const an = angular.module('YouTubePlayer', ['ngMaterial', 'ui.router', 'ui.router.title']);
an.controller('MainController', ($scope, $mdDialog, $mdSidenav, $state, $rootScope) => {
    $scope.safeApply = function (fn) {
        const phase = this.$root.$$phase;
        if (phase == '$apply' || phase == '$digest') {
            if (fn && (typeof(fn) === 'function')) {
                fn();
            }
        } else {
            this.$apply(fn);
        }
    };

    log.info("Loading MainController");
    const socket = Socket('main', ipcRenderer);
    socket.open();
    SocketEvents({$scope: $scope, socket: socket, $mdDialog: $mdDialog});

    $scope.toggleSideNav = function () {
        $mdSidenav('SideNav').toggle();
    };

    $scope.state = $state;

    $rootScope.$on('showonly', (ev, showonly) => {
        $scope.showonly = showonly;
        $scope.DoQuery(document.getElementById('SearchField').value);
    });

    $scope.VideoPlayer = document.getElementById('HTMLVideoPlayer');

    $scope.VideoPlayer.onplay = () => {
        $rootScope.$emit('VideoPlayerIsNowPlaying');
    };
    $scope.CurrentVideoId = "";
    $scope.CurrentVideoSrc = "";
    $scope.CurrentVideoInfo = null;

    setInterval(function () {
        if ($scope.VideoPlayer.duration){
            $scope.PrettyDuration = extround($scope.VideoPlayer.duration / 60, 100).toString().replace('.', ':');
        } else {
            $scope.PrettyDuration = "0:00"
        }
        $rootScope.$emit('UpdatePlayerData', {
            currentTime: $scope.VideoPlayer.currentTime,
            playing: ($scope.VideoPlayer.paused == false),
            buffered: $scope.VideoPlayer.buffered,
            duration: $scope.VideoPlayer.duration,
            ended: $scope.VideoPlayer.ended,
            volume: $scope.VideoPlayer.volume,
            CurrentVideoId: $scope.CurrentVideoId,
            CurrentVideoSrc: $scope.CurrentVideoSrc,
            CurrentVideoInfo: $scope.CurrentVideoInfo,
            PrettyDuration: $scope.PrettyDuration,
            percent: percentage.from($scope.VideoPlayer.currentTime, $scope.VideoPlayer.duration),
            BufferPercent: $scope.CurrentBuffered
        });
    }, 100);

    $scope.VideoPlayer.onloadstart = () => {
        socket.send('get video informations', {videoId: $scope.CurrentVideoId} ,(error, data) => {
            if (data.error) throw data.error;
            if (!data.error) $scope.CurrentVideoInfo = data;
        });
    };

    $scope.VideoPlayer.addEventListener('progress', function () {
        const bufferedEnd = $scope.VideoPlayer.buffered.end($scope.VideoPlayer.buffered.length - 1);
        const duration =  $scope.VideoPlayer.duration;
        if (duration > 0) {
            $scope.CurrentBuffered =  ((bufferedEnd / duration)*100);
        }
    });

    $rootScope.$on('Set position', (ev, position) => {
        $scope.VideoPlayer.currentTime = position;
    });

    $rootScope.$on('Play', (ev, videoid) => {
        $scope.CurrentVideoSrc = "http://localhost:2458/" + videoid;
        $scope.CurrentVideoId = videoid;
        $scope.CurrentTime = $scope.VideoPlayer.currentTime;
        $scope.VideoPlayer.load();
        $scope.VideoPlayer.play();
    });

    $rootScope.$on('Trigger player', () => {
        if ($scope.VideoPlayer.paused){
            $scope.VideoPlayer.play();
        } else {
            $scope.VideoPlayer.pause();
        }
    });

    $scope.PlayTest = function () {
        $rootScope.$emit('Play', '9YvQHlcTM24');
    };

    $scope.QueryResults = [];

    $scope.PlayProgress = 0;
    $scope.PlayIcon = "play_circle_outline";

    $scope.socket = socket;

    $scope.UpdateShowOnly = function (ShowOnly) {
        $scope.ShowOnly = ShowOnly;
        $scope.safeApply();
    };


    $scope.$watch('state.current.name', () => {
        $scope.search = ($scope.state.current.name == "library" || $scope.state.current.name == "search-youtube" );
        switch ($scope.state.current.name) {
            case "search-youtube":
                $scope.DoQuery = function (textquery) {
                    Query.SearchOnYouTube(textquery, null, $scope.showonly, $scope, socket);
                    $scope.safeApply();
                };
                break;
            case "player":
                setTimeout(() => {
                    $scope.pla = "PLwUHjHYlA7ucdqxZM5Uyr6NZn7mzhTf4r";
                    $scope.safeApply();
                }, 1000);
                break;
            default:
                $scope.DoQuery = function () {
                    $scope.QueryResults = [];
                };
                break;
        }
        $scope.safeApply();
    });

    $scope.AddOrRemove = function (Data, index) {
        if ($scope.QueryResults[index].add_button == "add") {
            $scope.QueryResults[index].checked = false;
            $scope.safeApply();
            log.info(Data);
            socket.send('add to library', Data, (error) => {
                if (error) throw error;
                if (!error) {
                    $scope.QueryResults[index].add_button = "remove_circle";
                    $scope.QueryResults[index].checked = true;
                    $scope.safeApply();
                }
            });
        } else {
            $scope.QueryResults[index].checked = false;
            $scope.safeApply();
            socket.send('remove from library', Data, (error) => {
                if (error) throw error;
                if (!error) {
                    $scope.QueryResults[index].add_button = "add";
                    $scope.QueryResults[index].checked = true;
                    $scope.safeApply();
                }
            });
        }
    };

});

an.config(function ($stateProvider, $urlRouterProvider, $mdThemingProvider) {
    $mdThemingProvider.theme('YouTube').primaryPalette('red').accentPalette('blue-grey');

    $mdThemingProvider.theme('Inputs').primaryPalette('grey');

    $mdThemingProvider.setDefaultTheme('YouTube');

    $urlRouterProvider.otherwise('/home');

    $stateProvider
        .state('home', {
            url: '/home',
            resolve: {
                $title: function () {
                    return "Home";
                }
            }
        })
        .state('library', {
            url: '/library',
            templateUrl: 'pages/Library.html',
            resolve: {
                $title: function () {
                    return "My Library"
                }
            }
        })
        .state('search-youtube', {
            url: '/search/youtube',
            templateUrl: 'pages/Search-YouTube.html',
            controller: function ($scope, $rootScope, $mdDialog) {
                $scope.$watch('showonly', () => {
                    $rootScope.$emit('showonly', $scope.showonly);
                });
                $scope.showonly = "";
                $scope.showDetails = function (index) {
                    $scope.Details = {};
                    $scope.Details.title = $scope.QueryResults[index].snippet.title;
                    $scope.Details.description = $scope.QueryResults[index].snippet.description;
                    $scope.Details.thumbnail = $scope.QueryResults[index].snippet.thumbnails.high.url;
                    $scope.Details.kind = JSON.parse(JSON.stringify($scope.QueryResults[index].id.kind.toString()));
                    console.log($scope.Details.kind);
                    if ($scope.QueryResults[index].id.videoId) JSON.parse(JSON.stringify($scope.Details.videoId = $scope.QueryResults[index].id.videoId.toString()));
                    $mdDialog.show({
                        templateUrl: 'dialogs/ShowDetails.html',
                        clickOutsideToClose: true,
                        escapeToClose: true,
                        scope: $scope,
                        preserveScope: true,
                        fullscreen: true,
                        controller: ($scope) => {
                            $scope.safeApply();
                            console.log(`DD: ${$scope.Details.kind}`)
                        }
                    });
                };

                $scope.play = function (index) {
                    $rootScope.$emit('Play', $scope.QueryResults[index].id.videoId);
                }
            },
            resolve: {
                $title: function () {
                    return "Find Playlist & Tracks on YouTube"
                }
            }
        })
        .state('player', {
            url: '/player',
            templateUrl: 'pages/Player.html',
            resolve: {
                $title: function () {
                    return "Player"
                }
            }
        });
});

function extround(zahl,n_stelle) {
    zahl = (Math.round(zahl * n_stelle) / n_stelle);
    return zahl;
}