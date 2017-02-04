/**
 * Created by nilsbergmann on 04.02.17.
 */
const log = require('../Logger')(true);

module.exports = function (cfg) {
    log.info("Setup renderer socket events");

    // vars
    const $scope = cfg.$scope;
    const socket = cfg.socket;
    const $mdDialog = cfg.$mdDialog;

    log.info("Setup error event");
    socket.on('event:ERROR', (Payload) => {
        let erroralert = $mdDialog.alert().ok('Close');
        if (typeof Payload == "string"){
            erroralert.title('Error');
            erroralert.textContent(Payload);
            log.error(Payload);
        } else if (typeof Payload == "object"){
            erroralert.title(Payload.title ? Payload.title : "Error");
            erroralert.textContent(Payload.error);
            log.error(Payload.error);
        } else {
            erroralert.title('Error');
            erroralert.textContent(Payload);
            log.error(Payload);
        }
        $mdDialog.show(erroralert);
    });
    log.info("Error event setup finished");
};