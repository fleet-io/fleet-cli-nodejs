let ec2Svc = require('aws-sdk/clients/ec2');
let ec2 = null;
let util = require('../utilities');
let apiExecutor = require('./apiExecutor');

let apiTimeLimits = {
}

let apiMethods = {
    describeRegions: async (fleetConfigData, region, params, correlationData) => { 
        return getEc2().describeRegions(params).promise().catch(catchPromise.bind(this, 'EC2', 'describeRegions', correlationData));
    }
}

//register methods with api exector
apiExecutor.registerMethod('describeRegions', apiMethods.describeRegions, 0);


let getEc2 = () => {
    return ec2 || (ec2 = new ec2Svc({region: 'us-east-1'}));
}

let setSvcRegion = (region) => {
    ec2 = new ec2Svc({region: region || 'us-east-1'})
}

let catchPromise = (correlationData, client, method, error) => {
    util.showLog(`Error in ${client} ${method}: ${error}`, correlationData);
    util.showLog(`Error in ${client} ${method} trace: ${error.stack}`, correlationData);
    throw error;
}

module.exports = {
    describeRegions: async function() { 
        return await apiExecutor.addCall('describeRegions', arguments).catch(e => {throw e});
    }
}