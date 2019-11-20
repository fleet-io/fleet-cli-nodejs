let resolve = require('path').resolve;
let util = require('../utilities');
let apig = require('./apig');
let lambda = require('./lambda');
let iam = require('./iam');
let s3 = require('./s3');
let fs = require('fs');
let dir = require('node-dir');
let ec2 = require('./ec2');

let handleCreateRestApi = async(fleetConfigData, region, fleetPath, correlationData, data) => {
    //update config data with apig id
    fleetConfigData.gateway = fleetConfigData.gateway || {};
    fleetConfigData.gateway[region] = {
        id: data.id
    };
    util.updateFleetConfigFileData(fleetConfigData, fleetPath);

    //get resources of the new APIG.
    let params = {
        restApiId: fleetConfigData.gateway[region].id
    };

    //this is necessary to know the ID of the root resource used to attach
    // any other new resources to this apig.
    await apig.getRestApiResources(fleetConfigData, region, params, fleetPath, correlationData)
        .then(handleGetRestApiResources.bind(this, fleetConfigData, region, data, fleetPath, correlationData)).catch(e => {throw e});
}

let handleGetRestApiResources = (fleetConfigData, region, data, fleetPath, correlationData, apiResources) => {
    //update config data with root resource ID of new apig
    fleetConfigData.gateway[region].rootResourceId = apiResources.items[0].id;
    util.updateFleetConfigFileData(fleetConfigData, fleetPath);

    util.showLog(`Deployed API Gateway for ${fleetConfigData.appName} (${data.id}) in ${region}.`, fleetPath, correlationData);
}

let handleDeleteRestApi = async(fleetConfigData, region, fleetPath, correlationData, data) => {
    //remove gateway from config
    delete fleetConfigData.gateway[region];
    util.updateFleetConfigFileData(fleetConfigData, fleetPath);
    util.showLog(`Delete API Gateway in ${region} for ${fleetConfigData.appName}`, fleetPath, correlationData);
}

let handleCreateRestApiResource = async(fleetConfigData, route, routeName, region, fleetPath, correlationData, resource) => {
    //update config data with new resource
    fleetConfigData.routes[routeName].gateway = fleetConfigData.routes[routeName].gateway || {};
    fleetConfigData.routes[routeName].gateway[region] = {
        resource: resource
    };
    util.updateFleetConfigFileData(fleetConfigData, fleetPath);

    util.showLog(`Deployed Route for ${routeName} (${resource.id}) in ${region}.`, fleetPath, correlationData);

    //setup params for apig put method for this new resource
    let params = {
        authorizationType: 'NONE',
        httpMethod: route.type,
        resourceId: resource.id,
        restApiId: fleetConfigData.gateway[region].id
    };

    await apig.createResourceMethod(fleetConfigData, region, params, fleetPath, correlationData)
        .then(handleCreateResourceMethod.bind(this, fleetConfigData, route, routeName, region, fleetPath, correlationData))
        .catch(e => {throw e});
}

let handleCreateResourceMethod = async(fleetConfigData, route, routeName, region, fleetPath, correlationData, method) => {
    //update config data with route's method type
    fleetConfigData.routes[routeName].gateway[region].method = method;
    util.updateFleetConfigFileData(fleetConfigData, fleetPath);

    util.showLog(`Deployed ${route.type} method for ${routeName} API Gateway in ${region}.`, fleetPath, correlationData);

    //setup params for resource integration with lambda function
    let params = {
        httpMethod: route.type,
        resourceId: route.gateway[region].resource.id,
        restApiId: fleetConfigData.gateway[region].id,
        type: 'AWS_PROXY',
        integrationHttpMethod: 'POST',
        uri: `arn:aws:apigateway:${region}:lambda:path//2015-03-31/functions/${fleetConfigData.routes[routeName].lambda[region].functionArn}/invocations`
    };

    await apig.createResourceLambdaIntegration(fleetConfigData, region, params, fleetPath, correlationData)
        .then(handleCreateResourceLambdaIntegration.bind(this, fleetConfigData, routeName, region, fleetPath, correlationData))
        .catch(e => {throw e});
}

let handleCreateResourceLambdaIntegration = async(fleetConfigData, routeName, region, fleetPath, correlationData, response) => {
    util.showLog(`Integrated Lambda function with API Gateway in ${region}.`, fleetPath, correlationData);

    let params = {
        Action: "lambda:InvokeFunction",
        FunctionName: fleetConfigData.routes[routeName].lambda[region].functionName,
        Principal: "apigateway.amazonaws.com",
        StatementId: "ID-1"
    };

    await lambda.addApigPermission(fleetConfigData, region, params, fleetPath, correlationData)
        .then(handleAddApigPermission.bind(this, fleetConfigData, routeName, region, fleetPath, correlationData))
        .catch(e => {throw e});
}

let handleAddApigPermission = async(fleetConfigData, routeName, region, fleetPath, correlationData, response) => {
    util.showLog(`Added permission to Lambda function for API Gateway invocation in ${region}.`, fleetPath, correlationData);

    let params = {
        restApiId: fleetConfigData.gateway[region].id,
        stageName: 'api'
    };

    await apig.createResourceDeployment(fleetConfigData, region, params, fleetPath, correlationData)
        .then(handleCreateResourceDeployment.bind(this, fleetConfigData, routeName, region, fleetPath, correlationData)).catch(e => {throw e});
}

let handleCreateResourceDeployment = (fleetConfigData, routeName, region, fleetPath, correlationData, response) => {
    util.showLog(`API Resource for ${routeName} deployed to API stage in ${region}.`, fleetPath, correlationData);
    util.showLog(`Route fully deployed in ${region}!`, fleetPath, correlationData);

    //update config data with the URL of this deployed api
    fleetConfigData.routes[routeName].url = fleetConfigData.routes[routeName].url || {};

    fleetConfigData.routes[routeName].url[region] = 
        `https://${fleetConfigData.gateway[region].id}.execute-api.${region}.amazonaws.com/api/${fleetConfigData.routes[routeName].apiPath}`;

    util.updateFleetConfigFileData(fleetConfigData, fleetPath);

    util.showLog(
        `View route at https://${fleetConfigData.gateway[region].id}.execute-api.${region}.amazonaws.com/api/${fleetConfigData.routes[routeName].apiPath}`, 
        fleetPath, 
        correlationData);
}

let handleCreateLambdaIAMRole = (fleetConfigData, fleetPath, correlationData, role) => {
    //update config data with this iam role
    fleetConfigData['lambda-role'] = fleetConfigData['lambda-role'] || {};
    fleetConfigData['lambda-role'].roleName = role.Role.RoleName;
    fleetConfigData['lambda-role'].roleArn = role.Role.Arn;
    util.updateFleetConfigFileData(fleetConfigData, fleetPath);

    util.showLog(`Created service role ${fleetConfigData['lambda-role'].roleName} for Lambda.`, fleetPath, correlationData);
}

let handleCreateLambdaPolicy = (fleetConfigData, fleetPath, correlationData, policy) => {
    //update config data with lambda role policy
    fleetConfigData['lambda-role'].policy = 'inline';
    util.updateFleetConfigFileData(fleetConfigData, fleetPath);

    util.showLog(`Added inline policy for Lambda role ${fleetConfigData['lambda-role'].roleName}`, fleetPath, correlationData);
}

let deleteApigResource = async(fleetConfigData, routeName, region, fleetPath, correlationData) => {
    let params = {
        resourceId: fleetConfigData.routes[routeName].gateway[region].resource.id,
        restApiId: fleetConfigData.gateway[region].id,
    };

    util.showLog(`Deleting API Gateway resource for ${routeName} in ${region}...`, fleetPath, correlationData);

    await apig.deleteResource(fleetConfigData, region, params, fleetPath, correlationData).catch(e => {throw e});
}

let deleteLambdaFunction = async(fleetConfigData, routeName, region, fleetPath, correlationData) => {
    let params = {
        FunctionName: fleetConfigData.routes[routeName].lambda[region].functionName
    };

    util.showLog(`Deleting Lambda function for ${routeName} in ${region}...`, fleetPath, correlationData);

    await lambda.deleteFunction(fleetConfigData, region, params, fleetPath, correlationData).catch(e => {throw e});
}

let ensureLambdaRolePolicyUndeployed = async function(fleetConfigData, fleetPath, correlationData) {
    util.showLog(`Deleting Lambda Role Policy from ${fleetConfigData['lambda-role'].roleName}...`, fleetPath, correlationData);

    let params = {
        PolicyName: fleetConfigData['lambda-role'].roleName,
        RoleName: fleetConfigData['lambda-role'].roleName
    }

    await iam.deleteIAMRolePolicy(fleetConfigData, params, fleetPath, correlationData).catch(e => {throw e});
}

let ensureLambdaRoleUndeployed = async function(fleetConfigData, fleetPath, correlationData) {
    util.showLog(`Deleting Lambda Role ${fleetConfigData['lambda-role'].roleName}...`, fleetPath, correlationData);

    let params = {
        RoleName: fleetConfigData['lambda-role'].roleName
    }

    await iam.deleteIAMRole(fleetConfigData, params, fleetPath, correlationData).catch(e => {throw e});
}

let ensureApiGatewayUndeployed = async function(fleetConfigData, gateway, region, fleetPath, correlationData) {
    util.showLog(`Deleting API Gateway ${gateway.id} for ${fleetConfigData.appName} in ${region}`, fleetPath, correlationData);
        
    let params = {
        restApiId: gateway.id
    };

    await apig.deleteRestApi(fleetConfigData, region, params, fleetPath, correlationData)
        .then(handleDeleteRestApi.bind(this, fleetConfigData, region, fleetPath, correlationData)).catch(e => {throw e});
}

let handleCreateS3Bucket = function(fleetConfigData, websiteName, fleetPath, correlationData, data) {
    fleetConfigData.websites[websiteName].url = data.Location;
    util.updateFleetConfigFileData(fleetConfigData, fleetPath);
}

let createS3Bucket = async function(fleetConfigData, websiteName, fleetPath, correlationData) {
    let params = {
        Bucket: `fleet-${fleetConfigData.appName}-${websiteName}`
    }

    await s3.createBucket(fleetConfigData, params, fleetPath, correlationData)
        .then(handleCreateS3Bucket.bind(this, fleetConfigData, websiteName, fleetPath, correlationData)).catch(e => {throw e});
}

let putS3Website = async function(fleetConfigData, websiteName, fleetPath, correlationData) {
    util.showLog(`Setting S3 Website Configuration...`, fleetPath, correlationData);

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

    await s3.putBucketWebsite(fleetConfigData, params, fleetPath, correlationData).catch(e => {throw e});
}

let putS3WebsiteContent = async function(fleetConfigData, websiteName, fleetPath, correlationData) {
    util.showLog(`Uploading files...`, fleetPath, correlationData);
    //TODO: empty bucket prior to upload?

    let filePath = `${fleetPath}\\websites\\${websiteName}`;
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

        await s3.putObject(fleetConfigData, params, fleetPath, correlationData).catch(e => {throw e});
    });
}

let handleLambdaCreateFunction = async function(fleetConfigData, routeName, region, fleetPath, correlationData, response) {
    let data = response;
    fleetConfigData.routes[routeName].lambda = fleetConfigData.routes[routeName].lambda || {};
    fleetConfigData.routes[routeName].lambda[region] =
        fleetConfigData.routes[routeName].lambda[region] || {};

    fleetConfigData.routes[routeName].lambda[region].functionArn = data.FunctionArn;
    fleetConfigData.routes[routeName].lambda[region].functionName = data.FunctionName;
    util.updateFleetConfigFileData(fleetConfigData, fleetPath);
    util.showLog(`Lambda function ${routeName} created in ${region}.`, fleetPath, correlationData);
}

let handleLambdaUpdateFunction = async function(fleetConfigData, routeName, region, fleetPath, correlationData, response) {
    util.showLog(`Lambda function ${routeName} updated in ${region}.`, fleetPath, correlationData);
}

module.exports = {
    createAPIG: async function(fleetConfigData, region, fleetPath, correlationData) {
        util.showLog(`Deploying API Gateway for ${fleetConfigData.appName} in ${region}...`, fleetPath, correlationData);

        let params = {
            name: `fleet-apigw-${fleetConfigData.appName}`,
            description: `API Gateway for fleet App ${fleetConfigData.appName}`,
            endpointConfiguration: {
                types: ["REGIONAL"]
            }
        };

        await apig.createRestApi(fleetConfigData, region, params, fleetPath, correlationData)
            .then(handleCreateRestApi.bind(this, fleetConfigData, region, fleetPath, correlationData)).catch(e => {throw e});
    },

    updateAPIG: async function(fleetConfigData, route, routeName, region, fleetPath, correlationData) {
        //Do not updateAPIG if route already deployed
        if(fleetConfigData.routes[routeName].gateway && fleetConfigData.routes[routeName].gateway[region])
            return false;

        //TODO: complex routes:
        // 1) hierarchical resources: /api/users
        // e.g. /api/users
        // 2) params: /api/users/<{pathPartName}>
        // e.g. /api/users/{id} = /api/users/1 

        let routeDefParts = util.getRoutePathParts(route.apiPath);

        util.showLog(`Updating API Gateway ${fleetConfigData.gateway[region].id} with ${routeName} route in ${region}...`, fleetPath, correlationData);

        //setup params to create rest api resource
        let params = {
            parentId: fleetConfigData.gateway[region].rootResourceId,
            restApiId: fleetConfigData.gateway[region].id,
            pathPart: route.apiPath
        };

        await apig.createRestApiResource(fleetConfigData, region, params, fleetPath, correlationData)
            .then(handleCreateRestApiResource.bind(this, fleetConfigData, route, routeName, region, fleetPath, correlationData))
            .catch(e => {throw e});
    },

    createLambdaRole: async function(fleetConfigData, fleetPath, correlationData) {
        if (fleetConfigData['lambda-role']) {
            if (fleetConfigData['lambda-role'].roleArn && fleetConfigData['lambda-role'].roleName)
                return true;
        }

        util.showLog(`Creating Lambda service role for ${fleetConfigData.appName}`, fleetPath, correlationData)

        let lambdaTrustPath = resolve(__dirname, "policies/lambda-trust.json");
        let params = {
            AssumeRolePolicyDocument: JSON.stringify(require(lambdaTrustPath)),
            RoleName: `fleet-${fleetConfigData.appName}-lambda`
        };

        await iam.createIAMRole(fleetConfigData, params, fleetPath, correlationData)
            .then(handleCreateLambdaIAMRole.bind(this, fleetConfigData, fleetPath, correlationData)).catch(e => {throw e});
    },

    createLambdaRoleInlinePolicy: async function(fleetConfigData, fleetPath, correlationData) {
        if (fleetConfigData['lambda-role'] && fleetConfigData['lambda-role'].policy) {
            return true;
        }

        util.showLog(`Adding inline policy for Lambda role for ${fleetConfigData.appName}`, fleetPath, correlationData)

        let lambdaPolicyPath = resolve(__dirname, "policies/lambda.json");
        let params = {
            PolicyName: `fleet-${fleetConfigData.appName}-lambda`,
            PolicyDocument: JSON.stringify(require(lambdaPolicyPath)),
            RoleName: fleetConfigData['lambda-role'].roleName
        };

        //this may not work without a retry, there is some slowness in the
        // policy availability for ~10 seconds after put.
        await iam.createIAMPolicy(fleetConfigData, params, fleetPath, correlationData)
            .then(handleCreateLambdaPolicy.bind(this, fleetConfigData, fleetPath, correlationData)).catch(e => {throw e});

        util.showLog(`Waiting for Lambda inline policy to become available...`, fleetPath, correlationData);
        await util.timeout(20000).catch(e => {throw e});
        //TODO: Check if policy is available
    },

    setupUpdateLambdaParams: function(fleetConfigData, routeName, fleetPath) {
        let s3ZipBuffer = util.getBufferZip(`${fleetPath}/${fleetConfigData.routes[routeName].path}`);

        let lambdaParams = {
            ZipFile: s3ZipBuffer,
            FunctionName: `fleet-${fleetConfigData.appName}-${routeName}`,
        };

        return lambdaParams;
    },

    setupNewLambdaParams: function(fleetConfigData, routeName, fleetPath) {
        let s3ZipBuffer = util.getBufferZip(`${fleetPath}/${fleetConfigData.routes[routeName].path}`);

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

    updateLambdaFunction: async function(fleetConfigData, routeName, region, fleetPath, correlationData) {
        let params = this.setupUpdateLambdaParams(fleetConfigData, routeName, fleetPath);
        await lambda.updateFunctionCode(fleetConfigData, region, params, fleetPath, correlationData)
                    .then(handleLambdaUpdateFunction.bind(this, fleetConfigData, routeName, region, fleetPath, correlationData))
                    .catch(e => {throw e});
    },

    createLambdaFunction: async function(fleetConfigData, routeName, region, fleetPath, correlationData) {
        if (fleetConfigData.routes[routeName].lambda &&
            fleetConfigData.routes[routeName].lambda[region] &&
            fleetConfigData.routes[routeName].lambda[region].functionArn) {
            //lambda already exists, update function
            util.showLog(`Found deployed lambda for ${routeName} in ${region}, updating...`, fleetPath, correlationData);
            await this.updateLambdaFunction(fleetConfigData, routeName, region, fleetPath, correlationData).catch(e => {throw e});
        } else {
            //lambda not found, create function
            let params = this.setupNewLambdaParams(fleetConfigData, routeName, fleetPath);
            await lambda.createFunction(fleetConfigData, region, params, fleetPath, correlationData)
                        .then(handleLambdaCreateFunction.bind(this, fleetConfigData, routeName, region, fleetPath, correlationData))
                        .catch(e => {throw e});
        }
    },

    createOrUpdateLambda: async function(fleetConfigData, routeName, region, fleetPath, correlationData) {
        util.showLog(`Deploying Lambda for ${routeName} in ${region}...`, fleetPath, correlationData);        
        await this.createLambdaFunction(fleetConfigData, routeName, region, fleetPath, correlationData).catch(e => {throw e});
    },

    ensureLambdaUndeployed: async function(fleetConfigData, routeName, region, fleetPath, correlationData) {
        util.showLog(`Undeploying ${routeName} in ${region}...`, fleetPath, correlationData);

        await deleteApigResource(fleetConfigData, routeName, region, fleetPath, correlationData).catch(e => {throw e});
        await deleteLambdaFunction(fleetConfigData, routeName, region, fleetPath, correlationData).catch(e => {throw e});

        delete fleetConfigData.routes[routeName].gateway[region];
        delete fleetConfigData.routes[routeName].lambda[region];
        delete fleetConfigData.routes[routeName].url[region];
        util.updateFleetConfigFileData(fleetConfigData, fleetPath);

        return true;
    },

    removeUnusedResources: async function(fleetConfigData, fleetPath, correlationData) {
        util.showLog(`Undeploying unused resources...`, fleetPath, correlationData);

        for(routeName in fleetConfigData.routes) {
            if(fleetConfigData.routes[routeName].url) {
                for(region in fleetConfigData.region) {
                    if(fleetConfigData.routes[routeName].url[fleetConfigData.region[region]]) {
                        await this.ensureLambdaUndeployed(fleetConfigData, routeName, fleetConfigData.region[region], fleetPath, correlationData)
                                    .catch(e => {throw e});
                    }
                }
            }
        }

        await ensureLambdaRolePolicyUndeployed(fleetConfigData, fleetPath, correlationData).catch(e => {throw e});
        await ensureLambdaRoleUndeployed(fleetConfigData, fleetPath, correlationData).catch(e => {throw e});

        for(region in fleetConfigData.region) {
            await ensureApiGatewayUndeployed(
                fleetConfigData, 
                fleetConfigData.gateway[fleetConfigData.region[region]], 
                fleetConfigData.region[region], 
                fleetPath, 
                correlationData).catch(e => {throw e});
        }
        
        util.updateFleetConfigFileData(fleetConfigData, fleetPath);
    },

    createOrUpdateWebsiteBucket: async function(fleetConfigData, websiteName, fleetPath, correlationData) {
        if (fleetConfigData.websites[websiteName].url) {
            util.showLog(`Found deployed website for ${websiteName}, updating...`, fleetPath, correlationData);
        } else {
            await createS3Bucket(fleetConfigData, websiteName, fleetPath, correlationData).catch(e => {throw e});
            await putS3Website(fleetConfigData, websiteName, fleetPath, correlationData).catch(e => {throw e});
        }

        await putS3WebsiteContent(fleetConfigData, websiteName, fleetPath, correlationData).catch(e => {throw e});
    },

    describeRegions: async function(fleetConfigData, fleetPath, correlationData) {
        let regions = [];
        
        let describeRegionsResult = await ec2.describeRegions(fleetConfigData, null, {}, fleetPath, correlationData).catch(e => {throw e});
        for(region in describeRegionsResult.Regions) {
            regions.push(describeRegionsResult.Regions[region].RegionName)
        }

        return regions;
    }
};