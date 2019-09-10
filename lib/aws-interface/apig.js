let apigatewaySvc = require('aws-sdk/clients/apigateway');
let apig = null;

module.exports = {
    createRestApi: (fleetConfigData, params) => {
        return getApig(fleetConfigData).createRestApi(params).promise();
    },

    getRestApiResources: (fleetConfigData, params) => {
        return getApig(fleetConfigData).getResources(params).promise();
    },

    createRestApiResource: (fleetConfigData, params) => {
        return getApig(fleetConfigData).createResource(params).promise();
    },

    createResourceMethod: (fleetConfigData, params) => {
        return getApig(fleetConfigData).putMethod(params).promise();
    },

    createResourceLambdaIntegration: (fleetConfigData, params) => {
        return getApig(fleetConfigData).putIntegration(params).promise();
    },

    createResourceDeployment: (fleetConfigData, params) => {
        return getApig(fleetConfigData).createDeployment(params).promise();
    },

    deleteResource: (fleetConfigData, params) => {
        return getApig(fleetConfigData).deleteResource(params).promise();
    },

    deleteRestApi: (fleetConfigData, params) => {
        return getApig(fleetConfigData).deleteRestApi(params).promise();
    }
}

let getApig = (fleetConfigData) => {
    return apig || new apigatewaySvc({
        region: fleetConfigData.region
    });
}