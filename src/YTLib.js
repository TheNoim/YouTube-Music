/**
 * Created by nilsbergmann on 04.02.17.
 */
"use strict";
const ytdl = require('ytdl-core');
const {EventEmitter} = require('events');
const request = require('request');
const progress = require('request-progress');
const path = require('path');
const fs = require('fs');

function YTLib(video_id, link) {
    YTLib.prototype.self().video_id = video_id;
    YTLib.prototype.self().link = link;
}

YTLib.prototype = new EventEmitter();

YTLib.prototype.self = function () {
    return this;
};

YTLib.prototype.extractBestAudioFormat = function (callback) {
    const self = YTLib.prototype.self();
    this.info((error, Payload) => {
        if (!error) {
            self.Info = Payload;
            self.emit('info');
            self.possibleFormats = [];
            for (let Index in Payload.formats) {
                if (!Payload.formats.hasOwnProperty(Index)) continue;
                const format = Payload.formats[Index];
                if (format.audioEncoding && format.audioBitrate && format.url) {
                    self.possibleFormats.push(format);
                }
            }
            self.possibleFormats.sort(function (a, b) {
                return a['audioBitrate'] < b['audioBitrate'];
            });
            if (callback) callback();
        } else {
            throw error;
        }
    });
};

YTLib.prototype.download = function (downloadlocation, filename, save, callback, pipeto, headers) {
    const self = YTLib.prototype.self();
    this.extractBestAudioFormat(() => {
        if (self.possibleFormats.length > 0) {
            let loc = "";
            if (downloadlocation) {
                loc = downloadlocation;
            } else {
                loc = "./";
            }
            let ending = "";
            if (self.possibleFormats[0].container) {
                ending = "." + self.possibleFormats[0].container;
            } else {
                ending = ".unknown";
            }
            if (!filename) {
                filename = "download" + ending;
            } else {
                filename += ending;
            }
            const savepath = path.join(loc, filename);
            const p = progress(request(self.possibleFormats[0].url, {
                encoding: null,
                headers: headers?headers:{}
            })).on('progress', (state) => {
                self.emit('progress', state);
            }).on('error', (error) => {
                self.emit('error', error);
            }).on('end', () => {
                callback(filename);
            });
            if (save) {
                p.pipe(fs.createWriteStream(savepath));
            }
            if (pipeto){
                p.pipe(pipeto);
            }
            self.once('abort', () => {
                p.abort();
            });
            YTLib.prototype.self().emit('pipe', {stream: p, file: savepath});
        } else {
            if (callback) callback("No format is possible");
        }
    });
};

YTLib.prototype.info = function (callback) {
    ytdl.getInfo(YTLib.prototype.self().link, callback);
};

module.exports = YTLib;