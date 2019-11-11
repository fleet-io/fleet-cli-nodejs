let s3vc = require('aws-sdk/clients/s3');
let s3 = null;
let apiExecutor = require('./apiExecutor');

let apiTimeLimits = {

}

let apiMethods = {
    putObject: (fleetConfigData, params, correlationData) => {
        return getS3().putObject(params).promise().catch(catchPromise.bind(this, 'S3', 'putObject', correlationData));
    },

    putBucketWebsite: (fleetConfigData, params, correlationData) => {
        return getS3().putBucketWebsite(params).promise().catch(catchPromise.bind(this, 'S3', 'putBucketWebsite', correlationData));
    },

    createBucket: (fleetConfigData, params, correlationData) => {
        return getS3().createBucket(params).promise().catch(catchPromise.bind(this, 'S3', 'createBucket', correlationData));
    }
}

apiExecutor.registerMethod('putObject', apiMethods.putObject, 0);
apiExecutor.registerMethod('putBucketWebsite', apiMethods.putBucketWebsite, 0);
apiExecutor.registerMethod('createBucket', apiMethods.createBucket, 0);


let getS3 = () => {
    return s3 || (s3 = new s3vc({}));
}

let catchPromise = (correlationData, client, method, error) => {
    util.showLog(`Error in ${client} ${method}: ${error}`, correlationData);
    util.showLog(`Error in ${client} ${method} trace: ${error.stack}`, correlationData);
    throw error;
}

module.exports = {
    putObject: async function() { 
        return await apiExecutor.addCall('putObject', arguments).catch(e => {throw e});
    },

    putBucketWebsite: async function() { 
        return await apiExecutor.addCall('putBucketWebsite', arguments).catch(e => {throw e});
    },

    createBucket: async function() { 
        return await apiExecutor.addCall('createBucket', arguments).catch(e => {throw e});
    }
}
