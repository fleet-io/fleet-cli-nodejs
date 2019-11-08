let apigatewaySvc = require('aws-sdk/clients/apigateway');
let apig = null;
let util = require('../utilities');
let apiExecutor = require('./apiExecutor');

let apiTimeLimits = {
    createRestApiTimeLimit: 3000,
    deleteRestApiTimeLimit:  30000,
    createResourceTimeLimit:  200,
    deleteResourceTimeLimit:  200,
    createResourceDeploymentTimeLimit:  5000
}

//api method calls
let apiMethods = {
    createRestApi: async (fleetConfigData, region, params, correlationData) => { 
        if(region) setSvcRegion(region); 
        return getApig().createRestApi(params).promise().catch(catchPromise.bind(this, 'APIGateway', 'createRestApi', correlationData));
    },

    createRestApiResource: async (fleetConfigData, region, params, correlationData) => {
        if(region) setSvcRegion(region); 
        return getApig().createResource(params).promise().catch(catchPromise.bind(this, 'APIGateway', 'createResource', correlationData));
    },

    createResourceDeployment: async (fleetConfigData, region, params, correlationData) => {
        if(region) setSvcRegion(region); 
        return getApig().createDeployment(params).promise().catch(catchPromise.bind(this, 'APIGateway', 'createDeployment', correlationData));
    },

    createResourceLambdaIntegration: (fleetConfigData, region, params, correlationData) => {
        if(region) setSvcRegion(region); 
        return getApig().putIntegration(params).promise().catch(catchPromise.bind(this, 'APIGateway', 'putIntegration', correlationData));
    },

    createResourceMethod: (fleetConfigData, region, params, correlationData) => {
        if(region) setSvcRegion(region); 
        return getApig().putMethod(params).promise().catch(catchPromise.bind(this, 'APIGateway', 'putMethod', correlationData));
    },

    deleteRestApi: async (fleetConfigData, region, params, correlationData) => {
        if(region) setSvcRegion(region); 
        return getApig().deleteRestApi(params).promise().catch(catchPromise.bind(this, 'APIGateway', 'deleteRestApi', correlationData));
    },

    deleteResource: async (fleetConfigData, region, params, correlationData) => {
        if(region) setSvcRegion(region); 
        return getApig().deleteResource(params).promise().catch(catchPromise.bind(this, 'APIGateway', 'deleteResource', correlationData));
    },

    getRestApiResources: (fleetConfigData, region, params, correlationData) => {
        if(region) setSvcRegion(region); 
        return getApig().getResources(params).promise().catch(catchPromise.bind(this, 'APIGateway', 'getResources', correlationData));
    }
}

//register methods with api exector
apiExecutor.registerMethod('createRestApi', apiMethods.createRestApi, apiTimeLimits.createRestApiTimeLimit);
apiExecutor.registerMethod('createRestApiResource', apiMethods.createRestApiResource, apiTimeLimits.createRestApiResource);
apiExecutor.registerMethod('createResourceDeployment', apiMethods.createResourceDeployment, apiTimeLimits.createResourceDeploymentTimeLimit);
apiExecutor.registerMethod('createResourceLambdaIntegration', apiMethods.createResourceLambdaIntegration, 0);
apiExecutor.registerMethod('createResourceMethod', apiMethods.createResourceMethod, 0);
apiExecutor.registerMethod('deleteRestApi', apiMethods.deleteRestApi, apiTimeLimits.deleteRestApiTimeLimit);
apiExecutor.registerMethod('deleteResource', apiMethods.deleteResource, apiTimeLimits.deleteResourceTimeLimit);
apiExecutor.registerMethod('getRestApiResources', apiMethods.getRestApiResources, 0);

//api utilities
let getApig = () => {
    return apig || (apig = new apigatewaySvc({region: 'us-east-1'}));
}

let setSvcRegion = (region) => {
    apig = new apigatewaySvc({region: region || 'us-east-1'})
}

let catchPromise = (correlationData, client, method, error) => {
    util.showLog(`Error in ${client} ${method}: ${error}`, correlationData);
    util.showLog(`Error in ${client} ${method} trace: ${error.stack}`, correlationData);
    throw error;
}

//exports
module.exports = {
    createRestApi: async function() { 
        return await apiExecutor.addCall('createRestApi', arguments).catch(e => {throw e});
    },

    createRestApiResource: async function() { 
        return await apiExecutor.addCall('createRestApiResource', arguments).catch(e => {throw e});
    },

    createResourceDeployment: async function() { 
        return await apiExecutor.addCall('createResourceDeployment', arguments).catch(e => {throw e});
    },

    createResourceLambdaIntegration: async function() { 
        return await apiExecutor.addCall('createResourceLambdaIntegration', arguments).catch(e => {throw e});
    },

    createResourceMethod: async function() { 
        return await apiExecutor.addCall('createResourceMethod', arguments).catch(e => {throw e});
    },

    deleteRestApi: async function() { 
        return await apiExecutor.addCall('deleteRestApi', arguments).catch(e => {throw e});
    },

    deleteResource: async function() { 
        return await apiExecutor.addCall('deleteResource', arguments).catch(e => {throw e});
    },

    getRestApiResources: async function() { 
        return await apiExecutor.addCall('getRestApiResources', arguments).catch(e => {throw e});
    }
}