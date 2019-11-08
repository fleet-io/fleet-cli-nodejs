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
    await apig.getRestApiResources(fleetConfigData, region, params, correlationData)
        .then(handleGetRestApiResources.bind(this, fleetConfigData, region, data, correlationData)).catch(e => {throw e});
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

    await apig.createResourceMethod(fleetConfigData, region, params, correlationData)
        .then(handleCreateResourceMethod.bind(this, fleetConfigData, route, routeName, region, correlationData)).catch(e => {throw e});
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

    await apig.createResourceLambdaIntegration(fleetConfigData, region, params, correlationData)
        .then(handleCreateResourceLambdaIntegration.bind(this, fleetConfigData, routeName, region, correlationData)).catch(e => {throw e});
}

let handleCreateResourceLambdaIntegration = async(fleetConfigData, routeName, region, correlationData, response) => {
    util.showLog(`Integrated Lambda function with API Gateway in ${region}.`, correlationData);

    let params = {
        Action: "lambda:InvokeFunction",
        FunctionName: fleetConfigData.routes[routeName].lambda[region].functionName,
        Principal: "apigateway.amazonaws.com",
        StatementId: "ID-1"
    };

    await lambda.addApigPermission(fleetConfigData, region, params, correlationData)
        .then(handleAddApigPermission.bind(this, fleetConfigData, routeName, region, correlationData)).catch(e => {throw e});
}

let handleAddApigPermission = async(fleetConfigData, routeName, region, correlationData, response) => {
    util.showLog(`Added permission to Lambda function for API Gateway invocation in ${region}.`, correlationData);

    let params = {
        restApiId: fleetConfigData.gateway[region].id,
        stageName: 'api'
    };

    await apig.createResourceDeployment(fleetConfigData, region, params, correlationData)
        .then(handleCreateResourceDeployment.bind(this, fleetConfigData, routeName, region, correlationData)).catch(e => {throw e});
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

    await apig.deleteResource(fleetConfigData, region, params, correlationData).catch(e => {throw e});
}

let deleteLambdaFunction = async(fleetConfigData, routeName, region, correlationData) => {
    let params = {
        FunctionName: fleetConfigData.routes[routeName].lambda[region].functionName
    };

    util.showLog(`Deleting Lambda function for ${routeName} in ${region}...`, correlationData);

    await lambda.deleteFunction(fleetConfigData, region, params, correlationData).catch(e => {throw e});
}

let ensureLambdaRolePolicyUndeployed = async function(fleetConfigData, correlationData) {
    util.showLog(`Deleting Lambda Role Policy from ${fleetConfigData['lambda-role'].roleName}...`, correlationData);

    let params = {
        PolicyName: fleetConfigData['lambda-role'].roleName,
        RoleName: fleetConfigData['lambda-role'].roleName
    }

    await iam.deleteIAMRolePolicy(fleetConfigData, params, correlationData).catch(e => {throw e});
}

let ensureLambdaRoleUndeployed = async function(fleetConfigData, correlationData) {
    util.showLog(`Deleting Lambda Role ${fleetConfigData['lambda-role'].roleName}...`, correlationData);

    let params = {
        RoleName: fleetConfigData['lambda-role'].roleName
    }

    await iam.deleteIAMRole(fleetConfigData, params, correlationData).catch(e => {throw e});
}

let ensureApiGatewayUndeployed = async function(fleetConfigData, gateway, region, correlationData) {
    util.showLog(`Deleting API Gateway ${gateway.id} for ${fleetConfigData.appName} in ${region}`, correlationData);
        
    let params = {
        restApiId: gateway.id
    };

    await apig.deleteRestApi(fleetConfigData, region, params, correlationData)
        .then(handleDeleteRestApi.bind(this, fleetConfigData, region, correlationData)).catch(e => {throw e});
}

let handleCreateS3Bucket = function(fleetConfigData, websiteName, correlationData, data) {
    fleetConfigData.websites[websiteName].url = data.Location;
    util.updateFleetConfigFileData(fleetConfigData);
}

let createS3Bucket = async function(fleetConfigData, websiteName, correlationData) {
    let params = {
        Bucket: `fleet-${fleetConfigData.appName}-${websiteName}`
    }

    await s3.createBucket(fleetConfigData, params, correlationData)
        .then(handleCreateS3Bucket.bind(this, fleetConfigData, websiteName, correlationData)).catch(e => {throw e});
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

    await s3.putBucketWebsite(fleetConfigData, params, correlationData).catch(e => {throw e});
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

        await s3.putObject(fleetConfigData, params, correlationData).catch(e => {throw e});
    });
}

let handleLambdaCreateFunction = async function(fleetConfigData, routeName, region, correlationData, response) {
    let data = response;
    fleetConfigData.routes[routeName].lambda = fleetConfigData.routes[routeName].lambda || {};
    fleetConfigData.routes[routeName].lambda[region] =
        fleetConfigData.routes[routeName].lambda[region] || {};

    fleetConfigData.routes[routeName].lambda[region].functionArn = data.FunctionArn;
    fleetConfigData.routes[routeName].lambda[region].functionName = data.FunctionName;
    util.updateFleetConfigFileData(fleetConfigData);
    util.showLog(`Lambda function ${routeName} created in ${region}.`, correlationData);
}

let handleLambdaUpdateFunction = async function(fleetConfigData, routeName, region, correlationData, response) {
    util.showLog(`Lambda function ${routeName} updated in ${region}.`, correlationData);
}

let catchPromiseError = (correlationData, error) => {
    util.showLog(`Error in aws-interface: ${error}`, correlationData); // an error occurred
    throw error;
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

        await apig.createRestApi(fleetConfigData, region, params, correlationData)
            .then(handleCreateRestApi.bind(this, fleetConfigData, region, correlationData)).catch(e => {throw e});
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

        await apig.createRestApiResource(fleetConfigData, region, params, correlationData)
            .then(handleCreateRestApiResource.bind(this, fleetConfigData, route, routeName, region, correlationData)).catch(e => {throw e});
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

        await iam.createIAMRole(fleetConfigData, params, correlationData)
            .then(handleCreateLambdaIAMRole.bind(this, fleetConfigData, correlationData)).catch(e => {throw e});
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
        await iam.createIAMPolicy(fleetConfigData, params, correlationData)
            .then(handleCreateLambdaPolicy.bind(this, fleetConfigData, correlationData)).catch(e => {throw e});

        util.showLog(`Waiting for Lambda inline policy to become available...`, correlationData);
        await util.timeout(20000).catch(e => {throw e});
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
            Runtime: 'nodejs10.x'
        };

        return lambdaParams;
    },

    updateLambdaFunction: async function(fleetConfigData, routeName, region, correlationData) {
        let params = this.setupUpdateLambdaParams(fleetConfigData, routeName);
        await lambda.updateFunctionCode(fleetConfigData, region, params, correlationData)
                    .then(handleLambdaUpdateFunction.bind(this, fleetConfigData, routeName, region, correlationData))
                    .catch(e => {throw e});
    },

    createLambdaFunction: async function(fleetConfigData, routeName, region, correlationData) {
        if (fleetConfigData.routes[routeName].lambda &&
            fleetConfigData.routes[routeName].lambda[region] &&
            fleetConfigData.routes[routeName].lambda[region].functionArn) {
            //lambda already exists, update function
            util.showLog(`Found deployed lambda for ${routeName} in ${region}, updating...`, correlationData);
            await this.updateLambdaFunction(fleetConfigData, routeName, region, correlationData).catch(e => {throw e});
        } else {
            //lambda not found, create function
            let params = this.setupNewLambdaParams(fleetConfigData, routeName);
            await lambda.createFunction(fleetConfigData, region, params, correlationData)
                        .then(handleLambdaCreateFunction.bind(this, fleetConfigData, routeName, region, correlationData))
                        .catch(e => {throw e});
        }
    },

    createOrUpdateLambda: async function(fleetConfigData, routeName, region, correlationData) {
        util.showLog(`Deploying Lambda for ${routeName} in ${region}...`, correlationData);        
        await this.createLambdaFunction(fleetConfigData, routeName, region, correlationData).catch(e => {throw e});
    },

    ensureLambdaUndeployed: async function(fleetConfigData, routeName, region, correlationData) {
        util.showLog(`Undeploying ${routeName} in ${region}...`, correlationData);

        await deleteApigResource(fleetConfigData, routeName, region, correlationData).catch(e => {throw e});
        await deleteLambdaFunction(fleetConfigData, routeName, region, correlationData).catch(e => {throw e});

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
                        await this.ensureLambdaUndeployed(fleetConfigData, routeName, fleetConfigData.region[region], correlationData)
                                    .catch(e => {throw e});
                    }
                }
            }
        }

        await ensureLambdaRolePolicyUndeployed(fleetConfigData, correlationData).catch(e => {throw e});
        await ensureLambdaRoleUndeployed(fleetConfigData, correlationData).catch(e => {throw e});

        for(region in fleetConfigData.region) {
            await ensureApiGatewayUndeployed(
                fleetConfigData, 
                fleetConfigData.gateway[fleetConfigData.region[region]], 
                fleetConfigData.region[region], 
                correlationData).catch(e => {throw e});
        }
        
        util.updateFleetConfigFileData(fleetConfigData);
    },

    createOrUpdateWebsiteBucket: async function(fleetConfigData, websiteName, correlationData) {
        if (fleetConfigData.websites[websiteName].url) {
            util.showLog(`Found deployed website for ${websiteName}, updating...`, correlationData);
        } else {
            await createS3Bucket(fleetConfigData, websiteName).catch(e => {throw e});
            await putS3Website(fleetConfigData, websiteName).catch(e => {throw e});
        }

        await putS3WebsiteContent(fleetConfigData, websiteName).catch(e => {throw e});
    },

    describeRegions: async function(fleetConfigData, correlationData) {
        let regions = [];
        
        let describeRegionsResult = await ec2.describeRegions(fleetConfigData, null, {}, correlationData).catch(e => {throw e});
        for(region in describeRegionsResult.Regions) {
            regions.push(describeRegionsResult.Regions[region].RegionName)
        }

        return regions;
    }
};