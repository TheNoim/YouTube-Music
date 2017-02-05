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
        if (data.id){
            if (data.id.kind == "youtube#playlist"){
                let Params = {
                    part: "snippet",
                    key: "AIzaSyAmrU02S7vOBKU2Ep6lpaGP9SW7y3K3KKQ",
                    playlistId: data.id.playlistId
                };
                let FirstURL = url.parse('https://www.googleapis.com/youtube/v3/playlistItems');
                FirstURL.query = Params;
                request(url.format(FirstURL), {
                    json: true
                }, (error, response, body) => {
                    if (!error && response.statusCode == 200) {
                        const pageCount = parseInt(body.pageInfo.totalResults / body.pageInfo.resultsPerPage);
                        if (body.nextPageToken){
                            let next = body.nextPageToken;
                            let videos = [];
                            videos = videos.concat(body.items);
                            async.timesSeries(pageCount, (n, TimeCallback) => {
                                let Params = {
                                    part: "snippet",
                                    key: "AIzaSyAmrU02S7vOBKU2Ep6lpaGP9SW7y3K3KKQ",
                                    playlistId: data.id.playlistId,
                                    pageToken: next
                                };
                                let PlayListRequestURL = url.parse('https://www.googleapis.com/youtube/v3/playlistItems');
                                PlayListRequestURL.query = Params;
                                request(url.format(PlayListRequestURL), {
                                    json: true
                                }, (error, response, xBody) => {
                                    if (!error && response.statusCode == 200) {
                                        if (xBody.nextPageToken){
                                            next = xBody.nextPageToken;
                                        }
                                        videos = videos.concat(xBody.items);
                                        TimeCallback();
                                    } else {
                                        TimeCallback();
                                    }
                                });
                            }, () => {
                                data.items = videos;
                                data._id = data.id.playlistId;
                                data.inLibrary = true;
                                delete data["$$hashKey"];
                                db.insert(data, (error) => {
                                    if (error){
                                        msg.reply({
                                            error: error
                                        });
                                    } else {
                                        msg.reply({});
                                    }
                                    socket.send('update library');
                                });
                            });
                        } else {
                            // Error
                        }
                    } else {
                        // Error
                    }
                });
            } else if (data.id.kind == "youtube#video") {
                log.info(`Add video with id ${data.id.videoId}`);
                data._id = data.id.videoId;
                data.inLibrary = true;
                delete data["$$hashKey"];
                db.insert(data, (error, newDoc) => {
                    if (error) throw error;
                    log.info(`Video added to db. New data: `, newDoc);
                    msg.reply({});
                    socket.send('update library');
                });
            }
        }
    });

    socket.on('message:remove from library', (msg) => {
        const data = msg.data();
        if (data.id){
            let id;
            if (data.id.kind == "youtube#playlist"){
                id = data.id.playlistId;
            } else if (data.id.kind == "youtube#video") {
                id = data.id.videoId;
            }
            log.info(`Remove data with id ${id}`);
            db.remove({_id: id}, {}, (error) => {
                log.info(`Removed data with id ${id}`);
                msg.reply(error);
                socket.send('update library');
            });
        } else {
            // Error
        }
    });

    socket.on('message:get video informations', (msg) => {
        const data = msg.data();
        db.findOne({_id: data.videoId}, (err, doc) => {
            if (doc){
                msg.reply(doc);
            } else {
                request(`https://www.googleapis.com/youtube/v3/videos?key=AIzaSyAmrU02S7vOBKU2Ep6lpaGP9SW7y3K3KKQ&part=snippet&id=${data.videoId}`, {json: true}, (error, response, body) => {
                    if (!error && response.statusCode == 200) {
                        msg.reply(body.items[0]);
                    } else {
                        msg.reply({error: "Can not get video informations"});
                    }
                });
            }
        });
    });

    socket.on('message:get playlist informations', (msg) => {
        const data = msg.data();
        db.findOne({_id: data.playlistId}, (err, doc) => {
            if (doc){
                msg.reply(doc);
            } else {
                let Params = {
                    part: "snippet",
                    key: "AIzaSyAmrU02S7vOBKU2Ep6lpaGP9SW7y3K3KKQ",
                    playlistId: data.playlistId
                };
                let FirstURL = url.parse('https://www.googleapis.com/youtube/v3/playlistItems');
                FirstURL.query = Params;
                request(url.format(FirstURL), {
                    json: true
                }, (error, response, body) => {
                    if (!error && response.statusCode == 200) {
                        const pageCount = parseInt(body.pageInfo.totalResults / body.pageInfo.resultsPerPage);
                        if (body.nextPageToken){
                            let next = body.nextPageToken;
                            let videos = [];
                            videos = videos.concat(body.items);
                            async.timesSeries(pageCount, (n, TimeCallback) => {
                                let Params = {
                                    part: "snippet",
                                    key: "AIzaSyAmrU02S7vOBKU2Ep6lpaGP9SW7y3K3KKQ",
                                    playlistId: data.playlistId,
                                    pageToken: next
                                };
                                let PlayListRequestURL = url.parse('https://www.googleapis.com/youtube/v3/playlistItems');
                                PlayListRequestURL.query = Params;
                                request(url.format(PlayListRequestURL), {
                                    json: true
                                }, (error, response, xBody) => {
                                    if (!error && response.statusCode == 200) {
                                        if (xBody.nextPageToken){
                                            next = xBody.nextPageToken;
                                        }
                                        videos = videos.concat(xBody.items);
                                        TimeCallback();
                                    } else {
                                        TimeCallback();
                                    }
                                });
                            }, () => {
                                data.items = videos;
                                data._id = data.playlistId;
                                msg.reply(data);
                            });
                        } else {
                            // Error
                        }
                    } else {
                        // Error
                    }
                });
            }
        });
    });
};