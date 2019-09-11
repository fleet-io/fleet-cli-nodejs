let aws = require('aws-sdk');
let resolve = require('path').resolve;
let util = require('../utilities');
let apig = require('./apig');
let lambda = require('./lambda');
let iam = require('./iam');
let s3 = require('./s3');
let fs = require('fs');

let handleCreateRestApi = async(fleetConfigData, data) => {
    //update config data with apig id
    fleetConfigData.gateway = {
        id: data.id
    };
    util.updateFleetConfigFileData(fleetConfigData);

    //get resources of the new APIG.
    let params = {
        restApiId: fleetConfigData.gateway.id
    };

    //this is necessary to know the ID of the root resource used to attach
    // any other new resources to this apig.
    await apig.getRestApiResources(fleetConfigData, params)
        .then(handleGetRestApiResources.bind(this, fleetConfigData, data))
        .catch(catchPromiseError.bind(this));
}

let handleGetRestApiResources = (fleetConfigData, data, apiResources) => {
    //update config data with root resource ID of new apig
    fleetConfigData.gateway.rootResourceId = apiResources.items[0].id;
    util.updateFleetConfigFileData(fleetConfigData);

    util.showLog(`Deployed API Gateway for ${fleetConfigData.appName} (${data.id}).`);
}

let handleCreateRestApiResource = async(fleetConfigData, route, routeName, resource) => {
    //update config data with new resource
    fleetConfigData.routes[routeName].gateway = {
        resource: resource
    };
    util.updateFleetConfigFileData(fleetConfigData);

    util.showLog(`Deployed Route for ${routeName} (${resource.id}).`);

    //setup params for apig put method for this new resource
    let params = {
        authorizationType: 'NONE',
        httpMethod: route.type,
        resourceId: resource.id,
        restApiId: fleetConfigData.gateway.id
    };

    await apig.createResourceMethod(fleetConfigData, params)
        .then(handleCreateResourceMethod.bind(this, fleetConfigData, route, routeName))
        .catch(catchPromiseError.bind(this));
}

let handleCreateResourceMethod = async(fleetConfigData, route, routeName, method) => {
    //update config data with route's method type
    fleetConfigData.routes[routeName].gateway.method = method;
    util.updateFleetConfigFileData(fleetConfigData);

    util.showLog(`Deployed ${route.type} method for ${routeName} API Gateway.`);

    //setup params for resource integration with lambda function
    let params = {
        httpMethod: route.type,
        resourceId: route.gateway.resource.id,
        restApiId: fleetConfigData.gateway.id,
        type: 'AWS_PROXY',
        integrationHttpMethod: 'POST',
        uri: `arn:aws:apigateway:${fleetConfigData.region}:lambda:path//2015-03-31/functions/${fleetConfigData.routes[routeName].lambda.functionArn}/invocations`
    };

    await apig.createResourceLambdaIntegration(fleetConfigData, params)
        .then(handleCreateResourceLambdaIntegration.bind(this, fleetConfigData, routeName))
        .catch(catchPromiseError.bind(this));
}

let handleCreateResourceLambdaIntegration = async(fleetConfigData, routeName, response) => {
    util.showLog(`Integrated Lambda function with API Gateway.`);

    let params = {
        Action: "lambda:InvokeFunction",
        FunctionName: fleetConfigData.routes[routeName].lambda.functionName,
        Principal: "apigateway.amazonaws.com",
        StatementId: "ID-1"
    };

    await lambda.addApigPermission(fleetConfigData, params)
        .then(handleAddApigPermission.bind(this, fleetConfigData, routeName))
        .catch(catchPromiseError.bind(this));
}

let handleAddApigPermission = async(fleetConfigData, routeName, response) => {
    util.showLog(`Added permission to Lambda function for API Gateway invocation.`);

    let params = {
        restApiId: fleetConfigData.gateway.id,
        stageName: 'api'
    };

    await apig.createResourceDeployment(fleetConfigData, params)
        .then(handleCreateResourceDeployment.bind(this, fleetConfigData, routeName))
        .catch(catchPromiseError.bind(this));
}

let handleCreateResourceDeployment = (fleetConfigData, routeName, response) => {
    util.showLog(`API Gateway Deployed to API stage.`);
    util.showLog(`Route fully deployed!`);

    //update config data with the URL of this deployed api
    fleetConfigData.routes[routeName].url = `https://${fleetConfigData.gateway.id}.execute-api.${fleetConfigData.region}.amazonaws.com/api/${fleetConfigData.routes[routeName].apiPath}`;
    util.updateFleetConfigFileData(fleetConfigData);

    util.showLog(`View route at https://${fleetConfigData.gateway.id}.execute-api.${fleetConfigData.region}.amazonaws.com/api/${fleetConfigData.routes[routeName].apiPath}`);
}

let handleCreateLambdaIAMRole = (fleetConfigData, role) => {
    //update config data with this iam role
    fleetConfigData['lambda-role'] = fleetConfigData['lambda-role'] || {};
    fleetConfigData['lambda-role'].roleName = role.Role.RoleName;
    fleetConfigData['lambda-role'].roleArn = role.Role.Arn;
    util.updateFleetConfigFileData(fleetConfigData);

    util.showLog(`Created Service Role For Lambda.`);
}

let handleCreateLambdaPolicy = (fleetConfigData, policy) => {
    //update config data with lambda role policy
    fleetConfigData['lambda-role'].policy = 'inline';
    util.updateFleetConfigFileData(fleetConfigData);

    util.showLog(`Added Inline Policy For Lambda Role`);
}

let deleteApigResource = async(fleetConfigData, routeName) => {
    let params = {
        resourceId: fleetConfigData.routes[routeName].gateway.resource.id,
        restApiId: fleetConfigData.gateway.id,
    };

    util.showLog(`Deleting API Gateway resource...`);
    await apig.deleteResource(fleetConfigData, params)
        .catch(catchPromiseError.bind(this));
}

let deleteLambdaFunction = async(fleetConfigData, routeName) => {
    let params = {
        FunctionName: fleetConfigData.routes[routeName].lambda.functionName
    };

    util.showLog(`Deleting lambda function...`);
    await lambda.deleteFunction(fleetConfigData, params)
        .catch(catchPromiseError.bind(this));
}

let ensureLambdaRolePolicyUndeployed = async function(fleetConfigData) {
    util.showLog(`Deleting Lambda Role Policy ${fleetConfigData['lambda-role'].roleName}...`);

    let params = {
        PolicyName: fleetConfigData['lambda-role'].roleName,
        RoleName: fleetConfigData['lambda-role'].roleName
    }

    await iam.deleteIAMRolePolicy(fleetConfigData, params)
        .catch(catchPromiseError.bind(this));
}

let ensureLambdaRoleUndeployed = async function(fleetConfigData) {
    util.showLog(`Deleting Lambda Role ${fleetConfigData['lambda-role'].roleName}...`);

    let params = {
        RoleName: fleetConfigData['lambda-role'].roleName
    }

    await iam.deleteIAMRole(fleetConfigData, params)
        .catch(catchPromiseError.bind(this));
}

let ensureApiGatewayUndeployed = async function(fleetConfigData) {
    util.showLog(`Deleting API Gateway ${fleetConfigData.gateway.id}...`);

    let params = {
        restApiId: fleetConfigData.gateway.id
    }

    await apig.deleteRestApi(fleetConfigData, params)
        .catch(catchPromiseError.bind(this));
}

let handleCreateS3Bucket = function(fleetConfigData, websiteName, data) {
    fleetConfigData.websites[websiteName].url = data.Location;
    util.updateFleetConfigFileData(fleetConfigData);
}

let createS3Bucket = async function(fleetConfigData, websiteName) {
    let params = {
        Bucket: `fleet-${fleetConfigData.appName}-${websiteName}`
    }

    await s3.createBucket(fleetConfigData, params)
        .then(handleCreateS3Bucket.bind(this, fleetConfigData, websiteName))
        .catch(catchPromiseError.bind(this));
}

let putS3Website = async function(fleetConfigData, websiteName) {
    util.showLog(`Setting S3 Website Configuration...`);

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
        .catch(catchPromiseError.bind(this));
}

let putS3WebsiteContent = async function(fleetConfigData, websiteName) {
    util.showLog(`Uploading files...`);

    let filePath = `${process.cwd()}\\websites\\${websiteName}`;
    let files = fs.readdirSync(filePath);
    files.forEach(async(file) => {
        let key = file;
        var body = fs.readFileSync(`${process.cwd()}\\websites\\${websiteName}\\${file}`);

        let params = {
            ACL: "public-read",
            Body: body,
            Bucket: `fleet-${fleetConfigData.appName}-${websiteName}`,
            Key: key,
            ContentType: 'text',
        }

        await s3.putObject(fleetConfigData, params)
            .catch(catchPromiseError.bind(this));
    });
}

let catchPromiseError = (error) => {
    console.log(error, error.stack); // an error occurred
}

module.exports = {
    createAPIG: async function(fleetConfigData) {
        util.showLog(`Deploying API Gateway for ${fleetConfigData.appName}...`);

        let params = {
            name: `fleet-apigw-${fleetConfigData.appName}`,
            description: `API Gateway for fleet App ${fleetConfigData.appName}`,
            endpointConfiguration: {
                types: ["REGIONAL"]
            }
        };

        //create a new apig
        await apig.createRestApi(fleetConfigData, params)
            .then(handleCreateRestApi.bind(this, fleetConfigData))
            .catch(catchPromiseError.bind(this));
    },

    updateAPIG: async function(fleetConfigData, route, routeName) {
        //TODO: complex routes:
        // 1) hierarchical resources: /api/users
        // e.g. /api/users
        // 2) params: /api/users/<{pathPartName}>
        // e.g. /api/users/{id} = /api/users/1 

        let routeDefParts = util.getRoutePathParts(route.apiPath);

        util.showLog(`Updating API Gateway ${fleetConfigData.gateway.id} with ${routeName} route...`);

        //setup params to create rest api resource
        let params = {
            parentId: fleetConfigData.gateway.rootResourceId,
            restApiId: fleetConfigData.gateway.id,
            pathPart: route.apiPath
        };

        await apig.createRestApiResource(fleetConfigData, params)
            .then(handleCreateRestApiResource.bind(this, fleetConfigData, route, routeName))
            .catch(catchPromiseError.bind(this));
    },

    createOrUpdateAPIG: async function(fleetConfigData, route, routeName) {
        if (!fleetConfigData.gateway) {
            //no gateway configured, create
            await this.createAPIG(fleetConfigData);
            await this.updateAPIG(fleetConfigData, route, routeName);
        } else {
            if (!fleetConfigData.routes[routeName].gateway) {
                //update app's gw
                await this.updateAPIG(fleetConfigData, route, routeName);
            } else {
                //apigw already exists, only updated lambda function
                util.showLog(`Route fully deployed!`);
                util.showLog(`View route at https://${fleetConfigData.gateway.id}.execute-api.${fleetConfigData.region}.amazonaws.com/api/${fleetConfigData.routes[routeName].apiPath}`);
            }
        }
    },

    createLambdaRole: async function(fleetConfigData) {
        if (fleetConfigData['lambda-role']) {
            if (fleetConfigData['lambda-role'].roleArn && fleetConfigData['lambda-role'].roleName)
                return true;
        }

        let lambdaTrustPath = resolve(__dirname, "policies/lambda-trust.json");
        let params = {
            AssumeRolePolicyDocument: JSON.stringify(require(lambdaTrustPath)),
            RoleName: `fleet-${fleetConfigData.appName}-lambda`
        };

        await iam.createIAMRole(fleetConfigData, params)
            .then(handleCreateLambdaIAMRole.bind(this, fleetConfigData))
            .catch(catchPromiseError.bind(this));
    },

    createLambdaRoleInlinePolicy: async function(fleetConfigData) {
        if (fleetConfigData['lambda-role'] && fleetConfigData['lambda-role'].policy) {
            return true;
        }

        let lambdaPolicyPath = resolve(__dirname, "policies/lambda.json");
        let params = {
            PolicyName: `fleet-${fleetConfigData.appName}-lambda`,
            PolicyDocument: JSON.stringify(require(lambdaPolicyPath)),
            RoleName: fleetConfigData['lambda-role'].roleName
        };

        //this may not work without a retry, there is some slowness in the
        // policy availability for ~10 seconds after put.
        await iam.createIAMPolicy(fleetConfigData, params)
            .then(handleCreateLambdaPolicy.bind(this, fleetConfigData))
            .catch(catchPromiseError.bind(this));

        util.showLog(`Waiting for Lambda inline policy to become available...`);
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

    updateLambdaFunction: async function(fleetConfigData, routeName) {
        let lambda = new aws.Lambda({
            region: fleetConfigData.region
        });

        await lambda.updateFunctionCode(this.setupUpdateLambdaParams(fleetConfigData, routeName), (err, data) => {
            if (err) console.log(err, err.stack); // an error occurred
            else {
                util.showLog('Lambda function updated.');
            }
        });
    },

    createLambdaFunction: async function(fleetConfigData, routeName) {
        if (fleetConfigData.routes[routeName].lambda &&
            fleetConfigData.routes[routeName].lambda.functionArn) {
            //lambda already exists, update function
            util.showLog(`Found deployed lambda for ${routeName}, updating...`);
            await this.updateLambdaFunction(fleetConfigData, routeName);
        } else {
            //lambda not found, create function
            let lambda = new aws.Lambda({
                region: fleetConfigData.region
            });

            await lambda.createFunction(this.setupNewLambdaParams(fleetConfigData, routeName)).promise()
                .then(function(response) {
                    let data = response;
                    fleetConfigData.routes[routeName].lambda =
                        fleetConfigData.routes[routeName].lambda || {};
                    fleetConfigData.routes[routeName].lambda.functionArn = data.FunctionArn;
                    fleetConfigData.routes[routeName].lambda.functionName = data.FunctionName;
                    util.updateFleetConfigFileData(fleetConfigData);
                    util.showLog('Lambda function created.');
                }, function(err) {
                    console.log(err, err.stack);
                });
        }
    },

    createOrUpdateLambda: async function(fleetConfigData, routeName) {
        util.showLog(`Deploying Lambda for ${routeName}...`);

        await this.createLambdaRole(fleetConfigData);
        await this.createLambdaRoleInlinePolicy(fleetConfigData);
        await this.createLambdaFunction(fleetConfigData, routeName);
    },

    ensureLambdaUndeployed: async function(fleetConfigData, routeName) {
        util.showLog(`Undeploying ${routeName}...`);

        await deleteApigResource(fleetConfigData, routeName);
        await deleteLambdaFunction(fleetConfigData, routeName);

        delete fleetConfigData.routes[routeName].gateway;
        delete fleetConfigData.routes[routeName].lambda;
        delete fleetConfigData.routes[routeName].url;
        util.updateFleetConfigFileData(fleetConfigData);

        return true;
    },

    removeUnusedResources: async function(fleetConfigData) {
        util.showLog(`Undeploying unused resources...`);

        await ensureLambdaRolePolicyUndeployed(fleetConfigData);
        await ensureLambdaRoleUndeployed(fleetConfigData);
        await ensureApiGatewayUndeployed(fleetConfigData);

        delete fleetConfigData['lambda-role'];
        delete fleetConfigData.gateway;
        util.updateFleetConfigFileData(fleetConfigData);
    },

    createOrUpdateWebsiteBucket: async function(fleetConfigData, websiteName) {
        if (fleetConfigData.websites[websiteName].url) {
            util.showLog(`Found deployed website for ${websiteName}, updating...`);
        } else {
            await createS3Bucket(fleetConfigData, websiteName);
            await putS3Website(fleetConfigData, websiteName);
        }

        await putS3WebsiteContent(fleetConfigData, websiteName);
    }
};