let ec2Svc = require('aws-sdk/clients/ec2');
let ec2 = null;
let util = require('../utilities');

module.exports = {
    describeRegions: async (fleetConfigData, params, correlationData) => { 
        return getEc2().describeRegions(params).promise().catch(error => {
            util.showLog(`Error in EC2 describeRegions: ${error}`, correlationData);
            util.showLog(`Error in EC2 describeRegions trace: ${error.stack}`, correlationData);
            throw error;
        });
    },

    setSvcRegion: (region) => {
        ec2 = new ec2Svc({region: region || 'us-east-1'})
    }
}

let getEc2 = () => {
    return ec2 || (ec2 = new ec2Svc({region: 'us-east-1'}));
}