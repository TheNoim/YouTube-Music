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


const an = angular.module('YouTubePlayer', ['ngMaterial', 'ui.router', 'ui.router.title']);
an.controller('MainController', ($scope, $mdDialog, $mdSidenav, $state) => {
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
    $scope.ShowOnly = "";

    $scope.QueryResults = [];

    $scope.PlayProgress = 0;
    $scope.PlayIcon = "play_circle_outline";

    $scope.$watch('state.current.name', () => {
        $scope.search = ($scope.state.current.name == "library" || $scope.state.current.name == "search-youtube" );
        switch ($scope.state.current.name) {
            case "search-youtube":
                $scope.DoQuery = function () {
                    $scope.textquery = document.getElementById('SearchField').value;
                    Query.SearchOnYouTube($scope.textquery, null, $scope.ShowOnly ? $scope.ShowOnly : null, $scope, socket);
                };
                break;
            default:
                $scope.DoQuery = function () {
                    $scope.QueryResults = [];
                };
                break;
        }
        $scope.safeApply();
    });
});

an.config(function ($stateProvider, $urlRouterProvider, $mdThemingProvider) {
    $mdThemingProvider.theme('YouTube').primaryPalette('red').accentPalette('blue-grey');

    $mdThemingProvider.theme('Inputs').primaryPalette('grey');

    $mdThemingProvider.setDefaultTheme('YouTube');

    $urlRouterProvider.otherwise('/home');

    $stateProvider
        .state('home', {
            url: '/home',
            templateUrl: 'pages/Home.html',
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
            resolve: {
                $title: function () {
                    return "Find Playlist & Tracks on YouTube"
                }
            }
        });
});