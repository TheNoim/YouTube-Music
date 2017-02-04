/**
 * Created by nilsbergmann on 03.02.17.
 */
const log = require('./Logger')();
const request = require('request');
const async = require('async');
const url = require('url');

module.exports = function (cfg) {
    log.info("Setup main process socket events");

    // Create vars
    const socket = cfg.socket;
    const window = cfg.mainWindow;
    const db = cfg.db;

    socket.on('message:in library ?', (msg) => {
        const data = msg.data();
        if (data.id){
            if (data.id.kind == "youtube#playlist"){
                db.findOne({
                    _id: data.id.playlistId
                }, (err, playlist) => {
                    if (err) throw err;
                    if (playlist){
                        msg.reply({
                            inLibrary: true,
                            result: playlist
                        });
                    } else {
                        msg.reply({
                            inLibrary: false
                        });
                    }
                });
            } else if (data.id.kind == "youtube#video"){
                db.findOne({
                    _id: data.id.videoId
                }, (err, video) => {
                    if (err) throw err;
                    if (video){
                        msg.reply({
                            inLibrary: true,
                            result: video
                        });
                    } else {
                        msg.reply({
                            inLibrary: false
                        });
                    }
                });
            }
        } else {
            msg.reply({
                error: "No id tag in data"
            });
        }

    });

    socket.on('message:add to library', (msg) => {
        const data = msg.data();
        let id;
        if (data.id){
            if (data.id.kind == "youtube#playlist"){
                const pageCount = parseInt(data.pageInfo.totalResults / data.pageInfo.resultsPerPage);
                if (data.nextPageToken){
                    let next = data.nextPageToken;
                    let videos = [];
                    videos.concat(data.items);
                    async.timesSeries(pageCount, (TimeCallback) => {
                        let Params = {
                            part: "snippet",
                            key: "AIzaSyAmrU02S7vOBKU2Ep6lpaGP9SW7y3K3KKQ",
                            playlistId: data.id.playlistId,
                            pageToken: next
                        };
                        if (Only) Params.type = Only;
                        let PlayListRequestURL = url.parse('https://www.googleapis.com/youtube/v3/playlistItems');
                        PlayListRequestURL.query = Params;
                        request(url.format(PlayListRequestURL), {
                            json: true
                        }, (error, response, body) => {
                            if (!error && response.statusCode == 200) {
                                if (body.nextPageToken){
                                    next = body.nextPageToken;
                                }
                                videos.concat(body.items);
                                TimeCallback();
                            } else {
                                TimeCallback();
                            }
                        });
                    }, () => {
                        data.items = videos;
                        data._id = data.id.playlistId;
                        db.insert(data, (error) => {
                            if (error){
                                msg.reply({
                                    error: error
                                });
                            } else {
                                msg.reply({});
                            }
                        });
                    });
                } else {

                }

            } else if (data.id.kind == "youtube#video") {
                data._id = data.id.videoId;
                db.insert(data, () => {

                });
            }
        }
    });

};