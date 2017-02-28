/**
 * Created by nilsbergmann on 04.02.17.
 */
const log = require('../Logger')(true);

module.exports = function (cfg) {
    log.info("Setup renderer socket events");

    // vars
    const $scope = cfg.$scope;
    const socket = cfg.socket;
    const $mdDialog = cfg.$mdDialog;
    const $rootScope = cfg.$rootScope;

    log.info("Setup error event");
    socket.on('event:ERROR', (Payload) => {
        let erroralert = $mdDialog.alert().ok('Close');
        if (typeof Payload == "string") {
            erroralert.title('Error');
            erroralert.textContent(Payload);
            log.error(Payload);
        } else if (typeof Payload == "object") {
            erroralert.title(Payload.title ? Payload.title : "Error");
            erroralert.textContent(Payload.error);
            log.error(Payload.error);
        } else {
            erroralert.title('Error');
            erroralert.textContent(Payload);
            log.error(Payload);
        }
        $mdDialog.show(erroralert);
    });
    log.info("Error event setup finished");

    socket.on('event:Next track', () => {
        $rootScope.$emit('Skip current song');
    });

    socket.on('event:Last track', () => {
        $rootScope.$emit('Last song in pl');
    });

    socket.on('event:PausePlay', () => {
        $rootScope.$emit('Trigger player');
    });

    socket.on('event:Trigger mute', () => {
        $rootScope.$emit('Trigger mute');
    });

    socket.on('event:Add download', (Payload) => {
        let add = {
            videoId: Payload.videoId,
            VideoData: Payload.VideoData,
            ProgressMode: Payload.ProgressMode,
            currentlyDoing: "Waiting"
        };
        if (add.VideoData && add.VideoData.snippet && add.VideoData.snippet.thumbnails){
            if (!add.VideoData.snippet.thumbnails.maxres) {
                if (add.VideoData.snippet.thumbnails.high){
                    add.VideoData.snippet.thumbnails.maxres = add.VideoData.snippet.thumbnails.high;
                } else if (add.VideoData.snippet.thumbnails.medium){
                    add.VideoData.snippet.thumbnails.maxres = add.VideoData.snippet.thumbnails.medium;
                } else {
                    add.VideoData.snippet.thumbnails.maxres = add.VideoData.snippet.thumbnails.default;
                }
            }
        }
        $scope.AllDownloads.push(add);
        $scope.filterDownloaded($scope.AllDownloadedQuery);
        $scope.safeApply();
    });

    socket.on('event:Download update', (Payload) => {
        for (let DownloadIndex in $scope.AllDownloads){
            if ($scope.AllDownloads.hasOwnProperty(DownloadIndex)){
                if ($scope.AllDownloads[DownloadIndex].videoId == Payload.videoId){
                    if (Payload.ProgressMode) {
                        $scope.AllDownloads[DownloadIndex].ProgressMode = Payload.ProgressMode;
                    }
                    if (Payload.state){
                        $scope.AllDownloads[DownloadIndex].state = Payload.state;
                    }
                    if (Payload.currentlyDoing){
                        $scope.AllDownloads[DownloadIndex].currentlyDoing = Payload.currentlyDoing;
                    }
                    break;
                }
            }
        }
        $scope.safeApply();
    });

    socket.on('event:Remove download', (Payload) => {
        for (let DownloadIndex in $scope.AllDownloads) {
            if ($scope.AllDownloads.hasOwnProperty(DownloadIndex)) {
                if ($scope.AllDownloads[DownloadIndex].videoId == Payload.videoId){
                    $scope.AllDownloads.splice(DownloadIndex, 1);
                    break;
                }
            }
        }
        $scope.filterDownloaded($scope.AllDownloadedQuery);
        $scope.safeApply();
    });
};