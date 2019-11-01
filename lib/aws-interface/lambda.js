let lambdaSvc = require('aws-sdk/clients/lambda');
let lambda = null;

module.exports = {
    addApigPermission: (fleetConfigData, params) => {
        return getLambda(fleetConfigData).addPermission(params).promise();
    },

    deleteFunction: (fleetConfigData, params) => {
        return getLambda(fleetConfigData).deleteFunction(params).promise();
    },

    setSvcRegion: (region) => {
        lambda = new lambdaSvc({region: region || 'us-east-1'})
    }
}

let getLambda = (fleetConfigData) => {
    return lambda || (lambda = new lambdaSvc({ region: 'us-east-1' }));
}