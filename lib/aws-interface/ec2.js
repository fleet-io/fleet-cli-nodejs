let ec2Svc = require('aws-sdk/clients/ec2');
let ec2 = null;
let util = require('../utilities');

module.exports = {
    describeRegions: async (fleetConfigData, params) => { 
        return getEc2().describeRegions(params).promise();
    },

    setSvcRegion: (region) => {
        ec2 = new ec2Svc({region: region || 'us-east-1'})
    }
}

let getEc2 = (fleetConfigData) => {
    return ec2 || (ec2 = new ec2Svc({region: 'us-east-1'}));
}