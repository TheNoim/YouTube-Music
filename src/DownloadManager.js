/**
 * Created by nilsbergmann on 05.02.17.
 */
const fs = require('fs-extra');
const {app} = require('electron');
const path = require('path');
const YTLib = require('./YTLib');

module.exports = {
    downloadVideo: function (videoId, socket, db, callback) {
        fs.ensureDir(path.join(app.getPath('userData'), 'temp/' + videoId + '/'), () => {
            const downloader = new YTLib(videoId, 'https://youtube.com/watch?v=' + videoId);
            downloader.download(path.join(app.getPath('userData'), 'temp/' + videoId + '/'), videoId, true, (filename) => {
                socket.send('Download finished', {videoId: videoId});
                fs.ensureDir(path.join(app.getPath('userData'), 'downloads/' + videoId + '/' + filename), () => {
                    fs.move(path.join(app.getPath('userData'), 'temp/' + videoId + '/' + filename), path.join(app.getPath('userData'), 'downloads/' + videoId + '/' + filename), {overwrite: true}, () => {
                        db.findOne({_id:videoId}, (error, doc) => {
                            if (doc){
                                db.update({_id:videoId}, {downloadFinished: true, path: path.join(app.getPath('userData'), 'downloads/' + videoId + '/' + filename)}, () => {
                                    socket.send('Download saved', {videoId: videoId});
                                    callback();
                                });
                            } else {
                                request(`https://www.googleapis.com/youtube/v3/videos?key=AIzaSyAmrU02S7vOBKU2Ep6lpaGP9SW7y3K3KKQ&part=snippet&id=${videoId}`, {json: true}, (error, response, body) => {
                                    if (!error && response.statusCode == 200) {
                                        let ins = body.items[0];
                                        ins._id = videoId;
                                        ins.downloadFinished = true;
                                        ins.path = path.join(app.getPath('userData'), 'downloads/' + videoId + '/' + filename);
                                        db.insert(ins, () => {
                                            socket.send('Download saved', {videoId: videoId});
                                            callback();
                                        });
                                    }
                                });
                            }
                        });
                    });
                });
            }).on('progress', (state) => {
                socket.send('Download progress', {videoId: videoId, state: state});
            });
        });
    }
};