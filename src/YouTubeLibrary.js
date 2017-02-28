/**
 * Created by nilsbergmann on 11.02.17.
 */
const {EventEmitter} = require('events');
const Promise = require('bluebird');
const appendQuery = require('append-query');
const oc = require('optional-callback');
const request = require('request');
const progress = require('request-progress');
const async = require('async');

Promise.config({
    warnings: false,
    longStackTraces: true,
    cancellation: true,
    monitoring: true
});

const PromiseEach = Promise.promisify(async.each);

class YouTubeLibrary extends EventEmitter {

    /**
     * @name ProgressHandler
     * @function
     * @param {object} state - State object of request-progress
     */

    /**
     * @description Nils little youtube library
     * @param APIKey API Key to access the youtube data api
     * @author Nils Bergmann <nilsbergmann@noim.io>
     */
    constructor(APIKey) {
        super();
        // Bind this
        this.getVideoInformation = this.getVideoInformation.bind(this);
        this.getAPIURL = this.getAPIURL.bind(this);
        this.getPlaylistInformation = this.getPlaylistInformation.bind(this);
        this.getPlaylistVideos = this.getPlaylistVideos.bind(this);
        this.getPlaylist = this.getPlaylist.bind(this);
        this.searchOnYouTube = this.searchOnYouTube.bind(this);
        this.getChannelID = this.getChannelID.bind(this);
        this.getChannel = this.getChannel.bind(this);
        this.getChannelByUsername = this.getChannelByUsername.bind(this);

        // Initialize
        this.APIKey = APIKey;
        this.YoutubeDataAPI = {
            "urls": {
                "videos": `https://www.googleapis.com/youtube/v3/videos?key=${this.APIKey}`,
                "playlists": `https://www.googleapis.com/youtube/v3/playlists?key=${this.APIKey}`,
                "playlistItems": `https://www.googleapis.com/youtube/v3/playlistItems?key=${this.APIKey}`,
                "search": `https://www.googleapis.com/youtube/v3/search?key=${this.APIKey}`,
                "channels": `https://www.googleapis.com/youtube/v3/channels?key=${this.APIKey}`
            },
            "parts": {
                "videos": [
                    'snippet',
                    'statistics',
                    'contentDetails',
                    'id'
                ],
                "playlists": [
                    'snippet',
                    'contentDetails',
                    'id'
                ],
                "playlistItems": [
                    'snippet',
                    'contentDetails',
                    'id'
                ],
                "search": [
                    "snippet"
                ],
                "channels": [
                    'snippet',
                    'statistics',
                    'id',
                    'brandingSettings'
                ]
            }
        };


        this.getVideoInformation = oc(this.getVideoInformation);
        this.getPlaylistInformation = oc(this.getPlaylistInformation);
        this.getPlaylistVideos = oc(this.getPlaylistVideos);
        this.getPlaylist = oc(this.getPlaylist);
        this.searchOnYouTube = oc(this.searchOnYouTube);
        this.getChannelID = oc(this.getChannelID);
        this.getChannel = oc(this.getChannel);
        this.getChannelByUsername = oc(this.getChannelByUsername);
    }

    /**
     *
     * @param {string|array} videoId
     * @param {Function} [Callback]
     * @return {Promise<Array>|<Object>}
     */
    getVideoInformation(videoId, Callback) {
        const self = this;
        return new Promise((resolve, reject) => {
            let Querys = {
                "part": this.YoutubeDataAPI.parts.videos.join(',')
            };
            if (typeof videoId == "string") {
                Querys["id"] = videoId;
            } else if (Array.isArray(videoId)) {
                Querys["id"] = videoId.join(',');
            } else {
                return reject(`The type of videoId is ${typeof videoId}. Allowed is string or array.`);
            }
            self._requestWithNextPage(self.getAPIURL('videos', Querys)).then((Data) => {
                if (typeof videoId == "string") {
                    resolve(Data.items[0]);
                } else if (Array.isArray(videoId)) {
                    resolve(Data.items);
                }
            }).catch((e) => reject(e));
        });
    }

    /**
     * @typedef {Object} YouTubePageInfo
     * @property {int} totalResults
     * @property {int} resultsPerPage
     */

    /**
     * @typedef {Object} searchListResponse
     * @property {string} kind
     * @property {string} etag
     * @property {string} nextPageToken
     * @property {string} regionCode
     * @property {YouTubePageInfo} pageInfo
     * @property {Array} items
     */

    /**
     * @description Search on youtube
     * @param {string} SearchText
     * @param {string} [type=video,channel,playlist]
     * @param {string} [Order=relevance]
     * @param {int} [maxResults=20] Max result per page
     * @param {int} [pages=10] how many pages to query
     * @param {string} [nextPageToken=undefined]
     * @return {Promise<searchListResponse>}
     */
    searchOnYouTube(SearchText, type, Order, maxResults, pages, nextPageToken) {
        const self = this;
        return self._requestWithNextPage(appendQuery(self.YoutubeDataAPI.urls.search, {q: SearchText, type: type, order: Order, part: self.YoutubeDataAPI.parts.search.join(','), pageToken: nextPageToken || undefined}), pages || 10, maxResults || 20);
    }

    /**
     * @typedef {Object} PlaylistInformation
     * @property {string} kind
     * @property {string} etag
     * @property {id} id
     * @property {Object} snippet
     * @property {Object} contentDetails
     */

    /**
     * @description GET the playlist Information`s without the videos
     * @param {string} playlistId
     * @param {Function} [Callback]
     * @return {Promise<PlaylistInformation>}
     */
    getPlaylistInformation(playlistId, Callback) {
        const self = this;
        return new Promise((resolve, reject) => {
            self._requestWithNextPage(self.getAPIURL("playlists", {
                id: playlistId,
                part: self.YoutubeDataAPI.parts.playlists.join(',')
            }))
                .then((Data) => {
                    if (Data.items && Data.items.length > 0) {
                        resolve(Data.items[0]);
                    } else {
                        reject(`No result.`);
                    }
                })
                .catch(reject);
        });
    }

    /**
     *
     * @param {string} playlistId
     * @param {Function} [Callback]
     * @return {Promise}
     */
    getPlaylist(playlistId, Callback) {
        const self = this;
        return new Promise((resolve, reject) => {
            return Promise.all([
                self.getPlaylistInformation(playlistId),
                self.getPlaylistVideos(playlistId)
            ]).spread((Info, Videos) => {
                Info.videos = Videos;
                resolve(Info);
            }).catch(reject);
        });
    }

    /**
     *
     * @param {string} playlistId
     * @param {Function} [Callback]
     * @return {Promise<Array>}
     */
    getPlaylistVideos(playlistId, Callback) {
        const self = this;
        return new Promise((resolve, reject) => {
            self._requestWithNextPage(self.getAPIURL('playlistItems', {
                playlistId: playlistId,
                part: self.YoutubeDataAPI.parts.playlistItems.join(',')
            }))
                .then((Data) => {
                    return self._resolvePlaylistResources(Data.items);
                })
                .then((Videos) => {
                    resolve(Videos);
                })
                .catch(reject);
        });
    }

    /**
     *
     * @param {string} forUsername
     * @param {function} [Callback]
     * @return {Promise<String>}
     */
    getChannelID(forUsername, Callback) {
        const self = this;
        return new Promise((resolve, reject) => {
            request(appendQuery(self.YoutubeDataAPI.urls.channels, {part: 'id', forUsername: forUsername}), {json: true}, (error, response, body) => {
                if (!error && response.statusCode == 200){
                    if (body && body.items && body.items.length > 0 && body.items[0] && body.items[0].id){
                        resolve(body.items[0].id);
                    } else {
                        reject(`No result for ${forUsername} | ${JSON.stringify(body)}`);
                    }
                } else {
                    reject(error || response.statusCode);
                }
            });
        });
    }

    /**
     *
     * @param {string} channelID
     * @param {function} [Callback]
     * @return {Promise<Object>}
     */
    getChannel(channelID, Callback) {
        const self = this;
        return new Promise((resolve, reject) => {
            request(self.getAPIURL('channels', {id: channelID, part: self.YoutubeDataAPI.parts.channels.join(',')}),{json: true} ,(error, response, body) => {
                if (!error && response.statusCode == 200) {
                    if (body && body.items && body.items.length > 0 && body.items[0]){
                        resolve(body.items[0]);
                    } else {
                        reject(`No result for ${channelID} | ${JSON.stringify(body)}`);
                    }
                } else {
                    reject(error || `The response status code is ${response.statusCode}`);
                }
            });
        });
    }

    /**
     *
     * @param Username
     * @param {function} [Callback]
     * @return {Promise<Object>}
     */
    getChannelByUsername(Username, Callback) {
        const self = this;
        return self.getChannelID(Username).then(id => {
            return self.getChannel(id);
        });
    }

    /**
     *
     * @param {Array} PlaylistResourceItems
     * @return {Promise<Array>}
     * @private
     */
    _resolvePlaylistResources(PlaylistResourceItems) {
        const self = this;
        return new Promise((resolve, reject) => {
            let videos = [];
            PromiseEach(PlaylistResourceItems, (playlistItemsResource, EachCallback) => {
                self.getVideoInformation(playlistItemsResource.snippet.resourceId.videoId, (error, Video) => {
                    if (Video) videos.push(Video);
                    EachCallback(error);
                });
            }).then(() => {
                resolve(videos);
            }).catch(reject);
        });
    }

    /**
     *
     * @param url
     * @param {int} [limit=50]
     * @param {int} [maxResults=20] Max results per page
     * @return {Promise<Object>}
     * @private
     */
    _requestWithNextPage(url, limit, maxResults) {
        limit = limit || 50;
        return new Promise((resolve, reject, onCancel) => {
            let cancel = false;
            const fR = request(appendQuery(url, {maxResults: maxResults || 20}), {json: true}, (error, response, body) => {
                if (!error && response.statusCode == 200) {
                    if (body) {
                        if (body.pageInfo && (body.pageInfo.totalResults / body.pageInfo.resultsPerPage) > 1 && body.items && body.nextPageToken) {
                            let NextPageToken = body.nextPageToken;
                            let items = body.items;
                            let count = body.pageInfo.totalResults / body.pageInfo.resultsPerPage;
                            if (count > limit) {
                                count = limit + 1;
                            }
                            async.timesSeries(count, (n, Next) => {
                                if (cancel) {
                                    Next();
                                } else {
                                    async.retry((RetryCallback) => {
                                        request(appendQuery(url, {"pageToken": NextPageToken}), {json: true}, (error, response, body) => {
                                            if (!error && response.statusCode == 200) {
                                                RetryCallback(null, body);
                                            } else {
                                                RetryCallback(error || `The page ${appendQuery(url, {"pageToken": NextPageToken})} status is ${response.statusCode}`);
                                            }
                                        });
                                    }, (error, body) => {
                                        if (error) {
                                            Next(error);
                                        } else {
                                            if (body && body.nextPageToken) {
                                                NextPageToken = body.nextPageToken;
                                            }
                                            if (body && body.items) {
                                                items = items.concat(body.items);
                                            }
                                            Next();
                                        }
                                    });
                                }
                            }, (error) => {
                                if (!cancel) {
                                    if (error) {
                                        reject(error)
                                    } else {
                                        body.items = items;
                                        body.nextPageToken = NextPageToken;
                                        resolve(body);
                                    }
                                }
                            });
                        } else {
                            if (cancel) return;
                            resolve(body);
                        }
                    } else {
                        if (cancel) return;
                        reject(`The body of ${url} is empty.`);
                    }
                } else {
                    if (cancel) return;
                    reject(error || `The status of ${url} is ${response.statusCode}.`);
                }
            });
            onCancel(function () {
                fR.abort();
                cancel = true;
            });
        });
    }

    /**
     *
     * @param {string} kind - For which purpose
     * @param {object|string} [querys] - Query strings to append
     */
    getAPIURL(kind, querys) {
        return appendQuery(this.YoutubeDataAPI.urls[kind], querys);
    }

}

module.exports = YouTubeLibrary;