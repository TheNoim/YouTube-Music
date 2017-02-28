/**
 * Created by nilsbergmann on 04.02.17.
 */
const YouTubeLibrary = require('./src/YouTubeLibrary');
const ytlib = new YouTubeLibrary('AIzaSyAmrU02S7vOBKU2Ep6lpaGP9SW7y3K3KKQ');
const fs = require('fs-extra');
//ytlib.getVideoInformation('oQoSf9LvlOg').then((b) => console.log(JSON.stringify(b))).catch(console.error);
// ytlib.getPlaylistInformation('PLwUHjHYlA7ucdqxZM5Uyr6NZn7mzhTf4r').then((b) => {
//     fs.writeFileSync('./yt.json', JSON.stringify(b));
// }).catch(console.error);
// ytlib.searchOnYouTube('ShaderCraft', undefined, undefined, 5, undefined, 'CAUQAA').then((b) => {
//     fs.writeFileSync('./yt.json', JSON.stringify(b));
// }).catch(console.error);

// ytlib.getChannelID('ShaderCraftDe').then(id => {
//     return ytlib.getChannel(id);
// }).then(result => {
//     console.log(JSON.stringify(result));
// }).catch(console.error);

ytlib.getChannelByUsername('ShaderCraftDe', console.log);