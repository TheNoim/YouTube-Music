/**
 * Created by nilsbergmann on 04.02.17.
 */
const url = require('url');
const request = require('request');
const log = require('../Logger')(true);
const async = require('async');
const Promise = require("bluebird");
Promise.config({cancellation: true});

module.exports = {
    /**
     *
     * @param Query
     * @param Order
     * @param Only
     * @param $scope
     */
    SearchOnYouTube: function (Query, Order, Only, $scope, socket) {
        log.info(`Query: ${Query} - ${Only}`);
        let Params = {
            part: "snippet",
            key: "AIzaSyAmrU02S7vOBKU2Ep6lpaGP9SW7y3K3KKQ",
            q: Query,
            order: Order?Order:"relevance",
            maxResults: 50
        };
        if (Only) Params.type = Only;
        if (!Only) Params.type = 'video,playlist';
        let SearchURL = url.parse('https://www.googleapis.com/youtube/v3/search');
        SearchURL.query = Params;
        request(url.format(SearchURL), {
            "json": true
        }, (error, response, body) => {
            if (!error && response.statusCode == 200){
                $scope.QueryResults = body.items;
                console.log($scope.QueryResults);
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
                }, () => {
                    $scope.safeApply();
                });
            }
        });
    },

    Query: function (Query, Order, Only, socket) {
        return new Promise((resolve, reject, onCancel) => {
            let cancel = false;
            const RURL = `https://www.googleapis.com/youtube/v3/search?key=AIzaSyAmrU02S7vOBKU2Ep6lpaGP9SW7y3K3KKQ&part=snippet&q=${Query}&order=${Order || 'relevance'}&maxResults=50&type=${Only || 'video,playlist'}`;
            const r = request(RURL, {
                "json": true
            }, (error, response, body) => {
                if (!error && response.statusCode == 200){
                    async.eachOf(body.items, (Value, key, ECallback) => {
                        if (cancel) return ECallback();
                        socket.send('in library ?', Value, (error, result) => {
                            if (error) return ECallback(error);
                            if (result.inLibrary){
                                body.items[key].add_button = "remove_circle";
                            } else {
                                body.items[key].add_button = "add";
                            }
                            body.items[key].checked = true;
                            ECallback();
                        });
                    }, (error) => {
                        if (error){
                            reject(error);
                        } else {
                            resolve(body.items);
                        }
                    });
                } else {
                    reject(error || `HTTP Response: ${response.statusCode}`);
                }
            });
            onCancel(function () {
                cancel = true;
                r.abort();
            });
        });
    }


};