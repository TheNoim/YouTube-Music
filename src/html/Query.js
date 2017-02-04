/**
 * Created by nilsbergmann on 04.02.17.
 */
const url = require('url');
const request = require('request');
const log = require('../Logger')(true);
const async = require('async');

module.exports = {
    /**
     *
     * @param Query
     * @param Order
     * @param Only
     * @param $scope
     */
    SearchOnYouTube: function (Query, Order, Only, $scope, socket) {
        log.info(`Query: ${Query}`);
        let Params = {
            part: "snippet",
            key: "AIzaSyAmrU02S7vOBKU2Ep6lpaGP9SW7y3K3KKQ",
            q: Query,
            order: Order?Order:"relevance"
        };
        if (Only) Params.type = Only;
        let SearchURL = url.parse('https://www.googleapis.com/youtube/v3/search');
        SearchURL.query = Params;
        request(url.format(SearchURL), {
            "json": true
        }, (error, response, body) => {
            if (!error && response.statusCode == 200){
                $scope.QueryResults = body.items;
                async.each($scope.QueryResults, (CurrentResult, callback) => {
                    socket.send('in library ?', CurrentResult, (error, result) => {
                        if (error) throw error;
                        if (result.inLibrary){
                            CurrentResult.add_button = "remove_circle";
                        } else {
                            CurrentResult.add_button = "add";
                        }
                        CurrentResult.checked = true;
                        callback();
                    });
                }, () => {});

            }
        });
    }  
};