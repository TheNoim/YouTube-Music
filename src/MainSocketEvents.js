/**
 * Created by nilsbergmann on 03.02.17.
 */
const log = require('./Logger')();
const request = require('request');
const async = require('async');
const url = require('url');
const fs = require('fs-extra');
const DL = require('./DownloadManager');
const path = require('path');
const {app} = require('electron');

let downloadTaskList = {};

module.exports = function (cfg) {
    log.info("Setup main process socket events");

    // Create vars
    const socket = cfg.socket;
    const window = cfg.mainWindow;
    const db = cfg.db;
    const DownloadManager = new DL(db, socket);

    socket.on('message:in library ?', (msg) => {
        const data = msg.data();
        if (data.id) {
            if (data.id.kind == "youtube#playlist") {
                db.findOne({
                    _id: data.id.playlistId
                }, (err, playlist) => {
                    if (err) throw err;
                    if (playlist && playlist.inLibrary) {
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
            } else if (data.id.kind == "youtube#video") {
                db.findOne({
                    _id: data.id.videoId
                }, (err, video) => {
                    if (err) throw err;
                    if (video && video.inLibrary) {
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
        if (data.id) {
            if (data.id.kind == "youtube#playlist") {
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
                        if (body.nextPageToken) {
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
                                        if (xBody.nextPageToken) {
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
                                    if (error) {
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
                db.findOne({
                    _id: data.id.videoId
                }, (error, doc) => {
                    if (doc) {
                        db.update({_id: data.id.videoId}, {$set: {inLibrary: true}}, (error, newDoc) => {
                            log.info(`Video added to db. New data: `, newDoc);
                            msg.reply({});
                            socket.send('update library');
                        });
                    } else {
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
                });
            }
        }
    });

    socket.on('message:remove from library', (msg) => {
        const data = msg.data();
        if (data.id) {
            let id;
            if (data.id.kind == "youtube#playlist") {
                id = data.id.playlistId;
            } else if (data.id.kind == "youtube#video") {
                id = data.id.videoId;
            }
            const remove = function () {
                log.info(`Remove data with id ${id}`);
                db.remove({_id: id}, {}, (error) => {
                    log.info(`Removed data with id ${id}`);
                    msg.reply(error);
                    socket.send('update library');
                });
            };
            db.findOne({_id: id}, (error, doc) => {
                if (doc) {
                    if (data.id.kind == "youtube#video") {
                        if (doc.VideoDownloaded) {
                            const DownloadPath = path.join(app.getPath('userData'), 'downloads/' + data.id.videoId + '/');
                            fs.access(DownloadPath, fs.constants.W_OK, (err) => {
                                if (!err) {
                                    fs.remove(DownloadPath, (err) => {
                                        remove();
                                    });
                                } else {
                                    remove();
                                }
                            });
                        } else {
                            remove();
                        }
                    } else {
                        async.eachSeries(data.items, (Video, EachCallback) => {
                            db.findOne({_id: Video.snippet.resourceId.videoId}, (error, vResult) => {
                                if (vResult) {
                                    if (vResult.VideoDownloaded) {
                                        const DownloadPath = path.join(app.getPath('userData'), 'downloads/' + vResult.id.videoId + '/');
                                        fs.access(DownloadPath, fs.constants.W_OK, (err) => {
                                            if (!err) {
                                                fs.remove(DownloadPath, (err) => {
                                                    EachCallback();
                                                });
                                            } else {
                                                EachCallback();
                                            }
                                        });
                                    } else {
                                        EachCallback();
                                    }
                                } else {
                                    EachCallback();
                                }
                            });
                        }, () => {
                            remove();
                        });
                    }
                } else {
                    msg.reply();
                }
            });
        } else {
            // Error
            msg.reply();
        }
    });

    socket.on('message:get video informations', (msg) => {
        const data = msg.data();
        db.findOne({_id: data.videoId}, (err, doc) => {
            if (doc) {
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
            if (doc) {
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
                        if (body.nextPageToken) {
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
                                        if (xBody.nextPageToken) {
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

    socket.on('message:get all playlists', (msg) => {
        db.find({inLibrary: true}, (error, docs) => {
            if (error) throw error;
            if (!error) {
                if (docs) {
                    let returnResults = [];
                    for (let Index in docs) {
                        if (docs.hasOwnProperty(Index)) {
                            if (docs[Index].id) {
                                if (docs[Index].id.kind == "youtube#playlist") {
                                    returnResults.push(docs[Index])
                                }
                            }
                        }
                    }
                    msg.reply(returnResults);
                } else {
                    msg.reply([]);
                }
            }
        });
    });

    socket.on('message:get all songs', (msg) => {
        db.find({inLibrary: true}, (error, docs) => {
            if (error) throw error;
            if (!error) {
                if (docs) {
                    let returnResults = [];
                    for (let Index in docs) {
                        if (docs.hasOwnProperty(Index)) {
                            if (docs[Index].id) {
                                if (docs[Index].id.kind == "youtube#video") {
                                    returnResults.push(docs[Index])
                                }
                            }
                        }
                    }
                    msg.reply(returnResults);
                } else {
                    msg.reply([]);
                }
            }
        });
    });

    socket.on('event:Start download of', (msg) => {
        log.info(`Start download`, msg);
        let add = {
            kind: msg.kind
        };
        if (msg.videoId) {
            add.videoId = msg.videoId;
        }
        if (msg.playlistId) {
            add.playlistId = msg.playlistId;
        }
        log.info(msg);
        DownloadManager.this().task.push(add);
    });

    socket.on('message:get all downloaded songs', (msg) => {
        db.find({VideoDownloaded: true}, (error, Docs) => {
            if (error) throw error;
            msg.reply(Docs);
        });
    });

    socket.on('message:re-download with id', (msg) => {
        if (msg.data().kind && msg.data().kind == "youtube#video") {
            async.waterfall([
                (WCallback) => {
                    RemoveOnlyDownload(msg.data().videoId, WCallback)
                },
                (WCallback) => {
                    DownloadManager.this().task.push({
                        kind: "youtube#video",
                        videoId: msg.data().videoId
                    });
                    WCallback();
                }
            ], (error) => {
                msg.reply(error);
            })
        } else if (msg.data().kind && msg.data().kind == "youtube#playlist") {
            // Todo: Need to add playlist
        } else {
            msg.reply();
        }
    });

    socket.on('message:remove download', (msg) => {
        RemoveOnlyDownload(msg.data().videoId, () =>{
            msg.reply();
        })
    });

    function RemoveOnlyDownload(videoId, FCallback) {
        async.waterfall([
            (WCallback) => {
                log.info(videoId);
                db.findOne({_id: videoId}, (error, Doc) => {
                    if (!error && Doc) {
                        WCallback(null, Doc);
                    } else {
                        WCallback(error || "Nothing found");
                    }
                });
            },
            (Video, WCallback) => {
                if (Video.VideoPath) {
                    fs.access(Video.VideoPath, fs.constants.R_OK | fs.constants.W_OK, (error) => {
                        if (!error) {
                            fs.remove(Video.VideoPath, (error) => {
                                WCallback(error, Video);
                            });
                        } else {
                            WCallback(null, Video);
                        }
                    });
                } else {
                    WCallback(null, Video);
                }
            },
            (Video, WCallback) => {
                if (Video.snippet && Video.snippet.thumbnails) {
                    let Keys = [];
                    async.eachOf(Video.snippet.thumbnails, (Value, Key, ECallback) => {
                        Keys.push(Key);
                        if (Value.Path) {
                            fs.access(Value.Path, fs.constants.R_OK | fs.constants.W_OK, (error) => {
                                if (!error) {
                                    fs.remove(Value.Path, ECallback);
                                } else {
                                    ECallback();
                                }
                            });
                        } else {
                            ECallback();
                        }
                    }, (error) => {
                        WCallback(error, Video, Keys);
                    });
                } else {
                    WCallback(null, Video);
                }
            },
            (Video, ThumbnailKeys, WCallback) => {
                let update = {
                    VideoPath: null,
                    VideoDownloaded: false
                };
                for (let TIndex in ThumbnailKeys) {
                    if (ThumbnailKeys.hasOwnProperty(TIndex)) {
                        update[`snippet.thumbnails.${ThumbnailKeys[TIndex]}.Downloaded`] = null;
                        update[`snippet.thumbnails.${ThumbnailKeys[TIndex]}.Path`] = null;
                    }
                }
                db.update({_id: videoId}, {$set: update}, {}, (error) => {
                    WCallback(error);
                });
            }
        ], (error) => {
            FCallback(error);
        });
    }
};