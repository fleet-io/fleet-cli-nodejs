let lambdaSvc = require('aws-sdk/clients/lambda');
let lambda = null;
let apiExecutor = require('./apiExecutor');

let apiTimeLimits = {
}

//api method calls
let apiMethods = {
    addApigPermission: async (fleetConfigData, region, params, correlationData) => {
        if(region) setSvcRegion(region); 
        return getLambda().addPermission(params).promise().catch(catchPromise.bind(this, 'Lambda', 'addApigPermission', correlationData));
    },

    createFunction: async (fleetConfigData, region, params, correlationData) => {
        if(region) setSvcRegion(region); 
        return getLambda().createFunction(params).promise().catch(catchPromise.bind(this, 'Lambda', 'createFunction', correlationData));
    },

    deleteFunction: async (fleetConfigData, region, params, correlationData) => {
        if(region) setSvcRegion(region); 
        return getLambda().deleteFunction(params).promise().catch(catchPromise.bind(this, 'Lambda', 'deleteFunction', correlationData));
    },

    updateFunctionCode: async (fleetConfigData, region, params, correlationData) => {
        if(region) setSvcRegion(region); 
        return getLambda().updateFunctionCode(params).promise().catch(catchPromise.bind(this, 'Lambda', 'updateFunctionCode', correlationData));
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

let catchPromise = (correlationData, client, method, error) => {
    util.showLog(`Error in ${client} ${method}: ${error}`, correlationData);
    util.showLog(`Error in ${client} ${method} trace: ${error.stack}`, correlationData);
    throw error;
}

module.exports = {
    addApigPermission: async function() {
        return await apiExecutor.addCall('addApigPermission', arguments).catch(e => {throw e});
    },

    createFunction: async function() {
        return await apiExecutor.addCall('createFunction', arguments).catch(e => {throw e});
    },

    deleteFunction: async function() {
        return await apiExecutor.addCall('deleteFunction', arguments).catch(e => {throw e});
    },

    updateFunctionCode: async function() {
        return await apiExecutor.addCall('updateFunctionCode', arguments).catch(e => {throw e});
    }
}
