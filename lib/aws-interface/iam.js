let iamSvc = require('aws-sdk/clients/iam');
let iam = null;
let apiExecutor = require('./apiExecutor');

let apiTimeLimits = {

}

let apiMethods = {
    createIAMRole: (fleetConfigData, params, correlationData) => {
        return getIAM().createRole(params).promise().catch(catchPromise.bind(this, 'IAM', 'createIAMRole', correlationData));
    },

    createIAMPolicy: (fleetConfigData, params, correlationData) => {
        return getIAM().putRolePolicy(params).promise().catch(catchPromise.bind(this, 'IAM', 'createIAMPolicy', correlationData));
    },

    deleteIAMRole: (fleetConfigData, params, correlationData) => {
        return getIAM().deleteRole(params).promise().catch(catchPromise.bind(this, 'IAM', 'deleteIAMRole', correlationData));
    },

    deleteIAMRolePolicy: (fleetConfigData, params, correlationData) => {
        return getIAM().deleteRolePolicy(params).promise().catch(catchPromise.bind(this, 'IAM', 'deleteIAMRolePolicy', correlationData));
    }
}

apiExecutor.registerMethod('createIAMRole', apiMethods.createIAMRole, 0);
apiExecutor.registerMethod('createIAMPolicy', apiMethods.createIAMPolicy, 0);
apiExecutor.registerMethod('deleteIAMRole', apiMethods.deleteIAMRole, 0);
apiExecutor.registerMethod('deleteIAMRolePolicy', apiMethods.deleteIAMRolePolicy, 0);

let getIAM = () => {
    return iam || (iam = new iamSvc());
}

let catchPromise = (correlationData, client, method, error) => {
    util.showLog(`Error in ${client} ${method}: ${error}`, correlationData);
    util.showLog(`Error in ${client} ${method} trace: ${error.stack}`, correlationData);
    throw error;
}

module.exports = {
    createIAMRole: async function() { 
        return await apiExecutor.addCall('createIAMRole', arguments).catch(e => {throw e});
    },

    createIAMPolicy: async function() { 
        return await apiExecutor.addCall('createIAMPolicy', arguments).catch(e => {throw e});
    },

    deleteIAMRole: async function() { 
        return await apiExecutor.addCall('deleteIAMRole', arguments).catch(e => {throw e});
    },

    deleteIAMRolePolicy: async function() { 
        return await apiExecutor.addCall('deleteIAMRolePolicy', arguments).catch(e => {throw e});
    }
}