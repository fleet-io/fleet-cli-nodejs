let iamSvc = require('aws-sdk/clients/iam');
let iam = null;
let apiExecutor = require('./apiExecutor');
let util = require('../utilities');

let apiTimeLimits = {

}

let apiMethods = {
    createIAMRole: (fleetConfigData, params, fleetPath, correlationData) => {
        return getIAM().createRole(params).promise().catch(catchPromise.bind(this, 'IAM', 'createIAMRole', fleetPath, correlationData));
    },

    createIAMPolicy: (fleetConfigData, params, fleetPath, correlationData) => {
        return getIAM().putRolePolicy(params).promise().catch(catchPromise.bind(this, 'IAM', 'createIAMPolicy', fleetPath, correlationData));
    },

    deleteIAMRole: (fleetConfigData, params, fleetPath, correlationData) => {
        return getIAM().deleteRole(params).promise().catch(catchPromise.bind(this, 'IAM', 'deleteIAMRole', fleetPath, correlationData));
    },

    deleteIAMRolePolicy: (fleetConfigData, params, fleetPath, correlationData) => {
        return getIAM().deleteRolePolicy(params).promise().catch(catchPromise.bind(this, 'IAM', 'deleteIAMRolePolicy'. fleetPath, correlationData));
    }
}

apiExecutor.registerMethod('createIAMRole', apiMethods.createIAMRole, 0);
apiExecutor.registerMethod('createIAMPolicy', apiMethods.createIAMPolicy, 0);
apiExecutor.registerMethod('deleteIAMRole', apiMethods.deleteIAMRole, 0);
apiExecutor.registerMethod('deleteIAMRolePolicy', apiMethods.deleteIAMRolePolicy, 0);

let getIAM = () => {
    return iam || (iam = new iamSvc());
}

let catchPromise = (correlationData, client, method, fleetPath, error) => {
    util.showLog(`Error in ${client} ${method}: ${error}`, fleetPath, correlationData);
    util.showLog(`Error in ${client} ${method} trace: ${error.stack}`, fleetPath, correlationData);
    throw error;
}

module.exports = {
    createIAMRole: async function(fleetConfigData, params, fleetPath, correlationData) { 
        return await apiExecutor.addCall('createIAMRole', arguments, fleetPath).catch(e => {throw e});
    },

    createIAMPolicy: async function(fleetConfigData, params, fleetPath, correlationData) { 
        return await apiExecutor.addCall('createIAMPolicy', arguments, fleetPath).catch(e => {throw e});
    },

    deleteIAMRole: async function(fleetConfigData, params, fleetPath, correlationData) { 
        return await apiExecutor.addCall('deleteIAMRole', arguments, fleetPath).catch(e => {throw e});
    },

    deleteIAMRolePolicy: async function(fleetConfigData, params, fleetPath, correlationData) { 
        return await apiExecutor.addCall('deleteIAMRolePolicy', arguments, fleetPath).catch(e => {throw e});
    }
}