/**
 * Created by nilsbergmann on 05.02.17.
 */
const fs = require('fs-extra');
const {app} = require('electron');
const path = require('path');
const YTLib = require('./YTLib');
const async = require('async');
const {EventEmitter} = require('events');
const request = require('request');
const url = require('url');
const progress = require('request-progress');

function DownloadManager(db, socket) {
    DownloadManager.prototype.this().db = db;
    DownloadManager.prototype.this().socket = socket;
    DownloadManager.prototype.task = async.queue((Payload, QCallback) => {
        if (Payload.kind == "youtube#playlist"){
            DownloadManager.prototype._getPlaylistInformations(Payload.playlistId, (Data) => {
                async.each(Data.items, (Item, ECallback) => {
                    DownloadManager.prototype.task.push(Item.snippet.resourceId);
                    ECallback();
                }, () => {
                    QCallback();
                })
            });
        } else {
            DownloadManager.prototype._isAlreadyDownloading(Payload.videoId, (isDownloading) => {
                if (!isDownloading){
                    DownloadManager.prototype._getVideoInformations(Payload.videoId, (VideoData) => {
                        DownloadManager.prototype.this().socket.send('Add download', {
                            videoId: Payload.videoId,
                            VideoData: VideoData,
                            ProgressMode: "indeterminate"
                        });
                        DownloadManager.prototype._downloadVideo(Payload.videoId, () => {
                            DownloadManager.prototype._downloadThumbnails(Payload.videoId, () => {
                                DownloadManager.prototype.this().socket.send('Remove download', {
                                    videoId: Payload.videoId
                                });
                                QCallback();
                            });
                        });
                    });
                } else {
                    QCallback();
                }
            });
        }
    }, 3);
}


// Helper

DownloadManager.prototype.this = function () {
    return this;
};

/**
 *
 * @param {string} id
 * @param {function} FCallback
 * @private
 */
DownloadManager.prototype._inDB = function (id, FCallback) {
    DownloadManager.prototype.this().db.findOne({_id: id}, (error, doc) => {
        if (error) throw error;
        FCallback(doc != null);
    });
};

/**
 *
 * @param videoId
 * @param FCallback
 * @private
 */
DownloadManager.prototype._isAlreadyDownloading = function (videoId, FCallback) {
    DownloadManager.prototype.this().db.findOne({_id: videoId}, (error, doc) => {
        if (error) throw error;
        if (!doc){
            FCallback(false);
        } else {
            if (doc.VideoDownloading){
                FCallback(true);
            } else if (doc.ThumbnailsDownloading) {
                FCallback(true);
            } else {
                FCallback(false);
            }
        }
    });
};

/**
 *
 * @param videoId
 * @param FCallback
 * @private
 */
DownloadManager.prototype._markAsDownloading = function (videoId, FCallback) {
    DownloadManager.prototype._inDB(videoId, (inDb) => {
        if (inDb) {
            DownloadManager.prototype.this().db.update({_id: videoId}, {$set: {VideoDownloading: true}}, (error) => {
                if (error) throw error;
                FCallback();
            });
        } else {
            DownloadManager.prototype._getVideoInformations(videoId, (Payload) => {
                Payload._id = videoId;
                Payload.VideoDownloading = true;
                DownloadManager.prototype.this().db.insert(Payload, (error) => {
                    if (error) throw error;
                    FCallback();
                });
            });
        }
    });
};

/**
 *
 * @param videoId
 * @param VideoPath
 * @param FCallback
 * @private
 */
DownloadManager.prototype._markAsNotDownloading = function (videoId, VideoPath, FCallback) {
    DownloadManager.prototype._inDB(videoId, (inDb) => {
        if (inDb) {
            let update = {VideoDownloading: false};
            if (VideoPath) {
                update.VideoPath = VideoPath;
            }
            DownloadManager.prototype.this().db.update({_id: videoId}, {$set: update}, (error) => {
                if (error) throw error;
                FCallback();
            });
        } else {
            DownloadManager.prototype._getVideoInformations(videoId, (Payload) => {
                Payload._id = videoId;
                Payload.VideoDownloading = false;
                if (VideoPath) {
                    Payload.VideoPath = VideoPath;
                }
                DownloadManager.prototype.this().db.insert(Payload, (error) => {
                    if (error) throw error;
                    FCallback();
                });
            });
        }
    });
};

/**
 *
 * @param videoId
 * @param FCallback
 * @private
 */
DownloadManager.prototype._markTAsDownloading = function (videoId, FCallback) {
    DownloadManager.prototype._inDB(videoId, (inDb) => {
        if (inDb) {
            DownloadManager.prototype.this().db.update({_id: videoId}, {$set: {ThumbnailsDownloading: true}}, (error) => {
                if (error) throw error;
                FCallback();
            });
        } else {
            DownloadManager.prototype._getVideoInformations(videoId, (Payload) => {
                Payload._id = videoId;
                Payload.ThumbnailsDownloading = true;
                DownloadManager.prototype.this().db.insert(Payload, (error) => {
                    if (error) throw error;
                    FCallback();
                });
            });
        }
    });
};

/**
 *
 * @param videoId
 * @param FCallback
 * @private
 */
DownloadManager.prototype._markTAsNotDownloading = function (videoId, FCallback) {
    DownloadManager.prototype._inDB(videoId, (inDb) => {
        if (inDb) {
            let update = {ThumbnailsDownloading: false};
            DownloadManager.prototype.this().db.update({_id: videoId}, {$set: update}, (error) => {
                if (error) throw error;
                FCallback();
            });
        } else {
            DownloadManager.prototype._getVideoInformations(videoId, (Payload) => {
                Payload._id = videoId;
                Payload.ThumbnailsDownloading = false;
                DownloadManager.prototype.this().db.insert(Payload, (error) => {
                    if (error) throw error;
                    FCallback();
                });
            });
        }
    });
};

/**
 *
 * @param videoId
 * @param {function} FCallback
 * @private
 */
DownloadManager.prototype._downloadVideo = function (videoId, FCallback) {
    DownloadManager.prototype._markAsDownloading(videoId, () => {
        const yt = new YTLib(videoId, 'http://youtube.com/watch?v=' + videoId);
        fs.ensureDir(path.join(app.getPath('userData'), 'temp/' + videoId + '/'), (error) => {
            if (error) throw error;
            let abort = false;
            yt.download(path.join(app.getPath('userData'), 'temp/' + videoId + '/'), videoId, true, (filename) => {
                if (!abort) {
                    DownloadManager.prototype._moveFile(videoId, filename, FCallback);
                } else {
                    fs.remove(path.join(app.getPath('userData'), 'temp/' + videoId + '/'), (error) => {
                        if (error) throw error;
                        DownloadManager.prototype._markAsNotDownloading(videoId, null, () => {
                            FCallback();
                        });
                        DownloadManager.prototype.this().socket.send('Download update', {
                            videoId: videoId,
                            ProgressMode: "determinate",
                            finished: true,
                            currentlyDoing: "Aborted"
                        });
                    });
                }
            });
            yt.on('progress', (state) => {
                DownloadManager.prototype.this().socket.send('Download update', {
                    videoId: videoId,
                    state: state,
                    ProgressMode: "determinate",
                    currentlyDoing: "Downloading"
                });
            });
            if (!DownloadManager.prototype.this()[videoId]) {
                DownloadManager.prototype.this()[videoId] = new EventEmitter();
            }
            DownloadManager.prototype.this()[videoId].once('abort', () => {
                abort = true;
                yt.emit('abort');
            });
        });
    });
};

/**
 *
 * @param {string} videoId
 * @param {function} FCallback
 * @private
 */
DownloadManager.prototype._downloadThumbnails = function (videoId, FCallback) {
    DownloadManager.prototype._markTAsDownloading(videoId, () => {
        DownloadManager.prototype.this().socket.send('Download update', {
            videoId: videoId,
            ProgressMode: "indeterminate",
            currentlyDoing: "Downloading Video Informations"
        });
        DownloadManager.prototype._getVideoInformations(videoId, (Data) => {
            let Thumbnails = [];
            for (let DataIndex in Data.snippet.thumbnails) {
                if (Data.snippet.thumbnails.hasOwnProperty(DataIndex)) {
                    Thumbnails.push({
                        "kind": Data.snippet.thumbnails[DataIndex],
                        "url": Data.snippet.thumbnails[DataIndex].url
                    });
                }
            }
            EachAbort = false;
            async.each(Thumbnails, (Thumbnail, ECallback) => {
                if (EachAbort){
                    ECallback();
                    return;
                }
                DownloadManager.prototype.this().socket.send('Download update', {
                    videoId: videoId,
                    ProgressMode: "determinate",
                    currentlyDoing: "Download thumbnail: " + Thumbnail.kind
                });
                const DestPath = path.join(app.getPath('userData'), 'downloads/' + videoId + '/');
                const ThumbnailURL = url.parse(Thumbnail.kind.url);
                const Extension = path.extname(ThumbnailURL.path);
                console.log(Thumbnail);
                const ThumbnailFileName = path.basename(Thumbnail.kind.url);
                fs.ensureDir(DestPath, () => {
                    const THDownloadRequest = progress(request.get(Thumbnail.url));
                    let abort = false;
                    THDownloadRequest.on('progress', (state) => {
                        DownloadManager.prototype.this().socket.send('Download update', {
                            videoId: videoId,
                            state: state,
                            ProgressMode: "determinate",
                            currentlyDoing: "Download thumbnail: " + Thumbnail.kind
                        });
                    });
                    THDownloadRequest.once('end', () => {
                        if (!abort) {
                            DownloadManager.prototype.this().socket.send('Download update', {
                                videoId: videoId,
                                ProgressMode: "indeterminate",
                                currentlyDoing: "Download of thumbnail " + Thumbnail.kind + " finished"
                            });
                            DownloadManager.prototype._markThumbnailAsDownloaded(videoId, Thumbnail.kind, DestPath, () => {
                                ECallback();
                            });
                        } else {
                            fs.remove(path.join(DestPath, ThumbnailFileName), (error) => {
                                if (error) throw error;
                                DownloadManager.prototype._markThumbnailAsNotDownloaded(videoId, Thumbnail.kind, () => {
                                    ECallback();
                                });
                            });
                        }

                    });
                    if (!DownloadManager.prototype.this()[videoId]) {
                        DownloadManager.prototype.this()[videoId] = new EventEmitter();
                    }
                    DownloadManager.prototype.this()[videoId].once('abort', () => {
                        abort = true;
                        EachAbort = true;
                        THDownloadRequest.abort();
                    });
                    console.log(path.join(DestPath, ThumbnailFileName));
                    THDownloadRequest.pipe(fs.createWriteStream(path.join(DestPath, ThumbnailFileName)));
                });
            }, () => {
                if (EachAbort){
                    async.each(Thumbnails, (Thumbnail, ECallback) => {
                        db.findOne({_id: videoId}, (error, doc) => {
                            if (error) throw error;
                            if (!doc) {
                                ECallback();
                                return;
                            }
                            if (doc.snippet.thumbnails[Thumbnail.kind].Path) {
                                fs.remove(doc.snippet.thumbnails[Thumbnail.kind].Path, (error) => {
                                    if (error) throw error;
                                    DownloadManager.prototype._markThumbnailAsNotDownloaded(videoId, Thumbnail.kind, () => {
                                        ECallback();
                                    });
                                });
                            } else {
                                DownloadManager.prototype._markThumbnailAsNotDownloaded(videoId, Thumbnail.kind, () => {
                                    ECallback();
                                });
                            }
                        });
                    }, () => {
                        DownloadManager.prototype._markTAsNotDownloading(videoId, () => {
                            FCallback();
                        });
                    });
                } else {
                    DownloadManager.prototype._markTAsNotDownloading(videoId, () => {
                        FCallback();
                    });
                }
            });
        });
    });
};

/**
 *
 * @param videoId
 * @param kind
 * @param path
 * @param FCallback
 * @private
 */
DownloadManager.prototype._markThumbnailAsDownloaded = function (videoId, kind, path, FCallback) {
    DownloadManager.prototype._inDB(videoId, (inDB) => {
        if (inDB) {
            let update = {snippet: {thumbnails: {}}};
            update.snippet.thumbnails[kind] = {};
            update.snippet.thumbnails[kind].Downloaded = true;
            update.snippet.thumbnails[kind].Path = path;
            DownloadManager.prototype.this().db.update({_id: videoId},{$set:  update}, (error) => {
                if (error) throw error;
                FCallback();
            });
        } else {
            DownloadManager.prototype._getVideoInformations(videoId, (Payload) => {
                Payload._id = videoId;
                if (Payload.snippet){
                    if (Payload.snippet.thumbnails){
                        if (!Payload.snippet.thumbnails[kind]){
                            Payload.snippet.thumbnails[kind] = {};
                            Payload.snippet.thumbnails[kind].Downloaded = true;
                            Payload.snippet.thumbnails[kind].Path = path;
                        }
                    }
                }
                DownloadManager.prototype.this().db.insert(Payload, (error) => {
                    if (error) throw error;
                    FCallback();
                });
            });
        }
    });
};

/**
 *
 * @param videoId
 * @param kind
 * @param FCallback
 * @private
 */
DownloadManager.prototype._markThumbnailAsNotDownloaded = function (videoId, kind, FCallback) {
    DownloadManager.prototype._inDB(videoId, (inDB) => {
        if (inDB) {
            let update = {snippet: {thumbnails: {}}};
            update.snippet.thumbnails[kind].Downloaded = false;
            update.snippet.thumbnails[kind].Path = null;
            DownloadManager.prototype.this().db.update({_id: videoId}, {$set: update}, (error) => {
                if (error) throw error;
                FCallback();
            });
        } else {
            DownloadManager.prototype._getVideoInformations(videoId, (Payload) => {
                Payload._id = videoId;
                if (Payload.snippet){
                    if (Payload.snippet.thumbnails){
                        if (!Payload.snippet.thumbnails[kind]){
                            Payload.snippet.thumbnails[kind] = {};
                            Payload.snippet.thumbnails[kind].Downloaded = false;
                            Payload.snippet.thumbnails[kind].Path = null;
                        }
                    }
                }
                DownloadManager.prototype.this().db.insert(Payload, (error) => {
                    if (error) throw error;
                    FCallback();
                });
            });
        }
    });
};

/**
 *
 * @param videoId
 * @param FCallback
 * @private
 */
DownloadManager.prototype._getVideoInformations = function (videoId, FCallback) {
    request(`https://www.googleapis.com/youtube/v3/videos?key=AIzaSyAmrU02S7vOBKU2Ep6lpaGP9SW7y3K3KKQ&part=snippet&id=${videoId}`, {json: true}, (error, response, body) => {
        if (!error && response.statusCode == 200) {
            FCallback(body.items[0]);
        } else {
            throw error;
        }
    });
};

/**
 *
 * @param playlistId
 * @param FCallback
 * @private
 */
DownloadManager.prototype._getPlaylistInformations = function (playlistId, FCallback) {
    request(`https://www.googleapis.com/youtube/v3/playlistItems?key=AIzaSyAmrU02S7vOBKU2Ep6lpaGP9SW7y3K3KKQ&part=snippet&playlistId=${playlistId}`, {json: true}, (error, response, body) => {
        if (!error && response.statusCode == 200) {
            FCallback(body);
        } else {
            throw error;
        }
    });
};

/**
 *
 * @param videoId
 * @param filename
 * @param FCallback
 * @private
 */
DownloadManager.prototype._moveFile = function (videoId, filename, FCallback) {
    DownloadManager.prototype.this().socket.send('Download update', {
        videoId: videoId,
        ProgressMode: "indeterminate",
        currentlyDoing: "Moving file"
    });
    fs.ensureDir(path.join(app.getPath('userData'), 'downloads/' + videoId + '/'), (error) => {
        if (error) throw error;
        fs.move(path.join(path.join(app.getPath('userData'), 'temp/' + videoId + '/'), filename), path.join(path.join(app.getPath('userData'), 'downloads/' + videoId + '/'), filename), {overwrite: true}, (error) => {
            if (error) throw error;
            DownloadManager.prototype._markAsNotDownloading(videoId, path.join(path.join(app.getPath('userData'), 'downloads/' + videoId + '/'), filename), () => {
                FCallback();
            });
        });
    });
};

module.exports = DownloadManager;