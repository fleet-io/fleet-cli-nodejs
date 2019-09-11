let s3vc = require('aws-sdk/clients/s3');
let s3 = null;

module.exports = {
    putObject: (fleetConfigData, params) => {
        return getS3(fleetConfigData).putObject(params).promise();
    },

    putBucketWebsite: (fleetConfigData, params) => {
        return getS3(fleetConfigData).putBucketWebsite(params).promise();
    },

    createBucket: (fleetConfigData, params) => {
        return getS3(fleetConfigData).createBucket(params).promise();
    }
}

let getS3 = (fleetConfigData) => {
    return s3 || new s3vc({});
}