let s3vc = require('aws-sdk/clients/s3');
let s3 = null;
let apiExecutor = require('./apiExecutor');
let util = require('../utilities');

let apiTimeLimits = {
}

let apiMethods = {
    putObject: (fleetConfigData, params, fleetPath, correlationData) => {
        return getS3().putObject(params).promise().catch(catchPromise.bind(this, 'S3', 'putObject', fleetPath, correlationData));
    },

    putBucketWebsite: (fleetConfigData, params, fleetPath, correlationData) => {
        return getS3().putBucketWebsite(params).promise().catch(catchPromise.bind(this, 'S3', 'putBucketWebsite', fleetPath, correlationData));
    },

    createBucket: (fleetConfigData, params, fleetPath, correlationData) => {
        return getS3().createBucket(params).promise().catch(catchPromise.bind(this, 'S3', 'createBucket', fleetPath, correlationData));
    }
}

apiExecutor.registerMethod('putObject', apiMethods.putObject, 0);
apiExecutor.registerMethod('putBucketWebsite', apiMethods.putBucketWebsite, 0);
apiExecutor.registerMethod('createBucket', apiMethods.createBucket, 0);


let getS3 = () => {
    return s3 || (s3 = new s3vc({}));
}

let catchPromise = (correlationData, client, method, fleetPath, error) => {
    util.showLog(`Error in ${client} ${method}: ${error}`, fleetPath, correlationData);
    util.showLog(`Error in ${client} ${method} trace: ${error.stack}`, fleetPath, correlationData);
    throw error;
}

module.exports = {
    putObject: async function(fleetConfigData, params, fleetPath, correlationData) { 
        return await apiExecutor.addCall('putObject', arguments, fleetPath, correlationData).catch(e => {throw e});
    },

    putBucketWebsite: async function(fleetConfigData, params, fleetPath, correlationData) { 
        return await apiExecutor.addCall('putBucketWebsite', arguments, fleetPath, correlationData).catch(e => {throw e});
    },

    createBucket: async function(fleetConfigData, params, fleetPath, correlationData) { 
        return await apiExecutor.addCall('createBucket', arguments, fleetPath, correlationData).catch(e => {throw e});
    }
}
