let lambdaSvc = require('aws-sdk/clients/lambda');
let lambda = null;
let apiExecutor = require('./apiExecutor');
let util = require('../utilities');

let apiTimeLimits = {
}

//api method calls
let apiMethods = {
    addApigPermission: async (fleetConfigData, region, params, fleetPath, correlationData) => {
        if(region) setSvcRegion(region); 
        return getLambda().addPermission(params).promise().catch(catchPromise.bind(this, 'Lambda', 'addApigPermission', fleetPath, correlationData));
    },

    createFunction: async (fleetConfigData, region, params, fleetPath, correlationData) => {
        if(region) setSvcRegion(region); 
        return getLambda().createFunction(params).promise().catch(catchPromise.bind(this, 'Lambda', 'createFunction', fleetPath, correlationData));
    },

    deleteFunction: async (fleetConfigData, region, params, fleetPath, correlationData) => {
        if(region) setSvcRegion(region); 
        return getLambda().deleteFunction(params).promise().catch(catchPromise.bind(this, 'Lambda', 'deleteFunction', fleetPath, correlationData));
    },

    updateFunctionCode: async (fleetConfigData, region, params, fleetPath, correlationData) => {
        if(region) setSvcRegion(region); 
        return getLambda().updateFunctionCode(params).promise().catch(catchPromise.bind(this, 'Lambda', 'updateFunctionCode', fleetPath, correlationData));
    },
}

apiExecutor.registerMethod('addApigPermission', apiMethods.addApigPermission, 0);
apiExecutor.registerMethod('createFunction', apiMethods.createFunction, 0);
apiExecutor.registerMethod('deleteFunction', apiMethods.deleteFunction, 0);
apiExecutor.registerMethod('updateFunctionCode', apiMethods.updateFunctionCode, 0);

let getLambda = () => {
    return lambda || (lambda = new lambdaSvc({ region: 'us-east-1' }));
}

let setSvcRegion = (region) => {
    lambda = new lambdaSvc({region: region || 'us-east-1'})
}

let catchPromise = (client, method, fleetPath, correlationData, error) => {
    util.showLog(`Error in ${client} ${method}: ${error}`, fleetPath, correlationData);
    util.showLog(`Error in ${client} ${method} trace: ${error.stack}`, fleetPath, correlationData);
    throw error;
}

module.exports = {
    addApigPermission: async function(fleetConfigData, region, params, fleetPath, correlationData) {
        return await apiExecutor.addCall('addApigPermission', arguments, fleetPath, correlationData).catch(e => {throw e});
    },

    createFunction: async function(fleetConfigData, region, params, fleetPath, correlationData) {
        return await apiExecutor.addCall('createFunction', arguments, fleetPath, correlationData).catch(e => {throw e});
    },

    deleteFunction: async function(fleetConfigData, region, params, fleetPath, correlationData) {
        return await apiExecutor.addCall('deleteFunction', arguments, fleetPath, correlationData).catch(e => {throw e});
    },

    updateFunctionCode: async function(fleetConfigData, region, params, fleetPath, correlationData) {
        return await apiExecutor.addCall('updateFunctionCode', arguments, fleetPath, correlationData).catch(e => {throw e});
    }
}
