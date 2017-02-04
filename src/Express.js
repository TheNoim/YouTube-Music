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
                    if (doc.downloadFinished){
                        res.sendFile(doc.path);
                    } else {
                        streamFile();
                    }
                }
            });
        }
    });

    httpServer = require('http').createServer(ex);
    httpServer.listen(2458);

    return httpServer;
};

