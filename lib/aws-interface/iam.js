let iamSvc = require('aws-sdk/clients/iam');
let iam = null;

module.exports = {
    createIAMRole: (fleetConfigData, params) => {
        return getIAM(fleetConfigData).createRole(params).promise();
    },

    createIAMPolicy: (fleetConfigData, params) => {
        return getIAM(fleetConfigData).putRolePolicy(params).promise();
    },

    deleteIAMRole: (fleetConfigData, params) => {
        return getIAM(fleetConfigData).deleteRole(params).promise();
    },

    deleteIAMRolePolicy: (fleetConfigData, params) => {
        return getIAM(fleetConfigData).deleteRolePolicy(params).promise();
    }
}

let getIAM = (fleetConfigData) => {
    return iam || new iamSvc();
}