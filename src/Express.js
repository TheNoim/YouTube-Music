/**
 * Created by nilsbergmann on 04.02.17.
 */

module.exports = function (db) {
    const express = require('express');
    const {app} = require('electron');
    const YTLib = require('./YTLib');
    const getYouTubeID = require('get-youtube-id');
    const ex = express();
    const endMw = require('express-end');
    const log = require('./Logger')();
    const fs = require('fs');
    const request = require('request');
    const YTLib2 = require('./YouTubeLibrary');

    ex.use(endMw);

    ex.get('/:videoid', (req, res) => {
        if (req.params.videoid) {
            db.findOne({_id: req.params.videoid},  (error, doc) => {
                if (error) throw error;
                function streamFile() {
                    log.info(`${req.params.videoid} isn't downloaded or has not finished. Start streaming.`);
                    let headers = {};
                    if (req.get("Range")) {
                        headers["Range"] = req.get("Range");
                    }
                    const downloader = new YTLib(req.params.videoid, 'https://www.youtube.com/watch?v=' + req.params.videoid);
                    downloader.download(app.getPath('userData'), req.params.videoid, false, () => {
                        log.info(`Video ${req.params.videoid} request finished.`);
                    }, res, headers);
                    res.once('close', () => {
                        downloader.emit('abort');
                        log.warn(`Abort of request ${req.params.videoid}`);
                    });
                }
                if (doc == null) {
                    streamFile();
                } else {
                    if (doc.VideoPath && doc.VideoDownloaded){
                        fs.access(doc.VideoPath, fs.constants.R_OK ,(err) => {
                            if (!err){
                                log.info(`${req.params.videoid} is downloaded. Load it. ${doc.VideoPath}`);
                                res.sendFile(doc.VideoPath);
                            } else {
                                streamFile();
                            }
                        });
                    } else {
                        streamFile();
                    }
                }
            });
        }
    });

    const apiKey = "AIzaSyAmrU02S7vOBKU2Ep6lpaGP9SW7y3K3KKQ";

    const ytlib2 = new YTLib2(apiKey);

    ex.get('/t/:videoid', (req, res) => {
        if (req.params.videoid) {
            db.findOne({_id: req.params.videoid},  (error, doc) => {
                if (error) throw error;
                function stream(url) {
                    request(url)
                        .on('response', function(response) {
                            res.set('content-type', response.headers['content-type']);
                        })
                        .pipe(res);
                }
                if (doc == null) {
                    // YT URL
                    ytlib2.getVideoInformation(req.params.videoid).then(videoInfo => {
                        console.log(JSON.stringify(videoInfo));
                        if (!videoInfo.snippet.thumbnails.maxres){
                            if (videoInfo.snippet.thumbnails.high){
                                videoInfo.snippet.thumbnails.maxres = videoInfo.snippet.thumbnails.high;
                            } else if (videoInfo.snippet.thumbnails.medium) {
                                videoInfo.snippet.thumbnails.maxres = videoInfo.snippet.thumbnails.medium;
                            } else {
                                videoInfo.snippet.thumbnails.maxres = videoInfo.snippet.thumbnails.default;
                            }
                        }
                        stream(videoInfo.snippet.thumbnails.maxres.url)
                    });
                } else {
                    if (!doc.snippet.thumbnails.maxres){
                        if (doc.snippet.thumbnails.high){
                            doc.snippet.thumbnails.maxres = doc.snippet.thumbnails.high;
                        } else if (doc.snippet.thumbnails.medium) {
                            doc.snippet.thumbnails.maxres = doc.snippet.thumbnails.medium;
                        } else {
                            doc.snippet.thumbnails.maxres = doc.snippet.thumbnails.default;
                        }
                    }
                    if (doc && doc.snippet && doc.snippet.thumbnails && doc.snippet.thumbnails.maxres){
                        if (doc.snippet.thumbnails.maxres.Path){
                            res.sendFile(doc.snippet.thumbnails.maxres.Path);
                        } else {
                            stream(doc.snippet.thumbnails.maxres.url);
                        }
                    }
                }
            });
        }
    });

    httpServer = require('http').createServer(ex);
    httpServer.listen(2458);

    return httpServer;
};

