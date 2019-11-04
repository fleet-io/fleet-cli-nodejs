let aws = require('aws-sdk');
let resolve = require('path').resolve;
let util = require('../utilities');
let apig = require('./apig');
let lambda = require('./lambda');
let iam = require('./iam');
let s3 = require('./s3');
let fs = require('fs');
let dir = require('node-dir');
let ec2 = require('./ec2');

let handleCreateRestApi = async(fleetConfigData, region, correlationData, data) => {
    //update config data with apig id
    fleetConfigData.gateway = fleetConfigData.gateway || {};
    fleetConfigData.gateway[region] = {
        id: data.id
    };
    util.updateFleetConfigFileData(fleetConfigData);

    //get resources of the new APIG.
    let params = {
        restApiId: fleetConfigData.gateway[region].id
    };

    //this is necessary to know the ID of the root resource used to attach
    // any other new resources to this apig.
    await apig.getRestApiResources(fleetConfigData, params)
        .then(handleGetRestApiResources.bind(this, fleetConfigData, region, data, correlationData))
        .catch(catchPromiseError.bind(this, correlationData));
}

let handleGetRestApiResources = (fleetConfigData, region, data, correlationData, apiResources) => {
    //update config data with root resource ID of new apig
    fleetConfigData.gateway[region].rootResourceId = apiResources.items[0].id;
    util.updateFleetConfigFileData(fleetConfigData);

    util.showLog(`Deployed API Gateway for ${fleetConfigData.appName} (${data.id}) in ${region}.`, correlationData);
}

let handleDeleteRestApi = async(fleetConfigData, region, correlationData, data) => {
    //remove gateway from config
    delete fleetConfigData.gateway[region];
    util.updateFleetConfigFileData(fleetConfigData);
    util.showLog(`Delete API Gateway in ${region} for ${fleetConfigData.appName}`, correlationData);
}

let handleCreateRestApiResource = async(fleetConfigData, route, routeName, region, correlationData, resource) => {
    //update config data with new resource
    fleetConfigData.routes[routeName].gateway = fleetConfigData.routes[routeName].gateway || {};
    fleetConfigData.routes[routeName].gateway[region] = {
        resource: resource
    };
    util.updateFleetConfigFileData(fleetConfigData);

    util.showLog(`Deployed Route for ${routeName} (${resource.id}) in ${region}.`, correlationData);

    //setup params for apig put method for this new resource
    let params = {
        authorizationType: 'NONE',
        httpMethod: route.type,
        resourceId: resource.id,
        restApiId: fleetConfigData.gateway[region].id
    };

    if(region) apig.setSvcRegion(region);
    await apig.createResourceMethod(fleetConfigData, params)
        .then(handleCreateResourceMethod.bind(this, fleetConfigData, route, routeName, region, correlationData))
        .catch(catchPromiseError.bind(this, correlationData));
}

let handleCreateResourceMethod = async(fleetConfigData, route, routeName, region, correlationData, method) => {
    //update config data with route's method type
    fleetConfigData.routes[routeName].gateway[region].method = method;
    util.updateFleetConfigFileData(fleetConfigData);

    util.showLog(`Deployed ${route.type} method for ${routeName} API Gateway in ${region}.`, correlationData);

    //setup params for resource integration with lambda function
    let params = {
        httpMethod: route.type,
        resourceId: route.gateway[region].resource.id,
        restApiId: fleetConfigData.gateway[region].id,
        type: 'AWS_PROXY',
        integrationHttpMethod: 'POST',
        uri: `arn:aws:apigateway:${region}:lambda:path//2015-03-31/functions/${fleetConfigData.routes[routeName].lambda[region].functionArn}/invocations`
    };

    if(region) apig.setSvcRegion(region);
    await apig.createResourceLambdaIntegration(fleetConfigData, params)
        .then(handleCreateResourceLambdaIntegration.bind(this, fleetConfigData, routeName, region, correlationData))
        .catch(catchPromiseError.bind(this, correlationData));
}

let handleCreateResourceLambdaIntegration = async(fleetConfigData, routeName, region, correlationData, response) => {
    util.showLog(`Integrated Lambda function with API Gateway in ${region}.`, correlationData);

    let params = {
        Action: "lambda:InvokeFunction",
        FunctionName: fleetConfigData.routes[routeName].lambda[region].functionName,
        Principal: "apigateway.amazonaws.com",
        StatementId: "ID-1"
    };

    if(region) lambda.setSvcRegion(region);
    await lambda.addApigPermission(fleetConfigData, params)
        .then(handleAddApigPermission.bind(this, fleetConfigData, routeName, region, correlationData))
        .catch(catchPromiseError.bind(this, correlationData));
}

let handleAddApigPermission = async(fleetConfigData, routeName, region, correlationData, response) => {
    util.showLog(`Added permission to Lambda function for API Gateway invocation in ${region}.`, correlationData);

    let params = {
        restApiId: fleetConfigData.gateway[region].id,
        stageName: 'api'
    };

    if(region) apig.setSvcRegion(region);
    await apig.createResourceDeployment(fleetConfigData, params)
        .then(handleCreateResourceDeployment.bind(this, fleetConfigData, routeName, region, correlationData))
        .catch(catchPromiseError.bind(this, correlationData));
}

let handleCreateResourceDeployment = (fleetConfigData, routeName, region, correlationData, response) => {
    util.showLog(`API Resource for ${routeName} deployed to API stage in ${region}.`, correlationData);
    util.showLog(`Route fully deployed in ${region}!`, correlationData);

    //update config data with the URL of this deployed api
    fleetConfigData.routes[routeName].url = fleetConfigData.routes[routeName].url || {};
    fleetConfigData.routes[routeName].url[region] = `https://${fleetConfigData.gateway[region].id}.execute-api.${region}.amazonaws.com/api/${fleetConfigData.routes[routeName].apiPath}`;
    util.updateFleetConfigFileData(fleetConfigData);

    util.showLog(`View route at https://${fleetConfigData.gateway[region].id}.execute-api.${region}.amazonaws.com/api/${fleetConfigData.routes[routeName].apiPath}`, correlationData);
}

let handleCreateLambdaIAMRole = (fleetConfigData, correlationData, role) => {
    //update config data with this iam role
    fleetConfigData['lambda-role'] = fleetConfigData['lambda-role'] || {};
    fleetConfigData['lambda-role'].roleName = role.Role.RoleName;
    fleetConfigData['lambda-role'].roleArn = role.Role.Arn;
    util.updateFleetConfigFileData(fleetConfigData);

    util.showLog(`Created service role ${fleetConfigData['lambda-role'].roleName} for Lambda.`, correlationData);
}

let handleCreateLambdaPolicy = (fleetConfigData, correlationData, policy) => {
    //update config data with lambda role policy
    fleetConfigData['lambda-role'].policy = 'inline';
    util.updateFleetConfigFileData(fleetConfigData);

    util.showLog(`Added inline policy for Lambda role ${fleetConfigData['lambda-role'].roleName}`, correlationData);
}

let deleteApigResource = async(fleetConfigData, routeName, region, correlationData) => {
    let params = {
        resourceId: fleetConfigData.routes[routeName].gateway[region].resource.id,
        restApiId: fleetConfigData.gateway[region].id,
    };

    util.showLog(`Deleting API Gateway resource for ${routeName} in ${region}...`, correlationData);

    if(region) apig.setSvcRegion(region);
    await apig.deleteResource(fleetConfigData, params)
        .catch(catchPromiseError.bind(this, correlationData));
}

let deleteLambdaFunction = async(fleetConfigData, routeName, region, correlationData) => {
    let params = {
        FunctionName: fleetConfigData.routes[routeName].lambda[region].functionName
    };

    util.showLog(`Deleting Lambda function for ${routeName} in ${region}...`, correlationData);

    if(region) lambda.setSvcRegion(region);
    await lambda.deleteFunction(fleetConfigData, params)
        .catch(catchPromiseError.bind(this, correlationData));
}

let ensureLambdaRolePolicyUndeployed = async function(fleetConfigData, correlationData) {
    util.showLog(`Deleting Lambda Role Policy from ${fleetConfigData['lambda-role'].roleName}...`, correlationData);

    let params = {
        PolicyName: fleetConfigData['lambda-role'].roleName,
        RoleName: fleetConfigData['lambda-role'].roleName
    }

    await iam.deleteIAMRolePolicy(fleetConfigData, params)
        .catch(catchPromiseError.bind(this, correlationData));
}

let ensureLambdaRoleUndeployed = async function(fleetConfigData, correlationData) {
    util.showLog(`Deleting Lambda Role ${fleetConfigData['lambda-role'].roleName}...`, correlationData);

    let params = {
        RoleName: fleetConfigData['lambda-role'].roleName
    }

    await iam.deleteIAMRole(fleetConfigData, params)
        .catch(catchPromiseError.bind(this, correlationData));
}

let ensureApiGatewayUndeployed = async function(fleetConfigData, gateway, region, correlationData) {
    util.showLog(`Deleting API Gateway ${gateway.id} for ${fleetConfigData.appName} in ${region}`, correlationData);
        
    let params = {
        restApiId: gateway.id
    };

    apig.setSvcRegion(region);
    await apig.deleteRestApi(fleetConfigData, params)
        .then(handleDeleteRestApi.bind(this, fleetConfigData, region, correlationData))
        .catch(catchPromiseError.bind(this, correlationData));
}

let handleCreateS3Bucket = function(fleetConfigData, websiteName, correlationData, data) {
    fleetConfigData.websites[websiteName].url = data.Location;
    util.updateFleetConfigFileData(fleetConfigData);
}

let createS3Bucket = async function(fleetConfigData, websiteName, correlationData) {
    let params = {
        Bucket: `fleet-${fleetConfigData.appName}-${websiteName}`
    }

    await s3.createBucket(fleetConfigData, params)
        .then(handleCreateS3Bucket.bind(this, fleetConfigData, websiteName, correlationData))
        .catch(catchPromiseError.bind(this, correlationData));
}

let putS3Website = async function(fleetConfigData, websiteName, correlationData) {
    util.showLog(`Setting S3 Website Configuration...`, correlationData);

    let params = {
        Bucket: `fleet-${fleetConfigData.appName}-${websiteName}`,
        WebsiteConfiguration: {
            ErrorDocument: {
                Key: "error.html"
            },
            IndexDocument: {
                Suffix: "index.html"
            }
        }
    }

    await s3.putBucketWebsite(fleetConfigData, params)
        .catch(catchPromiseError.bind(this, correlationData));
}

let putS3WebsiteContent = async function(fleetConfigData, websiteName, correlationData) {
    util.showLog(`Uploading files...`, correlationData);
    //TODO: empty bucket prior to upload?

    let filePath = `${process.cwd()}\\websites\\${websiteName}`;
    let files = dir.files(filePath, { sync: true });
    files.forEach(async(file) => {
        let key = file.split(filePath + '\\')[1].split('\\').join('/');
        var body = fs.readFileSync(file);

        let params = {
            ACL: "public-read",
            Body: body,
            Bucket: `fleet-${fleetConfigData.appName}-${websiteName}`,
            Key: key,
            ContentType: 'text',
        }

        await s3.putObject(fleetConfigData, params)
            .catch(catchPromiseError.bind(this, correlationData));
    });
}

let catchPromiseError = (correlationData, error) => {
    util.showLog(`${error} ${error.stack}`, correlationData); // an error occurred
}

module.exports = {
    createAPIG: async function(fleetConfigData, region, correlationData) {
        util.showLog(`Deploying API Gateway for ${fleetConfigData.appName} in ${region}...`, correlationData);

        let params = {
            name: `fleet-apigw-${fleetConfigData.appName}`,
            description: `API Gateway for fleet App ${fleetConfigData.appName}`,
            endpointConfiguration: {
                types: ["REGIONAL"]
            }
        };

        //create a new apig in this region
        if(region) apig.setSvcRegion(region);
        await apig.createRestApi(fleetConfigData, params)
            .then(handleCreateRestApi.bind(this, fleetConfigData, region, correlationData))
            .catch(catchPromiseError.bind(this, correlationData));
    },

    updateAPIG: async function(fleetConfigData, route, routeName, region, correlationData) {
        //Do not updateAPIG if route already deployed
        if(fleetConfigData.routes[routeName].gateway && fleetConfigData.routes[routeName].gateway[region])
            return false;

        //TODO: complex routes:
        // 1) hierarchical resources: /api/users
        // e.g. /api/users
        // 2) params: /api/users/<{pathPartName}>
        // e.g. /api/users/{id} = /api/users/1 

        let routeDefParts = util.getRoutePathParts(route.apiPath);

        util.showLog(`Updating API Gateway ${fleetConfigData.gateway[region].id} with ${routeName} route in ${region}...`, correlationData);

        //setup params to create rest api resource
        let params = {
            parentId: fleetConfigData.gateway[region].rootResourceId,
            restApiId: fleetConfigData.gateway[region].id,
            pathPart: route.apiPath
        };

        if(region) apig.setSvcRegion(region);
        await apig.createRestApiResource(fleetConfigData, params)
            .then(handleCreateRestApiResource.bind(this, fleetConfigData, route, routeName, region, correlationData))
            .catch(catchPromiseError.bind(this, correlationData));
    },

    createLambdaRole: async function(fleetConfigData, correlationData) {
        if (fleetConfigData['lambda-role']) {
            if (fleetConfigData['lambda-role'].roleArn && fleetConfigData['lambda-role'].roleName)
                return true;
        }

        util.showLog(`Creating Lambda service role for ${fleetConfigData.appName}`, correlationData)

        let lambdaTrustPath = resolve(__dirname, "policies/lambda-trust.json");
        let params = {
            AssumeRolePolicyDocument: JSON.stringify(require(lambdaTrustPath)),
            RoleName: `fleet-${fleetConfigData.appName}-lambda`
        };

        await iam.createIAMRole(fleetConfigData, params)
            .then(handleCreateLambdaIAMRole.bind(this, fleetConfigData, correlationData))
            .catch(catchPromiseError.bind(this, correlationData));
    },

    createLambdaRoleInlinePolicy: async function(fleetConfigData, correlationData) {
        if (fleetConfigData['lambda-role'] && fleetConfigData['lambda-role'].policy) {
            return true;
        }

        util.showLog(`Adding inline policy for Lambda role for ${fleetConfigData.appName}`, correlationData)

        let lambdaPolicyPath = resolve(__dirname, "policies/lambda.json");
        let params = {
            PolicyName: `fleet-${fleetConfigData.appName}-lambda`,
            PolicyDocument: JSON.stringify(require(lambdaPolicyPath)),
            RoleName: fleetConfigData['lambda-role'].roleName
        };

        //this may not work without a retry, there is some slowness in the
        // policy availability for ~10 seconds after put.
        await iam.createIAMPolicy(fleetConfigData, params)
            .then(handleCreateLambdaPolicy.bind(this, fleetConfigData, correlationData))
            .catch(catchPromiseError.bind(this, correlationData));

        util.showLog(`Waiting for Lambda inline policy to become available...`, correlationData);
        await util.timeout(20000);
        //TODO: Check if policy is available
    },

    setupUpdateLambdaParams: function(fleetConfigData, routeName) {
        let s3ZipBuffer = util.getBufferZip(fleetConfigData.routes[routeName].path);

        let lambdaParams = {
            ZipFile: s3ZipBuffer,
            FunctionName: `fleet-${fleetConfigData.appName}-${routeName}`,
        };

        return lambdaParams;
    },

    setupNewLambdaParams: function(fleetConfigData, routeName) {
        let s3ZipBuffer = util.getBufferZip(fleetConfigData.routes[routeName].path);

        let lambdaParams = {
            Code: {
                ZipFile: s3ZipBuffer
            },
            FunctionName: `fleet-${fleetConfigData.appName}-${routeName}`,
            Handler: 'index.handler',
            Role: fleetConfigData['lambda-role'].roleArn,
            Runtime: 'nodejs8.10'
        };

        return lambdaParams;
    },

    updateLambdaFunction: async function(fleetConfigData, routeName, region, correlationData) {
        let lambda = new aws.Lambda({
            region: region
        });

        await lambda.updateFunctionCode(this.setupUpdateLambdaParams(fleetConfigData, routeName), (err, data) => {
            if (err) util.showLog(`${err} ${err.stack}`, correlationData)
            else {
                util.showLog(`Lambda function updated in ${region}.`, correlationData);
            }
        });
    },

    createLambdaFunction: async function(fleetConfigData, routeName, region, correlationData) {
        if (fleetConfigData.routes[routeName].lambda &&
            fleetConfigData.routes[routeName].lambda[region] &&
            fleetConfigData.routes[routeName].lambda[region].functionArn) {
            //lambda already exists, update function
            util.showLog(`Found deployed lambda for ${routeName} in ${region}, updating...`, correlationData);
            await this.updateLambdaFunction(fleetConfigData, routeName, region, correlationData);
        } else {
            //lambda not found, create function
            let lambda = new aws.Lambda({
                region: region
            });

            await lambda.createFunction(this.setupNewLambdaParams(fleetConfigData, routeName)).promise()
                .then(function(response) {
                    let data = response;
                    fleetConfigData.routes[routeName].lambda = fleetConfigData.routes[routeName].lambda || {};
                    fleetConfigData.routes[routeName].lambda[region] =
                        fleetConfigData.routes[routeName].lambda[region] || {};

                    fleetConfigData.routes[routeName].lambda[region].functionArn = data.FunctionArn;
                    fleetConfigData.routes[routeName].lambda[region].functionName = data.FunctionName;
                    util.updateFleetConfigFileData(fleetConfigData);
                    util.showLog(`Lambda function created in ${region}.`, correlationData);
                }, function(err) {
                    util.showLog(`${err} ${err.stack}`, correlationData)
                });
        }
    },

    createOrUpdateLambda: async function(fleetConfigData, routeName, region, correlationData) {
        util.showLog(`Deploying Lambda for ${routeName} in ${region}...`, correlationData);        
        await this.createLambdaFunction(fleetConfigData, routeName, region, correlationData);
    },

    ensureLambdaUndeployed: async function(fleetConfigData, routeName, region, correlationData) {
        util.showLog(`Undeploying ${routeName} in ${region}...`, correlationData);

        await deleteApigResource(fleetConfigData, routeName, region, correlationData);
        await deleteLambdaFunction(fleetConfigData, routeName, region, correlationData);

        delete fleetConfigData.routes[routeName].gateway[region];
        delete fleetConfigData.routes[routeName].lambda[region];
        delete fleetConfigData.routes[routeName].url[region];
        util.updateFleetConfigFileData(fleetConfigData);

        return true;
    },

    removeUnusedResources: async function(fleetConfigData, correlationData) {
        util.showLog(`Undeploying unused resources...`, correlationData);

        for(routeName in fleetConfigData.routes) {
            if(fleetConfigData.routes[routeName].url) {
                for(region in fleetConfigData.region) {
                    if(fleetConfigData.routes[routeName].url[fleetConfigData.region[region]]) {
                        await this.ensureLambdaUndeployed(fleetConfigData, routeName, fleetConfigData.region[region], correlationData);
                    }
                }
            }
        }

        await ensureLambdaRolePolicyUndeployed(fleetConfigData, correlationData);
        await ensureLambdaRoleUndeployed(fleetConfigData, correlationData);

        for(region in fleetConfigData.region) {
            await ensureApiGatewayUndeployed(
                fleetConfigData, 
                fleetConfigData.gateway[fleetConfigData.region[region]], 
                fleetConfigData.region[region], 
                correlationData).catch(catchPromiseError.bind(this, correlationData));
        }
        
        util.updateFleetConfigFileData(fleetConfigData);
    },

    createOrUpdateWebsiteBucket: async function(fleetConfigData, websiteName, correlationData) {
        if (fleetConfigData.websites[websiteName].url) {
            util.showLog(`Found deployed website for ${websiteName}, updating...`, correlationData);
        } else {
            await createS3Bucket(fleetConfigData, websiteName).catch(catchPromiseError.bind(this, correlationData));
            await putS3Website(fleetConfigData, websiteName).catch(catchPromiseError.bind(this, correlationData));
        }

        await putS3WebsiteContent(fleetConfigData, websiteName).catch(catchPromiseError.bind(this, correlationData));
    },

    describeRegions: async function(fleetConfigData, correlationData) {
        let regions = [];

        await ec2.describeRegions(fleetConfigData).then((data) => {
            for(region in data.Regions) {
                regions.push(data.Regions[region].RegionName)
            }
        }).catch(catchPromiseError.bind(this, correlationData))

        return regions;
    }
};