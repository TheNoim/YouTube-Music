/**
 * Created by nilsbergmann on 04.02.17.
 */
const YTLib = require('./src/YTLib');
const getYouTubeID = require('get-youtube-id');
const url = "https://www.youtube.com/watch?v=9YvQHlcTM24";
const testdownload = new YTLib(getYouTubeID(url), url);

testdownload.on('progress', (progress) => {
    console.log("Progress", progress);
});
//testdownload.download();
testdownload.download('./', 'temp.mp4', true,() => {

});

testdownload.on('pipe', () => {
});