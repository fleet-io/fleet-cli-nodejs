let s3vc = require('aws-sdk/clients/s3');
let s3 = null;
let apiExecutor = require('./apiExecutor');
let util = require('../utilities');

let apiTimeLimits = {
}

let apiMethods = {
    listObjectsV2: (fleetConfigData, region, params, fleetPath, correlationData) => {
        return getS3(region).listObjectsV2(params).promise().catch(catchPromise.bind(this, 'S3', 'listObjectsV2', fleetPath, correlationData));
    },

    deleteObjects: (fleetConfigData, region, params, fleetPath, correlationData) => {
        return getS3(region).deleteObjects(params).promise().catch(catchPromise.bind(this, 'S3', 'deleteObjects', fleetPath, correlationData));
    },

    putObject: (fleetConfigData, region, params, fleetPath, correlationData) => {
        return getS3(region).putObject(params).promise().catch(catchPromise.bind(this, 'S3', 'putObject', fleetPath, correlationData));
    },

    putBucketWebsite: (fleetConfigData, region, params, fleetPath, correlationData) => {
        return getS3(region).putBucketWebsite(params).promise().catch(catchPromise.bind(this, 'S3', 'putBucketWebsite', fleetPath, correlationData));
    },

    createBucket: (fleetConfigData, region, params, fleetPath, correlationData) => {
        return getS3(region).createBucket(params).promise().catch(catchPromise.bind(this, 'S3', 'createBucket', fleetPath, correlationData));
    },

    deleteBucket: (fleetConfigData, region, params, fleetPath, correlationData) => {
        return getS3(region).deleteBucket(params).promise().catch(catchPromise.bind(this, 'S3', 'deleteBucket', fleetPath, correlationData));
    }
}

apiExecutor.registerMethod('listObjectsV2', apiMethods.listObjectsV2, 0);
apiExecutor.registerMethod('deleteObjects', apiMethods.deleteObjects, 0);
apiExecutor.registerMethod('putObject', apiMethods.putObject);
apiExecutor.registerMethod('putBucketWebsite', apiMethods.putBucketWebsite, 0);
apiExecutor.registerMethod('createBucket', apiMethods.createBucket, 0);
apiExecutor.registerMethod('deleteBucket', apiMethods.deleteBucket, 0);


let getS3 = (region) => {
    return (s3 = new s3vc({region: region}));
}

let catchPromise = (client, method, fleetPath, correlationData, error) => {
    util.showLog(`Error in ${client} ${method}: ${error}`, fleetPath, correlationData);
    util.showLog(`Error in ${client} ${method} trace: ${error.stack}`, fleetPath, correlationData);
    throw error;
}

module.exports = {
    listObjectsV2: async function(fleetConfigData, region, params, fleetPath, correlationData) { 
        return await apiExecutor.addCall('listObjectsV2', arguments, fleetPath, correlationData).catch(e => {throw e});
    },

    deleteObjects: async function(fleetConfigData, region, params, fleetPath, correlationData) { 
        return await apiExecutor.addCall('deleteObjects', arguments, fleetPath, correlationData).catch(e => {throw e});
    },

    putObject: async function(fleetConfigData, region, params, fleetPath, correlationData) { 
        return await apiExecutor.addCall('putObject', arguments, fleetPath, correlationData).catch(e => {throw e});
    },

    putBucketWebsite: async function(fleetConfigData, region, params, fleetPath, correlationData) { 
        return await apiExecutor.addCall('putBucketWebsite', arguments, fleetPath, correlationData).catch(e => {throw e});
    },

    createBucket: async function(fleetConfigData, region, params, fleetPath, correlationData) { 
        return await apiExecutor.addCall('createBucket', arguments, fleetPath, correlationData).catch(e => {throw e});
    },

    deleteBucket: async function(fleetConfigData, region, params, fleetPath, correlationData) { 
        return await apiExecutor.addCall('deleteBucket', arguments, fleetPath, correlationData).catch(e => {throw e});
    }
}
