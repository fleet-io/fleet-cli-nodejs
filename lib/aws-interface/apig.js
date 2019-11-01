let apigatewaySvc = require('aws-sdk/clients/apigateway');
let apig = null;
let util = require('../utilities');
let createRestApiTimeLimit = 3000;
let deleteRestApiTimeLimit = 30000;
let createResourceTimeLimit = 200;
let deleteResourceTimeLimit = 200;
let createResourceDeploymentTimeLimit = 5000;

module.exports = {
    createRestApi: async (fleetConfigData, params) => { 
        await util.timeout(createRestApiTimeLimit);
        return getApig(fleetConfigData).createRestApi(params).promise();
    },

    getRestApiResources: (fleetConfigData, params) => {
        return getApig(fleetConfigData).getResources(params).promise();
    },

    createRestApiResource: async (fleetConfigData, params) => {
        await util.timeout(createResourceTimeLimit);
        return getApig(fleetConfigData).createResource(params).promise();
    },

    createResourceMethod: (fleetConfigData, params) => {
        return getApig(fleetConfigData).putMethod(params).promise();
    },

    createResourceLambdaIntegration: (fleetConfigData, params) => {
        return getApig(fleetConfigData).putIntegration(params).promise();
    },

    createResourceDeployment: async (fleetConfigData, params) => {
        await util.timeout(createResourceDeploymentTimeLimit);
        return getApig(fleetConfigData).createDeployment(params).promise();
    },

    deleteResource: async (fleetConfigData, params) => {
        await util.timeout(deleteResourceTimeLimit);
        return getApig(fleetConfigData).deleteResource(params).promise();
    },

    deleteRestApi: async (fleetConfigData, params) => {
        await util.timeout(deleteRestApiTimeLimit);
        return getApig(fleetConfigData).deleteRestApi(params).promise();
    },

    setSvcRegion: (region) => {
        apig = new apigatewaySvc({region: region || 'us-east-1'})
    }
}

let getApig = (fleetConfigData) => {
    return apig || (apig = new apigatewaySvc({region: 'us-east-1'}));
}