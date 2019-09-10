let lambdaSvc = require('aws-sdk/clients/lambda');
let lambda = null;

module.exports = {
    addApigPermission: (fleetConfigData, params) => {
        return getLambda(fleetConfigData).addPermission(params).promise();
    },

    deleteFunction: (fleetConfigData, params) => {
        return getLambda(fleetConfigData).deleteFunction(params).promise();
    }
}

let getLambda = (fleetConfigData) => {
    return lambda || new lambdaSvc({
        region: fleetConfigData.region
    });
}